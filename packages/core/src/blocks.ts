//! 课表阻塞时段：计划之外的每周固定占用（课程、实验）。纯描述：不带进度、不管辖实例、不锁机。
//! 对应 crates/core/src/blocks.rs。

import { AppError } from "./errors";
import {
  asArray,
  asInt,
  asStr,
  field,
  isObject,
  oneOf,
  rejectUnknown,
  requiredField,
} from "./json";
import type { Attention, Block } from "./model";
import { minutesOf, parseDate, weekdayMonday } from "./time";

const BLOCK_KEYS = [
  "id",
  "title",
  "days",
  "start",
  "end",
  "attention",
  "notes",
] as const;

export function parseBlock(raw: unknown): Block {
  if (!isObject(raw)) throw new AppError("阻塞时段必须是对象");
  rejectUnknown(raw, [...BLOCK_KEYS], "阻塞时段");
  return {
    id: requiredField(raw, "id", "阻塞时段", asStr),
    title: requiredField(raw, "title", "阻塞时段", asStr),
    days: asArray(
      requiredField(raw, "days", "阻塞时段", (v) => v),
      "days",
    ).map((d) => asInt(d, "阻塞时段星期")),
    start: requiredField(raw, "start", "阻塞时段", asStr),
    end: requiredField(raw, "end", "阻塞时段", asStr),
    attention: field(
      raw,
      "attention",
      "阻塞时段",
      (v) => oneOf(v, "attention", ["required", "light"]),
      "required",
    ) as Attention,
    notes: field(raw, "notes", "阻塞时段", asStr, ""),
  };
}

export function serializeBlock(b: Block): Record<string, unknown> {
  return {
    id: b.id,
    title: b.title,
    days: b.days,
    start: b.start,
    end: b.end,
    attention: b.attention,
    notes: b.notes,
  };
}

/** 该日期午夜起算的 `[start, end)` 分钟窗口；跨午夜时 end 超过 1440；该星期无此占用返回 null。 */
export function band(
  block: Block,
  date: string,
): { start: number; end: number } | null {
  const parsed = parseDate(date);
  if (parsed === null) return null;
  if (!block.days.includes(weekdayMonday(parsed))) return null;
  const start = minutesOf(block.start);
  const end = minutesOf(block.end);
  if (start === null || end === null) return null;
  return { start, end: end <= start ? end + 1440 : end };
}

/** 与同日 `[start, end)` 窗口重叠的分钟数。 */
export function overlapMinutes(
  block: Block,
  date: string,
  start: number,
  end: number,
): number {
  const b = band(block, date);
  if (b === null) return 0;
  return Math.min(end, b.end) - Math.max(start, b.start) > 0
    ? Math.min(end, b.end) - Math.max(start, b.start)
    : 0;
}

export function validateBlock(block: Block): void {
  if (block.id.length === 0) {
    throw new AppError("阻塞时段 ID 不能为空");
  }
  if (block.title.trim().length === 0 || Array.from(block.title).length > 40) {
    throw new AppError("阻塞时段名称需为 1–40 个字符");
  }
  if (minutesOf(block.start) === null || minutesOf(block.end) === null) {
    throw new AppError("阻塞时段需为有效的 HH:MM 时间");
  }
  if (block.start === block.end) {
    throw new AppError("阻塞时段的开始与结束不能相同");
  }
  const unique = new Set(block.days);
  if (
    block.days.length === 0 ||
    block.days.length > 7 ||
    unique.size !== block.days.length ||
    block.days.some((d) => d < 1 || d > 7)
  ) {
    throw new AppError("请选择不重复的星期（周一为 1，周日为 7）");
  }
  if (Array.from(block.notes).length > 2000) {
    throw new AppError("阻塞时段备注过长");
  }
}

export function validateBlocks(blocks: Block[]): void {
  if (blocks.length > 60) {
    throw new AppError("课表阻塞时段最多 60 项");
  }
  const ids = new Set<string>();
  for (const block of blocks) {
    validateBlock(block);
    if (ids.has(block.id)) {
      throw new AppError("阻塞时段 ID 重复");
    }
    ids.add(block.id);
  }
}

/** 覆盖 `date` 的时段，按开始时间、再按标题排序。 */
export function blocksOnDate(blocks: Block[], date: string): Block[] {
  if (parseDate(date) === null) return [];
  return blocks
    .filter((b) => band(b, date) !== null)
    .slice()
    .sort((a, b) =>
      a.start < b.start
        ? -1
        : a.start > b.start
          ? 1
          : a.title < b.title
            ? -1
            : a.title > b.title
              ? 1
              : 0,
    );
}

/** `date` 当天需专心时段占用的分钟数（占用证据，重叠会重复计数）。 */
export function requiredMinutes(blocks: Block[], date: string): number {
  if (parseDate(date) === null) return 0;
  let total = 0;
  for (const b of blocks) {
    if (b.attention !== "required") continue;
    const bandValue = band(b, date);
    if (bandValue !== null) total += bandValue.end - bandValue.start;
  }
  return total;
}
