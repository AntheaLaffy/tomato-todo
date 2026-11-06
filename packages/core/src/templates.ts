//! 模板与印刷：形状印时复制，账本独立于实例，删了不会重现。
//! 对应 crates/core/src/templates.rs。AppData 方法以自由函数 + lib.ts 薄包装提供。

import { AppError, clone, ensure } from "./errors";
import { id } from "./ids";
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
import type {
  CalendarSlot,
  PrintRecord,
  Printing,
  PrintSlot,
  Shape,
  Task,
  Template,
  TemplateSubtask,
} from "./model";
import type { AppData } from "./lib";
import { isHabit, kindOf } from "./model";
import { windowMinutes } from "./reminders";
import { addDays, dateAt, minutesOf, parseDate, secondsOfDay, validDate, validTime, weekStart, weekdayMonday } from "./time";

const TEMPLATE_SUBTASK_KEYS = ["id", "title"] as const;
const SHAPE_KEYS = [
  "title",
  "notes",
  "projectId",
  "habitId",
  "focusMinutes",
  "scrapMinutes",
  "priority",
  "estimate",
  "tags",
  "subtasks",
] as const;
const PRINT_SLOT_KEYS = ["days", "time"] as const;
const CALENDAR_SLOT_KEYS = ["dates", "time"] as const;
const TEMPLATE_KEYS = ["id", "shape", "printing", "automatic", "printAheadDays"] as const;
const PRINT_RECORD_KEYS = ["templateId", "date"] as const;

export function parseTemplateSubtask(raw: unknown): TemplateSubtask {
  if (!isObject(raw)) throw new AppError("模板子任务必须是对象");
  rejectUnknown(raw, [...TEMPLATE_SUBTASK_KEYS], "模板子任务");
  return {
    id: requiredField(raw, "id", "模板子任务", asStr),
    title: requiredField(raw, "title", "模板子任务", asStr),
  };
}

export function parseShape(raw: unknown): Shape {
  if (!isObject(raw)) throw new AppError("模板形状必须是对象");
  rejectUnknown(raw, [...SHAPE_KEYS], "模板形状");
  return {
    title: requiredField(raw, "title", "模板形状", asStr),
    notes: field(raw, "notes", "模板形状", asStr, ""),
    projectId: field(raw, "projectId", "模板形状", (v) => asOpt(v, "projectId", asStr), null) as string | null,
    habitId: field(raw, "habitId", "模板形状", (v) => asOpt(v, "habitId", asStr), null) as string | null,
    focusMinutes: field(raw, "focusMinutes", "模板形状", (v) => asOpt(v, "focusMinutes", (x) => asInt(x, "focusMinutes")), null) as number | null,
    scrapMinutes: field(raw, "scrapMinutes", "模板形状", asInt, 0),
    priority: field(raw, "priority", "模板形状", asInt, 0),
    estimate: field(raw, "estimate", "模板形状", asInt, 1),
    tags: field(raw, "tags", "模板形状", (v) => asArray(v, "tags").map((t) => asStr(t, "标签")), []),
    subtasks: field(raw, "subtasks", "模板形状", (v) => asArray(v, "subtasks").map(parseTemplateSubtask), []),
  };
}

export function serializeShape(s: Shape): Record<string, unknown> {
  return {
    title: s.title,
    notes: s.notes,
    projectId: s.projectId,
    habitId: s.habitId,
    focusMinutes: s.focusMinutes,
    scrapMinutes: s.scrapMinutes,
    priority: s.priority,
    estimate: s.estimate,
    tags: s.tags,
    subtasks: s.subtasks.map((sub) => ({ id: sub.id, title: sub.title })),
  };
}

export function parsePrintSlot(raw: unknown): PrintSlot {
  if (!isObject(raw)) throw new AppError("周期时段必须是对象");
  rejectUnknown(raw, [...PRINT_SLOT_KEYS], "周期时段");
  return {
    days: asArray(requiredField(raw, "days", "周期时段", (v) => v), "days").map((d) => asInt(d, "周期星期")),
    time: field(raw, "time", "周期时段", (v) => asOpt(v, "time", asStr), null) as string | null,
  };
}

