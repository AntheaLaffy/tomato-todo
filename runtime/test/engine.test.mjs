// 引擎桩测试：计划读写原子落盘、任务增删改查、番茄状态机、快照/统计、提醒桩、导出。
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Engine, localDate } from "../src/engine.ts";

const tmp = () => mkdtempSync(join(tmpdir(), "tomato-eng-"));

/** 本机时区的确定时间戳，避免测试随运行机器时区漂移。 */
function tsAt(date, time) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, min).getTime() / 1000;
}

const TODAY = "2026-11-06";

test("open 初始化：快照形状对齐旧 src/types.ts", () => {
  const dir = tmp();
  const now = tsAt(TODAY, "10:00");
  const engine = Engine.open(dir, now);
  const snap = engine.snapshot(now);
  assert.equal(snap.today, TODAY);
  assert.equal(snap.serverTime, now);
  assert.equal(typeof snap.remainingSecs, "number");
  assert.ok(snap.stats.days.length > 0);
  assert.deepEqual(snap.data.tasks, []);
  assert.equal(snap.data.settings.focusMinutes, 25);
  assert.equal(snap.data.timer.mode, "focus");
  assert.equal(snap.data.education.projects.length, 0);
  assert.deepEqual(snap.studyProgress, []);
});

test("createTask 校验：非法日期/空标题/越界字段被拒绝", () => {
  const engine = Engine.open(tmp(), tsAt(TODAY, "10:00"));
  assert.throws(() => engine.createTask({ title: "  ", dueDate: TODAY }), /标题不能为空/);
  assert.throws(() => engine.createTask({ title: "x", dueDate: "2026-02-30" }), /dueDate/);
  assert.throws(() => engine.createTask({ title: "x", dueDate: TODAY, reminderTime: "25:00" }), /reminderTime/);
  assert.throws(() => engine.createTask({ title: "x", dueDate: TODAY, priority: 9 }), /priority/);
  assert.throws(() => engine.createTask({ title: "x", dueDate: TODAY, estimate: 0 }), /estimate/);
  assert.throws(() => engine.createTask({ title: "x", dueDate: TODAY, focusMinutes: 500 }), /focusMinutes/);
  assert.throws(() => engine.createTask({ title: "x", dueDate: TODAY, projectId: "missing" }), /项目不存在/);
});

test("createTask 默认值与原子落盘：重开引擎后任务仍在且无临时文件残留", () => {
  const dir = tmp();
  const now = tsAt(TODAY, "10:00");
  const engine = Engine.open(dir, now);
  const task = engine.createTask(
    { title: "写周报", dueDate: TODAY, tags: ["工作"], subtasks: [{ title: "草稿" }] },
    now,
  );
  assert.equal(task.completed, false);
  assert.equal(task.priority, 0);
  assert.equal(task.estimate, 1);
  assert.equal(task.tags[0], "工作");
  assert.equal(task.subtasks[0].done, false);
  assert.ok(task.subtasks[0].id);

  const plan = JSON.parse(readFileSync(join(dir, "plan.json"), "utf8"));
  assert.equal(plan.tasks.length, 1);
  assert.ok(!readdirSync(dir).some((f) => f.includes(".tmp-")));

  const reopened = Engine.open(dir, now);
  const snap = reopened.snapshot(now);
  assert.equal(snap.data.tasks.length, 1);
  assert.equal(snap.data.tasks[0].title, "写周报");
  assert.deepEqual(snap.taskKinds[task.id], "ordinary");
});

test("updateTask 白名单：仅允许指定字段，保留完成历史", () => {
  const engine = Engine.open(tmp(), tsAt(TODAY, "10:00"));
  const task = engine.createTask({ title: "旧", dueDate: TODAY });
  assert.throws(() => engine.updateTask(task.id, { completed: true }), /不允许修改字段/);
  const updated = engine.updateTask(task.id, {
    title: "新",
    dueDate: "2026-11-07",
    reminderTime: "09:30",
    priority: 2,
    scrapMinutes: 5,
  });
  assert.equal(updated.title, "新");
  assert.equal(updated.dueDate, "2026-11-07");
  assert.equal(updated.reminderTime, "09:30");
  assert.equal(updated.priority, 2);
  assert.throws(() => engine.updateTask("missing", { title: "x" }), /任务不存在/);
});

