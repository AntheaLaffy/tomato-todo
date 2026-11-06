//! 定时锁机：数据模型、跨午夜本地周历、重叠检查与本轮抑制。
//! 对应 crates/core/src/lock.rs。**纯计算**——桌面锁屏执行由原生 guard 负责，
//! runtime 用本模块算出 active 状态后指挥 guard。

import { AppError, ensure } from "./errors";
import {
  asArray,
  asBool,
  asInt,
  asOpt,
  asStr,
  field,
  isObject,
  oneOf,
  rejectUnknown,
  requiredField,
} from "./json";
import type { ActiveLock, LockSchedule, LockState } from "./model";
import { addDays, atLocalDate, localDateOf, minutesOf, parseDate, weekdayMonday } from "./time";

const SCHEDULE_KEYS = ["id", "name", "start", "end", "days", "enabled", "strict"] as const;
const ACTIVE_KEYS = ["name", "startedAt", "endsAt", "strict"] as const;
const STATE_KEYS = ["schedules", "active", "suppressedUntil"] as const;

export function parseLockSchedule(raw: unknown): LockSchedule {
  if (!isObject(raw)) throw new AppError("锁机规则必须是对象");
  rejectUnknown(raw, [...SCHEDULE_KEYS], "锁机规则");
  return {
    id: requiredField(raw, "id", "锁机规则", asStr),
    name: requiredField(raw, "name", "锁机规则", asStr),
    start: requiredField(raw, "start", "锁机规则", asStr),
    end: requiredField(raw, "end", "锁机规则", asStr),
    days: asArray(requiredField(raw, "days", "锁机规则", (v) => v), "days").map((d) => asInt(d, "锁机星期")),
    enabled: requiredField(raw, "enabled", "锁机规则", asBool),
    strict: field(raw, "strict", "锁机规则", asBool, false),
  };
}

export function serializeLockSchedule(s: LockSchedule): Record<string, unknown> {
  return { id: s.id, name: s.name, start: s.start, end: s.end, days: s.days, enabled: s.enabled, strict: s.strict };
}

export function parseActiveLock(raw: unknown): ActiveLock {
  if (!isObject(raw)) throw new AppError("锁机状态必须是对象");
  rejectUnknown(raw, [...ACTIVE_KEYS], "锁机状态");
  return {
    name: requiredField(raw, "name", "锁机状态", asStr),
    startedAt: requiredField(raw, "startedAt", "锁机状态", asInt),
    endsAt: requiredField(raw, "endsAt", "锁机状态", asInt),
    strict: requiredField(raw, "strict", "锁机状态", asBool),
  };
}

export function serializeActiveLock(a: ActiveLock): Record<string, unknown> {
  return { name: a.name, startedAt: a.startedAt, endsAt: a.endsAt, strict: a.strict };
}

export function parseLockState(raw: unknown): LockState {
  if (!isObject(raw)) throw new AppError("锁机配置必须是对象");
  rejectUnknown(raw, [...STATE_KEYS], "锁机配置");
  return {
    schedules: field(raw, "schedules", "锁机配置", (v) => asArray(v, "schedules").map(parseLockSchedule), []),
    active: field(raw, "active", "锁机配置", (v) => (v === null ? null : parseActiveLock(v)), null) as ActiveLock | null,
    suppressedUntil: field(raw, "suppressedUntil", "锁机配置", asInt, 0),
  };
}

export function serializeLockState(s: LockState): Record<string, unknown> {
  return {
    schedules: s.schedules.map(serializeLockSchedule),
    // 与 Rust skip_serializing_if 对齐：无活动锁机时省略键，而不是写 "active": null。
    ...(s.active === null ? {} : { active: serializeActiveLock(s.active) }),
    suppressedUntil: s.suppressedUntil,
  };
}

export function validateLock(state: LockState): void {
  if (state.schedules.length > 20) {
    throw new AppError("最多设置 20 个锁机时段");
  }
  const ids = new Set<string>();
  const occupied = new Array<boolean>(7 * 1440).fill(false);
  for (const s of state.schedules) {
    if (
      s.id.length === 0 ||
      ids.has(s.id) ||
      s.name.trim().length === 0 ||
      Array.from(s.name).length > 40
    ) {
      throw new AppError("锁机名称需为 1–40 字符，ID 需唯一且非空");
    }
    ids.add(s.id);
    if (minutesOf(s.start) === null || minutesOf(s.end) === null || s.start === s.end) {
      throw new AppError("锁机时间需为有效 HH:MM，开始与结束不能相同");
    }
    const unique = new Set(s.days);
    if (
      s.days.length === 0 ||
      s.days.length > 7 ||
      unique.size !== s.days.length ||
      s.days.some((d) => d < 1 || d > 7)
    ) {
      throw new AppError("请选择不重复的星期（周一为 1，周日为 7）");
    }
    if (s.enabled) {
      const start = minutesOf(s.start)!;
      const end = minutesOf(s.end)!;
      const duration = (end + 1440 - start) % 1440;
      for (const day of s.days) {
        for (let offset = 0; offset < duration; offset += 1) {
          const minute = ((day - 1) * 1440 + start + offset) % (7 * 1440);
          if (occupied[minute]) {
            throw new AppError("启用的锁机时段不能重叠，请调整日期或时间");
          }
          occupied[minute] = true;
        }
      }
    }
  }
  if (state.active !== null) {
    const a = state.active;
    if (
      a.name.trim().length === 0 ||
      Array.from(a.name).length > 40 ||
      a.endsAt <= a.startedAt ||
      a.endsAt - a.startedAt > 8 * 86400
    ) {
      throw new AppError("无效的锁机状态");
    }
  }
}

/**
 * 当前时刻命中的启用规则 → 合并后的 ActiveLock；被抑制或未命中返回 null。
 * 星期归属开始日期：跨午夜规则按开始日参与匹配。
 */
export function scheduledAt(state: LockState, at: number): ActiveLock | null {
  if (at < state.suppressedUntil) return null;
  const today = localDateOf(at);
  let result: ActiveLock | null = null;
  for (const date of [addDays(today, -1), today]) {
    const weekday = weekdayMonday(date);
    for (const s of state.schedules) {
      if (!s.enabled || !s.days.includes(weekday)) continue;
      const startTime = minutesOf(s.start);
      const endTime = minutesOf(s.end);
      if (startTime === null || endTime === null) continue;
      const endDate = endTime <= startTime ? addDays(date, 1) : date;
      const start = atLocalDate(date, Math.floor(startTime / 60), startTime % 60);
      const end = atLocalDate(endDate, Math.floor(endTime / 60), endTime % 60);
      if (at >= start && at < end) {
        if (result !== null) {
          result.startedAt = Math.min(result.startedAt, start);
          result.endsAt = Math.max(result.endsAt, end);
          result.strict = result.strict || s.strict;
        } else {
          result = { name: s.name, startedAt: start, endsAt: end, strict: s.strict };
        }
      }
    }
  }
  return result;
}

/** 提前结束小憩不得吞掉无关的后续睡眠时段。 */
export function releaseLock(state: LockState, at: number): void {
  const scheduled = scheduledAt(state, at);
  if (scheduled !== null) {
    state.suppressedUntil = Math.max(state.suppressedUntil, scheduled.endsAt);
  }
  state.active = null;
}
