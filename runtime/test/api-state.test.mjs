// UI 数据面测试：GET /api/state、POST /api/dispatch（core Action 全覆盖）、
// 导出端点与 guard 状态推导。
//
// guard 用注入的假客户端：测试不得在真实桌面上触发锁屏（AGENTS.md）。
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Engine } from "../src/engine.ts";
import { startServer, UI_ORIGIN, desiredGuard } from "../src/server.mjs";

const tmp = () => mkdtempSync(join(tmpdir(), "tomato-state-"));
const TOKEN = "state-token";

/** 假 guard：记录命令，状态恒为未锁定。 */
function fakeGuard() {
  const calls = [];
  return {
    calls,
    async lock({ whitelist } = {}) {
      calls.push({ command: "lock", whitelist });
      return { ok: true, status: 200, data: { locked: true } };
    },
    async unlock() {
      calls.push({ command: "unlock" });
      return { ok: true, status: 200, data: { locked: false } };
    },
    async status() {
      return { ok: false, status: 0, error: "guard 未运行" };
    },
  };
}

const guard = fakeGuard();
let server;
let base;
let engine;

test.before(async () => {
  const dataDir = tmp();
  engine = Engine.open(dataDir);
  const started = await startServer({
    engine,
    dataDir,
    host: "127.0.0.1",
    port: 0,
    token: TOKEN,
    version: "0.0.0-test",
    guardClient: guard,
  });
  server = started.server;
  base = `http://127.0.0.1:${started.port}`;
});

test.after(async () => {
  await server?.close?.();
});

const json = async (path, init = {}) => {
  const res = await fetch(`${base}${path}`, init);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, headers: res.headers, body };
};

const dispatch = (action) =>
  json("/api/dispatch", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: UI_ORIGIN },
    body: JSON.stringify({ action }),
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("GET /api/state：全量快照 + 学情摘要 + guard 摘要（不可达给 available:false）", async () => {
  const { status, headers, body } = await json("/api/state");
  assert.equal(status, 200);
  assert.equal(headers.get("access-control-allow-origin"), UI_ORIGIN);
  assert.equal(typeof body.serverTime, "number");
  assert.equal(typeof body.today, "string");
  assert.equal(typeof body.remainingSecs, "number");
  assert.ok(Array.isArray(body.education));
  assert.deepEqual(body.guard, { available: false });
  assert.ok(Array.isArray(body.data.tasks));
  for (const key of [
    "identities",
    "projects",
    "habits",
    "blocks",
    "templates",
    "prints",
    "visions",
    "settings",
    "timer",
    "sessions",
    "lock",
    "education",
  ]) {
    assert.ok(key in body.data, `state.data 缺少 ${key}`);
  }
  assert.ok(body.stats.days.length > 0);
});

test("POST /api/dispatch：saveTask 成功、非法 Action 400、未知字段 400", async () => {
  const today = (await json("/api/state")).body.today;
  const ok = await dispatch({
    type: "saveTask",
    task: {
      id: null,
      title: "UI 建的任务",
      notes: "",
      projectId: null,
      dueDate: today,
      reminderTime: null,
      focusMinutes: null,
      scrapMinutes: 0,
      priority: 1,
      estimate: 1,
      tags: [],
      subtasks: [],
      repeat: "none",
    },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.changed, true);
  assert.ok(ok.body.snapshot.data.tasks.some((t) => t.title === "UI 建的任务"));
  assert.equal(typeof ok.body.snapshot.guard.available, "boolean");

  const bad = await dispatch({ type: "noSuchAction" });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /动作 type/);

  const extra = await dispatch({ type: "emergencyUnlock", extra: 1 });
  assert.equal(extra.status, 400);
  assert.match(extra.body.error, /未知字段|不接受/);
});

test("POST /api/dispatch：任务 Actions（saveTask/toggleTask/deleteTask/toggleSubtask）", async () => {
  const today = (await json("/api/state")).body.today;
  const created = await dispatch({
    type: "saveTask",
    task: {
      id: null,
      title: "勾选链路",
      notes: "",
      projectId: null,
      dueDate: today,
      reminderTime: null,
      focusMinutes: null,
      scrapMinutes: 0,
      priority: 0,
      estimate: 1,
      tags: [],
      subtasks: [{ id: "s1", title: "第一步", done: false }],
      repeat: "none",
    },
  });
  assert.equal(created.status, 200);
  const task = created.body.snapshot.data.tasks.find(
    (t) => t.title === "勾选链路",
  );
  assert.ok(task);

  const toggled = await dispatch({
    type: "toggleSubtask",
    taskId: task.id,
    subtaskId: "s1",
  });
  assert.equal(toggled.status, 200);
  assert.equal(
    toggled.body.snapshot.data.tasks.find((t) => t.id === task.id).subtasks[0]
      .done,
    true,
  );

  const done = await dispatch({ type: "toggleTask", id: task.id });
  assert.equal(done.status, 200);
  assert.equal(
    done.body.snapshot.data.tasks.find((t) => t.id === task.id).completed,
    true,
  );

  const removed = await dispatch({ type: "deleteTask", id: task.id });
  assert.equal(removed.status, 200);
  assert.ok(!removed.body.snapshot.data.tasks.some((t) => t.id === task.id));
});

