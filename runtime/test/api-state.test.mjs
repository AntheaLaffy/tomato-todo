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
import {
  startServer,
  UI_ORIGIN,
  desiredGuard,
  createGuardSync,
  projectUiState,
} from "../src/server.mjs";
import { parseDesktopEntry } from "../src/apps.mjs";

const tmp = () => mkdtempSync(join(tmpdir(), "tomato-state-"));
const TOKEN = "state-token";

/** 假 guard：记录命令，状态恒为未锁定。 */
function fakeGuard() {
  const calls = [];
  return {
    calls,
    fullscreenError: null,
    runningAppsError: null,
    async runningApps() {
      return this.runningAppsError
        ? { ok: false, error: this.runningAppsError }
        : {
            ok: true,
            data: { apps: ["kitty", "code", "kitty", "dsh-desktop"] },
          };
    },
    async fullscreen(enabled) {
      calls.push({ command: "fullscreen", enabled });
      return this.fullscreenError
        ? { ok: false, error: this.fullscreenError }
        : { ok: true, data: { ok: true } };
    },
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

test("原生全屏端点校验输入与 Origin，并向 UI 透传失败", async () => {
  const post = (body, origin = UI_ORIGIN) =>
    json("/api/desktop/fullscreen", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify(body),
    });
  assert.equal((await post({ enabled: true })).status, 200);
  assert.deepEqual(guard.calls.at(-1), {
    command: "fullscreen",
    enabled: true,
  });
  assert.equal((await post({ enabled: "true" })).status, 400);
  assert.equal(
    (await post({ enabled: true }, "https://example.com")).status,
    403,
  );
  guard.fullscreenError = "未找到 DSH 窗口";
  try {
    const result = await post({ enabled: false });
    assert.equal(result.status, 503);
    assert.equal(result.body.error, guard.fullscreenError);
  } finally {
    guard.fullscreenError = null;
  }
});

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
  // UI 数据面默认省略 identities（UI 不读；导入后近 1MB），?full=1 才返回。
  assert.ok(!("identities" in body.data), "默认不应返回 data.identities");
  for (const key of [
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

test("GET /api/state?full=1：返回完整 identities；projectUiState 投影正确", async () => {
  const full = await json("/api/state?full=1");
  assert.equal(full.status, 200);
  assert.ok(Array.isArray(full.body.data.identities));

  // 纯函数投影：identities 默认略去、full 保留；教学资源默认不返回明细，
  // ?education=lite 给目录字段，?education=full 才带 topics/source/edition。
  const fake = {
    today: "2026-11-07",
    serverTime: 1,
    data: {
      identities: [
        { id: "i1", kind: "task", retired: false, restoreTask: null },
      ],
      tasks: [],
      education: {
        resources: [
          {
            id: "r1",
            projectId: "p1",
            title: "资料",
            kind: "book",
            path: "a.pdf",
            source: "src",
            edition: "1",
            topics: ["t"],
          },
        ],
      },
    },
  };
  const normal = projectUiState(fake);
  assert.ok(!("identities" in normal.data));
  assert.deepEqual(normal.data.education.resources, []);
  assert.deepEqual(Object.keys(normal).sort(), ["data", "serverTime", "today"]);

  const lite = projectUiState(fake, { education: "lite" });
  assert.deepEqual(Object.keys(lite.data.education.resources[0]), [
    "id",
    "projectId",
    "title",
    "kind",
    "path",
  ]);
  assert.equal(lite.data.education.resources[0].topics, undefined);

  const fullView = projectUiState(fake, { full: true, education: "full" });
  assert.equal(fullView.data.identities.length, 1);
  assert.equal(fullView.data.education.resources[0].topics[0], "t");
  // 投影不能改到原对象。
  assert.equal(fake.data.education.resources[0].topics.length, 1);
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

test("GET /api/state：教学资源默认不返回明细，?education=lite / =full 分级返回", async () => {
  const normal = await json("/api/state");
  assert.equal(normal.status, 200);
  // 默认不返回教学资源明细（目录/统计页需要时显式请求）。
  assert.deepEqual(normal.body.data.education.resources, []);
  assert.ok(Array.isArray(normal.body.data.education.lessons));

  const lite = await json("/api/state?education=lite");
  assert.equal(lite.status, 200);
  assert.ok(Array.isArray(lite.body.data.education.resources));
  for (const resource of lite.body.data.education.resources) {
    assert.deepEqual(Object.keys(resource), [
      "id",
      "projectId",
      "title",
      "kind",
      "path",
    ]);
  }

  const full = await json("/api/state?education=full");
  assert.equal(full.status, 200);
  assert.ok(Array.isArray(full.body.data.education.resources));
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

    data.settings.protection.mode = "whitelist";
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

test("guard 同步会在守卫重启或锁定状态丢失后重新发送锁机命令", async () => {
  const engine = Engine.open(tmp());
  engine.applyAction({ type: "startQuickLock", minutes: 5, strict: false });
  let locked = false;
  let locks = 0;
  const guard = {
    async lock({ whitelist }) {
      assert.deepEqual(whitelist, []);
      locks += 1;
      locked = true;
      return { ok: true };
    },
    async status() {
      return { ok: true, data: { locked, whitelist: [] } };
    },
  };
  const sync = createGuardSync(engine, guard);
  await sync();
  await sync();
  assert.equal(locks, 1);
  locked = false;
  await sync();
  assert.equal(locks, 2);
});

test("GET /api/apps：只返回 guard 看到的运行中应用", async () => {
  const res = await fetch(`${base}/api/apps`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.apps));
  assert.equal(body.count, body.apps.length);
  assert.deepEqual(
    body.apps.map((app) => app.id),
    ["kitty", "code", "dsh-desktop"],
  );
  for (const app of body.apps) {
    assert.equal(typeof app.id, "string");
    // id 是桌面入口文件名去后缀；像 com.ccswitch.desktop.desktop 这种带点的
    // 名字去掉后缀后仍然以 .desktop 结尾，属于合法 id，不能拿后缀当断言。
    assert.ok(app.id.length > 0 && !app.id.startsWith("."));
    assert.equal(typeof app.name, "string");
    assert.ok(app.name.length > 0);
  }
});

test("GET /api/apps：guard 不可达时不退回全部已安装应用", async () => {
  guard.runningAppsError = "niri IPC unavailable";
  try {
    const res = await fetch(base + "/api/apps");
    assert.equal(res.status, 503);
    assert.match((await res.json()).error, /niri IPC unavailable/);
  } finally {
    guard.runningAppsError = null;
  }
});

test("parseDesktopEntry：跳过 NoDisplay/Hidden/非 Application，优先中文名", () => {
  const base =
    "[Desktop Entry]\nType=Application\nName=Files\nExec=nautilus %U\n";
  assert.deepEqual(parseDesktopEntry(base), {
    exec: "nautilus",
    icon: "",
    name: "Files",
    comment: "",
  });
  assert.equal(parseDesktopEntry(`${base}NoDisplay=true\n`), null);
  assert.equal(parseDesktopEntry(`${base}Hidden=true\n`), null);
  assert.equal(parseDesktopEntry("[Desktop Entry]\nType=Link\nName=x\n"), null);
  // 其它分组里的 Name 不算数
  assert.equal(
    parseDesktopEntry("[Desktop Action new]\nName=New window\n"),
    null,
  );
});

test("POST /api/dispatch：习惯可带多个时段，撞在同一 (day|time) 会被 core 拒绝", async () => {
  const post = (action) =>
    fetch(`${base}/api/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).then(async (res) => ({ status: res.status, body: await res.json() }));

  const saved = await post({
    type: "saveHabit",
    id: null,
    name: "早晚各读一次",
    projectId: null,
    focusMinutes: null,
    slots: [
      { days: [1, 3, 5], time: "08:00" },
      { days: [2, 4], time: "20:30" },
    ],
  });
  assert.equal(saved.status, 200);
  const data = saved.body.snapshot.data;
  const habit = data.habits.find((item) => item.name === "早晚各读一次");
  assert.ok(habit);
  const template = data.templates.find((tpl) => tpl.shape.habitId === habit.id);
  assert.equal(template.printing.slots.length, 2);
  assert.deepEqual(
    template.printing.slots.map((s) => s.time),
    ["08:00", "20:30"],
  );

  const clash = await post({
    type: "saveHabit",
    id: habit.id,
    name: "早晚各读一次",
    projectId: null,
    focusMinutes: null,
    slots: [
      { days: [1], time: "08:00" },
      { days: [1], time: "08:00" },
    ],
  });
  assert.equal(clash.status, 400);
});
