// 模板对话框：模板的形状（印什么）与印刷规则（何时印）的唯一编辑入口。
//
// 为什么形状与印刷规则放在同一个对话框：core 的 Template 就是
// Shape + Printing + 自动印刷调度参数，三者共同决定「印出来的实例长什么样、
// 什么时候出现」；拆成两个对话框会让「改了标题但规则还指向旧日期」这类不一致
// 很难发现。
//
// 语义（对齐 @tomato/core 的 templates.ts / saveTemplate / printTemplate）：
// - 形状在印刷那一刻复制到实例；之后改模板不会改已印出的实例，需要显式「同步」。
// - 印刷规则分单次 / 日程（指定日期集合）/ 每周（指定星期）；周期规则在印刷时
//   按选中日期所在整周展开（见 printTemplate）。
// - 每周且所有时段都有开始时刻的模板会被 core 自动记为习惯组（saveTemplate），
//   所以「每周 + 定时」在界面上要说明这层语义。
// - 保存时可携带 printDates 立即印刷；这些日期由当前规则推导，不在客户端伪造。
import { h, useEffect, useState } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import { tryDispatch } from "../shared/store.js";
import { dayLabel, weekStart } from "../shared/derive.js";
import { Icon } from "../shared/icons.js";
import {
  Btn,
  Chip,
  Divider,
  Field,
  IconBtn,
  Input,
  Modal,
  Select,
  TextArea,
  Toggle,
  notify,
} from "../shared/ui.js";

