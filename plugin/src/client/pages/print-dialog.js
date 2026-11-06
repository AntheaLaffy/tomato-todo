// 印刷对话框：模板 → 任务实例的唯一手动入口（任务页 / 今日专注 / ⌘K 共用）。
//
// 为什么预览要自己算一遍：core 的 printTemplate 是最终权威——周期模板按锚定
// 日期展开整周、同模板同日期防重、过期时段跳过，而且整批原子失败。对话框在
// 提交前用同一套规则本地展开，让用户先看清「会生成什么、哪些日期被跳过」，
// 同时把不在日程表里的日期从提交里剔除，避免一处不合法拖垮整批。
//
// props:
// - open, onClose
// - templates: data.templates（可能为空或含脏数据，缺失字段一律按「无规则」兜底）
// - prints: data.prints（已印刷的 templateId|date 会被 core 跳过）
// - today: 今天 YYYY-MM-DD
// - initialTemplateId: 打开时优先选中的模板
//
// 本文件不 import tasks.js：印刷摘要与 template 展示在这里自给自足，避免
// 页面模块互相引用形成循环依赖。
import { h, useEffect, useState } from "../runtime.js";
import { registerCopy, t } from "../shared/copy.js";
import {
  addDays,
  dayLabel,
  todayKey,
  weekStart,
  weekdayIndex,
} from "../shared/derive.js";
import {
  Btn,
  Chip,
  Divider,
  Empty,
  Field,
  Input,
  Modal,
  SectionTitle,
  Select,
  Toggle,
  notify,
} from "../shared/ui.js";
import { tryDispatch } from "../shared/store.js";

