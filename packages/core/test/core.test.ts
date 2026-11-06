//! crates/core/src/tests.rs 的 74 条测试 → vitest 逐条移植（@tomato/core）。
//!
//! 语义基准：docs/HANDBOOK/ 与 docs/DESIGN.md；外部 JSON 形状 camelCase，
//! 日期 "YYYY-MM-DD"、时间 "HH:MM"、时间戳 Unix 秒（本机时区，friday() 以
//! 2026-10-09 周五为锚点，对应 Rust `Local.with_ymd_and_hms(2026,10,9,…)`）。
//! 错误文案逐字断言（AppError.message == Rust 的中文文案）。
//!
//! ─────────────────────────────────────────────────────────────────────────
//! 发现的分歧（src 实现与 Rust 语义不符，测试按 src 现状书写、未改源码）
//!
//! 1. parseAppData 不在 AppData 顶层拒绝未知字段：Rust `AppData` 带
//!    `#[serde(deny_unknown_fields)]`，含顶层 goals/nodeBindings 等键的 v3
//!    交换文件在解析期即报错；TS 顶层宽容，仅靠嵌套类型各自拒绝。
//!    测试 69 的 legacy JSON 同时给 tasks[0] 挂了 goalId/nodeId（被
//!    parseTask 拒绝），因此该测试两种实现都报错、可观察行为一致；
//!    但「仅顶层多出 goals、任务本身干净」的输入 Rust 拒绝而 TS 接受。
//! 2. parseLockState 不能解析自身序列化产出的 `"active": null`：Rust
//!    `Option<ActiveLock>` 对 null 原生往返；TS 的 `field` 把 null 当作
//!    「存在」交给 parseActiveLock 并抛「锁机状态必须是对象」。后果：
//!    任何 export → parseAppData 往返、以及 Engine.open 重开任何无活动锁机
//!    的持久化文件都会失败。测试用 parseBackup/reopen 两个本地助手绕开
//!    （先把 null 的 active 键去掉，语义不变）；源码未改。
//! ─────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AppData,
  Engine,
  atLocal,
  dateAt,
  defaultSettings,
  diagnose,
  id,
  now,
  parseAction,
  parseAppData,
  parseEducation,
  parsePlanFile,
  parseTask,
  serializeAppData,
  serializePlanFile,
  serializeTimer,
  timerRemaining,
  validatePlanFile,
} from "../src/index";
import type {
  Action,
  GuardMode,
  HabitSlot,
  LockSchedule,
  Mode,
  PlanFile,
  Settings,
  TaskDraft,
} from "../src/index";

// ---------- 夹具与工具 ----------

const TEST_ROOT = mkdtempSync(join(tmpdir(), "tomato-core-"));

function tempPath(name: string): string {
  return join(TEST_ROOT, name);
}

/** 2026-10-09 是周五：所有「本地周历」测试的锚点。 */
function friday(hour: number, minute: number): number {
  return atLocal(2026, 10, 9, hour, minute);
}

function engine(): Engine {
  return Engine.open(":memory:");
}

function draft(): TaskDraft {
  return {
    id: null,
    title: "测试任务",
    notes: "",
    projectId: null,
    dueDate: "2026-10-09",
    reminderTime: null,
    focusMinutes: null,
    scrapMinutes: 0,
    priority: 2,
    estimate: 2,
    tags: [],
    subtasks: [],
    repeat: "none",
  };
}

function sleepSchedule(strict: boolean): LockSchedule {
  return {
    id: "sleep",
    name: "睡眠",
    start: "23:00",
    end: "07:00",
    days: [5],
    enabled: true,
    strict,
  };
}

const EXAMPLE_PLAN_RAW = readFileSync(
  fileURLToPath(new URL("../../../docs/plan.example.json", import.meta.url)),
  "utf8",
);
const EXAMPLE_BACKUP_RAW = readFileSync(
  fileURLToPath(new URL("../../../docs/backup.example.json", import.meta.url)),
  "utf8",
);

function examplePlan(): PlanFile {
  return parsePlanFile(JSON.parse(EXAMPLE_PLAN_RAW));
}

function completeFocusSessions(e: Engine, at: number, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const start = at + i * 2000;
    e.dispatch({ type: "setMode", mode: "focus" }, start);
    e.dispatch({ type: "startTimer" }, start);
    e.snapshot(start + 1500);
  }
}

function projectWhitelist(e: Engine, id: string): string[] | null {
  return e.snapshot(1000).data.projects.find((p) => p.id === id)!.appWhitelist;
}

/** 见文件头分歧 #2：序列化的 `"active": null` 会让 parseLockState 报错，先去掉该键。 */
function stripNullActive(value: Record<string, unknown>): Record<string, unknown> {
  const lock = value["lock"] as Record<string, unknown> | undefined;
  if (lock !== undefined && lock["active"] === null) {
    delete lock["active"];
  }
  return value;
}

/** export 字符串 / 备份 JSON → AppData（绕开分歧 #2，语义不变）。 */
function parseBackup(raw: string | Record<string, unknown>): AppData {
  const value = typeof raw === "string" ? (JSON.parse(raw) as Record<string, unknown>) : raw;
  return parseAppData(stripNullActive(value));
}

/** 重开被持久化的引擎（绕开分歧 #2，语义不变）。 */
function reopen(path: string): Engine {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  writeFileSync(path, JSON.stringify(stripNullActive(raw)), "utf8");
  return Engine.open(path);
}

// ---------- 测试（顺序与 tests.rs 一致） ----------

