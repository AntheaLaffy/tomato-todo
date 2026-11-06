#!/usr/bin/env node
// 一次性 sqlite 迁移导出脚本（旧 Tauri 应用 → 新 runtime）。
//
// 为什么需要它：重写后旧 Tauri 壳被删除，sqlite 库不再被任何代码读取，而新 runtime
// 以 plan.json 为唯一数据源。为避免升级丢数据，本脚本把旧库一次性读出并拆成两个文件：
//   - plan.json：      只装「安排配置」——未完成任务、模板、印刷账本、习惯组、课表时段、
//                      被引用的项目与番茄时长，语义逐条对齐 crates/core/src/plan.rs 的
//                      export_plan()（education.focusTasks 关联的教学待办不导出）。
//   - backup-v4.json： 完整 v4 备份，等价旧 Engine::export() 的产物——settings、timer、
//                      sessions、lock、identities、visions、education、已完成任务与完成
//                      历史等未映射进计划的数据全部保留，日后可按备份 v4 恢复。
// v3 旧库先按 crates/core/src/migration.rs 的 read_local() 逐条升级到 v4 再导出；
// v4 库直接导出。库以 readOnly 打开，绝不写库；输出文件先写临时文件再 rename，
// 任一目标已存在且未加 --force 时拒绝覆盖。库旁存在 -wal 文件（旧应用可能仍在
// 运行）时只警告不阻止，建议完全退出旧应用后再导出。
//
// 要求 Node ≥ 22.5（node:sqlite 内建模块；22.13 之前运行时需加 --experimental-sqlite）。
// 本脚本在 Node 24 上验证。
//
// 用法：
//   node scripts/export-sqlite.mjs                         # 默认库路径，输出到当前目录
//   node scripts/export-sqlite.mjs --db PATH --out DIR
//   node scripts/export-sqlite.mjs --force                 # 覆盖已存在的输出文件
//
// 实现假设（与旧 Rust 实现的关系，见各函数注释）：
//   - 备份顶层键按 Rust AppData 结构体声明顺序重排，贴近 export() 产物；嵌套对象保持
//     库内原键序。JSON 解析不依赖键序，逐层复刻 serde 结构体顺序需要把整套 schema
//     照抄一遍，收益为零。
//   - 不重放 Engine::open 里的 identities::reconcile 与 tick()：本脚本只做 read_local
//     语义的离线迁移与导出；新 runtime 导入/打开数据时自行校验与推进状态。
//   - Rust 对缺失键的 Value 索引得 Null，故「缺失」与 null 在迁移规则里同义，脚本对
//     undefined 与 null 一视同仁。
import { accessSync } from "node:fs";
import { access, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";

const [NODE_MAJOR, NODE_MINOR] = process.versions.node.split(".").map(Number);
if (NODE_MAJOR < 22 || (NODE_MAJOR === 22 && NODE_MINOR < 5)) {
  console.error(
    "本脚本需要 Node ≥ 22.5（node:sqlite 内建模块；22.13 之前运行时需加 --experimental-sqlite），当前 Node 版本：" +
      process.versions.node,
  );
  process.exit(1);
}
const { DatabaseSync } = await import("node:sqlite");

// ── 迁移：crates/core/src/migration.rs 的 read_local() 语义 ──────────────────

/** Unix 秒 → 本机本地日期 YYYY-MM-DD；不是整数或超出 Date 范围返回 null。 */
function localDateOf(secs) {
  if (typeof secs !== "number" || !Number.isInteger(secs)) return null;
  const d = new Date(secs * 1000);
  if (Number.isNaN(d.getTime())) return null;
  return (
    String(d.getFullYear()) +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function todayLocal() {
  return localDateOf(Math.floor(Date.now() / 1000));
}

/**
 * v3 任务的单条升级：删 goalId/nodeId，缺日期取 date(createdAt)，createdAt 也缺则取
 * 升级当天。对应 migration.rs 的 upgrade_task（其时间戳越界时同样落回 Local::now()）。
 */
function upgradeTask(task, today) {
  const date = localDateOf(task.createdAt) ?? today;
  delete task.goalId;
  delete task.nodeId;
  if (task.dueDate === null || task.dueDate === undefined) {
    task.dueDate = date;
  }
}

// Rust crate::Task 的 serde 字段顺序（crates/core/src/lib.rs Task 结构体声明顺序）。
// 撤销恢复记录按此顺序紧凑重序列化：新 runtime 的撤销对比依赖字段顺序，未知旧字段
// （如 v3 的 repeat/nextTaskId）随重建丢弃，与 Rust 的 from_str → to_string 行为一致。
const TASK_KEYS = [
  "id",
  "templateId",
  "recurring",
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
  "reminderFired",
  "reminderPending",
  "reminderExpired",
  "completed",
  "completedAt",
  "createdAt",
  "tags",
  "subtasks",
];
const TASK_DEFAULTS = {
  id: "",
  templateId: null,
  recurring: false,
  title: "",
  notes: "",
  projectId: null,
  habitId: null,
  dueDate: null,
  reminderTime: null,
  focusMinutes: null,
  scrapMinutes: 0,
  priority: 0,
  estimate: 0,
  reminderFired: false,
  reminderPending: false,
  reminderExpired: false,
  completed: false,
  completedAt: null,
  createdAt: 0,
  tags: [],
};

function serializeTask(task) {
  const out = {};
  for (const key of TASK_KEYS) out[key] = task[key] ?? TASK_DEFAULTS[key];
  out.subtasks = (task.subtasks ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    done: s.done ?? false,
  }));
  return JSON.stringify(out);
}

/**
 * 逐条执行 read_local()：version==3 时升级（就地修改并返回同一对象），否则原样返回。
 * today 为「升级日」YYYY-MM-DD（本机本地日期），用于无日期任务与单次模板的回填。
 */
export function migrateV3(data, today) {
  if (data.version !== 3) return data;
  data.version = 4;
  // 目标组、主线节点与配对/信号裁定随 v4 整体退役，连同顶层容器一起删除。
  for (const key of ["goals", "nodeBindings", "signalEvents"]) {
    delete data[key];
  }
  for (const task of data.tasks ?? []) {
    upgradeTask(task, today);
  }
  for (const template of data.templates ?? []) {
    if (template.shape && typeof template.shape === "object") {
      delete template.shape.goalId;
    }
    // 只回填「单次 + 无日期」的模板：日期缺失与 null 在 Rust 侧同为 Value::Null。
    if (
      template.printing?.kind === "once" &&
      (template.printing.date === null || template.printing.date === undefined)
    ) {
      template.printing.date = today;
    }
  }
  // 无日期印刷账本条目没有有效归属日，直接退役；实例自身的历史不受影响。
  data.prints = (data.prints ?? []).filter(
    (p) => p.date !== null && p.date !== undefined,
  );
  for (const vision of data.visions ?? []) {
    if (vision && typeof vision === "object") delete vision.goalId;
  }
  data.identities = (data.identities ?? []).filter(
    (r) => !["goal", "node", "signal"].includes(r.kind),
  );
  for (const record of data.identities) {
    if (typeof record.restoreTask === "string") {
      // 撤销恢复记录与普通任务走同一套升级，再按 Task 结构体顺序重序列化。
      let task;
      try {
        task = JSON.parse(record.restoreTask);
      } catch (e) {
        throw new Error(
          `身份登记 ${record.id} 的任务恢复记录 JSON 损坏：${e.message}`,
        );
      }
      upgradeTask(task, today);
      record.restoreTask = serializeTask(task);
    }
  }
  return data;
}

// ── plan.json：crates/core/src/plan.rs 的 export_plan() 语义 ──────────────────

/**
 * 单条任务 → PlanTask。键序照抄 Rust PlanTask 结构体声明顺序；reminderTime 与
 * focusMinutes 为 null 时省略整键（serde skip_serializing_if），其余 Option 字段
 * 输出 null。repeat 恒为 "none"——重复规则只属于周期模板，实例不拥有重复规则。
 */
function planTaskFrom(t) {
  return {
    id: t.id,
    title: t.title,
    templateId: t.templateId ?? null,
    habitId: t.habitId ?? null,
    recurring: t.recurring ?? false,
    scrapMinutes: t.scrapMinutes ?? 0,
    notes: t.notes ?? "",
    projectId: t.projectId ?? null,
    dueDate: t.dueDate ?? null,
    ...(t.reminderTime != null ? { reminderTime: t.reminderTime } : {}),
    ...(t.focusMinutes != null ? { focusMinutes: t.focusMinutes } : {}),
    priority: t.priority ?? 0,
    estimate: t.estimate ?? 1,
    tags: t.tags ?? [],
    subtasks: (t.subtasks ?? []).map((s) => ({ id: s.id, title: s.title })),
    repeat: "none",
  };
}

/**
 * 构建计划内容：未完成且不在 education.focusTasks 里的任务；项目只保留被任务或
 * 模板 shape 引用的（appWhitelist 为 null 时省略整键）；replace 恒为 false 因而省略。
 * blocks/templates/prints/habits 恒输出（可能为空数组），与 Rust 序列化一致。
 */
export function buildPlan(data) {
  const teaching = new Set(
    (data.education?.focusTasks ?? []).map((l) => l.taskId),
  );
  const tasks = (data.tasks ?? [])
    .filter((t) => !t.completed && !teaching.has(t.id))
    .map(planTaskFrom);
  const used = new Set([
    ...tasks.filter((t) => t.projectId).map((t) => t.projectId),
    ...(data.templates ?? [])
      .filter((t) => t.shape?.projectId)
      .map((t) => t.shape.projectId),
  ]);
  return {
    format: "tomato-todo-plan",
    version: 6,
    pomodoroMinutes: data.settings?.focusMinutes ?? 25,
    projects: (data.projects ?? [])
      .filter((p) => used.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        ...(p.appWhitelist != null ? { appWhitelist: p.appWhitelist } : {}),
      })),
    tasks,
    blocks: data.blocks ?? [],
    templates: data.templates ?? [],
    prints: data.prints ?? [],
    habits: data.habits ?? [],
  };
}

