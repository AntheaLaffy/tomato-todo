//! 共享模型、计时状态机与校验入口。
//! 对应 crates/core/src/lib.rs（Engine 在 engine.ts，桌面 guard 原生保留）。

import { AppError, charCount, clone, ensure, utf8Len } from "./errors";
import { id } from "./ids";
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
import type {
  ActiveLock,
  Attention,
  Block,
  DetachTarget,
  DayStat,
  GuardMode,
  Habit,
  HabitSlot,
  Identity,
  LockSchedule,
  LockState,
  Mode,
  PlanFile,
  Printing,
  Project,
  Repeat,
  Session,
  SessionSource,
  Settings,
  Shape,
  Stats,
  Subtask,
  Task,
  TaskDraft,
  TaskKind,
  Template,
  Timer,
  Vision,
} from "./model";
import { isHabit, kindOf } from "./model";
import { validateLock, releaseLock, scheduledAt } from "./lock";
import { validateBlocks } from "./blocks";
import { validateHabit } from "./habits";
import { validateTemplates, taskIsVoid } from "./templates";
import {
  durationOf,
  dueAutoTask,
  pendingReminder,
  recordSession,
  reminderIdle,
  resetTo,
  startDueTask,
  startTimer,
  taskHasRoundsLeft,
  tickReminders,
  timerRemaining,
  windowMinutes,
} from "./reminders";
import { Education, parseEducation, serializeEducation } from "./education";
import {
  completeTeachingTask,
  materializeTeachingTasks,
  startTeachingTask,
  teachingTask,
  validateTeachingTasks,
} from "./teaching_tasks";
import {
  validateIdentities,
  parseIdentity,
  serializeIdentity,
} from "./identities";
import { exportPlan, mergePlan } from "./plan";
import {
  deleteTemplate,
  fromTask,
  materializeTemplates,
  printInstances,
  printTemplate,
  replaceAppData,
  saveTemplate,
  syncTemplate,
} from "./templates";
import { parseLockState, serializeLockState } from "./lock";
import { parseBlock, serializeBlock } from "./blocks";
import { parseHabit, serializeHabit } from "./habits";
import { addDays, dateAt, validDate } from "./time";

// ---------- 基础类型解析/序列化 ----------

export function parseProject(raw: unknown): Project {
  if (!isObject(raw)) throw new AppError("项目必须是对象");
  return {
    id: requiredField(raw, "id", "项目", asStr),
    name: requiredField(raw, "name", "项目", asStr),
    color: requiredField(raw, "color", "项目", asStr),
    appWhitelist: field(
      raw,
      "appWhitelist",
      "项目",
      (v) =>
        asOpt(v, "appWhitelist", (x) =>
          asArray(x, "appWhitelist").map((a) => asStr(a, "应用 ID")),
        ),
      null,
    ) as string[] | null,
  };
}

export function serializeProject(p: Project): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: p.id,
    name: p.name,
    color: p.color,
  };
  if (p.appWhitelist !== null) out["appWhitelist"] = p.appWhitelist;
  return out;
}

export function parseVision(raw: unknown): Vision {
  if (!isObject(raw)) throw new AppError("愿景必须是对象");
  rejectUnknown(raw, ["id", "name", "notes", "projectId"], "愿景");
  return {
    id: requiredField(raw, "id", "愿景", asStr),
    name: requiredField(raw, "name", "愿景", asStr),
    notes: field(raw, "notes", "愿景", asStr, ""),
    projectId: field(
      raw,
      "projectId",
      "愿景",
      (v) => asOpt(v, "projectId", asStr),
      null,
    ) as string | null,
  };
}

export function serializeVision(v: Vision): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: v.id,
    name: v.name,
    notes: v.notes,
  };
  if (v.projectId !== null) out["projectId"] = v.projectId;
  return out;
}

export function parseSubtask(raw: unknown): Subtask {
  if (!isObject(raw)) throw new AppError("子任务必须是对象");
  return {
    id: requiredField(raw, "id", "子任务", asStr),
    title: requiredField(raw, "title", "子任务", asStr),
    done: requiredField(raw, "done", "子任务", asBool),
  };
}

export function serializeSubtask(s: Subtask): Record<string, unknown> {
  return { id: s.id, title: s.title, done: s.done };
}

const TASK_KEYS = [
  "id",
  "templateId",
  "recurring",
  "title",
  "notes",
  "projectId",
  "habitId",
  "dueDate",
  "reminderTime",
  "focusMinutes",
  "scrapMinutes",
  "priority",
  "estimate",
  "reminderFired",
  "reminderPending",
  "reminderExpired",
  "completed",
  "completedAt",
  "createdAt",
  "tags",
  "subtasks",
] as const;

export function parseTask(raw: unknown): Task {
  if (!isObject(raw)) throw new AppError("任务必须是对象");
  rejectUnknown(raw, [...TASK_KEYS], "任务");
  return {
    id: requiredField(raw, "id", "任务", asStr),
    templateId: field(
      raw,
      "templateId",
      "任务",
      (v) => asOpt(v, "templateId", asStr),
      null,
    ) as string | null,
    recurring: field(raw, "recurring", "任务", asBool, false),
    title: requiredField(raw, "title", "任务", asStr),
    notes: requiredField(raw, "notes", "任务", asStr),
    projectId: field(
      raw,
      "projectId",
      "任务",
      (v) => asOpt(v, "projectId", asStr),
      null,
    ) as string | null,
    habitId: field(
      raw,
      "habitId",
      "任务",
      (v) => asOpt(v, "habitId", asStr),
      null,
    ) as string | null,
    dueDate: field(
      raw,
      "dueDate",
      "任务",
      (v) => asOpt(v, "dueDate", asStr),
      null,
    ) as string | null,
    reminderTime: field(
      raw,
      "reminderTime",
      "任务",
      (v) => asOpt(v, "reminderTime", asStr),
      null,
    ) as string | null,
    focusMinutes: field(
      raw,
      "focusMinutes",
      "任务",
      (v) => asOpt(v, "focusMinutes", (x) => asInt(x, "focusMinutes")),
      null,
    ) as number | null,
    scrapMinutes: field(raw, "scrapMinutes", "任务", asInt, 0),
    priority: requiredField(raw, "priority", "任务", asInt),
    estimate: requiredField(raw, "estimate", "任务", asInt),
    reminderFired: field(raw, "reminderFired", "任务", asBool, false),
    reminderPending: field(raw, "reminderPending", "任务", asBool, false),
    reminderExpired: field(raw, "reminderExpired", "任务", asBool, false),
    completed: requiredField(raw, "completed", "任务", asBool),
    completedAt: field(
      raw,
      "completedAt",
      "任务",
      (v) => asOpt(v, "completedAt", asInt),
      null,
    ) as number | null,
    createdAt: requiredField(raw, "createdAt", "任务", asInt),
    tags: field(
      raw,
      "tags",
      "任务",
      (v) => asArray(v, "tags").map((t) => asStr(t, "标签")),
      [],
    ),
    subtasks: field(
      raw,
      "subtasks",
      "任务",
      (v) => asArray(v, "subtasks").map(parseSubtask),
      [],
    ),
  };
}

/**
 * canonical 任务序列化：键序与 Rust `Task` 声明序一致。
 * 撤销恢复把该串存进 Identity.restoreTask，比较必须逐字节一致。
 */
export function serializeTask(t: Task): Record<string, unknown> {
  return {
    id: t.id,
    templateId: t.templateId,
    recurring: t.recurring,
    title: t.title,
    notes: t.notes,
    projectId: t.projectId,
    habitId: t.habitId,
    dueDate: t.dueDate,
    reminderTime: t.reminderTime,
    focusMinutes: t.focusMinutes,
    scrapMinutes: t.scrapMinutes,
    priority: t.priority,
    estimate: t.estimate,
    reminderFired: t.reminderFired,
    reminderPending: t.reminderPending,
    reminderExpired: t.reminderExpired,
    completed: t.completed,
    completedAt: t.completedAt,
    createdAt: t.createdAt,
    tags: t.tags,
    subtasks: t.subtasks.map(serializeSubtask),
  };
}

const TASK_DRAFT_KEYS = [
  "id",
  "title",
  "notes",
  "projectId",
  "dueDate",
  "reminderTime",
  "focusMinutes",
  "scrapMinutes",
  "priority",
  "estimate",
  "tags",
  "subtasks",
  "repeat",
] as const;

