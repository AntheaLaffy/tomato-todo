// runtime 的磁盘布局：plan.json（计划 v6 + 运行进度）+ state.json（计时/设置/
// 会话/身份/愿景/锁机/教学）。
//
// 为什么拆两个文件：API.md 与 MIGRATION.md 沿用旧版约定——plan.json 是域数据
// 唯一来源，便于导出/查看；state.json 是每秒可能变动的运行时状态。@tomato/core
// 只认一个 AppData，所以把「怎么落盘」收在这里：读的时候合并，写的时候拆分并
// 各自原子替换。core 侧只通过 Engine.fromData(data, save) 接触本模块。
//
// 兼容：plan.json 可能是旧应用导出的纯计划文件（tasks 缺少 completed 等运行
// 字段、带 `repeat`），这里补齐默认值；纯计划里没有完成进度，历史只存在于
// state.json/备份里，加载不会凭空造出完成记录。

import {
  existsSync,
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import * as core from "../vendor/core.mjs";

export const PLAN_FILE = "plan.json";
export const STATE_FILE = "state.json";

/** 原子写：同目录临时文件 → fsync → rename。 */
export function atomicWrite(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
  const fd = openSync(tmp, "w");
  try {
    writeFileSync(fd, text);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, file);
}

function atomicWriteJson(file, value) {
  atomicWrite(file, JSON.stringify(value, null, 2));
}

function isObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new core.AppError(
      `${file.split("/").pop()} 读取失败，原文件已保留：${String(
        error?.message ?? error,
      )}`,
    );
  }
}

function localDateToTs(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }
  const [y, m, d] = date.split("-").map(Number);
  return Math.floor(new Date(y, m - 1, d).getTime() / 1000);
}

/**
 * plan.json 里的 task 是「计划 v6 实例 + 运行进度」的超集：
 * - 旧导出文件带 `repeat`（计划字段，实例不拥有重复规则）；
 * - 缺少 completed/completedAt/createdAt/reminder* 时补默认值。
 */
export function normalizePlanTask(raw, now) {
  if (!isObject(raw)) throw new core.AppError("计划任务必须是对象");
  const task = { ...raw };
  delete task.repeat;
  task.notes = typeof task.notes === "string" ? task.notes : "";
  task.scrapMinutes = Number.isInteger(task.scrapMinutes)
    ? task.scrapMinutes
    : 0;
  task.priority = Number.isInteger(task.priority) ? task.priority : 0;
  task.estimate = Number.isInteger(task.estimate) ? task.estimate : 1;
  task.reminderTime = task.reminderTime ?? null;
  task.focusMinutes = task.focusMinutes ?? null;
  task.habitId = task.habitId ?? null;
  task.projectId = task.projectId ?? null;
  task.templateId = task.templateId ?? null;
  task.recurring = task.recurring === true;
  task.tags = Array.isArray(task.tags) ? task.tags : [];
  task.subtasks = Array.isArray(task.subtasks)
    ? task.subtasks.map((s) => {
        if (!isObject(s)) throw new core.AppError("子任务必须是对象");
        return { id: s.id, title: s.title, done: s.done === true };
      })
    : [];
  const createdAt =
    Number.isInteger(task.createdAt) && task.createdAt >= 0
      ? task.createdAt
      : (localDateToTs(task.dueDate) ?? now);
  task.createdAt = createdAt;
  task.completed = task.completed === true;
  task.completedAt =
    task.completed && Number.isInteger(task.completedAt)
      ? task.completedAt
      : null;
  // 完成状态与日期必须一致：旧文件只写 completed:true 时用创建时间兜底。
  if (task.completed && task.completedAt === null) {
    task.completedAt = createdAt;
  }
  task.reminderFired = task.reminderFired === true;
  task.reminderPending = task.reminderPending === true;
  task.reminderExpired = task.reminderExpired === true;
  return task;
}

function emptyData() {
  return new core.AppData();
}

/**
 * 读取数据目录，返回合并后的 AppData。两个文件都不存在时给默认数据；
 * 任一文件损坏都抛错（调用方不得覆盖原文件）。
 */