export function parseCalendarSlot(raw: unknown): CalendarSlot {
  if (!isObject(raw)) throw new AppError("日程时段必须是对象");
  rejectUnknown(raw, [...CALENDAR_SLOT_KEYS], "日程时段");
  return {
    dates: asArray(requiredField(raw, "dates", "日程时段", (v) => v), "dates").map((d) => asStr(d, "日程日期")),
    time: field(raw, "time", "日程时段", (v) => asOpt(v, "time", asStr), null) as string | null,
  };
}

export function parsePrinting(raw: unknown): Printing {
  if (!isObject(raw)) throw new AppError("印刷规则必须是对象");
  const kind = oneOf(requiredField(raw, "kind", "印刷规则", (v) => v), "印刷规则 kind", ["once", "calendar", "weekly"]);
  if (kind === "once") {
    rejectUnknown(raw, ["kind", "date", "time"], "一次性印刷规则");
    return {
      kind,
      date: field(raw, "date", "一次性印刷规则", (v) => asOpt(v, "date", asStr), null) as string | null,
      time: field(raw, "time", "一次性印刷规则", (v) => asOpt(v, "time", asStr), null) as string | null,
    };
  }
  if (kind === "calendar") {
    rejectUnknown(raw, ["kind", "slots"], "日程印刷规则");
    return { kind, slots: asArray(requiredField(raw, "slots", "日程印刷规则", (v) => v), "slots").map(parseCalendarSlot) };
  }
  rejectUnknown(raw, ["kind", "slots"], "周期印刷规则");
  return { kind, slots: asArray(requiredField(raw, "slots", "周期印刷规则", (v) => v), "slots").map(parsePrintSlot) };
}

export function serializePrinting(p: Printing): Record<string, unknown> {
  if (p.kind === "once") {
    return { kind: "once", date: p.date, time: p.time };
  }
  if (p.kind === "calendar") {
    return { kind: "calendar", slots: p.slots.map((s) => ({ dates: s.dates, time: s.time })) };
  }
  return { kind: "weekly", slots: p.slots.map((s) => ({ days: s.days, time: s.time })) };
}

export function parseTemplate(raw: unknown): Template {
  if (!isObject(raw)) throw new AppError("模板必须是对象");
  rejectUnknown(raw, [...TEMPLATE_KEYS], "模板");
  return {
    id: requiredField(raw, "id", "模板", asStr),
    shape: parseShape(requiredField(raw, "shape", "模板", (v) => v)),
    printing: parsePrinting(requiredField(raw, "printing", "模板", (v) => v)),
    automatic: field(raw, "automatic", "模板", asBool, false),
    printAheadDays: field(raw, "printAheadDays", "模板", asInt, 7),
  };
}

export function serializeTemplate(t: Template): Record<string, unknown> {
  return {
    id: t.id,
    shape: serializeShape(t.shape),
    printing: serializePrinting(t.printing),
    automatic: t.automatic,
    printAheadDays: t.printAheadDays,
  };
}

export function parsePrintRecord(raw: unknown): PrintRecord {
  if (!isObject(raw)) throw new AppError("印刷记录必须是对象");
  rejectUnknown(raw, [...PRINT_RECORD_KEYS], "印刷记录");
  return {
    templateId: requiredField(raw, "templateId", "印刷记录", asStr),
    date: field(raw, "date", "印刷记录", (v) => asOpt(v, "date", asStr), null) as string | null,
  };
}

export function serializePrintRecord(p: PrintRecord): Record<string, unknown> {
  return { templateId: p.templateId, date: p.date };
}

/** 周期模板才是重复来源。 */
export function templateRecurring(template: Template): boolean {
  return template.printing.kind === "weekly";
}

