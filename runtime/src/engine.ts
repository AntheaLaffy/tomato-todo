// 番茄 Todo runtime 引擎：@tomato/core 的薄适配层。
//
// 数据布局（MIGRATION.md / API.md）：
// - plan.json：计划 v6（tasks 额外携带运行进度字段），域数据唯一来源；
// - state.json：计时/设置/会话/身份/愿景/锁机/教学，每秒可能变动；
// - 两个文件由 data-files.mjs 合并/拆分，Engine.fromData 只负责校验与落盘策略。
//
// 为什么还保留旧方法名（createTask/focusStart/…）：MCP 工具、HTTP 旧写端点与
// 现有测试都按这些方法调用。它们在适配层翻译成 @tomato/core 的 Action，
// 校验、保护规则、身份登记、教学转移全部由 core 执行；适配层不重实现域逻辑。
//
// 两个入口要分清：
// - dispatch()：MCP `dispatch` 工具与旧 runtime Action 名（focusStart…），返回
//   旧形状的实体，保持既有 MCP/端点行为；
// - applyAction()：UI 数据面的 POST /api/dispatch，严格按 core Action union
//   解析并返回 { changed, snapshot }。

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import * as core from "../vendor/core.mjs";
import { atomicWrite, readDataFiles, writeDataFiles } from "./data-files.mjs";
import type {
  Block,
  DispatchAction,
  ExportResult,
  PlanExportFile,
  RuntimeState,
  Session,
  Settings,
  Snapshot,
  Stats,
  Task,
  Timer,
  TodayStats,
  TodayView,
  Vision,
} from "./types.ts";

const PLAN_VERSION = 6 as const;
const BACKUP_VERSION = 4 as const;

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^\d{2}:\d{2}$/;

/** 本机时区日期（YYYY-MM-DD）。 */
export function localDate(ts: number): string {
  return core.dateAt(ts);
}

export function nowSecs(): number {
  return Math.floor(Date.now() / 1000);
}

function clone<T>(value: T): T {
  return core.clone(value) as T;
}

/** 旧 runtime Action 名：MCP dispatch 工具的历史入口，翻译成 core Action/方法。 */
const LEGACY_ACTIONS = new Set([
  "focusStart",
  "focusPause",
  "focusResume",
  "focusStop",
  "focusDiscard",
  "saveSettings",
  "saveVision",
  "saveBlock",
  "deleteBlock",
  "createProject",
  "deleteTask",
]);

/** Task → TaskDraft（saveTask 需要的草稿形状，保留子步骤完成状态）。 */
function draftOf(task, overrides: Record<string, unknown> = {}) {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    projectId: task.projectId,
    dueDate: task.dueDate,
    reminderTime: task.reminderTime,
    focusMinutes: task.focusMinutes,
    scrapMinutes: task.scrapMinutes,
    priority: task.priority,
    estimate: task.estimate,
    tags: [...task.tags],
    subtasks: task.subtasks.map((s) => ({
      id: s.id,
      title: s.title,
      done: s.done,
    })),
    repeat: "none",
    ...overrides,
  };
}

function draftFromInput(input: Record<string, unknown>) {
  const subtasks = Array.isArray(input.subtasks)
    ? input.subtasks.map((s) => {
        if (
          typeof s !== "object" ||
          s === null ||
          typeof s.title !== "string"
        ) {
          throw new core.AppError("子任务每项需有非空 title");
        }
        return {
          id: typeof s.id === "string" && s.id.length > 0 ? s.id : core.id(),
          title: s.title,
          done: s.done === true,
        };
      })
    : [];
  const draft: Record<string, unknown> = {
    id: null,
    title: input.title,
    notes: input.notes ?? "",
    projectId: input.projectId ?? null,
    dueDate: input.dueDate ?? null,
    reminderTime: input.reminderTime ?? null,
    focusMinutes: input.focusMinutes ?? null,
    scrapMinutes: input.scrapMinutes ?? 0,
    priority: input.priority ?? 0,
    estimate: input.estimate ?? 1,
    tags: input.tags ?? [],
    subtasks,
    repeat: input.repeat ?? "none",
  };
  if (input.habitId != null) {
    // core 的 saveTask 不接收 habitId（习惯归属由 saveHabit/template 维护），
    // 旧 runtime 的 createTask(habitId) 没有等价动作，明确拒绝而不是悄悄丢失。
    throw new core.AppError(
      "新任务不能直接指定习惯组，请在习惯页建立习惯；或先建任务再编辑",
    );
  }
  return draft;
}