test("POST /api/dispatch：计时 Actions（selectTask/startTimer/pauseTimer/resetTimer/skipTimer/completeFocus/setMode）", async () => {
  const today = (await json("/api/state")).body.today;
  const created = await dispatch({
    type: "saveTask",
    task: {
      id: null,
      title: "计时任务",
      notes: "",
      projectId: null,
      dueDate: today,
      reminderTime: null,
      focusMinutes: null,
      scrapMinutes: 0,
      priority: 0,
      estimate: 1,
      tags: [],
      subtasks: [],
      repeat: "none",
    },
  });
  const taskId = created.body.snapshot.data.tasks.at(-1).id;

  const selected = await dispatch({ type: "selectTask", id: taskId });
  assert.equal(selected.status, 200);
  assert.equal(selected.body.snapshot.data.timer.taskId, taskId);

  const started = await dispatch({ type: "startTimer" });
  assert.equal(started.status, 200);
  assert.equal(started.body.snapshot.data.timer.running, true);

  const paused = await dispatch({ type: "pauseTimer" });
  assert.equal(paused.body.snapshot.data.timer.running, false);

  const resumed = await dispatch({ type: "startTimer" });
  assert.equal(resumed.body.snapshot.data.timer.running, true);

  // 用带 minutes 的 startTimer 拿到短段，等 1 秒后提前完成（completeFocus）。
  const reset = await dispatch({ type: "resetTimer" });
  assert.equal(reset.status, 200);
  assert.equal(reset.body.snapshot.data.timer.running, false);
  const quick = await dispatch({ type: "startTimer", minutes: 1 });
  assert.equal(quick.status, 200);
  await sleep(1100);
  const completed = await dispatch({ type: "completeFocus" });
  assert.equal(completed.status, 200);
  assert.equal(completed.body.snapshot.data.timer.mode, "shortBreak");

  const skipped = await dispatch({ type: "skipTimer" });
  assert.equal(skipped.status, 200);
  assert.equal(skipped.body.snapshot.data.timer.mode, "focus");

  const mode = await dispatch({ type: "setMode", mode: "longBreak" });
  assert.equal(mode.status, 200);
  assert.equal(mode.body.snapshot.data.timer.mode, "longBreak");
  await dispatch({ type: "setMode", mode: "focus" });
});

test("POST /api/dispatch：设置/项目/习惯/愿景/课表 Actions", async () => {
  const state = (await json("/api/state")).body;
  const settings = { ...state.data.settings, focusMinutes: 30, theme: "dark" };
  const saved = await dispatch({ type: "saveSettings", settings });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.snapshot.data.settings.focusMinutes, 30);

  const dataDir = tmp();
  const project = await dispatch({
    type: "saveProject",
    id: null,
    name: "数学",
    color: "#336699",
    directory: dataDir,
  });
  assert.equal(project.status, 200);
  const projectId = project.body.snapshot.data.projects.at(-1).id;
  const removed = await dispatch({ type: "deleteProject", id: projectId });
  assert.equal(removed.status, 200);
  assert.ok(
    !removed.body.snapshot.data.projects.some((p) => p.id === projectId),
  );

  const habit = await dispatch({
    type: "saveHabitGroup",
    id: null,
    name: "晨读",
  });
  assert.equal(habit.status, 200);
  const habitId = habit.body.snapshot.data.habits.at(-1).id;
  const habitDeleted = await dispatch({ type: "deleteHabit", id: habitId });
  assert.equal(habitDeleted.status, 200);

  const vision = await dispatch({
    type: "saveVision",
    id: null,
    name: "上岸",
    notes: "",
    projectId: null,
  });
  assert.equal(vision.status, 200);
  const visionId = vision.body.snapshot.data.visions.at(-1).id;
  const visionDeleted = await dispatch({ type: "deleteVision", id: visionId });
  assert.equal(visionDeleted.status, 200);

  const block = await dispatch({
    type: "saveBlock",
    id: null,
    title: "实验",
    days: [1, 3],
    start: "14:00",
    end: "16:00",
    attention: "required",
    notes: "",
  });
  assert.equal(block.status, 200);
  const blockId = block.body.snapshot.data.blocks.at(-1).id;
  const blockDeleted = await dispatch({ type: "deleteBlock", id: blockId });
  assert.equal(blockDeleted.status, 200);
});

