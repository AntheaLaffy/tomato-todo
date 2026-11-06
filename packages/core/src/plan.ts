//! 学习计划 v6：便携计划刻意不含执行历史与本机偏好。
//! 对应 crates/core/src/plan.rs。

import { AppError, clone, ensure } from "./errors";
import {
  asArray,
  asBool,
  asInt,
  asOpt,
  asStr,
  field,
  isObject,
  oneOf,
  rejectUnknown,
  requiredField,
} from "./json";
import { AppData } from "./lib";
import type {
  PlanFile,
  PlanProject,
  PlanSubtask,
  PlanTask,
  Repeat,
  Task,
  Template,
} from "./model";
import {
  deleteTemplate,
  parsePrintRecord,
  parseTemplate,
  replaceAppData,
  serializePrintRecord,
  serializeTemplate,
} from "./templates";
import { parseBlock, serializeBlock } from "./blocks";
import { parseHabit, serializeHabit } from "./habits";

const PLAN_FILE_KEYS = [
  "format",
  "version",
  "pomodoroMinutes",
  "projects",
  "tasks",
  "blocks",
  "templates",
  "prints",
  "habits",
  "replace",
] as const;
const PLAN_PROJECT_KEYS = ["id", "name", "color", "appWhitelist"] as const;
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
] as const;
const PLAN_SUBTASK_KEYS = ["id", "title"] as const;

export function parsePlanFile(raw: unknown): PlanFile {
  if (!isObject(raw)) throw new AppError("计划文件必须是对象");
  rejectUnknown(raw, [...PLAN_FILE_KEYS], "计划文件");
  return {
    format: requiredField(raw, "format", "计划文件", asStr),
    version: requiredField(raw, "version", "计划文件", asInt),
    pomodoroMinutes: requiredField(raw, "pomodoroMinutes", "计划文件", asInt),
    projects: requiredField(raw, "projects", "计划文件", (v) =>
      asArray(v, "projects").map(parsePlanProject),
    ),
    tasks: requiredField(raw, "tasks", "计划文件", (v) =>
      asArray(v, "tasks").map(parsePlanTask),
    ),
    blocks: field(
      raw,
      "blocks",
      "计划文件",
      (v) => asArray(v, "blocks").map(parseBlock),
      [],
    ),
    templates: field(
      raw,
      "templates",
      "计划文件",
      (v) => asArray(v, "templates").map(parseTemplate),
      [],
    ),
    prints: field(
      raw,
      "prints",
      "计划文件",
      (v) => asArray(v, "prints").map(parsePrintRecord),
      [],
    ),
    habits: field(
      raw,
      "habits",
      "计划文件",
      (v) => asArray(v, "habits").map(parseHabit),
      [],
    ),
    replace: field(raw, "replace", "计划文件", asBool, false),
  };
}

function parsePlanProject(raw: unknown): PlanProject {
  if (!isObject(raw)) throw new AppError("计划项目必须是对象");
  rejectUnknown(raw, [...PLAN_PROJECT_KEYS], "计划项目");
  return {
    id: requiredField(raw, "id", "计划项目", asStr),
    name: requiredField(raw, "name", "计划项目", asStr),
    color: requiredField(raw, "color", "计划项目", asStr),
    appWhitelist: field(
      raw,
      "appWhitelist",
      "计划项目",
      (v) =>
        asOpt(v, "appWhitelist", (x) =>
          asArray(x, "appWhitelist").map((a) => asStr(a, "应用 ID")),
        ),
      null,
    ) as string[] | null,
  };
}

function parsePlanSubtask(raw: unknown): PlanSubtask {
  if (!isObject(raw)) throw new AppError("计划子步骤必须是对象");
  rejectUnknown(raw, [...PLAN_SUBTASK_KEYS], "计划子步骤");
  return {
    id: requiredField(raw, "id", "计划子步骤", asStr),
    title: requiredField(raw, "title", "计划子步骤", asStr),
  };
}