export function parseTaskDraft(raw: unknown): TaskDraft {
  if (!isObject(raw)) throw new AppError("任务草稿必须是对象");
  rejectUnknown(raw, [...TASK_DRAFT_KEYS], "任务草稿");
  return {
    id: field(raw, "id", "任务草稿", (v) => asOpt(v, "id", asStr), null) as
      string | null,
    title: requiredField(raw, "title", "任务草稿", asStr),
    notes: field(raw, "notes", "任务草稿", asStr, ""),
    projectId: field(
      raw,
      "projectId",
      "任务草稿",
      (v) => asOpt(v, "projectId", asStr),
      null,
    ) as string | null,
    dueDate: field(
      raw,
      "dueDate",
      "任务草稿",
      (v) => asOpt(v, "dueDate", asStr),
      null,
    ) as string | null,
    reminderTime: field(
      raw,
      "reminderTime",
      "任务草稿",
      (v) => asOpt(v, "reminderTime", asStr),
      null,
    ) as string | null,
    focusMinutes: field(
      raw,
      "focusMinutes",
      "任务草稿",
      (v) => asOpt(v, "focusMinutes", (x) => asInt(x, "focusMinutes")),
      null,
    ) as number | null,
    scrapMinutes: field(raw, "scrapMinutes", "任务草稿", asInt, 0),
    priority: field(raw, "priority", "任务草稿", asInt, 0),
    estimate: field(raw, "estimate", "任务草稿", asInt, 1),
    tags: field(
      raw,
      "tags",
      "任务草稿",
      (v) => asArray(v, "tags").map((t) => asStr(t, "标签")),
      [],
    ),
    subtasks: field(
      raw,
      "subtasks",
      "任务草稿",
      (v) => asArray(v, "subtasks").map(parseSubtask),
      [],
    ),
    repeat: field(
      raw,
      "repeat",
      "任务草稿",
      (v) => oneOf(v, "repeat", ["none", "daily", "weekdays", "weekly"]),
      "none",
    ) as Repeat,
  };
}

export function parseHabitSlot(raw: unknown): HabitSlot {
  if (!isObject(raw)) throw new AppError("习惯时段必须是对象");
  return {
    days: asArray(
      requiredField(raw, "days", "习惯时段", (v) => v),
      "days",
    ).map((d) => asInt(d, "习惯星期")),
    time: requiredField(raw, "time", "习惯时段", asStr),
  };
}

export function parseProtection(raw: unknown): {
  mode: GuardMode;
  whitelist: string[];
  strict: boolean;
} {
  if (!isObject(raw)) throw new AppError("保护设置必须是对象");
  return {
    mode: field(
      raw,
      "mode",
      "保护设置",
      (v) => oneOf(v, "保护 mode", ["off", "lock", "whitelist"]),
      "off",
    ) as GuardMode,
    whitelist: field(
      raw,
      "whitelist",
      "保护设置",
      (v) => asArray(v, "whitelist").map((a) => asStr(a, "应用 ID")),
      [],
    ),
    strict: field(raw, "strict", "保护设置", asBool, false),
  };
}

export function serializeProtection(p: {
  mode: GuardMode;
  whitelist: string[];
  strict: boolean;
}): Record<string, unknown> {
  return { mode: p.mode, whitelist: p.whitelist, strict: p.strict };
}

const SETTINGS_KEYS = [
  "focusMinutes",
  "shortBreakMinutes",
  "longBreakMinutes",
  "longBreakEvery",
  "dailyGoal",
  "autoBreak",
  "autoFocus",
  "autoStartTasks",
  "sound",
  "soundVolume",
  "notifications",
  "alwaysOnTop",
  "theme",
  "personaBackdrop",
  "protection",
] as const;

export function parseSettings(raw: unknown): Settings {
  if (!isObject(raw)) throw new AppError("设置必须是对象");
  return {
    focusMinutes: requiredField(raw, "focusMinutes", "设置", asInt),
    shortBreakMinutes: requiredField(raw, "shortBreakMinutes", "设置", asInt),
    longBreakMinutes: requiredField(raw, "longBreakMinutes", "设置", asInt),
    longBreakEvery: requiredField(raw, "longBreakEvery", "设置", asInt),
    dailyGoal: requiredField(raw, "dailyGoal", "设置", asInt),
    autoBreak: requiredField(raw, "autoBreak", "设置", asBool),
    autoFocus: requiredField(raw, "autoFocus", "设置", asBool),
    autoStartTasks: field(raw, "autoStartTasks", "设置", asBool, false),
    sound: requiredField(raw, "sound", "设置", asBool),
    soundVolume: field(raw, "soundVolume", "设置", asInt, 100),
    notifications: requiredField(raw, "notifications", "设置", asBool),
    alwaysOnTop: requiredField(raw, "alwaysOnTop", "设置", asBool),
    theme: requiredField(raw, "theme", "设置", asStr),
    personaBackdrop: field(raw, "personaBackdrop", "设置", asBool, false),
    protection: field(raw, "protection", "设置", parseProtection, {
      mode: "off",
      whitelist: [],
      strict: false,
    }),
  };
}

export function serializeSettings(s: Settings): Record<string, unknown> {
  return {
    focusMinutes: s.focusMinutes,
    shortBreakMinutes: s.shortBreakMinutes,
    longBreakMinutes: s.longBreakMinutes,
    longBreakEvery: s.longBreakEvery,
    dailyGoal: s.dailyGoal,
    autoBreak: s.autoBreak,
    autoFocus: s.autoFocus,
    autoStartTasks: s.autoStartTasks,
    sound: s.sound,
    soundVolume: s.soundVolume,
    notifications: s.notifications,
    alwaysOnTop: s.alwaysOnTop,
    theme: s.theme,
    personaBackdrop: s.personaBackdrop,
    protection: serializeProtection(s.protection),
  };
}

export function defaultSettings(): Settings {
  return {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakEvery: 4,
    dailyGoal: 8,
    autoBreak: false,
    autoFocus: false,
    autoStartTasks: false,
    sound: true,
    soundVolume: 100,
    notifications: true,
    alwaysOnTop: false,
    theme: "light",
    personaBackdrop: false,
    protection: { mode: "off", whitelist: [], strict: false },
  };
}

export function parseTimer(raw: unknown): Timer {
  if (!isObject(raw)) throw new AppError("计时器必须是对象");
  return {
    mode: oneOf(
      requiredField(raw, "mode", "计时器", (v) => v),
      "计时器 mode",
      ["focus", "shortBreak", "longBreak"],
    ) as Mode,
    running: requiredField(raw, "running", "计时器", asBool),
    taskId: field(
      raw,
      "taskId",
      "计时器",
      (v) => asOpt(v, "taskId", asStr),
      null,
    ) as string | null,
    durationSecs: requiredField(raw, "durationSecs", "计时器", asInt),
    remainingSecs: requiredField(raw, "remainingSecs", "计时器", asInt),
    deadline: field(
      raw,
      "deadline",
      "计时器",
      (v) => asOpt(v, "deadline", asInt),
      null,
    ) as number | null,
    startedAt: field(
      raw,
      "startedAt",
      "计时器",
      (v) => asOpt(v, "startedAt", asInt),
      null,
    ) as number | null,
    cycle: requiredField(raw, "cycle", "计时器", asInt),
    cycleDate: field(
      raw,
      "cycleDate",
      "计时器",
      (v) => asOpt(v, "cycleDate", asStr),
      null,
    ) as string | null,
    completionSerial: requiredField(raw, "completionSerial", "计时器", asInt),
    lastFinishedMode: field(
      raw,
      "lastFinishedMode",
      "计时器",
      (v) =>
        asOpt(v, "lastFinishedMode", (x) =>
          oneOf(x, "lastFinishedMode", ["focus", "shortBreak", "longBreak"]),
        ),
      null,
    ) as Mode | null,
    autoFocusBlocked: field(raw, "autoFocusBlocked", "计时器", asBool, false),
  };
}

export function serializeTimer(t: Timer): Record<string, unknown> {
  return {
    mode: t.mode,
    running: t.running,
    taskId: t.taskId,
    durationSecs: t.durationSecs,
    remainingSecs: t.remainingSecs,
    deadline: t.deadline,
    startedAt: t.startedAt,
    cycle: t.cycle,
    cycleDate: t.cycleDate,
    completionSerial: t.completionSerial,
    lastFinishedMode: t.lastFinishedMode,
    autoFocusBlocked: t.autoFocusBlocked,
  };
}

export function defaultTimer(): Timer {
  return {
    mode: "focus",
    running: false,
    taskId: null,
    durationSecs: 1500,
    remainingSecs: 1500,
    deadline: null,
    startedAt: null,
    cycle: 0,
    cycleDate: null,
    completionSerial: 0,
    lastFinishedMode: null,
    autoFocusBlocked: false,
  };
}