/** 一个日期对应的全部开始时刻；日期无效或不在安排内报错。 */
export function templateTimes(template: Template, date: string | null): (string | null)[] {
  if (date === null || !validDate(date)) {
    throw new AppError("无效的印刷日期");
  }
  const printing = template.printing;
  if (printing.kind === "once") {
    if (printing.time !== null && date === null) {
      throw new AppError("定时实例需要日期");
    }
    return [printing.time];
  }
  if (printing.kind === "calendar") {
    const times = printing.slots.filter((s) => s.dates.includes(date)).map((s) => s.time);
    if (times.length === 0) {
      throw new AppError("该日期不在日程表中");
    }
    return times;
  }
  const weekday = weekdayMonday(parseDate(date)!);
  const times = printing.slots.filter((s) => s.days.includes(weekday)).map((s) => s.time);
  if (times.length === 0) {
    throw new AppError("该日期不在本周安排中");
  }
  return times;
}

/** 印出实例：形状在印刷时刻复制。 */
export function templateInstance(template: Template, date: string | null, time: string | null, at: number): Task {
  const task: Task = {
    id: id(),
    templateId: template.id,
    recurring: templateRecurring(template),
    title: "",
    notes: "",
    projectId: null,
    habitId: null,
    dueDate: date,
    reminderTime: time,
    focusMinutes: null,
    scrapMinutes: 0,
    priority: 0,
    estimate: 1,
    reminderFired: false,
    reminderPending: false,
    reminderExpired: false,
    completed: false,
    completedAt: null,
    createdAt: at,
    tags: [],
    subtasks: [],
  };
  copyShape(template.shape, task);
  return task;
}

function copyShape(shape: Shape, task: Task): void {
  task.title = shape.title;
  task.notes = shape.notes;
  task.projectId = shape.projectId;
  task.habitId = shape.habitId;
  task.focusMinutes = shape.focusMinutes;
  task.scrapMinutes = isHabit(task) ? 0 : shape.scrapMinutes;
  task.priority = shape.priority;
  task.estimate = shape.estimate;
  task.tags = [...shape.tags];
  // 显式同步时保留匹配步骤的完成状态。
  task.subtasks = shape.subtasks.map((sub) => ({
    id: sub.id,
    title: sub.title,
    done: task.subtasks.some((old) => old.id === sub.id && old.done),
  }));
}