function parsePlanTask(raw: unknown): PlanTask {
  if (!isObject(raw)) throw new AppError("计划任务必须是对象");
  rejectUnknown(raw, [...PLAN_TASK_KEYS], "计划任务");
  return {
    id: requiredField(raw, "id", "计划任务", asStr),
    title: requiredField(raw, "title", "计划任务", asStr),
    templateId: field(
      raw,
      "templateId",
      "计划任务",
      (v) => asOpt(v, "templateId", asStr),
      null,
    ) as string | null,
    habitId: field(
      raw,
      "habitId",
      "计划任务",
      (v) => asOpt(v, "habitId", asStr),
      null,
    ) as string | null,
    recurring: field(raw, "recurring", "计划任务", asBool, false),
    scrapMinutes: field(raw, "scrapMinutes", "计划任务", asInt, 0),
    notes: field(raw, "notes", "计划任务", asStr, ""),
    projectId: field(
      raw,
      "projectId",
      "计划任务",
      (v) => asOpt(v, "projectId", asStr),
      null,
    ) as string | null,
    dueDate: field(
      raw,
      "dueDate",
      "计划任务",
      (v) => asOpt(v, "dueDate", asStr),
      null,
    ) as string | null,
    reminderTime: field(
      raw,
      "reminderTime",
      "计划任务",
      (v) => asOpt(v, "reminderTime", asStr),
      null,
    ) as string | null,
    focusMinutes: field(
      raw,
      "focusMinutes",
      "计划任务",
      (v) => asOpt(v, "focusMinutes", (x) => asInt(x, "focusMinutes")),
      null,
    ) as number | null,
    priority: field(raw, "priority", "计划任务", asInt, 0),
    estimate: field(raw, "estimate", "计划任务", asInt, 1),
    tags: field(
      raw,
      "tags",
      "计划任务",
      (v) => asArray(v, "tags").map((t) => asStr(t, "标签")),
      [],
    ),
    subtasks: field(
      raw,
      "subtasks",
      "计划任务",
      (v) => asArray(v, "subtasks").map(parsePlanSubtask),
      [],
    ),
    repeat: field(
      raw,
      "repeat",
      "计划任务",
      (v) => oneOf(v, "repeat", ["none", "daily", "weekdays", "weekly"]),
      "none",
    ) as Repeat,
  };
}

export function serializePlanFile(plan: PlanFile): Record<string, unknown> {
  const out: Record<string, unknown> = {
    format: plan.format,
    version: plan.version,
    pomodoroMinutes: plan.pomodoroMinutes,
    projects: plan.projects.map((p) => {
      const o: Record<string, unknown> = {
        id: p.id,
        name: p.name,
        color: p.color,
      };
      if (p.appWhitelist !== null) o["appWhitelist"] = p.appWhitelist;
      return o;
    }),
    tasks: plan.tasks.map((t) => {
      const o: Record<string, unknown> = {
        id: t.id,
        title: t.title,
        templateId: t.templateId,
        habitId: t.habitId,
        recurring: t.recurring,
        scrapMinutes: t.scrapMinutes,
        notes: t.notes,
        projectId: t.projectId,
        dueDate: t.dueDate,
        priority: t.priority,
        estimate: t.estimate,
        tags: t.tags,
        subtasks: t.subtasks.map((s) => ({ id: s.id, title: s.title })),
        repeat: t.repeat,
      };
      if (t.reminderTime !== null) o["reminderTime"] = t.reminderTime;
      if (t.focusMinutes !== null) o["focusMinutes"] = t.focusMinutes;
      return o;
    }),
    blocks: plan.blocks.map(serializeBlock),
    templates: plan.templates.map(serializeTemplate),
    prints: plan.prints.map(serializePrintRecord),
    habits: plan.habits.map(serializeHabit),
  };
  if (plan.replace) out["replace"] = true;
  return out;
}

/** 文件实例 → 本地任务：进度与历史留在本机。 */
function planTaskToTask(t: PlanTask, at: number, estimate: number): Task {
  return {
    id: t.id,
    templateId: t.templateId,
    recurring: t.recurring || t.repeat !== "none",
    title: t.title,
    notes: t.notes,
    projectId: t.projectId,
    habitId: t.habitId,
    dueDate: t.dueDate,
    reminderTime: t.reminderTime,
    focusMinutes: t.focusMinutes,
    reminderFired: false,
    reminderPending: false,
    reminderExpired: false,
    scrapMinutes: t.scrapMinutes,
    priority: t.priority,
    estimate,
    completed: false,
    completedAt: null,
    createdAt: at,
    tags: [...t.tags],
    subtasks: t.subtasks.map((s) => ({
      id: s.id,
      title: s.title,
      done: false,
    })),
  };
}

/** 配置来自文件；进度与历史留在本机。提醒状态只在时间槽不变时存活。 */
function planTaskMerge(
  t: PlanTask,
  old: Task,
  at: number,
  estimate: number,
): Task {
  const task = planTaskToTask(t, at, estimate);
  task.createdAt = old.createdAt;
  task.completed = old.completed;
  task.completedAt = old.completedAt;
  if (old.dueDate === t.dueDate && old.reminderTime === t.reminderTime) {
    task.reminderFired = old.reminderFired;
    task.reminderPending = old.reminderPending;
    task.reminderExpired = old.reminderExpired;
  }
  for (const sub of task.subtasks) {
    const prev = old.subtasks.find((s) => s.id === sub.id);
    if (prev !== undefined) sub.done = prev.done;
  }
  return task;
}

