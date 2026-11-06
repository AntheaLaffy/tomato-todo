#!/usr/bin/env node
// 全量数据导入：把旧版完整备份 v4 + 现有 plan.json 合并进重写后的 runtime 数据目录。
//
// 为什么需要它：重写后 runtime 用 @tomato/core（packages/core）作为唯一权威实现，
// 数据从旧 SQLite 迁出后落在 backup-v4.json；现有 plan.json 可能带着更新的计划
// 配置。首次启动前要把两者合并成 plan.json（计划 v6 + 运行进度）/state.json
// （计时/设置/会话/身份/愿景/锁机/教学），并不丢任何历史。
//
// 合并语义（导入当时）：
// - 备份是完整历史的权威来源：任务进度、专注记录、永久 ID、项目/教学记录、
//   设置都以备份为准；
// - 现有 plan.json 是计划配置的权威来源（按计划 v6 导入规则合并：同 ID 更新
//   配置、保留备份里的完成进度与步骤状态；备份没有的任务按未完成导入）；
// - 备份之后新建、只存在于 plan.json/state.json 的任务与会话原样保留；
// - 安全规则与「导入备份」一致：计时器暂停、清除锁机执行状态、定时规则全部
//   停用、关闭 autoStartTasks，绝不因为导入立刻锁住这台电脑。
//
// 幂等：重复运行得到同样的数据（以文件 sha256 验证）；先复制旧文件到
// <data>/backups/import-<时间戳>/，任何解析/校验失败都不会写原文件。
//
// 只读 backup-v4.json、plan.json、state.json；绝不读写 tomato.sqlite3。

import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import * as core from "../runtime/vendor/core.mjs";
import {
  PLAN_FILE,
  STATE_FILE,
  readDataFiles,
  writeDataFiles,
} from "../runtime/src/data-files.mjs";

const USAGE = `用法: node scripts/import-backup.mjs [--backup <file>] [--data <dir>] [--dry-run]

  --backup   旧版完整备份 v4（默认 <data>/backup-v4.json）
  --data     runtime 数据目录（默认 ~/.local/share/studio.tomato.todo）
  --dry-run  只打印合并结果，不写任何文件
`;

class UsageError extends Error {}

function parseArgs(argv) {
  const opts = { backup: null, data: null, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--backup":
      case "--data": {
        const value = argv[i + 1];
        if (value === undefined) throw new UsageError(`${arg} 缺少值`);
        i += 1;
        if (arg === "--backup") opts.backup = value;
        else opts.data = value;
        break;
      }
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--help":
      case "-h":
        console.error(USAGE);
        process.exit(0);
        break;
      default:
        throw new UsageError(`未知参数：${arg}\n${USAGE}`);
    }
  }
  return opts;
}