function weekdayMonday(now: number): number {
  const day = new Date(now * 1000).getDay();
  return day === 0 ? 7 : day;
}

export class Engine {
  readonly dataDir: string;
  private engine: core.Engine;

  private constructor(dataDir: string, engine: core.Engine) {
    this.dataDir = dataDir;
    this.engine = engine;
  }

  /** 打开（或初始化）数据目录并加载 plan.json + state.json。 */
  static open(dataDir: string, now: number = nowSecs()): Engine {
    mkdirSync(dataDir, { recursive: true });
    const { data } = readDataFiles(dataDir, now);
    const engine = core.Engine.fromData(data, (next) =>
      writeDataFiles(dataDir, next),
    );
    const adapter = new Engine(dataDir, engine);
    // 重启恢复与提醒/定型任务推进都在 core.tick 里；打开时就结算一次。
    adapter.tick(now);
    return adapter;
  }

  /** 当前 AppData（只读视图；修改必须走 dispatch/applyAction）。 */
  get data() {
    return this.engine.data;
  }

  get settings(): Settings {
    return this.engine.data.settings as unknown as Settings;
  }

  get timer(): Timer {
    return clone(this.engine.data.timer) as unknown as Timer;
  }

  /** 把运行中计时器的 remainingSecs 同步到「此刻」：core 快照按 deadline 现算，
   *  但旧端点/测试直接读 timer.remainingSecs。只改内存视图，权威仍是 deadline。 */
  private syncRemaining(now: number): void {
    const timer = this.engine.data.timer;
    const remaining = core.timerRemaining(timer, now);
    if (timer.remainingSecs !== remaining) timer.remainingSecs = remaining;
  }

  /** 每次写已原子落盘；保留方法以兼容 main 的关停流程。 */
  flushNow(): void {
    writeDataFiles(this.dataDir, this.engine.data);
  }

  // ---------- tick / 快照 ----------

  /** 每秒 tick：计时到点、提醒送达、自动开工、锁机时段都在 core.tick 内。 */
  tick(now: number = nowSecs()): void {
    this.engine.tick(now);
    this.syncRemaining(now);
  }

  /** 兼容旧入口：core.tick 已包含提醒推进。 */
  tickReminders(now: number = nowSecs()): void {
    this.tick(now);
  }

  snapshot(now: number = nowSecs()): Snapshot {
    const snapshot = this.engine.snapshot(now) as unknown as Snapshot;
    this.syncRemaining(now);
    return snapshot;
  }

  /** UI 数据面：全量快照 + 学情摘要（education 与 studyProgress 同源）。 */
  state(now: number = nowSecs()) {
    const snapshot = this.engine.snapshot(now);
    return {
      ...snapshot,
      education: snapshot.studyProgress,
    };
  }

  stats(now: number = nowSecs()): Stats {
    return this.engine.snapshot(now).stats as unknown as Stats;
  }