export function validatePlanFile(plan: PlanFile): void {
  if (plan.format !== "tomato-todo-plan" || plan.version !== 6) {
    throw new AppError("仅支持计划 v6；旧计划请按新格式重新导出");
  }
  if (plan.tasks.some((t) => t.repeat !== "none")) {
    throw new AppError("实例不拥有重复规则，请使用周期模板");
  }
  if (plan.pomodoroMinutes < 1 || plan.pomodoroMinutes > 180) {
    throw new AppError("计划的番茄时长需为 1–180 分钟");
  }
  const data = new AppData({
    projects: plan.projects.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      appWhitelist: p.appWhitelist === null ? null : [...p.appWhitelist],
    })),
    tasks: plan.tasks.map((t) => planTaskToTask(t, 0, t.estimate)),
    blocks: plan.blocks.map((b) => ({ ...b, days: [...b.days] })),
    templates: plan.templates,
    prints: plan.prints,
    habits: plan.habits,
  });
  data.validate();
}

/** 换算本地番茄段数；无单次时长按文件番茄时长换算并向上取整。 */
export function planEstimate(
  t: PlanTask,
  pomodoro: number,
  focus: number,
): number {
  const estimate =
    t.focusMinutes !== null
      ? t.estimate
      : Math.ceil((t.estimate * pomodoro) / focus);
  if (estimate > 99) {
    throw new AppError(`任务“${t.title}”换算后超过 99 个番茄，请先拆分任务`);
  }
  return estimate;
}

function convertedEstimate(
  estimate: number,
  focus: number | null,
  source: number,
  destination: number,
): number {
  const converted =
    focus !== null ? estimate : Math.ceil((estimate * source) / destination);
  if (converted > 99) {
    throw new AppError("换算后超过 99 个番茄，请先拆分模板");
  }
  return converted;
}