registerCopy("template", {
  zh: {
    newTitle: "新建模板",
    editTitle: "编辑模板",
    newSubtitle: "模板保存形状与印刷规则；实例记录每一次执行，两者互不覆盖。",
    editSubtitle: "改模板不会改已印出的实例；需要时用「同步」更新未完成实例。",
    title: "标题",
    titleHint: "模板名就是标题；自动记为习惯组时也用它。",
    titlePlaceholder: "想反复印刷的一件事",
    project: "所属项目",
    noProject: "不分类",
    focusMinutes: "单次专注时长",
    focusMinutesHint: "留空沿用设置里的 {n} 分钟",
    estimate: "预计番茄数",
    scrap: "重修窗口",
    scrapHint: "计划块结束后仍可补做的分钟数；0 表示到点作废",
    priority: "优先级",
    tags: "标签",
    tagsPlaceholder: "用逗号分隔，例如：数学, 错题",
    notes: "备注",
    notesPlaceholder: "补充资料、位置或提醒自己的话…",
    subtasks: "子任务",
    subtaskPlaceholder: "添加一个子任务",
    addSubtask: "添加子任务",
    removeSubtask: "删除子任务",
    untouched: "未命名步骤",
    printingTitle: "印刷规则",
    printingHint: "规则决定实例什么时候出现；实例印出后与模板解耦。",
    kindOnce: "单次",
    kindCalendar: "日程",
    kindWeekly: "每周",
    onceDate: "印刷日期",
    onceTime: "开始时刻",
    timeOptional: "留空表示不定时，只进当日待办",
    calendarHint:
      "同一开始时刻的日期合并到一个时段；不同时段不能共用开始时刻。",
    addSlot: "添加时段",
    removeSlot: "删除时段",
    slotTime: "开始时刻",
    slotDates: "日期",
    addDate: "添加日期",
    removeDate: "移除日期",
    weeklyHint: "选中的星期在印刷时按整周展开；同一天同一时刻不能重复。",
    weeklyDays: "印刷日",
    weeklyAutoHabit:
      "每周且所有时段都有开始时刻时，core 会自动把它记为习惯组。",
    habitNote: "这个模板已关联习惯组，开始时刻必填。",
    automatic: "自动印刷",
    automaticHint: "按「今天 + 提前天数」补齐遗漏；程序关闭期间不会补印。",
    printAhead: "提前天数",
    printAheadHint: "0–90 天",
    printNow: "保存后立即印刷",
    printNowOnce: "保存后立即印刷这一次",
    printNowCalendar: "保存后立即印刷规则内的日期",
    printNowWeekly: "保存后立即印刷本周",
    titleRequired: "模板标题不能为空",
    titleTooLong: "模板标题最多 200 字",
    focusInvalid: "单次专注时长需为 1–180 分钟",
    estimateInvalid: "预计番茄数需为 1–99",
    scrapInvalid: "重修窗口需为 0–10080 分钟",
    tooManyTags: "标签最多 20 个，每个不超过 40 字",
    subtaskEmpty: "子任务名称不能为空",
    dateRequired: "请选择印刷日期",
    dateInvalid: "日期无效，请用 YYYY-MM-DD",
    timeInvalid: "开始时刻需为 HH:MM",
    needSlot: "至少需要一个时段",
    needDays: "每个时段至少选一个星期",
    needDates: "每个日程时段至少需要一个日期",
    duplicateDates: "同一日期在同一时刻重复出现，请合并",
    duplicateTime: "不同时段不能共用同一开始时刻",
    duplicateWeekly: "同一星期同一时刻重复出现，请合并",
    needTime: "习惯模板必须填写开始时刻",
    mixedTime: "同一规则不能混用定时与不定时时段",
    aheadInvalid: "提前天数需为 0–90",
    saved: "模板已保存",
    created: "模板已创建",
    savedAndPrinted: "模板已保存，已提交印刷",
    deleted: "模板已删除，实例保留",
    deleteTitle: "删除这个模板？",
    deleteBody:
      "已印出的实例会保留并解除与模板的关联；印刷记账会一起清掉，这一步不能撤销。",
    deleteConfirm: "确认删除",
  },
  en: {
    newTitle: "New template",
    editTitle: "Edit template",
    newSubtitle:
      "A template stores the shape and the printing rule; instances record each run.",
    editSubtitle:
      "Editing the template won't rewrite printed instances; use Sync to update unfinished ones.",
    title: "Title",
    titleHint: "The title is the template name; a habit group reuses it too.",
    titlePlaceholder: "Something worth printing again",
    project: "Project",
    noProject: "No project",
    focusMinutes: "Focus per session",
    focusMinutesHint: "Empty uses the {n} min default",
    estimate: "Pomodoros planned",
    scrap: "Repair window",
    scrapHint: "Minutes still usable after the plan block; 0 voids it on time",
    priority: "Priority",
    tags: "Tags",
    tagsPlaceholder: "Comma separated, e.g. math, mistakes",
    notes: "Notes",
    notesPlaceholder: "References, location, or a note to yourself…",
    subtasks: "Subtasks",
    subtaskPlaceholder: "Add a subtask",
    addSubtask: "Add subtask",
    removeSubtask: "Remove subtask",
    untouched: "Untitled step",
    printingTitle: "Printing rule",
    printingHint:
      "The rule decides when instances appear; printed instances are decoupled from the template.",
    kindOnce: "Once",
    kindCalendar: "Calendar",
    kindWeekly: "Weekly",
    onceDate: "Print date",
    onceTime: "Start time",
    timeOptional: "Empty means no fixed time; it just joins that day",
    calendarHint:
      "Dates sharing one start time go in one slot; slots can't share a start time.",
    addSlot: "Add slot",
    removeSlot: "Remove slot",
    slotTime: "Start time",
    slotDates: "Dates",
    addDate: "Add date",
    removeDate: "Remove date",
    weeklyHint:
      "Selected weekdays expand to whole weeks when printed; one weekday/time can't repeat.",
    weeklyDays: "Weekdays",
    weeklyAutoHabit:
      "A weekly template whose slots all have start times is recorded as a habit group by core.",
    habitNote:
      "This template is tied to a habit group, so start times are required.",
    automatic: "Auto print",
    automaticHint:
      "Fills gaps within today + days ahead; nothing is printed while the app is closed.",
    printAhead: "Days ahead",
    printAheadHint: "0–90 days",
    printNow: "Print right after saving",
    printNowOnce: "Print this one right after saving",
    printNowCalendar: "Print the rule's dates right after saving",
    printNowWeekly: "Print this week right after saving",
    titleRequired: "Template title is required",
    titleTooLong: "Template title must be at most 200 characters",
    focusInvalid: "Focus per session must be 1–180 minutes",
    estimateInvalid: "Planned pomodoros must be 1–99",
    scrapInvalid: "Repair window must be 0–10080 minutes",
    tooManyTags: "At most 20 tags, each under 40 characters",
    subtaskEmpty: "Subtask title is required",
    dateRequired: "Pick a print date",
    dateInvalid: "Invalid date; use YYYY-MM-DD",
    timeInvalid: "Start time must be HH:MM",
    needSlot: "At least one slot is required",
    needDays: "Each slot needs at least one weekday",
    needDates: "Each calendar slot needs at least one date",
    duplicateDates: "A date repeats at the same start time; please merge it",
    duplicateTime: "Slots can't share a start time",
    duplicateWeekly:
      "A weekday repeats at the same start time; please merge it",
    needTime: "Habit templates require start times",
    mixedTime: "One rule can't mix timed and untimed slots",
    aheadInvalid: "Days ahead must be 0–90",
    saved: "Template saved",
    created: "Template created",
    savedAndPrinted: "Template saved; printing submitted",
    deleted: "Template deleted; instances kept",
    deleteTitle: "Delete this template?",
    deleteBody:
      "Printed instances stay and lose their template link; the printing ledger is cleared. This cannot be undone.",
    deleteConfirm: "Delete",
  },
});