describe("crates/core/src/tests.rs 移植", () => {
  it("persona_backdrop_defaults_off_and_survives_backup_and_restart", () => {
    const oldRaw = serializeAppData(new AppData());
    const oldSettings = oldRaw["settings"] as Record<string, unknown>;
    delete oldSettings["personaBackdrop"];
    const old = parseBackup(oldRaw);
    expect(old.settings.personaBackdrop).toBe(false);

    const path = tempPath("backdrop.json");
    const e = Engine.open(path);
    let settings = e.snapshot(1000).data.settings;
    expect(settings.personaBackdrop).toBe(false);
    settings.personaBackdrop = true;
    settings.focusMinutes = 31;
    e.dispatch({ type: "saveSettings", settings }, 1000);
    const backup = parseBackup(e.export(1000));
    expect(backup.settings.personaBackdrop).toBe(true);

    const reopened = reopen(path);
    const saved = reopened.snapshot(1000).data.settings;
    expect(saved.personaBackdrop).toBe(true);
    expect(saved.focusMinutes).toBe(31);
  });

  it("sound_volume_defaults_for_old_backups_and_round_trips_with_range_validation", () => {
    const oldRaw = serializeAppData(new AppData());
    const oldSettings = oldRaw["settings"] as Record<string, unknown>;
    delete oldSettings["soundVolume"];
    const data = parseBackup(oldRaw);
    expect(data.settings.soundVolume).toBe(100);

    const e = engine();
    for (const level of [0, 65, 100]) {
      const settings: Settings = { ...defaultSettings(), soundVolume: level };
      e.dispatch({ type: "saveSettings", settings }, 1000);
      const exported = parseBackup(e.export(1000));
      expect(exported.settings.soundVolume).toBe(level);
    }
    const bad: Settings = { ...defaultSettings(), soundVolume: 101 };
    expect(() => e.dispatch({ type: "saveSettings", settings: bad }, 1000)).toThrow();
    expect(e.snapshot(1000).data.settings.soundVolume).toBe(100);
  });

  it("documented_backup_example_loads_and_round_trips_new_lock_fields", () => {
    const data = parseBackup(JSON.parse(EXAMPLE_BACKUP_RAW));
    data.validate();
    const e = engine();
    const s = e.dispatch({ type: "import", data }, 1000);
    expect(s.data.lock.schedules[0]!.strict).toBe(true);
    expect(s.data.lock.schedules[0]!.enabled).toBe(false);
    const exported = parseBackup(e.export(1000));
    expect(exported.lock.schedules[0]!.start).toBe("23:00");
    expect(exported.settings.protection.strict).toBe(false);
  });

  it("strict_focus_rejects_every_early_exit_in_both_modes_and_recovers_at_deadline", () => {
    for (const mode of ["lock", "whitelist"] as GuardMode[]) {
      const e = engine();
      const settings: Settings = {
        ...defaultSettings(),
        protection: { mode, strict: true, whitelist: ["editor"] },
      };
      e.dispatch({ type: "saveSettings", settings }, 1000);
      e.dispatch({ type: "startTimer" }, 1000);
      const actions: Action[] = [
        { type: "emergencyUnlock" },
        { type: "completeFocus" },
        { type: "pauseTimer" },
        { type: "resetTimer" },
        { type: "skipTimer" },
        { type: "saveSettings", settings: defaultSettings() },
        { type: "import", data: new AppData() },
        { type: "startQuickLock", minutes: 1, strict: false },
      ];
      for (const action of actions) {
        expect(() => e.dispatch(action, 1100)).toThrow("严格模式");
      }
      expect(e.snapshot(2499).data.strictProtected()).toBe(true);
      expect(e.snapshot(2500).data.protected()).toBe(false);
      expect(e.data.sessions).toHaveLength(1);
      expect(e.data.sessions[0]!.completed).toBe(true);
      e.dispatch({ type: "saveSettings", settings: defaultSettings() }, 2500);
    }
  });

  it("scheduled_sleep_crosses_midnight_and_does_not_count_as_focus", () => {
    const e = engine();
    e.dispatch({ type: "saveLockSchedule", schedule: sleepSchedule(true) }, friday(22, 0));
    expect(e.snapshot(friday(22, 59)).data.protected()).toBe(false);
    e.dispatch({ type: "startTimer" }, friday(22, 58));
    const at = friday(23, 0);
    const s = e.snapshot(at);
    expect(s.data.strictProtected()).toBe(true);
    expect(s.data.timer.running).toBe(false);
    expect(s.data.sessions).toHaveLength(1);
    expect(s.data.sessions[0]!.durationSecs).toBe(120);
    expect(s.data.sessions[0]!.completed).toBe(false);
    expect(() => e.dispatch({ type: "emergencyUnlock" }, at + 3600)).toThrow();
    expect(e.snapshot(at + 7 * 3600).data.protected()).toBe(true);
    expect(e.snapshot(at + 8 * 3600).data.protected()).toBe(false);
    expect(e.data.sessions).toHaveLength(1);
    // Saturday is not selected.
    expect(e.snapshot(at + 86400).data.protected()).toBe(false);
  });

  it("ordinary_lock_can_end_once_strict_quick_lock_survives_restart", () => {
    const path = tempPath("lock.json");
    let e = Engine.open(path);
    e.dispatch({ type: "saveLockSchedule", schedule: sleepSchedule(false) }, friday(22, 0));
    e.snapshot(friday(23, 0));
    e.dispatch({ type: "emergencyUnlock" }, friday(23, 1));
    expect(e.snapshot(friday(23, 2)).data.protected()).toBe(false);
    e.dispatch({ type: "startQuickLock", minutes: 2, strict: true }, friday(23, 3));
    e = Engine.open(path);
    expect(e.snapshot(friday(23, 4)).data.strictProtected()).toBe(true);
    expect(() => e.dispatch({ type: "emergencyUnlock" }, friday(23, 4))).toThrow();
    expect(e.snapshot(friday(23, 5)).data.protected()).toBe(false);
    expect(e.data.sessions).toHaveLength(0);
  });

  it("invalid_schedules_are_atomic_and_restoring_backups_does_not_arm_locks", () => {
    const e = engine();
    const now = friday(22, 0);
    const before = e.export(now);
    const invalid = sleepSchedule(true);
    invalid.start = "25:00";
    expect(() => e.dispatch({ type: "saveLockSchedule", schedule: invalid }, now)).toThrow();
    expect(e.export(now)).toBe(before);
    e.dispatch({ type: "saveLockSchedule", schedule: sleepSchedule(true) }, now);
    const overlap = sleepSchedule(false);
    overlap.id = "overlap";
    overlap.days = [6];
    overlap.start = "06:00";
    overlap.end = "08:00";
    expect(() => e.dispatch({ type: "saveLockSchedule", schedule: overlap }, now)).toThrow();
    const backup = e.snapshot(now).data;
    const s = e.dispatch({ type: "import", data: backup }, now);
    expect(s.data.lock.schedules[0]!.enabled).toBe(false);
    expect(e.snapshot(friday(23, 0)).data.protected()).toBe(false);
    const oldRaw = serializeAppData(new AppData());
    delete oldRaw["lock"];
    const oldRawSettings = oldRaw["settings"] as Record<string, unknown>;
    const oldRawProtection = oldRawSettings["protection"] as Record<string, unknown>;
    delete oldRawProtection["strict"];
    const old = parseAppData(oldRaw);
    expect(old.lock.schedules).toHaveLength(0);
    expect(old.settings.protection.strict).toBe(false);
  });

  it("only_desktop_fault_recovery_can_release_strict_lock_early", () => {
    const e = engine();
    e.dispatch({ type: "startQuickLock", minutes: 60, strict: true }, 1000);
    expect(() => e.dispatch({ type: "emergencyUnlock" }, 1001)).toThrow();
    e.releaseFailedProtection(1001);
    expect(e.snapshot(1002).data.protected()).toBe(false);
    expect(e.data.sessions).toHaveLength(0);
  });

  it("ending_a_quick_break_does_not_cancel_the_upcoming_sleep_window", () => {
    const e = engine();
    e.dispatch({ type: "saveLockSchedule", schedule: sleepSchedule(true) }, friday(22, 0));
    e.dispatch({ type: "startQuickLock", minutes: 30, strict: false }, friday(22, 59));
    e.dispatch({ type: "emergencyUnlock" }, friday(22, 59) + 10);
    expect(e.snapshot(friday(23, 0)).data.strictProtected()).toBe(true);
  });

  it("plan_round_trip_merges_without_resetting_progress_or_timer", () => {
    const e = engine();
    const settings: Settings = { ...defaultSettings(), focusMinutes: 30 };
    e.dispatch({ type: "saveSettings", settings }, 1000);
    e.dispatch({ type: "startTimer" }, 1000);
    const before = e.snapshot(1010).data;
    const first = e.dispatch({ type: "importPlan", plan: examplePlan() }, 1010);
    expect(first.data.tasks).toHaveLength(1);
    expect(first.data.tasks[0]!.estimate).toBe(2);
    expect(first.data.settings.focusMinutes).toBe(30);
    expect(JSON.stringify(serializeTimer(before.timer))).toBe(
      JSON.stringify(serializeTimer(first.data.timer)),
    );
    expect(first.data.sessions).toHaveLength(before.sessions.length);
    const task = first.data.tasks[0]!;
    e.dispatch(
      { type: "toggleSubtask", taskId: task.id, subtaskId: task.subtasks[0]!.id },
      1020,
    );
    const exported = e.snapshot(1020).data.exportPlan();
    validatePlanFile(exported);
    expect(exported.pomodoroMinutes).toBe(30);
    expect(exported.projects).toHaveLength(1);
    // 计划文件不带执行历史与本机设置。
    expect(Object.prototype.hasOwnProperty.call(exported, "settings")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(exported.tasks[0]!, "completed")).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(exported.tasks[0]!.subtasks[0]!, "done"),
    ).toBe(false);
    const second = e.dispatch({ type: "importPlan", plan: exported }, 1030);
    expect(second.data.tasks).toHaveLength(1);
    expect(second.data.tasks[0]!.subtasks[0]!.done).toBe(true);
    e.dispatch({ type: "toggleTask", id: task.id }, 1040);
    const third = e.dispatch({ type: "importPlan", plan: examplePlan() }, 1050);
    expect(third.data.tasks).toHaveLength(1);
    expect(third.data.tasks[0]!.completed).toBe(true);
    expect(third.data.exportPlan().tasks).toHaveLength(0);
    const fresh = engine();
    const imported = fresh.dispatch({ type: "importPlan", plan: exported }, 1060);
    // ceil(2*30/25)
    expect(imported.data.tasks[0]!.estimate).toBe(3);
    expect(imported.data.tasks[0]!.subtasks[0]!.done).toBe(false);
  });

  it("plan_validation_and_conversion_fail_atomically", () => {
    const e = engine();
    const before = e.export(1000);
    const cases: PlanFile[] = [];
    let plan = examplePlan();
    plan.tasks.push(structuredClone(plan.tasks[0]!));
    cases.push(plan);
    plan = examplePlan();
    plan.tasks[0]!.projectId = "missing";
    cases.push(plan);
    plan = examplePlan();
    plan.tasks[0]!.dueDate = "2026-02-30";
    cases.push(plan);
    plan = examplePlan();
    plan.version = 99;
    cases.push(plan);
    plan = examplePlan();
    plan.pomodoroMinutes = 0;
    cases.push(plan);
    plan = examplePlan();
    plan.pomodoroMinutes = 180;
    plan.tasks[0]!.estimate = 99;
    cases.push(plan);
    for (const candidate of cases) {
      expect(() => e.dispatch({ type: "importPlan", plan: candidate }, 1000)).toThrow();
      expect(e.export(1000)).toBe(before);
    }
    const json = JSON.parse(JSON.stringify(serializePlanFile(examplePlan()))) as Record<
      string,
      unknown
    >;
    const tasks = json["tasks"] as Record<string, unknown>[];
    (tasks[0] as Record<string, unknown>)["completed"] = true;
    expect(() => parsePlanFile(json)).toThrow();
  });

  it("plan_defaults_and_protection_match_task_contract", () => {
    const plan = parsePlanFile(
      JSON.parse(
        `{"format":"tomato-todo-plan","version":6,"pomodoroMinutes":25,"projects":[],"tasks":[{"id":"minimal","title":"最小任务","dueDate":"2026-10-12"}]}`,
      ),
    );
    validatePlanFile(plan);
    expect(plan.tasks[0]!.estimate).toBe(1);
    expect(plan.tasks[0]!.repeat).toBe("none");
    const e = engine();
    const settings: Settings = {
      ...defaultSettings(),
      protection: { mode: "lock", strict: false, whitelist: [] },
    };
    e.dispatch({ type: "saveSettings", settings }, 1000);
    e.dispatch({ type: "startTimer" }, 1000);
    expect(() => e.dispatch({ type: "importPlan", plan }, 1001)).toThrow();
    expect(e.data.tasks).toHaveLength(0);
  });

  it("plan_project_whitelist_is_added_then_overwritten_by_import", () => {
    const e = engine();
    const create = parsePlanFile(
      JSON.parse(
        `{"format":"tomato-todo-plan","version":6,"pomodoroMinutes":25,"projects":[{"id":"english","name":"英语一","color":"#849b7d","appWhitelist":["org.mozilla.firefox"]}],"tasks":[{"id":"t1","title":"词汇","dueDate":"2026-10-12","projectId":"english"}]}`,
      ),
    );
    e.dispatch({ type: "importPlan", plan: create }, 1000);
    expect(projectWhitelist(e, "english")).toEqual(["org.mozilla.firefox"]);

    // A regenerated file replaces the list, which is the agent round-trip.
    const update = parsePlanFile(
      JSON.parse(
        `{"format":"tomato-todo-plan","version":6,"pomodoroMinutes":25,"projects":[{"id":"english","name":"英语一","color":"#849b7d","appWhitelist":["org.mozilla.firefox","mdict"]}],"tasks":[]}`,
      ),
    );
    e.dispatch({ type: "importPlan", plan: update }, 1010);
    expect(projectWhitelist(e, "english")).toEqual(["org.mozilla.firefox", "mdict"]);

    // Omitting the field keeps the local list instead of clearing it.
    const keep = parsePlanFile(
      JSON.parse(
        `{"format":"tomato-todo-plan","version":6,"pomodoroMinutes":25,"projects":[{"id":"english","name":"英语一","color":"#849b7d"}],"tasks":[]}`,
      ),
    );
    e.dispatch({ type: "importPlan", plan: keep }, 1020);
    expect(projectWhitelist(e, "english")).toEqual(["org.mozilla.firefox", "mdict"]);
  });

  it("plan_import_updates_configuration_while_keeping_progress", () => {
    const e = engine();
    const d = draft();
    d.dueDate = "2026-10-12";
    d.subtasks = [{ id: "s1", title: "第一步", done: false }];
    const s = e.dispatch({ type: "saveTask", task: d }, friday(8, 0));
    const id = s.data.tasks[0]!.id;
    e.dispatch({ type: "toggleSubtask", taskId: id, subtaskId: "s1" }, friday(9, 0));
    const plan = e.snapshot(friday(9, 1)).data.exportPlan();
    // Editing the file must now change the plan, not be silently ignored.
    plan.tasks[0]!.title = "改过的标题";
    plan.tasks[0]!.dueDate = "2026-10-20";
    const s2 = e.dispatch({ type: "importPlan", plan }, friday(10, 0));
    const t = s2.data.tasks.find((x) => x.id === id)!;
    expect(t.title).toBe("改过的标题");
    expect(t.dueDate).toBe("2026-10-20");
    // Progress and steps survive the update.
    expect(t.subtasks[0]!.done).toBe(true);
  });

  it("plan_replace_removes_unplanned_incomplete_tasks_but_keeps_history", () => {
    const e = engine();
    const a = draft();
    a.title = "保留";
    a.dueDate = "2026-10-12";
    const b = draft();
    b.title = "已完成";
    b.dueDate = "2026-10-13";
    e.dispatch({ type: "saveTask", task: a }, 1000);
    const s = e.dispatch({ type: "saveTask", task: b }, 1001);
    const keep = s.data.tasks.find((t) => t.title === "保留")!.id;
    const done = s.data.tasks.find((t) => t.title === "已完成")!.id;
    e.dispatch({ type: "toggleTask", id: done }, 1002);
    const plan = e.snapshot(1003).data.exportPlan();
    // A full-plan file that forgets the incomplete task must remove it.
    plan.tasks = plan.tasks.filter((t) => t.id !== keep);
    plan.replace = true;
    const s2 = e.dispatch({ type: "importPlan", plan }, 1004);
    expect(s2.data.tasks.some((t) => t.id === keep)).toBe(false);
    expect(s2.data.tasks.some((t) => t.id === done)).toBe(true);
  });

  it("effective_whitelist_prefers_project_list_over_global", () => {
    const e = engine();
    const settings: Settings = {
      ...defaultSettings(),
      protection: { ...defaultSettings().protection, whitelist: ["global.app"] },
    };
    e.dispatch({ type: "saveSettings", settings }, 1000);
    const ps = e.dispatch(
      {
        type: "saveProject",
        directory: join(tmpdir(), "tomato-project"),
        id: null,
        name: "英语",
        color: "#849b7d",
      },
      1000,
    );
    const project = ps.data.projects[ps.data.projects.length - 1]!.id;
    const ts = e.dispatch(
      { type: "saveTask", task: { ...draft(), projectId: project } },
      1000,
    );
    const task = ts.data.tasks[ts.data.tasks.length - 1]!.id;
    // Before selecting a task only the global list applies.
    expect(e.snapshot(1000).data.effectiveWhitelist()).toEqual(["global.app"]);
    e.dispatch({ type: "selectTask", id: task }, 1000);
    // Without a dedicated list the global list still applies.
    expect(e.snapshot(1000).data.effectiveWhitelist()).toEqual(["global.app"]);
    e.dispatch({ type: "setProjectWhitelist", id: project, whitelist: ["dict"] }, 1000);
    expect(e.snapshot(1000).data.effectiveWhitelist()).toEqual(["dict"]);
    // Disabling falls back to the global list.
    e.dispatch({ type: "setProjectWhitelist", id: project, whitelist: null }, 1000);
    expect(e.snapshot(1000).data.effectiveWhitelist()).toEqual(["global.app"]);
    // A blank project app ID is rejected without clobbering the stored list.
    expect(() =>
      e.dispatch({ type: "setProjectWhitelist", id: project, whitelist: ["  "] }, 1000),
    ).toThrow();
    e.dispatch({ type: "setProjectWhitelist", id: project, whitelist: ["dict"] }, 1000);
    expect(e.snapshot(1000).data.effectiveWhitelist()).toEqual(["dict"]);
  });

  it("long_windows_paths_round_trip_in_global_and_project_whitelists", () => {
    const e = engine();
    const path = `C:\\${"工具目录\\".repeat(80)}Editor.exe`;
    expect(path.length).toBeGreaterThan(200);
    const settings: Settings = {
      ...defaultSettings(),
      protection: { ...defaultSettings().protection, whitelist: [path] },
    };
    e.dispatch({ type: "saveSettings", settings }, 1000);
    const ps = e.dispatch(
      {
        type: "saveProject",
        directory: join(tmpdir(), "tomato-project"),
        id: null,
        name: "Portable",
        color: "#849b7d",
      },
      1000,
    );
    const project = ps.data.projects[ps.data.projects.length - 1]!.id;
    e.dispatch({ type: "setProjectWhitelist", id: project, whitelist: [path] }, 1000);
    e.dispatch({ type: "saveTask", task: { ...draft(), projectId: project } }, 1000);
    const raw = e.export(1000);
    const restored = engine();
    const data = parseBackup(raw);
    const snapshot = restored.dispatch({ type: "import", data }, 1000);
    expect(snapshot.data.settings.protection.whitelist).toEqual([path]);
    expect(snapshot.data.projects.find((p) => p.id === project)!.appWhitelist).toEqual([
      path,
    ]);
    const plan = snapshot.data.exportPlan();
    validatePlanFile(plan);
    expect(plan.projects.find((p) => p.id === project)!.appWhitelist).toEqual([path]);
    const invalid = structuredClone(snapshot.data.settings);
    invalid.protection = { ...invalid.protection, whitelist: ["x".repeat(32769)] };
    expect(() =>
      restored.dispatch({ type: "saveSettings", settings: invalid }, 1000),
    ).toThrow();
  });

  it("expired_routines_count_as_misses_but_appointments_do_not", () => {
    const e = engine();
    const routine = draft();
    routine.dueDate = "2026-10-09";
    routine.reminderTime = "09:00";
    routine.focusMinutes = 25;
    routine.estimate = 1;
    routine.repeat = "daily";
    e.dispatch({ type: "saveTask", task: routine }, friday(8, 0));
    // A one-off timed task (an appointment) also expires, but is not a lapse.
    const appointment = draft();
    appointment.dueDate = "2026-10-09";
    appointment.reminderTime = "15:00";
    appointment.focusMinutes = 25;
    appointment.estimate = 1;
    e.dispatch({ type: "saveTask", task: appointment }, friday(8, 0));
    const s = e.snapshot(friday(16, 0));
    expect(
      s.data.tasks.filter((t) => t.dueDate === "2026-10-09").every((t) => t.reminderExpired),
    ).toBe(true);
    const day = s.stats.days.find((d) => d.date === "2026-10-09")!;
    expect(day.missed).toBe(1);
  });

  it("habits_materialize_today_once_and_detach_on_delete", () => {
    const e = engine();
    const s = e.dispatch(
      {
        type: "saveHabit",
        id: null,
        name: "午饭",
        projectId: null,
        focusMinutes: 25,
        slots: [
          { days: [1, 2, 3, 4, 5], time: "12:00" },
          { days: [6, 7], time: "12:40" },
        ],
      },
      friday(8, 0),
    );
    const habit = s.data.habits[0]!.id;
    const todays = s.data.tasks.filter((t) => t.habitId === habit);
    expect(todays).toHaveLength(3);
    expect(new Set(todays.map((t) => t.dueDate!))).toEqual(
      new Set(["2026-10-09", "2026-10-10", "2026-10-11"]),
    );
    expect(todays[0]!.reminderTime).toBe("12:00");
    expect(todays[0]!.dueDate).toBe("2026-10-09");
    // Ticking again must not duplicate the occurrence.
    const s2 = e.snapshot(friday(8, 1));
    expect(s2.data.tasks.filter((t) => t.habitId === habit)).toHaveLength(3);
    // Deleting the habit leaves the occurrence as an ordinary timed task.
    e.dispatch({ type: "deleteHabit", id: habit }, friday(8, 2));
    expect(e.snapshot(friday(8, 2)).data.tasks.every((t) => t.habitId === null)).toBe(true);
  });

  it("habit_validation_rejects_duplicate_slots_and_bad_times", () => {
    const e = engine();
    const slot = (days: number[], time: string): HabitSlot => ({ days, time });
    const cases: HabitSlot[][] = [
      [slot([1, 2], "12:00"), slot([2, 3], "12:00")],
      [slot([], "12:00")],
      [slot([1], "25:00")],
      [],
    ];
    for (const slots of cases) {
      expect(() =>
        e.dispatch(
          {
            type: "saveHabit",
            id: null,
            name: "习惯",
            projectId: null,
            focusMinutes: null,
            slots,
          },
          friday(8, 0),
        ),
      ).toThrow();
    }
  });

  it("visions_attach_to_a_project_or_stand_alone", () => {
    const e = engine();
    e.dispatch(
      {
        type: "saveVision",
        id: null,
        name: "考上北大",
        notes: "研究生工资与未来",
        projectId: null,
      },
      1000,
    );
    const project = e.snapshot(1000).data.projects[0]!.id;
    e.dispatch(
      { type: "saveVision", id: null, name: "英语一 80", notes: "", projectId: project },
      1000,
    );
    expect(e.snapshot(1000).data.visions).toHaveLength(2);
    expect(() =>
      e.dispatch(
        { type: "saveVision", id: null, name: "无效", notes: "", projectId: "missing" },
        1000,
      ),
    ).toThrow();
    // Deleting the owner drops its marker.
    e.dispatch({ type: "deleteProject", id: project }, 1000);
    expect(e.snapshot(1000).data.visions.every((a) => a.projectId === null)).toBe(true);
  });

  it("deleting_a_habit_occurrence_does_not_regenerate_it", () => {
    const e = engine();
    e.dispatch(
      {
        type: "saveHabit",
        id: null,
        name: "午饭",
        projectId: null,
        focusMinutes: null,
        slots: [{ days: [1, 2, 3, 4, 5, 6, 7], time: "12:00" }],
      },
      friday(8, 0),
    );
    const s = e.snapshot(friday(8, 0));
    const habit = s.data.habits[0]!.id;
    const task = s.data.tasks.find((t) => t.habitId === habit)!.id;
    e.dispatch({ type: "deleteTask", id: task }, friday(8, 1));
    const s2 = e.snapshot(friday(8, 2));
    expect(
      s2.data.tasks.every((t) => t.habitId !== habit || t.dueDate !== "2026-10-09"),
    ).toBe(true);
  });

  it("tasks_detach_without_being_deleted", () => {
    const e = engine();
    const project = e.snapshot(1000).data.projects[0]!.id;
    const d = draft();
    d.projectId = project;
    const s = e.dispatch({ type: "saveTask", task: d }, 1000);
    const id = s.data.tasks[0]!.id;
    e.dispatch({ type: "detachTasks", ids: [id], target: "project" }, 1000);
    const s2 = e.snapshot(1000);
    expect(s2.data.tasks).toHaveLength(1);
    expect(s2.data.tasks[0]!.projectId).toBeNull();
  });

  it("plain_tasks_get_a_static_repair_window", () => {
    const e = engine();
    const d = draft();
    d.dueDate = "2026-10-09";
    d.reminderTime = "09:00";
    d.focusMinutes = 25;
    d.estimate = 1; // planned block ends 09:25
    d.scrapMinutes = 120; // repairable until 11:25
    e.dispatch({ type: "saveTask", task: d }, friday(8, 0));
    expect(e.snapshot(friday(10, 0)).data.tasks[0]!.reminderExpired).toBe(false);
    expect(e.snapshot(friday(11, 30)).data.tasks[0]!.reminderExpired).toBe(true);
  });

  it("projects_reorder_only_as_a_permutation", () => {
    const e = engine();
    const ids = e.snapshot(1000).data.projects.map((p) => p.id);
    const reversed = [...ids].reverse();
    const s = e.dispatch({ type: "reorderProjects", ids: reversed }, 1000);
    expect(s.data.projects.map((p) => p.id)).toEqual(reversed);
    expect(() => e.dispatch({ type: "reorderProjects", ids: ["missing"] }, 1000)).toThrow();
    expect(() => e.dispatch({ type: "reorderProjects", ids: [ids[0]!] }, 1000)).toThrow();
  });

  it("protection_rejects_mutations_until_emergency_or_completion", () => {
    const e = engine();
    const settings: Settings = {
      ...defaultSettings(),
      protection: { mode: "lock", whitelist: [], strict: false },
    };
    e.dispatch({ type: "saveSettings", settings }, 1000);
    e.dispatch({ type: "startTimer" }, 1000);
    expect(() => e.dispatch({ type: "pauseTimer" }, 1100)).toThrow();
    expect(() => e.dispatch({ type: "resetTimer" }, 1100)).toThrow();
    expect(() =>
      e.dispatch({ type: "saveSettings", settings: defaultSettings() }, 1100),
    ).toThrow();
    const unlocked = e.dispatch({ type: "emergencyUnlock" }, 1100);
    expect(unlocked.data.protected()).toBe(false);
    expect(unlocked.data.sessions[0]!.durationSecs).toBe(100);
    expect(unlocked.data.sessions[0]!.completed).toBe(false);
    e.dispatch({ type: "startTimer" }, 1200);
    expect(e.snapshot(2700).data.protected()).toBe(false);
  });

  it("recurring_weekday_task_skips_weekend_and_does_not_duplicate", () => {
    const e = engine();
    const at = friday(12, 0);
    const d = draft();
    d.dueDate = "2026-10-09";
    d.repeat = "weekdays";
    d.subtasks = [{ id: id(), title: "步骤", done: true }];
    const s = e.dispatch({ type: "saveTask", task: d }, at);
    const taskId = s.data.tasks[0]!.id;
    const s2 = e.dispatch({ type: "toggleTask", id: taskId }, at);
    // The whole workweek was printed at creation.
    expect(s2.data.tasks).toHaveLength(5);
    expect(new Set(s2.data.tasks.map((t) => t.dueDate!))).toEqual(
      new Set(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]),
    );
    e.dispatch({ type: "toggleTask", id: taskId }, at);
    e.dispatch({ type: "toggleTask", id: taskId }, at);
    expect(e.data.tasks).toHaveLength(5);
    // Saturday
    expect(e.snapshot(at + 86400).data.tasks).toHaveLength(5);
    const monday = e.snapshot(at + 3 * 86400);
    expect(monday.data.tasks).toHaveLength(10);
    expect(monday.data.tasks[5]!.dueDate).toBe("2026-10-12");
    expect(monday.data.tasks[5]!.subtasks[0]!.done).toBe(false);
  });

  it("statistics_use_local_day_and_keep_partial_minutes_separate", () => {
    const e = engine();
    const today = friday(12, 0);
    e.dispatch({ type: "startTimer" }, today - 86400);
    e.snapshot(today - 86400 + 1500);
    e.dispatch({ type: "setMode", mode: "focus" }, today);
    e.dispatch({ type: "startTimer" }, today);
    const s = e.dispatch({ type: "resetTimer" }, today + 120);
    expect(s.stats.todaySeconds).toBe(120);
    expect(s.stats.todayPomodoros).toBe(0);
    expect(s.stats.totalSeconds).toBe(1620);
    expect(s.stats.streak).toBe(1);
  });

  it("corrupt_database_is_preserved", () => {
    const path = tempPath("data.db");
    Engine.open(path);
    writeFileSync(path, "not-json", "utf8");
    expect(() => Engine.open(path)).toThrow();
    expect(readFileSync(path, "utf8")).toBe("not-json");
  });

  it("auto_break_starts_only_during_live_transition", () => {
    const e = engine();
    const settings: Settings = { ...defaultSettings(), autoBreak: true };
    e.dispatch({ type: "saveSettings", settings }, 1000);
    e.dispatch({ type: "startTimer" }, 1000);
    const s = e.snapshot(2501);
    expect(s.data.timer.running).toBe(true);
    expect(s.data.timer.mode).toBe("shortBreak");
    expect(s.remainingSecs).toBe(300);
  });

  it("task_completion_credits_the_greater_of_expected_and_actual_effort", () => {
    const cases: [number, number, number, number][] = [
      [0, 0, 3000, 3000],
      [0, 1200, 3000, 1800],
      [2, 0, 3000, 0],
      [2, 1200, 4200, 0],
    ];
    for (const [rounds, partial, expectedTotal, supplement] of cases) {
      const e = engine();
      const start = friday(9, 0);
      const s0 = e.dispatch({ type: "saveTask", task: draft() }, start);
      const taskId = s0.data.tasks[0]!.id;
      e.dispatch({ type: "selectTask", id: taskId }, start);
      let at = start;
      for (let i = 0; i < rounds; i += 1) {
        e.dispatch({ type: "setMode", mode: "focus" }, at);
        e.dispatch({ type: "startTimer" }, at);
        at += 1500;
        e.snapshot(at);
      }
      if (partial > 0) {
        e.dispatch({ type: "setMode", mode: "focus" }, at);
        e.dispatch({ type: "startTimer" }, at);
        at += partial;
        e.dispatch({ type: "pauseTimer" }, at);
      }
      const s = e.dispatch({ type: "toggleTask", id: taskId }, at + 60);
      expect(s.stats.totalSeconds).toBe(expectedTotal);
      expect(s.stats.todaySeconds).toBe(expectedTotal);
      expect(s.stats.totalPomodoros).toBe(rounds);
      expect(s.data.timer.cycle).toBe(rounds);
      expect(s.data.timer.taskId).toBeNull();
      const credited = s.data.sessions
        .filter((x) => x.source === "taskEstimate")
        .reduce((n, x) => n + x.durationSecs, 0);
      expect(credited).toBe(supplement);
      expect(e.snapshot(at + 10000).stats.totalSeconds).toBe(expectedTotal);
      const s2 = e.dispatch({ type: "toggleTask", id: taskId }, at + 10001);
      expect(s2.stats.totalSeconds).toBe(expectedTotal - supplement);
      const s3 = e.dispatch({ type: "toggleTask", id: taskId }, at + 10002);
      expect(s3.stats.totalSeconds).toBe(expectedTotal);
    }
  });

  it("task_completion_settles_running_focus_without_affecting_other_tasks", () => {
    const e = engine();
    const at = friday(9, 0);
    const a = e.dispatch({ type: "saveTask", task: draft() }, at).data.tasks[0]!.id;
    const other = draft();
    other.focusMinutes = 10;
    const b = e.dispatch({ type: "saveTask", task: other }, at).data.tasks[1]!.id;
    e.dispatch({ type: "selectTask", id: a }, at);
    e.dispatch({ type: "startTimer" }, at);
    const s = e.dispatch({ type: "toggleTask", id: b }, at + 120);
    expect(s.data.timer.running).toBe(true);
    expect(s.stats.totalSeconds).toBe(1200);
    const s2 = e.dispatch({ type: "toggleTask", id: a }, at + 600);
    expect(s2.data.timer.running).toBe(false);
    expect(s2.stats.totalSeconds).toBe(4200);
    expect(s2.data.sessions.find((x) => x.source === "timer")!.durationSecs).toBe(600);
    expect(s2.stats.totalPomodoros).toBe(0);
  });

  it("estimated_completion_credit_survives_backup_restart_and_task_deletion", () => {
    const path = tempPath("completion.json");
    let e = Engine.open(path);
    const at = friday(23, 0);
    const task = draft();
    task.focusMinutes = 180;
    task.estimate = 99;
    const taskId = e.dispatch({ type: "saveTask", task }, at).data.tasks[0]!.id;
    e.dispatch({ type: "toggleTask", id: taskId }, at);
    const backup = parseBackup(e.export(at));
    expect(backup.sessions[0]!.source).toBe("taskEstimate");
    const restored = engine();
    const s = restored.dispatch({ type: "import", data: backup }, at);
    expect(s.stats.totalSeconds).toBe(99 * 180 * 60);
    expect(s.stats.streak).toBe(1);
    expect(s.stats.totalPomodoros).toBe(0);
    e = reopen(path);
    const s2 = e.dispatch({ type: "deleteTask", id: taskId }, at + 1);
    expect(s2.stats.totalSeconds).toBe(99 * 180 * 60);
    expect(s2.data.sessions).toHaveLength(1);
    expect(s2.data.tasks).toHaveLength(0);
  });

  it("completion_credit_is_assigned_to_completion_day_without_rewriting_actual_history", () => {
    const e = engine();
    const at = friday(12, 0);
    const taskId = e.dispatch({ type: "saveTask", task: draft() }, at).data.tasks[0]!.id;
    e.dispatch({ type: "selectTask", id: taskId }, at);
    e.dispatch({ type: "startTimer" }, at);
    e.dispatch({ type: "resetTimer" }, at + 600);
    const s = e.dispatch({ type: "toggleTask", id: taskId }, at + 86400);
    expect(s.stats.totalSeconds).toBe(3000);
    expect(s.stats.todaySeconds).toBe(2400);
    expect(s.stats.days[s.stats.days.length - 2]!.seconds).toBe(600);
  });

  it("old_timer_records_default_to_timer_and_estimates_cannot_claim_completed_pomodoros", () => {
    const value = JSON.parse(EXAMPLE_BACKUP_RAW) as Record<string, unknown>;
    for (const session of value["sessions"] as Record<string, unknown>[]) {
      delete session["source"];
    }
    const data = parseBackup(value);
    data.validate();
    expect(data.sessions[0]!.source).toBe("timer");
    data.sessions[0]!.source = "taskEstimate";
    expect(() => data.validate()).toThrow();
  });

  it("completing_tasks_at_night_does_not_fabricate_late_focus_sessions", () => {
    const e = engine();
    const at = friday(23, 0);
    for (let day = 0; day < 3; day += 1) {
      const t = at + day * 86400;
      const taskId = e.dispatch({ type: "saveTask", task: draft() }, t).data.tasks.at(-1)!.id;
      e.dispatch({ type: "toggleTask", id: taskId }, t);
    }
    const s = e.snapshot(at + 2 * 86400);
    expect(diagnose(s, null).some((a) => a.kind === "rhythmDrift")).toBe(false);
  });

  it("pause_resume_excludes_paused_time_and_counts_once", () => {
    const e = engine();
    e.dispatch({ type: "startTimer" }, 1000);
    expect(e.dispatch({ type: "pauseTimer" }, 1100).remainingSecs).toBe(1400);
    expect(e.snapshot(2000).remainingSecs).toBe(1400);
    e.dispatch({ type: "startTimer" }, 2000);
    const s = e.snapshot(3400);
    expect(s.data.sessions[0]!.durationSecs).toBe(1500);
    expect(s.data.timer.mode).toBe("shortBreak");
    expect(s.data.timer.running).toBe(false);
    expect(e.snapshot(9999).data.sessions).toHaveLength(1);
  });

  it("long_break_after_four_completed_focus_sessions", () => {
    const e = engine();
    for (let i = 0; i < 4; i += 1) {
      const t = 1000 + i * 2000;
      e.dispatch({ type: "setMode", mode: "focus" }, t);
      e.dispatch({ type: "startTimer" }, t);
      e.snapshot(t + 1500);
    }
    expect(e.data.timer.mode).toBe("longBreak");
    expect(e.data.sessions).toHaveLength(4);
  });

  it("early_focus_completion_records_actual_time_and_leaves_task_unfinished", () => {
    const e = engine();
    const task = draft();
    task.subtasks.push({ id: id(), title: "待办步骤", done: false });
    const s0 = e.dispatch({ type: "saveTask", task }, 1000);
    const taskId = s0.data.tasks[0]!.id;
    e.dispatch({ type: "selectTask", id: taskId }, 1000);
    const settings: Settings = { ...defaultSettings(), autoBreak: true };
    e.dispatch({ type: "saveSettings", settings }, 1000);
    e.dispatch({ type: "startTimer" }, 1000);
    const s = e.dispatch({ type: "completeFocus" }, 1600);
    expect(s.data.sessions).toHaveLength(1);
    expect(s.data.sessions[0]!.durationSecs).toBe(600);
    expect(s.data.sessions[0]!.endedAt).toBe(1600);
    expect(s.data.sessions[0]!.completed).toBe(true);
    expect(s.stats.todaySeconds).toBe(600);
    expect(s.stats.todayPomodoros).toBe(1);
    expect(s.stats.todayCompleted).toBe(0);
    expect(s.data.tasks[0]!.completed).toBe(false);
    expect(s.data.tasks[0]!.completedAt).toBeNull();
    expect(s.data.tasks[0]!.subtasks[0]!.done).toBe(false);
    expect(s.data.timer.taskId).toBe(taskId);
    expect(s.data.timer.cycle).toBe(1);
    expect(s.data.timer.completionSerial).toBe(1);
    expect(s.data.timer.lastFinishedMode).toBe("focus");
    expect(s.data.timer.mode).toBe("shortBreak");
    expect(s.remainingSecs).toBe(300);
    expect(s.data.timer.running).toBe(true);
    expect(() => e.dispatch({ type: "completeFocus" }, 1601)).toThrow();
    expect(e.snapshot(2500).data.sessions).toHaveLength(1);
  });

  it("early_focus_completion_uses_daily_break_cycle", () => {
    const cases: [number, number, Mode][] = [
      [friday(12, 0), 4, "longBreak"],
      [friday(9, 0) + 24 * 3600, 1, "shortBreak"],
    ];
    for (const [start, count, mode] of cases) {
      const e = engine();
      completeFocusSessions(e, friday(9, 0), 3);
      e.dispatch({ type: "setMode", mode: "focus" }, start);
      e.dispatch({ type: "startTimer" }, start);
      const s = e.dispatch({ type: "completeFocus" }, start + 60);
      expect(s.data.timer.cycle).toBe(count);
      expect(s.data.timer.mode).toBe(mode);
      expect(s.data.timer.running).toBe(false);
      expect(s.data.sessions.at(-1)!.durationSecs).toBe(60);
    }
  });

  it("early_focus_completion_excludes_paused_time", () => {
    const e = engine();
    expect(() => e.dispatch({ type: "completeFocus" }, 1000)).toThrow();
    e.dispatch({ type: "startTimer" }, 1000);
    expect(() => e.dispatch({ type: "completeFocus" }, 1000)).toThrow();
    expect(e.data.sessions).toHaveLength(0);
    e.dispatch({ type: "pauseTimer" }, 1100);
    const s = e.dispatch({ type: "completeFocus" }, 2000);
    expect(s.data.sessions).toHaveLength(1);
    expect(s.data.sessions[0]!.durationSecs).toBe(100);
    expect(s.data.sessions[0]!.completed).toBe(true);
    expect(s.data.timer.mode).toBe("shortBreak");
    expect(() => e.dispatch({ type: "completeFocus" }, 2001)).toThrow();
  });

  it("early_focus_completion_releases_non_strict_focus_protection", () => {
    for (const mode of ["lock", "whitelist"] as GuardMode[]) {
      const e = engine();
      const settings: Settings = {
        ...defaultSettings(),
        protection: { mode, strict: false, whitelist: [] },
      };
      e.dispatch({ type: "saveSettings", settings }, 1000);
      e.dispatch({ type: "startTimer" }, 1000);
      expect(e.data.protected()).toBe(true);
      const s = e.dispatch({ type: "completeFocus" }, 1100);
      expect(s.data.protected()).toBe(false);
      expect(s.data.sessions[0]!.completed).toBe(true);
      expect(s.data.timer.mode).toBe("shortBreak");
      expect(s.data.settings.protection.mode).toBe(mode);
    }
    const e = engine();
    e.dispatch({ type: "startQuickLock", minutes: 10, strict: false }, 1000);
    expect(() => e.dispatch({ type: "completeFocus" }, 1100)).toThrow();
    expect(e.data.protected()).toBe(true);
    expect(e.data.sessions).toHaveLength(0);
  });

  it("break_cycle_resets_at_local_midnight", () => {
    const e = engine();
    completeFocusSessions(e, friday(9, 0), 3);
    expect(e.data.timer.cycle).toBe(3);
    const midnight = friday(0, 0) + 24 * 3600;
    const s = e.snapshot(midnight);
    expect(s.data.timer.cycle).toBe(0);
    expect(s.data.timer.mode).toBe("focus");
    completeFocusSessions(e, midnight + 9 * 3600, 1);
    expect(e.data.timer.cycle).toBe(1);
    expect(e.data.timer.mode).toBe("shortBreak");
    completeFocusSessions(e, midnight + 10 * 3600, 3);
    expect(e.data.timer.cycle).toBe(4);
    expect(e.data.timer.mode).toBe("longBreak");
  });

  it("break_cycle_survives_same_day_restart_but_resets_overnight", () => {
    const path = tempPath("cycle.json");
    let e = Engine.open(path);
    completeFocusSessions(e, friday(9, 0), 3);
    e = reopen(path);
    expect(e.snapshot(friday(12, 0)).data.timer.cycle).toBe(3);
    completeFocusSessions(e, friday(12, 0), 1);
    expect(e.data.timer.mode).toBe("longBreak");
    e = reopen(path);
    const morning = friday(9, 0) + 24 * 3600;
    const s = e.snapshot(morning);
    expect(s.data.timer.cycle).toBe(0);
    expect(s.data.timer.mode).toBe("focus");
    completeFocusSessions(e, morning, 1);
    expect(e.data.timer.cycle).toBe(1);
    expect(e.data.timer.mode).toBe("shortBreak");
  });

  it("focus_crossing_midnight_counts_on_completion_date", () => {
    const e = engine();
    const settings: Settings = { ...defaultSettings(), autoBreak: true };
    e.dispatch({ type: "saveSettings", settings }, friday(9, 0));
    completeFocusSessions(e, friday(9, 0), 3);
    const start = friday(23, 50);
    e.dispatch({ type: "setMode", mode: "focus" }, start);
    e.dispatch({ type: "startTimer" }, start);
    const s = e.snapshot(start + 10 * 60);
    expect(s.data.timer.cycle).toBe(0);
    expect(s.data.timer.running).toBe(true);
    expect(s.data.timer.mode).toBe("focus");
    expect(s.remainingSecs).toBe(15 * 60);
    const s2 = e.snapshot(start + 25 * 60);
    expect(s2.data.timer.cycle).toBe(1);
    expect(s2.data.timer.mode).toBe("shortBreak");
    expect(s2.data.timer.running).toBe(true);
    expect(s2.stats.todayPomodoros).toBe(1);
    expect(s2.stats.totalPomodoros).toBe(4);
  });

  it("late_previous_day_completion_does_not_count_today", () => {
    const e = engine();
    completeFocusSessions(e, friday(9, 0), 3);
    e.dispatch({ type: "setMode", mode: "focus" }, friday(23, 0));
    e.dispatch({ type: "startTimer" }, friday(23, 0));
    const morning = friday(9, 0) + 24 * 3600;
    const s = e.snapshot(morning);
    expect(s.data.timer.cycle).toBe(0);
    expect(s.data.timer.mode).toBe("focus");
    expect(s.data.timer.running).toBe(false);
    expect(s.stats.todayPomodoros).toBe(0);
    expect(s.stats.totalPomodoros).toBe(4);
    completeFocusSessions(e, morning, 1);
    expect(e.data.timer.mode).toBe("shortBreak");
  });

  it("break_cycle_rollover_preserves_running_and_paused_breaks", () => {
    for (const mode of ["shortBreak", "longBreak"] as Mode[]) {
      for (const paused of [false, true]) {
        const e = engine();
        completeFocusSessions(e, friday(9, 0), 3);
        const start = friday(23, 59);
        e.dispatch({ type: "setMode", mode }, start);
        e.dispatch({ type: "startTimer" }, start);
        if (paused) {
          e.dispatch({ type: "pauseTimer" }, start + 10);
        }
        const timer = structuredClone(e.data.timer);
        const s = e.snapshot(start + 60);
        expect(s.data.timer.cycle).toBe(0);
        expect(s.data.timer.mode).toBe(mode);
        expect(s.data.timer.running).toBe(!paused);
        expect(s.data.timer.startedAt).toBe(timer.startedAt);
        expect(s.data.timer.deadline).toBe(timer.deadline);
        expect(s.remainingSecs).toBe(timerRemaining(timer, start + 60));
      }
    }
  });

  it("legacy_break_cycle_is_rebuilt_from_local_completed_sessions", () => {
    const e = engine();
    completeFocusSessions(e, friday(9, 0), 3);
    const morning = friday(9, 0) + 24 * 3600;
    completeFocusSessions(e, morning, 1);
    e.dispatch({ type: "setMode", mode: "focus" }, morning + 1600);
    e.dispatch({ type: "startTimer" }, morning + 1600);
    e.dispatch({ type: "resetTimer" }, morning + 1660);
    const old = JSON.parse(e.export(morning + 1660)) as Record<string, unknown>;
    const oldTimer = old["timer"] as Record<string, unknown>;
    delete oldTimer["cycleDate"];
    oldTimer["cycle"] = 99;
    const data = parseBackup(old);
    const restored = engine();
    const s = restored.dispatch({ type: "import", data }, morning + 1660);
    expect(s.data.timer.cycle).toBe(1);
    expect(s.data.timer.cycleDate).toBe(dateAt(morning));
    completeFocusSessions(restored, morning + 2000, 1);
    expect(restored.data.timer.cycle).toBe(2);
    expect(restored.data.timer.mode).toBe("shortBreak");
    const backup = parseBackup(restored.export(morning + 3500));
    expect(backup.timer.cycleDate).toBe(dateAt(morning));
  });

  it("invalid_break_cycle_date_cannot_replace_existing_data", () => {
    const e = engine();
    const data = new AppData();
    data.timer.cycleDate = "2026-02-30";
    expect(() => e.dispatch({ type: "import", data }, friday(9, 0))).toThrow();
    expect(e.data.timer.cycleDate).not.toBe("2026-02-30");
  });

  it("invalid_action_cannot_mutate_memory_or_database", () => {
    const e = engine();
    const d = draft();
    d.title = "  ";
    expect(() => e.dispatch({ type: "saveTask", task: d }, 1000)).toThrow();
    expect(e.data.tasks).toHaveLength(0);
    const settings: Settings = { ...defaultSettings(), longBreakEvery: 0 };
    expect(() => e.dispatch({ type: "saveSettings", settings }, 1000)).toThrow();
    expect(e.data.settings.longBreakEvery).toBe(4);
  });

  it("reopening_recovers_timer_without_fabricating_sessions", () => {
    const path = tempPath("reopen.json");
    {
      const e = Engine.open(path);
      const settings: Settings = { ...defaultSettings(), autoBreak: true, autoFocus: true };
      e.dispatch({ type: "saveSettings", settings }, 1000);
      e.dispatch({ type: "startTimer" }, 1000);
    }
    const e = reopen(path);
    const s = e.snapshot(90000);
    expect(s.data.sessions).toHaveLength(1);
    expect(s.data.timer.running).toBe(false);
  });

  it("partial_sessions_do_not_count_as_completed_pomodoros", () => {
    const e = engine();
    e.dispatch({ type: "startTimer" }, 1000);
    const s = e.dispatch({ type: "resetTimer" }, 1060);
    expect(s.data.sessions[0]!.durationSecs).toBe(60);
    expect(s.data.sessions[0]!.completed).toBe(false);
    expect(s.stats.totalPomodoros).toBe(0);
    expect(s.stats.totalSeconds).toBe(60);
  });

  it("task_edit_completion_delete_and_restore", () => {
    const e = engine();
    const s = e.dispatch({ type: "saveTask", task: draft() }, 1000);
    const task = structuredClone(s.data.tasks[0]!);
    e.dispatch({ type: "selectTask", id: task.id }, 1000);
    e.dispatch({ type: "toggleTask", id: task.id }, 1001);
    expect(e.data.tasks[0]!.completed).toBe(true);
    const done = structuredClone(e.data.tasks[0]!);
    e.dispatch({ type: "deleteTask", id: done.id }, 1002);
    expect(e.data.timer.taskId).toBeNull();
    e.dispatch({ type: "restoreTask", task: done }, 1003);
    expect(e.data.tasks).toHaveLength(1);
  });

  it("import_validates_before_replacing_and_pauses_timer", () => {
    const e = engine();
    const backup = new AppData();
    backup.settings.focusMinutes = 0;
    expect(() => e.dispatch({ type: "import", data: backup }, 1000)).toThrow();
    expect(e.data.settings.focusMinutes).toBe(25);
    const backup2 = new AppData();
    backup2.start(1000);
    const s = e.dispatch({ type: "import", data: backup2 }, 1100);
    expect(s.data.timer.running).toBe(false);
    expect(s.remainingSecs).toBe(1400);
  });

  it("active_task_cannot_be_switched_mid_session", () => {
    const e = engine();
    e.dispatch({ type: "startTimer" }, 1000);
    expect(() => e.dispatch({ type: "selectTask", id: null }, 1001)).toThrow();
  });

  it("deleting_project_preserves_tasks", () => {
    const e = engine();
    const project = e.data.projects[0]!.id;
    const d = draft();
    d.projectId = project;
    e.dispatch({ type: "saveTask", task: d }, 1000);
    e.dispatch({ type: "deleteProject", id: project }, 1000);
    expect(e.data.tasks).toHaveLength(1);
    expect(e.data.tasks[0]!.projectId).toBeNull();
  });

  it("reminders_defer_during_focus_and_pause_then_start_atomically", () => {
    const e = engine();
    const d = draft();
    d.dueDate = "2026-10-09";
    d.reminderTime = "09:00";
    const s = e.dispatch({ type: "saveTask", task: d }, friday(8, 59));
    const taskId = s.data.tasks[0]!.id;
    expect(s.data.tasks[0]!.reminderFired).toBe(false);
    e.dispatch({ type: "startTimer" }, friday(8, 59));
    const s2 = e.snapshot(friday(9, 0));
    expect(s2.data.tasks[0]!.reminderPending).toBe(true);
    expect(s2.data.pendingReminder()).toBeNull();
    e.dispatch({ type: "pauseTimer" }, friday(9, 0));
    expect(() => e.dispatch({ type: "startReminder", id: taskId }, friday(9, 1))).toThrow();
    const s3 = e.dispatch({ type: "resetTimer" }, friday(9, 1));
    expect(s3.data.pendingReminder()!.id).toBe(taskId);
    const s4 = e.dispatch({ type: "startReminder", id: taskId }, friday(9, 1));
    expect(s4.data.timer.running).toBe(true);
    expect(s4.data.timer.taskId).toBe(taskId);
    expect(s4.data.tasks[0]!.reminderPending).toBe(false);
  });

  it("reminder_persists_reschedule_rearms_and_old_days_expire", () => {
    const path = tempPath("reminders.json");
    let e = Engine.open(path);
    const d = draft();
    d.dueDate = "2026-10-09";
    d.reminderTime = "09:00";
    const s = e.dispatch({ type: "saveTask", task: structuredClone(d) }, friday(9, 1));
    const taskId = s.data.tasks[0]!.id;
    expect(s.data.pendingReminder()).not.toBeNull();
    // There is no dismiss action: an unhandled reminder stays pending, and
    // that state survives a restart.
    e = reopen(path);
    expect(e.snapshot(friday(9, 2)).data.pendingReminder()).not.toBeNull();
    // Rescheduling to a later time re-arms the reminder.
    d.id = taskId;
    d.reminderTime = "10:00";
    e.dispatch({ type: "saveTask", task: d }, friday(9, 2));
    expect(e.snapshot(friday(9, 30)).data.pendingReminder()).toBeNull();
    expect(e.snapshot(friday(10, 0)).data.pendingReminder()).not.toBeNull();
    // A new day clears yesterday's unhandled reminder.
    expect(e.snapshot(friday(10, 0) + 86400).data.pendingReminder()).toBeNull();
  });

  it("reminder_expires_after_its_planned_block", () => {
    const e = engine();
    const d = draft();
    d.dueDate = "2026-10-09";
    d.reminderTime = "09:00";
    d.focusMinutes = 25;
    d.estimate = 1;
    e.dispatch({ type: "saveTask", task: d }, friday(8, 50));
    // 1 session, 25 min: valid until 09:25.
    expect(e.snapshot(friday(9, 20)).data.pendingReminder()).not.toBeNull();
    const late = e.snapshot(friday(9, 26)).data;
    expect(late.tasks[0]!.reminderPending).toBe(false);
    expect(late.pendingReminder()).toBeNull();
  });

  it("reminder_window_covers_multi_pomodoro_breaks_and_old_slots_stay_void", () => {
    const e = engine();
    const d = draft();
    d.dueDate = "2026-10-09";
    d.reminderTime = "09:00";
    d.focusMinutes = 25;
    d.estimate = 3;
    e.dispatch({ type: "saveTask", task: d }, friday(8, 50));
    // 3 * 25 + 2 short breaks (5) = 85 min: valid until 10:25.
    expect(e.snapshot(friday(10, 20)).data.pendingReminder()).not.toBeNull();
    expect(e.snapshot(friday(10, 26)).data.pendingReminder()).toBeNull();
    // A slot that was already over before the app opened never fires.
    const late = engine();
    const d2 = draft();
    d2.dueDate = "2026-10-09";
    d2.reminderTime = "09:00";
    d2.focusMinutes = 25;
    d2.estimate = 1;
    late.dispatch({ type: "saveTask", task: d2 }, friday(8, 0));
    const s = late.snapshot(friday(12, 0)).data;
    expect(s.tasks[0]!.reminderPending).toBe(false);
    expect(s.pendingReminder()).toBeNull();
  });

  it("single_session_length_is_independent_of_reminder_time", () => {
    const e = engine();
    const d = draft();
    d.reminderTime = null;
    d.focusMinutes = 40;
    const s = e.dispatch({ type: "saveTask", task: d }, 1000);
    const taskId = s.data.tasks[0]!.id;
    e.dispatch({ type: "selectTask", id: taskId }, 1000);
    expect(e.snapshot(1000).data.timer.durationSecs).toBe(40 * 60);
  });

  it("reminder_validation_and_lock_deferral", () => {
    const e = engine();
    for (const time of ["9:00", "24:00", "12:60", "早上", "aa:bb"]) {
      const d = draft();
      d.dueDate = "2026-10-09";
      d.reminderTime = time;
      expect(() => e.dispatch({ type: "saveTask", task: d }, friday(8, 0))).toThrow();
    }
    const d = draft();
    d.dueDate = null;
    d.reminderTime = "09:00";
    expect(() =>
      e.dispatch({ type: "saveTask", task: structuredClone(d) }, friday(8, 0)),
    ).toThrow();
    d.dueDate = "2026-10-09";
    e.dispatch({ type: "saveTask", task: d }, friday(8, 59));
    e.dispatch({ type: "startQuickLock", minutes: 2, strict: false }, friday(8, 59));
    expect(e.snapshot(friday(9, 0)).data.pendingReminder()).toBeNull();
    expect(e.snapshot(friday(9, 1)).data.pendingReminder()).not.toBeNull();
  });

  it("custom_duration_and_repeat_keep_schedule_without_changing_global_settings", () => {
    const e = engine();
    const d = draft();
    d.dueDate = "2026-10-09";
    d.reminderTime = "09:00";
    d.focusMinutes = 40;
    d.repeat = "daily";
    const s = e.dispatch({ type: "saveTask", task: d }, friday(9, 0));
    const taskId = s.data.tasks[0]!.id;
    const s2 = e.dispatch({ type: "startReminder", id: taskId }, friday(9, 0));
    expect(s2.remainingSecs).toBe(2400);
    expect(s2.data.settings.focusMinutes).toBe(25);
    e.dispatch({ type: "resetTimer" }, friday(9, 1));
    const s3 = e.dispatch({ type: "toggleTask", id: taskId }, friday(9, 1));
    expect(s3.data.tasks).toHaveLength(3);
    const s4 = e.snapshot(friday(8, 0) + 86400);
    const next = s4.data.tasks[1]!;
    expect(next.focusMinutes).toBe(40);
    expect(next.reminderTime).toBe("09:00");
    expect(next.reminderFired).toBe(false);
    expect(next.reminderPending).toBe(false);
    expect(next.dueDate).toBe("2026-10-10");
  });

  it("plan_preserves_schedule_and_duration_backup_defaults_remain_flexible", () => {
    const e = engine();
    const d = draft();
    d.dueDate = "2026-10-09";
    d.reminderTime = "09:00";
    d.focusMinutes = 40;
    const s = e.dispatch({ type: "saveTask", task: d }, friday(8, 0));
    const plan = s.data.exportPlan();
    expect(plan.version).toBe(6);
    const imported = engine().dispatch(
      { type: "importPlan", plan: structuredClone(plan) },
      friday(8, 0),
    );
    const t = imported.data.tasks[0]!;
    expect(t.focusMinutes).toBe(40);
    expect(t.estimate).toBe(2);
    expect(t.reminderTime).toBe("09:00");
    plan.version = 1;
    expect(() => validatePlanFile(plan)).toThrow();
    const json = JSON.parse(JSON.stringify(serializeAppData(s.data))) as Record<string, unknown>;
    const task = (json["tasks"] as Record<string, unknown>[])[0] as Record<string, unknown>;
    for (const key of ["focusMinutes", "reminderTime", "reminderFired", "reminderPending"]) {
      delete task[key];
    }
    const old = parseBackup(json);
    expect(old.tasks[0]!.reminderTime).toBeNull();
    expect(old.tasks[0]!.focusMinutes).toBeNull();
    old.validate();
  });

  it("reminder_queue_and_completion_do_not_drop_other_tasks", () => {
    const e = engine();
    const d = draft();
    d.dueDate = "2026-10-09";
    d.reminderTime = "09:00";
    e.dispatch({ type: "saveTask", task: structuredClone(d) }, friday(8, 0));
    d.reminderTime = "09:01";
    e.dispatch({ type: "saveTask", task: d }, friday(8, 0));
    const s = e.snapshot(friday(9, 2));
    const taskId = s.data.pendingReminder()!.id;
    const s2 = e.dispatch({ type: "toggleTask", id: taskId }, friday(9, 2));
    expect(s2.data.pendingReminder()!.reminderTime).toBe("09:01");
    const bad = draft();
    bad.focusMinutes = 0;
    expect(() => e.dispatch({ type: "saveTask", task: bad }, friday(9, 2))).toThrow();
  });

  it("imported_partial_timer_keeps_remaining_time_and_defers_reminders", () => {
    const e = engine();
    const d = draft();
    d.dueDate = "2026-10-09";
    d.reminderTime = "09:00";
    const data = e.dispatch({ type: "saveTask", task: d }, friday(8, 0)).data;
    data.timer.remainingSecs = 6;
    data.timer.startedAt = null;
    const s = e.dispatch({ type: "import", data }, friday(9, 0));
    expect(s.data.pendingReminder()).toBeNull();
    const s2 = e.dispatch({ type: "startTimer" }, friday(9, 0));
    expect(s2.remainingSecs).toBe(6);
    expect(e.snapshot(friday(9, 0) + 6).data.timer.running).toBe(false);
  });

  it("course_blocks_round_trip_through_plan_v6", () => {
    const e = engine();
    e.dispatch(
      {
        type: "saveBlock",
        id: null,
        title: "图像大数据分析",
        days: [3],
        start: "16:25",
        end: "18:35",
        attention: "required",
        notes: "不能玩手机",
      },
      1000,
    );
    const exported = e.snapshot(1000).data.exportPlan();
    expect(exported.version).toBe(6);
    expect(exported.blocks).toHaveLength(1);
    validatePlanFile(exported);

    // Bands are a v5 idea: a v4 file may not smuggle them in.
    const legacyRaw = JSON.parse(JSON.stringify(serializePlanFile(exported))) as Record<
      string,
      unknown
    >;
    legacyRaw["version"] = 4;
    const legacy = parsePlanFile(legacyRaw);
    expect(() => validatePlanFile(legacy)).toThrow();

    const fresh = engine();
    fresh.dispatch({ type: "importPlan", plan: exported }, 1010);
    const stored = fresh.snapshot(1010).data;
    expect(stored.blocks).toHaveLength(1);
    expect(stored.blocks[0]!.days).toEqual([3]);
    expect(stored.blocks[0]!.attention).toBe("required");

    // replace: true makes the file the whole plan, so dropped bands go away.
    const emptied = structuredClone(exported);
    emptied.blocks = [];
    emptied.replace = true;
    fresh.dispatch({ type: "importPlan", plan: emptied }, 1020);
    expect(fresh.snapshot(1020).data.blocks).toHaveLength(0);

    // Deleting a band retires its ID like any other entity: the ledger keeps the
    // name from being silently reused for a different band later.
    const retired = fresh.snapshot(1020).data.identities;
    expect(retired.some((r) => r.kind === "block" && r.retired)).toBe(true);
  });

  it("every_task_entry_point_requires_a_date_but_not_a_reminder", () => {
    const e = engine();
    const at = friday(8, 0);
    const before = e.export(at);
    for (const date of [null, "", "2026-02-30"] as (string | null)[]) {
      const task = draft();
      task.dueDate = date;
      expect(() => e.dispatch({ type: "saveTask", task }, at)).toThrow();
      const plan = examplePlan();
      plan.tasks[0]!.dueDate = date;
      expect(() => e.dispatch({ type: "importPlan", plan }, at)).toThrow();
      const backup = new AppData();
      const t = draft();
      t.dueDate = date;
      // Construct through the public DTO to exercise backup validation as well.
      const raw = {
        id: "invalid-task",
        title: t.title,
        notes: t.notes,
        projectId: t.projectId,
        dueDate: t.dueDate,
        reminderTime: t.reminderTime,
        focusMinutes: t.focusMinutes,
        scrapMinutes: t.scrapMinutes,
        priority: t.priority,
        estimate: t.estimate,
        completed: false,
        createdAt: at,
        tags: t.tags,
        subtasks: t.subtasks,
        recurring: false,
      };
      const taskObj = parseTask(raw);
      backup.tasks.push(taskObj);
      expect(() => e.dispatch({ type: "import", data: backup }, at)).toThrow();
      expect(e.export(at)).toBe(before);
    }
    const s = e.dispatch({ type: "saveTask", task: draft() }, at);
    expect(s.data.tasks[0]!.reminderTime).toBeNull();
    expect(s.data.tasks[0]!.dueDate).toBe("2026-10-09");
    const planJson = JSON.parse(JSON.stringify(serializePlanFile(examplePlan()))) as Record<
      string,
      unknown
    >;
    planJson["goals"] = [];
    expect(() => parsePlanFile(planJson)).toThrow();
    expect(() => parseAction({ type: "saveGoal", name: "旧目标", nodes: [] })).toThrow();
  });

  it("local_v3_upgrade_removes_mainlines_and_preserves_tasks_and_history", () => {
    const path = tempPath("upgrade.json");
    const e = Engine.open(path);
    const at = friday(8, 0);
    const snapshot = e.dispatch({ type: "saveTask", task: draft() }, at);
    const taskId = snapshot.data.tasks[0]!.id;
    e.dispatch({ type: "toggleTask", id: taskId }, at);
    const saved = e.dispatch({ type: "saveTask", task: draft() }, at);
    const deletedId = saved.data.tasks[1]!.id;
    e.dispatch({ type: "deleteTask", id: deletedId }, at);
    const legacy = JSON.parse(e.export(at)) as Record<string, unknown>;
    legacy["version"] = 3;
    legacy["templates"] = [
      {
        id: "old-manual-template",
        shape: { title: "通用练习", goalId: "retired-goal" },
        printing: { kind: "once", date: null, time: null },
      },
    ];
    legacy["prints"] = [{ templateId: "old-manual-template", date: null }];
    legacy["visions"] = [{ id: "old-vision", name: "方向", goalId: "retired-goal" }];
    for (const record of legacy["identities"] as Record<string, unknown>[]) {
      if (typeof record["restoreTask"] === "string") {
        const task = JSON.parse(record["restoreTask"]) as Record<string, unknown>;
        task["goalId"] = "retired-goal";
        task["nodeId"] = "retired-node";
        task["dueDate"] = null;
        record["restoreTask"] = JSON.stringify(task);
      }
    }
    const identities = legacy["identities"] as Record<string, unknown>[];
    for (const kind of ["goal", "node", "signal"]) {
      identities.push({ id: `retired-${kind}`, kind, retired: false });
    }
    legacy["goals"] = [{ id: "retired-goal", name: "旧目标", nodes: [] }];
    legacy["nodeBindings"] = [];
    legacy["signalEvents"] = [];
    const tasks = legacy["tasks"] as Record<string, unknown>[];
    (tasks[0] as Record<string, unknown>)["dueDate"] = null;
    (tasks[0] as Record<string, unknown>)["goalId"] = "retired-goal";
    (tasks[0] as Record<string, unknown>)["nodeId"] = "retired-node";
    // Exchange files must not take the local migration path.
    expect(() => parseAppData(legacy)).toThrow();
    const sessions = structuredClone(legacy["sessions"]);
    stripNullActive(legacy);
    writeFileSync(path, JSON.stringify(legacy), "utf8");
    const reopened = reopen(path);
    const data = reopened.snapshot(at).data;
    expect(data.version).toBe(4);
    expect(data.tasks[0]!.dueDate).toBe("2026-10-09");
    expect(data.tasks[0]!.completed).toBe(true);
    expect(data.prints).toHaveLength(0);
    expect(data.visions[0]!.projectId).toBeNull();
    const printing = data.templates[0]!.printing;
    expect(printing.kind).toBe("once");
    if (printing.kind === "once") {
      expect(printing.date).toBe(dateAt(now()));
      expect(printing.time).toBeNull();
    }
    expect(
      data.identities.every((r) => !["goal", "node", "signal"].includes(r.kind)),
    ).toBe(true);
    const restoredTask = parseTask(
      JSON.parse(data.identities.find((r) => r.id === deletedId)!.restoreTask!),
    );
    expect(restoredTask.dueDate).toBe("2026-10-09");
    reopened.dispatch({ type: "restoreTask", task: restoredTask }, at);
    expect(serializeAppData(data).sessions).toEqual(sessions);
    const exported = reopened.export(at);
    expect(exported).not.toContain("goalId");
    expect(exported).not.toContain("nodeBindings");
    reopened.dispatch({ type: "toggleTask", id: taskId }, at);
    const original = structuredClone(reopened.data.tasks[0]!);
    reopened.dispatch({ type: "deleteTask", id: taskId }, at);
    reopened.dispatch({ type: "restoreTask", task: original }, at);
    reopened.dispatch({ type: "deleteTask", id: taskId }, at);
    const plan = examplePlan();
    plan.tasks[0]!.id = taskId;
    expect(() => reopened.dispatch({ type: "importPlan", plan }, at)).toThrow();
    expect(reopen(path).data.version).toBe(4);
  });

  it("formal_exam_start_rejects_running_or_paused_focus_and_accepts_idle_focus", () => {
    const e = engine();
    const data = e.snapshot(friday(7, 0)).data;
    const projectId = data.projects[0]!.id;
    data.visions.push({
      id: "exam-vision",
      name: "考试目标",
      notes: "",
      projectId: null,
    });
    const directory = join(tmpdir(), "exam-fixture");
    data.education = parseEducation({
      projects: [
        {
          projectId,
          directory,
          examMode: true,
          visionId: "exam-vision",
          target: "模拟考试",
          examDate: "2026-12-25",
          syllabusId: "syllabus",
          pastPaperIds: ["past"],
          mockPaperIds: ["mock"],
        },
      ],
      resources: [
        {
          id: "syllabus",
          projectId,
          title: "考纲",
          kind: "syllabus",
          path: "syllabus.pdf",
          source: "官方",
          edition: "2026",
          topics: ["极限"],
        },
        {
          id: "past",
          projectId,
          title: "真题",
          kind: "pastPaper",
          path: "past.pdf",
          source: "历年真题",
          edition: "2025",
          topics: ["极限"],
        },
        {
          id: "mock",
          projectId,
          title: "模拟题",
          kind: "mockPaper",
          path: "mock.pdf",
          source: "模拟卷",
          edition: "2026",
          topics: ["极限"],
        },
      ],
      semesters: [
        {
          id: "term",
          projectId,
          title: "基础阶段",
          startDate: "2026-10-01",
          endDate: "2026-12-01",
          revision: 1,
          baseline: "起点",
          evidence: ["课程目录"],
          rationale: "按周推进",
          milestones: [
            { week: 1, topics: ["极限"], resourceIds: ["mock"], objective: "掌握基础", lessonCount: 1 },
          ],
        },
      ],
      lessons: [],
      assessments: [
        {
          id: "exam",
          projectId,
          semesterId: "term",
          semesterRevision: 1,
          lessonId: null,
          taskId: null,
          retestOfGradeId: null,
          title: "模拟考试",
          kind: "mockExam",
          revision: 1,
          startsAt: friday(9, 0),
          endsAt: friday(11, 0),
          instructions: "独立完成",
          reviewEvidence: "独立复解并检查答案",
          questions: [
            {
              id: "q1",
              prompt: "求极限",
              topics: ["极限"],
              sourceIds: ["mock"],
              extension: false,
              estimatedMinutes: 30,
              answer: "1",
              acceptableAlternatives: "等价推导",
              scoring: [{ id: "p1", description: "正确使用极限法则", points: 5 }],
            },
          ],
          publishedAt: 0,
          printedAt: null,
          startedAt: null,
          stoppedAt: null,
        },
      ],
      submissions: [],
      grades: [],
      reviews: [],
      events: [],
    });
    e.dispatch({ type: "import", data }, friday(7, 1));
    const settings: Settings = { ...defaultSettings(), focusMinutes: 120 };
    e.dispatch({ type: "saveSettings", settings }, friday(8, 0));
    e.dispatch({ type: "education", command: { op: "confirmPrinted", id: "exam" } }, friday(8, 10));
    e.dispatch({ type: "startTimer" }, friday(8, 15));
    const runningErr = (): void => {
      e.dispatch({ type: "education", command: { op: "startExam", id: "exam" } }, friday(9, 0));
    };
    expect(runningErr).toThrow("请先结束当前计时或锁机，再开始考试");
    e.dispatch({ type: "pauseTimer" }, friday(9, 1));
    const pausedErr = (): void => {
      e.dispatch({ type: "education", command: { op: "startExam", id: "exam" } }, friday(9, 2));
    };
    expect(pausedErr).toThrow("请先结束当前计时或锁机，再开始考试");
    e.dispatch({ type: "resetTimer" }, friday(9, 3));
    const started = e.dispatch(
      { type: "education", command: { op: "startExam", id: "exam" } },
      friday(9, 4),
    );
    expect(started.data.education.assessments[0]!.startedAt).toBe(friday(9, 4));
  });

  it("auto_focus_stops_at_task_round_limit_but_free_focus_can_continue", () => {
    const e = engine();
    const settings: Settings = {
      ...defaultSettings(),
      focusMinutes: 1,
      shortBreakMinutes: 1,
      longBreakMinutes: 1,
      autoFocus: true,
      autoBreak: true,
    };
    e.dispatch({ type: "saveSettings", settings }, friday(8, 0));
    const task = draft();
    task.focusMinutes = 1;
    task.estimate = 2;
    const taskId = e.dispatch({ type: "saveTask", task }, friday(8, 0)).data.tasks[0]!.id;
    e.dispatch({ type: "selectTask", id: taskId }, friday(8, 0));
    e.dispatch({ type: "startTimer" }, friday(8, 0));
    e.snapshot(friday(8, 1));
    const s = e.snapshot(friday(8, 2));
    expect(s.data.timer.running).toBe(true);
    expect(s.data.timer.mode).toBe("focus");
    e.snapshot(friday(8, 3));
    const s4 = e.snapshot(friday(8, 4));
    expect(s4.data.timer.running).toBe(false);
    expect(s4.stats.totalPomodoros).toBe(2);
    expect(s4.data.tasks[0]!.completed).toBe(false);
    e.dispatch({ type: "selectTask", id: null }, friday(8, 4));
    e.dispatch({ type: "startTimer" }, friday(8, 4));
    e.snapshot(friday(8, 5));
    expect(e.snapshot(friday(8, 6)).data.timer.running).toBe(true);
  });

  it("completing_task_during_rest_blocks_free_focus_continuation_after_restart", () => {
    const path = tempPath("rest.json");
    let e = Engine.open(path);
    const settings: Settings = {
      ...defaultSettings(),
      focusMinutes: 1,
      shortBreakMinutes: 1,
      autoFocus: true,
      autoBreak: true,
    };
    e.dispatch({ type: "saveSettings", settings }, friday(8, 0));
    const task = draft();
    task.focusMinutes = 1;
    const taskId = e.dispatch({ type: "saveTask", task }, friday(8, 0)).data.tasks[0]!.id;
    e.dispatch({ type: "selectTask", id: taskId }, friday(8, 0));
    e.dispatch({ type: "startTimer" }, friday(8, 0));
    e.snapshot(friday(8, 1));
    const s = e.dispatch({ type: "toggleTask", id: taskId }, friday(8, 1) + 1);
    expect(s.data.timer.taskId).toBeNull();
    expect(s.data.timer.autoFocusBlocked).toBe(true);
    e = reopen(path);
    const s2 = e.snapshot(friday(8, 2));
    expect(s2.data.timer.running).toBe(false);
    expect(s2.stats.totalPomodoros).toBe(1);
  });

  it("scheduled_start_selects_due_task_and_never_interrupts_a_paused_timer_or_lock", () => {
    const e = engine();
    const settings: Settings = { ...defaultSettings(), autoStartTasks: true };
    e.dispatch({ type: "saveSettings", settings }, friday(8, 0));
    const task = draft();
    task.reminderTime = "09:00";
    task.focusMinutes = 45;
    const taskId = e.dispatch({ type: "saveTask", task }, friday(8, 0)).data.tasks[0]!.id;
    e.dispatch({ type: "startTimer" }, friday(8, 50));
    e.dispatch({ type: "pauseTimer" }, friday(8, 51));
    const s = e.snapshot(friday(9, 0));
    expect(s.data.timer.running).toBe(false);
    expect(s.data.tasks[0]!.reminderPending).toBe(true);
    const s2 = e.dispatch({ type: "resetTimer" }, friday(9, 1));
    expect(s2.data.timer.running).toBe(true);
    expect(s2.data.timer.taskId).toBe(taskId);
    expect(s2.remainingSecs).toBe(2700);
    expect(s2.data.tasks[0]!.reminderPending).toBe(false);
    e.dispatch({ type: "resetTimer" }, friday(9, 2));
    expect(e.snapshot(friday(9, 3)).data.timer.running).toBe(false);
    const later = draft();
    later.reminderTime = "10:00";
    later.focusMinutes = 1;
    later.estimate = 1;
    e.dispatch({ type: "saveTask", task: later }, friday(9, 3));
    e.dispatch({ type: "startQuickLock", minutes: 5, strict: true }, friday(9, 59));
    expect(e.snapshot(friday(10, 0)).data.timer.running).toBe(false);
    const s3 = e.snapshot(friday(10, 4));
    expect(s3.data.timer.running).toBe(false);
    expect(s3.data.tasks[1]!.reminderExpired).toBe(true);
  });

  it("scheduled_task_takes_priority_over_rest_continuation_and_import_disarms_it", () => {
    const e = engine();
    const settings: Settings = {
      ...defaultSettings(),
      autoStartTasks: true,
      autoBreak: true,
      autoFocus: true,
      focusMinutes: 1,
      shortBreakMinutes: 1,
    };
    e.dispatch({ type: "saveSettings", settings }, friday(8, 0));
    const task = draft();
    task.reminderTime = "08:02";
    task.focusMinutes = 45;
    const taskId = e.dispatch({ type: "saveTask", task }, friday(8, 0)).data.tasks[0]!.id;
    e.dispatch({ type: "startTimer" }, friday(8, 0));
    e.snapshot(friday(8, 1));
    const s = e.snapshot(friday(8, 2));
    expect(s.data.timer.running).toBe(true);
    expect(s.data.timer.taskId).toBe(taskId);
    expect(s.remainingSecs).toBe(2700);
    const backup = parseBackup(e.export(friday(8, 2)));
    const restored = engine();
    const s2 = restored.dispatch({ type: "import", data: backup }, friday(8, 2));
    expect(s2.data.settings.autoStartTasks).toBe(false);
    expect(s2.data.timer.running).toBe(false);
    const oldRaw = serializeAppData(new AppData());
    const oldRawSettings = oldRaw["settings"] as Record<string, unknown>;
    delete oldRawSettings["autoStartTasks"];
    expect(parseBackup(oldRaw).settings.autoStartTasks).toBe(false);
  });
});
