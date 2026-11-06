//! Engine 存储入口与计时覆盖的补充测试（runtime 适配层依赖的 API）。
//!
//! 这些测试只覆盖 Runtime 桥接新增的三个能力：
//! - Engine.fromData：调用方自带落盘策略（runtime 拆 plan.json/state.json）；
//! - discardTimer：旧 runtime 的「放弃当前番茄」不写专注记录；
//! - startTimer.minutes：单次时长覆盖不写回设置/任务。

import { describe, expect, it } from "vitest";
import {
  AppData,
  Engine,
  atLocal,
  parseAppData,
  serializeAppData,
} from "../src/index";

const at = atLocal(2026, 11, 6, 10, 0);

describe("Engine.fromData 与 runtime 存储策略", () => {
  it("fromData 校验后以调用方回调落盘，dispatch 后再次回调", () => {
    const saved: AppData[] = [];
    const data = new AppData();
    const engine = Engine.fromData(data, (next) => {
      saved.push(next);
    });
    expect(saved.length).toBe(1); // 建引擎时先落一次
    expect(saved[0].version).toBe(4);

    engine.dispatch({ type: "startTimer", minutes: 1 }, at);
    expect(saved.length).toBeGreaterThan(saved.length - 1);
    expect(engine.data.timer.durationSecs).toBe(60);
    const last = saved[saved.length - 1];
    expect(
      JSON.parse(JSON.stringify(serializeAppData(last))).timer.running,
    ).toBe(true);
  });

  it("fromData 拒绝非法数据且不调用落盘回调（不会写坏原文件）", () => {
    const data = new AppData();
    data.tasks.push({
      id: "broken",
      templateId: null,
      recurring: false,
      title: "x",
      notes: "",
      projectId: "missing-project",
      habitId: null,
      dueDate: "2026-11-06",
      reminderTime: null,
      focusMinutes: null,
      reminderFired: false,
      reminderPending: false,
      reminderExpired: false,
      scrapMinutes: 0,
      priority: 0,
      estimate: 1,
      completed: false,
      completedAt: null,
      createdAt: at,
      tags: [],
      subtasks: [],
    });
    let calls = 0;
    expect(() =>
      Engine.fromData(data, () => {
        calls += 1;
      }),
    ).toThrow(/项目/);
    expect(calls).toBe(0);
  });

  it("fromData 的落盘内容是可直接再解析的 AppData（runtime 拆文件的前提）", () => {
    let saved: AppData | null = null;
    const engine = Engine.fromData(new AppData(), (next) => {
      saved = next;
    });
    engine.dispatch(
      {
        type: "saveTask",
        task: {
          id: null,
          title: "落盘",
          notes: "",
          projectId: null,
          dueDate: "2026-11-06",
          reminderTime: null,
          focusMinutes: null,
          scrapMinutes: 0,
          priority: 0,
          estimate: 1,
          tags: [],
          subtasks: [],
          repeat: "none",
        },
      },
      at,
    );
    expect(saved).not.toBeNull();
    const round = parseAppData(
      JSON.parse(JSON.stringify(serializeAppData(saved as AppData))),
    );
    round.validate();
    expect(round.tasks.length).toBe(1);
  });

  it("discardTimer 不写专注记录，只回到空闲专注", () => {
    const engine = Engine.open(":memory:");
    engine.dispatch({ type: "startTimer", minutes: 1 }, at);
    engine.discardTimer();
    expect(engine.data.timer.running).toBe(false);
    expect(engine.data.timer.mode).toBe("focus");
    expect(engine.data.timer.remainingSecs).toBe(
      engine.data.timer.durationSecs,
    );
    expect(engine.data.sessions.length).toBe(0);
  });

  it("discardTimer 在严格保护中拒绝", () => {
    const engine = Engine.open(":memory:");
    engine.dispatch(
      {
        type: "saveSettings",
        settings: {
          ...engine.data.settings,
          protection: { mode: "lock", whitelist: [], strict: true },
        },
      },
      at,
    );
    engine.dispatch({ type: "startTimer" }, at);
    expect(() => engine.discardTimer()).toThrow(/严格模式/);
    expect(engine.data.timer.running).toBe(true);
  });

  it("startTimer.minutes 只覆盖当前段时长，不改设置与任务", () => {
    const engine = Engine.open(":memory:");
    engine.dispatch({ type: "startTimer", minutes: 1 }, at);
    expect(engine.data.timer.durationSecs).toBe(60);
    expect(engine.data.settings.focusMinutes).toBe(25);
    // 进行中再次指定时长被拒绝。
    expect(() =>
      engine.dispatch({ type: "startTimer", minutes: 5 }, at),
    ).toThrow(/尚未开始/);
    // 越界时长被拒绝。
    engine.dispatch({ type: "resetTimer" }, at);
    expect(() =>
      engine.dispatch({ type: "startTimer", minutes: 0 }, at),
    ).toThrow(/1—180/);
  });
});
