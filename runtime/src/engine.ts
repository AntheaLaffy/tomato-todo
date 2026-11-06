// 番茄 Todo runtime：最小内存引擎桩。
//
// 数据布局：plan.json（计划 v6，唯一域数据源，原子写）承载任务/项目/模板/习惯/
// 课表等；state.json（防抖原子写）承载计时器/设置/会话/愿景/锁定等运行时状态。
// 番茄计时状态机跨请求保存在内存 + state.json；每秒 tick 只更新内存并防抖落盘。
//
// 接口刻意保持方法级干净（任务增删改查/完成、计划文件读写、当日快照/统计、
// 计时状态机、提醒桩、导出），@tomato/core 落地后由 lead 整体替换本文件实现，
// 不改变外部 JSON 形状。

import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import type {
  AppData,
  BackupFile,
  Block,
  DispatchAction,
  Education,
  ExportResult,
  PlanExportFile,
  PlanFile,
  RuntimeState,
  Session,
  Settings,
  Snapshot,
  Stats,
  Task,
  TaskInput,
  TaskKind,
  Timer,
  TodayStats,
  TodayView,
  Vision,
} from "./types.ts";

const PLAN_VERSION = 6 as const;
const BACKUP_VERSION = 4 as const;
/** 统计 days 数组回看天数（桩）。 */
const STATS_DAYS = 14;
/** 状态落盘防抖（毫秒）：tick 只更新内存，安静后统一写 state.json。 */
const STATE_FLUSH_MS = 1500;

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^\d{2}:\d{2}$/;

// ---------- 时间工具（本机时区，Unix 秒） ----------

const pad = (n: number): string => String(n).padStart(2, "0");

export function localDate(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dateToTs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getTime() / 1000;
}

export function timeToTs(date: string, time: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, min).getTime() / 1000;
}

export function dayShift(date: string, delta: number): string {
  return localDate(dateToTs(date) + delta * 86400);
}

export function nowSecs(): number {
  return Math.floor(Date.now() / 1000);
}

// ---------- 校验 ----------

export function validDate(s: unknown): s is string {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(y, m - 1, d);
  return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d;
}

export function validTime(s: unknown): s is string {
  if (typeof s !== "string" || !TIME_RE.test(s)) return false;
  const [h, m] = s.split(":").map(Number);
  return h >= 0 && h < 24 && m >= 0 && m < 60;
}