// ── backup-v4.json：完整 v4 AppData ───────────────────────────────────────────

// Rust AppData 的 serde 顶层字段顺序（crates/core/src/lib.rs AppData 结构体声明顺序）。
const APP_DATA_KEYS = [
  "education",
  "version",
  "identities",
  "tasks",
  "blocks",
  "templates",
  "prints",
  "projects",
  "habits",
  "visions",
  "settings",
  "timer",
  "sessions",
  "lock",
];

// Rust Education 结构体的全部字段（camelCase），缺省值时全是空数组。
const EDUCATION_KEYS = [
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
];

function defaultEducation() {
  const out = {};
  for (const key of EDUCATION_KEYS) out[key] = [];
  return out;
}

/**
 * 把（迁移后的）数据整理成完整 v4 备份对象。顶层键按旧实现顺序重排；v3 早期库缺失
 * 的 serde 默认字段（education/identities/blocks/…/lock）按 Rust 默认值补齐——
 * 旧应用的库总是序列化全部字段，缺失只出现在被手工改过的库里。settings/timer/sessions
 * 在 Rust 侧是必填项，缺失时原样保留 undefined 由 JSON.stringify 丢弃，宁可在新
 * runtime 校验时暴露问题，也不伪造数据。
 */
export function buildBackup(data) {
  const out = {};
  for (const key of APP_DATA_KEYS) {
    if (key === "education" && data.education === undefined) {
      out.education = defaultEducation();
    } else if (data[key] === undefined) {
      if (key === "lock")
        out[key] = { schedules: [], active: null, suppressedUntil: 0 };
      else if (
        key !== "settings" &&
        key !== "timer" &&
        key !== "sessions" &&
        key !== "version"
      ) {
        out[key] = [];
      }
    } else {
      out[key] = data[key];
    }
  }
  // 顶层未知键一并保留：正常库不会有（Rust deny_unknown_fields 会拒绝），有则宁可带上。
  for (const key of Object.keys(data)) {
    if (!(key in out)) out[key] = data[key];
  }
  return out;
}

