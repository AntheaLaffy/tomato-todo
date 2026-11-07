// 习惯愿景：习惯卡（7 日点阵 + 连续/缺勤）与愿景卡（纯方向标记）。
//
// 数据形状反直觉的地方：core 的 Habit 只有 id+name，分组、专注时长与每周时段
// 都存在对应模板里（id `habit:<habitId>`，shape.habitId=habitId，
// printing.kind="weekly"）。所以习惯卡必须把 habits 与 templates 拼起来看；
// 旧快照里 habits 可能自带 slots/group/missedDates，这里一律不读，避免两套
// 语义混在一起。缺勤计数只看实例（reminderExpired 或已过期的未完成实例）。
import { h, useState } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import {
  PageHeader,
  Card,
  Btn,
  IconBtn,
  Chip,
  Dot,
  Field,
  Input,
  TextArea,
  Select,
  Segmented,
  Modal,
  Empty,
  Skeleton,
  notify,
} from "../shared/ui.js";
import { Icon } from "../shared/icons.js";
import { tryDispatch } from "../shared/store.js";
import {
  addDays,
  weekdayIndex,
  projectById,
  projectColor,
  fmtMinutes,
  fmtHHMM,
  parseHHMM,
  dayLabel,
  todayKey,
} from "../shared/derive.js";
import { registerPage } from "../app/registry.js";

registerCopy("habits", {
  zh: {
    eyebrow: "小步慢走",
    subtitle: "习惯是重复的小动作，愿景是远处的方向。",
    tabHabits: "习惯",
    tabVisions: "愿景",
    habitsHint: "点阵是最近 7 天：实心为完成，空心为缺勤，灰点是那天没有安排。",
    visionsHint: "纯方向标记：没有完成态，也不会催你。",
    newHabit: "新建习惯",
    newVision: "新建愿景",
    firstHabit: "新建第一个习惯",
    firstVision: "写下第一个愿景",
    emptyHabitsTitle: "还没有习惯",
    emptyHabitsHint: "从一件小到不会失败的事开始，连续几天就会长成节奏。",
    emptyVisionsTitle: "还没有愿景",
    emptyVisionsHint: "写下你想去的方向；它只需要被看见，不需要被完成。",
    everyDay: "每天",
    weekly: "每周",
    daySeparator: "、",
    slotText: "{days} {time}",
    focusPerSession: "专注 {n}",
    streakDays: "连续 {n} 天",
    missedCount: "缺勤 {n} 次",
    dotDone: "已完成",
    dotMissed: "缺勤",
    dotPending: "待完成",
    dotIdle: "未安排",
    dotTitle: "{date} · {status}",
    newHabitTitle: "新建习惯",
    editHabitTitle: "编辑习惯",
    habitDialogSubtitle: "时段决定它多久出现一次；专注时长留空就用默认值。",
    habitName: "习惯名称",
    habitNamePlaceholder: "例如：晨读 20 分钟",
    habitProject: "分组",
    noGroup: "无分组",
    schedule: "时段",
    time: "时间",
    focusMinutes: "专注时长（分钟）",
    focusMinutesHint: "留空使用默认 {n}",
    slotTitle: "时段 {n}",
    addSlot: "添加时段",
    removeSlot: "删除",
    slotDuplicate: "有两个时段撞在同一天的同一时间了",
    slotsLimit: "一个习惯最多 49 个时段",
    nameError: "名称需为 1–40 个字符",
    daysError: "请至少选择一天",
    timeError: "时间格式需为 HH:MM",
    focusError: "专注时长需为 1–180 分钟的整数",
    saved: "习惯已保存",
    deleted: "已删除",
    deleteHabit: "删除习惯",
    deleteHabitTitle: "删除这个习惯？",
    deleteHabitBody: "「{name}」的每周计划会一并移除；已经发生的记录会保留在历史里。",
    newVisionTitle: "新建愿景",
    editVisionTitle: "编辑愿景",
    visionDialogSubtitle: "愿景只有方向，没有完成态。",
    visionName: "愿景名称",
    visionNamePlaceholder: "例如：能读完一本英文原著",
    visionNotes: "一句话",
    visionNotesPlaceholder: "它为什么重要？",
    visionProject: "归属",
    totalVision: "总愿景",
    visionSaved: "愿景已保存",
    deleteVision: "删除愿景",
    deleteVisionTitle: "删除这个愿景？",
    deleteVisionBody: "「{name}」会被移除；任务和记录不受影响。",
    untitled: "未命名",
  },
  en: {
    eyebrow: "SMALL STEPS",
    subtitle: "Habits are repeated small acts; visions are the far direction.",
    tabHabits: "Habits",
    tabVisions: "Visions",
    habitsHint: "Dots cover the last 7 days: filled done, outlined missed, grey nothing scheduled.",
    visionsHint: "Pure direction markers: no completion state, no pressure.",
    newHabit: "New habit",
    newVision: "New vision",
    firstHabit: "Create your first habit",
    firstVision: "Write your first vision",
    emptyHabitsTitle: "No habits yet",
    emptyHabitsHint: "Start with something so small it can't fail; a few days in a row becomes a rhythm.",
    emptyVisionsTitle: "No visions yet",
    emptyVisionsHint: "Write down where you're headed. It only needs to be seen, not completed.",
    everyDay: "Every day",
    weekly: "Weekly",
    daySeparator: ", ",
    slotText: "{days} at {time}",
    focusPerSession: "{n} focus",
    streakDays: "{n}-day streak",
    missedCount: "{n} missed",
    dotDone: "Done",
    dotMissed: "Missed",
    dotPending: "To do",
    dotIdle: "Not scheduled",
    dotTitle: "{date} · {status}",
    newHabitTitle: "New habit",
    editHabitTitle: "Edit habit",
    habitDialogSubtitle: "The schedule decides how often it appears; leave focus length empty for the default.",
    habitName: "Habit name",
    habitNamePlaceholder: "e.g. Morning reading, 20 minutes",
    habitProject: "Group",
    noGroup: "No group",
    schedule: "Schedule",
    time: "Time",
    focusMinutes: "Focus length (minutes)",
    focusMinutesHint: "Empty uses the default {n}",
    slotTitle: "Slot {n}",
    addSlot: "Add slot",
    removeSlot: "Remove",
    slotDuplicate: "Two slots land on the same day and time",
    slotsLimit: "A habit holds at most 49 slots",
    nameError: "Name must be 1–40 characters",
    daysError: "Pick at least one day",
    timeError: "Time must be HH:MM",
    focusError: "Focus length must be an integer from 1 to 180 minutes",
    saved: "Habit saved",
    deleted: "Deleted",
    deleteHabit: "Delete habit",
    deleteHabitTitle: "Delete this habit?",
    deleteHabitBody: "The weekly schedule for \"{name}\" is removed too; history already recorded stays.",
    newVisionTitle: "New vision",
    editVisionTitle: "Edit vision",
    visionDialogSubtitle: "A vision is a direction, not a task to complete.",
    visionName: "Vision name",
    visionNamePlaceholder: "e.g. Finish an English novel",
    visionNotes: "One line",
    visionNotesPlaceholder: "Why does it matter?",
    visionProject: "Belongs to",
    totalVision: "Whole vision",
    visionSaved: "Vision saved",
    deleteVision: "Delete vision",
    deleteVisionTitle: "Delete this vision?",
    deleteVisionBody: "\"{name}\" will be removed; tasks and records are untouched.",
    untitled: "Untitled",
  },
});

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
const DEFAULT_TIME = "07:00";
const STREAK_LOOKBACK = 120;