export function parseSession(raw: unknown): Session {
  if (!isObject(raw)) throw new AppError("专注记录必须是对象");
  return {
    id: requiredField(raw, "id", "专注记录", asStr),
    source: field(
      raw,
      "source",
      "专注记录",
      (v) => oneOf(v, "source", ["timer", "taskEstimate"]),
      "timer",
    ) as SessionSource,
    taskId: field(
      raw,
      "taskId",
      "专注记录",
      (v) => asOpt(v, "taskId", asStr),
      null,
    ) as string | null,
    taskTitle: requiredField(raw, "taskTitle", "专注记录", asStr),
    projectName: requiredField(raw, "projectName", "专注记录", asStr),
    startedAt: requiredField(raw, "startedAt", "专注记录", asInt),
    endedAt: requiredField(raw, "endedAt", "专注记录", asInt),
    durationSecs: requiredField(raw, "durationSecs", "专注记录", asInt),
    completed: requiredField(raw, "completed", "专注记录", asBool),
  };
}

export function serializeSession(s: Session): Record<string, unknown> {
  return {
    id: s.id,
    source: s.source,
    taskId: s.taskId,
    taskTitle: s.taskTitle,
    projectName: s.projectName,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    durationSecs: s.durationSecs,
    completed: s.completed,
  };
}

// ---------- AppData ----------

export class AppData {
  education: Education;
  version: number;
  identities: Identity[];
  tasks: Task[];
  blocks: Block[];
  templates: Template[];
  prints: { templateId: string; date: string | null }[];
  projects: Project[];
  habits: Habit[];
  visions: Vision[];
  settings: Settings;
  timer: Timer;
  sessions: Session[];
  lock: LockState;

  constructor(init?: Partial<Pick<AppData, keyof AppData>>) {
    this.education = init?.education ?? new Education();
    this.version = init?.version ?? 4;
    this.identities = init?.identities ?? [];
    this.tasks = init?.tasks ?? [];
    this.blocks = init?.blocks ?? [];
    this.templates = init?.templates ?? [];
    this.prints = init?.prints ?? [];
    this.projects = init?.projects ?? [
      { id: id(), name: "工作", color: "#df7561", appWhitelist: null },
      { id: id(), name: "学习", color: "#849b7d", appWhitelist: null },
      { id: id(), name: "生活", color: "#d5a553", appWhitelist: null },
    ];
    this.habits = init?.habits ?? [];
    this.visions = init?.visions ?? [];
    this.settings = init?.settings ?? defaultSettings();
    this.timer = init?.timer ?? defaultTimer();
    this.sessions = init?.sessions ?? [];
    this.lock = init?.lock ?? {
      schedules: [],
      active: null,
      suppressedUntil: 0,
    };
  }

  protected(): boolean {
    return (
      this.lock.active !== null ||
      (this.timer.running &&
        this.timer.mode === "focus" &&
        this.settings.protection.mode !== "off")
    );
  }

  /** 白名单专注时生效的应用清单：项目专属清单替代通用清单。 */
  effectiveWhitelist(): string[] {
    const project = (() => {
      const taskId = this.timer.taskId;
      if (taskId === null) return undefined;
      const task = this.tasks.find((t) => t.id === taskId);
      if (task === undefined || task.projectId === null) return undefined;
      return this.projects.find((p) => p.id === task.projectId);
    })();
    const list = project?.appWhitelist;
    return list !== null && list !== undefined
      ? [...list]
      : [...this.settings.protection.whitelist];
  }

  taskIsVoid(task: Task): boolean {
    return taskIsVoid(task);
  }

  strictProtected(): boolean {
    return (
      (this.lock.active !== null && this.lock.active.strict) ||
      (this.timer.running &&
        this.timer.mode === "focus" &&
        this.settings.protection.mode !== "off" &&
        this.settings.protection.strict)
    );
  }

  durationOf(mode: Mode): number {
    return durationOf(this, mode);
  }

  taskHasRoundsLeft(task: Task): boolean {
    return taskHasRoundsLeft(this, task);
  }

  resetTo(mode: Mode): void {
    resetTo(this, mode);
  }

  start(at: number): void {
    startTimer(this, at);
  }

  record(at: number, completed: boolean): void {
    recordSession(this, at, completed);
  }

  refreshCycle(at: number): boolean {
    const date = dateAt(at);
    if (this.timer.cycleDate === date) return false;
    this.timer.cycle = this.sessions.filter(
      (s) => s.completed && dateAt(s.endedAt) === date,
    ).length;
    this.timer.cycleDate = date;
    return true;
  }

  /** 停机后最多推进一个阶段：绝不伪造无人值守的专注会话。 */
  tick(at: number): boolean {
    const teachingChanged = this.education.tick(at);
    const teachingTasksChanged = materializeTeachingTasks(this, at);
    const materialized =
      materializeTemplates(this, at) || teachingChanged || teachingTasksChanged;
    const remindersChanged = tickReminders(this, at);
    const changed = this.tickWithLock(at) || materialized;
    const cycleChanged = this.refreshCycle(at);
    if (
      cycleChanged &&
      this.timer.cycle === 0 &&
      this.timer.mode !== "focus" &&
      !this.timer.running &&
      this.timer.startedAt === null &&
      this.timer.remainingSecs === this.timer.durationSecs
    ) {
      this.resetTo("focus");
    }
    return (
      startDueTask(this, at) || remindersChanged || changed || cycleChanged
    );
  }

  tickWithLock(at: number): boolean {
    const previous = JSON.stringify(serializeLockState(this.lock));
    if (this.lock.active !== null && at >= this.lock.active.endsAt) {
      this.lock.active = null;
    }
    const scheduled = scheduledAt(this.lock, at);
    if (scheduled !== null) {
      if (this.lock.active !== null) {
        scheduled.startedAt = Math.min(
          this.lock.active.startedAt,
          scheduled.startedAt,
        );
        scheduled.endsAt = Math.max(this.lock.active.endsAt, scheduled.endsAt);
        scheduled.strict = scheduled.strict || this.lock.active.strict;
      }
      this.lock.active = scheduled;
    }
    const changed = previous !== JSON.stringify(serializeLockState(this.lock));
    if (this.lock.active !== null) {
      const start = this.lock.active.startedAt;
      if (this.timer.running) {
        const stop = Math.min(
          Math.max(start, this.timer.startedAt ?? start),
          at,
        );
        this.tickTimer(stop);
        this.record(stop, false);
        this.resetTo("focus");
        return true;
      }
      return changed;
    }
    return this.tickTimer(at) || changed;
  }

  tickTimer(at: number): boolean {
    if (!this.timer.running || timerRemaining(this.timer, at) > 0) {
      return false;
    }
    const end = this.timer.deadline ?? at;
    this.finishTimer(end, at);
    return true;
  }

  finishTimer(end: number, at: number): void {
    const finished = this.timer.mode;
    const continuationBlocked = this.timer.autoFocusBlocked;
    if (finished === "focus") {
      this.refreshCycle(end);
    }
    this.record(end, true);
    if (finished === "focus") {
      this.timer.cycle = Math.min(this.timer.cycle + 1, 4294967295);
    }
    const next: Mode =
      finished === "focus"
        ? this.timer.cycle % this.settings.longBreakEvery === 0
          ? "longBreak"
          : "shortBreak"
        : "focus";
    this.resetTo(next);
    this.timer.completionSerial = Math.min(
      this.timer.completionSerial + 1,
      Number.MAX_SAFE_INTEGER,
    );
    this.timer.lastFinishedMode = finished;
    const auto =
      next === "focus"
        ? this.settings.autoFocus &&
          !continuationBlocked &&
          (this.timer.taskId === null ||
            (() => {
              const task = this.tasks.find((t) => t.id === this.timer.taskId);
              return task !== undefined && this.taskHasRoundsLeft(task);
            })()) &&
          !(this.settings.autoStartTasks && dueAutoTask(this) !== null)
        : this.settings.autoBreak;
    // 自动续接只属于活着的应用，不弥补关机/睡眠的时间。
    if (auto && at - end < 5) {
      this.start(at);
    }
  }

