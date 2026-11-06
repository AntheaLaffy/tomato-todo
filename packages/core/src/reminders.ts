//! 时间安排：日期/时间与单次时长校验、当天待处理队列、计时/锁机延后、跨日清理。
//! 对应 crates/core/src/reminders.rs。

import { AppError } from "./errors";
import { id } from "./ids";
import type { AppData } from "./lib";
import type { Settings, Task, Timer } from "./model";
import { isHabit } from "./model";
import { dateAt, minutesOf, secondsOfDay, validDate } from "./time";

/** 任务日期必填、提醒需要有效 HH:MM、单次时长 1–180。 */
export function validateReminderTask(task: Task): void {
  if (task.dueDate === null || !validDate(task.dueDate)) {
    throw new AppError("任务必须指定有效的计划日期");
  }
  if (task.focusMinutes !== null && (task.focusMinutes < 1 || task.focusMinutes > 180)) {
    throw new AppError("单次专注时长需为1—180分钟");
  }
  if (task.reminderTime !== null) {
    if (task.dueDate === null || minutesOf(task.reminderTime) === null) {
      throw new AppError("提醒需要计划日期和有效的 HH:MM 时间");
    }
  }
}

/**
 * 计划块总长：全部专注段加段间休息，多番茄任务跨休息间隙仍有效。
 * 对应 reminders::window_minutes。
 */
export function windowMinutes(task: Task, settings: Settings): number {
  const focus = task.focusMinutes ?? settings.focusMinutes;
  const sessions = Math.max(1, task.estimate);
  const every = Math.max(1, settings.longBreakEvery);
  let breaks = 0;
  for (let i = 1; i < sessions; i += 1) {
    breaks += i % every === 0 ? settings.longBreakMinutes : settings.shortBreakMinutes;
  }
  return sessions * focus + breaks;
}

/** 空闲：未运行、未开始、剩余满额、无锁机。 */
export function reminderIdle(data: AppData): boolean {
  return (
    !data.timer.running &&
    data.timer.startedAt === null &&
    data.timer.remainingSecs === data.timer.durationSecs &&
    data.lock.active === null
  );
}

/** 当天待处理提醒（按 日期、时间、ID 排序取最早）。 */
export function pendingReminder(data: AppData): Task | null {
  if (!reminderIdle(data)) return null;
  let best: Task | null = null;
  for (const t of data.tasks) {
    if (t.completed || !t.reminderPending) continue;
    if (
      best === null ||
      `${t.dueDate}|${t.reminderTime}|${t.id}` < `${best.dueDate}|${best.reminderTime}|${best.id}`
    ) {
      best = t;
    }
  }
  return best;
}

/** 自动开工候选：提醒待处理且仍有剩余轮次。 */
export function dueAutoTask(data: AppData): Task | null {
  let best: Task | null = null;
  for (const t of data.tasks) {
    if (!t.reminderPending || !taskHasRoundsLeft(data, t)) continue;
    if (
      best === null ||
      `${t.dueDate}|${t.reminderTime}|${t.id}` < `${best.dueDate}|${best.reminderTime}|${best.id}`
    ) {
      best = t;
    }
  }
  return best;
}

export function taskHasRoundsLeft(data: AppData, task: Task): boolean {
  if (task.completed || task.reminderExpired) return false;
  const completedRounds = data.sessions.filter(
    (s) => s.source === "timer" && s.completed && s.taskId === task.id,
  ).length;
  return completedRounds < task.estimate;
}

/** 定时开工：计时/暂停/锁机/考试中不抢占，超过任务时段不补开。 */
export function startDueTask(data: AppData, at: number): boolean {
  if (
    !data.settings.autoStartTasks ||
    !reminderIdle(data) ||
    data.education.assessments.some((a) => a.startedAt !== null && a.stoppedAt === null)
  ) {
    return false;
  }
  const task = dueAutoTask(data);
  if (task === null) return false;
  data.timer.taskId = task.id;
  resetTo(data, "focus");
  startTimer(data, at);
  return true;
}

