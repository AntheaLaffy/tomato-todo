// export-sqlite.mjs 的自测：node --test scripts/export-sqlite.test.mjs
//
// 为什么这样测：导出脚本的正确性 = 迁移规则 + 计划形状 + 备份完整性 + 幂等 + 不改库。
// 全部用例都在 os.tmpdir()/mkdtemp 的临时目录里用 node:sqlite 自建库并 INSERT app_state
// 行，绝不访问 ~/.local/share/studio.tomato.todo 或任何真实数据库。
//
// 期望值里的本地日期一律用平台 Date 现算：date(createdAt) 的语义本来就是「本机本地
// 日期」，硬编码日期字符串会让测试在别的时区随机失败；「升级日」则由 migrateV3 显式
// 传入固定值，与机器日期解耦。
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildBackup,
  buildPlan,
  exportFromDb,
  migrateV3,
} from "./export-sqlite.mjs";

const execFileAsync = promisify(execFile);
const TODAY = "2026-11-07"; // 固定的「升级日」，规则断言与机器日期无关
const CREATED_AT = 1730908800; // 任意合法时间戳，断言 dueDate 回填为 dateOf(CREATED_AT)

const dateOf = (secs) => {
  const d = new Date(secs * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};

/** 完整 v4 任务形状的工厂；v3 fixture 用它再删掉部分字段模拟旧形状。 */
function task(overrides) {
  return {
    id: "t",
    templateId: null,
    recurring: false,
    title: "任务",
    notes: "",
    projectId: null,
    habitId: null,
    dueDate: "2026-10-12",
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
    createdAt: CREATED_AT,
    tags: [],
    subtasks: [],
    ...overrides,
  };
}

function settings() {
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
    soundVolume: 80,
    notifications: true,
    alwaysOnTop: false,
    theme: "light",
    personaBackdrop: false,
    protection: { mode: "off", whitelist: [], strict: false },
  };
}