  /** 预检 + 执行 + 教学待办生成 + 全量校验。 */
  apply(action: Action, at: number): void {
    this.tick(at);
    if (this.strictProtected()) {
      throw new AppError("严格模式生效中，不能提前结束或修改；到时自动解除");
    }
    if (
      this.protected() &&
      action.type !== "emergencyUnlock" &&
      action.type !== "completeFocus"
    ) {
      throw new AppError(
        "专注保护中，结束前不能修改任务或计时；可提前完成番茄或紧急退出",
      );
    }
    switch (action.type) {
      case "education": {
        if (
          action.command.op === "startExam" &&
          (!this.reminderIdle() ||
            this.timer.mode !== "focus" ||
            this.timer.remainingSecs !== this.timer.durationSecs)
        ) {
          throw new AppError("请先结束当前计时或锁机，再开始考试");
        }
        this.education.apply(action.command, at);
        break;
      }
      case "printInstances":
        printInstances(this, action.shape, action.printing, at);
        break;
      case "saveTemplate": {
        const id = action.template.id;
        saveTemplate(this, action.template);
        this.validate();
        if (action.printDates.length > 0) {
          printTemplate(this, id, action.printDates, at);
        }
        break;
      }
      case "deleteTemplate":
        deleteTemplate(this, action.id);
        break;
      case "printTemplate":
        printTemplate(this, action.id, action.dates, at);
        break;
      case "syncTemplate":
        syncTemplate(this, action.id);
        break;
      case "startReminder": {
        if (!this.reminderIdle()) {
          throw new AppError("请先结束当前计时");
        }
        const t = this.tasks.find(
          (x) => x.id === action.id && !x.completed && x.reminderPending,
        );
        if (t === undefined) {
          throw new AppError("提醒已失效");
        }
        t.reminderPending = false;
        this.timer.taskId = action.id;
        this.resetTo("focus");
        startTeachingTask(this, at);
        this.start(at);
        break;
      }
      case "emergencyUnlock": {
        this.record(at, false);
        this.resetTo("focus");
        releaseLock(this.lock, at);
        break;
      }
      case "completeFocus": {
        if (
          this.lock.active !== null ||
          this.timer.mode !== "focus" ||
          this.timer.startedAt === null
        ) {
          throw new AppError("当前没有可提前完成的专注");
        }
        if (timerRemaining(this.timer, at) === this.timer.durationSecs) {
          throw new AppError("尚无专注用时，请稍后再完成");
        }
        this.finishTimer(at, at);
        break;
      }
      case "saveLockSchedule": {
        const index = this.lock.schedules.findIndex(
          (s) => s.id === action.schedule.id,
        );
        if (index >= 0) {
          this.lock.schedules[index] = action.schedule;
        } else {
          this.lock.schedules.push(action.schedule);
        }
        validateLock(this.lock);
        this.tick(at);
        break;
      }
      case "deleteLockSchedule":
        this.lock.schedules = this.lock.schedules.filter(
          (s) => s.id !== action.id,
        );
        break;
      case "startQuickLock": {
        if (action.minutes < 1 || action.minutes > 720) {
          throw new AppError("快速锁机时长需为 1–720 分钟");
        }
        this.record(at, false);
        this.resetTo("focus");
        this.lock.active = {
          name: "小憩",
          startedAt: at,
          endsAt: at + action.minutes * 60,
          strict: action.strict,
        };
        break;
      }
      case "saveTask": {
        const d = action.task;
        if (d.id !== null && teachingTask(this, d.id) !== undefined) {
          throw new AppError(
            "教学待办随课程或作业安排更新，请调整对应教学安排",
          );
        }
        const existingIndex =
          d.id !== null ? this.tasks.findIndex((t) => t.id === d.id) : -1;
        if (d.id !== null && existingIndex < 0) {
          throw new AppError("任务不存在，可能已经被删除");
        }
        const old = existingIndex >= 0 ? this.tasks[existingIndex]! : undefined;
        const task: Task = {
          templateId: old?.templateId ?? null,
          recurring: old?.recurring ?? false,
          id: d.id ?? id(),
          title: d.title.trim(),
          notes: d.notes,
          projectId: d.projectId,
          habitId: old?.habitId ?? null,
          reminderFired:
            old !== undefined &&
            old.dueDate === d.dueDate &&
            old.reminderTime === d.reminderTime &&
            old.reminderFired,
          reminderPending:
            old !== undefined &&
            old.dueDate === d.dueDate &&
            old.reminderTime === d.reminderTime &&
            old.reminderPending,
          reminderExpired:
            old !== undefined &&
            old.dueDate === d.dueDate &&
            old.reminderTime === d.reminderTime &&
            old.reminderExpired,
          scrapMinutes: d.scrapMinutes,
          focusMinutes: d.focusMinutes,
          reminderTime: d.reminderTime,
          dueDate: d.dueDate,
          priority: d.priority,
          estimate: d.estimate,
          completed: old?.completed ?? false,
          completedAt: old?.completedAt ?? null,
          createdAt: old?.createdAt ?? at,
          tags: d.tags.map((t) => t.trim()).filter((t) => t.length > 0),
          subtasks: d.subtasks.map((s) => ({
            id: s.id,
            title: s.title,
            done: s.done,
          })),
        };
        if (d.repeat !== "none") {
          const template = fromTask(task, d.repeat, at);
          task.templateId = template.id;
          task.recurring = true;
          this.prints.push({ templateId: template.id, date: task.dueDate });
          this.templates.push(template);
        }
        if (existingIndex >= 0) {
          this.tasks[existingIndex] = task;
        } else {
          this.tasks.push(task);
        }
        break;
      }
      case "toggleTask": {
        const taskId = action.id;
        if (this.tasks.some((t) => t.id === taskId && this.taskIsVoid(t))) {
          throw new AppError("作废实例不能完成");
        }
        const task = this.tasks.find((t) => t.id === taskId);
        ensure(task !== undefined, "任务不存在");
        const taskCopy: Task = {
          ...task,
          tags: [...task.tags],
          subtasks: task.subtasks.map((s) => ({ ...s })),
        };
        if (teachingTask(this, taskId) !== undefined && !taskCopy.completed) {
          completeTeachingTask(this, taskId, at);
        }
        // 结算对比前先结清本任务计时，避免重复累计。
        if (!taskCopy.completed && this.timer.taskId === taskId) {
          const focusing = this.timer.mode === "focus";
          if (focusing) {
            this.record(at, false);
          }
          this.timer.taskId = null;
          if (focusing) {
            this.resetTo("focus");
          } else {
            this.timer.autoFocusBlocked = true;
          }
        }
        this.sessions = this.sessions.filter(
          (s) => !(s.source === "taskEstimate" && s.taskId === taskId),
        );
        if (!taskCopy.completed) {
          const actual = this.sessions
            .filter((s) => s.taskId === taskId)
            .reduce((n, s) => n + s.durationSecs, 0);
          const expected =
            taskCopy.estimate *
            (taskCopy.focusMinutes ?? this.settings.focusMinutes) *
            60;
          const missing = Math.max(0, expected - actual);
          if (missing > 0) {
            const project =
              taskCopy.projectId !== null
                ? this.projects.find((p) => p.id === taskCopy.projectId)
                : undefined;
            this.sessions.push({
              id: id(),
              source: "taskEstimate",
              taskId,
              taskTitle: taskCopy.title,
              projectName: project?.name ?? "未分类",
              startedAt: at,
              endedAt: at,
              durationSecs: missing,
              completed: false,
            });
          }
        }
        const t = this.tasks.find((x) => x.id === taskId)!;
        t.completed = !t.completed;
        t.completedAt = t.completed ? at : null;
        if (t.completed) {
          this.education.taskCompleted(t, at);
        }
        break;
      }
      case "deleteTask": {
        if (teachingTask(this, action.id) !== undefined) {
          throw new AppError("教学待办由对应课程或作业维护，不能单独删除");
        }
        if (!this.tasks.some((t) => t.id === action.id)) {
          throw new AppError("任务不存在");
        }
        if (this.timer.taskId === action.id) {
          this.record(at, false);
          this.resetTo(this.timer.mode);
          this.timer.taskId = null;
        }
        this.tasks = this.tasks.filter((t) => t.id !== action.id);
        break;
      }
      case "restoreTask": {
        const task = action.task;
        if (this.tasks.some((t) => t.id === task.id)) {
          throw new AppError("任务已经存在");
        }
        if (
          task.projectId !== null &&
          !this.projects.some((p) => p.id === task.projectId)
        ) {
          task.projectId = null;
        }
        if (
          task.templateId !== null &&
          !this.templates.some((t) => t.id === task.templateId)
        ) {
          task.templateId = null;
        }
        if (
          task.habitId !== null &&
          !this.habits.some((h) => h.id === task.habitId)
        ) {
          // 失去容器只移除管辖；冻结来源仍在，历史分类不变。
          task.habitId = null;
        }
        this.tasks.push(task);
        break;
      }
      case "toggleSubtask": {
        const sub = this.tasks
          .find((t) => t.id === action.taskId)
          ?.subtasks.find((s) => s.id === action.subtaskId);
        ensure(sub !== undefined, "子任务不存在");
        sub.done = !sub.done;
        break;
      }
      case "saveProject": {
        if (action.id !== null) {
          const p = this.projects.find((x) => x.id === action.id);
          ensure(p !== undefined, "项目不存在");
          p.name = action.name.trim();
          p.color = action.color;
        } else {
          ensure(
            action.directory !== null && isAbsolutePath(action.directory),
            "新项目必须绑定资料目录；请在项目页选择目录并授权",
          );
          const projectId = id();
          this.education.projects.push({
            projectId,
            directory: action.directory,
            examMode: false,
            visionId: null,
            target: "",
            examDate: null,
            syllabusId: null,
            pastPaperIds: [],
            mockPaperIds: [],
          });
          this.projects.push({
            id: projectId,
            name: action.name.trim(),
            color: action.color,
            appWhitelist: null,
          });
        }
        break;
      }
      case "renameProjectDirectory": {
        const project = this.projects.find((x) => x.id === action.id);
        ensure(project !== undefined, "项目不存在");
        const profile = this.education.projects.find(
          (p) => p.projectId === action.id,
        );
        ensure(profile !== undefined, "项目没有绑定资料目录");
        ensure(isAbsolutePath(action.directory), "资料目录必须是绝对路径");
        project.name = action.name.trim();
        project.color = action.color;
        profile.directory = action.directory;
        break;
      }
      case "setProjectWhitelist": {
        const p = this.projects.find((x) => x.id === action.id);
        ensure(p !== undefined, "项目不存在");
        p.appWhitelist =
          action.whitelist === null ? null : [...action.whitelist];
        break;
      }
      case "deleteProject": {
        if (this.education.semesters.some((s) => s.projectId === action.id)) {
          throw new AppError(
            "项目已有教学历史，请保留记录并停用应试模式；资料目录不会被删除",
          );
        }
        this.education.projects = this.education.projects.filter(
          (p) => p.projectId !== action.id,
        );
        this.education.resources = this.education.resources.filter(
          (p) => p.projectId !== action.id,
        );
        this.projects = this.projects.filter((p) => p.id !== action.id);
        for (const task of this.tasks) {
          if (task.projectId === action.id) task.projectId = null;
        }
        for (const template of this.templates) {
          if (template.shape.projectId === action.id)
            template.shape.projectId = null;
        }
        this.visions = this.visions.filter((a) => a.projectId !== action.id);
        break;
      }
      case "reorderProjects": {
        if (
          action.ids.length !== this.projects.length ||
          !action.ids.every((pid) => this.projects.some((p) => p.id === pid))
        ) {
          throw new AppError("项目排序列表与现有项目不一致");
        }
        this.projects = action.ids.map((pid) =>
          this.projects.find((p) => p.id === pid)!,
        );
        break;
      }
      case "detachTasks": {
        if (
          action.ids.some((taskId) => teachingTask(this, taskId) !== undefined)
        ) {
          throw new AppError("教学待办须保留来源项目，请调整对应教学安排");
        }
        for (const t of this.tasks) {
          if (action.ids.includes(t.id)) {
            if (action.target === "project") t.projectId = null;
            else t.habitId = null;
          }
        }
        break;
      }
      case "saveHabitGroup": {
        if (action.id !== null) {
          const h = this.habits.find((x) => x.id === action.id);
          ensure(h !== undefined, "习惯组不存在");
          h.name = action.name.trim();
        } else {
          this.habits.push({ id: id(), name: action.name.trim() });
        }
        break;
      }
      case "saveHabit": {
        const hid = action.id ?? id();
        const existing = this.habits.find((h) => h.id === hid);
        if (existing !== undefined) {
          existing.name = action.name.trim();
        } else {
          this.habits.push({ id: hid, name: action.name.trim() });
        }
        saveTemplate(this, {
          id: `habit:${hid}`,
          automatic: true,
          printAheadDays: 0,
          printing: {
            kind: "weekly",
            slots: action.slots.map((s) => ({
              days: [...s.days],
              time: s.time,
            })),
          },
          shape: {
            title: action.name.trim(),
            notes: "",
            projectId: action.projectId,
            habitId: hid,
            focusMinutes: action.focusMinutes,
            scrapMinutes: 0,
            priority: 0,
            estimate: 1,
            tags: [],
            subtasks: [],
          },
        });
        break;
      }
      case "deleteHabit": {
        const tids = this.templates
          .filter((t) => t.shape.habitId === action.id)
          .map((t) => t.id);
        for (const tid of tids) {
          deleteTemplate(this, tid);
        }
        this.habits = this.habits.filter((h) => h.id !== action.id);
        // 既有实例保留冻结来源：移除分组只清引用，历史缺勤仍计入统计。
        for (const task of this.tasks) {
          if (task.habitId === action.id) task.habitId = null;
        }
        break;
      }
      case "saveVision": {
        if (action.id !== null) {
          const a = this.visions.find((x) => x.id === action.id);
          ensure(a !== undefined, "愿景不存在");
          a.name = action.name.trim();
          a.notes = action.notes;
          a.projectId = action.projectId;
        } else {
          this.visions.push({
            id: id(),
            name: action.name.trim(),
            notes: action.notes,
            projectId: action.projectId,
          });
        }
        break;
      }
      case "deleteVision":
        this.visions = this.visions.filter((a) => a.id !== action.id);
        break;
      case "saveBlock": {
        const block: Block = {
          id: action.id ?? id(),
          title: action.title.trim(),
          days: [...action.days],
          start: action.start,
          end: action.end,
          attention: action.attention,
          notes: action.notes,
        };
        // 先校验，坏编辑报自己的原因而不是笼统的全量失败。
        validateBlock(block);
        const index = this.blocks.findIndex((b) => b.id === block.id);
        if (index >= 0) {
          this.blocks[index] = block;
        } else {
          this.blocks.push(block);
        }
        break;
      }
      case "deleteBlock":
        this.blocks = this.blocks.filter((b) => b.id !== action.id);
        break;
      case "selectTask": {
        if (this.tasks.some((t) => t.id === action.id && this.taskIsVoid(t))) {
          throw new AppError("作废实例不能专注");
        }
        if (
          action.id !== null &&
          !this.tasks.some((t) => t.id === action.id && !t.completed)
        ) {
          throw new AppError("请选择一个未完成的任务");
        }
        if (
          this.timer.running ||
          timerRemaining(this.timer, at) < this.timer.durationSecs
        ) {
          throw new AppError("请先结束当前计时，再切换专注任务");
        }
        this.timer.taskId = action.id;
        this.resetTo(this.timer.mode);
        break;
      }
      case "startTimer": {
        if (
          this.tasks.some(
            (t) => t.id === this.timer.taskId && this.taskIsVoid(t),
          )
        ) {
          throw new AppError("作废实例不能开始专注");
        }
        startTeachingTask(this, at);
        this.start(at);
        break;
      }
      case "pauseTimer": {
        this.timer.remainingSecs = timerRemaining(this.timer, at);
        this.timer.running = false;
        this.timer.deadline = null;
        break;
      }
      case "resetTimer": {
        this.record(at, false);
        this.resetTo(this.timer.mode);
        break;
      }
      case "skipTimer": {
        this.record(at, false);
        const next: Mode = this.timer.mode === "focus" ? "shortBreak" : "focus";
        this.resetTo(next);
        break;
      }
      case "setMode": {
        if (action.mode !== this.timer.mode) {
          this.record(at, false);
          this.resetTo(action.mode);
        }
        break;
      }
      case "saveSettings": {
        this.settings = action.settings;
        if (
          !this.timer.running &&
          this.timer.remainingSecs === this.timer.durationSecs
        ) {
          this.resetTo(this.timer.mode);
        }
        break;
      }
      case "importPlan":
        mergePlan(action.plan, this, at);
        break;
      case "import": {
        action.data.validate();
        const data = clone(action.data);
        // 恢复文件不得悄悄武装定时锁机。
        data.lock.active = null;
        data.lock.suppressedUntil = 0;
        data.settings.autoStartTasks = false;
        for (const schedule of data.lock.schedules) {
          schedule.enabled = false;
        }
        // 备份是数据，不是授权重开旧时钟。
        data.timer.remainingSecs = Math.max(1, timerRemaining(data.timer, at));
        data.timer.running = false;
        data.timer.deadline = null;
        data.timer.completionSerial = this.timer.completionSerial;
        replaceAppData(this, data);
        break;
      }
      case "loadExample": {
        if (this.tasks.length > 0) {
          throw new AppError("只有空任务列表可以载入示例");
        }
        const today = dateAt(at);
        const examples: [string, string, number, number][] = [
          [
            "梳理本周的工作计划",
            "把大目标拆成小步骤，让每一天都更从容。",
            3,
            2,
          ],
          [
            "读完正在看的那一章",
            "关掉消息提醒，给阅读留一段完整的时间。",
            2,
            1,
          ],
          ["整理桌面，整理思绪", "一个舒服的环境，是专注的开始。", 1, 1],
        ];
        examples.forEach(([title, notes, priority, estimate], index) => {
          this.tasks.push({
            id: id(),
            templateId: null,
            recurring: false,
            title,
            notes,
            projectId: this.projects[index]?.id ?? null,
            habitId: null,
            dueDate: today,
            reminderTime: null,
            focusMinutes: null,
            reminderFired: false,
            reminderPending: false,
            reminderExpired: false,
            scrapMinutes: 0,
            priority,
            estimate,
            completed: false,
            completedAt: null,
            createdAt: at + index,
            tags: ["示例"],
            subtasks: [],
          });
        });
        break;
      }
    }
    materializeTeachingTasks(this, at);
    this.validate();
  }

