// 定时锁机：快速小憩、固定休息时段与跨午夜校验。
//
// 为什么所有校验在本地先做一遍：core 的 validateLock 对「启用」时段做周分钟
// 占位重叠检查，但它的错误信息是统一的；表单里提前算一遍能指出和哪条冲突，
// 而写操作仍然交给 core 复核——页面不绕过任何保护规则。
import { h, useState } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import {
  PageHeader,
  Card,
  Btn,
  IconBtn,
  Chip,
  Badge,
  Toggle,
  Input,
  Field,
  Modal,
  Empty,
  Skeleton,
  SectionTitle,
  Bar,
  notify,
} from "../shared/ui.js";
import { useSnapshot, tryDispatch } from "../shared/store.js";
import { parseHHMM, fmtHHMM, fmtClock, fmtMinutes } from "../shared/derive.js";
import { registerPage } from "../app/registry.js";

registerCopy("schedule", {
  zh: {
    eyebrow: "番茄 Todo",
    title: "定时锁机",
    subtitle: "到点全屏休息：不侵占专注时长，结束自动解除。",
    refresh: "刷新",
    activeTitle: "进行中的锁机",
    activeWindow: "{start} – {end}",
    activeStrict: "严格",
    activeStrictHint: "严格模式下不能提前结束，到点自动解除。",
    activeHint: "锁机期间不能修改任务或计时；到点自动解除。",
    unnamed: "未命名时段",
    total: "共 {time}",
    quickTitle: "现在休息一会儿",
    quickHint:
      "会立即锁屏，结束时自动解除；小憩不计入专注时长、不生成专注记录。",
    quickMinutes: "时长（分钟）",
    quickCustomPlaceholder: "自定义 1–720",
    unit: "分钟",
    quickInvalid: "请输入 1–720 的整数分钟",
    quickStrictLabel: "严格模式",
    quickStrictHint: "开始后不能提前结束，只能等小憩结束。",
    quickStart: "立即开始",
    quickRunning: "已有锁机进行中，结束后才能开始新的。",
    quickStarted: "已开始 {n} 分钟小憩。",
    schedulesTitle: "固定休息时段",
    schedulesHint: "启用后按周历到点触发",
    addSchedule: "添加时段",
    editSchedule: "编辑时段",
    deleteSchedule: "删除时段",
    enabledOn: "已启用",
    enabledOff: "已停用",
    nextDay: "次日 {time}",
    strictChip: "严格",
    scheduleEmpty: "还没有固定休息时段",
    scheduleEmptyHint: "例如「睡眠 22:00–次日 07:00，周一至周日，严格模式」。",
    dialogNew: "添加休息时段",
    dialogEdit: "编辑休息时段",
    dialogSubtitle: "到点自动全屏休息；跨午夜时让结束时间早于开始时间。",
    nameLabel: "名称",
    namePlaceholder: "例如：睡眠",
    startLabel: "开始",
    endLabel: "结束",
    daysLabel: "星期",
    strictLabel: "严格模式",
    strictHint: "严格模式下不能提前结束。",
    enabledLabel: "启用",
    enabledHint: "只有启用的时段参与重叠校验与到点触发。",
    errName: "名称需为 1–40 个字符",
    errTime: "时间需为有效的 HH:MM",
    errSameTime: "开始与结束不能相同；跨午夜请让结束早于开始",
    errDays: "请选择不重复的星期（周一为 1，周日为 7）",
    errOverlap: "与已启用的时段「{name}」重叠，请调整日期或时间",
    errLimit: "最多设置 20 个锁机时段",
    saved: "休息时段已保存",
    deleted: "休息时段已删除",
    deleteTitle: "删除休息时段？",
    deleteBody: "「{name}」删除后不再触发；进行中的锁机不受影响。",
    deleteHint: "删除后无法恢复，需要时可以重新添加。",
  },
  en: {
    eyebrow: "Tomato Todo",
    title: "Scheduled lock",
    subtitle:
      "A full-screen rest at the scheduled time: it never eats focus minutes and releases automatically.",
    refresh: "Refresh",
    activeTitle: "Lock in progress",
    activeWindow: "{start} – {end}",
    activeStrict: "Strict",
    activeStrictHint:
      "Strict mode cannot end early; it releases when the timer runs out.",
    activeHint:
      "Tasks and the timer cannot be changed during a lock; it releases automatically.",
    unnamed: "Untitled block",
    total: "{time} total",
    quickTitle: "Take a break now",
    quickHint:
      "The screen locks immediately and releases at the end; a short rest is not counted as focus time and creates no focus record.",
    quickMinutes: "Duration (minutes)",
    quickCustomPlaceholder: "Custom 1–720",
    unit: "min",
    quickInvalid: "Enter a whole number of minutes from 1 to 720",
    quickStrictLabel: "Strict mode",
    quickStrictHint:
      "Once started it cannot be ended early; wait for the rest to finish.",
    quickStart: "Start now",
    quickRunning: "A lock is already in progress; wait for it to end.",
    quickStarted: "Started a {n}-minute break.",
    schedulesTitle: "Recurring rest blocks",
    schedulesHint: "Enabled blocks trigger on the weekly calendar",
    addSchedule: "Add block",
    editSchedule: "Edit block",
    deleteSchedule: "Delete block",
    enabledOn: "Enabled",
    enabledOff: "Disabled",
    nextDay: "next day {time}",
    strictChip: "Strict",
    scheduleEmpty: "No recurring rest blocks yet",
    scheduleEmptyHint:
      "For example: “Sleep 22:00–next day 07:00, Monday to Sunday, strict mode”.",
    dialogNew: "Add a rest block",
    dialogEdit: "Edit rest block",
    dialogSubtitle:
      "It locks the screen at the scheduled time; for an overnight block, make the end earlier than the start.",
    nameLabel: "Name",
    namePlaceholder: "e.g. Sleep",
    startLabel: "Start",
    endLabel: "End",
    daysLabel: "Days",
    strictLabel: "Strict mode",
    strictHint: "Strict mode cannot end early.",
    enabledLabel: "Enabled",
    enabledHint:
      "Only enabled blocks join overlap checks and trigger at their time.",
    errName: "The name must be 1–40 characters",
    errTime: "Both times must be valid HH:MM",
    errSameTime:
      "Start and end cannot be the same; for an overnight block, end earlier than start",
    errDays:
      "Pick at least one non-duplicate weekday (Monday is 1, Sunday is 7)",
    errOverlap:
      "It overlaps the enabled block “{name}”; adjust the days or times",
    errLimit: "At most 20 lock blocks",
    saved: "Rest block saved",
    deleted: "Rest block deleted",
    deleteTitle: "Delete this rest block?",
    deleteBody:
      "“{name}” will stop triggering; a lock already in progress is unaffected.",
    deleteHint: "This cannot be undone; you can add it again if needed.",
  },
});

