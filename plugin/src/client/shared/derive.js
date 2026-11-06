// 派生与格式化：把快照翻成页面直接能用的视图数据。
//
// 约定：函数只读，不修改传入对象；日期一律 `YYYY-MM-DD` 字符串（本地时区），
// 时间戳 Unix 秒（与 @tomato/core 一致）。
import { t } from "./copy.js";

const pad = (n) => String(n).padStart(2, "0");

/** Unix 秒或 Date → 本地日期键。 */
export function dayKey(ts) {
  const d = ts instanceof Date ? ts : new Date((ts ?? Date.now() / 1000) * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(serverTime) {
  return typeof serverTime === "number" ? dayKey(serverTime) : dayKey(Date.now() / 1000);
}

/** `YYYY-MM-DD` 加减天数。 */
export function addDays(date, delta) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** 周一为一周第一天，返回 date 所在周的周一。 */
export function weekStart(date) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const offset = (dt.getDay() + 6) % 7;
  return addDays(date, -offset);
}

export function weekdayIndex(date) {
  const [y, m, d] = date.split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

/** 秒 → `44:59`；超过一小时给 `1:04:59`。 */
export function fmtClock(secs) {
  const s = Math.max(0, Math.round(Number(secs) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

/** 秒 → 分钟（四舍五入、最小 1 分钟段显示用）。 */
export function toMinutes(secs) {
  return Math.max(0, Math.round((Number(secs) || 0) / 60));
}

/** 分钟的人读形式：「3 小时 20 分」/「45 分钟」。 */
export function fmtMinutes(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m < 60) return t("common.minutes", { n: m });
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? t("common.hours", { n: h }) : `${t("common.hours", { n: h })} ${rest}m`;
}

export function fmtHHMM(secondsOfDay) {
  const s = Math.max(0, Math.round(Number(secondsOfDay) || 0));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}`;
}

/** `HH:MM` → 当天秒数。 */
export function parseHHMM(text) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(text ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 3600 + min * 60;
}

/** 按时段给问候语。 */
export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 5) return t("common.daypartNight");
  if (h < 11) return t("common.daypartMorning");
  if (h < 13) return t("common.daypartNoon");
  if (h < 18) return t("common.daypartAfternoon");
  if (h < 23) return t("common.daypartEvening");
  return t("common.daypartNight");
}

/** 当前计时器视图：状态、模式、剩余/总秒。 */
export function timerView(state) {
  const data = (state && state.data) || {};
  const timer = data.timer || {};
  const settings = data.settings || {};
  const totalSecs = Number(timer.durationSecs) > 0 ? timer.durationSecs : (settings.focusMinutes || 45) * 60;
  const remaining =
    typeof state?.remainingSecs === "number"
      ? state.remainingSecs
      : Math.max(0, Number(timer.remainingSecs) || totalSecs);
  const mode = timer.mode || "focus";
  const running = !!timer.running;
  return {
    timer,
    mode,
    running,
    paused: !running && Number(timer.remainingSecs) > 0 && timer.remainingSecs < totalSecs,
    remainingSecs: remaining,
    totalSecs,
    progress: totalSecs > 0 ? 1 - remaining / totalSecs : 0,
    cycle: Number(timer.cycle) || 1,
    taskId: timer.taskId ?? null,
  };
}

export function taskById(data, id) {
  if (!data || !Array.isArray(data.tasks) || id === null || id === undefined) return null;
  return data.tasks.find((task) => task.id === id) || null;
}

export function projectById(data, id) {
  if (!data || !Array.isArray(data.projects)) return null;
  return data.projects.find((p) => p.id === id) || null;
}

export function projectColor(data, projectId) {
  const project = projectById(data, projectId);
  return project && project.color ? project.color : "var(--tomato-ink-3)";
}

export function taskKind(state, taskId) {
  const map = (state && state.taskKinds) || {};
  return map[taskId] || "plain";
}

/** 任务是否到期日 ≤ 今天且未完成（今日待办 / 逾期）。 */
export function isDueByToday(task, today) {
  if (!task || task.completed) return false;
  const due = task.dueDate || null;
  return due !== null && due <= today;
}

export function isOverdue(task, today) {
  if (!task || task.completed) return false;
  return task.dueDate !== null && task.dueDate !== undefined && task.dueDate < today;
}

/** 今日待办：到期日 ≤ 今天、未完成；逾期排前面。 */
export function dueTasks(data, today) {
  const tasks = (data && data.tasks) || [];
  return tasks
    .filter((task) => isDueByToday(task, today))
    .sort((a, b) => {
      const oa = isOverdue(a, today) ? 0 : 1;
      const ob = isOverdue(b, today) ? 0 : 1;
      if (oa !== ob) return oa - ob;
      return String(a.dueDate).localeCompare(String(b.dueDate));
    });
}

/** 今日完成数（按完成时间落在今天判断，回退到 dueDate===today 且 completed）。 */
export function completedToday(data, today) {
  const tasks = (data && data.tasks) || [];
  return tasks.filter((task) => task.completed && task.dueDate === today).length;
}

export function habitMissedToday(data, today) {
  const habits = (data && data.habits) || [];
  let missed = 0;
  for (const habit of habits) {
    if (Array.isArray(habit.missedDates) && habit.missedDates.includes(today)) missed += 1;
  }
  return missed;
}

/** 近 n 天每日专注分钟数组（旧→新）。 */
export function recentDays(stats, n = 7, today) {
  const days = (stats && Array.isArray(stats.days) && stats.days) || [];
  const byDate = new Map(days.map((day) => [day.date, day]));
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const date = addDays(today, -i);
    const day = byDate.get(date);
    out.push({ date, minutes: toMinutes(day ? day.seconds : 0), pomodoros: day ? day.pomodoros || 0 : 0 });
  }
  return out;
}

/** 项目时间分布：从 sessions 聚合（分钟），降序。 */
export function projectTimeDistribution(data) {
  const sessions = (data && data.sessions) || [];
  const totals = new Map();
  for (const session of sessions) {
    const name = session.projectName || "—";
    totals.set(name, (totals.get(name) || 0) + (Number(session.durationSecs) || 0));
  }
  const projects = (data && data.projects) || [];
  const colorOf = new Map(projects.map((p) => [p.name, p.color]));
  return Array.from(totals.entries())
    .map(([name, secs]) => ({
      name,
      minutes: toMinutes(secs),
      color: colorOf.get(name) || "var(--tomato-accent)",
    }))
    .filter((row) => row.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
}

/** 专注足迹：最近 n 条 session，新→旧。 */
export function focusTrail(data, n = 12) {
  const sessions = (data && data.sessions) || [];
  return sessions
    .slice()
    .sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0))
    .slice(0, n);
}

/** 保护状态：是否锁定/白名单保护中。 */
export function protectionView(state) {
  const data = (state && state.data) || {};
  const settings = data.settings || {};
  const protection = settings.protection || { mode: "off", allowedApps: [] };
  const timer = timerView(state);
  const guard = (state && state.guard) || { available: false };
  const focusing = timer.running && timer.mode === "focus";
  const active = focusing && protection.mode !== "off";
  return {
    mode: protection.mode || "off",
    strict: !!protection.strict,
    active,
    locked: !!guard.locked,
    whitelist: protection.allowedApps || [],
    effectiveWhitelist:
      active && protection.mode === "whitelist" ? protection.allowedApps || [] : [],
    guard,
    focusing,
  };
}