  validate(): void {
    this.educationValidate();
    validateTeachingTasks(this);
    validateLock(this.lock);
    validateTemplates(this);
    validateIdentities(this);
    validateBlocks(this.blocks);
    ensure(this.version === 4, "不支持此数据版本");
    ensure(
      this.tasks.length <= 50000 &&
        this.sessions.length <= 200000 &&
        this.projects.length <= 500,
      "数据超出数量限制",
    );
    const s = this.settings;
    ensure(s.soundVolume <= 100, "音效音量需为 0–100");
    ensure(
      s.focusMinutes >= 1 &&
        s.focusMinutes <= 180 &&
        s.shortBreakMinutes >= 1 &&
        s.shortBreakMinutes <= 60 &&
        s.longBreakMinutes >= 1 &&
        s.longBreakMinutes <= 120 &&
        s.longBreakEvery >= 2 &&
        s.longBreakEvery <= 12 &&
        s.dailyGoal >= 1 &&
        s.dailyGoal <= 30,
      "计时设置超出允许范围",
    );
    ensure(["light", "dark", "system"].includes(s.theme), "无效的主题");
    ensure(validAppIds(s.protection.whitelist), "无效的应用白名单");
    const projectIds = new Set<string>();
    for (const p of this.projects) {
      ensure(p.id.length > 0 && !projectIds.has(p.id), "项目 ID 重复或为空");
      projectIds.add(p.id);
      ensure(
        p.name.trim().length > 0 && charCount(p.name) <= 40,
        "项目名称需为 1–40 个字符",
      );
      ensure(
        p.color.length === 7 &&
          p.color.startsWith("#") &&
          /^[0-9a-fA-F]{6}$/.test(p.color.slice(1)),
        "无效的项目颜色",
      );
      ensure(
        p.appWhitelist === null || validAppIds(p.appWhitelist),
        "无效的项目应用白名单",
      );
    }
    const habitIds = new Set<string>();
    ensure(this.habits.length <= 500, "习惯数量超出限制");
    for (const h of this.habits) {
      ensure(h.id.length > 0 && !habitIds.has(h.id), "习惯 ID 重复或为空");
      habitIds.add(h.id);
      validateHabit(h);
    }
    const visionIds = new Set<string>();
    ensure(this.visions.length <= 500, "愿景数量超出限制");
    for (const a of this.visions) {
      ensure(a.id.length > 0 && !visionIds.has(a.id), "愿景 ID 重复或为空");
      visionIds.add(a.id);
      ensure(
        a.name.trim().length > 0 && charCount(a.name) <= 40,
        "愿景名称需为 1–40 个字符",
      );
      ensure(utf8Len(a.notes) <= 50000, "愿景内容过长");
      ensure(
        a.projectId === null || projectIds.has(a.projectId),
        "愿景引用了不存在的项目",
      );
    }
    const taskIds = new Set<string>();
    for (const t of this.tasks) {
      this.validateReminderTask(t);
      ensure(t.id.length > 0 && !taskIds.has(t.id), "任务 ID 重复或为空");
      taskIds.add(t.id);
      ensure(
        t.title.trim().length > 0 && charCount(t.title) <= 200,
        "任务名称需为 1–200 个字符",
      );
      ensure(
        utf8Len(t.notes) <= 50000 &&
          t.tags.length <= 20 &&
          t.tags.every((tag) => charCount(tag) <= 40),
        "备注或标签过长",
      );
      ensure(
        t.priority <= 3 && t.estimate >= 1 && t.estimate <= 99,
        "无效的优先级或预计番茄数",
      );
      ensure(t.scrapMinutes <= 10080, "重修窗口超出范围");
      ensure(
        t.projectId === null || projectIds.has(t.projectId),
        "任务引用了不存在的项目",
      );
      ensure(
        t.habitId === null || habitIds.has(t.habitId),
        "任务引用了不存在的习惯",
      );
      ensure(
        t.habitId === null || t.reminderTime !== null,
        "习惯实例需要精确时间",
      );
      ensure(
        t.dueDate === null || (t.dueDate.length === 10 && validDate(t.dueDate)),
        "无效的任务日期",
      );
      const subs = new Set<string>();
      ensure(
        t.subtasks.length <= 200 &&
          t.subtasks.every((sub) => {
            if (sub.id.length === 0) return false;
            if (subs.has(sub.id)) return false;
            subs.add(sub.id);
            return sub.title.trim().length > 0 && charCount(sub.title) <= 200;
          }),
        "无效的子任务",
      );
      ensure(
        t.completed === (t.completedAt !== null),
        "任务完成状态与日期不一致",
      );
    }
    const t = this.timer;
    ensure(
      t.cycleDate === null ||
        (t.cycleDate.length === 10 && validDate(t.cycleDate)),
      "无效的番茄周期日期",
    );
    ensure(
      t.durationSecs >= 1 &&
        t.durationSecs <= 10800 &&
        t.remainingSecs <= t.durationSecs &&
        t.running === (t.deadline !== null),
      "计时器数据不正确",
    );
    ensure(t.taskId === null || taskIds.has(t.taskId), "计时器任务不存在");
    const sessionIds = new Set<string>();
    const estimatedTasks = new Set<string>();
    for (const session of this.sessions) {
      const maxDuration = session.source === "timer" ? 10800 : 99 * 180 * 60;
      ensure(
        session.id.length > 0 &&
          !sessionIds.has(session.id) &&
          session.endedAt >= session.startedAt &&
          session.durationSecs >= 1 &&
          session.durationSecs <= maxDuration &&
          (session.source !== "taskEstimate" ||
            (!session.completed &&
              session.taskId !== null &&
              session.taskId.length > 0 &&
              !estimatedTasks.has(session.taskId) &&
              session.startedAt === session.endedAt)) &&
          charCount(session.taskTitle) <= 200 &&
          charCount(session.projectName) <= 40,
        "无效的专注记录",
      );
      sessionIds.add(session.id);
      if (session.source === "taskEstimate" && session.taskId !== null) {
        estimatedTasks.add(session.taskId);
      }
    }
  }