function defaultDataDir() {
  const base =
    process.env.XDG_DATA_HOME ||
    join(process.env.HOME || homedir(), ".local", "share");
  return join(base, "studio.tomato.todo");
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${file} 读取失败：${String(error?.message ?? error)}`);
  }
}

const PLAN_TASK_KEYS = [
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
];

/**
 * 从 plan.json 提取纯计划 v6（去掉运行进度、旧导出多写的 reminderFired 等）。
 * plan.json 可能是旧应用导出的纯计划，也可能是 runtime 写的超集。
 */
function planFileOf(raw, current, base) {
  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks
        // 教学待办随课程/作业维护，计划文件不能改写（core mergePlan 会拒绝）。
        .filter((task) => current.teachingTask(task.id) === undefined)
        .map((task) => {
          const out = {};
          for (const key of PLAN_TASK_KEYS) {
            if (task[key] !== undefined) out[key] = task[key];
          }
          // 实例不拥有重复规则；旧文件里 repeat 可能是省略/`none`。
          out.repeat = "none";
          if (!Array.isArray(out.tags)) out.tags = [];
          if (!Array.isArray(out.subtasks)) {
            out.subtasks = [];
          } else {
            out.subtasks = out.subtasks.map((s) => ({
              id: s.id,
              title: s.title,
            }));
          }
          return out;
        })
    : [];
  const projects = Array.isArray(raw.projects) ? raw.projects : [];
  const habits = Array.isArray(raw.habits) ? raw.habits : [];
  const templates = Array.isArray(raw.templates) ? raw.templates : [];
  // 计划文件必须自洽（validatePlanFile 会拒绝指向不存在项目的任务）：runtime
  // 写入的 plan.json 通常已含全部引用实体，缺失时从当前数据补齐，避免手工
  // 编辑过的文件整份失败。
  const projectIds = new Set(projects.map((p) => p.id));
  const habitIds = new Set(habits.map((h) => h.id));
  const templateIds = new Set(templates.map((t) => t.id));
  for (const task of tasks) {
    if (task.projectId && !projectIds.has(task.projectId)) {
      const project =
        current.projects.find((p) => p.id === task.projectId) ??
        base.projects.find((p) => p.id === task.projectId);
      if (project === undefined) continue;
      projects.push(core.serializeProject(project));
      projectIds.add(project.id);
    }
    if (task.habitId && !habitIds.has(task.habitId)) {
      const habit =
        current.habits.find((h) => h.id === task.habitId) ??
        base.habits.find((h) => h.id === task.habitId);
      if (habit === undefined) continue;
      habits.push(core.serializeHabit(habit));
      habitIds.add(habit.id);
    }
    if (task.templateId && !templateIds.has(task.templateId)) {
      const template =
        current.templates.find((t) => t.id === task.templateId) ??
        base.templates.find((t) => t.id === task.templateId);
      if (template === undefined) continue;
      templates.push(core.serializeTemplate(template));
      templateIds.add(template.id);
    }
  }
  return {
    format: "tomato-todo-plan",
    version: 6,
    pomodoroMinutes: raw.pomodoroMinutes ?? 25,
    projects,
    tasks,
    blocks: Array.isArray(raw.blocks) ? raw.blocks : [],
    templates,
    prints: Array.isArray(raw.prints) ? raw.prints : [],
    habits,
  };
}

/** 导入即恢复备份：安全规则与 docs/BACKUP_FORMAT.md「导入后」一致。 */
function settleForImport(data, at) {
  data.version = 4;
  const timer = data.timer;
  timer.remainingSecs = Math.max(1, core.timerRemaining(timer, at));
  timer.running = false;
  timer.deadline = null;
  data.lock.active = null;
  data.lock.suppressedUntil = 0;
  for (const schedule of data.lock.schedules) schedule.enabled = false;
  data.settings.autoStartTasks = false;
  return data;
}

function counts(data) {
  const education = data.education;
  return {
    version: data.version,
    tasks: data.tasks.length,
    tasksCompleted: data.tasks.filter((t) => t.completed).length,
    sessions: data.sessions.length,
    identities: data.identities.length,
    projects: data.projects.length,
    habits: data.habits.length,
    visions: data.visions.length,
    blocks: data.blocks.length,
    templates: data.templates.length,
    prints: data.prints.length,
    lockSchedules: data.lock.schedules.length,
    education: {
      projects: education.projects.length,
      resources: education.resources.length,
      semesters: education.semesters.length,
      semesterHistory: education.semesterHistory.length,
      lessons: education.lessons.length,
      assessments: education.assessments.length,
      submissions: education.submissions.length,
      grades: education.grades.length,
      reviews: education.reviews.length,
      completedTasks: education.completedTasks.length,
      progress: education.progress.length,
      corrections: education.corrections.length,
      events: education.events.length,
    },
  };
}

/**
 * 合并备份 + 现有数据，返回新的 AppData（不落盘）。
 * 失败时抛错，调用方不得覆盖旧文件。
 */
export function mergeImport({ backupFile, dataDir, at }) {
  if (!existsSync(backupFile)) {
    throw new Error(`找不到备份文件：${backupFile}`);
  }
  if (!existsSync(dataDir)) {
    throw new Error(`数据目录不存在：${dataDir}（请先启动一次 runtime）`);
  }

  // 1) 备份是完整历史（docs/BACKUP_FORMAT.md：顶层就是 AppData，无 format 标记）。
  const rawBackup = readJson(backupFile);
  const base = core.parseAppData(rawBackup);
  base.validate();
  const backupTaskIds = new Set(base.tasks.map((t) => t.id));
  const backupSessionIds = new Set(base.sessions.map((s) => s.id));
  const backupIdentityIds = new Set(base.identities.map((i) => i.id));
  const backupVisionIds = new Set(base.visions.map((v) => v.id));

  // 2) 现有 plan.json / state.json（可能不存在）。
  const planPath = join(dataDir, PLAN_FILE);
  const current = readDataFiles(dataDir, at).data;
  const currentTasks = new Map(current.tasks.map((t) => [t.id, t]));

  // 3) 现有 plan.json 的计划配置覆盖备份（同 ID 保留进度，新增按未完成导入）。
  if (existsSync(planPath)) {
    const plan = core.parsePlanFile(
      planFileOf(readJson(planPath), current, base),
    );
    core.mergePlan(plan, base, at);
  }

  // 4) 备份之后才出现的任务：以现有数据为准（保留完成进度）。
  for (const [id, task] of currentTasks) {
    if (backupTaskIds.has(id)) continue;
    const index = base.tasks.findIndex((t) => t.id === id);
    if (index >= 0) base.tasks[index] = task;
    else base.tasks.push(task);
  }
  // 5) 专注记录/身份/愿景按 ID 取并集，不丢本机新增。
  for (const session of current.sessions) {
    if (!backupSessionIds.has(session.id)) base.sessions.push(session);
  }
  for (const identity of current.identities) {
    if (!backupIdentityIds.has(identity.id)) base.identities.push(identity);
  }
  for (const vision of current.visions) {
    if (!backupVisionIds.has(vision.id)) base.visions.push(vision);
  }

  settleForImport(base, at);
  base.validate();
  return base;
}

/** 把现有文件复制到 backups/import-<时间戳>/，返回目录（没有旧文件时返回 null）。 */
function backupExisting(dataDir) {
  const files = [PLAN_FILE, STATE_FILE].filter((name) =>
    existsSync(join(dataDir, name)),
  );
  if (files.length === 0) return null;
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "")
    .replace("T", "-");
  const dir = join(dataDir, "backups", `import-${stamp}`);
  mkdirSync(dir, { recursive: true });
  for (const name of files) {
    copyFileSync(join(dataDir, name), join(dir, name));
  }
  return dir;
}

export function runImport(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  const dataDir = resolve(opts.data ?? defaultDataDir());
  const backupFile = resolve(opts.backup ?? join(dataDir, "backup-v4.json"));
  const at = Math.floor(Date.now() / 1000);

  const merged = mergeImport({ backupFile, dataDir, at });
  const summary = counts(merged);

  if (opts.dryRun) {
    return { dryRun: true, dataDir, backupFile, ...summary };
  }

  // 先备份旧文件，再原子写；任何一步失败都不会留下写坏的原文件。
  const backupDir = backupExisting(dataDir);
  writeDataFiles(dataDir, merged);
  return { dryRun: false, dataDir, backupFile, backupDir, ...summary };
}

function main() {
  try {
    const result = runImport();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(error.message);
      process.exit(2);
    }
    console.error(`import-backup: ${error?.message ?? error}`);
    process.exit(1);
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`
) {
  main();
}

export { main };