registerCopy("print", {
  zh: {
    title: "印刷任务",
    subtitle: "按模板和日期生成任务实例；已印刷过的日期会自动跳过。",
    template: "模板",
    untitled: "未命名模板",
    emptyTitle: "还没有模板",
    emptyHint: "先在任务页把一组安排保存成模板，再回来印刷。",
    noPrinting: "这个模板没有可用的印刷规则",
    noPrintingHint: "请先在模板编辑里设置一次性、日程表或每周循环。",
    ruleNone: "没有印刷规则",
    ruleOnce: "一次性 · {date}{time}",
    ruleCalendar: "日程表 · {n} 个日期",
    ruleWeekly: "每周 · {days}{times}",
    daySep: "、",
    timesSep: " · ",
    untimed: "不定时",
    autoLabel: "自动印刷",
    autoHint: "按「今天 + 提前 {n} 天」补齐遗漏；程序关闭时不会补。",
    autoOn: "已开启自动印刷",
    autoOff: "已关闭自动印刷",
    dates: "计划日期",
    pickDate: "再选一天",
    chipToday: "今天",
    chipTomorrow: "明天",
    chipThisWeek: "本周",
    chipNextDays: "接下来 7 天",
    chipAllDates: "全部规则日期（{n}）",
    chipRuleDate: "规则日期：{date}",
    addDate: "添加",
    removeDate: "移除这个日期",
    pickedEmpty: "还没有选日期；点上面的快捷日期，或手动选一天。",
    invalidDate: "日期无效，请重新选择",
    preview: "预览",
    previewCount: "将生成 {n} 个任务",
    previewNone: "没有可生成的任务",
    previewMore: "…还有 {n} 条",
    skipped: "将跳过",
    skipPrinted: "已印刷：{date}",
    skipNotInRule: "不在日程表：{date}",
    excludedHint: "不在规则内的日期已从提交中排除，避免整批报错。",
    pickDateFirst: "请至少选择一个日期",
    confirm: "印刷",
    done: "印刷完成",
  },
  en: {
    title: "Print tasks",
    subtitle:
      "Generate task instances from a template; dates already printed are skipped.",
    template: "Template",
    untitled: "Untitled template",
    emptyTitle: "No templates yet",
    emptyHint:
      "Save a group of tasks as a template on the Tasks page, then come back to print.",
    noPrinting: "This template has no usable printing rule",
    noPrintingHint:
      "Set up a one-off, calendar, or weekly rule in the template editor first.",
    ruleNone: "No printing rule",
    ruleOnce: "Once · {date}{time}",
    ruleCalendar: "Calendar · {n} dates",
    ruleWeekly: "Weekly · {days}{times}",
    daySep: ", ",
    timesSep: " · ",
    untimed: "Anytime",
    autoLabel: "Auto print",
    autoHint:
      "Fills gaps for today + {n} days ahead; nothing runs while the app is closed.",
    autoOn: "Auto print on",
    autoOff: "Auto print off",
    dates: "Planned dates",
    pickDate: "Pick a day",
    chipToday: "Today",
    chipTomorrow: "Tomorrow",
    chipThisWeek: "This week",
    chipNextDays: "Next 7 days",
    chipAllDates: "All rule dates ({n})",
    chipRuleDate: "Rule date: {date}",
    addDate: "Add",
    removeDate: "Remove this date",
    pickedEmpty: "No dates yet — tap a quick date above, or pick one.",
    invalidDate: "Invalid date, pick another",
    preview: "Preview",
    previewCount: "Will create {n} tasks",
    previewNone: "Nothing to create",
    previewMore: "…and {n} more",
    skipped: "Will skip",
    skipPrinted: "Already printed: {date}",
    skipNotInRule: "Not in calendar: {date}",
    excludedHint:
      "Dates outside the rule are left out of the batch so it does not fail.",
    pickDateFirst: "Pick at least one date",
    confirm: "Print",
    done: "Printing submitted",
  },
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PREVIEW_ROWS = 30;
/** 日程表「接下来」快捷日期：先看 14 天，再取前 7 个规则日期。 */
const CALENDAR_LOOKAHEAD_DAYS = 14;
const QUICK_UPCOMING_LIMIT = 7;
/** 「全部规则日期」只在数量有限时才给快捷入口。 */
const ALL_DATES_LIMIT = 30;

/** `YYYY-MM-DD` 且是真实存在的日期（本地往返校验，对齐 core 的 parseDate）。 */
function isDateText(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const probe = new Date(year, month - 1, day);
  return (
    probe.getFullYear() === year &&
    probe.getMonth() === month - 1 &&
    probe.getDate() === day
  );
}

/** 去重、排序、丢掉非法日期。 */
function uniqueSorted(values) {
  const out = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    if (!isDateText(value) || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out.sort();
}

/** 模板列表：容忍 null / 重复 id / 缺字段，页面不因脏数据崩。 */
function templateList(templates) {
  const out = [];
  const seen = new Set();
  for (const item of Array.isArray(templates) ? templates : []) {
    if (!item || typeof item !== "object") continue;
    if (typeof item.id !== "string" || item.id === "" || seen.has(item.id))
      continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function shapeTitle(template) {
  const title = template && template.shape && template.shape.title;
  return typeof title === "string" && title.trim() !== ""
    ? title
    : t("print.untitled");
}

/**
 * 规范化印刷规则；结构不成立的模板返回 null（＝「没有有效 printing」）。
 * 只做形状收敛，不做语义校验：写入与防重仍由 core 判定。
 */
function printingOf(template) {
  const rule =
    template && typeof template === "object" ? template.printing : null;
  if (!rule || typeof rule !== "object") return null;
  if (rule.kind === "once") {
    if (!isDateText(rule.date)) return null;
    return {
      kind: "once",
      date: rule.date,
      time:
        typeof rule.time === "string" && rule.time !== "" ? rule.time : null,
    };
  }
  if (rule.kind === "calendar") {
    const slots = [];
    for (const slot of Array.isArray(rule.slots) ? rule.slots : []) {
      if (!slot || typeof slot !== "object" || !Array.isArray(slot.dates))
        continue;
      const dates = slot.dates.filter(isDateText);
      if (dates.length === 0) continue;
      slots.push({
        dates,
        time:
          typeof slot.time === "string" && slot.time !== "" ? slot.time : null,
      });
    }
    return slots.length > 0 ? { kind: "calendar", slots } : null;
  }
  if (rule.kind === "weekly") {
    const slots = [];
    for (const slot of Array.isArray(rule.slots) ? rule.slots : []) {
      if (!slot || typeof slot !== "object" || !Array.isArray(slot.days))
        continue;
      const days = slot.days.filter(
        (day) => Number.isInteger(day) && day >= 1 && day <= 7,
      );
      if (days.length === 0) continue;
      slots.push({
        days,
        time:
          typeof slot.time === "string" && slot.time !== "" ? slot.time : null,
      });
    }
    return slots.length > 0 ? { kind: "weekly", slots } : null;
  }
  return null;
}

/** 印刷规则摘要（不 import tasks.js 的 printingSummary，避免循环依赖）。 */
function ruleSummary(template, today) {
  const printing = printingOf(template);
  if (!printing) return t("print.ruleNone");
  if (printing.kind === "once") {
    const date = dayLabel(printing.date, today);
    const time = printing.time ? ` ${printing.time}` : "";
    return t("print.ruleOnce", { date, time });
  }
  if (printing.kind === "calendar") {
    return t("print.ruleCalendar", { n: calendarRuleDates(printing).length });
  }
  const days = new Set();
  const times = new Set();
  for (const slot of printing.slots) {
    for (const day of slot.days) days.add(day);
    if (slot.time) times.add(slot.time);
  }
  const labels = t("common.weekFull");
  const dayText = Array.from(days)
    .sort((a, b) => a - b)
    .map((day) => (Array.isArray(labels) ? labels[day - 1] : String(day)))
    .join(t("print.daySep"));
  const timesText =
    times.size > 0
      ? `${t("print.timesSep")}${Array.from(times).join(" / ")}`
      : "";
  return t("print.ruleWeekly", { days: dayText || "—", times: timesText });
}

/** 日程表规则内的全部合法日期（去重、排序）。 */
function calendarRuleDates(printing) {
  const dates = new Set();
  for (const slot of printing.slots) {
    for (const date of slot.dates) if (isDateText(date)) dates.add(date);
  }
  return Array.from(dates).sort();
}

/** 已选日期 → 周期模板实际展开的日期（同周只展开一次，排序去重）。 */
function weeklyExpandedDates(printing, dates) {
  const days = Array.from(
    new Set(printing.slots.flatMap((slot) => slot.days)),
  ).sort((a, b) => a - b);
  const expanded = [];
  const weeks = new Set(dates.map((date) => weekStart(date)));
  for (const monday of weeks) {
    for (const day of days) expanded.push(addDays(monday, day - 1));
  }
  return uniqueSorted(expanded);
}

/** 某日期会被印出的开始时刻；规则与 core 的 templateTimes 一致。 */
function timesOf(printing, date) {
  if (printing.kind === "once") return [printing.time];
  if (printing.kind === "calendar") {
    const times = [];
    for (const slot of printing.slots) {
      if (slot.dates.includes(date)) times.push(slot.time);
    }
    return times;
  }
  const weekday = weekdayIndex(date) + 1; // 1 = 周一 … 7 = 周日
  const times = [];
  for (const slot of printing.slots) {
    if (slot.days.includes(weekday)) times.push(slot.time);
  }
  return times;
}

/** 该模板已印刷的日期集合。 */
function printedDatesOf(prints, templateId) {
  const out = new Set();
  if (!templateId) return out;
  for (const item of Array.isArray(prints) ? prints : []) {
    if (!item || item.templateId !== templateId) continue;
    if (isDateText(item.date)) out.add(item.date);
  }
  return out;
}

/**
 * 本地预览 + 实际提交日期。
 * - weekly：提交原始已选日期（core 负责展开整周与防重）。
 * - calendar：只提交出现在某个 slot.dates 里的日期，其余标为跳过。
 * - once：任何合法已选日期都可印。
 * 预览跳过 prints 里已有的日期（core 同样跳过）。
 */
function buildPreview(printing, pickedDates, printedDates) {
  const rows = [];
  const skippedPrinted = [];
  let skippedNotInRule = [];
  let submitDates = [];
  if (!printing) {
    return {
      rows,
      skippedPrinted,
      skippedNotInRule,
      submitDates,
      taskCount: 0,
    };
  }
  if (printing.kind === "weekly") {
    submitDates = pickedDates;
    for (const date of weeklyExpandedDates(printing, pickedDates)) {
      if (printedDates.has(date)) {
        skippedPrinted.push(date);
        continue;
      }
      const times = timesOf(printing, date);
      if (times.length > 0) rows.push({ date, times });
    }
  } else if (printing.kind === "calendar") {
    const rule = new Set(calendarRuleDates(printing));
    submitDates = pickedDates.filter((date) => rule.has(date));
    skippedNotInRule = pickedDates.filter((date) => !rule.has(date));
    for (const date of submitDates) {
      if (printedDates.has(date)) {
        skippedPrinted.push(date);
        continue;
      }
      const times = timesOf(printing, date);
      if (times.length > 0) rows.push({ date, times });
    }
  } else {
    submitDates = pickedDates;
    for (const date of pickedDates) {
      if (printedDates.has(date)) {
        skippedPrinted.push(date);
        continue;
      }
      rows.push({ date, times: timesOf(printing, date) });
    }
  }
  const taskCount = rows.reduce((sum, row) => sum + row.times.length, 0);
  return { rows, skippedPrinted, skippedNotInRule, submitDates, taskCount };
}

export function PrintDialog({
  open,
  onClose,
  templates = [],
  prints = [],
  today = "",
  initialTemplateId = null,
}) {
  // hooks 必须在 open=false 的早退之前全部调用（React 规则，参照 task-dialog.js）。
  const [templateId, setTemplateId] = useState("");
  const [picked, setPicked] = useState([]);
  const [dateInput, setDateInput] = useState("");
  const [autoDraft, setAutoDraft] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);

  const baseToday = isDateText(today) ? today : todayKey();
  const list = templateList(templates);
  const fallbackTemplateId = list.some((item) => item.id === initialTemplateId)
    ? initialTemplateId
    : list.length > 0
      ? list[0].id
      : "";
  // 渲染时就用有效 id，避免「打开/列表变化」到 effect 生效之间闪一帧空选择。
  const activeTemplateId = list.some((item) => item.id === templateId)
    ? templateId
    : fallbackTemplateId;
  const current = list.find((item) => item.id === activeTemplateId) || null;
  const printing = current ? printingOf(current) : null;
  const autoOn = !!(current && current.automatic);

  // 打开时重置：默认 initialTemplateId（在列表内时），否则第一个模板。
  useEffect(() => {
    if (!open) return;
    setTemplateId(fallbackTemplateId);
    setPicked([]);
    setDateInput("");
    setError(null);
    setBusy(false);
    setAutoBusy(false);
    // 轮询会换新数组；依赖 fallbackTemplateId 而不是 list，避免清空用户输入。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fallbackTemplateId]);

  if (!open) return null;

  // 空闲时以快照为权威，保存中才显示乐观值：失败后无需手动回滚。
  const autoChecked = autoBusy ? autoDraft : autoOn;
  const autoAhead = current
    ? Math.max(0, Math.round(Number(current.printAheadDays) || 0))
    : 0;
  const printedDates = printedDatesOf(prints, current && current.id);
  const pickedSorted = uniqueSorted(picked);
  const { rows, skippedPrinted, skippedNotInRule, submitDates, taskCount } =
    buildPreview(printing, pickedSorted, printedDates);

  const addDates = (values) => {
    const clean = uniqueSorted(values);
    if (clean.length === 0) return;
    setPicked((currentPicked) => uniqueSorted([...currentPicked, ...clean]));
    setError(null);
  };

  const removeDate = (date) => {
    setPicked((currentPicked) => currentPicked.filter((item) => item !== date));
  };

  const addFromInput = () => {
    const value = String(dateInput ?? "").trim();
    if (value === "") return;
    if (!isDateText(value)) {
      setError(t("print.invalidDate"));
      return;
    }
    addDates([value]);
    setDateInput("");
  };

  const chooseTemplate = (nextId) => {
    setTemplateId(nextId);
    setPicked([]);
    setDateInput("");
    setError(null);
  };

  const toggleAutomatic = async (next) => {
    if (autoBusy || busy || !current || !printing) return;
    setAutoDraft(!!next);
    setAutoBusy(true);
    setError(null);
    // 严格翻转 automatic：shape / printing / printAheadDays 原样带回。
    const result = await tryDispatch({
      type: "saveTemplate",
      template: {
        ...current,
        automatic: next,
        printAheadDays: current.printAheadDays,
      },
      printDates: [],
    });
    setAutoBusy(false);
    if (!result.ok) {
      setError(result.error || t("common.writeFailed"));
      return;
    }
    notify(next ? t("print.autoOn") : t("print.autoOff"), "brand");
  };

  const submit = async () => {
    if (busy) return;
    if (!current || !printing) {
      setError(t("print.noPrinting"));
      return;
    }
    if (submitDates.length === 0) {
      setError(t("print.pickDateFirst"));
      return;
    }
    setBusy(true);
    setError(null);
    const result = await tryDispatch({
      type: "printTemplate",
      id: current.id,
      dates: submitDates,
    });
    setBusy(false);
    if (!result.ok) {
      // 失败留在对话框里，不抛异常、不关闭。
      setError(result.error || t("common.writeFailed"));
      return;
    }
    notify(t("print.done"), "brand");
    onClose?.();
  };

  // ---------------------------------------------------------------- 快捷日期

  const quickChips = [];
  if (printing) {
    quickChips.push({
      key: "today",
      label: t("print.chipToday"),
      icon: "sun",
      dates: [baseToday],
    });
    quickChips.push({
      key: "tomorrow",
      label: t("print.chipTomorrow"),
      icon: "calendar",
      dates: [addDays(baseToday, 1)],
    });
    if (printing.kind === "weekly") {
      // 本周任一天即可让 core 展开整周。
      quickChips.push({
        key: "week",
        label: t("print.chipThisWeek"),
        icon: "calendarClock",
        dates: [weekStart(baseToday)],
      });
    }
    if (printing.kind === "calendar") {
      const ruleDates = calendarRuleDates(printing);
      const horizon = addDays(baseToday, CALENDAR_LOOKAHEAD_DAYS - 1);
      const upcoming = ruleDates
        .filter((date) => date >= baseToday && date <= horizon)
        .slice(0, QUICK_UPCOMING_LIMIT);
      if (upcoming.length > 0) {
        quickChips.push({
          key: "upcoming",
          label: t("print.chipNextDays"),
          icon: "arrowRight",
          dates: upcoming,
        });
      }
      if (ruleDates.length > 0 && ruleDates.length <= ALL_DATES_LIMIT) {
        quickChips.push({
          key: "all",
          label: t("print.chipAllDates", { n: ruleDates.length }),
          icon: "filter",
          dates: ruleDates,
        });
      }
    }
    if (printing.kind === "once") {
      quickChips.push({
        key: "once",
        label: t("print.chipRuleDate", {
          date: dayLabel(printing.date, baseToday),
        }),
        icon: "calendarClock",
        dates: [printing.date],
      });
    }
  }

  // ---------------------------------------------------------------- 预览视图

  const shownRows = rows.slice(0, MAX_PREVIEW_ROWS);
  const hiddenRows = rows.length - shownRows.length;
  const hasSkipped = skippedPrinted.length > 0 || skippedNotInRule.length > 0;

  const previewBlock = h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 8 } },
    h(SectionTitle, { icon: "eye", title: t("print.preview") }),
    h(
      "div",
      {
        style: {
          fontSize: 13,
          fontWeight: 550,
          color: taskCount > 0 ? "var(--tomato-ink)" : "var(--tomato-ink-3)",
          fontVariantNumeric: "tabular-nums",
        },
      },
      taskCount > 0
        ? t("print.previewCount", { n: taskCount })
        : t("print.previewNone"),
    ),
    shownRows.length > 0
      ? h(
          "div",
          {
            className: "t-scroll",
            style: { maxHeight: 240, overflowY: "auto" },
          },
          shownRows.map((row) =>
            h(
              "div",
              {
                key: row.date,
                style: {
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "7px 0",
                  borderBottom: "1px solid var(--tomato-line)",
                },
              },
              h(
                "div",
                { style: { flexShrink: 0, minWidth: 0 } },
                h(
                  "div",
                  {
                    style: {
                      fontSize: 12.5,
                      color: "var(--tomato-ink)",
                      whiteSpace: "nowrap",
                    },
                  },
                  dayLabel(row.date, baseToday),
                ),
                h(
                  "div",
                  {
                    className: "t-mono",
                    style: {
                      fontSize: 11,
                      color: "var(--tomato-ink-3)",
                      marginTop: 1,
                    },
                  },
                  row.date,
                ),
              ),
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                    gap: 5,
                    flex: 1,
                    minWidth: 0,
                  },
                },
                row.times.map((time, index) =>
                  h(
                    Chip,
                    {
                      key: `${row.date}-${index}`,
                      tone: time ? "brand" : "neutral",
                      icon: time ? "clock" : "sparkle",
                    },
                    time || t("print.untimed"),
                  ),
                ),
              ),
            ),
          ),
          hiddenRows > 0
            ? h(
                "div",
                {
                  style: {
                    fontSize: 11.5,
                    color: "var(--tomato-ink-3)",
                    paddingTop: 6,
                    fontVariantNumeric: "tabular-nums",
                  },
                },
                t("print.previewMore", { n: hiddenRows }),
              )
            : null,
        )
      : null,
    hasSkipped
      ? h(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginTop: 2,
            },
          },
          h(
            "div",
            {
              style: {
                fontSize: 11.5,
                fontWeight: 550,
                color: "var(--tomato-ink-3)",
              },
            },
            t("print.skipped"),
          ),
          h(
            "div",
            { style: { display: "flex", flexWrap: "wrap", gap: 5 } },
            skippedPrinted.map((date) =>
              h(
                Chip,
                { key: `printed-${date}`, tone: "neutral", icon: "check" },
                t("print.skipPrinted", { date }),
              ),
            ),
            skippedNotInRule.map((date) =>
              h(
                Chip,
                { key: `outside-${date}`, tone: "danger", icon: "x" },
                t("print.skipNotInRule", { date }),
              ),
            ),
          ),
          skippedNotInRule.length > 0
            ? h(
                "div",
                {
                  style: {
                    fontSize: 11,
                    lineHeight: 1.5,
                    color: "var(--tomato-ink-3)",
                  },
                },
                t("print.excludedHint"),
              )
            : null,
        )
      : null,
  );

  // ---------------------------------------------------------------- 正文

  let body;
  if (list.length === 0) {
    body = h(Empty, {
      icon: "calendar",
      title: t("print.emptyTitle"),
      hint: t("print.emptyHint"),
      style: { padding: "40px 16px" },
    });
  } else {
    body = h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 16 } },
      h(
        Field,
        { label: t("print.template") },
        h(Select, {
          value: activeTemplateId,
          options: list.map((item) => ({
            value: item.id,
            label: shapeTitle(item),
          })),
          onChange: chooseTemplate,
          width: "100%",
        }),
      ),
      current
        ? h(
            "div",
            { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
            h(
              Chip,
              {
                tone: "neutral",
                icon: "calendarClock",
                style: { fontVariantNumeric: "tabular-nums" },
              },
              ruleSummary(current, baseToday),
            ),
          )
        : null,
      printing
        ? h(Toggle, {
            checked: autoChecked,
            onChange: toggleAutomatic,
            label: t("print.autoLabel"),
            hint: t("print.autoHint", { n: autoAhead }),
          })
        : null,
      printing ? h(Divider, null) : null,
      printing
        ? h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: 10 } },
            h(SectionTitle, { icon: "calendar", title: t("print.dates") }),
            quickChips.length > 0
              ? h(
                  "div",
                  { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
                  quickChips.map((chip) =>
                    h(
                      Chip,
                      {
                        key: chip.key,
                        tone: "neutral",
                        icon: chip.icon,
                        active:
                          chip.dates.length > 0 &&
                          chip.dates.every((date) =>
                            pickedSorted.includes(date),
                          ),
                        onClick: () => addDates(chip.dates),
                        // 触摸区 ≥28px：Chip 默认 22px，这里按 sm 按钮抬高。
                        style: {
                          height: 28,
                          padding: "0 10px",
                          fontSize: 12,
                          borderRadius: 9,
                          fontVariantNumeric: "tabular-nums",
                        },
                      },
                      chip.label,
                    ),
                  ),
                )
              : null,
            h(
              "div",
              {
                style: {
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-end",
                  flexWrap: "wrap",
                },
              },
              h(
                Field,
                {
                  label: t("print.pickDate"),
                  style: { flex: "1 1 180px", minWidth: 160 },
                },
                h(Input, {
                  type: "date",
                  value: dateInput,
                  onChange: (value) => setDateInput(value),
                  onKeyDown: (event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addFromInput();
                    }
                  },
                }),
              ),
              h(
                Btn,
                {
                  variant: "soft",
                  size: "md",
                  icon: "plus",
                  title: t("print.addDate"),
                  onClick: addFromInput,
                },
                t("print.addDate"),
              ),
            ),
            pickedSorted.length > 0
              ? h(
                  "div",
                  { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
                  pickedSorted.map((date) =>
                    h(
                      Btn,
                      {
                        key: date,
                        variant: "soft",
                        size: "sm",
                        iconRight: "x",
                        title: t("print.removeDate"),
                        onClick: () => removeDate(date),
                      },
                      h("span", { key: "label" }, dayLabel(date, baseToday)),
                      h(
                        "span",
                        {
                          key: "date",
                          className: "t-mono",
                          style: { fontSize: 11, color: "var(--tomato-ink-3)" },
                        },
                        date,
                      ),
                    ),
                  ),
                )
              : h(
                  "div",
                  { style: { fontSize: 12, color: "var(--tomato-ink-3)" } },
                  t("print.pickedEmpty"),
                ),
          )
        : h(Empty, {
            icon: "calendar",
            title: t("print.noPrinting"),
            hint: t("print.noPrintingHint"),
            style: { padding: "28px 16px" },
          }),
      printing ? h(Divider, null) : null,
      printing ? previewBlock : null,
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
  }

  const footer = h(
    "div",
    { style: { display: "flex", alignItems: "center", gap: 9, width: "100%" } },
    h("div", { style: { flex: 1 } }),
    h(
      Btn,
      {
        variant: "plain",
        size: "sm",
        onClick: onClose,
        disabled: busy || autoBusy,
      },
      t("common.cancel"),
    ),
    h(
      Btn,
      {
        variant: "primary",
        size: "sm",
        icon: "check",
        onClick: submit,
        disabled: busy || !printing || submitDates.length === 0,
        title: !printing
          ? t("print.noPrinting")
          : submitDates.length === 0
            ? t("print.pickDateFirst")
            : t("print.confirm"),
      },
      t("print.confirm"),
    ),
  );

  return h(
    Modal,
    {
      open,
      onClose: () => {
        if (!busy && !autoBusy) onClose?.();
      },
      icon: "download",
      title: t("print.title"),
      subtitle: t("print.subtitle"),
      width: 620,
      footer,
    },
    body,
  );
}