test("moveTasks 整批原子：已完成任务使整批拒绝", () => {
  const engine = Engine.open(tmp(), tsAt(TODAY, "10:00"));
  const a = engine.createTask({ title: "a", dueDate: TODAY });
  const b = engine.createTask({ title: "b", dueDate: TODAY });
  engine.completeTask(b.id);
  assert.throws(() => engine.moveTasks([a.id, b.id], "2026-11-08"), /已完成任务/);
  const moved = engine.moveTasks([a.id], "2026-11-08", "20:00");
  assert.equal(moved[0].dueDate, "2026-11-08");
  assert.equal(moved[0].reminderTime, "20:00");
  // 未完成任务的 dueDate 不变（原子性）
  assert.equal(engine.listTasks({ completed: false }).tasks[0].id, a.id);
});

test("completeTask 与 deleteTask", () => {
  const now = tsAt(TODAY, "10:00");
  const engine = Engine.open(tmp(), now);
  const task = engine.createTask({ title: "x", dueDate: TODAY }, now);
  const done = engine.completeTask(task.id, now + 60);
  assert.equal(done.completed, true);
  assert.equal(done.completedAt, now + 60);
  assert.throws(() => engine.completeTask(task.id, now + 120), /不能反复切换/);
  const other = engine.createTask({ title: "y", dueDate: TODAY }, now);
  engine.deleteTask(other.id);
  assert.throws(() => engine.completeTask(other.id), /任务不存在/);
});

test("番茄状态机：start→pause→resume→stop 早停记未完成会话", () => {
  const now = tsAt(TODAY, "10:00");
  const engine = Engine.open(tmp(), now);
  assert.throws(() => engine.focusPause(now), /没有进行中的番茄/);
  const timer = engine.focusStart({ minutes: 25 }, now);
  assert.equal(timer.running, true);
  assert.equal(timer.durationSecs, 1500);
  assert.equal(timer.deadline, now + 1500);
  const paused = engine.focusPause(now + 600);
  assert.equal(paused.running, false);
  assert.equal(paused.remainingSecs, 900);
  const resumed = engine.focusResume(now + 660);
  assert.equal(resumed.running, true);
  assert.equal(resumed.deadline, now + 660 + 900);
  assert.equal(resumed.startedAt, now); // 暂停不重置起点
  const { timer: after, session } = engine.focusStop(now + 660 + 300);
  assert.equal(session.completed, false);
  // 实际专注 600 + 300 秒，暂停的 60 秒不计入
  assert.equal(session.durationSecs, 900);
  assert.equal(session.startedAt, now);
  assert.equal(session.endedAt, now + 960);
  assert.equal(session.taskId, null);
  assert.equal(after.running, false);
  assert.equal(after.mode, "focus");
});

test("番茄到点自动完成：记完成会话并按 autoBreak 进入休息", () => {
  const now = tsAt(TODAY, "10:00");
  const engine = Engine.open(tmp(), now);
  engine.focusStart({ minutes: 25 }, now);
  engine.tick(now + 1501);
  const timer = engine.timer;
  assert.equal(timer.mode, "shortBreak");
  assert.equal(timer.running, true); // autoBreak 默认开
  assert.equal(timer.completionSerial, 1);
  assert.equal(timer.cycle, 1);
  const snap = engine.snapshot(now + 1501);
  assert.equal(snap.data.sessions.length, 1);
  assert.equal(snap.data.sessions[0].completed, true);
  assert.equal(snap.stats.todayPomodoros, 1);
  assert.equal(snap.stats.todaySeconds, 1500);
  // 休息到点回空闲
  engine.tick(now + 1501 + 300 + 1);
  assert.equal(engine.timer.mode, "focus");
  assert.equal(engine.timer.running, false);
});

test("discard 放弃当前番茄：不记会话，回到空闲", () => {
  const now = tsAt(TODAY, "10:00");
  const engine = Engine.open(tmp(), now);
  engine.focusStart({ minutes: 25 }, now);
  const timer = engine.focusDiscard();
  assert.equal(timer.running, false);
  assert.equal(timer.remainingSecs, 1500);
  const snap = engine.snapshot(now);
  assert.equal(snap.data.sessions.length, 0);
});