const QUICK_MINUTES = [2, 5, 10, 25, 60];
const WEEK_MINUTES = 7 * 1440;

/** Unix 秒 → 本地 HH:MM（锁机状态卡用）。 */
function clockOf(ts) {
  const d = new Date(Number(ts) * 1000);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function newScheduleId() {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
  } catch {
    /* 非浏览器环境或权限受限时走回退 */
  }
  return "s-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

/** 只取 LockSchedule 的已知字段，避免把界面状态（isNew）写进 Action。 */
function schedulePayload(schedule, overrides) {
  return {
    id: schedule.id,
    name: schedule.name,
    start: schedule.start,
    end: schedule.end,
    days: Array.isArray(schedule.days) ? schedule.days.slice() : [],
    enabled: !!schedule.enabled,
    strict: !!schedule.strict,
    ...overrides,
  };
}

/** parseHHMM 给的是当天秒数，周占位数组的单位是分钟。 */
function minutesOfDay(text) {
  const seconds = parseHHMM(text);
  return seconds === null ? null : seconds / 60;
}

/**
 * 与 core lock.ts 同算法：把已启用时段铺进一周分钟数组，逐分钟检查候选是否撞车。
 * 停用的候选不参与检查（core 同样只校验 enabled）。
 */
function overlapOwner(candidate, schedules) {
  const owners = new Array(WEEK_MINUTES).fill(null);
  for (const schedule of schedules) {
    if (!schedule || !schedule.enabled || schedule.id === candidate.id)
      continue;
    const start = minutesOfDay(schedule.start);
    const end = minutesOfDay(schedule.end);
    if (start === null || end === null || start === end) continue;
    const duration = (end + 1440 - start) % 1440;
    const days = Array.isArray(schedule.days) ? schedule.days : [];
    for (const day of days) {
      if (!Number.isInteger(day) || day < 1 || day > 7) continue;
      for (let offset = 0; offset < duration; offset += 1) {
        owners[((day - 1) * 1440 + start + offset) % WEEK_MINUTES] = schedule;
      }
    }
  }
  const start = minutesOfDay(candidate.start);
  const end = minutesOfDay(candidate.end);
  if (start === null || end === null || start === end) return null;
  const duration = (end + 1440 - start) % 1440;
  for (const day of candidate.days) {
    for (let offset = 0; offset < duration; offset += 1) {
      const owner = owners[((day - 1) * 1440 + start + offset) % WEEK_MINUTES];
      if (owner) return owner;
    }
  }
  return null;
}

/** 保存前本地校验：返回 {value} 或 {error}；error 已翻译，直接显示。 */
function validateSchedule(form, schedules) {
  const name = String(form.name ?? "").trim();
  const nameLength = Array.from(name).length;
  if (nameLength < 1 || nameLength > 40)
    return { error: t("schedule.errName") };

  const startSecs = parseHHMM(form.start);
  const endSecs = parseHHMM(form.end);
  if (startSecs === null || endSecs === null)
    return { error: t("schedule.errTime") };
  if (startSecs === endSecs) return { error: t("schedule.errSameTime") };

  const rawDays = Array.isArray(form.days) ? form.days : [];
  const days = [];
  const seen = new Set();
  for (const raw of rawDays) {
    const day = Number(raw);
    if (!Number.isInteger(day) || day < 1 || day > 7) continue;
    if (seen.has(day)) continue;
    seen.add(day);
    days.push(day);
  }
  if (days.length === 0 || days.length !== rawDays.length) {
    return { error: t("schedule.errDays") };
  }
  days.sort((a, b) => a - b);

  const isNew = !schedules.some(
    (schedule) => schedule && schedule.id === form.id,
  );
  if (isNew && schedules.length >= 20) return { error: t("schedule.errLimit") };

  const value = schedulePayload(
    {
      id:
        typeof form.id === "string" && form.id !== ""
          ? form.id
          : newScheduleId(),
      name,
      start: fmtHHMM(startSecs),
      end: fmtHHMM(endSecs),
      days,
      enabled: form.enabled,
      strict: form.strict,
    },
    {},
  );

  if (value.enabled) {
    const owner = overlapOwner(value, schedules);
    if (owner) {
      return {
        error: t("schedule.errOverlap", {
          name: owner.name || t("schedule.unnamed"),
        }),
      };
    }
  }
  return { value };
}

function ScheduleRow({ schedule, weekNames, onToggle, onEdit, onDelete }) {
  const days = Array.isArray(schedule.days)
    ? schedule.days.filter(
        (day) => Number.isInteger(day) && day >= 1 && day <= 7,
      )
    : [];
  const startSecs = parseHHMM(schedule.start);
  const endSecs = parseHHMM(schedule.end);
  const overnight =
    startSecs !== null && endSecs !== null && endSecs <= startSecs;
  const startText =
    typeof schedule.start === "string" && schedule.start !== ""
      ? schedule.start
      : "—";
  const endText =
    typeof schedule.end === "string" && schedule.end !== ""
      ? schedule.end
      : "—";
  return h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        padding: "12px 14px",
        borderRadius: 12,
        background: "var(--tomato-surface-2)",
      },
    },
    h(
      "div",
      { style: { flex: "1 1 240px", minWidth: 0 } },
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
        h(
          "span",
          {
            style: {
              fontSize: 13.5,
              fontWeight: 620,
              color: "var(--tomato-ink)",
              wordBreak: "break-word",
            },
          },
          schedule.name || t("schedule.unnamed"),
        ),
        schedule.strict
          ? h(Chip, { tone: "sun" }, t("schedule.strictChip"))
          : null,
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: 7,
            flexWrap: "wrap",
          },
        },
        days.length > 0
          ? days.map((day) =>
              h(
                Chip,
                { key: day },
                Array.isArray(weekNames) && weekNames[day - 1]
                  ? weekNames[day - 1]
                  : String(day),
              ),
            )
          : h(Chip, { key: "none" }, t("common.none")),
        h(
          "span",
          {
            className: "t-mono",
            style: {
              fontSize: 12,
              color: "var(--tomato-ink-2)",
              marginLeft: 5,
            },
          },
          overnight
            ? `${startText} → ${t("schedule.nextDay", { time: endText })}`
            : `${startText} → ${endText}`,
        ),
      ),
    ),
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginLeft: "auto",
        },
      },
      h(
        "span",
        { style: { fontSize: 11.5, color: "var(--tomato-ink-3)" } },
        schedule.enabled ? t("schedule.enabledOn") : t("schedule.enabledOff"),
      ),
      h(Toggle, {
        checked: !!schedule.enabled,
        onChange: (value) => onToggle(schedule, value),
      }),
      h(IconBtn, {
        name: "edit",
        title: t("schedule.editSchedule"),
        onClick: () => onEdit(schedule),
      }),
      h(IconBtn, {
        name: "trash",
        title: t("schedule.deleteSchedule"),
        onClick: () => onDelete(schedule),
      }),
    ),
  );
}