/** 提醒状态推进：到期/作废/待处理，跨日清理。 */
export function tickReminders(data: AppData, at: number): boolean {
  const today = dateAt(at);
  const nowMinutes = Math.floor(secondsOfDay(at) / 60);
  const nowSeconds = secondsOfDay(at);
  const settings = data.settings;
  let changed = false;
  for (const t of data.tasks) {
    const isToday = t.dueDate === today;
    const past = t.dueDate !== null && t.dueDate < today;
    const start = t.reminderTime !== null ? minutesOf(t.reminderTime) : null;
    // 定时任务在其日期过去后、或计划块结束后作废；此后既不提醒也不顺延。
    const expired =
      !t.completed &&
      (start !== null
        ? (() => {
            // 普通任务在计划块结束后的静态重修窗口内仍可补做；习惯窗口为 0。
            const spentAt =
              start + windowMinutes(t, settings) + (isHabit(t) ? 0 : t.scrapMinutes);
            return past || (isToday && nowSeconds >= spentAt * 60);
          })()
        : false);
    if (expired && !t.reminderExpired) {
      t.reminderExpired = true;
      changed = true;
    }
    if ((t.completed || expired || !isToday) && t.reminderPending) {
      t.reminderPending = false;
      changed = true;
    }
    if (expired && !t.reminderFired) {
      t.reminderFired = true;
      changed = true;
    }
    if (
      !t.completed &&
      !t.reminderFired &&
      isToday &&
      !expired &&
      start !== null &&
      start <= nowMinutes
    ) {
      t.reminderFired = true;
      t.reminderPending = true;
      changed = true;
    }
  }
  return changed;
}

// lib.ts 复用的计时原语（对应 AppData 的私有方法）。

export function timerRemaining(timer: Timer, at: number): number {
  if (timer.running && timer.deadline !== null) {
    const remaining = timer.deadline - at;
    return Math.min(Math.max(remaining, 0), timer.durationSecs);
  }
  return timer.remainingSecs;
}

/** 结清当前计时为一条 Timer 专注记录；非专注或零用时不做任何事。 */
export function recordSession(data: AppData, at: number, completed: boolean): void {
  const elapsed = data.timer.durationSecs - timerRemaining(data.timer, at);
  if (data.timer.mode !== "focus" || elapsed === 0) return;
  const task = data.tasks.find((t) => t.id === data.timer.taskId);
  const project =
    task !== undefined && task.projectId !== null
      ? data.projects.find((p) => p.id === task.projectId)
      : undefined;
  data.sessions.push({
    id: id(),
    source: "timer",
    taskId: data.timer.taskId,
    taskTitle: task?.title ?? "自由专注",
    projectName: project?.name ?? "未分类",
    startedAt: data.timer.startedAt ?? at - elapsed,
    endedAt: at,
    durationSecs: elapsed,
    completed,
  });
}

export function resetTo(data: AppData, mode: "focus" | "shortBreak" | "longBreak"): void {
  data.timer.autoFocusBlocked = false;
  data.timer.mode = mode;
  data.timer.running = false;
  data.timer.durationSecs = durationOf(data, mode);
  data.timer.remainingSecs = data.timer.durationSecs;
  data.timer.deadline = null;
  data.timer.startedAt = null;
}

export function durationOf(data: AppData, mode: "focus" | "shortBreak" | "longBreak"): number {
  const minutes =
    mode === "focus"
      ? (data.tasks.find((t) => t.id === data.timer.taskId)?.focusMinutes ??
        data.settings.focusMinutes)
      : mode === "shortBreak"
        ? data.settings.shortBreakMinutes
        : data.settings.longBreakMinutes;
  return 60 * minutes;
}

export function startTimer(data: AppData, at: number): void {
  if (data.timer.mode === "focus") {
    if (
      data.timer.startedAt === null &&
      !data.timer.running &&
      data.timer.remainingSecs === data.timer.durationSecs
    ) {
      resetTo(data, "focus");
    }
    const task = data.tasks.find((t) => t.id === data.timer.taskId);
    if (task !== undefined) task.reminderPending = false;
  }
  if (!data.timer.running) {
    if (data.timer.startedAt === null) data.timer.startedAt = at;
    data.timer.deadline = at + data.timer.remainingSecs;
    data.timer.running = true;
  }
}