  today(now: number = nowSecs()): TodayView {
    const snapshot = this.engine.snapshot(now);
    const data = snapshot.data;
    const today = snapshot.today;
    const byTime = (a: Task, b: Task): number =>
      (a.reminderTime ?? "99:99").localeCompare(b.reminderTime ?? "99:99") ||
      b.priority - a.priority ||
      a.createdAt - b.createdAt;
    const tasks = (data.tasks as unknown as Task[])
      .filter((t) => t.dueDate === today)
      .sort(byTime);
    const overdue = (data.tasks as unknown as Task[])
      .filter((t) => t.dueDate !== null && t.dueDate < today && !t.completed)
      .sort(byTime)
      .slice(0, 100);
    const day = weekdayMonday(now);
    const blocks = (data.blocks as unknown as Block[]).filter((b) =>
      b.days.includes(day),
    );
    const timer = clone(snapshot.data.timer) as unknown as Timer;
    timer.remainingSecs = snapshot.remainingSecs;
    const stats = snapshot.stats;
    const todayStats: TodayStats = {
      todaySeconds: stats.todaySeconds,
      todayPomodoros: stats.todayPomodoros,
      todayCompleted: stats.todayCompleted,
      streak: stats.streak,
    };
    return {
      today,
      serverTime: now,
      tasks,
      overdue,
      blocks,
      timer,
      remainingSecs: snapshot.remainingSecs,
      stats: todayStats,
      dailyGoal: data.settings.dailyGoal,
    };
  }

  // ---------- 任务增删改查 ----------

  createTask(input: Record<string, unknown>, now: number = nowSecs()): Task {
    const draft = draftFromInput(input);
    const before = new Set(this.engine.data.tasks.map((t) => t.id));
    this.engine.dispatch({ type: "saveTask", task: draft } as never, now);
    const created = this.engine.data.tasks.find((t) => !before.has(t.id));
    if (created === undefined) throw new core.AppError("任务创建失败");
    return clone(created) as unknown as Task;
  }