export function validateTemplates(data: AppData): void {
  if (data.templates.length > 5000 || data.prints.length > 200000) {
    throw new AppError("模板或印刷记录超出限制");
  }
  const ids = new Set<string>();
  for (const t of data.templates) {
    if (t.id.length === 0 || ids.has(t.id)) {
      throw new AppError("模板 ID 重复或为空");
    }
    ids.add(t.id);
    const s = t.shape;
    if (t.printAheadDays > 90) {
      throw new AppError("预印天数需为 0–90 天");
    }
    if (
      s.title.trim().length === 0 ||
      Array.from(s.title).length > 200 ||
      s.notes.length > 50000 ||
      s.priority > 3 ||
      s.estimate < 1 ||
      s.estimate > 99 ||
      s.scrapMinutes > 10080 ||
      (s.focusMinutes !== null && (s.focusMinutes < 1 || s.focusMinutes > 180)) ||
      s.tags.length > 20 ||
      s.tags.some((tag) => Array.from(tag).length > 40)
    ) {
      throw new AppError("无效的模板形状");
    }
    const subs = new Set<string>();
    if (
      s.subtasks.length > 200 ||
      s.subtasks.some(
        (sub) =>
          sub.id.length === 0 ||
          subs.has(sub.id) ||
          sub.title.trim().length === 0 ||
          Array.from(sub.title).length > 200,
      )
    ) {
      throw new AppError("无效的模板子任务");
    }
    for (const sub of s.subtasks) subs.add(sub.id);
    if (
      (s.projectId !== null && !data.projects.some((p) => p.id === s.projectId)) ||
      (s.habitId !== null && !data.habits.some((h) => h.id === s.habitId))
    ) {
      throw new AppError("模板引用了不存在的容器");
    }
    const printing = t.printing;
    if (printing.kind === "once") {
      if (printing.date === null || !validDate(printing.date) || (printing.time !== null && !validTime(printing.time))) {
        throw new AppError("无效的一次印刷日期或时间");
      }
      if (s.habitId !== null) {
        throw new AppError("习惯模板必须重复印刷");
      }
    } else if (printing.kind === "calendar") {
      if (printing.slots.length === 0 || printing.slots.length > 49 || s.habitId !== null) {
        throw new AppError("非重复日程需要 1–49 个时段，不能属于习惯组");
      }
      const seen = new Set<string>();
      const times = new Set<string>();
      for (const slot of printing.slots) {
        if (
          slot.dates.length === 0 ||
          slot.dates.length > 366 ||
          (slot.time !== null && !validTime(slot.time)) ||
          times.has(slot.time ?? "null") ||
          slot.dates.some((date) => !validDate(date) || seen.has(`${date}|${slot.time ?? "null"}`))
        ) {
          throw new AppError("无效或重复的日程时段，请把同一开始时间的日期合并");
        }
        times.add(slot.time ?? "null");
        for (const date of slot.dates) seen.add(`${date}|${slot.time ?? "null"}`);
      }
      if (seen.size > 366) {
        throw new AppError("一次日程表最多 366 项");
      }
    } else {
      if (printing.slots.length === 0 || printing.slots.length > 49) {
        throw new AppError("每周循环需要 1–49 个时段");
      }
      const seen = new Set<string>();
      for (const slot of printing.slots) {
        const unique = new Set(slot.days);
        if (
          slot.days.length === 0 ||
          slot.days.length > 7 ||
          unique.size !== slot.days.length ||
          slot.days.some((d) => d < 1 || d > 7) ||
          (slot.time !== null && !validTime(slot.time)) ||
          (s.habitId !== null && slot.time === null) ||
          slot.days.some((day) => seen.has(`${day}|${slot.time ?? "null"}`))
        ) {
          throw new AppError("无效或重复的周期时段");
        }
        for (const day of slot.days) seen.add(`${day}|${slot.time ?? "null"}`);
      }
      if (printing.slots.some((s) => s.time !== null) && printing.slots.some((s) => s.time === null)) {
        throw new AppError("一个周期不能混用定时与不定时单元");
      }
    }
  }
  const prints = new Set<string>();
  for (const p of data.prints) {
    if (
      !ids.has(p.templateId) ||
      p.date === null ||
      !validDate(p.date) ||
      prints.has(`${p.templateId}|${p.date}`)
    ) {
      throw new AppError("无效或重复的印刷记录");
    }
    prints.add(`${p.templateId}|${p.date}`);
  }
  if (data.tasks.some((t) => t.templateId !== null && !ids.has(t.templateId))) {
    throw new AppError("实例引用了不存在的模板");
  }
}

/** 临时（不留模板）批量印刷。 */
export function printInstances(data: AppData, shape: Shape, printing: Printing, at: number): void {
  if (printing.kind === "weekly") {
    throw new AppError("循环规则需要保留为模板");
  }
  const dates: (string | null)[] =
    printing.kind === "once"
      ? [printing.date]
      : [...new Set(printing.slots.flatMap((s) => s.dates))].sort();
  const templateId = id();
  data.templates.push({
    id: templateId,
    shape,
    printing,
    automatic: false,
    printAheadDays: 0,
  });
  data.validate();
  printTemplate(data, templateId, dates, at);
  deleteTemplate(data, templateId);
}

