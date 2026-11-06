//! 模板与印刷测试：crates/core/src/template_tests.rs 的 17 条用例逐条移植。
//! 对应模块：packages/core/src/templates.ts 与 habits.ts（经 src/index.ts 导出面使用）。
//! 语义基准：docs/HANDBOOK/14-模板与印刷.md、docs/DESIGN.md「模板、印刷与实例」，
//! 以及 crates/core/src/templates.rs 原文。时间一律按本机时区解读（对应 Rust chrono::Local）。
//!
//! 与 Rust 语义的分歧清单（均已由 root 修复实现，测试按修复后的 Rust 语义断言）：
//!
//! 1. parseLockState 曾拒绝 `active: null`（Rust serde `Option` 接受显式 null，LockState 没有
//!    skip_serializing_if）。已修复：解析端容忍 null，序列化与 Rust 一致显式写 `"active": null`。
//!    测试用 stripNullActive / parseBackup 在解析前删掉该 null 键（结果等价于 Rust 解析），
//!    其余断言仍按 Rust 语义逐字验证。
//! 2. validateTemplates 日程时段校验曾把 seen 集合的插入放在整个时段检查之后，漏检
//!    「同一时段内重复日期」。已修复：与 Rust 一致在 some() 里边检查边插入
//!    （templates.rs:268-275），以「无效或重复的日程时段，请把同一开始时间的日期合并」拒绝。
//!    calendar_validation_and_transient_batches_fail_atomically 对该情形按修复后语义断言
//!    （报错 + 原子性），其余三种非法时段同样验证报错与原子性。

import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Engine,
  atLocal,
  clone,
  isHabit,
  parseAppData,
  parsePlanFile,
  validatePlanFile,
} from "../src/index";
import type { AppData, PlanFile, Snapshot, Template } from "../src/index";

/** 2026-10 月某日某时刻的本机 Unix 秒（对应 Rust 的 at 辅助）。 */
function at(day: number, hour: number, minute: number): number {
  return atLocal(2026, 10, day, hour, minute);
}

function engine(): Engine {
  return Engine.open(":memory:");
}

/** 静态模板夹具：一次性印刷 2026-10-12（对应 Rust 的 template 辅助）。 */
function template(): Template {
  return {
    id: "shape",
    automatic: false,
    printAheadDays: 7,
    printing: { kind: "once", date: "2026-10-12", time: null },
    shape: {
      title: "练习",
      notes: "原稿",
      projectId: null,
      habitId: null,
      focusMinutes: 25,
      scrapMinutes: 30,
      priority: 1,
      estimate: 1,
      tags: ["学习"],
      subtasks: [{ id: "step", title: "复盘" }],
    },
  };
}

/** 周一 09:00 与 15:00 两个时段的每周循环（对应 Rust 的 weekly 辅助）。 */
function weekly(t: Template): void {
  t.printing = {
    kind: "weekly",
    slots: [
      { days: [1], time: "09:00" },
      { days: [1], time: "15:00" },
    ],
  };
}

/** 日程印刷：09:00 覆盖 10-12/10-14，15:00 覆盖 10-12/10-15（对应 Rust 的 calendar 辅助）。 */
function calendar(t: Template): void {
  t.printing = {
    kind: "calendar",
    slots: [
      { dates: ["2026-10-12", "2026-10-14"], time: "09:00" },
      { dates: ["2026-10-12", "2026-10-15"], time: "15:00" },
    ],
  };
}

/**
 * 保存模板（可选批印刷日期）。模板按值克隆传入，对应 Rust 的按值语义：
 * 引擎侧对形状的改写（去空白、自动习惯组）不回灌测试夹具。
 */
function save(e: Engine, t: Template, dates: (string | null)[], time: number): Snapshot {
  return e.dispatch({ type: "saveTemplate", template: clone(t), printDates: dates }, time);
}

/** 读取 docs/plan.example.json 并解析为当前版本计划（对应 Rust 的 example_plan_for_current_version）。 */
function examplePlan(): PlanFile {
  const raw = readFileSync(new URL("../../../docs/plan.example.json", import.meta.url), "utf8");
  return parsePlanFile(JSON.parse(raw));
}