function requireText(value: unknown, label: string, max = 400): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label}不能为空`);
  }
  const text = value.trim();
  if (text.length > max) throw new Error(`${label}过长（最多 ${max} 字）`);
  return text;
}

// ---------- 原子写 ----------

export function atomicWrite(file: string, data: string): void {
  const dir = dirname(file);
  mkdirSync(dir, { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
  const fd = openSync(tmp, "w");
  try {
    writeFileSync(fd, data);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, file);
}

// ---------- 默认值 ----------

export function defaultSettings(): Settings {
  return {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakEvery: 4,
    dailyGoal: 8,
    autoBreak: true,
    autoFocus: false,
    autoStartTasks: false,
    sound: true,
    soundVolume: 1,
    notifications: true,
    alwaysOnTop: false,
    theme: "light",
    personaBackdrop: false,
    protection: { mode: "off", whitelist: [], strict: false },
  };
}

export function defaultTimer(settings: Settings): Timer {
  const durationSecs = settings.focusMinutes * 60;
  return {
    mode: "focus",
    running: false,
    taskId: null,
    durationSecs,
    remainingSecs: durationSecs,
    deadline: null,
    startedAt: null,
    cycle: 0,
    cycleDate: null,
    completionSerial: 0,
    lastFinishedMode: null,
    autoFocusBlocked: false,
  };
}

export function defaultPlan(): PlanFile {
  return {
    format: "tomato-todo-plan",
    version: PLAN_VERSION,
    pomodoroMinutes: 25,
    projects: [],
    tasks: [],
    blocks: [],
    templates: [],
    prints: [],
    habits: [],
  };
}

export function defaultEducation(): Education {
  return {
    focusTasks: [],
    projects: [],
    progress: [],
    corrections: [],
    completedTasks: [],
    resources: [],
    semesters: [],
    semesterHistory: [],
    lessons: [],
    assessments: [],
    submissions: [],
    grades: [],
    reviews: [],
    events: [],
  };
}

export function defaultState(): RuntimeState {
  const settings = defaultSettings();
  return {
    settings,
    timer: defaultTimer(settings),
    sessions: [],
    identities: [],
    visions: [],
    lock: { schedules: [], active: null, suppressedUntil: 0 },
    education: defaultEducation(),
  };
}

// ---------- 引擎 ----------

export class Engine {
  readonly dataDir: string;
  private plan: PlanFile;
  private state: RuntimeState;
  private stateFlushTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor(dataDir: string, plan: PlanFile, state: RuntimeState) {
    this.dataDir = dataDir;
    this.plan = plan;
    this.state = state;
  }

  /** 打开（或初始化）数据目录并加载 plan.json + state.json。 */
  static open(dataDir: string, now: number = nowSecs()): Engine {
    mkdirSync(dataDir, { recursive: true });
    const planFile = join(dataDir, "plan.json");
    const stateFile = join(dataDir, "state.json");

    let plan = defaultPlan();
    if (existsSync(planFile)) {
      try {
        plan = JSON.parse(readFileSync(planFile, "utf8")) as PlanFile;
      } catch (error) {
        throw new Error(`plan.json 读取失败：${String(error?.message ?? error)}`);
      }
    }
    let state = defaultState();
    if (existsSync(stateFile)) {
      try {
        state = {
          ...defaultState(),
          ...(JSON.parse(readFileSync(stateFile, "utf8")) as Partial<RuntimeState>),
        };
      } catch (error) {
        throw new Error(`state.json 读取失败：${String(error?.message ?? error)}`);
      }
    }
    const engine = new Engine(dataDir, plan, state);
    engine.recoverTimer(now);
    return engine;
  }

  get settings(): Settings {
    return this.state.settings;
  }

  get timer(): Timer {
    return this.state.timer;
  }

  // ---------- 落盘 ----------

  /** 计划立即原子落盘（写操作低频，直接同步写）。 */
  private savePlan(): void {
    atomicWrite(join(this.dataDir, "plan.json"), JSON.stringify(this.plan, null, 2));
  }

  /** 状态立即落盘（用户动作/会话记录时调用）。 */
  flushNow(): void {
    if (this.stateFlushTimer !== null) {
      clearTimeout(this.stateFlushTimer);
      this.stateFlushTimer = null;
    }
    atomicWrite(join(this.dataDir, "state.json"), JSON.stringify(this.state, null, 2));
  }

  /** tick 触发的防抖落盘。 */
  private scheduleStateFlush(): void {
    if (this.stateFlushTimer !== null) return;
    this.stateFlushTimer = setTimeout(() => {
      this.stateFlushTimer = null;
      this.flushNow();
    }, STATE_FLUSH_MS);
    this.stateFlushTimer.unref?.();
  }

  /** 重启恢复：运行中的计时按 deadline 结算或补算剩余秒数。 */
  private recoverTimer(now: number): void {
    const timer = this.state.timer;
    if (!timer.running || timer.deadline == null) return;
    if (now >= timer.deadline) {
      timer.remainingSecs = 0;
      this.finishFocus(now, true);
    } else {
      timer.remainingSecs = timer.deadline - now;
    }
  }

  // ---------- 任务增删改查 ----------

  createTask(input: TaskInput, now: number = nowSecs()): Task {
    const title = requireText(input.title, "标题");
    if (!validDate(input.dueDate)) throw new Error("dueDate 必须是有效日期 YYYY-MM-DD");
    if (input.reminderTime != null && !validTime(input.reminderTime)) {
      throw new Error("reminderTime 必须是 HH:MM");
    }
    const focusMinutes = input.focusMinutes ?? null;
    if (focusMinutes != null && (!Number.isInteger(focusMinutes) || focusMinutes < 1 || focusMinutes > 180)) {
      throw new Error("focusMinutes 需为 1–180");
    }
    const priority = input.priority ?? 0;
    if (!Number.isInteger(priority) || priority < 0 || priority > 3) {
      throw new Error("priority 需为 0–3");
    }
    const estimate = input.estimate ?? 1;
    if (!Number.isInteger(estimate) || estimate < 1 || estimate > 99) {
      throw new Error("estimate 需为 1–99");
    }
    const projectId = input.projectId ?? null;
    if (projectId != null && !this.plan.projects.some((p) => p.id === projectId)) {
      throw new Error("项目不存在");
    }
    const habitId = input.habitId ?? null;
    if (habitId != null && !(this.plan.habits ?? []).some((h) => h.id === habitId)) {
      throw new Error("习惯组不存在");
    }
    const tags = this.cleanTags(input.tags);
    const subtasks = this.cleanSubtasks(input.subtasks);

    const task: Task = {
      id: randomUUID(),
      templateId: null,
      recurring: false,
      scrapMinutes: Math.max(0, input.scrapMinutes ?? 0),
      title,
      notes: typeof input.notes === "string" ? input.notes : "",
      projectId,
      habitId,
      dueDate: input.dueDate,
      reminderTime: input.reminderTime ?? null,
      focusMinutes,
      reminderFired: false,
      reminderPending: false,
      reminderExpired: false,
      priority,
      estimate,
      completed: false,
      completedAt: null,
      createdAt: now,
      tags,
      subtasks,
    };
    this.plan.tasks.push(task);
    this.savePlan();
    return task;
  }

  updateTask(id: string, changes: Partial<TaskInput>, now: number = nowSecs()): Task {
    const task = this.findTask(id);
    const allowed = [
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
      "tags",
    ] as const;
    for (const key of Object.keys(changes)) {
      if (!allowed.includes(key as (typeof allowed)[number])) {
        throw new Error(`不允许修改字段：${key}`);
      }
    }
    const next: Partial<TaskInput> = { ...changes };
    if (next.title !== undefined) next.title = requireText(next.title, "标题");
    if (next.dueDate !== undefined && !validDate(next.dueDate)) {
      throw new Error("dueDate 必须是有效日期 YYYY-MM-DD");
    }
    if (next.reminderTime !== undefined && next.reminderTime !== null && !validTime(next.reminderTime)) {
      throw new Error("reminderTime 必须是 HH:MM");
    }
    if (next.focusMinutes !== undefined && next.focusMinutes !== null &&
      (!Number.isInteger(next.focusMinutes) || next.focusMinutes < 1 || next.focusMinutes > 180)) {
      throw new Error("focusMinutes 需为 1–180");
    }
    if (next.scrapMinutes !== undefined &&
      (!Number.isInteger(next.scrapMinutes) || next.scrapMinutes < 0 || next.scrapMinutes > 10080)) {
      throw new Error("scrapMinutes 需为 0–10080");
    }
    if (next.priority !== undefined && (!Number.isInteger(next.priority) || next.priority < 0 || next.priority > 3)) {
      throw new Error("priority 需为 0–3");
    }
    if (next.estimate !== undefined && (!Number.isInteger(next.estimate) || next.estimate < 1 || next.estimate > 99)) {
      throw new Error("estimate 需为 1–99");
    }
    if (next.projectId !== undefined && next.projectId !== null &&
      !this.plan.projects.some((p) => p.id === next.projectId)) {
      throw new Error("项目不存在");
    }
    if (next.habitId !== undefined && next.habitId !== null &&
      !(this.plan.habits ?? []).some((h) => h.id === next.habitId)) {
      throw new Error("习惯组不存在");
    }
    if (next.tags !== undefined) task.tags = this.cleanTags(next.tags);
    for (const key of allowed) {
      const value = next[key as keyof typeof next];
      if (value !== undefined) {
        // 明确传 null 表示清空可空字段
        (task as unknown as Record<string, unknown>)[key] = value;
      }
    }
    void now;
    this.savePlan();
    return task;
  }

  moveTasks(ids: string[], dueDate: string, reminderTime?: string | null): Task[] {
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100) {
      throw new Error("ids 需为 1–100 个任务 ID");
    }
    if (!validDate(dueDate)) throw new Error("dueDate 必须是有效日期 YYYY-MM-DD");
    if (reminderTime !== undefined && reminderTime !== null && !validTime(reminderTime)) {
      throw new Error("reminderTime 必须是 HH:MM");
    }
    const tasks = ids.map((id) => this.findTask(id));
    if (tasks.some((t) => t.completed)) throw new Error("包含已完成任务，整批不移动");
    for (const task of tasks) {
      task.dueDate = dueDate;
      if (reminderTime !== undefined) task.reminderTime = reminderTime;
      task.reminderFired = false;
    }
    this.savePlan();
    return tasks;
  }

  completeTask(id: string, now: number = nowSecs()): Task {
    const task = this.findTask(id);
    if (task.completed) throw new Error("任务已完成，不能反复切换");
    task.completed = true;
    task.completedAt = now;
    this.savePlan();
    return task;
  }

  deleteTask(id: string): { id: string } {
    const index = this.plan.tasks.findIndex((t) => t.id === id);
    if (index < 0) throw new Error("任务不存在");
    this.plan.tasks.splice(index, 1);
    this.savePlan();
    return { id };
  }

  listTasks(
    filter: { projectId?: string | null; completed?: boolean; offset?: number; limit?: number } = {},
  ): { tasks: Task[]; total: number; offset: number; limit: number } {
    const offset = filter.offset ?? 0;
    const limit = Math.min(100, Math.max(1, filter.limit ?? 100));
    let tasks = [...this.plan.tasks];
    if (filter.projectId !== undefined) tasks = tasks.filter((t) => t.projectId === filter.projectId);
    if (filter.completed !== undefined) tasks = tasks.filter((t) => t.completed === filter.completed);
    tasks.sort((a, b) =>
      a.dueDate.localeCompare(b.dueDate) || b.priority - a.priority || a.createdAt - b.createdAt);
    const total = tasks.length;
    return { tasks: tasks.slice(offset, offset + limit), total, offset, limit };
  }

  // ---------- 番茄计时状态机 ----------

  focusStart(options: { taskId?: string | null; minutes?: number | null } = {}, now: number = nowSecs()): Timer {
    const prev = this.state.timer;
    // 休息段（含进行中）不记会话，可直接替换为新番茄。
    if (prev.running && prev.mode === "focus") {
      throw new Error("已有进行中的番茄，先停止或放弃");
    }
    const settings = this.state.settings;
    const minutes = options.minutes ?? settings.focusMinutes;
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
      throw new Error("单次时长需为 1–180 分钟");
    }
    const taskId = options.taskId ?? null;
    if (taskId != null) this.findTask(taskId);
    const durationSecs = minutes * 60;
    this.state.timer = {
      mode: "focus",
      running: true,
      taskId,
      durationSecs,
      remainingSecs: durationSecs,
      deadline: now + durationSecs,
      startedAt: now,
      cycle: prev.cycle,
      cycleDate: localDate(now),
      completionSerial: prev.completionSerial,
      lastFinishedMode: prev.lastFinishedMode,
      autoFocusBlocked: false,
    };
    this.flushNow();
    return this.state.timer;
  }

  focusPause(now: number = nowSecs()): Timer {
    const timer = this.state.timer;
    if (!timer.running || timer.mode !== "focus") throw new Error("没有进行中的番茄");
    timer.remainingSecs = timer.deadline != null ? Math.max(0, timer.deadline - now) : timer.remainingSecs;
    timer.running = false;
    timer.deadline = null;
    this.flushNow();
    return timer;
  }

  focusResume(now: number = nowSecs()): Timer {
    const timer = this.state.timer;
    if (timer.running) throw new Error("番茄已在运行");
    if (timer.mode !== "focus" || timer.startedAt == null) throw new Error("没有可继续的番茄");
    if (timer.remainingSecs <= 0) throw new Error("番茄已结束，先停止");
    timer.running = true;
    // startedAt 保持原值：会话时长按实际专注时间（durationSecs - remaining）计算，
    // 暂停时段不算专注。
    timer.deadline = now + timer.remainingSecs;
    this.flushNow();
    return timer;
  }

  focusStop(now: number = nowSecs()): { timer: Timer; session: Session } {
    const timer = this.state.timer;
    // 允许在暂停态停止：只要开过专注段（mode=focus 且 startedAt 非空）就能结算。
    if (timer.mode !== "focus" || timer.startedAt == null) throw new Error("没有进行中的番茄");
    if (timer.running && timer.deadline != null) {
      timer.remainingSecs = Math.max(0, timer.deadline - now);
    }
    const completed = timer.remainingSecs <= 0;
    const session = this.finishFocus(now, completed);
    this.flushNow();
    return { timer: this.state.timer, session };
  }

  focusDiscard(): Timer {
    const settings = this.state.settings;
    const prev = this.state.timer;
    this.state.timer = {
      ...defaultTimer(settings),
      cycle: prev.cycle,
      completionSerial: prev.completionSerial,
      lastFinishedMode: prev.lastFinishedMode,
    };
    this.flushNow();
    return this.state.timer;
  }

  /**
   * 结算一个专注段并记录会话；随后按 autoBreak 进入休息或回到空闲。
   * 休息段只计时不记会话（统计口径：仅专注段）。
   */
  private finishFocus(now: number, completed: boolean): Session {
    const timer = this.state.timer;
    const remaining = timer.deadline != null ? Math.max(0, timer.deadline - now) : timer.remainingSecs;
    const elapsed = Math.max(0, timer.durationSecs - remaining);
    const task = timer.taskId != null ? this.plan.tasks.find((t) => t.id === timer.taskId) : undefined;
    const project = task?.projectId != null ? this.plan.projects.find((p) => p.id === task.projectId) : undefined;
    const session: Session = {
      id: randomUUID(),
      source: "timer",
      taskId: timer.taskId,
      taskTitle: task?.title ?? "",
      projectName: project?.name ?? "",
      startedAt: timer.startedAt ?? now - elapsed,
      endedAt: now,
      durationSecs: elapsed,
      completed,
    };
    this.state.sessions.push(session);

    const settings = this.state.settings;
    let next: Timer;
    if (completed) {
      const cycle = timer.cycle + 1;
      const long = cycle % settings.longBreakEvery === 0;
      const mode = long ? "longBreak" : "shortBreak";
      const durationSecs = (long ? settings.longBreakMinutes : settings.shortBreakMinutes) * 60;
      const running = settings.autoBreak;
      next = {
        mode,
        running,
        taskId: null,
        durationSecs,
        remainingSecs: durationSecs,
        deadline: running ? now + durationSecs : null,
        startedAt: running ? now : null,
        cycle,
        cycleDate: localDate(now),
        completionSerial: timer.completionSerial + 1,
        lastFinishedMode: "focus",
        autoFocusBlocked: false,
      };
    } else {
      next = {
        ...defaultTimer(settings),
        cycle: timer.cycle,
        completionSerial: timer.completionSerial,
        lastFinishedMode: "focus",
      };
    }
    this.state.timer = next;
    return session;
  }

  /** 每秒 tick：只更新内存（remainingSecs / 到点自动完成），落盘防抖。 */
  tick(now: number = nowSecs()): void {
    const timer = this.state.timer;
    if (!timer.running || timer.deadline == null) return;
    if (now >= timer.deadline) {
      if (timer.mode === "focus") {
        this.finishFocus(now, true);
      } else {
        // 休息到点：回到空闲 focus（桩：autoFocus 自动续跑未实现）
        this.state.timer = {
          ...defaultTimer(this.state.settings),
          cycle: timer.cycle,
          completionSerial: timer.completionSerial,
          lastFinishedMode: timer.lastFinishedMode,
        };
      }
      this.flushNow();
      return;
    }
    timer.remainingSecs = timer.deadline - now;
    this.scheduleStateFlush();
  }

  /** 提醒桩：到点把 reminderFired 写入任务（落进 plan.json），快照据此反映送达状态。 */
  tickReminders(now: number = nowSecs()): void {
    const today = localDate(now);
    let changed = false;
    for (const task of this.plan.tasks) {
      if (task.completed || task.reminderFired || task.reminderTime == null) continue;
      if (task.dueDate > today) continue;
      if (now >= timeToTs(task.dueDate, task.reminderTime)) {
        task.reminderFired = true;
        changed = true;
      }
    }
    if (changed) this.savePlan();
  }

  // ---------- 快照 / 今日 / 统计 ----------

  private refreshTimer(now: number): Timer {
    const timer = { ...this.state.timer };
    if (timer.running && timer.deadline != null) {
      timer.remainingSecs = Math.max(0, timer.deadline - now);
    }
    return timer;
  }

  private kindOf(task: Task): TaskKind {
    return (task.habitId != null || task.recurring) && task.reminderTime != null ? "habit" : "ordinary";
  }

  /** 快照内联计算提醒待触发/已过期，不改写计划文件。 */
  private decorateTask(task: Task, now: number): Task {
    const today = localDate(now);
    const pending =
      !task.completed &&
      task.reminderTime != null &&
      task.dueDate === today &&
      !task.reminderFired &&
      now >= timeToTs(task.dueDate, task.reminderTime);
    const expired = !task.completed && !task.recurring && task.dueDate < today;
    return { ...task, reminderPending: pending, reminderExpired: expired };
  }

  snapshot(now: number = nowSecs()): Snapshot {
    const today = localDate(now);
    const timer = this.refreshTimer(now);
    const remainingSecs = timer.running && timer.deadline != null
      ? Math.max(0, timer.deadline - now)
      : timer.remainingSecs;
    timer.remainingSecs = remainingSecs;
    const tasks = this.plan.tasks.map((t) => this.decorateTask(t, now));
    const taskKinds: Record<string, TaskKind> = {};
    for (const t of this.plan.tasks) taskKinds[t.id] = this.kindOf(t);
    const data: AppData = {
      education: this.state.education,
      identities: this.state.identities,
      version: 0,
      tasks,
      blocks: this.plan.blocks ?? [],
      templates: this.plan.templates ?? [],
      prints: this.plan.prints ?? [],
      projects: this.plan.projects.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        appWhitelist: p.appWhitelist ?? null,
      })),
      habits: this.plan.habits ?? [],
      visions: this.state.visions,
      settings: this.state.settings,
      timer,
      sessions: this.state.sessions,
      lock: this.state.lock,
    };
    return {
      studyProgress: [],
      taskKinds,
      data,
      stats: this.stats(now),
      remainingSecs,
      today,
      serverTime: now,
    };
  }

  today(now: number = nowSecs()): TodayView {
    const today = localDate(now);
    const decorated = this.plan.tasks.map((t) => this.decorateTask(t, now));
    const byTime = (a: Task, b: Task): number =>
      (a.reminderTime ?? "99:99").localeCompare(b.reminderTime ?? "99:99") ||
      b.priority - a.priority ||
      a.createdAt - b.createdAt;
    const tasks = decorated.filter((t) => t.dueDate === today).sort(byTime);
    const overdue = decorated
      .filter((t) => t.dueDate < today && !t.completed)
      .sort(byTime)
      .slice(0, 100);
    const weekday = new Date(now * 1000).getDay();
    const dayNum = weekday === 0 ? 7 : weekday;
    const blocks = (this.plan.blocks ?? []).filter((b) => b.days.includes(dayNum));
    const timer = this.refreshTimer(now);
    const remainingSecs = timer.running && timer.deadline != null
      ? Math.max(0, timer.deadline - now)
      : timer.remainingSecs;
    timer.remainingSecs = remainingSecs;
    const full = this.stats(now);
    const stats: TodayStats = {
      todaySeconds: full.todaySeconds,
      todayPomodoros: full.todayPomodoros,
      todayCompleted: full.todayCompleted,
      streak: full.streak,
    };
    return {
      today,
      serverTime: now,
      tasks,
      overdue,
      blocks,
      timer,
      remainingSecs,
      stats,
      dailyGoal: this.state.settings.dailyGoal,
    };
  }

  stats(now: number = nowSecs()): Stats {
    const today = localDate(now);
    const rows = new Map<string, { seconds: number; pomodoros: number; missed: number; completed: number; voided: number }>();
    for (let i = STATS_DAYS - 1; i >= 0; i--) {
      rows.set(dayShift(today, -i), { seconds: 0, pomodoros: 0, missed: 0, completed: 0, voided: 0 });
    }
    const rowOf = (date: string) => {
      let row = rows.get(date);
      if (!row) {
        row = { seconds: 0, pomodoros: 0, missed: 0, completed: 0, voided: 0 };
        rows.set(date, row);
      }
      return row;
    };
    for (const session of this.state.sessions) {
      const row = rowOf(localDate(session.startedAt));
      row.seconds += session.durationSecs;
      if (session.completed) row.pomodoros += 1;
    }
    for (const task of this.plan.tasks) {
      if (task.completed && task.completedAt != null) {
        rowOf(localDate(task.completedAt)).completed += 1;
      } else if (!task.completed && this.kindOf(task) === "habit" && task.dueDate < today) {
        // 习惯任务漏做计缺勤（桩：只回看统计窗口内的日期）
        rowOf(task.dueDate).missed += 1;
      }
    }
    const days = [...rows.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, row]) => ({ date, ...row }));
    const todayRow = rows.get(today) ?? { seconds: 0, pomodoros: 0, missed: 0, completed: 0, voided: 0 };
    let totalSeconds = 0;
    let totalPomodoros = 0;
    for (const session of this.state.sessions) {
      totalSeconds += session.durationSecs;
      if (session.completed) totalPomodoros += 1;
    }
    const pomodoroDates = new Set(
      this.state.sessions.filter((s) => s.completed).map((s) => localDate(s.startedAt)),
    );
    let streak = 0;
    let cursor = pomodoroDates.has(today) ? today : dayShift(today, -1);
    while (pomodoroDates.has(cursor)) {
      streak += 1;
      cursor = dayShift(cursor, -1);
    }
    return {
      todaySeconds: todayRow.seconds,
      todayPomodoros: todayRow.pomodoros,
      todayCompleted: todayRow.completed,
      totalSeconds,
      totalPomodoros,
      streak,
      days,
    };
  }

  /** MCP get_context：接管入口摘要。 */
  getContext(now: number = nowSecs()) {
    const view = this.today(now);
    return {
      today: view.today,
      serverTime: now,
      stats: view.stats,
      timer: view.timer,
      remainingSecs: view.remainingSecs,
      todayTasks: view.tasks,
      overdueTasks: view.overdue,
      blocks: view.blocks,
      projects: this.plan.projects,
      habits: this.plan.habits ?? [],
      visions: this.state.visions,
      settings: this.state.settings,
      lock: this.state.lock,
    };
  }

  // ---------- dispatch（MCP 单项动作，桩子集） ----------

  dispatch(action: DispatchAction | undefined, now: number = nowSecs()): unknown {
    if (action == null || typeof action !== "object" || typeof action.type !== "string") {
      throw new Error("action 必须带 type");
    }
    switch (action.type) {
      case "focusStart":
        return this.focusStart({ taskId: action.taskId ?? null, minutes: action.minutes ?? null }, now);
      case "focusPause":
        return this.focusPause(now);
      case "focusResume":
        return this.focusResume(now);
      case "focusStop":
        return this.focusStop(now);
      case "focusDiscard":
        return this.focusDiscard();
      case "saveSettings":
        return this.saveSettings(action.settings);
      case "saveVision":
        return this.saveVision({
          id: action.id ?? null,
          name: action.name,
          notes: action.notes ?? "",
          projectId: action.projectId ?? null,
        });
      case "saveBlock":
        return this.saveBlock({
          id: action.id ?? null,
          title: action.title,
          days: action.days,
          start: action.start,
          end: action.end,
          attention: action.attention ?? "required",
          notes: action.notes ?? "",
        });
      case "deleteBlock":
        return this.deleteBlock(action.id);
      case "createProject":
        return this.createProject(action);
      case "deleteTask":
        return this.deleteTask(action.id);
      default:
        throw new Error(`未支持的 action.type（runtime 桩阶段）：${(action as { type: string }).type}`);
    }
  }

  private saveSettings(incoming: Partial<Settings> & { protection?: Partial<Settings["protection"]> }): Settings {
    const next: Settings = { ...this.state.settings, ...incoming };
    if (incoming.protection) {
      next.protection = { ...this.state.settings.protection, ...incoming.protection };
    }
    if (!Number.isInteger(next.focusMinutes) || next.focusMinutes < 1 || next.focusMinutes > 180) {
      throw new Error("focusMinutes 需为 1–180");
    }
    if (!Number.isInteger(next.shortBreakMinutes) || next.shortBreakMinutes < 1 || next.shortBreakMinutes > 60) {
      throw new Error("shortBreakMinutes 需为 1–60");
    }
    if (!Number.isInteger(next.longBreakMinutes) || next.longBreakMinutes < 1 || next.longBreakMinutes > 60) {
      throw new Error("longBreakMinutes 需为 1–60");
    }
    if (!Number.isInteger(next.longBreakEvery) || next.longBreakEvery < 1 || next.longBreakEvery > 12) {
      throw new Error("longBreakEvery 需为 1–12");
    }
    this.state.settings = next;
    // 空闲时同步默认段长
    const timer = this.state.timer;
    if (!timer.running && timer.mode === "focus") {
      const durationSecs = next.focusMinutes * 60;
      timer.durationSecs = durationSecs;
      timer.remainingSecs = durationSecs;
    }
    this.flushNow();
    return next;
  }

  private saveVision(input: { id: string | null; name: string; notes: string; projectId: string | null }): Vision {
    const name = requireText(input.name, "愿景名称", 100);
    const existing = input.id != null ? this.state.visions.find((v) => v.id === input.id) : undefined;
    if (input.id != null && !existing) throw new Error("愿景不存在");
    const vision: Vision = existing
      ? { ...existing, name, notes: input.notes, projectId: input.projectId }
      : { id: randomUUID(), name, notes: input.notes, projectId: input.projectId };
    if (!existing) this.state.visions.push(vision);
    this.flushNow();
    return vision;
  }

  private saveBlock(input: {
    id: string | null;
    title: string;
    days: number[];
    start: string;
    end: string;
    attention: "required" | "light";
    notes: string;
  }): Block {
    const title = requireText(input.title, "时段标题", 40);
    if (!Array.isArray(input.days) || input.days.length === 0 ||
      input.days.some((d) => !Number.isInteger(d) || d < 1 || d > 7) ||
      new Set(input.days).size !== input.days.length) {
      throw new Error("days 需为 1–7 的不重复星期列表");
    }
    if (!validTime(input.start) || !validTime(input.end)) throw new Error("start/end 需为 HH:MM");
    const existing = input.id != null ? (this.plan.blocks ?? []).find((b) => b.id === input.id) : undefined;
    if (input.id != null && !existing) throw new Error("时段不存在");
    const block: Block = existing
      ? { ...existing, title, days: input.days, start: input.start, end: input.end, attention: input.attention, notes: input.notes }
      : { id: randomUUID(), title, days: input.days, start: input.start, end: input.end, attention: input.attention, notes: input.notes };
    if (!existing) {
      this.plan.blocks = [...(this.plan.blocks ?? []), block];
    }
    this.savePlan();
    return block;
  }

  private deleteBlock(id: string): { id: string } {
    const blocks = this.plan.blocks ?? [];
    const index = blocks.findIndex((b) => b.id === id);
    if (index < 0) throw new Error("时段不存在");
    blocks.splice(index, 1);
    this.savePlan();
    return { id };
  }

  private createProject(input: { name: string; color?: string; directory?: string }) {
    const name = requireText(input.name, "项目名称", 100);
    const color = input.color ?? "#d96d55";
    if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color)) {
      throw new Error("color 需为 #RRGGBB");
    }
    // directory（资料目录绑定）桩阶段忽略：授权必须由用户界面完成，不能经 MCP 扩大。
    void input.directory;
    const project = { id: randomUUID(), name, color };
    this.plan.projects.push(project);
    this.savePlan();
    return project;
  }

  // ---------- 导出 ----------

  /** 计划 v6 交换格式：只含未完成任务，剥离进度与提醒送达状态。 */
  exportPlan(): PlanExportFile {
    return {
      format: "tomato-todo-plan",
      version: PLAN_VERSION,
      pomodoroMinutes: this.plan.pomodoroMinutes,
      projects: this.plan.projects,
      tasks: this.plan.tasks
        .filter((t) => !t.completed)
        .map((t) => ({
          id: t.id,
          title: t.title,
          templateId: t.templateId ?? null,
          habitId: t.habitId ?? null,
          recurring: t.recurring,
          notes: t.notes,
          projectId: t.projectId ?? null,
          dueDate: t.dueDate,
          reminderTime: t.reminderTime ?? null,
          focusMinutes: t.focusMinutes ?? null,
          scrapMinutes: t.scrapMinutes,
          priority: t.priority,
          estimate: t.estimate,
          tags: t.tags,
          subtasks: t.subtasks.map((s) => ({ id: s.id, title: s.title })),
        })),
      blocks: this.plan.blocks ?? [],
      templates: this.plan.templates ?? [],
      prints: this.plan.prints ?? [],
      habits: this.plan.habits ?? [],
    };
  }

  exportBackup(now: number = nowSecs()): BackupFile {
    return {
      format: "tomato-todo-backup",
      version: BACKUP_VERSION,
      exportedAt: now,
      plan: this.plan,
      state: this.state,
    };
  }

  /** 导出到私有工作区 dataDir/exports/，返回文件名与 sha256 指纹。 */
  exportToFile(kind: "plan" | "backup", name: string, now: number = nowSecs()): ExportResult {
    if (typeof name !== "string" || name.length === 0 || name.length > 120) {
      throw new Error("文件名无效");
    }
    if (basename(name) !== name || name.includes("/") || name.includes("\\") || !/^[\w.-]+\.json$/.test(name)) {
      throw new Error("仅接受工作区内的 .json 文件名，不接受目录或绝对路径");
    }
    const content = JSON.stringify(kind === "plan" ? this.exportPlan() : this.exportBackup(now), null, 2);
    const file = join(this.dataDir, "exports", name);
    atomicWrite(file, content);
    return {
      name,
      fileHash: createHash("sha256").update(content).digest("hex"),
      bytes: Buffer.byteLength(content),
      asOf: now,
    };
  }

  // ---------- 内部 ----------

  private findTask(id: string): Task {
    if (typeof id !== "string" || id.length === 0) throw new Error("需要任务 ID");
    const task = this.plan.tasks.find((t) => t.id === id);
    if (!task) throw new Error("任务不存在");
    return task;
  }

  private cleanTags(tags: unknown): string[] {
    if (tags === undefined) return [];
    if (!Array.isArray(tags) || tags.some((t) => typeof t !== "string")) {
      throw new Error("tags 需为字符串数组");
    }
    if (tags.length > 20) throw new Error("标签最多 20 个");
    const cleaned = tags.map((t) => t.trim()).filter((t) => t.length > 0);
    if (cleaned.some((t) => t.length > 40)) throw new Error("标签最多 40 字");
    return cleaned;
  }

  private cleanSubtasks(subtasks: unknown): Task["subtasks"] {
    if (subtasks === undefined) return [];
    if (!Array.isArray(subtasks) || subtasks.some((s) => s == null || typeof s.title !== "string" || s.title.trim().length === 0)) {
      throw new Error("subtasks 每项需有非空 title");
    }
    if (subtasks.length > 200) throw new Error("子步骤最多 200 项");
    return subtasks.map((s) => ({
      id: typeof s.id === "string" && s.id.length > 0 ? s.id : randomUUID(),
      title: s.title.trim(),
      done: false,
    }));
  }
}