test("四个番茄后进入长休息（longBreakEvery=4）", () => {
  const now = tsAt(TODAY, "10:00");
  const engine = Engine.open(tmp(), now);
  for (let i = 0; i < 3; i++) {
    engine.focusStart({ minutes: 1 }, now + i * 3600);
    engine.tick(now + i * 3600 + 61);
    engine.tick(now + i * 3600 + 61 + 301); // 短休息到点
  }
  engine.focusStart({ minutes: 1 }, now + 3 * 3600);
  engine.tick(now + 3 * 3600 + 61);
  assert.equal(engine.timer.mode, "longBreak");
  assert.equal(engine.timer.cycle, 4);
});

test("统计：今日完成数/番茄数/连续天数与 days 回看", () => {
  const now = tsAt(TODAY, "10:00");
  const engine = Engine.open(tmp(), now);
  const task = engine.createTask({ title: "x", dueDate: TODAY }, now);
  engine.completeTask(task.id, now + 60);
  engine.focusStart({ minutes: 25 }, now + 120);
  engine.tick(now + 120 + 1501);
  const stats = engine.stats(now + 3000);
  assert.equal(stats.todayCompleted, 1);
  assert.equal(stats.todayPomodoros, 1);
  assert.ok(stats.streak >= 1);
  const todayRow = stats.days.find((d) => d.date === TODAY);
  assert.equal(todayRow.completed, 1);
  assert.equal(todayRow.pomodoros, 1);
  assert.equal(todayRow.seconds, 1500);
});

test("今日视图：任务排序、逾期列表与课表时段", () => {
  const now = tsAt(TODAY, "10:00");
  const engine = Engine.open(tmp(), now);
  engine.createTask({ title: "早", dueDate: TODAY, reminderTime: "08:00" }, now);
  engine.createTask({ title: "晚", dueDate: TODAY, reminderTime: "20:00" }, now);
  engine.createTask({ title: "逾期", dueDate: "2026-11-05" }, now);
  engine.dispatch({ type: "saveBlock", title: "课", days: [5], start: "08:00", end: "10:00" });
  const view = engine.today(now);
  assert.equal(view.today, TODAY);
  assert.equal(view.tasks[0].title, "早");
  assert.equal(view.tasks[1].title, "晚");
  assert.equal(view.overdue[0].title, "逾期");
  // 2026-11-06 是周五 → 1=周一…5=周五
  assert.equal(view.blocks.length, 1);
  assert.equal(view.blocks[0].title, "课");
});

test("提醒桩：到点标记 reminderFired 并落盘；快照计算 pending/expired", () => {
  const now = tsAt(TODAY, "10:00");
  const engine = Engine.open(tmp(), now);
  const due = engine.createTask({ title: "九点提醒", dueDate: TODAY, reminderTime: "09:00" }, now);
  const future = engine.createTask({ title: "十一点提醒", dueDate: TODAY, reminderTime: "11:00" }, now);
  const past = engine.createTask({ title: "昨日过期", dueDate: "2026-11-05" }, now);
  engine.tickReminders(now);
  let snap = engine.snapshot(now);
  const fired = snap.data.tasks.find((t) => t.id === due.id);
  assert.equal(fired.reminderFired, true);
  assert.equal(fired.reminderPending, false);
  const pending = snap.data.tasks.find((t) => t.id === future.id);
  assert.equal(pending.reminderPending, false); // 未到点
  const expired = snap.data.tasks.find((t) => t.id === past.id);
  assert.equal(expired.reminderExpired, true);
  // 到点后 pending 生效
  snap = engine.snapshot(tsAt(TODAY, "11:01"));
  assert.equal(snap.data.tasks.find((t) => t.id === future.id).reminderPending, true);
  // 落盘：重开后 reminderFired 仍在
  const reopened = Engine.open(engine.dataDir, tsAt(TODAY, "11:02"));
  assert.equal(reopened.snapshot(now).data.tasks.find((t) => t.id === due.id).reminderFired, true);
});

test("运行中计时跨重启恢复：deadline 已过自动补记完成会话", () => {
  const dir = tmp();
  const now = tsAt(TODAY, "10:00");
  const engine = Engine.open(dir, now);
  engine.focusStart({ minutes: 1 }, now);
  engine.flushNow();
  const reopened = Engine.open(dir, now + 120);
  assert.equal(reopened.timer.mode, "shortBreak");
  assert.equal(reopened.snapshot(now + 120).data.sessions.length, 1);
  assert.equal(reopened.snapshot(now + 120).data.sessions[0].completed, true);
});