const STATUS_COPY = {
  done: "habits.dotDone",
  missed: "habits.dotMissed",
  pending: "habits.dotPending",
  idle: "habits.dotIdle",
};

const DOT_BASE = {
  width: 13,
  height: 13,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  flex: "none",
};

const NAME_STYLE = {
  fontSize: 15,
  fontWeight: 600,
  color: "var(--tomato-ink)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const BADGE_STYLE = {
  width: 34,
  height: 34,
  borderRadius: 11,
  display: "grid",
  placeItems: "center",
  flex: "none",
};

// ---------------------------------------------------------------- 派生

/** 习惯的调度模板：core 用 shape.habitId 关联，不依赖 id 前缀。 */
function habitTemplate(templates, habitId) {
  if (!habitId) return null;
  return templates.find((item) => item && item.shape && item.shape.habitId === habitId) || null;
}

/** 模板里的每周时段；非 weekly 或字段缺失时返回空数组。 */
function slotsOfTemplate(template) {
  if (!template || !template.printing || template.printing.kind !== "weekly") return [];
  const slots = Array.isArray(template.printing.slots) ? template.printing.slots : [];
  return slots.filter(
    (slot) =>
      slot &&
      Array.isArray(slot.days) &&
      slot.days.some((day) => day >= 1 && day <= 7) &&
      typeof slot.time === "string" &&
      slot.time.length > 0,
  );
}

function instancesOf(tasks, habitId) {
  return tasks.filter(
    (task) => task && task.habitId === habitId && typeof task.dueDate === "string" && task.dueDate.length > 0,
  );
}

function groupByDate(instances) {
  const map = new Map();
  for (const task of instances) {
    const list = map.get(task.dueDate);
    if (list) list.push(task);
    else map.set(task.dueDate, [task]);
  }
  return map;
}

function isPlanned(date, slots, hasTemplate) {
  if (!hasTemplate) return false;
  const weekday = weekdayIndex(date) + 1;
  return slots.some((slot) => slot.days.includes(weekday));
}