// ── 读取旧库 ─────────────────────────────────────────────────────────────────

/**
 * 以只读方式读出旧库的 AppData JSON；version==3 时先做迁移。任何失败都抛中文错误，
 * 且（因调用方在写文件前先走完这里）不会产生任何输出文件。返回 { data, fromVersion }。
 */
function loadAppData(dbPath) {
  // 旧应用以 WAL 模式运行（crates/core/src/lib.rs 的 PRAGMA journal_mode=WAL）；
  // -wal 文件存在通常意味着旧应用还在运行，此时读到的可能是运行中的中间状态。
  // 只警告不阻止：只读打开读到的仍是事务一致快照，但强烈建议先完全退出旧应用。
  try {
    accessSync(`${dbPath}-wal`);
    console.warn(
      `警告：检测到 ${dbPath}-wal（旧应用可能仍在运行）；` +
        "建议完全退出旧版番茄 Todo 后再导出，避免导出运行中的中间状态",
    );
  } catch {
    /* 没有 -wal 文件，旧库已干净关闭 */
  }
  let db;
  try {
    // readOnly：迁移导出是单向的，旧库一个字都不能动。
    db = new DatabaseSync(dbPath, { readOnly: true });
  } catch (e) {
    throw new Error(`无法以只读方式打开旧数据库 ${dbPath}：${e.message}`);
  }
  try {
    let row;
    try {
      row = db.prepare("SELECT data FROM app_state WHERE id=1").get();
    } catch (e) {
      throw new Error(
        `读取 ${dbPath} 的 app_state 表失败（库结构不是本应用旧库？）：${e.message}`,
      );
    }
    if (row === undefined) {
      throw new Error(
        `${dbPath} 的 app_state 表没有 id=1 的数据行，没有可导出的数据`,
      );
    }
    let data;
    try {
      data = JSON.parse(row.data);
    } catch (e) {
      throw new Error(`${dbPath} 中的 JSON 已损坏，无法解析：${e.message}`);
    }
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      throw new Error(`${dbPath} 中的 JSON 不是对象，不是本应用的旧库数据`);
    }
    if (data.version !== 3 && data.version !== 4) {
      throw new Error(
        `仅支持 version 3/4 的旧库，读到 version=${JSON.stringify(data.version)}；` +
          "更旧或更新的库请先用对应版本的旧应用打开并导出",
      );
    }
    const fromVersion = data.version;
    if (fromVersion === 3) {
      migrateV3(data, todayLocal());
    }
    return { data, fromVersion };
  } finally {
    db.close();
  }
}