  stats(at: number): Stats {
    const today = dateAt(at);
    const current = parseLocalDate(today)!;
    const byDay = new Map<string, { seconds: number; pomodoros: number }>();
    for (const session of this.sessions) {
      const entry = byDay.get(dateAt(session.endedAt)) ?? {
        seconds: 0,
        pomodoros: 0,
      };
      entry.seconds += session.durationSecs;
      entry.pomodoros += session.completed ? 1 : 0;
      byDay.set(dateAt(session.endedAt), entry);
    }
    // 一遍遍历实例：按天统计完成、作废与缺勤。
    const completedByDay = new Map<string, number>();
    const voidedByDay = new Map<string, number>();
    const missedByDay = new Map<string, number>();
    for (const t of this.tasks) {
      if (t.completedAt !== null) {
        completedByDay.set(
          dateAt(t.completedAt),
          (completedByDay.get(dateAt(t.completedAt)) ?? 0) + 1,
        );
      }
      if (t.reminderExpired && !t.completed && t.dueDate !== null) {
        if (kindOf(t) === "habit") {
          missedByDay.set(t.dueDate, (missedByDay.get(t.dueDate) ?? 0) + 1);
        } else {
          voidedByDay.set(t.dueDate, (voidedByDay.get(t.dueDate) ?? 0) + 1);
        }
      }
    }
    const days: DayStat[] = [];
    for (let n = 27; n >= 0; n -= 1) {
      const date = formatLocalDate(addDays(current, -n));
      const entry = byDay.get(date) ?? { seconds: 0, pomodoros: 0 };
      days.push({
        date,
        seconds: entry.seconds,
        pomodoros: entry.pomodoros,
        missed: missedByDay.get(date) ?? 0,
        completed: completedByDay.get(date) ?? 0,
        voided: voidedByDay.get(date) ?? 0,
      });
    }
    const focused = new Set<string>();
    for (const s of this.sessions) {
      if (s.completed || s.source === "taskEstimate") {
        focused.add(dateAt(s.endedAt));
      }
    }
    let day = current;
    if (!focused.has(today)) {
      day = addDays(day, -1);
    }
    let streak = 0;
    while (focused.has(formatLocalDate(day))) {
      streak += 1;
      day = addDays(day, -1);
    }
    const last = days[days.length - 1]!;
    return {
      todaySeconds: last.seconds,
      todayPomodoros: last.pomodoros,
      todayCompleted: this.tasks.filter(
        (t) => t.completedAt !== null && dateAt(t.completedAt) === today,
      ).length,
      totalSeconds: this.sessions.reduce((n, s) => n + s.durationSecs, 0),
      totalPomodoros: this.sessions.filter((s) => s.completed).length,
      streak,
      days,
    };
  }