/**
 * 某天状态：done | missed | pending | idle。
 * 有实例或模板排到这天即算「已安排」；完成看当天实例，缺勤只看过去。
 */
function statusOfDay(date, grouped, slots, hasTemplate, today, firstDate) {
  const entries = grouped.get(date) || [];
  // 模板只描述「以后会怎么排」：在第一条实例出现之前的日子不算缺勤，
  // 否则刚建好的习惯会在点阵里凭空多出几天缺勤。
  const planned =
    hasTemplate &&
    (firstDate === null ? date === today : date >= firstDate) &&
    isPlanned(date, slots, hasTemplate);
  const scheduled = entries.length > 0 || planned;
  if (!scheduled) return "idle";
  if (entries.some((task) => task.completed)) return "done";
  if (date < today) return "missed";
  if (date === today) return "pending";
  return "idle";
}

/** 第一条实例的日期；没有实例返回 null。 */
function firstInstanceDate(instances) {
  let first = null;
  for (const task of instances) {
    if (first === null || task.dueDate < first) first = task.dueDate;
  }
  return first;
}

/** 连续天数：从今天往前，跳过未安排日；今天未完成不打断，过去缺勤即停止。 */
function streakOf(grouped, slots, hasTemplate, today, firstDate) {
  let streak = 0;
  let cursor = today;
  for (let i = 0; i < STREAK_LOOKBACK; i += 1) {
    const status = statusOfDay(cursor, grouped, slots, hasTemplate, today, firstDate);
    if (status === "done") streak += 1;
    else if (status === "missed") break;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** 缺勤次数：core 语义（reminderExpired）与「过期未完成」取并集，按实例去重。 */
function missedOf(instances, today) {
  let missed = 0;
  for (const task of instances) {
    if (task.completed) continue;
    if (task.reminderExpired || task.dueDate < today) missed += 1;
  }
  return missed;
}

function recentDates(today, count) {
  const out = [];
  for (let i = count - 1; i >= 0; i -= 1) out.push(addDays(today, -i));
  return out;
}

/** 只保留对象项：旧快照里可能有 null 占位，页面不为此崩。 */
function objectList(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function weekFullLabels() {
  const labels = t("common.weekFull");
  return Array.isArray(labels) ? labels : [];
}

function weekShortLabels() {
  const labels = t("common.week");
  return Array.isArray(labels) ? labels : [];
}

/** 把模板 slot 写成「每天 07:00」/「周一、周三、周五 07:00」。 */
function slotText(slot) {
  const days = Array.from(new Set(slot.days.filter((day) => day >= 1 && day <= 7))).sort((a, b) => a - b);
  if (days.length === 0) return "";
  const labels = weekFullLabels();
  const everyDay = days.length === 7;
  const dayText = everyDay
    ? t("habits.everyDay")
    : days.map((day) => labels[day - 1] || String(day)).join(t("habits.daySeparator"));
  return t("habits.slotText", { days: dayText, time: slot.time });
}

function normalizeTime(value) {
  const seconds = parseHHMM(value);
  return seconds === null ? DEFAULT_TIME : fmtHHMM(seconds);
}

function dotStyle(status) {
  if (status === "done") {
    return {
      ...DOT_BASE,
      background: "var(--tomato-leaf)",
      border: "1px solid var(--tomato-leaf)",
      color: "var(--tomato-on-brand)",
    };
  }
  if (status === "missed") {
    return {
      ...DOT_BASE,
      background: "transparent",
      border: "1.4px solid var(--dsw-alias-state-error-primary)",
    };
  }
  if (status === "pending") {
    return {
      ...DOT_BASE,
      background: "var(--tomato-brand)",
      border: "1px solid var(--tomato-brand)",
      color: "var(--tomato-on-brand)",
      boxShadow: "0 0 0 3px var(--tomato-brand-soft)",
    };
  }
  return {
    ...DOT_BASE,
    width: 8,
    height: 8,
    background: "var(--tomato-surface-3)",
    border: "1px solid transparent",
  };
}

// ---------------------------------------------------------------- 卡片

function HabitCard({ habit, data, templates, tasks, today, onEdit, onDelete }) {
  const template = habitTemplate(templates, habit.id);
  const slots = slotsOfTemplate(template);
  const shape = (template && template.shape) || {};
  const instanceList = instancesOf(tasks, habit.id);
  const grouped = groupByDate(instanceList);
  const firstDate = firstInstanceDate(instanceList);
  const project = shape.projectId ? projectById(data, shape.projectId) : null;
  const settingsFocus = Number((data.settings || {}).focusMinutes) || 0;
  const focus = Number(shape.focusMinutes) > 0 ? Number(shape.focusMinutes) : settingsFocus;
  const dates = recentDates(today, 7);
  const streak = streakOf(grouped, slots, template !== null, today, firstDate);
  const missed = missedOf(instanceList, today);
  const shortWeek = weekShortLabels();

  const meta = [];
  if (project) {
    meta.push(
      h(
        Chip,
        { key: "project", tone: "neutral" },
        h(Dot, { color: projectColor(data, project.id), size: 6 }),
        project.name,
      ),
    );
  }
  if (focus > 0) {
    meta.push(
      h(Chip, { key: "focus", tone: "neutral", icon: "timer" }, t("habits.focusPerSession", { n: fmtMinutes(focus) })),
    );
  }
  slots.forEach((slot, index) => {
    meta.push(h(Chip, { key: `slot-${index}`, tone: "neutral", icon: "clock" }, slotText(slot)));
  });

  return h(
    Card,
    {
      pad: 18,
      style: { flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 13 },
    },
    h(
      "div",
      { style: { display: "flex", alignItems: "flex-start", gap: 11 } },
      h(
        "div",
        {
          style: {
            ...BADGE_STYLE,
            background: "var(--tomato-surface-2)",
            color: "var(--tomato-leaf)",
          },
        },
        h(Icon, { name: "leaf", size: 17 }),
      ),
      h(
        "div",
        { style: { flex: 1, minWidth: 0 } },
        h("div", { style: NAME_STYLE, title: habit.name || t("habits.untitled") }, habit.name || t("habits.untitled")),
      ),
      h(IconBtn, {
        name: "edit",
        size: 15,
        box: 28,
        title: t("common.edit"),
        onClick: () => onEdit(habit.id),
      }),
      h(IconBtn, {
        name: "trash",
        size: 15,
        box: 28,
        title: t("common.delete"),
        onClick: () => onDelete(habit),
      }),
    ),
    meta.length > 0 ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" } }, meta) : null,
    h(
      "div",
      { style: { display: "flex", gap: 4, marginTop: "auto" } },
      dates.map((date) => {
        const status = statusOfDay(date, grouped, slots, template !== null, today, firstDate);
        const isToday = date === today;
        const title = t("habits.dotTitle", {
          date: dayLabel(date, today),
          status: t(STATUS_COPY[status] || "habits.dotIdle"),
        });
        return h(
          "div",
          {
            key: date,
            title,
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 5,
              flex: 1,
              minWidth: 0,
            },
          },
          h(
            "span",
            { style: { width: 13, height: 13, display: "grid", placeItems: "center", flex: "none" } },
            h(
              "span",
              { style: dotStyle(status) },
              status === "done" ? h(Icon, { name: "check", size: 9, stroke: 2.6 }) : null,
            ),
          ),
          h(
            "span",
            {
              style: {
                fontSize: 10,
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                color: isToday ? "var(--tomato-brand-deep)" : "var(--tomato-ink-3)",
                fontWeight: isToday ? 600 : 400,
              },
            },
            isToday ? t("common.today") : shortWeek[weekdayIndex(date)] || "",
          ),
        );
      }),
    ),
    h(
      "div",
      { style: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" } },
      h(Chip, { tone: "sun", icon: "flame" }, t("habits.streakDays", { n: streak })),
      h(Chip, { tone: "danger", icon: "moon" }, t("habits.missedCount", { n: missed })),
    ),
  );
}

function VisionCard({ vision, data, onEdit, onDelete }) {
  const project = vision.projectId ? projectById(data, vision.projectId) : null;
  const name = vision.name || t("habits.untitled");
  const notes = typeof vision.notes === "string" ? vision.notes.trim() : "";

  return h(
    Card,
    {
      pad: 18,
      style: { flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 },
    },
    h(
      "div",
      { style: { display: "flex", alignItems: "flex-start", gap: 11 } },
      h(
        "div",
        {
          style: {
            ...BADGE_STYLE,
            background: "var(--tomato-brand-soft)",
            color: "var(--tomato-brand-deep)",
          },
        },
        h(Icon, { name: "sparkle", size: 17 }),
      ),
      h("div", { style: { flex: 1, minWidth: 0 } }, h("div", { style: NAME_STYLE, title: name }, name)),
      h(IconBtn, {
        name: "edit",
        size: 15,
        box: 28,
        title: t("common.edit"),
        onClick: () => onEdit(vision.id),
      }),
      h(IconBtn, {
        name: "trash",
        size: 15,
        box: 28,
        title: t("common.delete"),
        onClick: () => onDelete(vision),
      }),
    ),
    notes
      ? h(
          "div",
          { style: { fontSize: 12.5, lineHeight: 1.65, color: "var(--tomato-ink-2)", whiteSpace: "pre-wrap" } },
          notes,
        )
      : null,
    h(
      "div",
      { style: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: "auto" } },
      project
        ? h(
            Chip,
            { tone: "neutral" },
            h(Dot, { color: projectColor(data, project.id), size: 6 }),
            project.name,
          )
        : h(Chip, { tone: "brand", icon: "arrowRight" }, t("habits.totalVision")),
    ),
  );
}

// ---------------------------------------------------------------- 对话框

function InlineError({ text }) {
  if (!text) return null;
  return h(
    "div",
    {
      role: "alert",
      style: {
        padding: "9px 12px",
        borderRadius: 10,
        background: "var(--tomato-brand-soft)",
        color: "var(--tomato-brand-deep)",
        fontSize: 12.5,
        lineHeight: 1.5,
      },
    },
    text,
  );
}

function HabitDialog({ mode, habitId, data, onClose, onRequestDelete }) {
  const editing = mode === "edit";
  const habits = Array.isArray(data.habits) ? data.habits : [];
  const templates = Array.isArray(data.templates) ? data.templates : [];
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const habit = editing ? habits.find((item) => item && item.id === habitId) || null : null;
  const template = habitTemplate(templates, habitId);
  const shape = (template && template.shape) || {};
  // 时段是「一天出现几次」的唯一描述：同一个习惯可以「周三 08:00」加「周日 20:00」，
  // core 的每周循环校验按 (day|time) 去重，所以每个时段各自带星期与时间。
  const initialSlots = slotsOfTemplate(template);
  const slotsFromTemplate =
    initialSlots.length > 0
      ? initialSlots.map((slot) => ({
          days:
            Array.isArray(slot.days) && slot.days.length > 0
              ? Array.from(new Set(slot.days.filter((day) => day >= 1 && day <= 7))).sort((a, b) => a - b)
              : [...ALL_DAYS],
          time: normalizeTime(slot.time),
        }))
      : [{ days: [...ALL_DAYS], time: normalizeTime(null) }];
  const defaultFocus = Number((data.settings || {}).focusMinutes) || 45;

  const [name, setName] = useState(habit && typeof habit.name === "string" ? habit.name : "");
  const [projectId, setProjectId] = useState(shape.projectId || "");
  const [slots, setSlots] = useState(slotsFromTemplate);
  const [focus, setFocus] = useState(Number(shape.focusMinutes) >= 1 ? String(shape.focusMinutes) : "");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const patchSlot = (index, patch) => {
    setSlots((previous) => previous.map((slot, at) => (at === index ? { ...slot, ...patch } : slot)));
  };

  const toggleSlotDay = (index, day) => {
    setSlots((previous) =>
      previous.map((slot, at) => {
        if (at !== index) return slot;
        const days = slot.days.includes(day)
          ? slot.days.filter((item) => item !== day)
          : [...slot.days, day].sort((a, b) => a - b);
        return { ...slot, days };
      }),
    );
  };

  const addSlot = () => {
    setSlots((previous) => {
      const last = previous[previous.length - 1];
      const next = { days: [...(last ? last.days : ALL_DAYS)], time: "20:00" };
      return [...previous, next];
    });
  };

  const removeSlot = (index) => {
    setSlots((previous) => previous.filter((_, at) => at !== index));
  };

  const submit = async () => {
    if (busy) return;
    const trimmed = name.trim();
    if (trimmed.length === 0 || Array.from(trimmed).length > 40) {
      setError(t("habits.nameError"));
      return;
    }
    if (slots.length === 0) {
      setError(t("habits.daysError"));
      return;
    }
    if (slots.length > 49) {
      setError(t("habits.slotsLimit"));
      return;
    }
    const seen = new Set();
    for (const slot of slots) {
      if (slot.days.length === 0) {
        setError(t("habits.daysError"));
        return;
      }
      if (parseHHMM(slot.time) === null) {
        setError(t("habits.timeError"));
        return;
      }
      for (const day of slot.days) {
        const key = `${day}|${fmtHHMM(parseHHMM(slot.time))}`;
        if (seen.has(key)) {
          setError(t("habits.slotDuplicate"));
          return;
        }
        seen.add(key);
      }
    }
    const focusRaw = focus.trim();
    const focusMinutes = focusRaw === "" ? null : Number(focusRaw);
    if (focusRaw !== "" && (!Number.isInteger(focusMinutes) || focusMinutes < 1 || focusMinutes > 180)) {
      setError(t("habits.focusError"));
      return;
    }
    setBusy(true);
    setError(null);
    const result = await tryDispatch({
      type: "saveHabit",
      id: editing ? habitId : null,
      name: trimmed,
      projectId: projectId ? projectId : null,
      focusMinutes,
      slots: slots.map((slot) => ({
        days: slot.days,
        time: fmtHHMM(parseHHMM(slot.time)),
      })),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error || t("common.writeFailed"));
      notify(result.error || t("common.writeFailed"), "danger");
      return;
    }
    notify(t("habits.saved"), "brand");
    onClose();
  };

  const projectOptions = [
    { value: "", label: t("habits.noGroup") },
    ...projects.map((project) => ({ value: project.id, label: project.name || project.id })),
  ];
  const weekFull = weekFullLabels();

  const body = h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 14 } },
    h(
      Field,
      { label: t("habits.habitName") },
      h(Input, {
        value: name,
        onChange: setName,
        placeholder: t("habits.habitNamePlaceholder"),
        maxLength: 40,
        autoFocus: true,
      }),
    ),
    h(
      Field,
      { label: t("habits.habitProject") },
      h(Select, { value: projectId, options: projectOptions, onChange: setProjectId, width: "100%" }),
    ),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 8, minWidth: 0 } },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 8 } },
        h(
          "span",
          { style: { fontSize: 12, fontWeight: 550, color: "var(--tomato-ink-2)" } },
          t("habits.schedule"),
        ),
        h("div", { style: { flex: 1 } }),
        h(
          Btn,
          {
            variant: "ghost",
            size: "sm",
            icon: "plus",
            disabled: slots.length >= 49,
            onClick: addSlot,
          },
          t("habits.addSlot"),
        ),
      ),
      slots.map((slot, index) =>
        h(
          "div",
          {
            key: index,
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--tomato-line)",
              background: "var(--tomato-surface-2)",
            },
          },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 8 } },
            h(
              "span",
              { style: { fontSize: 11.5, color: "var(--tomato-ink-3)" } },
              t("habits.slotTitle", { n: index + 1 }),
            ),
            h("div", { style: { flex: 1 } }),
            slots.length > 1
              ? h(
                  Btn,
                  {
                    variant: "plain",
                    size: "sm",
                    icon: "trash",
                    onClick: () => removeSlot(index),
                  },
                  t("habits.removeSlot"),
                )
              : null,
          ),
          h(
            "div",
            { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
            ALL_DAYS.map((day) =>
              h(
                Chip,
                {
                  key: day,
                  tone: "neutral",
                  active: slot.days.includes(day),
                  onClick: () => toggleSlotDay(index, day),
                },
                weekFull[day - 1] || String(day),
              ),
            ),
          ),
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" } },
            h("span", { style: { fontSize: 12, color: "var(--tomato-ink-3)" } }, t("habits.time")),
            h(Input, {
              type: "time",
              value: slot.time,
              onChange: (value) => patchSlot(index, { time: value }),
              style: { width: 150 },
            }),
          ),
        ),
      ),
    ),
    h(
      Field,
      { label: t("habits.focusMinutes"), hint: t("habits.focusMinutesHint", { n: fmtMinutes(defaultFocus) }) },
      h(Input, {
        type: "number",
        value: focus,
        onChange: setFocus,
        placeholder: String(defaultFocus),
        style: { width: 140 },
      }),
    ),
    h(InlineError, { text: error }),
  );

  const footer = h(
    "div",
    { style: { display: "flex", alignItems: "center", gap: 9, width: "100%" } },
    editing
      ? h(
          Btn,
          {
            variant: "danger",
            size: "sm",
            icon: "trash",
            disabled: busy,
            onClick: () =>
              onRequestDelete({
                id: habitId,
                name: (habit && habit.name) || t("habits.untitled"),
              }),
          },
          t("habits.deleteHabit"),
        )
      : null,
    h("div", { style: { flex: 1 } }),
    h(Btn, { variant: "plain", size: "sm", onClick: onClose, disabled: busy }, t("common.cancel")),
    h(Btn, { variant: "primary", size: "sm", icon: "check", onClick: submit, disabled: busy }, t("common.save")),
  );

  return h(
    Modal,
    {
      open: true,
      onClose: () => {
        if (!busy) onClose();
      },
      icon: editing ? "edit" : "plus",
      title: editing ? t("habits.editHabitTitle") : t("habits.newHabitTitle"),
      subtitle: t("habits.habitDialogSubtitle"),
      width: 560,
      footer,
    },
    body,
  );
}