test("POST /api/dispatch：锁机 Actions + guard 同步（startQuickLock/saveLockSchedule/deleteLockSchedule）", async () => {
  const before = guard.calls.length;
  const locked = await dispatch({
    type: "startQuickLock",
    minutes: 30,
    strict: false,
  });
  assert.equal(locked.status, 200);
  assert.ok(locked.body.snapshot.data.lock.active !== null);
  // 保护生效时同步驱动 guard：lock 且白名单为空。
  assert.ok(
    guard.calls
      .slice(before)
      .some((c) => c.command === "lock" && c.whitelist.length === 0),
  );

  const unlocked = await dispatch({ type: "emergencyUnlock" });
  assert.equal(unlocked.status, 200);
  assert.equal(unlocked.body.snapshot.data.lock.active, null);

  const schedule = {
    id: "night-rest",
    name: "晚间休息",
    start: "23:00",
    end: "07:00",
    days: [1, 2, 3, 4, 5, 6, 7],
    enabled: false,
    strict: true,
  };
  const saved = await dispatch({ type: "saveLockSchedule", schedule });
  assert.equal(saved.status, 200);
  assert.ok(
    saved.body.snapshot.data.lock.schedules.some((s) => s.id === "night-rest"),
  );
  const removed = await dispatch({
    type: "deleteLockSchedule",
    id: "night-rest",
  });
  assert.equal(removed.status, 200);
  assert.ok(
    !removed.body.snapshot.data.lock.schedules.some(
      (s) => s.id === "night-rest",
    ),
  );
});

test("POST /api/dispatch：importPlan 与 import（备份恢复）", async () => {
  const today = (await json("/api/state")).body.today;
  const plan = {
    format: "tomato-todo-plan",
    version: 6,
    pomodoroMinutes: 25,
    projects: [],
    tasks: [
      {
        id: "plan-task-1",
        title: "计划导入的任务",
        notes: "",
        projectId: null,
        dueDate: today,
        reminderTime: null,
        focusMinutes: null,
        scrapMinutes: 0,
        priority: 0,
        estimate: 1,
        tags: [],
        subtasks: [],
        repeat: "none",
      },
    ],
    blocks: [],
    templates: [],
    prints: [],
    habits: [],
  };
  const imported = await dispatch({ type: "importPlan", plan });
  assert.equal(imported.status, 200);
  assert.ok(
    imported.body.snapshot.data.tasks.some((t) => t.id === "plan-task-1"),
  );

  const backup = (await json("/api/export/backup")).body;
  const restored = await dispatch({ type: "import", data: backup });
  assert.equal(restored.status, 200);
  assert.ok(
    restored.body.snapshot.data.tasks.some((t) => t.id === "plan-task-1"),
  );
});

test("POST /api/dispatch：education Action 走 core 校验（不是未知动作）", async () => {
  const result = await dispatch({
    type: "education",
    command: { op: "attendLesson", id: "missing-lesson", progress: "完成" },
  });
  assert.equal(result.status, 400);
  assert.doesNotMatch(result.body.error, /动作 type/);
  assert.match(result.body.error, /课程|教学/);
});

test("GET /api/export/plan 与 /api/export/backup：Content-Disposition 与数据形状", async () => {
  const plan = await json("/api/export/plan");
  assert.equal(plan.status, 200);
  assert.equal(
    plan.headers.get("content-type"),
    "application/json; charset=utf-8",
  );
  assert.match(
    plan.headers.get("content-disposition"),
    /^attachment; filename="tomato-plan-\d{4}-\d{2}-\d{2}\.json"$/,
  );
  assert.equal(plan.body.format, "tomato-todo-plan");
  assert.equal(plan.body.version, 6);
  assert.ok(Array.isArray(plan.body.tasks));

  const backup = await json("/api/export/backup");
  assert.equal(backup.status, 200);
  assert.match(
    backup.headers.get("content-disposition"),
    /^attachment; filename="tomato-backup-\d{4}-\d{2}-\d{2}\.json"$/,
  );
  assert.equal(backup.body.version, 4);
  assert.ok(Array.isArray(backup.body.tasks));
  assert.ok(Array.isArray(backup.body.sessions));
});

test("desiredGuard：锁机优先、白名单专注按保护模式、空闲解锁", () => {
  const data = engine.data;
  const original = {
    protection: { ...data.settings.protection },
    timer: { ...data.timer },
    lock: { ...data.lock },
  };
  try {
    data.timer.running = true;
    data.timer.mode = "focus";
    data.settings.protection.mode = "whitelist";
    data.settings.protection.whitelist = ["code", "firefox"];
    assert.deepEqual(desiredGuard(engine).command, "lock");
    assert.deepEqual(desiredGuard(engine).whitelist, ["code", "firefox"]);

    data.settings.protection.mode = "lock";
    assert.deepEqual(desiredGuard(engine).whitelist, []);

    data.lock.active = {
      name: "小憩",
      startedAt: 1,
      endsAt: 2,
      strict: true,
    };
    const lockState = desiredGuard(engine);
    assert.equal(lockState.command, "lock");
    assert.equal(lockState.strict, true);
    assert.deepEqual(lockState.whitelist, []);

    data.lock.active = null;
    data.timer.running = false;
    data.settings.protection.mode = "off";
    assert.equal(desiredGuard(engine).command, "unlock");
  } finally {
    data.settings.protection = original.protection;
    Object.assign(data.timer, original.timer);
    Object.assign(data.lock, original.lock);
  }
});