function ScheduleSkeleton() {
  return h(
    "div",
    { className: "t-root" },
    h(PageHeader, {
      eyebrow: t("schedule.eyebrow"),
      title: t("schedule.title"),
      subtitle: t("schedule.subtitle"),
    }),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 18 } },
      h(
        Card,
        null,
        h(Skeleton, { w: "32%", h: 15 }),
        h(Skeleton, { w: "64%", h: 12, style: { marginTop: 14 } }),
        h(Skeleton, { w: "48%", h: 12, style: { marginTop: 8 } }),
        h(Skeleton, { w: 130, h: 34, r: 11, style: { marginTop: 16 } }),
      ),
      h(
        Card,
        null,
        h(Skeleton, { w: "42%", h: 15 }),
        h(Skeleton, { w: "100%", h: 64, r: 12, style: { marginTop: 14 } }),
        h(Skeleton, { w: "100%", h: 64, r: 12, style: { marginTop: 10 } }),
      ),
    ),
  );
}

export function SchedulePage({ refresh }) {
  const state = useSnapshot();
  const [quickMinutes, setQuickMinutes] = useState(5);
  const [custom, setCustom] = useState(false);
  const [customText, setCustomText] = useState("");
  const [strict, setStrict] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState(null);

  if (state === null) return h(ScheduleSkeleton, null);

  const data = state.data || {};
  const lock = data.lock && typeof data.lock === "object" ? data.lock : {};
  const schedules = Array.isArray(lock.schedules) ? lock.schedules : [];
  const active =
    lock.active && typeof lock.active === "object" ? lock.active : null;
  const now =
    typeof state.serverTime === "number" && Number.isFinite(state.serverTime)
      ? state.serverTime
      : Date.now() / 1000;
  const weekFull = t("common.weekFull");
  const weekNames = Array.isArray(weekFull) ? weekFull : [];

  const effectiveMinutes = custom ? Number(customText) : quickMinutes;
  const quickValid =
    Number.isInteger(effectiveMinutes) &&
    effectiveMinutes >= 1 &&
    effectiveMinutes <= 720;

  const remainingSecs = active ? Math.max(0, Number(active.endsAt) - now) : 0;
  const activeTotal = active
    ? Math.max(0, Number(active.endsAt) - Number(active.startedAt))
    : 0;
  const activeProgress =
    activeTotal > 0
      ? Math.max(0, Math.min(1, (now - Number(active.startedAt)) / activeTotal))
      : 0;
  const activeName =
    active && typeof active.name === "string" && active.name !== ""
      ? active.name
      : t("schedule.unnamed");

  async function startQuick() {
    if (!quickValid) {
      notify(t("schedule.quickInvalid"), "danger");
      return;
    }
    const result = await tryDispatch({
      type: "startQuickLock",
      minutes: effectiveMinutes,
      strict,
    });
    if (!result.ok) {
      notify(result.error, "danger");
      return;
    }
    notify(t("schedule.quickStarted", { n: effectiveMinutes }), "brand");
  }

  async function toggleEnabled(schedule, enabled) {
    const result = await tryDispatch({
      type: "saveLockSchedule",
      schedule: schedulePayload(schedule, { enabled }),
    });
    if (!result.ok) notify(result.error, "danger");
  }

  function openNew() {
    setEditing({
      id: newScheduleId(),
      name: "",
      start: "22:00",
      end: "07:00",
      days: [1, 2, 3, 4, 5, 6, 7],
      enabled: true,
      strict: false,
      isNew: true,
    });
    setFormError("");
  }

  function openEdit(schedule) {
    setEditing({
      id: schedule.id,
      name: schedule.name ?? "",
      start: schedule.start ?? "22:00",
      end: schedule.end ?? "07:00",
      days: Array.isArray(schedule.days) ? schedule.days.slice() : [],
      enabled: !!schedule.enabled,
      strict: !!schedule.strict,
      isNew: false,
    });
    setFormError("");
  }

  function closeEditor() {
    setEditing(null);
    setFormError("");
  }

  function updateForm(patch) {
    setFormError("");
    setEditing((previous) => (previous ? { ...previous, ...patch } : previous));
  }

  function toggleDay(day) {
    setFormError("");
    setEditing((previous) => {
      if (!previous) return previous;
      const days = Array.isArray(previous.days) ? previous.days : [];
      const has = days.includes(day);
      const next = has ? days.filter((item) => item !== day) : [...days, day];
      next.sort((a, b) => a - b);
      return { ...previous, days: next };
    });
  }

  async function saveEditing() {
    if (!editing) return;
    const built = validateSchedule(editing, schedules);
    if (built.error) {
      setFormError(built.error);
      return;
    }
    const result = await tryDispatch({
      type: "saveLockSchedule",
      schedule: built.value,
    });
    if (!result.ok) {
      setFormError(result.error);
      notify(result.error, "danger");
      return;
    }
    setEditing(null);
    setFormError("");
    notify(t("schedule.saved"), "brand");
  }

  async function confirmDelete() {
    if (!deleting) return;
    const result = await tryDispatch({
      type: "deleteLockSchedule",
      id: deleting.id,
    });
    if (!result.ok) {
      notify(result.error, "danger");
      return;
    }
    setDeleting(null);
    notify(t("schedule.deleted"), "brand");
  }

  return h(
    "div",
    { className: "t-root" },
    h(PageHeader, {
      eyebrow: t("schedule.eyebrow"),
      title: t("schedule.title"),
      subtitle: t("schedule.subtitle"),
      actions: h(IconBtn, {
        name: "refresh",
        title: t("schedule.refresh"),
        onClick: () => refresh?.(),
      }),
    }),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 18 } },

      // ---- 进行中的锁机 ----
      active
        ? h(
            Card,
            {
              style: {
                border: "1px solid var(--tomato-brand)",
                background: "var(--tomato-brand-soft)",
              },
            },
            h(SectionTitle, { icon: "lock", title: t("schedule.activeTitle") }),
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                },
              },
              h(
                "div",
                { style: { flex: "1 1 220px", minWidth: 0 } },
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
                  h(
                    "span",
                    {
                      style: {
                        fontSize: 15,
                        fontWeight: 640,
                        color: "var(--tomato-ink)",
                      },
                    },
                    activeName,
                  ),
                  active.strict
                    ? h(Badge, { tone: "sun" }, t("schedule.activeStrict"))
                    : null,
                ),
                h(
                  "div",
                  {
                    className: "t-mono",
                    style: {
                      fontSize: 12,
                      color: "var(--tomato-ink-2)",
                      marginTop: 5,
                    },
                  },
                  t("schedule.activeWindow", {
                    start: clockOf(active.startedAt),
                    end: clockOf(active.endsAt),
                  }),
                ),
              ),
              h(
                "div",
                { style: { textAlign: "right" } },
                h(
                  "div",
                  {
                    className: "t-mono",
                    style: {
                      fontSize: 28,
                      fontWeight: 620,
                      color: "var(--tomato-brand-deep)",
                      lineHeight: 1.1,
                    },
                  },
                  fmtClock(remainingSecs),
                ),
                h(
                  "div",
                  {
                    style: {
                      fontSize: 11.5,
                      color: "var(--tomato-ink-3)",
                      marginTop: 2,
                    },
                  },
                  t("schedule.total", { time: fmtMinutes(activeTotal / 60) }),
                ),
              ),
            ),
            h(Bar, {
              value: activeProgress,
              height: 6,
              style: { marginTop: 14 },
            }),
            h(
              "div",
              {
                style: {
                  marginTop: 10,
                  fontSize: 12,
                  color: "var(--tomato-ink-2)",
                  lineHeight: 1.65,
                },
              },
              active.strict
                ? t("schedule.activeStrictHint")
                : t("schedule.activeHint"),
            ),
          )
        : null,

      // ---- 现在休息一会儿 ----
      h(
        Card,
        null,
        h(SectionTitle, { icon: "coffee", title: t("schedule.quickTitle") }),
        h(
          "div",
          {
            style: {
              fontSize: 12.5,
              color: "var(--tomato-ink-2)",
              lineHeight: 1.65,
              marginBottom: 12,
            },
          },
          t("schedule.quickHint"),
        ),
        h(
          "div",
          {
            style: {
              fontSize: 11.5,
              color: "var(--tomato-ink-3)",
              marginBottom: 7,
            },
          },
          t("schedule.quickMinutes"),
        ),
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
          QUICK_MINUTES.map((minutes) =>
            h(
              Chip,
              {
                key: minutes,
                tone: !custom && quickMinutes === minutes ? "brand" : "neutral",
                active: !custom && quickMinutes === minutes,
                onClick: () => {
                  setCustom(false);
                  setCustomText("");
                  setQuickMinutes(minutes);
                },
                style: { height: 28, padding: "0 11px", fontSize: 12.5 },
              },
              String(minutes),
            ),
          ),
          h(Input, {
            type: "number",
            value: customText,
            placeholder: t("schedule.quickCustomPlaceholder"),
            onChange: (value) => {
              setCustom(true);
              setCustomText(value);
            },
            style: {
              width: 140,
              border:
                custom && customText !== ""
                  ? "1px solid var(--tomato-brand)"
                  : "1px solid var(--tomato-line)",
            },
          }),
          h(
            "span",
            { style: { fontSize: 12, color: "var(--tomato-ink-3)" } },
            t("schedule.unit"),
          ),
        ),
        custom && customText !== "" && !quickValid
          ? h(
              "div",
              {
                style: {
                  marginTop: 8,
                  fontSize: 12,
                  color: "var(--dsw-alias-state-error-primary)",
                },
              },
              t("schedule.quickInvalid"),
            )
          : null,
        h(
          "div",
          { style: { marginTop: 14 } },
          h(Toggle, {
            checked: strict,
            onChange: setStrict,
            label: t("schedule.quickStrictLabel"),
            hint: t("schedule.quickStrictHint"),
          }),
        ),
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 14,
            },
          },
          h(
            Btn,
            {
              variant: "primary",
              icon: "play",
              disabled: !!active || !quickValid,
              onClick: startQuick,
            },
            t("schedule.quickStart"),
          ),
          active
            ? h(
                "span",
                { style: { fontSize: 12, color: "var(--tomato-ink-3)" } },
                t("schedule.quickRunning"),
              )
            : null,
        ),
      ),

      // ---- 固定休息时段 ----
      h(
        Card,
        null,
        h(SectionTitle, {
          icon: "calendarClock",
          title: t("schedule.schedulesTitle"),
          hint: t("schedule.schedulesHint"),
          action: h(
            Btn,
            { size: "sm", variant: "soft", icon: "plus", onClick: openNew },
            t("schedule.addSchedule"),
          ),
        }),
        schedules.length === 0
          ? h(Empty, {
              icon: "moon",
              title: t("schedule.scheduleEmpty"),
              hint: t("schedule.scheduleEmptyHint"),
              action: h(
                Btn,
                { variant: "primary", icon: "plus", onClick: openNew },
                t("schedule.addSchedule"),
              ),
            })
          : h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: 10 } },
              schedules.map((schedule) =>
                h(ScheduleRow, {
                  key: schedule.id,
                  schedule,
                  weekNames,
                  onToggle: toggleEnabled,
                  onEdit: openEdit,
                  onDelete: setDeleting,
                }),
              ),
            ),
      ),
    ),

    // ---- 添加 / 编辑对话框 ----
    h(
      Modal,
      {
        open: editing !== null,
        onClose: closeEditor,
        icon: "moon",
        title:
          editing && editing.isNew
            ? t("schedule.dialogNew")
            : t("schedule.dialogEdit"),
        subtitle: t("schedule.dialogSubtitle"),
        footer: h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 8,
              width: "100%",
            },
          },
          h(
            Btn,
            { variant: "ghost", onClick: closeEditor },
            t("common.cancel"),
          ),
          h(
            Btn,
            { variant: "primary", icon: "check", onClick: saveEditing },
            t("common.save"),
          ),
        ),
      },
      editing
        ? h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: 14 } },
            h(
              Field,
              { label: t("schedule.nameLabel") },
              h(Input, {
                value: editing.name,
                placeholder: t("schedule.namePlaceholder"),
                onChange: (value) => updateForm({ name: value }),
                autoFocus: true,
              }),
            ),
            h(
              "div",
              { style: { display: "flex", gap: 12, flexWrap: "wrap" } },
              h(
                Field,
                {
                  label: t("schedule.startLabel"),
                  style: { flex: "1 1 130px" },
                },
                h(Input, {
                  type: "time",
                  value: editing.start,
                  onChange: (value) => updateForm({ start: value }),
                }),
              ),
              h(
                Field,
                { label: t("schedule.endLabel"), style: { flex: "1 1 130px" } },
                h(Input, {
                  type: "time",
                  value: editing.end,
                  onChange: (value) => updateForm({ end: value }),
                }),
              ),
            ),
            h(
              Field,
              { label: t("schedule.daysLabel") },
              h(
                "div",
                { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
                weekNames.map((label, index) => {
                  const day = index + 1;
                  const selected =
                    Array.isArray(editing.days) && editing.days.includes(day);
                  return h(
                    Chip,
                    {
                      key: day,
                      tone: selected ? "brand" : "neutral",
                      active: selected,
                      onClick: () => toggleDay(day),
                      style: { height: 28, padding: "0 10px", fontSize: 12 },
                    },
                    label,
                  );
                }),
              ),
            ),
            h(Toggle, {
              checked: !!editing.strict,
              onChange: (value) => updateForm({ strict: value }),
              label: t("schedule.strictLabel"),
              hint: t("schedule.strictHint"),
            }),
            h(Toggle, {
              checked: !!editing.enabled,
              onChange: (value) => updateForm({ enabled: value }),
              label: t("schedule.enabledLabel"),
              hint: t("schedule.enabledHint"),
            }),
            formError
              ? h(
                  "div",
                  {
                    style: {
                      fontSize: 12,
                      color: "var(--dsw-alias-state-error-primary)",
                      lineHeight: 1.6,
                      wordBreak: "break-word",
                    },
                  },
                  formError,
                )
              : null,
          )
        : null,
    ),

    // ---- 删除确认 ----
    h(
      Modal,
      {
        open: deleting !== null,
        onClose: () => setDeleting(null),
        icon: "trash",
        title: t("schedule.deleteTitle"),
        subtitle: deleting
          ? t("schedule.deleteBody", {
              name:
                typeof deleting.name === "string" && deleting.name !== ""
                  ? deleting.name
                  : t("schedule.unnamed"),
            })
          : undefined,
        footer: h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 8,
              width: "100%",
            },
          },
          h(
            Btn,
            { variant: "ghost", onClick: () => setDeleting(null) },
            t("common.cancel"),
          ),
          h(
            Btn,
            { variant: "danger", icon: "trash", onClick: confirmDelete },
            t("common.delete"),
          ),
        ),
      },
      deleting
        ? h(
            "div",
            {
              style: {
                fontSize: 12.5,
                color: "var(--tomato-ink-3)",
                lineHeight: 1.65,
              },
            },
            t("schedule.deleteHint"),
          )
        : null,
    ),
  );
}

registerPage({
  id: "schedule",
  order: 80,
  icon: "calendarClock",
  titleKey: "nav.schedule",
  Component: SchedulePage,
});