// ── 写出 ─────────────────────────────────────────────────────────────────────

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// 临时文件必须与目标同目录：rename 只在同一文件系统内保证原子替换，
// 跨目录（如 /tmp）会退化成拷贝，可能留下半个文件。
function tmpSibling(path) {
  return `${path}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
}

/**
 * 从旧库一次性导出 plan.json 与 backup-v4.json 到 outDir。
 * 幂等：任一目标已存在且未传 force 时报错；两个文件先各自写临时文件、再逐一 rename，
 * 任何一步失败都会清掉临时文件。返回 { planPath, backupPath, summary }。
 */
export async function exportFromDb(dbPath, outDir, { force = false } = {}) {
  const { data, fromVersion } = loadAppData(dbPath);
  const plan = buildPlan(data);
  const planJson = JSON.stringify(plan, null, 2);
  const backupJson = JSON.stringify(buildBackup(data), null, 2);

  const planPath = join(outDir, "plan.json");
  const backupPath = join(outDir, "backup-v4.json");
  try {
    await mkdir(outDir, { recursive: true });
  } catch (e) {
    throw new Error(`无法创建输出目录 ${outDir}：${e.message}`);
  }
  if (!force) {
    for (const path of [planPath, backupPath]) {
      if (await exists(path)) {
        throw new Error(
          `输出文件 ${path} 已存在，拒绝覆盖；确认无误后用 --force 覆盖`,
        );
      }
    }
  }

  const planTmp = tmpSibling(planPath);
  const backupTmp = tmpSibling(backupPath);
  try {
    await writeFile(planTmp, planJson);
    await writeFile(backupTmp, backupJson);
    await rename(planTmp, planPath);
    await rename(backupTmp, backupPath);
  } catch (e) {
    await rm(planTmp, { force: true }).catch(() => {});
    await rm(backupTmp, { force: true }).catch(() => {});
    throw new Error(`写出失败，未完成导出：${e.message}`);
  }

  const teaching = new Set(
    (data.education?.focusTasks ?? []).map((l) => l.taskId),
  );
  const skippedCompleted = (data.tasks ?? []).filter((t) => t.completed).length;
  const skippedTeaching = (data.tasks ?? []).filter(
    (t) => !t.completed && teaching.has(t.id),
  ).length;
  return {
    planPath,
    backupPath,
    summary: {
      fromVersion,
      migrated: fromVersion === 3,
      pomodoroMinutes: plan.pomodoroMinutes,
      totalTasks: (data.tasks ?? []).length,
      exportedTasks: plan.tasks.length,
      skippedCompleted,
      skippedTeaching,
      templates: (data.templates ?? []).length,
      prints: (data.prints ?? []).length,
      habits: (data.habits ?? []).length,
      blocks: (data.blocks ?? []).length,
      allProjects: (data.projects ?? []).length,
      projects: plan.projects.length,
      sessions: (data.sessions ?? []).length,
      identities: (data.identities ?? []).length,
      visions: (data.visions ?? []).length,
    },
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const USAGE = `一次性把旧 sqlite 库导出为新 runtime 的数据文件（plan.json + backup-v4.json）

用法：node scripts/export-sqlite.mjs [--db PATH] [--out DIR] [--force] [--help]

  --db PATH   旧数据库路径；默认 $XDG_DATA_HOME（或 ~/.local/share）/studio.tomato.todo/tomato.sqlite3
  --out DIR   输出目录；默认当前目录
  --force     覆盖已存在的 plan.json / backup-v4.json；默认拒绝覆盖
  --help      显示本帮助`;

function defaultDbPath() {
  const dataHome =
    process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  return join(dataHome, "studio.tomato.todo", "tomato.sqlite3");
}

function parseArgs(argv) {
  let db;
  let out;
  let force = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (arg === "--db") {
      if (i + 1 >= argv.length)
        throw new Error(`--db 需要一个路径参数\n\n${USAGE}`);
      db = argv[++i];
      continue;
    }
    if (arg === "--out") {
      if (i + 1 >= argv.length)
        throw new Error(`--out 需要一个路径参数\n\n${USAGE}`);
      out = argv[++i];
      continue;
    }
    if (arg.startsWith("--db=")) {
      db = arg.slice("--db=".length) || undefined;
      continue;
    }
    if (arg.startsWith("--out=")) {
      out = arg.slice("--out=".length) || undefined;
      continue;
    }
    throw new Error(`未知参数：${arg}\n\n${USAGE}`);
  }
  return { help: false, db: db ?? defaultDbPath(), out: out ?? ".", force };
}

async function main() {
  const { help, db, out, force } = parseArgs(process.argv.slice(2));
  if (help) {
    console.log(USAGE);
    return;
  }
  const result = await exportFromDb(db, out, { force });
  const s = result.summary;
  console.log(
    `旧库：${resolve(db)}（v${s.fromVersion}${s.migrated ? " → 已按 v4 规则迁移" : ""}，只读打开）`,
  );
  console.log(
    `plan.json：未完成任务 ${s.exportedTasks}/${s.totalTasks}` +
      `（跳过已完成 ${s.skippedCompleted}、教学待办 ${s.skippedTeaching}）；` +
      `模板 ${s.templates}、印刷记录 ${s.prints}、习惯组 ${s.habits}、课表时段 ${s.blocks}、` +
      `引用项目 ${s.projects}/${s.allProjects}、番茄时长 ${s.pomodoroMinutes} 分钟`,
  );
  console.log(
    `backup-v4.json：完整 v4 数据（任务 ${s.totalTasks}、专注历史 ${s.sessions} 条、` +
      `ID 登记 ${s.identities}、愿景 ${s.visions}）`,
  );
  console.log(
    `已写出：${resolve(result.planPath)} 与 ${resolve(result.backupPath)}`,
  );
}

// main 守卫：只有被 node 直接执行时才跑 CLI；被测试 import 时只拿到具名函数。
// import.meta.url 与 argv[1] 都以 file:// 形式比较，避免 Windows 盘符大小写之类的偏差。
const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  main().catch((e) => {
    console.error(`错误：${e.message}`);
    process.exitCode = 1;
  });
}