  updateTask(
    id: string,
    changes: Record<string, unknown>,
    now: number = nowSecs(),
  ): Task {
    const task = this.findTask(id);
    const allowed = [
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
      "habitId",
    ];
    for (const key of Object.keys(changes)) {
      if (!allowed.includes(key)) {
        throw new core.AppError(`不允许修改字段：${key}`);
      }
    }
    if (changes.habitId !== undefined) {
      // 习惯归属属于模板/习惯页；沿用旧值而不是静默改写冻结来源。
      if (changes.habitId !== task.habitId) {
        throw new core.AppError("习惯归属请通过习惯页或模板调整");
      }
    }
    const overrides: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key === "habitId") continue;
      if (changes[key] !== undefined) overrides[key] = changes[key];
    }
    if (overrides.subtasks !== undefined) {
      overrides.subtasks = (
        overrides.subtasks as { id?: string; title: string }[]
      ).map((s) => ({
        id: typeof s.id === "string" && s.id.length > 0 ? s.id : core.id(),
        title: s.title,
        done: false,
      }));
    }
    this.engine.dispatch(
      { type: "saveTask", task: draftOf(task, overrides) } as never,
      now,
    );
    return clone(this.findTask(id)) as unknown as Task;
  }

  moveTasks(
    ids: string[],
    dueDate: string,
    reminderTime?: string | null,
  ): Task[] {
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100) {
      throw new core.AppError("ids 需为 1–100 个任务 ID");
    }
    if (!core.validDate(dueDate)) {
      throw new core.AppError("dueDate 必须是有效日期 YYYY-MM-DD");
    }
    if (
      reminderTime !== undefined &&
      reminderTime !== null &&
      !core.validTime(reminderTime)
    ) {
      throw new core.AppError("reminderTime 必须是 HH:MM");
    }
    // 先整批预检，再逐条提交：已完成任务让整批拒绝（保持旧端点语义）。
    const tasks = ids.map((id) => this.findTask(id));
    if (tasks.some((t) => t.completed)) {
      throw new core.AppError("包含已完成任务，整批不移动");
    }
    const now = nowSecs();
    for (const task of tasks) {
      const overrides: Record<string, unknown> = { dueDate };
      if (reminderTime !== undefined) overrides.reminderTime = reminderTime;
      this.engine.dispatch(
        { type: "saveTask", task: draftOf(task, overrides) } as never,
        now,
      );
    }
    return ids.map((id) => clone(this.findTask(id)) as unknown as Task);
  }

  completeTask(id: string, now: number = nowSecs()): Task {
    const task = this.findTask(id);
    if (task.completed) {
      throw new core.AppError("任务已完成，不能反复切换");
    }
    this.engine.dispatch({ type: "toggleTask", id }, now);
    return clone(this.findTask(id)) as unknown as Task;
  }

  deleteTask(id: string): { id: string } {
    this.findTask(id);
    this.engine.dispatch({ type: "deleteTask", id }, nowSecs());
    return { id };
  }

  listTasks(
    filter: {
      projectId?: string | null;
      completed?: boolean;
      offset?: number;
      limit?: number;
    } = {},
  ): { tasks: Task[]; total: number; offset: number; limit: number } {
    const offset = filter.offset ?? 0;
    const limit = Math.min(100, Math.max(1, filter.limit ?? 100));
    let tasks = (this.engine.data.tasks as unknown as Task[]).slice();
    if (filter.projectId !== undefined) {
      tasks = tasks.filter((t) => t.projectId === filter.projectId);
    }
    if (filter.completed !== undefined) {
      tasks = tasks.filter((t) => t.completed === filter.completed);
    }
    tasks.sort(
      (a, b) =>
        (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
        b.priority - a.priority ||
        a.createdAt - b.createdAt,
    );
    const total = tasks.length;
    return { tasks: tasks.slice(offset, offset + limit), total, offset, limit };
  }

  // ---------- 番茄计时（旧方法名 → core Action） ----------

  focusStart(
    options: { taskId?: string | null; minutes?: number | null } = {},
    now: number = nowSecs(),
  ): Timer {
    const timer = this.engine.data.timer;
    if (timer.running && timer.mode === "focus") {
      throw new core.AppError("已有进行中的番茄，先停止或放弃");
    }
    if (timer.mode !== "focus") {
      this.engine.dispatch({ type: "setMode", mode: "focus" } as never, now);
    } else if (!timer.running && timer.startedAt !== null) {
      // 暂停中的专注段：旧语义是直接重开一个新番茄，先结清旧段（只累计用时）。
      this.engine.dispatch({ type: "resetTimer" }, now);
    }
    const taskId = options.taskId ?? null;
    if (taskId !== null) {
      this.engine.dispatch({ type: "selectTask", id: taskId } as never, now);
    } else if (this.engine.data.timer.taskId !== null) {
      this.engine.dispatch({ type: "selectTask", id: null } as never, now);
    }
    const minutes = options.minutes ?? null;
    if (minutes !== null) {
      if (
        !Number.isInteger(minutes) ||
        (minutes as number) < 1 ||
        (minutes as number) > 180
      ) {
        throw new core.AppError("单次时长需为 1–180 分钟");
      }
    }
    this.engine.dispatch({ type: "startTimer", minutes } as never, now);
    return clone(this.engine.data.timer) as unknown as Timer;
  }

  focusPause(now: number = nowSecs()): Timer {
    const timer = this.engine.data.timer;
    if (!timer.running || timer.mode !== "focus") {
      throw new core.AppError("没有进行中的番茄");
    }
    this.engine.dispatch({ type: "pauseTimer" }, now);
    return clone(this.engine.data.timer) as unknown as Timer;
  }

  focusResume(now: number = nowSecs()): Timer {
    const timer = this.engine.data.timer;
    if (timer.running) throw new core.AppError("番茄已在运行");
    if (timer.mode !== "focus" || timer.startedAt === null) {
      throw new core.AppError("没有可继续的番茄");
    }
    if (core.timerRemaining(timer, now) <= 0) {
      throw new core.AppError("番茄已结束，先停止");
    }
    this.engine.dispatch({ type: "startTimer" }, now);
    return clone(this.engine.data.timer) as unknown as Timer;
  }

  focusStop(now: number = nowSecs()): {
    timer: Timer;
    session: Session | null;
  } {
    const timer = this.engine.data.timer;
    if (timer.mode !== "focus" || timer.startedAt === null) {
      throw new core.AppError("没有进行中的番茄");
    }
    const remaining = core.timerRemaining(timer, now);
    this.engine.dispatch(
      { type: remaining <= 0 ? "completeFocus" : "resetTimer" } as never,
      now,
    );
    const last =
      this.engine.data.sessions[this.engine.data.sessions.length - 1];
    const session =
      last !== undefined && last.endedAt === now && last.source === "timer"
        ? (clone(last) as unknown as Session)
        : null;
    return {
      timer: clone(this.engine.data.timer) as unknown as Timer,
      session,
    };
  }

  focusDiscard(): Timer {
    // 旧 runtime 语义：放弃当前番茄，不写专注记录；保护生效时由 core 拒绝。
    this.engine.discardTimer();
    return clone(this.engine.data.timer) as unknown as Timer;
  }

  // ---------- dispatch：MCP 工具与旧 Action 名 ----------

  dispatch(
    action: DispatchAction | undefined,
    now: number = nowSecs(),
  ): unknown {
    if (
      action == null ||
      typeof action !== "object" ||
      typeof (action as { type?: unknown }).type !== "string"
    ) {
      throw new core.AppError("action 必须带 type");
    }
    const type = (action as { type: string }).type;
    if (LEGACY_ACTIONS.has(type)) {
      return this.legacyDispatch(action as Record<string, unknown>, now);
    }
    const parsed = core.parseAction(action);
    const before = JSON.stringify(core.serializeAppData(this.engine.data));
    this.engine.dispatch(parsed, now);
    const snapshot = this.engine.snapshot(now);
    // MCP 工具结果是对话文本，不回传整份快照（导入后可达数 MB）。
    return {
      changed:
        before !== JSON.stringify(core.serializeAppData(this.engine.data)),
      today: snapshot.today,
      serverTime: snapshot.serverTime,
      remainingSecs: snapshot.remainingSecs,
      stats: snapshot.stats,
    };
  }

  /**
   * UI 数据面：严格解析 core Action，写完返回 { changed, snapshot }。
   * 校验/保护规则都在 core；这里只负责判断是否真的改了数据。
   */
  applyAction(
    action: unknown,
    now: number = nowSecs(),
  ): { changed: boolean; snapshot: ReturnType<Engine["state"]> } {
    const parsed = core.parseAction(action);
    const before = JSON.stringify(core.serializeAppData(this.engine.data));
    this.engine.dispatch(parsed, now);
    const afterData = this.engine.data;
    const changed = before !== JSON.stringify(core.serializeAppData(afterData));
    return { changed, snapshot: this.state(now) };
  }

  private legacyDispatch(
    action: Record<string, unknown>,
    now: number,
  ): unknown {
    switch (action.type) {
      case "focusStart":
        return this.focusStart(
          {
            taskId: (action.taskId as string | null | undefined) ?? null,
            minutes: (action.minutes as number | null | undefined) ?? null,
          },
          now,
        );
      case "focusPause":
        return this.focusPause(now);
      case "focusResume":
        return this.focusResume(now);
      case "focusStop":
        return this.focusStop(now);
      case "focusDiscard":
        return this.focusDiscard(now);
      case "saveSettings":
        return this.saveSettingsLegacy(
          (action.settings ?? {}) as Record<string, unknown>,
          now,
        );
      case "saveVision":
        return this.saveVisionLegacy(action, now);
      case "saveBlock":
        return this.saveBlockLegacy(action, now);
      case "deleteBlock":
        this.engine.dispatch(
          { type: "deleteBlock", id: action.id as string } as never,
          now,
        );
        return { id: action.id };
      case "deleteTask":
        return this.deleteTask(action.id as string);
      case "createProject":
        throw new core.AppError(
          "新项目必须绑定资料目录；请用 saveProject Action 并在项目页授权目录",
        );
      default:
        throw new core.AppError(`未支持的 action.type：${String(action.type)}`);
    }
  }

  private saveSettingsLegacy(
    incoming: Record<string, unknown>,
    now: number,
  ): Settings {
    const merged = {
      ...this.engine.data.settings,
      ...incoming,
      protection: {
        ...this.engine.data.settings.protection,
        ...((incoming.protection ?? {}) as Record<string, unknown>),
      },
    };
    const settings = core.parseSettings(merged);
    this.engine.dispatch({ type: "saveSettings", settings } as never, now);
    return clone(this.engine.data.settings) as unknown as Settings;
  }

  private saveVisionLegacy(
    action: Record<string, unknown>,
    now: number,
  ): Vision {
    const id = (action.id as string | null | undefined) ?? null;
    const incoming = {
      id,
      name: action.name,
      notes: action.notes ?? "",
      projectId: action.projectId ?? null,
    } as never;
    this.engine.dispatch({ type: "saveVision", ...incoming }, now);
    const data = this.engine.data;
    const vision =
      id !== null
        ? data.visions.find((v) => v.id === id)
        : data.visions[data.visions.length - 1];
    if (vision === undefined) throw new core.AppError("愿景保存失败");
    return clone(vision) as unknown as Vision;
  }

  private saveBlockLegacy(action: Record<string, unknown>, now: number): Block {
    const id = (action.id as string | null | undefined) ?? null;
    this.engine.dispatch(
      {
        type: "saveBlock",
        id,
        title: action.title,
        days: action.days,
        start: action.start,
        end: action.end,
        attention: action.attention ?? "required",
        notes: action.notes ?? "",
      } as never,
      now,
    );
    const data = this.engine.data;
    const block =
      id !== null
        ? data.blocks.find((b) => b.id === id)
        : data.blocks[data.blocks.length - 1];
    if (block === undefined) throw new core.AppError("时段保存失败");
    return clone(block) as unknown as Block;
  }

  // ---------- MCP get_context ----------

  getContext(now: number = nowSecs()) {
    const snapshot = this.engine.snapshot(now);
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
      projects: snapshot.data.projects,
      habits: snapshot.data.habits,
      visions: snapshot.data.visions,
      settings: snapshot.data.settings,
      lock: snapshot.data.lock,
      studyProgress: snapshot.studyProgress,
      education: snapshot.studyProgress,
      anomalies: core.diagnose(snapshot, null),
    };
  }

  // ---------- 导出 ----------

  /** 计划 v6 交换格式（不含完成进度/历史/计时器/本机设置）。 */
  exportPlan(now: number = nowSecs()): PlanExportFile {
    this.engine.snapshot(now);
    return core.exportPlan(this.engine.data) as unknown as PlanExportFile;
  }

  /** 完整备份 v4 数据（无 format 包装，与 docs/BACKUP_FORMAT.md 一致）。 */
  exportBackup(
    now: number = nowSecs(),
  ): RuntimeState | Record<string, unknown> {
    this.engine.snapshot(now);
    return core.serializeAppData(this.engine.data);
  }

  /** 导出到私有工作区 dataDir/exports/，返回文件名与 sha256 指纹。 */
  exportToFile(
    kind: "plan" | "backup",
    name: string,
    now: number = nowSecs(),
  ): ExportResult {
    if (typeof name !== "string" || name.length === 0 || name.length > 120) {
      throw new core.AppError("文件名无效");
    }
    if (
      basename(name) !== name ||
      name.includes("/") ||
      name.includes("\\") ||
      !/^[\w.-]+\.json$/.test(name)
    ) {
      throw new core.AppError(
        "仅接受工作区内的 .json 文件名，不接受目录或绝对路径",
      );
    }
    const content = JSON.stringify(
      kind === "plan" ? this.exportPlan(now) : this.exportBackup(now),
      null,
      2,
    );
    const file = join(this.dataDir, "exports", name);
    atomicWrite(file, content);
    return {
      name,
      fileHash: createHash("sha256").update(content).digest("hex"),
      bytes: Buffer.byteLength(content),
      asOf: now,
    };
  }

  // ---------- 教学与批量导入 ----------

  /** MCP `education`：教学命令走 core，助手进度来源强制 assistant。 */
  education(command: unknown, now: number = nowSecs()) {
    if (
      command != null &&
      typeof command === "object" &&
      (command as { op?: unknown }).op === "recordProgress" &&
      (command as { record?: unknown }).record != null &&
      typeof (command as { record: unknown }).record === "object"
    ) {
      const record = (
        command as { record: { source?: unknown; confirmed?: unknown } }
      ).record;
      record.source = "assistant";
      record.confirmed = false;
    }
    return this.dispatch({ type: "education", command } as never, now);
  }

  /** MCP `get_education`：按集合/项目/记录分页读教学记录。 */
  getEducation(args: Record<string, unknown> = {}, now: number = nowSecs()) {
    const collection = args.collection;
    if (
      typeof collection !== "string" ||
      collection.length === 0 ||
      collection.length > 40
    ) {
      throw new core.AppError("collection 需为教学记录集合名");
    }
    const education = this.engine.data.education;
    const rows = (education as unknown as Record<string, unknown>)[collection];
    if (!Array.isArray(rows)) {
      throw new core.AppError("未知教学记录集合");
    }
    const projectOf = (row: Record<string, unknown>): string | null => {
      if (typeof row.projectId === "string") return row.projectId;
      let assessmentId =
        typeof row.assessmentId === "string" ? row.assessmentId : null;
      const submissionId =
        typeof row.submissionId === "string" ? row.submissionId : null;
      if (assessmentId === null && submissionId !== null) {
        const sub = education.submissions.find((s) => s.id === submissionId);
        if (sub !== undefined) assessmentId = sub.assessmentId;
      }
      if (assessmentId === null && typeof row.gradeId === "string") {
        const grade = education.grades.find((g) => g.id === row.gradeId);
        if (grade !== undefined) {
          const sub = education.submissions.find(
            (s) => s.id === grade.submissionId,
          );
          if (sub !== undefined) assessmentId = sub.assessmentId;
        }
      }
      if (assessmentId !== null) {
        const a = education.assessments.find((x) => x.id === assessmentId);
        if (a !== undefined) return a.projectId;
      }
      if (typeof row.taskId === "string") {
        const task = this.engine.data.tasks.find((t) => t.id === row.taskId);
        if (task !== undefined) return task.projectId;
      }
      return null;
    };
    const id =
      typeof args.id === "string" && args.id.length > 0 ? args.id : null;
    const projectId =
      typeof args.projectId === "string" && args.projectId.length > 0
        ? args.projectId
        : null;
    const filtered = rows.filter((row) => {
      const r = row as Record<string, unknown>;
      return (
        (id === null || r.id === id || r.taskId === id) &&
        (projectId === null || projectOf(r) === projectId)
      );
    });
    const offset = Number.isInteger(args.offset) ? (args.offset as number) : 0;
    const limit = Math.min(
      100,
      Math.max(1, typeof args.limit === "number" ? args.limit : 30),
    );
    return {
      collection,
      asOf: now,
      total: filtered.length,
      offset,
      records: filtered.slice(offset, offset + limit),
    };
  }

  /** MCP `get_study_progress`：按科目读学情摘要与分页进度历史。 */
  getStudyProgress(
    args: Record<string, unknown> = {},
    now: number = nowSecs(),
  ) {
    const snapshot = this.engine.snapshot(now);
    const summaries = (snapshot.studyProgress ?? []) as Record<
      string,
      unknown
    >[];
    const projectId =
      typeof args.projectId === "string" && args.projectId.length > 0
        ? args.projectId
        : null;
    const projects =
      projectId === null
        ? summaries
        : summaries.filter((s) => s.projectId === projectId);
    const all = this.engine.data.education.progress
      .filter((p) => projectId === null || p.projectId === projectId)
      .slice()
      .sort((a, b) => b.recordedAt - a.recordedAt);
    const offset = Number.isInteger(args.offset) ? (args.offset as number) : 0;
    const limit = Math.min(
      100,
      Math.max(1, typeof args.limit === "number" ? args.limit : 100),
    );
    return {
      asOf: now,
      projects,
      progress: all.slice(offset, offset + limit),
      total: all.length,
      offset,
      limit,
      note: "计时与任务完成只说明投入或自报完成；掌握须查看答卷、批改与独立复测。空记录表示未知。",
    };
  }

  /** MCP `get_tasks`：按项目/完成状态分页读任务。 */
  getTasks(args: Record<string, unknown> = {}) {
    const filter: {
      projectId?: string | null;
      completed?: boolean;
      offset?: number;
      limit?: number;
    } = {
      offset: Number.isInteger(args.offset) ? (args.offset as number) : 0,
      limit: args.limit,
    };
    if (typeof args.projectId === "string" && args.projectId.length > 0) {
      filter.projectId = args.projectId;
    }
    if (typeof args.completed === "boolean") {
      filter.completed = args.completed;
    }
    return this.listTasks(filter);
  }

  /** MCP `apply_file`：读导出文件、校验哈希，导入计划 v6 / 备份 v4。 */
  applyFile(name: string, fileHash: string, now: number = nowSecs()) {
    if (
      typeof name !== "string" ||
      name.length === 0 ||
      basename(name) !== name ||
      name.includes("/") ||
      name.includes("\\") ||
      !/^[\w.-]+\.json$/.test(name)
    ) {
      throw new core.AppError("仅接受工作区内的 .json 文件名");
    }
    if (typeof fileHash !== "string" || fileHash.length === 0) {
      throw new core.AppError("需要 fileHash");
    }
    const file = join(this.dataDir, "exports", name);
    if (!existsSync(file)) {
      throw new core.AppError("导出文件不存在，请先 export_plan/export_backup");
    }
    const content = readFileSync(file, "utf8");
    const actual = createHash("sha256").update(content).digest("hex");
    if (actual !== fileHash) {
      throw new core.AppError("文件哈希不匹配，请重新导出后再应用");
    }
    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch {
      throw new core.AppError("导出文件不是合法 JSON");
    }
    let action: { type: string };
    if (
      raw != null &&
      typeof raw === "object" &&
      (raw as { format?: unknown }).format === "tomato-todo-plan" &&
      (raw as { version?: unknown }).version === 6
    ) {
      action = { type: "importPlan", plan: raw } as never;
    } else if (
      raw != null &&
      typeof raw === "object" &&
      (raw as { version?: unknown }).version === 4 &&
      Array.isArray((raw as { tasks?: unknown }).tasks)
    ) {
      action = { type: "import", data: raw } as never;
    } else {
      throw new core.AppError("无法识别的导出文件格式（需计划 v6 或备份 v4）");
    }
    this.dispatch(action, now);
    return { applied: true, name, today: this.today(now).today };
  }

  // ---------- 内部 ----------

  private findTask(id: string): Task {
    if (typeof id !== "string" || id.length === 0) {
      throw new core.AppError("需要任务 ID");
    }
    const task = this.engine.data.tasks.find((t) => t.id === id);
    if (task === undefined) throw new core.AppError("任务不存在");
    return task as unknown as Task;
  }
}