  // ---- reminders 包装 ----
  reminderIdle(): boolean {
    return reminderIdle(this);
  }
  pendingReminder(): Task | null {
    return pendingReminder(this);
  }
  dueAutoTask(): Task | null {
    return dueAutoTask(this);
  }

  // ---- plan 包装 ----
  exportPlan(): PlanFile {
    return exportPlan(this);
  }

  // ---- teaching 包装 ----
  teachingTask(taskId: string): ReturnType<typeof teachingTask> {
    return teachingTask(this, taskId);
  }
  completeTeachingTask(taskId: string, at: number): void {
    completeTeachingTask(this, taskId, at);
  }

  // ---- education 校验包装 ----
  educationValidate(): void {
    validateEducationData(this);
  }
  validateReminderTask(task: Task): void {
    validateReminderTask(task);
  }
}

import { validateReminderTask } from "./reminders";
import { validateEducation as validateEducationData } from "./education";

// ---------- 全局函数 ----------

export function validAppIds(list: string[]): boolean {
  return (
    list.length <= 100 &&
    list.every(
      (a) =>
        a.trim().length > 0 &&
        charCount(a) <= 32768 &&
        !Array.from(a).some((c) => isControlChar(c)),
    )
  );
}

function isControlChar(c: string): boolean {
  const code = c.codePointAt(0)!;
  return code < 0x20 || (code >= 0x7f && code <= 0x9f);
}