const PRIORITY_KEYS = [
  "priorityNone",
  "priorityLow",
  "priorityMedium",
  "priorityHigh",
];

registerCopy("template", {
  zh: {
    priorityNone: "无",
    priorityLow: "低",
    priorityMedium: "中",
    priorityHigh: "高",
  },
  en: {
    priorityNone: "None",
    priorityLow: "Low",
    priorityMedium: "Medium",
    priorityHigh: "High",
  },
});

const KINDS = ["once", "calendar", "weekly"];

/** 新建子任务/模板 id：crypto 不可用时退回时间戳 + 随机串。 */
function newId() {
  try {
    if (
      globalThis.crypto &&
      typeof globalThis.crypto.randomUUID === "function"
    ) {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    /* 非安全上下文退回下面 */
  }
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 输入框原始字符串 → 整数；空串返回 null。 */
function intOf(raw, fallback = null) {
  if (raw === null || raw === undefined) return fallback;
  const text = String(raw).trim();
  if (text === "") return fallback;
  const n = Number(text);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function validDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(text ?? ""))) return false;
  const [y, m, d] = String(text).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return (
    dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
  );
}

function validTime(text) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(text ?? ""));
}

/** 新模板草稿：默认「每周工作日、不定时」，这是最常见也最不打扰人的规则。 */
export function blankTemplateDraft(today) {
  return {
    id: null,
    habitId: null,
    title: "",
    notes: "",
    projectId: "",
    focusMinutes: "",
    scrapMinutes: "0",
    priority: 0,
    estimate: "1",
    tagsText: "",
    subtasks: [],
    printingKind: "weekly",
    onceDate: today ?? "",
    onceTime: "",
    weeklySlots: [{ days: [1, 2, 3, 4, 5], time: "" }],
    calendarSlots: [{ dates: [], time: "" }],
    automatic: false,
    printAheadDays: "7",
    printNow: false,
  };
}

/** 已有 Template → 受控草稿（数字/日期一律用字符串，便于受控输入）。 */
export function templateToDraft(template, today) {
  if (!template || typeof template !== "object")
    return blankTemplateDraft(today);
  const shape = template.shape || {};
  const printing = template.printing || { kind: "weekly", slots: [] };
  const draft = blankTemplateDraft(today);
  draft.id = template.id ?? null;
  draft.habitId = shape.habitId ?? null;
  draft.title = shape.title ?? "";
  draft.notes = shape.notes ?? "";
  draft.projectId = shape.projectId ?? "";
  draft.focusMinutes =
    shape.focusMinutes === null || shape.focusMinutes === undefined
      ? ""
      : String(shape.focusMinutes);
  draft.scrapMinutes = String(shape.scrapMinutes ?? 0);
  draft.priority = Number(shape.priority) || 0;
  draft.estimate = String(Math.max(1, Number(shape.estimate) || 1));
  draft.tagsText = Array.isArray(shape.tags) ? shape.tags.join(", ") : "";
  draft.subtasks = Array.isArray(shape.subtasks)
    ? shape.subtasks.map((sub) => ({
        id: sub.id || newId(),
        title: sub.title ?? "",
      }))
    : [];
  draft.automatic = !!template.automatic;
  const ahead = Number(template.printAheadDays);
  draft.printAheadDays = String(
    Number.isFinite(ahead) && ahead >= 0 ? ahead : 7,
  );
  if (KINDS.includes(printing.kind)) draft.printingKind = printing.kind;
  if (printing.kind === "once") {
    draft.onceDate = printing.date || today || "";
    draft.onceTime = printing.time ?? "";
  } else if (
    printing.kind === "calendar" &&
    Array.isArray(printing.slots) &&
    printing.slots.length > 0
  ) {
    draft.calendarSlots = printing.slots.map((slot) => ({
      dates: Array.isArray(slot.dates)
        ? slot.dates.filter((d) => validDate(d)).sort()
        : [],
      time: slot.time ?? "",
    }));
  } else if (
    printing.kind === "weekly" &&
    Array.isArray(printing.slots) &&
    printing.slots.length > 0
  ) {
    draft.weeklySlots = printing.slots.map((slot) => ({
      days: Array.isArray(slot.days)
        ? slot.days.filter((d) => d >= 1 && d <= 7)
        : [],
      time: slot.time ?? "",
    }));
  }
  return draft;
}

/**
 * TemplateDialog：open 为 true 时渲染。
 * props:
 * - open, onClose
 * - template：编辑目标（null = 新建）
 * - today：今天 YYYY-MM-DD
 * - data：{ projects, habits }（只读，用来填项目下拉）
 * - settings：data.settings（默认专注时长提示）
 */