/** 保存模板：周期全定时的普通模板自动建立习惯组（同名复用）。 */
export function saveTemplate(data: AppData, template: Template): void {
  template.shape.title = template.shape.title.trim();
  if (
    template.shape.habitId === null &&
    template.printing.kind === "weekly" &&
    template.printing.slots.every((s) => s.time !== null)
  ) {
    const existingHabit = data.templates.find((t) => t.id === template.id)?.shape.habitId ?? null;
    const hid = existingHabit ?? id();
    if (!data.habits.some((h) => h.id === hid)) {
      data.habits.push({ id: hid, name: Array.from(template.shape.title).slice(0, 40).join("") });
    }
    template.shape.habitId = hid;
  }
  const index = data.templates.findIndex((t) => t.id === template.id);
  if (index >= 0) {
    data.templates[index] = template;
  } else {
    data.templates.push(template);
  }
}

/** 删除模板保留实例并清 templateId。 */
export function deleteTemplate(data: AppData, id: string): void {
  data.templates = data.templates.filter((t) => t.id !== id);
  data.prints = data.prints.filter((p) => p.templateId !== id);
  for (const task of data.tasks) {
    if (task.templateId === id) task.templateId = null;
  }
}

/** 手动印刷：周期规则按锚定日期展开整周；同模板同日期防重；一天内作废时段跳过。 */
export function printTemplate(data: AppData, id: string, dates: (string | null)[], at: number): void {
  if (dates.length === 0 || dates.length > 366) {
    throw new AppError("每次印刷需要 1–366 个日期");
  }
  const templateIndex = data.templates.findIndex((t) => t.id === id);
  if (templateIndex < 0) {
    throw new AppError("模板不存在");
  }
  const template = data.templates[templateIndex]!;
  let resolved: (string | null)[];
  if (template.printing.kind === "weekly") {
    const days = [...new Set(template.printing.slots.flatMap((s) => s.days))].sort((a, b) => a - b);
    const expanded = new Set<string>();
    for (const date of dates) {
      if (date === null) throw new AppError("周期印刷需要日期");
      if (!validDate(date)) throw new AppError("无效的周期日期");
      const parsed = parseDate(date)!;
      const monday = weekStart(parsed);
      for (const day of days) {
        const d = addDays(monday, day - 1);
        expanded.add(`${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`);
      }
    }
    if (expanded.size > 366) {
      throw new AppError("一次印刷范围过大，请拆分周期");
    }
    resolved = [...expanded].sort();
  } else {
    resolved = [...dates];
  }
  // 先完整解析周期/日程批次，再动状态（原子）。
  const batches: { date: string | null; times: (string | null)[] }[] = resolved.map((date) => ({
    date,
    times: templateTimes(template, date),
  }));
  const printedDates = new Set(
    data.prints.filter((p) => p.templateId === id).map((p) => p.date as string),
  );
  for (const { date, times } of batches) {
    if (printedDates.has(date as string)) continue;
    let printed = false;
    for (const time of times) {
      const task = templateInstance(template, date, time, at);
      if (printingExpired(data, task, at)) continue;
      data.tasks.push(task);
      printed = true;
    }
    // 一天的批次一旦产生实例即记账：编辑/删除不得静默补满当天历史。
    if (printed) {
      printedDates.add(date as string);
      data.prints.push({ templateId: id, date });
    }
  }
}

/** 已过静态时间窗口的定时实例跳过印刷。 */
function printingExpired(data: AppData, task: Task, at: number): boolean {
  if (task.reminderTime === null) return false;
  if (task.dueDate === null) return false;
  const today = dateAt(at);
  if (task.dueDate < today) return true;
  if (task.dueDate > today) return false;
  const start = minutesOf(task.reminderTime)!;
  const grace = isHabit(task) ? 0 : task.scrapMinutes;
  const end = start + windowMinutes(task, data.settings) + grace;
  return secondsOfDay(at) >= end * 60;
}