function parseLocalDate(
  value: string,
): { year: number; month: number; day: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function formatLocalDate(date: {
  year: number;
  month: number;
  day: number;
}): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

export function checkUserAction(action: Action): void {
  if (action.type === "education" && assistantOnly(action.command)) {
    throw new AppError(
      "课程、作业、试卷和批改由学习助手生成，请在对话中提出要求",
    );
  }
}

import { assistantOnly } from "./education";

// ---------- Action ----------

export type Action =
  | { type: "education"; command: import("./education").Command }
  | { type: "printInstances"; shape: Shape; printing: Printing }
  | { type: "saveTemplate"; template: Template; printDates: (string | null)[] }
  | { type: "deleteTemplate"; id: string }
  | { type: "printTemplate"; id: string; dates: (string | null)[] }
  | { type: "syncTemplate"; id: string }
  | { type: "startReminder"; id: string }
  | { type: "saveTask"; task: TaskDraft }
  | { type: "toggleTask"; id: string }
  | { type: "deleteTask"; id: string }
  | { type: "restoreTask"; task: Task }
  | { type: "toggleSubtask"; taskId: string; subtaskId: string }
  | {
      type: "saveProject";
      id: string | null;
      name: string;
      color: string;
      directory: string | null;
    }
  | {
      type: "renameProjectDirectory";
      id: string;
      name: string;
      color: string;
      directory: string;
    }
  | { type: "setProjectWhitelist"; id: string; whitelist: string[] | null }
  | { type: "deleteProject"; id: string }
  | { type: "reorderProjects"; ids: string[] }
  | { type: "detachTasks"; ids: string[]; target: DetachTarget }
  | { type: "saveHabitGroup"; id: string | null; name: string }
  | {
      type: "saveHabit";
      id: string | null;
      name: string;
      projectId: string | null;
      focusMinutes: number | null;
      slots: HabitSlot[];
    }
  | { type: "deleteHabit"; id: string }
  | {
      type: "saveVision";
      id: string | null;
      name: string;
      notes: string;
      projectId: string | null;
    }
  | { type: "deleteVision"; id: string }
  | {
      type: "saveBlock";
      id: string | null;
      title: string;
      days: number[];
      start: string;
      end: string;
      attention: Attention;
      notes: string;
    }
  | { type: "deleteBlock"; id: string }
  | { type: "selectTask"; id: string | null }
  | { type: "startTimer" }
  | { type: "completeFocus" }
  | { type: "pauseTimer" }
  | { type: "resetTimer" }
  | { type: "skipTimer" }
  | { type: "setMode"; mode: Mode }
  | { type: "saveSettings"; settings: Settings }
  | { type: "loadExample" }
  | { type: "import"; data: AppData }
  | { type: "importPlan"; plan: PlanFile }
  | { type: "emergencyUnlock" }
  | { type: "saveLockSchedule"; schedule: LockSchedule }
  | { type: "deleteLockSchedule"; id: string }
  | { type: "startQuickLock"; minutes: number; strict: boolean };

import { parsePlanFile } from "./plan";
import { parseCommand } from "./education";
import { parseTemplate, parsePrinting, parseShape } from "./templates";
import { parseLockSchedule } from "./lock";

const ACTION_KEYS: Record<string, string[]> = {
  education: ["type", "command"],
  printInstances: ["type", "shape", "printing"],
  saveTemplate: ["type", "template", "printDates"],
  deleteTemplate: ["type", "id"],
  printTemplate: ["type", "id", "dates"],
  syncTemplate: ["type", "id"],
  startReminder: ["type", "id"],
  saveTask: ["type", "task"],
  toggleTask: ["type", "id"],
  deleteTask: ["type", "id"],
  restoreTask: ["type", "task"],
  toggleSubtask: ["type", "taskId", "subtaskId"],
  saveProject: ["type", "id", "name", "color", "directory"],
  renameProjectDirectory: ["type", "id", "name", "color", "directory"],
  setProjectWhitelist: ["type", "id", "whitelist"],
  deleteProject: ["type", "id"],
  reorderProjects: ["type", "ids"],
  detachTasks: ["type", "ids", "target"],
  saveHabitGroup: ["type", "id", "name"],
  saveHabit: ["type", "id", "name", "projectId", "focusMinutes", "slots"],
  deleteHabit: ["type", "id"],
  saveVision: ["type", "id", "name", "notes", "projectId"],
  deleteVision: ["type", "id"],
  saveBlock: [
    "type",
    "id",
    "title",
    "days",
    "start",
    "end",
    "attention",
    "notes",
  ],
  deleteBlock: ["type", "id"],
  selectTask: ["type", "id"],
  startTimer: ["type"],
  completeFocus: ["type"],
  pauseTimer: ["type"],
  resetTimer: ["type"],
  skipTimer: ["type"],
  setMode: ["type", "mode"],
  saveSettings: ["type", "settings"],
  loadExample: ["type"],
  import: ["type", "data"],
  importPlan: ["type", "plan"],
  emergencyUnlock: ["type"],
  saveLockSchedule: ["type", "schedule"],
  deleteLockSchedule: ["type", "id"],
  startQuickLock: ["type", "minutes", "strict"],
};

const ACTION_NAMES = Object.keys(ACTION_KEYS);

export function parseAction(raw: unknown): Action {
  if (!isObject(raw)) throw new AppError("动作必须是对象");
  const type = oneOf(
    requiredField(raw, "type", "动作", (v) => v),
    "动作 type",
    ACTION_NAMES,
  );
  rejectUnknown(raw, ACTION_KEYS[type]!, "动作");
  const str = (key: string): string => requiredField(raw, key, "动作", asStr);
  const optStr = (key: string): string | null =>
    field(raw, key, "动作", (v) => asOpt(v, key, asStr), null) as string | null;
  const strs = (key: string): string[] =>
    asArray(
      requiredField(raw, key, "动作", (v) => v),
      key,
    ).map((x) => asStr(x, key));
  switch (type) {
    case "education":
      return {
        type,
        command: parseCommand(requiredField(raw, "command", "动作", (v) => v)),
      };
    case "printInstances":
      return {
        type,
        shape: parseShape(requiredField(raw, "shape", "动作", (v) => v)),
        printing: parsePrinting(
          requiredField(raw, "printing", "动作", (v) => v),
        ),
      };
    case "saveTemplate":
      return {
        type,
        template: parseTemplate(
          requiredField(raw, "template", "动作", (v) => v),
        ),
        printDates: field(
          raw,
          "printDates",
          "动作",
          (v) =>
            asArray(v, "printDates").map((d) =>
              d === null ? null : asStr(d, "printDates"),
            ),
          [],
        ) as (string | null)[],
      };
    case "deleteTemplate":
    case "syncTemplate":
    case "startReminder":
    case "toggleTask":
    case "deleteTask":
    case "deleteProject":
    case "deleteHabit":
    case "deleteVision":
    case "deleteBlock":
    case "deleteLockSchedule":
      return { type, id: str("id") };
    case "printTemplate":
      return {
        type,
        id: str("id"),
        dates: asArray(
          requiredField(raw, "dates", "动作", (v) => v),
          "dates",
        ).map((d) => (d === null ? null : asStr(d, "dates"))) as (
          string | null
        )[],
      };
    case "saveTask":
      return {
        type,
        task: parseTaskDraft(requiredField(raw, "task", "动作", (v) => v)),
      };
    case "restoreTask":
      return {
        type,
        task: parseTask(requiredField(raw, "task", "动作", (v) => v)),
      };
    case "toggleSubtask":
      return { type, taskId: str("taskId"), subtaskId: str("subtaskId") };
    case "saveProject":
      return {
        type,
        id: optStr("id"),
        name: str("name"),
        color: str("color"),
        directory: optStr("directory"),
      };
    case "renameProjectDirectory":
      return {
        type,
        id: str("id"),
        name: str("name"),
        color: str("color"),
        directory: str("directory"),
      };
    case "setProjectWhitelist":
      return {
        type,
        id: str("id"),
        whitelist: field(
          raw,
          "whitelist",
          "动作",
          (v) =>
            asOpt(v, "whitelist", (x) =>
              asArray(x, "whitelist").map((a) => asStr(a, "whitelist")),
            ),
          null,
        ) as string[] | null,
      };
    case "reorderProjects":
      return { type, ids: strs("ids") };
    case "detachTasks":
      return {
        type,
        ids: strs("ids"),
        target: oneOf(
          requiredField(raw, "target", "动作", (v) => v),
          "detach target",
          ["project", "habit"],
        ) as DetachTarget,
      };
    case "saveHabitGroup":
      return { type, id: optStr("id"), name: str("name") };
    case "saveHabit":
      return {
        type,
        id: optStr("id"),
        name: str("name"),
        projectId: optStr("projectId"),
        focusMinutes: field(
          raw,
          "focusMinutes",
          "动作",
          (v) => asOpt(v, "focusMinutes", (x) => asInt(x, "focusMinutes")),
          null,
        ) as number | null,
        slots: asArray(
          requiredField(raw, "slots", "动作", (v) => v),
          "slots",
        ).map(parseHabitSlot),
      };
    case "saveVision":
      return {
        type,
        id: optStr("id"),
        name: str("name"),
        notes: field(raw, "notes", "动作", asStr, ""),
        projectId: optStr("projectId"),
      };
    case "saveBlock":
      return {
        type,
        id: optStr("id"),
        title: str("title"),
        days: asArray(
          requiredField(raw, "days", "动作", (v) => v),
          "days",
        ).map((d) => asInt(d, "days")),
        start: str("start"),
        end: str("end"),
        attention: field(
          raw,
          "attention",
          "动作",
          (v) => oneOf(v, "attention", ["required", "light"]),
          "required",
        ) as Attention,
        notes: field(raw, "notes", "动作", asStr, ""),
      };
    case "selectTask":
      return { type, id: optStr("id") };
    case "startTimer":
    case "completeFocus":
    case "pauseTimer":
    case "resetTimer":
    case "skipTimer":
    case "loadExample":
    case "emergencyUnlock":
      return { type };
    case "setMode":
      return {
        type,
        mode: oneOf(
          requiredField(raw, "mode", "动作", (v) => v),
          "mode",
          ["focus", "shortBreak", "longBreak"],
        ) as Mode,
      };
    case "saveSettings":
      return {
        type,
        settings: parseSettings(
          requiredField(raw, "settings", "动作", (v) => v),
        ),
      };
    case "import":
      return {
        type,
        data: parseAppData(requiredField(raw, "data", "动作", (v) => v)),
      };
    case "importPlan":
      return {
        type,
        plan: parsePlanFile(requiredField(raw, "plan", "动作", (v) => v)),
      };
    case "saveLockSchedule":
      return {
        type,
        schedule: parseLockSchedule(
          requiredField(raw, "schedule", "动作", (v) => v),
        ),
      };
    case "startQuickLock":
      return {
        type,
        minutes: requiredField(raw, "minutes", "动作", asInt),
        strict: requiredField(raw, "strict", "动作", asBool),
      };
    default:
      throw new AppError(`动作 type 取值无效：${type}`);
  }
}

// ---------- AppData 解析/序列化 ----------

const APP_DATA_KEYS = [
  "education",
  "version",
  "identities",
  "tasks",
  "blocks",
  "templates",
  "prints",
  "projects",
  "habits",
  "visions",
  "settings",
  "timer",
  "sessions",
  "lock",
] as const;

export function parseAppData(raw: unknown): AppData {
  if (!isObject(raw)) throw new AppError("数据必须是对象");
  // 与 Rust #[serde(deny_unknown_fields)] 对齐：顶层未知字段直接拒绝（不兼容旧协议）。
  rejectUnknown(
    raw,
    [
      "education",
      "version",
      "identities",
      "tasks",
      "blocks",
      "templates",
      "prints",
      "projects",
      "habits",
      "visions",
      "settings",
      "timer",
      "sessions",
      "lock",
    ],
    "数据",
  );
  return new AppData({
    education: field(raw, "education", "数据", parseEducation, new Education()),
    version: requiredField(raw, "version", "数据", asInt),
    identities: field(
      raw,
      "identities",
      "数据",
      (v) => asArray(v, "identities").map(parseIdentity),
      [],
    ),
    tasks: field(
      raw,
      "tasks",
      "数据",
      (v) => asArray(v, "tasks").map(parseTask),
      [],
    ),
    blocks: field(
      raw,
      "blocks",
      "数据",
      (v) => asArray(v, "blocks").map(parseBlock),
      [],
    ),
    templates: field(
      raw,
      "templates",
      "数据",
      (v) => asArray(v, "templates").map(parseTemplate),
      [],
    ),
    prints: field(
      raw,
      "prints",
      "数据",
      (v) =>
        asArray(v, "prints").map((p) => {
          ensure(isObject(p), "印刷记录必须是对象");
          rejectUnknown(p, ["templateId", "date"], "印刷记录");
          return {
            templateId: requiredField(p, "templateId", "印刷记录", asStr),
            date: field(
              p,
              "date",
              "印刷记录",
              (d) => asOpt(d, "date", asStr),
              null,
            ) as string | null,
          };
        }),
      [],
    ),
    projects: requiredField(raw, "projects", "数据", (v) =>
      asArray(v, "projects").map(parseProject),
    ),
    habits: field(
      raw,
      "habits",
      "数据",
      (v) => asArray(v, "habits").map(parseHabit),
      [],
    ),
    visions: field(
      raw,
      "visions",
      "数据",
      (v) => asArray(v, "visions").map(parseVision),
      [],
    ),
    settings: requiredField(raw, "settings", "数据", parseSettings),
    timer: requiredField(raw, "timer", "数据", parseTimer),
    sessions: requiredField(raw, "sessions", "数据", (v) =>
      asArray(v, "sessions").map(parseSession),
    ),
    lock: field(raw, "lock", "数据", parseLockState, {
      schedules: [],
      active: null,
      suppressedUntil: 0,
    }),
  });
}

export function serializeAppData(data: AppData): Record<string, unknown> {
  return {
    education: serializeEducation(data.education),
    version: data.version,
    identities: data.identities.map(serializeIdentity),
    tasks: data.tasks.map(serializeTask),
    blocks: data.blocks.map(serializeBlock),
    templates: data.templates.map(serializeTemplate),
    prints: data.prints.map(serializePrintRecord),
    projects: data.projects.map(serializeProject),
    habits: data.habits.map(serializeHabit),
    visions: data.visions.map(serializeVision),
    settings: serializeSettings(data.settings),
    timer: serializeTimer(data.timer),
    sessions: data.sessions.map(serializeSession),
    lock: serializeLockState(data.lock),
  };
}

import { serializePrintRecord, serializeTemplate } from "./templates";
import { validateBlock } from "./blocks";
import { isAbsolutePath } from "./education";