export function TemplateDialog({
  open,
  onClose,
  template = null,
  today = "",
  data = {},
  settings = {},
}) {
  const templateId = template && template.id ? template.id : null;
  const [draft, setDraft] = useState(() => templateToDraft(template, today));
  const [dateInput, setDateInput] = useState("");
  const [subInput, setSubInput] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 打开时按目标重置；用 id 而不是对象身份作依赖，避免轮询换新对象时清空输入。
  useEffect(() => {
    if (!open) return;
    setDraft(templateToDraft(template, today));
    setDateInput("");
    setError(null);
    setBusy(false);
    setConfirmDelete(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templateId, today]);

  if (!open) return null;

  const editing = templateId !== null;
  const patch = (next) => setDraft((current) => ({ ...current, ...next }));
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const defaultFocus = Number(settings.focusMinutes) || 45;
  const weekFull = t("common.weekFull");
  const weekLabels = Array.isArray(weekFull) ? weekFull : [];
  const priorityOptions = PRIORITY_KEYS.map((key, value) => ({
    value: String(value),
    label: t(`template.${key}`),
  }));

  const setKind = (kind) => {
    if (!KINDS.includes(kind)) return;
    // 单次/日程规则与习惯组互斥（core 校验拒绝），切换时显式解除关联。
    patch({
      printingKind: kind,
      habitId: kind === "weekly" ? draft.habitId : null,
    });
  };

  const patchWeeklySlot = (index, next) =>
    patch({
      weeklySlots: draft.weeklySlots.map((slot, i) =>
        i === index ? { ...slot, ...next } : slot,
      ),
    });

  const toggleWeekday = (index, day) => {
    const slot = draft.weeklySlots[index];
    if (!slot) return;
    const days = slot.days.includes(day)
      ? slot.days.filter((d) => d !== day)
      : [...slot.days, day].sort((a, b) => a - b);
    patchWeeklySlot(index, { days });
  };

  const patchCalendarSlot = (index, next) =>
    patch({
      calendarSlots: draft.calendarSlots.map((slot, i) =>
        i === index ? { ...slot, ...next } : slot,
      ),
    });

  const addCalendarDate = (index) => {
    const date = String(dateInput ?? "").trim();
    if (!validDate(date)) {
      setError(t("template.dateInvalid"));
      return;
    }
    const slot = draft.calendarSlots[index];
    if (!slot) return;
    if (slot.dates.includes(date)) return;
    patchCalendarSlot(index, { dates: [...slot.dates, date].sort() });
    setDateInput("");
  };

  const addSubtask = () => {
    const title = String(subInput ?? "").trim();
    if (title === "") return;
    patch({ subtasks: [...draft.subtasks, { id: newId(), title }] });
    setSubInput("");
  };

  // 子任务输入框与日期输入框都需要「回车提交」，这里用同一个小工具保持状态更新顺序。
  const onEnter = (fn) => (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      fn();
    }
  };

  /** 草稿 → core 的 Printing；不合法时返回 {error}，合法返回 {printing}。 */
  const buildPrinting = () => {
    if (draft.printingKind === "once") {
      const date = String(draft.onceDate ?? "").trim();
      if (date === "") return { error: t("template.dateRequired") };
      if (!validDate(date)) return { error: t("template.dateInvalid") };
      const time = String(draft.onceTime ?? "").trim();
      if (time !== "" && !validTime(time))
        return { error: t("template.timeInvalid") };
      return {
        printing: { kind: "once", date, time: time === "" ? null : time },
      };
    }
    if (draft.printingKind === "calendar") {
      const slots = draft.calendarSlots
        .map((slot) => ({
          dates: Array.from(new Set(slot.dates)).sort(),
          time: String(slot.time ?? "").trim(),
        }))
        .filter((slot) => slot.dates.length > 0);
      if (slots.length === 0) return { error: t("template.needDates") };
      const times = new Set();
      const seen = new Set();
      for (const slot of slots) {
        if (slot.time !== "" && !validTime(slot.time))
          return { error: t("template.timeInvalid") };
        const timeKey = slot.time === "" ? "null" : slot.time;
        if (times.has(timeKey)) return { error: t("template.duplicateTime") };
        times.add(timeKey);
        for (const date of slot.dates) {
          if (!validDate(date)) return { error: t("template.dateInvalid") };
          const key = `${date}|${timeKey}`;
          if (seen.has(key)) return { error: t("template.duplicateDates") };
          seen.add(key);
        }
      }
      return {
        printing: {
          kind: "calendar",
          slots: slots.map((slot) => ({
            dates: slot.dates,
            time: slot.time === "" ? null : slot.time,
          })),
        },
      };
    }
    const slots = draft.weeklySlots
      .map((slot) => ({
        days: Array.from(new Set(slot.days)).sort((a, b) => a - b),
        time: String(slot.time ?? "").trim(),
      }))
      .filter((slot) => slot.days.length > 0);
    if (slots.length === 0) return { error: t("template.needDays") };
    const seen = new Set();
    const timed = slots.filter((slot) => slot.time !== "").length;
    if (timed > 0 && timed < slots.length)
      return { error: t("template.mixedTime") };
    for (const slot of slots) {
      if (slot.time !== "" && !validTime(slot.time))
        return { error: t("template.timeInvalid") };
      if (draft.habitId !== null && slot.time === "")
        return { error: t("template.needTime") };
      for (const day of slot.days) {
        const key = `${day}|${slot.time === "" ? "null" : slot.time}`;
        if (seen.has(key)) return { error: t("template.duplicateWeekly") };
        seen.add(key);
      }
    }
    return {
      printing: {
        kind: "weekly",
        slots: slots.map((slot) => ({
          days: slot.days,
          time: slot.time === "" ? null : slot.time,
        })),
      },
    };
  };

  /** 保存后立即印刷的日期：由当前规则推导，weekly 交给 core 展开整周。 */
  const printDatesOf = (printing) => {
    if (!draft.printNow) return [];
    if (printing.kind === "once") return [printing.date];
    if (printing.kind === "calendar") {
      return Array.from(
        new Set(printing.slots.flatMap((slot) => slot.dates)),
      ).sort();
    }
    const anchor = validDate(today)
      ? today
      : new Date().toISOString().slice(0, 10);
    return [weekStart(anchor)];
  };

  const submit = async () => {
    if (busy) return;
    const title = String(draft.title ?? "").trim();
    if (title === "") {
      setError(t("template.titleRequired"));
      return;
    }
    if (Array.from(title).length > 200) {
      setError(t("template.titleTooLong"));
      return;
    }
    const estimate = intOf(draft.estimate, 1);
    if (estimate === null || estimate < 1 || estimate > 99) {
      setError(t("template.estimateInvalid"));
      return;
    }
    const focusMinutes =
      String(draft.focusMinutes ?? "").trim() === ""
        ? null
        : intOf(draft.focusMinutes, null);
    if (focusMinutes !== null && (focusMinutes < 1 || focusMinutes > 180)) {
      setError(t("template.focusInvalid"));
      return;
    }
    const scrapMinutes = intOf(draft.scrapMinutes, 0);
    if (scrapMinutes === null || scrapMinutes < 0 || scrapMinutes > 10080) {
      setError(t("template.scrapInvalid"));
      return;
    }
    const ahead = intOf(draft.printAheadDays, 7);
    if (ahead === null || ahead < 0 || ahead > 90) {
      setError(t("template.aheadInvalid"));
      return;
    }
    const tags = String(draft.tagsText ?? "")
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter((tag) => tag !== "");
    if (tags.length > 20 || tags.some((tag) => Array.from(tag).length > 40)) {
      setError(t("template.tooManyTags"));
      return;
    }
    if (draft.subtasks.some((sub) => String(sub.title ?? "").trim() === "")) {
      setError(t("template.subtaskEmpty"));
      return;
    }
    const built = buildPrinting();
    if (built.error) {
      setError(built.error);
      return;
    }
    const printing = built.printing;
    const template = {
      id: draft.id ?? newId(),
      shape: {
        title,
        notes: String(draft.notes ?? ""),
        projectId: draft.projectId ? draft.projectId : null,
        habitId: draft.habitId ?? null,
        focusMinutes,
        scrapMinutes,
        priority: Number(draft.priority) || 0,
        estimate,
        tags,
        subtasks: draft.subtasks.map((sub) => ({
          id: sub.id || newId(),
          title: String(sub.title ?? "").trim(),
        })),
      },
      printing,
      automatic: !!draft.automatic,
      printAheadDays: ahead,
    };
    setBusy(true);
    setError(null);
    const result = await tryDispatch({
      type: "saveTemplate",
      template,
      printDates: printDatesOf(printing),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error || t("common.writeFailed"));
      return;
    }
    notify(
      draft.printNow
        ? t("template.savedAndPrinted")
        : editing
          ? t("template.saved")
          : t("template.created"),
      "brand",
    );
    onClose?.();
  };

  const remove = async () => {
    if (busy || draft.id === null) return;
    setBusy(true);
    setError(null);
    const result = await tryDispatch({ type: "deleteTemplate", id: draft.id });
    setBusy(false);
    if (!result.ok) {
      setError(result.error || t("common.writeFailed"));
      return;
    }
    notify(t("template.deleted"), "neutral");
    onClose?.();
  };

  const kindItems = [
    { value: "once", label: t("template.kindOnce"), icon: "calendar" },
    {
      value: "calendar",
      label: t("template.kindCalendar"),
      icon: "calendarClock",
    },
    { value: "weekly", label: t("template.kindWeekly"), icon: "refresh" },
  ];

  const onceEditor = h(
    "div",
    { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } },
    h(
      Field,
      { label: t("template.onceDate") },
      h(Input, {
        type: "date",
        value: draft.onceDate,
        onChange: (value) => patch({ onceDate: value }),
      }),
    ),
    h(
      Field,
      { label: t("template.onceTime"), hint: t("template.timeOptional") },
      h(Input, {
        type: "time",
        value: draft.onceTime,
        onChange: (value) => patch({ onceTime: value }),
      }),
    ),
  );

  const calendarEditor = h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 10 } },
    h(
      "div",
      {
        style: {
          fontSize: 11.5,
          color: "var(--tomato-ink-3)",
          lineHeight: 1.6,
        },
      },
      t("template.calendarHint"),
    ),
    draft.calendarSlots.map((slot, index) =>
      h(
        "div",
        {
          key: `cal-${index}`,
          style: {
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 12,
            background: "var(--tomato-surface-2)",
          },
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "flex-end",
              gap: 10,
              flexWrap: "wrap",
            },
          },
          h(
            Field,
            { label: t("template.slotTime"), style: { flex: "0 1 150px" } },
            h(Input, {
              type: "time",
              value: slot.time,
              onChange: (value) => patchCalendarSlot(index, { time: value }),
            }),
          ),
          h("div", { style: { flex: 1 } }),
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 8,
                flex: "1 1 220px",
              },
            },
            h(Input, {
              type: "date",
              value: dateInput,
              onChange: setDateInput,
              onKeyDown: onEnter(() => addCalendarDate(index)),
              style: { flex: 1 },
            }),
            h(
              Btn,
              {
                variant: "soft",
                size: "sm",
                icon: "plus",
                onClick: () => addCalendarDate(index),
              },
              t("template.addDate"),
            ),
          ),
          draft.calendarSlots.length > 1
            ? h(IconBtn, {
                name: "trash",
                size: 15,
                box: 30,
                title: t("template.removeSlot"),
                onClick: () =>
                  patch({
                    calendarSlots: draft.calendarSlots.filter(
                      (_, i) => i !== index,
                    ),
                  }),
              })
            : null,
        ),
        slot.dates.length > 0
          ? h(
              "div",
              { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
              slot.dates.map((date) =>
                h(
                  Chip,
                  {
                    key: date,
                    tone: "brand",
                    active: true,
                    onClick: () =>
                      patchCalendarSlot(index, {
                        dates: slot.dates.filter((d) => d !== date),
                      }),
                  },
                  `${dayLabel(date, today)} ×`,
                ),
              ),
            )
          : h(
              "div",
              { style: { fontSize: 11.5, color: "var(--tomato-ink-3)" } },
              t("template.slotDates"),
            ),
      ),
    ),
    h(
      Btn,
      {
        variant: "plain",
        size: "sm",
        icon: "plus",
        onClick: () =>
          patch({
            calendarSlots: [...draft.calendarSlots, { dates: [], time: "" }],
          }),
      },
      t("template.addSlot"),
    ),
  );

  const weeklyEditor = h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 10 } },
    h(
      "div",
      {
        style: {
          fontSize: 11.5,
          color: "var(--tomato-ink-3)",
          lineHeight: 1.6,
        },
      },
      t("template.weeklyHint"),
    ),
    draft.habitId !== null
      ? h(
          "div",
          {
            style: {
              fontSize: 11.5,
              color: "var(--tomato-brand-deep)",
              lineHeight: 1.6,
            },
          },
          t("template.habitNote"),
        )
      : null,
    draft.weeklySlots.map((slot, index) =>
      h(
        "div",
        {
          key: `week-${index}`,
          style: {
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 12,
            background: "var(--tomato-surface-2)",
          },
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            },
          },
          weekLabels.map((label, dayIndex) => {
            const day = dayIndex + 1;
            const selected = slot.days.includes(day);
            return h(
              Chip,
              {
                key: day,
                tone: selected ? "brand" : "neutral",
                active: selected,
                onClick: () => toggleWeekday(index, day),
                style: { height: 28, padding: "0 10px", fontSize: 12 },
              },
              label,
            );
          }),
          h("div", { style: { flex: 1 } }),
          draft.weeklySlots.length > 1
            ? h(IconBtn, {
                name: "trash",
                size: 15,
                box: 30,
                title: t("template.removeSlot"),
                onClick: () =>
                  patch({
                    weeklySlots: draft.weeklySlots.filter(
                      (_, i) => i !== index,
                    ),
                  }),
              })
            : null,
        ),
        h(
          Field,
          { label: t("template.slotTime"), hint: t("template.timeOptional") },
          h(Input, {
            type: "time",
            value: slot.time,
            onChange: (value) => patchWeeklySlot(index, { time: value }),
            style: { maxWidth: 180 },
          }),
        ),
      ),
    ),
    h(
      Btn,
      {
        variant: "plain",
        size: "sm",
        icon: "plus",
        onClick: () =>
          patch({
            weeklySlots: [...draft.weeklySlots, { days: [], time: "" }],
          }),
      },
      t("template.addSlot"),
    ),
    h(
      "div",
      {
        style: {
          fontSize: 11.5,
          color: "var(--tomato-ink-3)",
          lineHeight: 1.6,
        },
      },
      t("template.weeklyAutoHabit"),
    ),
  );

  const printNowLabel =
    draft.printingKind === "once"
      ? t("template.printNowOnce")
      : draft.printingKind === "calendar"
        ? t("template.printNowCalendar")
        : t("template.printNowWeekly");

  const body = confirmDelete
    ? h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 14 } },
        h(
          "div",
          {
            style: {
              padding: "14px 16px",
              borderRadius: 13,
              background: "var(--tomato-surface-2)",
              color: "var(--tomato-ink-2)",
              fontSize: 13,
              lineHeight: 1.65,
            },
          },
          t("template.deleteBody"),
        ),
        h(
          "div",
          {
            style: {
              fontSize: 13.5,
              color: "var(--tomato-ink)",
              fontWeight: 550,
            },
          },
          draft.title || t("template.untouched"),
        ),
      )
    : h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 16 } },
        h(
          Field,
          { label: t("template.title"), hint: t("template.titleHint") },
          h(Input, {
            value: draft.title,
            onChange: (value) => patch({ title: value }),
            placeholder: t("template.titlePlaceholder"),
            maxLength: 200,
            autoFocus: true,
          }),
        ),
        h(
          "div",
          {
            style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
          },
          h(
            Field,
            { label: t("template.project") },
            h(Select, {
              value: draft.projectId,
              options: [
                { value: "", label: t("template.noProject") },
                ...projects.map((project) => ({
                  value: project.id,
                  label: project.name,
                })),
              ],
              onChange: (value) => patch({ projectId: value }),
              width: "100%",
            }),
          ),
          h(
            Field,
            { label: t("template.priority") },
            h(Select, {
              value: String(draft.priority),
              options: priorityOptions,
              onChange: (value) => patch({ priority: Number(value) }),
              width: "100%",
            }),
          ),
          h(
            Field,
            {
              label: t("template.focusMinutes"),
              hint: t("template.focusMinutesHint", { n: defaultFocus }),
            },
            h(Input, {
              type: "number",
              value: draft.focusMinutes,
              onChange: (value) => patch({ focusMinutes: value }),
              placeholder: String(defaultFocus),
            }),
          ),
          h(
            Field,
            { label: t("template.estimate") },
            h(Input, {
              type: "number",
              value: draft.estimate,
              onChange: (value) => patch({ estimate: value }),
            }),
          ),
          h(
            Field,
            { label: t("template.scrap"), hint: t("template.scrapHint") },
            h(Input, {
              type: "number",
              value: draft.scrapMinutes,
              onChange: (value) => patch({ scrapMinutes: value }),
            }),
          ),
          h(
            Field,
            { label: t("template.tags") },
            h(Input, {
              value: draft.tagsText,
              onChange: (value) => patch({ tagsText: value }),
              placeholder: t("template.tagsPlaceholder"),
            }),
          ),
        ),
        h(
          Field,
          { label: t("template.notes") },
          h(TextArea, {
            value: draft.notes,
            onChange: (value) => patch({ notes: value }),
            placeholder: t("template.notesPlaceholder"),
            rows: 2,
            style: { maxHeight: 120 },
          }),
        ),
        h(Divider, null),
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: 8 } },
          h(
            "div",
            {
              style: {
                fontSize: 12,
                fontWeight: 550,
                color: "var(--tomato-ink-2)",
              },
            },
            t("template.subtasks"),
          ),
          draft.subtasks.length > 0
            ? h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 4 } },
                draft.subtasks.map((sub, index) =>
                  h(
                    "div",
                    {
                      key: sub.id ?? index,
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        minHeight: 32,
                        padding: "2px 4px",
                        borderRadius: 9,
                      },
                    },
                    h(Icon, {
                      name: "grip",
                      size: 14,
                      style: { color: "var(--tomato-ink-3)" },
                    }),
                    h(
                      "div",
                      {
                        style: {
                          flex: 1,
                          minWidth: 0,
                          fontSize: 13,
                          color: "var(--tomato-ink)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        },
                      },
                      sub.title,
                    ),
                    h(IconBtn, {
                      name: "x",
                      size: 14,
                      box: 28,
                      title: t("template.removeSubtask"),
                      onClick: () =>
                        patch({
                          subtasks: draft.subtasks.filter(
                            (_, i) => i !== index,
                          ),
                        }),
                    }),
                  ),
                ),
              )
            : h(
                "div",
                { style: { fontSize: 12, color: "var(--tomato-ink-3)" } },
                t("template.subtaskPlaceholder"),
              ),
          h(
            "div",
            { style: { display: "flex", gap: 8, alignItems: "center" } },
            h(Input, {
              value: subInput,
              onChange: setSubInput,
              onKeyDown: onEnter(addSubtask),
              placeholder: t("template.subtaskPlaceholder"),
              maxLength: 200,
            }),
            h(Btn, {
              variant: "soft",
              size: "sm",
              icon: "plus",
              title: t("template.addSubtask"),
              onClick: addSubtask,
            }),
          ),
        ),
        h(Divider, null),
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: 10 } },
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              },
            },
            h(Icon, {
              name: "calendarClock",
              size: 16,
              style: { color: "var(--tomato-brand-deep)" },
            }),
            h(
              "div",
              {
                style: {
                  fontSize: 13,
                  fontWeight: 620,
                  color: "var(--tomato-ink)",
                },
              },
              t("template.printingTitle"),
            ),
          ),
          h(
            "div",
            {
              style: {
                fontSize: 11.5,
                color: "var(--tomato-ink-3)",
                lineHeight: 1.6,
              },
            },
            t("template.printingHint"),
          ),
          h(
            "div",
            { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
            kindItems.map((item) =>
              h(
                Chip,
                {
                  key: item.value,
                  tone: draft.printingKind === item.value ? "brand" : "neutral",
                  active: draft.printingKind === item.value,
                  icon: item.icon,
                  onClick: () => setKind(item.value),
                  style: { height: 28, padding: "0 12px", fontSize: 12.5 },
                },
                item.label,
              ),
            ),
          ),
          draft.printingKind === "once"
            ? onceEditor
            : draft.printingKind === "calendar"
              ? calendarEditor
              : weeklyEditor,
          h(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: 10,
                padding: "12px 14px",
                borderRadius: 12,
                background: "var(--tomato-surface-2)",
              },
            },
            h(Toggle, {
              checked: draft.automatic,
              label: t("template.automatic"),
              hint: t("template.automaticHint"),
              onChange: (checked) => patch({ automatic: checked }),
            }),
            h(
              Field,
              {
                label: t("template.printAhead"),
                hint: t("template.printAheadHint"),
                inline: true,
              },
              h(Input, {
                type: "number",
                value: draft.printAheadDays,
                onChange: (value) => patch({ printAheadDays: value }),
                style: { width: 90 },
              }),
            ),
            h(Toggle, {
              checked: draft.printNow,
              label: printNowLabel,
              onChange: (checked) => patch({ printNow: checked }),
            }),
          ),
        ),
        error
          ? h(
              "div",
              {
                style: {
                  padding: "9px 12px",
                  borderRadius: 10,
                  background: "var(--tomato-brand-soft)",
                  color: "var(--tomato-brand-deep)",
                  fontSize: 12.5,
                },
                role: "alert",
              },
              error,
            )
          : null,
      );

  const footer = confirmDelete
    ? h(
        "div",
        { style: { display: "flex", gap: 9, marginLeft: "auto" } },
        h(
          Btn,
          {
            variant: "ghost",
            size: "sm",
            onClick: () => setConfirmDelete(false),
            disabled: busy,
          },
          t("common.cancel"),
        ),
        h(
          Btn,
          {
            variant: "danger",
            size: "sm",
            icon: "trash",
            onClick: remove,
            disabled: busy,
          },
          t("template.deleteConfirm"),
        ),
      )
    : h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 9,
            width: "100%",
          },
        },
        editing
          ? h(
              Btn,
              {
                variant: "danger",
                size: "sm",
                icon: "trash",
                onClick: () => setConfirmDelete(true),
                disabled: busy,
              },
              t("common.delete"),
            )
          : null,
        h("div", { style: { flex: 1 } }),
        h(
          Btn,
          { variant: "plain", size: "sm", onClick: onClose, disabled: busy },
          t("common.cancel"),
        ),
        h(
          Btn,
          {
            variant: "primary",
            size: "sm",
            icon: "check",
            onClick: submit,
            disabled: busy,
          },
          editing ? t("common.save") : t("common.add"),
        ),
      );

  return h(
    Modal,
    {
      open,
      onClose: () => {
        if (!busy) onClose?.();
      },
      icon: confirmDelete ? "trash" : editing ? "edit" : "sparkle",
      title: confirmDelete
        ? t("template.deleteTitle")
        : editing
          ? t("template.editTitle")
          : t("template.newTitle"),
      subtitle: confirmDelete
        ? undefined
        : editing
          ? t("template.editSubtitle")
          : t("template.newSubtitle"),
      width: 660,
      footer,
    },
    body,
  );
}
