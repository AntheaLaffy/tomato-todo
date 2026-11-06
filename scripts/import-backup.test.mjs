// scripts/import-backup.mjs 的迁移测试：
// - 备份 v4 + 现有 plan.json 合并后条数/进度/配置都对；
// - 重复运行幂等（文件 sha256 不变）；
// - 坏备份/坏计划失败时原文件不被写坏；
// - --dry-run 不落盘；旧 sqlite 不动。
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as core from "../runtime/vendor/core.mjs";
import { readDataFiles } from "../runtime/src/data-files.mjs";
import { runImport } from "./import-backup.mjs";

const tmp = () => mkdtempSync(join(tmpdir(), "tomato-import-"));

function sha(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function localDate(ts) {
  return core.dateAt(ts);
}

/**
 * 用 core 造一份最小但真实合法的备份 v4（顶层 AppData，无 format 标记）：
 * 1 个项目、2 个任务（1 个已完成）、1 条专注记录。
 */
function makeBackup(dataDir, at) {
  const engine = core.Engine.open(":memory:");
  engine.dispatch(
    {
      type: "saveProject",
      id: null,
      name: "历史项目",
      color: "#d96d55",
      directory: "/tmp/import-fixture",
    },
    at,
  );
  const projectId = engine.data.projects.at(-1).id;
  const draft = (title, dueDate) => ({
    id: null,
    title,
    notes: "",
    projectId,
    dueDate,
    reminderTime: null,
    focusMinutes: null,
    scrapMinutes: 0,
    priority: 0,
    estimate: 1,
    tags: [],
    subtasks: [],
    repeat: "none",
  });
  engine.dispatch(
    { type: "saveTask", task: draft("旧任务", localDate(at)) },
    at,
  );
  const keptId = engine.data.tasks.at(-1).id;
  engine.dispatch(
    { type: "saveTask", task: draft("已完成任务", localDate(at)) },
    at,
  );
  const doneId = engine.data.tasks.at(-1).id;
  engine.dispatch({ type: "toggleTask", id: doneId }, at);

  // 造一条真实专注记录：开始一个 1 分钟番茄，30 秒后提前完成。
  engine.dispatch({ type: "selectTask", id: keptId }, at - 120);
  engine.dispatch({ type: "startTimer", minutes: 1 }, at - 120);
  engine.dispatch({ type: "completeFocus" }, at - 90);

  const backup = core.serializeAppData(engine.data);
  writeFileSync(
    join(dataDir, "backup-v4.json"),
    JSON.stringify(backup, null, 2),
  );
  return { backup, projectId, keptId, doneId };
}

function makePlan(dataDir, at, { projectId, keptId }) {
  const plan = {
    format: "tomato-todo-plan",
    version: 6,
    pomodoroMinutes: 30,
    projects: [],
    tasks: [
      {
        id: keptId,
        title: "旧任务（计划改名）",
        templateId: null,
        habitId: null,
        recurring: false,
        scrapMinutes: 0,
        notes: "来自计划文件",
        projectId,
        dueDate: localDate(at),
        reminderTime: null,
        focusMinutes: null,
        priority: 2,
        estimate: 1,
        tags: ["迁移"],
        subtasks: [],
        repeat: "none",
        // 旧导出多写的运行字段必须被忽略（不能造成未知字段失败）。
        reminderFired: true,
      },
      {
        id: "plan-new-task",
        title: "计划新增任务",
        templateId: null,
        habitId: null,
        recurring: false,
        scrapMinutes: 0,
        notes: "",
        projectId: null,
        dueDate: localDate(at),
        reminderTime: null,
        focusMinutes: null,
        priority: 0,
        estimate: 1,
        tags: [],
        subtasks: [],
        repeat: "none",
      },
    ],
    blocks: [
      {
        id: "plan-block",
        title: "实验",
        days: [1],
        start: "14:00",
        end: "16:00",
        attention: "required",
        notes: "",
      },
    ],
    templates: [],
    prints: [],
    habits: [],
  };
  writeFileSync(join(dataDir, "plan.json"), JSON.stringify(plan, null, 2));
  return plan;
}

function fixture() {
  const dataDir = tmp();
  const at = Math.floor(Date.now() / 1000);
  const ids = makeBackup(dataDir, at);
  const plan = makePlan(dataDir, at, ids);
  return { dataDir, at, ...ids, plan };
}

test("合并备份 + 现有 plan.json：条数、进度、计划配置都不丢", () => {
  const { dataDir, keptId, doneId } = fixture();
  const before = {
    plan: existsSync(join(dataDir, "plan.json"))
      ? sha(join(dataDir, "plan.json"))
      : null,
  };
  const result = runImport(["--data", dataDir]);
  assert.equal(result.dryRun, false);
  // 备份 2 个任务（1 完成）+ 计划新增 1 个。
  assert.equal(result.tasks, 3);
  assert.equal(result.tasksCompleted, 1);
  // 1 条计时记录 + 完成任务时按预计补足的 1 条 taskEstimate（docs/BACKUP_FORMAT.md）。
  assert.equal(result.sessions, 2);
  assert.ok(result.identities >= 3);
  assert.ok(result.backupDir, "应先备份旧文件");
  assert.ok(existsSync(join(result.backupDir, "plan.json")));
  assert.equal(sha(join(result.backupDir, "plan.json")), before.plan);

  const { data } = readDataFiles(dataDir, result.serverTime ?? Date.now());
  data.validate();
  const kept = data.tasks.find((t) => t.id === keptId);
  assert.equal(kept.title, "旧任务（计划改名）"); // 计划配置获胜
  assert.equal(kept.priority, 2);
  assert.equal(kept.notes, "来自计划文件");
  const done = data.tasks.find((t) => t.id === doneId);
  assert.equal(done.completed, true); // 备份进度保留
  assert.ok(data.tasks.some((t) => t.id === "plan-new-task"));
  assert.ok(data.blocks.some((b) => b.id === "plan-block"));
  assert.equal(data.sessions.length, 2);
});

test("重复运行幂等：第二次导入不改变 plan.json/state.json", () => {
  const { dataDir } = fixture();
  runImport(["--data", dataDir]);
  const planHash = sha(join(dataDir, "plan.json"));
  const stateHash = sha(join(dataDir, "state.json"));
  const again = runImport(["--data", dataDir]);
  assert.equal(again.tasks, 3);
  assert.equal(sha(join(dataDir, "plan.json")), planHash);
  assert.equal(sha(join(dataDir, "state.json")), stateHash);
});

test("坏备份失败时不写坏原文件", () => {
  const { dataDir } = fixture();
  runImport(["--data", dataDir]);
  const planHash = sha(join(dataDir, "plan.json"));
  const stateHash = sha(join(dataDir, "state.json"));
  writeFileSync(join(dataDir, "backup-v4.json"), "{ 不是 JSON");
  assert.throws(() => runImport(["--data", dataDir]), /读取失败|备份/);
  assert.equal(sha(join(dataDir, "plan.json")), planHash);
  assert.equal(sha(join(dataDir, "state.json")), stateHash);
});

test("非法计划文件（未知字段）失败时不写坏原文件", () => {
  const { dataDir } = fixture();
  runImport(["--data", dataDir]);
  const plan = JSON.parse(readFileSync(join(dataDir, "plan.json"), "utf8"));
  plan.tasks[0].notAField = true;
  writeFileSync(join(dataDir, "plan.json"), JSON.stringify(plan));
  const planHash = sha(join(dataDir, "plan.json"));
  const stateHash = sha(join(dataDir, "state.json"));
  assert.throws(() => runImport(["--data", dataDir]), /未知字段/);
  assert.equal(sha(join(dataDir, "plan.json")), planHash);
  assert.equal(sha(join(dataDir, "state.json")), stateHash);
});

test("--dry-run 不落盘；旧 sqlite 与备份文件不被改动", () => {
  const dataDir = tmp();
  const at = Math.floor(Date.now() / 1000);
  makeBackup(dataDir, at);
  const sqlite = join(dataDir, "tomato.sqlite3");
  writeFileSync(sqlite, "sqlite-bytes");
  const backupHash = sha(join(dataDir, "backup-v4.json"));

  const result = runImport(["--data", dataDir, "--dry-run"]);
  assert.equal(result.dryRun, true);
  assert.equal(result.tasks, 2);
  assert.ok(!existsSync(join(dataDir, "plan.json")));
  assert.ok(!existsSync(join(dataDir, "state.json")));
  assert.equal(readFileSync(sqlite, "utf8"), "sqlite-bytes");
  assert.equal(sha(join(dataDir, "backup-v4.json")), backupHash);
  assert.ok(!readdirSync(dataDir).some((name) => name.startsWith("backups")));
});

test("安全规则：导入后计时器暂停、锁机清空、定时规则停用", () => {
  const dataDir = tmp();
  const at = Math.floor(Date.now() / 1000);
  makeBackup(dataDir, at);
  // 在备份里塞入运行中的计时器和启用的锁机规则，验证导入会安全落地。
  const backup = JSON.parse(
    readFileSync(join(dataDir, "backup-v4.json"), "utf8"),
  );
  backup.timer.running = true;
  backup.timer.deadline = at + 600;
  backup.lock.schedules = [
    {
      id: "night",
      name: "晚间休息",
      start: "23:00",
      end: "07:00",
      days: [1, 2, 3, 4, 5, 6, 7],
      enabled: true,
      strict: true,
    },
  ];
  backup.lock.active = {
    name: "小憩",
    startedAt: at - 60,
    endsAt: at + 60,
    strict: true,
  };
  backup.settings.autoStartTasks = true;
  writeFileSync(join(dataDir, "backup-v4.json"), JSON.stringify(backup));

  runImport(["--data", dataDir]);
  const { data } = readDataFiles(dataDir, at);
  assert.equal(data.timer.running, false);
  assert.equal(data.timer.deadline, null);
  assert.ok(data.timer.remainingSecs >= 1);
  assert.equal(data.lock.active, null);
  assert.equal(data.lock.suppressedUntil, 0);
  assert.ok(data.lock.schedules.every((s) => s.enabled === false));
  assert.equal(data.settings.autoStartTasks, false);
});
