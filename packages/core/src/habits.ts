//! 习惯组：只带管辖；形状与印刷规则由 templates 管理。
//! 对应 crates/core/src/habits.rs。

import { AppError, ensure } from "./errors";
import { asStr, isObject, rejectUnknown, requiredField } from "./json";
import type { Habit } from "./model";

const HABIT_KEYS = ["id", "name"] as const;

export function parseHabit(raw: unknown): Habit {
  if (!isObject(raw)) throw new AppError("习惯组必须是对象");
  rejectUnknown(raw, [...HABIT_KEYS], "习惯组");
  return {
    id: requiredField(raw, "id", "习惯组", asStr),
    name: requiredField(raw, "name", "习惯组", asStr),
  };
}

export function serializeHabit(h: Habit): Record<string, unknown> {
  return { id: h.id, name: h.name };
}

export function validateHabit(habit: Habit): void {
  if (habit.name.trim().length === 0 || Array.from(habit.name).length > 40) {
    throw new AppError("习惯名称需为 1–40 个字符");
  }
}