export function readDataFiles(dataDir, now = Math.floor(Date.now() / 1000)) {
  const planFile = join(dataDir, PLAN_FILE);
  const stateFile = join(dataDir, STATE_FILE);
  const hasPlan = existsSync(planFile);
  const hasState = existsSync(stateFile);
  if (!hasPlan && !hasState) {
    return { data: emptyData(), sources: { plan: false, state: false } };
  }

  let state = {};
  if (hasState) {
    state = readJson(stateFile);
    if (!isObject(state)) {
      throw new core.AppError("state.json 必须是对象");
    }
  }
  // 兼容「state.json 存整份 AppData」的旧/实验形态。
  if (isObject(state) && state.version === 4 && Array.isArray(state.tasks)) {
    return {
      data: core.parseAppData(state),
      sources: { plan: hasPlan, state: true },
    };
  }

  let plan = {};
  if (hasPlan) {
    plan = readJson(planFile);
    if (!isObject(plan)) throw new core.AppError("plan.json 必须是对象");
  }

  const settings = isObject(state.settings)
    ? core.parseSettings(state.settings)
    : core.defaultSettings();
  if (!isObject(state.settings) && Number.isInteger(plan.pomodoroMinutes)) {
    // 只有旧计划文件时，用导出的 pomodoroMinutes 作为本机单次时长种子。
    const minutes = plan.pomodoroMinutes;
    if (minutes >= 1 && minutes <= 180) {
      settings.focusMinutes = minutes;
    }
  }

  return {
    data: new core.AppData({
      education: isObject(state.education)
        ? core.parseEducation(state.education)
        : new core.Education(),
      version: 4,
      identities: Array.isArray(state.identities)
        ? state.identities.map(core.parseIdentity)
        : [],
      tasks: Array.isArray(plan.tasks)
        ? plan.tasks.map((t) => core.parseTask(normalizePlanTask(t, now)))
        : [],
      blocks: Array.isArray(plan.blocks)
        ? plan.blocks.map(core.parseBlock)
        : [],
      templates: Array.isArray(plan.templates)
        ? plan.templates.map(core.parseTemplate)
        : [],
      prints: Array.isArray(plan.prints)
        ? plan.prints.map(core.parsePrintRecord)
        : [],
      projects: Array.isArray(plan.projects)
        ? plan.projects.map(core.parseProject)
        : [],
      habits: Array.isArray(plan.habits)
        ? plan.habits.map(core.parseHabit)
        : [],
      visions: Array.isArray(state.visions)
        ? state.visions.map(core.parseVision)
        : [],
      settings,
      timer: isObject(state.timer)
        ? core.parseTimer(state.timer)
        : core.defaultTimer(),
      sessions: Array.isArray(state.sessions)
        ? state.sessions.map(core.parseSession)
        : [],
      lock: isObject(state.lock)
        ? core.parseLockState(state.lock)
        : { schedules: [], active: null, suppressedUntil: 0 },
    }),
    sources: { plan: hasPlan, state: hasState },
  };
}

/** plan.json 内容：计划 v6，tasks 额外携带运行进度字段。 */
export function splitPlan(data) {
  return {
    format: "tomato-todo-plan",
    version: 6,
    pomodoroMinutes: data.settings.focusMinutes,
    projects: data.projects.map(core.serializeProject),
    tasks: data.tasks.map(core.serializeTask),
    blocks: data.blocks.map(core.serializeBlock),
    templates: data.templates.map(core.serializeTemplate),
    prints: data.prints.map(core.serializePrintRecord),
    habits: data.habits.map(core.serializeHabit),
  };
}

/** state.json 内容：只放每秒可能变动的运行时状态。 */
export function splitState(data) {
  return {
    settings: core.serializeSettings(data.settings),
    timer: core.serializeTimer(data.timer),
    sessions: data.sessions.map(core.serializeSession),
    identities: data.identities.map(core.serializeIdentity),
    visions: data.visions.map(core.serializeVision),
    lock: core.serializeLockState(data.lock),
    education: core.serializeEducation(data.education),
  };
}

/**
 * 写回数据目录：两个文件各自原子替换。先把两份内容都算好再落盘，序列化阶段
 * 失败不会留下半个文件；两个 rename 之间崩溃最多让两文件短暂不同步，读取时
 * 以 state.json 为准（进度在 plan.json，重启后会重新校验）。
 */
export function writeDataFiles(dataDir, data) {
  // plan.json 给人看（导出/排查），state.json 只给 runtime 读：后者不缩进以省
  // 磁盘与序列化时间（导入教学记录后 state 可达数 MB，每秒可能写）。
  const planText = JSON.stringify(splitPlan(data), null, 2);
  const stateText = JSON.stringify(splitState(data));
  mkdirSync(dataDir, { recursive: true });
  atomicWrite(join(dataDir, PLAN_FILE), planText);
  atomicWrite(join(dataDir, STATE_FILE), stateText);
}