function timer() {
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

/**
 * v3 旧库形态：带 goals/nodeBindings/signalEvents、任务挂 goalId/nodeId、
 * 无日期任务、无日期单次模板、goal/node/signal 身份登记与含旧字段的任务恢复记录。
 */
function v3Data() {
  return {
    version: 3,
    goals: [{ id: "g1", name: "考研" }],
    nodeBindings: [{ id: "nb1" }],
    signalEvents: [{ id: "se1" }],
    tasks: [
      task({
        id: "t1",
        goalId: "g1",
        nodeId: "n1",
        title: "背单词",
        dueDate: undefined,
      }),
      task({ id: "t2", title: "无日期任务", dueDate: null, createdAt: null }),
      task({
        id: "t3",
        title: "已完成任务",
        projectId: "p1",
        completed: true,
        completedAt: CREATED_AT,
      }),
      task({
        id: "t4",
        goalId: "g1",
        title: "空提醒任务",
        notes: "n4",
        projectId: "p1",
        dueDate: "2026-10-13",
      }),
      task({
        id: "t5",
        title: "教学待办",
        projectId: "p1",
        dueDate: "2026-10-14",
      }),
      task({
        id: "t6",
        title: "完整字段任务",
        notes: "重点",
        projectId: "p1",
        habitId: "h1",
        dueDate: "2026-10-15",
        reminderTime: "09:30",
        focusMinutes: 50,
        reminderFired: true,
        scrapMinutes: 5,
        priority: 2,
        estimate: 3,
        tags: ["a", "b"],
        subtasks: [
          { id: "s1", title: "子1", done: true },
          { id: "s2", title: "子2", done: false },
        ],
      }),
    ],
    templates: [
      {
        id: "tp1",
        shape: {
          title: "单次模板",
          notes: "",
          projectId: "p3",
          habitId: null,
          goalId: "g1",
          focusMinutes: null,
          scrapMinutes: 0,
          priority: 0,
          estimate: 1,
          tags: [],
          subtasks: [],
        },
        printing: { kind: "once", date: null, time: null },
        automatic: false,
        printAheadDays: 7,
      },
      {
        id: "tp2",
        shape: {
          title: "有日期单次",
          notes: "",
          projectId: null,
          habitId: null,
          focusMinutes: null,
          scrapMinutes: 0,
          priority: 0,
          estimate: 1,
          tags: [],
          subtasks: [],
        },
        printing: { kind: "once", date: "2026-10-01", time: null },
        automatic: false,
        printAheadDays: 7,
      },
      {
        id: "tp3",
        shape: {
          title: "周期模板",
          notes: "",
          projectId: null,
          habitId: "h1",
          focusMinutes: null,
          scrapMinutes: 0,
          priority: 0,
          estimate: 1,
          tags: [],
          subtasks: [],
        },
        printing: { kind: "weekly", slots: [{ days: [1, 3, 5], time: null }] },
        automatic: true,
        printAheadDays: 7,
      },
    ],
    prints: [
      { templateId: "tp1", date: "2026-10-01" },
      { templateId: "tp2", date: null },
      { templateId: "tp3" },
    ],
    projects: [
      { id: "p1", name: "学习", color: "#849b7d", appWhitelist: ["firefox"] },
      { id: "p2", name: "工作", color: "#df7561", appWhitelist: null },
      { id: "p3", name: "生活", color: "#d5a553", appWhitelist: null },
    ],
    habits: [{ id: "h1", name: "晨读" }],
    visions: [
      { id: "v1", name: "总愿景", notes: "", goalId: "g1", projectId: null },
      { id: "v2", name: "项目愿景", notes: "n", projectId: "p1" },
    ],
    identities: [
      { id: "g1", kind: "goal", retired: true, restoreTask: null },
      { id: "n1", kind: "node", retired: true, restoreTask: null },
      { id: "s1", kind: "signal", retired: true, restoreTask: null },
      { id: "p1", kind: "project", retired: false, restoreTask: null },
      {
        id: "t9",
        kind: "task",
        retired: true,
        restoreTask: JSON.stringify({
          goalId: "g1",
          nodeId: "n1",
          id: "t9",
          title: "已删任务",
          notes: "",
          projectId: null,
          habitId: null,
          dueDate: null,
          reminderTime: null,
          focusMinutes: null,
          reminderFired: false,
          reminderPending: false,
          reminderExpired: false,
          scrapMinutes: 0,
          priority: 1,
          estimate: 2,
          completed: false,
          completedAt: null,
          createdAt: CREATED_AT,
          tags: [],
          subtasks: [{ id: "s1", title: "旧子", done: false }],
          repeat: "daily",
          nextTaskId: "t10",
        }),
      },
    ],
    settings: settings(),
    timer: timer(),
    sessions: [
      {
        id: "sess1",
        source: "timer",
        taskId: "t6",
        taskTitle: "刷题",
        projectName: "学习",
        startedAt: CREATED_AT,
        endedAt: CREATED_AT + 1500,
        durationSecs: 1500,
        completed: true,
      },
    ],
    lock: { schedules: [], active: null, suppressedUntil: 0 },
    education: {
      focusTasks: [{ taskId: "t5", sourceId: "lesson-1", kind: "lesson" }],
    },
  };
}

/** 已经是 v4 的库：t2 是教学待办、t3 已完成，计划只该导出 t1。 */
function v4Data() {
  return {
    version: 4,
    education: {
      focusTasks: [{ taskId: "t2", sourceId: "lesson-1", kind: "homework" }],
    },
    identities: [],
    tasks: [
      task({ id: "t1", projectId: "p1" }),
      task({ id: "t2", projectId: "p1" }),
      task({ id: "t3", completed: true, completedAt: CREATED_AT }),
    ],
    blocks: [],
    templates: [],
    prints: [],
    projects: [
      { id: "p1", name: "学习", color: "#849b7d", appWhitelist: null },
    ],
    habits: [],
    visions: [],
    settings: settings(),
    timer: timer(),
    sessions: [],
    lock: { schedules: [], active: null, suppressedUntil: 0 },
  };
}

/** 在临时目录里建一个 app_state(id=1, data) 的 sqlite 库，模拟旧应用落库形态。 */
function createDb(path, data) {
  const db = new DatabaseSync(path);
  db.exec(
    "CREATE TABLE app_state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)",
  );
  // JSON.stringify 会丢弃 undefined 键（如 v3 里缺失的 dueDate），与旧库真实形态一致。
  db.prepare("INSERT INTO app_state (id, data) VALUES (1, ?)").run(
    JSON.stringify(data),
  );
  db.close();
}

async function tempDir(t, prefix) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test("migrateV3 逐条执行 read_local 的 v3→v4 语义", () => {
  const data = migrateV3(v3Data(), TODAY);
  assert.equal(data.version, 4);
  assert.ok(
    !("goals" in data) &&
      !("nodeBindings" in data) &&
      !("signalEvents" in data),
  );

  const byId = Object.fromEntries(data.tasks.map((t) => [t.id, t]));
  assert.equal(byId.t1.dueDate, dateOf(CREATED_AT)); // 缺 dueDate → date(createdAt)
  assert.ok(!("goalId" in byId.t1) && !("nodeId" in byId.t1));
  assert.equal(byId.t2.dueDate, TODAY); // createdAt 为 null → 升级当天
  assert.equal(byId.t3.dueDate, "2026-10-12"); // 已有日期不动
  assert.ok(!("goalId" in byId.t4));

  const tp1 = data.templates.find((t) => t.id === "tp1");
  assert.ok(!("goalId" in tp1.shape));
  assert.equal(tp1.printing.date, TODAY); // 单次 + 无日期 → 补升级当天
  assert.equal(
    data.templates.find((t) => t.id === "tp2").printing.date,
    "2026-10-01",
  );
  assert.deepEqual(data.prints, [{ templateId: "tp1", date: "2026-10-01" }]); // 无日期账本退役

  assert.ok(!("goalId" in data.visions.find((v) => v.id === "v1")));
  assert.deepEqual(
    data.identities.map((r) => r.id),
    ["p1", "t9"],
  ); // goal/node/signal 丢弃

  // 恢复记录：升级后按 Task 结构体顺序紧凑重序列化，旧字段（repeat/nextTaskId）丢弃。
  const restored = data.identities.find((r) => r.id === "t9");
  assert.equal(
    restored.restoreTask,
    JSON.stringify({
      id: "t9",
      templateId: null,
      recurring: false,
      title: "已删任务",
      notes: "",
      projectId: null,
      habitId: null,
      dueDate: dateOf(CREATED_AT),
      reminderTime: null,
      focusMinutes: null,
      scrapMinutes: 0,
      priority: 1,
      estimate: 2,
      reminderFired: false,
      reminderPending: false,
      reminderExpired: false,
      completed: false,
      completedAt: null,
      createdAt: CREATED_AT,
      tags: [],
      subtasks: [{ id: "s1", title: "旧子", done: false }],
    }),
  );
});

test("migrateV3 对 v4 数据不做任何修改", () => {
  const before = JSON.stringify(v4Data());
  const data = migrateV3(v4Data(), TODAY);
  assert.equal(JSON.stringify(data), before);
});

test("buildPlan 按 export_plan 语义生成计划", () => {
  const data = migrateV3(v3Data(), TODAY);
  const plan = buildPlan(data);
  // Rust PlanFile 结构体顺序；replace=false 时整键省略。
  assert.deepEqual(Object.keys(plan), [
    "format",
    "version",
    "pomodoroMinutes",
    "projects",
    "tasks",
    "blocks",
    "templates",
    "prints",
    "habits",
  ]);
  assert.equal(plan.format, "tomato-todo-plan");
  assert.equal(plan.version, 6);
  assert.equal(plan.pomodoroMinutes, 25);

  // t3 已完成、t5 是教学待办，都不导出。
  assert.deepEqual(
    plan.tasks.map((t) => t.id),
    ["t1", "t2", "t4", "t6"],
  );

  const t6 = plan.tasks.find((t) => t.id === "t6");
  assert.deepEqual(Object.keys(t6), [
    "id",
    "title",
    "templateId",
    "habitId",
    "recurring",
    "scrapMinutes",
    "notes",
    "projectId",
    "dueDate",
    "reminderTime",
    "focusMinutes",
    "priority",
    "estimate",
    "tags",
    "subtasks",
    "repeat",
  ]);
  assert.equal(t6.repeat, "none");
  assert.deepEqual(t6.subtasks, [
    { id: "s1", title: "子1" },
    { id: "s2", title: "子2" },
  ]); // done 不导出
  assert.equal(t6.templateId, null); // Option 字段输出 null
  assert.equal(t6.reminderTime, "09:30");
  assert.equal(t6.focusMinutes, 50);

  // reminderTime/focusMinutes 为 null 时省略整键。
  const t4 = plan.tasks.find((t) => t.id === "t4");
  assert.ok(!("reminderTime" in t4) && !("focusMinutes" in t4));

  // 项目只导出被任务或模板 shape 引用的；appWhitelist 为 null 时省略整键。
  assert.deepEqual(
    plan.projects.map((p) => p.id),
    ["p1", "p3"],
  );
  assert.deepEqual(plan.projects[0], {
    id: "p1",
    name: "学习",
    color: "#849b7d",
    appWhitelist: ["firefox"],
  });
  assert.ok(!("appWhitelist" in plan.projects[1]));

  assert.deepEqual(plan.habits, [{ id: "h1", name: "晨读" }]);
  assert.deepEqual(plan.blocks, []);
  assert.equal(plan.templates.length, 3);
  assert.equal(plan.prints.length, 1);
});

test("buildBackup 输出完整 v4 数据并补齐 serde 默认字段", () => {
  const data = migrateV3(v3Data(), TODAY);
  const backup = buildBackup(data);
  assert.equal(backup.version, 4);
  assert.equal(backup.tasks.length, 6); // 已完成与教学待办都在备份里
  assert.deepEqual(Object.keys(backup).slice(0, 4), [
    "education",
    "version",
    "identities",
    "tasks",
  ]); // 顶层键按旧实现顺序
  assert.deepEqual(backup.education, data.education); // 已存在的 education 原样保留

  // v3 早期库没有 education/lock/blocks 等字段时，按 Rust 默认值补齐。
  const minimal = migrateV3(
    {
      version: 3,
      tasks: [],
      projects: [],
      settings: settings(),
      timer: timer(),
      sessions: [],
    },
    TODAY,
  );
  const b2 = buildBackup(minimal);
  assert.deepEqual(Object.keys(b2.education), [
    "focusTasks",
    "projects",
    "resources",
    "semesters",
    "semesterHistory",
    "lessons",
    "assessments",
    "submissions",
    "grades",
    "reviews",
    "events",
    "completedTasks",
    "progress",
    "corrections",
  ]);
  assert.deepEqual(b2.lock, {
    schedules: [],
    active: null,
    suppressedUntil: 0,
  });
  assert.deepEqual(b2.identities, []);
  assert.deepEqual(b2.blocks, []);
});

test("exportFromDb：v3 库导出两个文件，且不改动库文件", async (t) => {
  const dir = await tempDir(t, "tomato-export-v3-");
  const dbPath = join(dir, "tomato.sqlite3");
  createDb(dbPath, v3Data());
  const before = await readFile(dbPath);

  const result = await exportFromDb(dbPath, join(dir, "out"), {});
  assert.deepEqual(await readFile(dbPath), before); // readOnly 打开，导出绝不写库

  const plan = JSON.parse(await readFile(result.planPath, "utf8"));
  assert.equal(plan.format, "tomato-todo-plan");
  assert.equal(plan.version, 6);

  const backupText = await readFile(result.backupPath, "utf8");
  assert.ok(backupText.startsWith('{\n  "education"')); // 漂亮打印、顶层键序与旧实现一致
  const backup = JSON.parse(backupText);
  assert.equal(backup.version, 4);
  assert.ok(!("goals" in backup));
  assert.equal(backup.tasks.length, 6);
  assert.equal(
    backup.tasks.find((x) => x.id === "t1").dueDate,
    dateOf(CREATED_AT),
  );

  assert.equal(result.summary.fromVersion, 3);
  assert.equal(result.summary.migrated, true);
  assert.equal(result.summary.totalTasks, 6);
  assert.equal(result.summary.exportedTasks, 4);
  assert.equal(result.summary.skippedCompleted, 1);
  assert.equal(result.summary.skippedTeaching, 1);
  assert.equal(result.summary.sessions, 1);
  assert.equal(result.summary.projects, 2);
});

test("exportFromDb：v4 库直接导出，不做迁移", async (t) => {
  const dir = await tempDir(t, "tomato-export-v4-");
  const dbPath = join(dir, "tomato.sqlite3");
  createDb(dbPath, v4Data());

  const result = await exportFromDb(dbPath, dir, {});
  assert.equal(result.summary.fromVersion, 4);
  assert.equal(result.summary.migrated, false);

  const plan = JSON.parse(await readFile(result.planPath, "utf8"));
  assert.deepEqual(
    plan.tasks.map((x) => x.id),
    ["t1"],
  ); // t2 教学、t3 已完成
  assert.deepEqual(
    plan.projects.map((p) => p.id),
    ["p1"],
  );

  const backup = JSON.parse(await readFile(result.backupPath, "utf8"));
  assert.equal(backup.version, 4);
  assert.equal(backup.tasks.length, 3);
});

test("exportFromDb：输出已存在时拒绝覆盖，--force 才覆盖", async (t) => {
  const dir = await tempDir(t, "tomato-export-idem-");
  const dbPath = join(dir, "tomato.sqlite3");
  createDb(dbPath, v3Data());

  await exportFromDb(dbPath, dir, {});
  await assert.rejects(exportFromDb(dbPath, dir, {}), /已存在/);
  // 拒绝的那次运行不留下临时文件。
  assert.deepEqual(
    (await readdir(dir)).filter((f) => f.includes(".tmp-")),
    [],
  );

  // 塞入哨兵内容，证明 --force 真的重写。
  await writeFile(join(dir, "plan.json"), "sentinel");
  const result = await exportFromDb(dbPath, dir, { force: true });
  assert.equal(
    JSON.parse(await readFile(result.planPath, "utf8")).format,
    "tomato-todo-plan",
  );
  JSON.parse(await readFile(result.backupPath, "utf8"));
});

test("exportFromDb：错误输入给出中文错误且不产生输出文件", async (t) => {
  const dir = await tempDir(t, "tomato-export-err-");
  const out = join(dir, "out");

  // 库不存在。
  await assert.rejects(
    exportFromDb(join(dir, "missing.sqlite3"), out, {}),
    /无法以只读方式打开/,
  );
  // 表存在但没有 id=1 数据行。
  const emptyPath = join(dir, "empty.sqlite3");
  {
    const db = new DatabaseSync(emptyPath);
    db.exec(
      "CREATE TABLE app_state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)",
    );
    db.close();
  }
  await assert.rejects(exportFromDb(emptyPath, out, {}), /没有 id=1 的数据行/);
  // JSON 损坏：建表后直接塞入非法 JSON 文本。
  const brokenPath = join(dir, "broken.sqlite3");
  {
    const db = new DatabaseSync(brokenPath);
    db.exec(
      "CREATE TABLE app_state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)",
    );
    db.prepare("INSERT INTO app_state (id, data) VALUES (1, ?)").run("{oops");
    db.close();
  }
  await assert.rejects(exportFromDb(brokenPath, out, {}), /已损坏/);
  // 数据不是对象。
  const arrayPath = join(dir, "array.sqlite3");
  createDb(arrayPath, [1, 2, 3]);
  await assert.rejects(exportFromDb(arrayPath, out, {}), /不是对象/);
  // version 不支持。
  const v2Path = join(dir, "v2.sqlite3");
  createDb(v2Path, { version: 2 });
  await assert.rejects(exportFromDb(v2Path, out, {}), /仅支持 version 3\/4/);
  // 任务恢复记录损坏：迁移阶段报中文错误。
  const badRestorePath = join(dir, "bad-restore.sqlite3");
  const badRestore = v3Data();
  badRestore.identities.push({
    id: "bad",
    kind: "task",
    retired: true,
    restoreTask: "{oops",
  });
  createDb(badRestorePath, badRestore);
  await assert.rejects(
    exportFromDb(badRestorePath, out, {}),
    /任务恢复记录 JSON 损坏/,
  );

  // 以上失败都发生在写文件之前，输出目录不应存在。
  await assert.rejects(readdir(out));
});

test("CLI：--db/--out 全流程、--help 与未知参数", async (t) => {
  const dir = await tempDir(t, "tomato-export-cli-");
  const script = join(import.meta.dirname, "export-sqlite.mjs");
  const run = async (...args) => {
    try {
      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        [script, ...args],
        {
          encoding: "utf8",
        },
      );
      return { code: 0, stdout, stderr };
    } catch (e) {
      return {
        code: e.code ?? 1,
        stdout: e.stdout ?? "",
        stderr: e.stderr ?? "",
      };
    }
  };

  const dbPath = join(dir, "tomato.sqlite3");
  createDb(dbPath, v3Data());
  const out = join(dir, "out");
  const ok = await run("--db", dbPath, "--out", out);
  assert.equal(ok.code, 0, ok.stderr);
  assert.match(ok.stdout, /已写出/);
  JSON.parse(await readFile(join(out, "plan.json"), "utf8"));
  JSON.parse(await readFile(join(out, "backup-v4.json"), "utf8"));

  const help = await run("--help");
  assert.equal(help.code, 0);
  assert.match(help.stdout, /用法/);

  const bad = await run("--nope");
  assert.equal(bad.code, 1);
  assert.match(bad.stderr, /未知参数/);

  // 默认拒绝覆盖同样走 CLI 退出码 1。
  const again = await run("--db", dbPath, "--out", out);
  assert.equal(again.code, 1);
  assert.match(again.stderr, /已存在/);
});