function VisionDialog({ mode, visionId, data, onClose, onRequestDelete }) {
  const editing = mode === "edit";
  const visions = Array.isArray(data.visions) ? data.visions : [];
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const vision = editing ? visions.find((item) => item && item.id === visionId) || null : null;

  const [name, setName] = useState(vision && typeof vision.name === "string" ? vision.name : "");
  const [projectId, setProjectId] = useState(vision && vision.projectId ? vision.projectId : "");
  const [notes, setNotes] = useState(vision && typeof vision.notes === "string" ? vision.notes : "");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    const trimmed = name.trim();
    if (trimmed.length === 0 || Array.from(trimmed).length > 40) {
      setError(t("habits.nameError"));
      return;
    }
    setBusy(true);
    setError(null);
    const result = await tryDispatch({
      type: "saveVision",
      id: editing ? visionId : null,
      name: trimmed,
      notes,
      projectId: projectId ? projectId : null,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error || t("common.writeFailed"));
      notify(result.error || t("common.writeFailed"), "danger");
      return;
    }
    notify(t("habits.visionSaved"), "brand");
    onClose();
  };

  const projectOptions = [
    { value: "", label: t("habits.totalVision") },
    ...projects.map((project) => ({ value: project.id, label: project.name || project.id })),
  ];

  const body = h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 14 } },
    h(
      Field,
      { label: t("habits.visionName") },
      h(Input, {
        value: name,
        onChange: setName,
        placeholder: t("habits.visionNamePlaceholder"),
        maxLength: 40,
        autoFocus: true,
      }),
    ),
    h(
      Field,
      { label: t("habits.visionProject") },
      h(Select, { value: projectId, options: projectOptions, onChange: setProjectId, width: "100%" }),
    ),
    h(
      Field,
      { label: t("habits.visionNotes") },
      h(TextArea, {
        value: notes,
        onChange: setNotes,
        placeholder: t("habits.visionNotesPlaceholder"),
        rows: 3,
      }),
    ),
    h(InlineError, { text: error }),
  );

  const footer = h(
    "div",
    { style: { display: "flex", alignItems: "center", gap: 9, width: "100%" } },
    editing
      ? h(
          Btn,
          {
            variant: "danger",
            size: "sm",
            icon: "trash",
            disabled: busy,
            onClick: () =>
              onRequestDelete({
                id: visionId,
                name: (vision && vision.name) || t("habits.untitled"),
              }),
          },
          t("habits.deleteVision"),
        )
      : null,
    h("div", { style: { flex: 1 } }),
    h(Btn, { variant: "plain", size: "sm", onClick: onClose, disabled: busy }, t("common.cancel")),
    h(Btn, { variant: "primary", size: "sm", icon: "check", onClick: submit, disabled: busy }, t("common.save")),
  );

  return h(
    Modal,
    {
      open: true,
      onClose: () => {
        if (!busy) onClose();
      },
      icon: editing ? "edit" : "sparkle",
      title: editing ? t("habits.editVisionTitle") : t("habits.newVisionTitle"),
      subtitle: t("habits.visionDialogSubtitle"),
      width: 520,
      footer,
    },
    body,
  );
}