/** 导入：先完整校验候选，再原子提交。 */
export function mergePlan(plan: PlanFile, data: AppData, at: number): void {
  validatePlanFile(plan);
  const next = clone(data);
  for (const planProject of plan.projects) {
    const existing = next.projects.find((p) => p.id === planProject.id);
    if (existing !== undefined) {
      // 项目配置是重新生成的，进度不是：文件获胜；省略白名单保留本机清单。
      existing.name = planProject.name;
      existing.color = planProject.color;
      if (planProject.appWhitelist !== null) {
        existing.appWhitelist = [...planProject.appWhitelist];
      }
    } else {
      next.projects.push({
        id: planProject.id,
        name: planProject.name,
        color: planProject.color,
        appWhitelist:
          planProject.appWhitelist === null
            ? null
            : [...planProject.appWhitelist],
      });
    }
  }
  for (const habit of plan.habits) {
    const existing = next.habits.find((h) => h.id === habit.id);
    if (existing !== undefined) {
      existing.name = habit.name;
    } else {
      next.habits.push({ id: habit.id, name: habit.name });
    }
  }
  // 时段是纯配置：文件版本替换本机版本，未提及的保持不动。
  for (const block of plan.blocks) {
    const existing = next.blocks.find((b) => b.id === block.id);
    if (existing !== undefined) {
      next.blocks[next.blocks.indexOf(existing)] = {
        ...block,
        days: [...block.days],
      };
    } else {
      next.blocks.push({ ...block, days: [...block.days] });
    }
  }
  for (const planTemplate of plan.templates) {
    const template: Template = clone(planTemplate);
    template.shape.estimate = convertedEstimate(
      template.shape.estimate,
      template.shape.focusMinutes,
      plan.pomodoroMinutes,
      data.settings.focusMinutes,
    );
    const existing = next.templates.find((t) => t.id === template.id);
    if (existing !== undefined) {
      next.templates[next.templates.indexOf(existing)] = template;
    } else {
      next.templates.push(template);
    }
  }
  for (const print of plan.prints) {
    if (
      !next.prints.some(
        (p) => p.templateId === print.templateId && p.date === print.date,
      )
    ) {
      next.prints.push({ templateId: print.templateId, date: print.date });
    }
  }
  // 已有实例取文件配置、保留进度。
  const incoming = new Map<string, PlanTask>();
  for (const t of plan.tasks) incoming.set(t.id, t);
  for (let i = 0; i < next.tasks.length; i += 1) {
    const task = next.tasks[i]!;
    const planTask = incoming.get(task.id);
    if (planTask === undefined) continue;
    if (data.teachingTask(task.id) !== undefined) {
      throw new AppError("计划文件不能改写教学待办，请调整对应课程或作业");
    }
    const estimate = planEstimate(
      planTask,
      plan.pomodoroMinutes,
      data.settings.focusMinutes,
    );
    const old = clone(task);
    next.tasks[i] = planTaskMerge(planTask, old, at, estimate);
  }
  const localIds = new Set(next.tasks.map((t) => t.id));
  for (const planTask of plan.tasks) {
    if (localIds.has(planTask.id)) continue;
    const estimate = planEstimate(
      planTask,
      plan.pomodoroMinutes,
      data.settings.focusMinutes,
    );
    const instance = planTaskToTask(planTask, at, estimate);
    if (instance.templateId !== null) {
      if (
        !next.prints.some(
          (p) =>
            p.templateId === instance.templateId && p.date === instance.dueDate,
        )
      ) {
        next.prints.push({
          templateId: instance.templateId,
          date: instance.dueDate,
        });
      }
    }
    next.tasks.push(instance);
  }
  if (plan.replace) {
    // 文件即整个计划：删掉它不再提及的未完成项，历史永不删。
    const plannedTasks = new Set(plan.tasks.map((t) => t.id));
    next.tasks = next.tasks.filter(
      (t) =>
        t.completed ||
        plannedTasks.has(t.id) ||
        data.teachingTask(t.id) !== undefined,
    );
    const plannedHabits = new Set(plan.habits.map((h) => h.id));
    const removedHabits = next.habits
      .filter((h) => !plannedHabits.has(h.id))
      .map((h) => h.id);
    if (removedHabits.length > 0) {
      next.habits = next.habits.filter((h) => !removedHabits.includes(h.id));
      for (const task of next.tasks) {
        if (task.habitId !== null && removedHabits.includes(task.habitId))
          task.habitId = null;
      }
      for (const template of next.templates) {
        if (
          template.shape.habitId !== null &&
          removedHabits.includes(template.shape.habitId)
        ) {
          template.shape.habitId = null;
        }
      }
    }
    const plannedTemplates = new Set(plan.templates.map((t) => t.id));
    const removedTemplates = next.templates
      .filter((t) => !plannedTemplates.has(t.id))
      .map((t) => t.id);
    for (const id of removedTemplates) {
      deleteTemplate(next, id);
    }
    const plannedBlocks = new Set(plan.blocks.map((b) => b.id));
    next.blocks = next.blocks.filter((b) => plannedBlocks.has(b.id));
  }
  next.validate();
  replaceAppData(data, next);
}

/** 导出：不含完成进度、专注历史、计时器与本机设置。 */
export function exportPlan(data: AppData): PlanFile {
  const tasks: PlanTask[] = data.tasks
    .filter((t) => !t.completed && data.teachingTask(t.id) === undefined)
    .map((t) => ({
      templateId: t.templateId,
      habitId: t.habitId,
      recurring: t.recurring,
      scrapMinutes: t.scrapMinutes,
      id: t.id,
      title: t.title,
      notes: t.notes,
      projectId: t.projectId,
      dueDate: t.dueDate,
      reminderTime: t.reminderTime,
      focusMinutes: t.focusMinutes,
      priority: t.priority,
      estimate: t.estimate,
      tags: [...t.tags],
      repeat: "none" as const,
      subtasks: t.subtasks.map((s) => ({ id: s.id, title: s.title })),
    }));
  const used = new Set<string>([
    ...tasks
      .filter((t) => t.projectId !== null)
      .map((t) => t.projectId as string),
    ...data.templates
      .filter((t) => t.shape.projectId !== null)
      .map((t) => t.shape.projectId as string),
  ]);
  return {
    format: "tomato-todo-plan",
    version: 6,
    replace: false,
    blocks: data.blocks.map((b) => ({ ...b, days: [...b.days] })),
    templates: data.templates.map((t) => clone(t)),
    prints: data.prints.map((p) => ({ ...p })),
    habits: data.habits.map((h) => ({ ...h })),
    pomodoroMinutes: data.settings.focusMinutes,
    projects: data.projects
      .filter((p) => used.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        appWhitelist: p.appWhitelist === null ? null : [...p.appWhitelist],
      })),
    tasks,
  };
}