test("exportPlan 剥离进度字段；exportToFile 校验文件名并返回哈希", () => {
  const dir = tmp();
  const now = tsAt(TODAY, "10:00");
  const engine = Engine.open(dir, now);
  const done = engine.createTask({ title: "已完成", dueDate: TODAY }, now);
  engine.completeTask(done.id);
  engine.createTask({ title: "未完成", dueDate: TODAY }, now);
  const plan = engine.exportPlan();
  assert.equal(plan.format, "tomato-todo-plan");
  assert.equal(plan.version, 6);
  assert.equal(plan.tasks.length, 1);
  assert.equal(plan.tasks[0].title, "未完成");
  assert.ok(!("completed" in plan.tasks[0]));
  assert.ok(!("reminderFired" in plan.tasks[0]));

  assert.throws(() => engine.exportToFile("plan", "../evil.json"), /工作区内/);
  assert.throws(() => engine.exportToFile("plan", "x.txt"), /工作区内/);
  const result = engine.exportToFile("plan", "week.json", now);
  assert.equal(result.name, "week.json");
  assert.equal(result.bytes, Buffer.byteLength(readFileSync(join(dir, "exports", "week.json"), "utf8")));
  assert.match(result.fileHash, /^[0-9a-f]{64}$/);
  const backup = engine.exportToFile("backup", "backup.json", now);
  assert.match(backup.fileHash, /^[0-9a-f]{64}$/);
  const parsed = JSON.parse(readFileSync(join(dir, "exports", "backup.json"), "utf8"));
  assert.equal(parsed.format, "tomato-todo-backup");
});

test("dispatch：saveSettings/saveVision/saveBlock/deleteBlock/createProject/deleteTask", () => {
  const now = tsAt(TODAY, "10:00");
  const engine = Engine.open(tmp(), now);
  const settings = engine.dispatch({
    type: "saveSettings",
    settings: { focusMinutes: 50, protection: { mode: "lock", whitelist: [], strict: true } },
  });
  assert.equal(settings.focusMinutes, 50);
  assert.equal(settings.protection.mode, "lock");
  assert.equal(settings.shortBreakMinutes, 5); // 未传字段保留

  const vision = engine.dispatch({ type: "saveVision", name: "上岸", notes: "目标" });
  assert.equal(vision.name, "上岸");
  assert.equal(engine.dispatch({ type: "saveVision", id: vision.id, name: "改" }).name, "改");

  const block = engine.dispatch({ type: "saveBlock", title: "实验", days: [1, 3], start: "14:00", end: "16:00" });
  assert.equal(block.days.length, 2);
  assert.throws(
    () => engine.dispatch({ type: "saveBlock", title: "x", days: [8], start: "14:00", end: "16:00" }),
    /days/,
  );
  engine.dispatch({ type: "deleteBlock", id: block.id });
  assert.equal(engine.snapshot(now).data.blocks.length, 0);

  const project = engine.dispatch({ type: "createProject", name: "数学", color: "#336699" });
  assert.equal(project.color, "#336699");
  assert.throws(() => engine.dispatch({ type: "createProject", name: "x", color: "red" }), /color/);

  const task = engine.createTask({ title: "删", dueDate: TODAY });
  engine.dispatch({ type: "deleteTask", id: task.id });
  assert.throws(() => engine.completeTask(task.id), /任务不存在/);

  assert.throws(() => engine.dispatch({ type: "emergencyUnlock" }), /未支持的 action/);
  assert.throws(() => engine.dispatch(undefined), /action/);
});

test("状态文件原子落盘：flushNow 后无临时文件，重开保持一致", () => {
  const dir = tmp();
  const now = tsAt(TODAY, "10:00");
  const engine = Engine.open(dir, now);
  engine.focusStart({ minutes: 25 }, now);
  engine.flushNow();
  assert.ok(!readdirSync(dir).some((f) => f.includes(".tmp-")));
  const state = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
  assert.equal(state.timer.running, true);
  const reopened = Engine.open(dir, now + 60);
  assert.equal(reopened.timer.running, true);
  assert.equal(reopened.timer.remainingSecs, 1500 - 60);
});

test("localDate 辅助：本机时区日期", () => {
  assert.equal(localDate(tsAt(TODAY, "00:00")), TODAY);
  assert.equal(localDate(tsAt(TODAY, "23:59")), TODAY);
});