// ---------------------------------------------------------------- 页面

function HabitsPage({ state }) {
  const [tab, setTab] = useState("habits");
  const [habitDialog, setHabitDialog] = useState(null);
  const [visionDialog, setVisionDialog] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const rawData = (state && state.data) || {};
  const habits = objectList(rawData.habits);
  const visions = objectList(rawData.visions);
  const templates = objectList(rawData.templates);
  const tasks = objectList(rawData.tasks);
  const projects = objectList(rawData.projects);
  const data = { ...rawData, habits, visions, templates, tasks, projects };
  const today = (state && state.today) || todayKey(state && state.serverTime);

  const header = h(PageHeader, {
    eyebrow: t("habits.eyebrow"),
    title: t("nav.habits"),
    subtitle: t("habits.subtitle"),
    actions: h(Segmented, {
      items: [
        { value: "habits", label: t("habits.tabHabits"), icon: "habit" },
        { value: "visions", label: t("habits.tabVisions"), icon: "sparkle" },
      ],
      value: tab,
      onChange: setTab,
    }),
  });

  if (!state) {
    return h(
      "div",
      { className: "t-root" },
      header,
      h(
        Card,
        { pad: 22 },
        h(Skeleton, { w: "36%", h: 18 }),
        h("div", { style: { height: 12 } }),
        h(Skeleton, { w: "68%" }),
        h("div", { style: { height: 10 } }),
        h(Skeleton, { w: "52%" }),
      ),
    );
  }

  const openHabit = (dialog) => {
    setVisionDialog(null);
    setDeleteConfirm(null);
    setHabitDialog(dialog);
  };

  const openVision = (dialog) => {
    setHabitDialog(null);
    setDeleteConfirm(null);
    setVisionDialog(dialog);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm || deleting) return;
    setDeleting(true);
    const action =
      deleteConfirm.kind === "habit"
        ? { type: "deleteHabit", id: deleteConfirm.id }
        : { type: "deleteVision", id: deleteConfirm.id };
    const result = await tryDispatch(action);
    setDeleting(false);
    if (!result.ok) {
      notify(result.error || t("common.writeFailed"), "danger");
      return;
    }
    setDeleteConfirm(null);
    notify(t("habits.deleted"), "neutral");
  };

  const toolbar = h(
    "div",
    { style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" } },
    h(
      "div",
      { style: { flex: 1, minWidth: 220, fontSize: 12.5, lineHeight: 1.6, color: "var(--tomato-ink-3)" } },
      tab === "habits" ? t("habits.habitsHint") : t("habits.visionsHint"),
    ),
    h(
      Btn,
      {
        variant: "primary",
        size: "md",
        icon: "plus",
        onClick: () => (tab === "habits" ? openHabit({ mode: "new" }) : openVision({ mode: "new" })),
      },
      tab === "habits" ? t("habits.newHabit") : t("habits.newVision"),
    ),
  );

  const habitContent =
    habits.length === 0
      ? h(
          Card,
          { pad: 6 },
          h(Empty, {
            icon: "habit",
            title: t("habits.emptyHabitsTitle"),
            hint: t("habits.emptyHabitsHint"),
            action: h(
              Btn,
              { variant: "soft", size: "sm", icon: "plus", onClick: () => openHabit({ mode: "new" }) },
              t("habits.firstHabit"),
            ),
          }),
        )
      : h(
          "div",
          { style: { display: "flex", flexWrap: "wrap", gap: 14, alignItems: "stretch" } },
          habits.map((habit, index) =>
            h(HabitCard, {
              key: habit.id || `habit-${index}`,
              habit,
              data,
              templates,
              tasks,
              today,
              onEdit: (id) => openHabit({ mode: "edit", habitId: id }),
              onDelete: (item) => setDeleteConfirm({ kind: "habit", id: item.id, name: item.name || t("habits.untitled") }),
            }),
          ),
        );

  const visionContent =
    visions.length === 0
      ? h(
          Card,
          { pad: 6 },
          h(Empty, {
            icon: "sparkle",
            title: t("habits.emptyVisionsTitle"),
            hint: t("habits.emptyVisionsHint"),
            action: h(
              Btn,
              { variant: "soft", size: "sm", icon: "plus", onClick: () => openVision({ mode: "new" }) },
              t("habits.firstVision"),
            ),
          }),
        )
      : h(
          "div",
          { style: { display: "flex", flexWrap: "wrap", gap: 14, alignItems: "stretch" } },
          visions.map((vision, index) =>
            h(VisionCard, {
              key: vision.id || `vision-${index}`,
              vision,
              data,
              onEdit: (id) => openVision({ mode: "edit", visionId: id }),
              onDelete: (item) => setDeleteConfirm({ kind: "vision", id: item.id, name: item.name || t("habits.untitled") }),
            }),
          ),
        );

  return h(
    "div",
    { className: "t-root" },
    header,
    toolbar,
    tab === "habits" ? habitContent : visionContent,
    habitDialog
      ? h(HabitDialog, {
          key: `${habitDialog.mode}:${habitDialog.habitId || "new"}`,
          mode: habitDialog.mode,
          habitId: habitDialog.habitId || null,
          data,
          onClose: () => setHabitDialog(null),
          onRequestDelete: (target) => {
            setHabitDialog(null);
            setDeleteConfirm({ kind: "habit", id: target.id, name: target.name });
          },
        })
      : null,
    visionDialog
      ? h(VisionDialog, {
          key: `${visionDialog.mode}:${visionDialog.visionId || "new"}`,
          mode: visionDialog.mode,
          visionId: visionDialog.visionId || null,
          data,
          onClose: () => setVisionDialog(null),
          onRequestDelete: (target) => {
            setVisionDialog(null);
            setDeleteConfirm({ kind: "vision", id: target.id, name: target.name });
          },
        })
      : null,
    deleteConfirm
      ? h(
          Modal,
          {
            open: true,
            onClose: () => {
              if (!deleting) setDeleteConfirm(null);
            },
            icon: "trash",
            title: t(deleteConfirm.kind === "habit" ? "habits.deleteHabitTitle" : "habits.deleteVisionTitle"),
            width: 420,
            footer: h(
              "div",
              { style: { display: "flex", gap: 9, marginLeft: "auto" } },
              h(
                Btn,
                { variant: "ghost", size: "sm", onClick: () => setDeleteConfirm(null), disabled: deleting },
                t("common.cancel"),
              ),
              h(
                Btn,
                { variant: "danger", size: "sm", icon: "trash", onClick: confirmDelete, disabled: deleting },
                t("common.delete"),
              ),
            ),
          },
          h(
            "div",
            { style: { fontSize: 13, lineHeight: 1.65, color: "var(--tomato-ink-2)" } },
            t(
              deleteConfirm.kind === "habit" ? "habits.deleteHabitBody" : "habits.deleteVisionBody",
              { name: deleteConfirm.name },
            ),
          ),
        )
      : null,
  );
}

registerPage({
  id: "habits",
  order: 30,
  icon: "habit",
  titleKey: "nav.habits",
  Component: HabitsPage,
});