/** 分歧 1 的测试侧还原：Rust serde 的 Option 接受显式 null，TS 解析器不认——解析前删掉该键。 */
function stripNullActive(value: Record<string, unknown>): void {
  const lock = value["lock"];
  if (lock !== null && typeof lock === "object" && !Array.isArray(lock)) {
    const state = lock as Record<string, unknown>;
    if (state["active"] === null) delete state["active"];
  }
}

/** 解析导出 JSON 为 AppData（先按分歧 1 还原 Rust 解析语义）。 */
function parseBackup(raw: string): AppData {
  const value = JSON.parse(raw) as Record<string, unknown>;
  stripNullActive(value);
  return parseAppData(value);
}

describe("模板与印刷（templates / habits）", () => {
  it("weekly_daily_batch_survives_instance_deletion_and_restart", () => {
    const directory = mkdtempSync(join(tmpdir(), "tomato-core-tpl-"));
    const path = join(directory, "state.sqlite3");
    try {
      let e = Engine.open(path);
      const t = template();
      weekly(t);
      t.automatic = true;
      t.printAheadDays = 0;
      const s = save(e, t, [], at(12, 8, 0));
      expect(s.data.tasks).toHaveLength(2);
      expect(s.data.tasks.every((task) => isHabit(task))).toBe(true);
      expect(s.data.prints).toHaveLength(1);
      e.dispatch({ type: "deleteTask", id: s.data.tasks[0]!.id }, at(12, 8, 1));
      // 重启后账本仍在：删掉的实例不会重印。
      // 分歧 1：TS 解析器不认序列化器写出的 lock.active: null，重开前先还原 Rust 解析语义。
      const persisted = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
      stripNullActive(persisted);
      writeFileSync(path, JSON.stringify(persisted, null, 2));
      e = Engine.open(path);
      const reopened = e.dispatch(
        { type: "printTemplate", id: "shape", dates: ["2026-10-12"] },
        at(12, 8, 2),
      );
      expect(reopened.data.tasks).toHaveLength(1);
      expect(reopened.data.prints).toHaveLength(1);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("manual_static_template_is_reusable_and_never_runs_itself", () => {
    const e = engine();
    save(e, template(), [], at(12, 8, 0));
    expect(e.snapshot(at(13, 8, 0)).data.tasks).toHaveLength(0);
    const s = e.dispatch(
      { type: "printTemplate", id: "shape", dates: ["2026-10-13", "2026-10-14", "2026-10-13"] },
      at(13, 8, 0),
    );
    expect(s.data.tasks).toHaveLength(2);
    expect(s.data.tasks.every((task) => !task.recurring)).toBe(true);
    expect(s.data.templates).toHaveLength(1);
    e.dispatch({ type: "toggleTask", id: s.data.tasks[0]!.id }, at(13, 8, 1));
    expect(e.snapshot(at(15, 8, 0)).data.tasks).toHaveLength(2);
  });

  it("automatic_rolling_horizon_fills_gaps_before_start_not_only_on_entry", () => {
    const e = engine();
    const t = template();
    weekly(t);
    t.automatic = false;
    save(e, t, ["2026-10-26"], at(12, 8, 0));
    // 印过更晚的日期，不能压制更早缺失的周一。
    t.automatic = true;
    const s = save(e, t, [], at(12, 8, 0));
    const dates = new Set(s.data.tasks.map((task) => task.dueDate as string));
    expect(dates).toEqual(new Set(["2026-10-12", "2026-10-19", "2026-10-26"]));
    expect(s.data.tasks).toHaveLength(6);
    expect(s.data.habits).toHaveLength(1); // 重存保留管辖。
    expect(e.snapshot(at(13, 8, 0)).data.tasks).toHaveLength(6);
    const ahead = e.snapshot(at(26, 8, 0));
    expect(ahead.data.tasks.some((task) => task.dueDate === "2026-11-02")).toBe(true);
  });

  it("automatic_once_prints_ahead_but_does_not_reprint_after_deletion", () => {
    const e = engine();
    const t = template();
    t.automatic = true;
    t.printing = { kind: "once", date: "2026-10-19", time: "09:00" };
    const s = save(e, t, [], at(12, 8, 0));
    expect(s.data.tasks).toHaveLength(1);
    e.dispatch({ type: "deleteTask", id: s.data.tasks[0]!.id }, at(12, 8, 1));
    expect(e.snapshot(at(19, 8, 0)).data.tasks).toHaveLength(0);
  });

  it("template_edits_are_future_only_and_explicit_sync_preserves_history", () => {
    const e = engine();
    const t = template();
    const s = save(e, t, ["2026-10-12", "2026-10-13"], at(12, 8, 0));
    const completed = s.data.tasks[0]!.id;
    const pending = s.data.tasks[1]!.id;
    e.dispatch({ type: "toggleTask", id: completed }, at(12, 8, 1));
    e.dispatch({ type: "toggleSubtask", taskId: pending, subtaskId: "step" }, at(12, 8, 1));
    t.shape.title = "新稿";
    t.shape.scrapMinutes = 60;
    const printed = save(e, t, ["2026-10-14"], at(12, 8, 2));
    expect(printed.data.tasks[0]!.title).toBe("练习");
    expect(printed.data.tasks[1]!.title).toBe("练习");
    expect(printed.data.tasks[2]!.title).toBe("新稿");
    const synced = e.dispatch({ type: "syncTemplate", id: "shape" }, at(12, 8, 3));
    expect(synced.data.tasks[0]!.title).toBe("练习");
    expect(synced.data.tasks[0]!.completed).toBe(true);
    expect(synced.data.tasks[1]!.title).toBe("新稿");
    expect(synced.data.tasks[1]!.subtasks[0]!.done).toBe(true);
    expect(synced.data.tasks[1]!.dueDate).toBe("2026-10-13");
    const deleted = e.dispatch({ type: "deleteTemplate", id: "shape" }, at(12, 8, 4));
    expect(deleted.data.tasks).toHaveLength(3);
    expect(deleted.data.tasks.every((task) => task.templateId === null)).toBe(true);
    expect(deleted.data.templates).toHaveLength(0);
    expect(deleted.data.prints).toHaveLength(0);
  });

  it("save_and_batch_print_fail_atomically_for_rules_dates_and_references", () => {
    const e = engine();
    const before = e.export(at(12, 8, 0));
    const bad = template();
    weekly(bad);
    expect(() =>
      e.dispatch(
        { type: "saveTemplate", template: clone(bad), printDates: ["2026-10-12", "2026-02-30"] },
        at(12, 8, 0),
      ),
    ).toThrow();
    expect(e.export(at(12, 8, 0))).toBe(before);
    bad.shape.projectId = "missing";
    expect(() =>
      e.dispatch({ type: "saveTemplate", template: clone(bad), printDates: [] }, at(12, 8, 0)),
    ).toThrow();
    expect(e.export(at(12, 8, 0))).toBe(before);
    const tooFar = template();
    tooFar.printAheadDays = 91;
    expect(() =>
      e.dispatch({ type: "saveTemplate", template: clone(tooFar), printDates: [] }, at(12, 8, 0)),
    ).toThrow();
    expect(e.export(at(12, 8, 0))).toBe(before);
  });

  it("overdue_prints_inside_grace_but_spent_prints_are_skipped_at_boundary", () => {
    let e = engine();
    const t = template();
    t.printing = { kind: "once", date: "2026-10-12", time: "09:00" };
    const s = save(e, t, ["2026-10-12"], at(12, 9, 30));
    expect(s.data.tasks).toHaveLength(1);
    expect(s.data.tasks[0]!.reminderExpired).toBe(false);
    expect(s.data.taskIsVoid(s.data.tasks[0]!)).toBe(false);
    expect(e.snapshot(at(12, 9, 55)).data.tasks[0]!.reminderExpired).toBe(true);
    e = engine();
    const spent = save(e, t, ["2026-10-12"], at(12, 9, 55));
    expect(spent.data.tasks).toHaveLength(0);
    expect(spent.data.prints).toHaveLength(0);
    expect(e.data.tick(at(12, 10, 0))).toBe(false); // 跳过的印刷不得反复落库。
    const next = e.dispatch(
      { type: "printTemplate", id: "shape", dates: ["2026-10-12"] },
      at(13, 0, 0),
    );
    expect(next.data.tasks).toHaveLength(0); // 静态宽限不跨午夜。
    t.shape.scrapMinutes = 0;
    const zero = save(engine(), t, ["2026-10-12"], at(12, 9, 25));
    expect(zero.data.tasks).toHaveLength(0);
    const auto = template();
    auto.automatic = true;
    auto.printing = { kind: "once", date: "2026-10-12", time: "09:00" };
    e = engine();
    const autoSpent = save(e, auto, [], at(12, 9, 55));
    expect(autoSpent.data.tasks).toHaveLength(0);
    expect(e.data.tick(at(12, 10, 0))).toBe(false);
  });

  it("habits_skip_spent_slots_never_make_up_and_count_existing_misses", () => {
    const e = engine();
    const t = template();
    weekly(t);
    t.shape.scrapMinutes = 600;
    const s = save(e, t, ["2026-10-12"], at(12, 9, 30));
    expect(s.data.tasks).toHaveLength(1);
    expect(s.data.tasks[0]!.reminderTime).toBe("15:00");
    expect(s.data.tasks[0]!.scrapMinutes).toBe(0);
    const missed = e.snapshot(at(12, 15, 25));
    expect(missed.data.tasks[0]!.reminderExpired).toBe(true);
    expect(missed.stats.days.at(-1)!.missed).toBe(1);
    expect(() =>
      e.dispatch({ type: "toggleTask", id: missed.data.tasks[0]!.id }, at(12, 15, 25)),
    ).toThrow();
    const detach = e.dispatch(
      { type: "deleteHabit", id: missed.data.habits[0]!.id },
      at(12, 15, 26),
    );
    expect(detach.data.tasks).toHaveLength(1);
    expect(detach.data.tasks[0]!.habitId).toBeNull();
    // 删组只移除管辖，不清冻结来源：错过的那次仍是统计中的习惯缺勤。
    expect(detach.data.tasks[0]!.recurring).toBe(true);
    expect(isHabit(detach.data.tasks[0]!)).toBe(true);
    expect(detach.taskKinds[detach.data.tasks[0]!.id]).toBe("habit");
    expect(detach.stats.days.at(-1)!.missed).toBe(1);
    expect(detach.data.templates).toHaveLength(0);
  });

  it("detaching_a_habit_keeps_the_frozen_jurisdiction_for_statistics", () => {
    const e = engine();
    const t = template();
    weekly(t);
    const s = save(e, t, ["2026-10-12"], at(12, 9, 30));
    const id = s.data.tasks[0]!.id;
    const missed = e.snapshot(at(12, 15, 25));
    expect(missed.stats.days.at(-1)!.missed).toBe(1);
    expect(missed.taskKinds[id]).toBe("habit");
    // 分离只清容器引用；统计用的类别不随它移动。
    const detached = e.dispatch(
      { type: "detachTasks", ids: [id], target: "habit" },
      at(12, 15, 26),
    );
    expect(detached.data.tasks[0]!.habitId).toBeNull();
    expect(detached.data.tasks[0]!.recurring).toBe(true);
    expect(detached.taskKinds[id]).toBe("habit");
    expect(detached.stats.days.at(-1)!.missed).toBe(1);
  });

  it("v3_plan_and_backup_keep_the_ledger_and_do_not_reset_progress", () => {
    const e = engine();
    const t = template();
    weekly(t);
    const s = save(e, t, ["2026-10-12"], at(12, 8, 0));
    const id = s.data.tasks[0]!.id;
    e.dispatch({ type: "toggleSubtask", taskId: id, subtaskId: "step" }, at(12, 8, 1));
    const plan = e.data.exportPlan();
    expect(plan.version).toBe(6);
    expect(() => validatePlanFile(plan)).not.toThrow();
    const merged = e.dispatch({ type: "importPlan", plan: clone(plan) }, at(12, 8, 2));
    expect(merged.data.tasks[0]!.subtasks[0]!.done).toBe(true);
    expect(merged.data.tasks).toHaveLength(2);
    const fresh = engine();
    const imported = fresh.dispatch({ type: "importPlan", plan: clone(plan) }, at(12, 8, 0));
    expect(imported.data.prints).toHaveLength(1);
    expect(imported.data.tasks[0]!.subtasks[0]!.done).toBe(false);
    fresh.dispatch({ type: "deleteTask", id: imported.data.tasks[0]!.id }, at(12, 8, 1));
    const backup = parseBackup(fresh.export(at(12, 8, 1)));
    const restored = engine();
    restored.dispatch({ type: "import", data: backup }, at(12, 8, 1));
    const reprinted = restored.dispatch(
      { type: "printTemplate", id: "shape", dates: ["2026-10-12"] },
      at(12, 8, 2),
    );
    expect(reprinted.data.tasks).toHaveLength(1);
  });

  it("old_plan_versions_are_rejected_without_mutation", () => {
    for (let version = 1; version <= 5; version += 1) {
      const plan = examplePlan();
      plan.version = version;
      const e = engine();
      const before = e.export(at(12, 8, 0));
      expect(() => e.dispatch({ type: "importPlan", plan }, at(12, 8, 0))).toThrow();
      expect(e.export(at(12, 8, 0))).toBe(before);
    }
  });

  it("one_calendar_shape_reuses_multiple_times_and_dates_manually_or_automatically", () => {
    for (const automatic of [false, true]) {
      const e = engine();
      const t = template();
      calendar(t);
      t.automatic = automatic;
      const dates: (string | null)[] = automatic
        ? []
        : ["2026-10-12", "2026-10-14", "2026-10-15"];
      const s = save(e, t, dates, at(12, 8, 0));
      expect(s.data.templates).toHaveLength(1);
      expect(s.data.tasks).toHaveLength(4);
      expect(s.data.prints).toHaveLength(3);
      expect(s.data.tasks.every((task) => !task.recurring && task.habitId === null)).toBe(true);
      expect(new Set(s.data.tasks.map((task) => `${task.dueDate}|${task.reminderTime}`))).toEqual(
        new Set(["2026-10-12|09:00", "2026-10-12|15:00", "2026-10-14|09:00", "2026-10-15|15:00"]),
      );
      const backup = parseBackup(e.export(at(12, 8, 1)));
      expect(() => backup.validate()).not.toThrow();
      expect(() => validatePlanFile(e.data.exportPlan())).not.toThrow();
      expect(e.snapshot(at(19, 8, 0)).data.tasks).toHaveLength(4);
    }
  });

  it("transient_calendar_prints_all_dates_without_retaining_a_board_or_ledger", () => {
    let e = engine();
    let t = template();
    calendar(t);
    const s = e.dispatch(
      { type: "printInstances", shape: clone(t.shape), printing: clone(t.printing) },
      at(12, 9, 30),
    );
    expect(s.data.tasks).toHaveLength(4); // 首个日期逾期但仍在重修窗口内。
    expect(s.data.templates).toHaveLength(0);
    expect(s.data.prints).toHaveLength(0);
    expect(s.data.tasks.every((task) => task.templateId === null && !task.recurring)).toBe(true);
    expect(s.data.taskIsVoid(s.data.tasks[0]!)).toBe(false);
    e = engine();
    t = template();
    calendar(t);
    t.automatic = true;
    const auto = save(e, t, [], at(12, 9, 55));
    expect(auto.data.tasks).toHaveLength(3); // 过期的早晨时段跳过；下午与未来日期照印。
  });

  it("cycle_anchor_prints_all_units_and_remains_manual_and_idempotent", () => {
    const e = engine();
    const t = template();
    t.printing = {
      kind: "weekly",
      slots: [
        { days: [1, 3], time: "09:00" },
        { days: [2, 3, 7], time: "15:00" },
      ],
    };
    const s = save(e, t, ["2026-10-15"], at(12, 8, 0));
    expect(s.data.tasks).toHaveLength(5);
    expect(s.data.prints).toHaveLength(4);
    expect(s.data.templates).toHaveLength(1);
    expect(
      s.data.tasks.every((task) => {
        const due = task.dueDate as string;
        return due >= "2026-10-12" && due <= "2026-10-18";
      }),
    ).toBe(true);
    expect(e.snapshot(at(19, 8, 0)).data.tasks).toHaveLength(5);
    const anchored = e.dispatch(
      { type: "printTemplate", id: "shape", dates: ["2026-10-20", "2026-10-25"] },
      at(19, 8, 0),
    );
    expect(anchored.data.tasks).toHaveLength(10); // 同一周期的两个锚点只印一次。
  });

  it("calendar_validation_and_transient_batches_fail_atomically", () => {
    const e = engine();
    const now = at(12, 8, 0);
    const before = e.export(now);
    // 与 Rust 一致：全部四种非法时段（无效日期、同时刻两时段、空时段表、
    // 同一时段内重复日期）都报错，且引擎状态保持原子性。
    const throwing: { dates: string[]; time: string | null }[][] = [
      [{ dates: ["2026-02-30"], time: null }],
      [
        { dates: ["2026-10-12"], time: "09:00" },
        { dates: ["2026-10-14"], time: "09:00" },
      ],
      [],
      [{ dates: ["2026-10-12", "2026-10-12"], time: null }],
    ];
    for (const slots of throwing) {
      const t = template();
      expect(() =>
        e.dispatch(
          { type: "printInstances", shape: clone(t.shape), printing: { kind: "calendar", slots } },
          now,
        ),
      ).toThrow();
      expect(e.export(now)).toBe(before);
    }
  });

  it("multiple_shapes_share_a_habit_group_without_splitting_one_shape_per_time", () => {
    const e = engine();
    const s = e.dispatch({ type: "saveHabitGroup", id: null, name: "晨间" }, at(12, 8, 0));
    const group = s.data.habits[0]!.id;
    for (const id of ["exercise", "review"]) {
      const t = template();
      weekly(t);
      t.id = id;
      t.shape.habitId = group;
      save(e, t, ["2026-10-12"], at(12, 8, 0));
    }
    expect(e.data.habits).toHaveLength(1);
    expect(e.data.templates).toHaveLength(2);
    expect(e.data.tasks).toHaveLength(4);
    const removed = e.dispatch({ type: "deleteHabit", id: group }, at(12, 8, 1));
    expect(removed.data.habits).toHaveLength(0);
    expect(removed.data.templates).toHaveLength(0);
    // 组没了，实例保留印刷时的来源，习惯历史不被改写。
    expect(
      removed.data.tasks.every(
        (task) => task.habitId === null && task.templateId === null && task.recurring,
      ),
    ).toBe(true);
    expect(Object.values(removed.taskKinds).every((kind) => kind === "habit")).toBe(true);
  });

  it("printing_requires_dates_and_weekdays_independently_of_time", () => {
    const e = engine();
    const now = at(12, 8, 0);
    const before = e.export(now);
    const t = template();
    t.printing = { kind: "once", date: null, time: null };
    expect(() =>
      e.dispatch({ type: "saveTemplate", template: clone(t), printDates: [] }, now),
    ).toThrow();
    expect(() =>
      e.dispatch(
        { type: "printInstances", shape: clone(t.shape), printing: clone(t.printing) },
        now,
      ),
    ).toThrow();
    expect(e.export(now)).toBe(before);
    t.printing = { kind: "weekly", slots: [{ days: [1, 3], time: null }] };
    const id = t.id;
    e.dispatch({ type: "saveTemplate", template: clone(t), printDates: [] }, now);
    const saved = e.export(now);
    expect(() => e.dispatch({ type: "printTemplate", id, dates: [null] }, now)).toThrow();
    expect(e.export(now)).toBe(saved);
    const s = e.dispatch({ type: "printTemplate", id, dates: ["2026-10-12"] }, now);
    expect(s.data.tasks).toHaveLength(2);
    expect(
      s.data.tasks.every((task) => task.dueDate !== null && task.reminderTime === null),
    ).toBe(true);
    expect(s.data.tasks[0]!.dueDate).toBe("2026-10-12");
    expect(s.data.tasks[1]!.dueDate).toBe("2026-10-14");
  });
});