/** 显式形状同步：只同步未完成、未作废实例的形状；日期/管辖/完成状态不动。 */
export function syncTemplate(data: AppData, id: string): void {
  const template = data.templates.find((t) => t.id === id);
  if (template === undefined) {
    throw new AppError("模板不存在");
  }
  const voidIds = new Set(data.tasks.filter((t) => taskIsVoid(t)).map((t) => t.id));
  for (const task of data.tasks) {
    if (!voidIds.has(task.id) && !task.completed && task.templateId === id) {
      const shape = { ...template.shape };
      shape.habitId = task.habitId;
      copyShape(shape, task);
    }
  }
}

export function taskIsVoid(task: Task): boolean {
  return !task.completed && task.reminderTime !== null && task.reminderExpired;
}

/** 自动滚动预印：补齐「今天 + 预印天数」范围内的遗漏，程序关闭期间不执行。 */
export function materializeTemplates(data: AppData, at: number): boolean {
  const today = parseDate(dateAt(at))!;
  const printed = new Set(data.prints.map((p) => `${p.templateId}|${p.date ?? "null"}`));
  const requests: { id: string; dates: (string | null)[] }[] = [];
  for (const template of data.templates) {
    if (!template.automatic) continue;
    const end = addDays(today, template.printAheadDays);
    const endStr = `${end.year}-${String(end.month).padStart(2, "0")}-${String(end.day).padStart(2, "0")}`;
    let dates: string[] = [];
    const printing = template.printing;
    if (printing.kind === "once") {
      if (printing.date !== null && printing.date <= endStr) dates = [printing.date];
    } else if (printing.kind === "calendar") {
      dates = [
        ...new Set(printing.slots.flatMap((s) => s.dates).filter((d) => d <= endStr)),
      ].sort();
    } else {
      const days = [...new Set(printing.slots.flatMap((s) => s.days))].sort((a, b) => a - b);
      let monday = weekStart(today);
      const last = weekStart(end);
      while (compareIso(monday) <= compareIso(last)) {
        for (const day of days) {
          const d = addDays(monday, day - 1);
          dates.push(`${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`);
        }
        monday = addDays(monday, 7);
      }
    }
    const missing = dates.filter((d) => !printed.has(`${template.id}|${d}`));
    if (missing.length > 0) {
      requests.push({ id: template.id, dates: missing });
    }
  }
  let changed = false;
  for (const { id: templateId, dates } of requests) {
    // 印刷原子：达到容量上限时整周期全留或全弃。
    const candidate = clone(data);
    try {
      printTemplate(candidate, templateId, dates, at);
      if (candidate.tasks.length !== data.tasks.length) {
        candidate.validate();
        replaceAppData(data, candidate);
        changed = true;
      }
    } catch {
      // 保留原状态。
    }
  }
  return changed;
}

function compareIso(date: { year: number; month: number; day: number }): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

export function replaceAppData(target: AppData, source: AppData): void {
  for (const key of Object.keys(source)) {
    (target as Record<string, unknown>)[key] = (source as Record<string, unknown>)[key];
  }
}

/** 计划/输入边界：把旧式重复规则转成印刷模型，不给实例挂规则。 */
export function fromTask(task: Task, repeat: "none" | "daily" | "weekdays" | "weekly", at: number): Template {
  const date = task.dueDate ?? dateAt(at);
  const weekday = (() => {
    const parsed = parseDate(date);
    return parsed === null ? 1 : weekdayMonday(parsed);
  })();
  const days =
    repeat === "daily" ? [1, 2, 3, 4, 5, 6, 7] : repeat === "weekdays" ? [1, 2, 3, 4, 5] : [weekday];
  return {
    id: id(),
    automatic: true,
    printAheadDays: 0,
    printing: { kind: "weekly", slots: [{ days, time: task.reminderTime }] },
    shape: {
      title: task.title,
      notes: task.notes,
      projectId: task.projectId,
      habitId: task.habitId,
      focusMinutes: task.focusMinutes,
      scrapMinutes: task.scrapMinutes,
      priority: task.priority,
      estimate: task.estimate,
      tags: [...task.tags],
      subtasks: task.subtasks.map((s) => ({ id: s.id, title: s.title })),
    },
  };
}
