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
  return rest === 0
    ? t("common.hours", { n: h })
    : `${t("common.hours", { n: h })} ${t("common.minutes", { n: rest })}`;
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
  // 运行中优先用 deadline 本地插值：store 心跳每秒 emit，界面数字不依赖网络轮询。
  const remainingFromDeadline =
    timer.running && typeof timer.deadline === "number"
      ? Math.max(0, Math.round(timer.deadline - Date.now() / 1000))
      : null;
  const remaining =
    remainingFromDeadline !== null
      ? remainingFromDeadline
      : typeof state?.remainingSecs === "number"
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

/**
 * 今日计划任务：到期日就是今天、未完成。
 * 「今日专注」只认这一组——逾期任务是另一件事，放在全部任务的逾期视图里，
 * 绝不混进今天的时间线（否则今天会被历史债务压满）。
 */
export function todayTasks(data, today) {
  const tasks = (data && data.tasks) || [];
  return tasks.filter((task) => !task.completed && task.dueDate === today);
}

/** 逾期任务：到期日早于今天、未完成。 */
export function overdueTasks(data, today) {
  const tasks = (data && data.tasks) || [];
  return tasks.filter(
    (task) =>
      !task.completed &&
      task.dueDate !== null &&
      task.dueDate !== undefined &&
      task.dueDate < today,
  );
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

/**
 * 保护状态：是否锁定/白名单保护中。
 * Protection 形状以 @tomato/core 为准：{mode:'off'|'lock'|'whitelist', whitelist, strict}。
 * 项目专属白名单（Project.appWhitelist 非 null）替代通用白名单，与 core 的
 * AppData.effectiveWhitelist() 语义一致。
 */
export function protectionView(state) {
  const data = (state && state.data) || {};
  const settings = data.settings || {};
  const protection = settings.protection || { mode: "off", whitelist: [], strict: false };
  const timer = timerView(state);
  const guard = (state && state.guard) || { available: false };
  const focusing = timer.running && timer.mode === "focus";
  const active = focusing && protection.mode !== "off";
  const task = taskById(data, timer.taskId);
  const project = task && task.projectId ? projectById(data, task.projectId) : null;
  const projectList = project && Array.isArray(project.appWhitelist) ? project.appWhitelist : null;
  return {
    mode: protection.mode || "off",
    strict: !!protection.strict,
    active,
    locked: !!guard.locked,
    whitelist: Array.isArray(protection.whitelist) ? protection.whitelist : [],
    effectiveWhitelist:
      active && protection.mode === "whitelist"
        ? projectList !== null
          ? projectList
          : Array.isArray(protection.whitelist)
            ? protection.whitelist
            : []
        : [],
    guard,
    focusing,
  };
}

// ---------------------------------------------------------------- 待补队列

/**
 * 计划块时长（分钟）：与 @tomato/core reminders.windowMinutes 语义一致。
 * 客户端只用于显示「待补窗口」，写入与作废判定仍以 core 为唯一权威。
 */
export function windowMinutes(task, settings) {
  const focus = task && task.focusMinutes != null ? task.focusMinutes : (settings && settings.focusMinutes) || 45;
  const sessions = Math.max(1, Number(task && task.estimate) || 1);
  const every = Math.max(1, Number(settings && settings.longBreakEvery) || 4);
  const shortBreak = Number(settings && settings.shortBreakMinutes) || 5;
  const longBreak = Number(settings && settings.longBreakMinutes) || 15;
  let breaks = 0;
  for (let i = 1; i < sessions; i += 1) breaks += i % every === 0 ? longBreak : shortBreak;
  return sessions * focus + breaks;
}

/**
 * 待补判定：普通任务、未完成、未作废、到期=今天，且现在已过
 * `提醒时刻 + 计划块时长`、仍在 `+ scrapMinutes` 重修窗口内。
 * （作废/过期由 core 的 reminderExpired 标记，这里只做展示筛选。）
 */
export function isCatchUp(input, task, today) {
  // 页面既可能传 data 也可能传整个 state；taskKinds 在 state 顶层。
  const data = input && input.data ? input.data : input;
  const taskKinds = (input && input.data ? input.taskKinds : input && input.taskKinds) || {};
  if (!data || !task) return false;
  const nowKey = dayKey(Date.now() / 1000);
  if (nowKey !== today) return false;
  if (task.completed || task.reminderExpired) return false;
  if (task.dueDate !== today || task.reminderTime === null) return false;
  const kind = taskKinds[task.id];
  if (kind === "habit" || task.habitId !== null || task.recurring) return false;
  const start = parseHHMM(task.reminderTime);
  if (start === null) return false;
  if (task.scrapMinutes <= 0) return false;
  const elapsed = new Date();
  const nowSecs = elapsed.getHours() * 3600 + elapsed.getMinutes() * 60 + elapsed.getSeconds();
  const end = start + windowMinutes(task, data.settings) * 60;
  return nowSecs > end && nowSecs < end + task.scrapMinutes * 60;
}

/** 当前处于待补窗口的任务（按提醒时刻升序）。 */
export function catchUpTasks(input, today) {
  const data = input && input.data ? input.data : input;
  const tasks = (data && data.tasks) || [];
  return tasks
    .filter((task) => isCatchUp(input, task, today))
    .sort((a, b) => String(a.reminderTime).localeCompare(String(b.reminderTime)));
}

/** 今天完成的任务（completedAt 落在今天；旧数据无 completedAt 时回退到期日）。 */
export function completedOn(data, today) {
  const tasks = (data && data.tasks) || [];
  return tasks.filter((task) => {
    if (!task.completed) return false;
    if (task.completedAt != null) return dayKey(task.completedAt) === today;
    return task.dueDate === today;
  });
}

/** 任务已完成的番茄轮数（source==='timer' 且完成的 session）。 */
export function taskRounds(data, taskId) {
  const sessions = (data && data.sessions) || [];
  if (!taskId) return 0;
  return sessions.filter(
    (session) => session.source === "timer" && session.completed && session.taskId === taskId,
  ).length;
}

/** 日期的人读标签：今天/昨天/明天，其余「M 月 D 日」。 */
export function dayLabel(date, today) {
  if (!date) return "";
  if (date === today) return t("common.today");
  if (today && date === addDays(today, -1)) return t("common.yesterday");
  if (today && date === addDays(today, 1)) return t("common.tomorrow");
  const parts = date.split("-").map(Number);
  if (parts.length !== 3) return date;
  return t("common.monthDay", { m: parts[1], d: parts[2] });
}
