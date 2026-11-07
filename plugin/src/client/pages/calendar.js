// 页面：本周日程。周切换 + 7 列时间网格（07:00–24:00）。
//
// 这一页只读「已经占掉的时间」：教学课程/考试（来自 education）、每周固定占用
// （blocks）、固定休息时段（lock.schedules，画成条纹块）。网格里的空白处点击
// 即在该时间新建固定占用；固定占用可编辑/删除（saveBlock/deleteBlock）。
// 冲突判定是展示层的提醒：需专心的占用之间、课程/考试与需专心占用之间视为
// 冲突；水课（attention=light）与课程重叠只算「可并行」，不算冲突——与
// @tomato/core 的课表语义一致（见 packages/core/src/blocks.ts、diagnostics.ts）。
import { h, useState } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import {
  Btn,
  Card,
  Chip,
  Dot,
  Empty,
  Field,
  IconBtn,
  Input,
  Modal,
  PageHeader,
  SectionTitle,
  Select,
  TextArea,
  notify,
} from "../shared/ui.js";
import { addDays, fmtHHMM, parseHHMM, projectById, todayKey, weekStart, weekdayIndex } from "../shared/derive.js";
import { tryDispatch } from "../shared/store.js";
import { registerPage } from "../app/registry.js";
import { TaskDialog } from "./task-dialog.js";

registerCopy("calendar", {
  zh: {
    eyebrow: "WEEK AT A GLANCE",
    subtitle: "横轴星期、纵轴时间：实心块是任务，斜纹块是固定占用。",
    prev: "上一周",
    next: "下一周",
    thisWeek: "回到本周",
    summary: "{range} · 共 {items} 个时段 · {teaching} 节课/考试",
    addBlock: "添加时段",
    legendTeaching: "课程 / 考试",
    legendTask: "任务",
    legendRequired: "需专心",
    legendLight: "水课（可并行）",
    legendRest: "休息锁机",
    clickHint: "点击空白处可在该时间添加时段",
    gridEmptyAction: "添加第一个时段",
    details: "时段详情",
    detailTime: "时间",
    detailDays: "星期",
    detailProject: "项目",
    detailNotes: "备注",
    detailAttention: "状态",
    detailState: "进度",
    detailStrict: "严格模式",
    detailRestHint: "休息锁机时段在「定时锁机」页管理。",
    detailEmptyNotes: "没有备注",
    newBlockTitle: "添加固定占用",
    editBlockTitle: "编辑固定占用",
    nameLabel: "名称",
    namePlaceholder: "例如 大学英语Ⅰ",
    startLabel: "开始时间",
    endLabel: "结束时间",
    endHint: "结束早于开始表示跨午夜",
    daysLabel: "星期",
    attentionLabel: "上课状态",
    attentionRequired: "需专心（课上排任务会冲突）",
    attentionLight: "水课（可并行写作业）",
    notesLabel: "备注（可选）",
    notesPlaceholder: "例如 5B402 · 要签到",
    validationName: "请填写名称（1–40 个字符）",
    validationDays: "请至少选择一天",
    validationTime: "开始与结束需为有效的 HH:MM，且不能相同",
    saveFailed: "{error}",
    savedToast: "时段已保存",
    deletedToast: "时段已删除",
    deleteConfirmTitle: "删除这个时段？",
    deleteConfirmBody: "「{name}」会从每周日程中移除，已印出的任务不受影响。",
    deleteBlock: "删除时段",
    blocksTitle: "每周固定占用",
    blocksHint: "{n} 个",
    blocksEmptyTitle: "还没有固定占用",
    blocksEmptyHint: "把每周重复的课加进来，软件才知道哪些时间不是你的。",
    conflictsTitle: "冲突与并行",
    conflictCount: "{n} 条",
    noConflict: "没有发现时间冲突",
    conflictDay: "{day} {date}",
    conflictBlockBlock: "两个需专心的时段重叠：{a} 与 {b}（{minutes} 分钟）",
    conflictTeachingBlock: "「{a}」落在需专心的「{b}」内（{minutes} 分钟）",
    conflictTeachingTeaching: "时间重叠：「{a}」与「{b}」（{minutes} 分钟）",
    conflictRest: "休息时段「{a}」与「{b}」重叠（{minutes} 分钟）",
    parallel: "水课时段「{a}」与「{b}」重叠，可以并行安排。",
    lesson: "课程",
    exam: "考试",
    rest: "休息",
    untitled: "未命名时段",
    nextDay: "次日",
    strict: "严格",
    relaxed: "普通",
    unknownProject: "无项目",
    close: "关闭",
  },
  en: {
    eyebrow: "WEEK AT A GLANCE",
    subtitle: "Weekdays across, time down: solid blocks are tasks, hatched bands are fixed time.",
    prev: "Previous week",
    next: "Next week",
    thisWeek: "This week",
    summary: "{range} · {items} slots · {teaching} lessons/exams",
    addBlock: "Add slot",
    legendTeaching: "Lesson / exam",
    legendTask: "Task",
    legendRequired: "Needs focus",
    legendLight: "Light class (parallel OK)",
    legendRest: "Scheduled rest",
    clickHint: "Click empty space to add a slot at that time",
    gridEmptyAction: "Add first slot",
    details: "Slot details",
    detailTime: "Time",
    detailDays: "Days",
    detailProject: "Project",
    detailNotes: "Notes",
    detailAttention: "Status",
    detailState: "Progress",
    detailStrict: "Strict mode",
    detailRestHint: "Rest schedules are managed on the Scheduled lock page.",
    detailEmptyNotes: "No notes",
    newBlockTitle: "Add fixed slot",
    editBlockTitle: "Edit fixed slot",
    nameLabel: "Name",
    namePlaceholder: "e.g. College English I",
    startLabel: "Start",
    endLabel: "End",
    endHint: "An end earlier than start means it crosses midnight",
    daysLabel: "Days",
    attentionLabel: "Attention",
    attentionRequired: "Needs focus (tasks scheduled here conflict)",
    attentionLight: "Light class (can work in parallel)",
    notesLabel: "Notes (optional)",
    notesPlaceholder: "e.g. room 5B402 · attendance taken",
    validationName: "Name is required (1–40 characters)",
    validationDays: "Pick at least one day",
    validationTime: "Start and end must be valid HH:MM and differ",
    saveFailed: "{error}",
    savedToast: "Slot saved",
    deletedToast: "Slot deleted",
    deleteConfirmTitle: "Delete this slot?",
    deleteConfirmBody: "“{name}” will be removed from the weekly calendar; printed tasks are untouched.",
    deleteBlock: "Delete slot",
    blocksTitle: "Weekly fixed slots",
    blocksHint: "{n}",
    blocksEmptyTitle: "No fixed slots yet",
    blocksEmptyHint: "Add recurring classes so the calendar knows which hours are taken.",
    conflictsTitle: "Conflicts & parallel time",
    conflictCount: "{n}",
    noConflict: "No time conflicts found",
    conflictDay: "{day} {date}",
    conflictBlockBlock: "Two focus-required slots overlap: {a} and {b} ({minutes} min)",
    conflictTeachingBlock: "“{a}” falls inside focus-required “{b}” ({minutes} min)",
    conflictTeachingTeaching: "Overlapping schedule: “{a}” and “{b}” ({minutes} min)",
    conflictRest: "Rest “{a}” overlaps “{b}” ({minutes} min)",
    parallel: "Light class “{a}” overlaps “{b}”; working in parallel is fine.",
    lesson: "Lesson",
    exam: "Exam",
    rest: "Rest",
    untitled: "Untitled slot",
    nextDay: "next day",
    strict: "Strict",
    relaxed: "Normal",
    unknownProject: "No project",
    close: "Close",
  },
});

// ---------- 几何与时间 ----------

const START_MIN = 7 * 60;
const END_MIN = 24 * 60;
const SPAN = END_MIN - START_MIN;
const HOUR_PX = 60;
const GRID_H = ((END_MIN - START_MIN) / 60) * HOUR_PX;
const GUTTER_W = 58;
const HEAD_H = 46;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// derive.parseHHMM 返回「当天秒数」；网格与冲突判定统一用分钟。
function minutesOf(time) {
  const seconds = parseHHMM(time);
  return seconds === null ? null : seconds / 60;
}

/** 时间字符串 → 分钟窗口；end ≤ start 视为跨午夜（end + 1440）。 */
function bandRange(start, end) {
  const s = minutesOf(start);
  const e = minutesOf(end);
  if (s === null || e === null) return null;
  return { start: s, end: e <= s ? e + 1440 : e };
}

function overlapOf(a, b) {
  if (!a || !b) return 0;
  const value = Math.min(a.end, b.end) - Math.max(a.start, b.start);
  return value > 0 ? value : 0;
}

function fmtBand(start, end) {
  const range = bandRange(start, end);
  if (range && range.end > 1440) return `${start} – ${t("calendar.nextDay")} ${end}`;
  return `${start} – ${end}`;
}

/** 项目色 10% 底：与纸面混合成不透明色，压在下面的斜纹带不会透上来。 */
function tint(color, fallback = "var(--tomato-surface-2)") {
  return typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)
    ? `color-mix(in srgb, ${color} 10%, var(--tomato-surface))`
    : fallback;
}

function weekdayLabel(index) {
  const full = t("common.weekFull");
  return Array.isArray(full) && full[index] ? full[index] : String(index + 1);
}

// ---------- 周数据 ----------

function buildWeek(state, offset) {
  const data = (state && state.data) || {};
  const today = (state && state.today) || todayKey();
  const base = weekStart(today);
  const monday = addDays(base, offset * 7);
  const blocks = Array.isArray(data.blocks) ? data.blocks : [];
  const schedules = (data.lock && Array.isArray(data.lock.schedules) && data.lock.schedules) || [];
  const education = data.education || {};
  const lessons = Array.isArray(education.lessons) ? education.lessons : [];
  const assessments = Array.isArray(education.assessments) ? education.assessments : [];
  const allTasks = Array.isArray(data.tasks) ? data.tasks : [];
  const settings = data.settings || {};
  const focusMinutes = Math.max(1, Number(settings.focusMinutes) || 45);
  const breakMinutes = Math.max(0, Number(settings.shortBreakMinutes) || 5);
  // 课程已经由 teaching 块表示；旧版同样跳过「课程生成的专注任务」，避免同一条课出现两次。
  const lessonTaskIds = new Set(
    (Array.isArray(education.focusTasks) ? education.focusTasks : [])
      .filter((link) => link && link.kind === "lesson")
      .map((link) => link.taskId),
  );

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    const weekday = weekdayIndex(date) + 1;
    const dayStart = new Date(`${date}T00:00:00`).getTime() / 1000;
    const dayEnd = dayStart + 86400;

    const teaching = [];
    for (const lesson of lessons) {
      if (!lesson || typeof lesson.startsAt !== "number") continue;
      if (lesson.startsAt < dayStart || lesson.startsAt >= dayEnd) continue;
      const endsAt = Number(lesson.endsAt) > 0 ? Number(lesson.endsAt) : lesson.startsAt + 3600;
      teaching.push({
        kind: "lesson",
        raw: lesson,
        title: lesson.title || t("calendar.untitled"),
        projectId: lesson.projectId ?? null,
        startMin: Math.max(0, Math.floor((lesson.startsAt - dayStart) / 60)),
        endMin: Math.max(1, Math.ceil((endsAt - dayStart) / 60)),
      });
    }
    for (const exam of assessments) {
      if (!exam || exam.kind === "homework" || typeof exam.startsAt !== "number") continue;
      if (exam.startsAt < dayStart || exam.startsAt >= dayEnd) continue;
      const endsAt = Number(exam.endsAt) > 0 ? Number(exam.endsAt) : exam.startsAt + 3600;
      teaching.push({
        kind: "exam",
        raw: exam,
        title: exam.title || t("calendar.untitled"),
        projectId: exam.projectId ?? null,
        startMin: Math.max(0, Math.floor((exam.startsAt - dayStart) / 60)),
        endMin: Math.max(1, Math.ceil((endsAt - dayStart) / 60)),
      });
    }
    teaching.sort((a, b) => a.startMin - b.startMin);

    const dayBlocks = blocks
      .filter((block) => block && Array.isArray(block.days) && block.days.includes(weekday))
      .map((block) => ({ ...block, attention: block.attention === "light" ? "light" : "required" }));

    const dayRests = schedules.filter(
      (schedule) =>
        schedule &&
        schedule.enabled !== false &&
        Array.isArray(schedule.days) &&
        schedule.days.includes(weekday),
    );

    // 当天有提醒时刻的任务：实心块，高度按预计番茄 + 休息估算（旧版同款）。
    const dayTasks = allTasks
      .filter(
        (task) =>
          task &&
          task.dueDate === date &&
          task.reminderTime &&
          !lessonTaskIds.has(task.id),
      )
      .sort((a, b) => String(a.reminderTime).localeCompare(String(b.reminderTime)))
      .map((task) => {
        const startSecs = parseHHMM(task.reminderTime);
        if (startSecs === null) return null;
        const estimate = Math.max(1, Number(task.estimate) || 1);
        const focus = Math.max(1, Number(task.focusMinutes) || focusMinutes);
        const minutes = Math.max(30, estimate * focus + (estimate - 1) * breakMinutes);
        return {
          raw: task,
          title: task.title || t("calendar.untitled"),
          projectId: task.projectId ?? null,
          startMin: Math.floor(startSecs / 60),
          endMin: Math.floor(startSecs / 60) + minutes,
          completed: !!task.completed,
        };
      })
      .filter(Boolean);

    return { date, weekday, teaching, blocks: dayBlocks, rests: dayRests, tasks: dayTasks };
  });

  return { today, monday, days, data };
}

function teachingLabel(item) {
  const kind = item.kind === "exam" ? t("calendar.exam") : t("calendar.lesson");
  return `${kind} · ${item.title}`;
}

/** 冲突（红点）与并行提示（绿叶）：展示层判定，不改变 core 数据。 */
function findConflicts(days) {
  const out = [];
  const add = (dayIndex, tone, message, key) => out.push({ key, dayIndex, tone, message });

  days.forEach((day, dayIndex) => {
    const required = day.blocks.filter((block) => block.attention === "required");
    const light = day.blocks.filter((block) => block.attention === "light");
    const rangeOfBlock = (block) => bandRange(block.start, block.end);
    const rangeOfRest = (rest) => bandRange(rest.start, rest.end);

    for (let i = 0; i < day.teaching.length; i += 1) {
      const current = day.teaching[i];
      const currentRange = { start: current.startMin, end: current.endMin };
      for (let j = i + 1; j < day.teaching.length; j += 1) {
        const next = day.teaching[j];
        const minutes = overlapOf(currentRange, { start: next.startMin, end: next.endMin });
        if (minutes > 0) {
          add(
            dayIndex,
            "danger",
            t("calendar.conflictTeachingTeaching", {
              a: teachingLabel(current),
              b: teachingLabel(next),
              minutes,
            }),
            `tt:${current.raw.id}:${next.raw.id}`,
          );
        }
      }
      for (const block of required) {
        const minutes = overlapOf(currentRange, rangeOfBlock(block));
        if (minutes > 0) {
          add(
            dayIndex,
            "danger",
            t("calendar.conflictTeachingBlock", {
              a: teachingLabel(current),
              b: block.title || t("calendar.untitled"),
              minutes,
            }),
            `tb:${current.raw.id}:${block.id}`,
          );
        }
      }
      for (const rest of day.rests) {
        const minutes = overlapOf(currentRange, rangeOfRest(rest));
        if (minutes > 0) {
          add(
            dayIndex,
            "danger",
            t("calendar.conflictRest", {
              a: rest.name || t("calendar.rest"),
              b: teachingLabel(current),
              minutes,
            }),
            `tr:${current.raw.id}:${rest.id}`,
          );
        }
      }
      for (const block of light) {
        const minutes = overlapOf(currentRange, rangeOfBlock(block));
        if (minutes > 0) {
          add(
            dayIndex,
            "leaf",
            t("calendar.parallel", {
              a: block.title || t("calendar.untitled"),
              b: teachingLabel(current),
            }),
            `lt:${block.id}:${current.raw.id}`,
          );
        }
      }
    }

    for (let i = 0; i < required.length; i += 1) {
      for (let j = i + 1; j < required.length; j += 1) {
        const minutes = overlapOf(rangeOfBlock(required[i]), rangeOfBlock(required[j]));
        if (minutes > 0) {
          add(
            dayIndex,
            "danger",
            t("calendar.conflictBlockBlock", {
              a: required[i].title || t("calendar.untitled"),
              b: required[j].title || t("calendar.untitled"),
              minutes,
            }),
            `bb:${required[i].id}:${required[j].id}`,
          );
        }
      }
      for (const rest of day.rests) {
        const minutes = overlapOf(rangeOfBlock(required[i]), rangeOfRest(rest));
        if (minutes > 0) {
          add(
            dayIndex,
            "danger",
            t("calendar.conflictRest", {
              a: rest.name || t("calendar.rest"),
              b: required[i].title || t("calendar.untitled"),
              minutes,
            }),
            `br:${required[i].id}:${rest.id}`,
          );
        }
      }
    }
  });

  return out;
}

// ---------- 网格 ----------

function gridPosition(startMin, endMin) {
  const top = Math.max(startMin, START_MIN);
  const bottom = Math.min(endMin, END_MIN);
  if (bottom - top < 1) return null;
  return {
    topPct: ((top - START_MIN) / SPAN) * 100,
    heightPct: ((bottom - top) / SPAN) * 100,
    clippedStart: top > startMin,
    clippedEnd: bottom < endMin,
  };
}

function GridBand({ position, style, title, onClick, children }) {
  if (!position) return null;
  return h(
    "button",
    {
      type: "button",
      title,
      onClick: (event) => {
        event.stopPropagation();
        onClick?.();
      },
      style: {
        position: "absolute",
        left: 2,
        right: 4,
        top: `${position.topPct}%`,
        height: `${Math.max(position.heightPct, 1.4)}%`,
        minHeight: 17,
        padding: "2px 5px 2px 6px",
        borderRadius: 6,
        border: "none",
        background: "var(--tomato-surface-2)",
        fontFamily: "inherit",
        textAlign: "left",
        overflow: "hidden",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 1,
        lineHeight: 1.25,
        zIndex: 2,
        ...style,
      },
    },
    children,
  );
}

function BandText({ title, meta, color, lead, band = false }) {
  return [
    lead
      ? h(
          "span",
          {
            key: "lead",
            className: "t-mono",
            style: {
              fontSize: 9,
              lineHeight: 1.2,
              color: "var(--tomato-brand-deep)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            },
          },
          lead,
        )
      : null,
    h(
      "span",
      {
        key: "title",
        style: {
          fontSize: band ? 9.5 : 10.5,
          fontWeight: band ? 550 : 600,
          color: color || "var(--tomato-ink)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        },
      },
      title,
    ),
    meta
      ? h(
          "span",
          {
            key: "meta",
            style: {
              fontSize: band ? 9 : 9.5,
              color: "var(--tomato-ink-3)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            },
          },
          meta,
        )
      : null,
  ];
}

function WeekGrid({ week, conflicts, onSelect, onEmptyClick, onTask }) {
  const hourLabels = [];
  for (let hour = 7; hour <= 24; hour += 1) hourLabels.push(hour);

  const conflictDays = new Set(
    conflicts.filter((item) => item.tone === "danger").map((item) => item.dayIndex),
  );

  return h(
    "div",
    {
      className: "t-scroll",
      style: { overflowX: "auto", overflowY: "hidden" },
    },
    h(
      "div",
      { style: { display: "flex", minWidth: 760 } },
      // 时间轴
      h(
        "div",
        { style: { width: GUTTER_W, flex: "none", position: "relative" } },
        h("div", { style: { height: HEAD_H } }),
        h(
          "div",
          { style: { position: "relative", height: GRID_H } },
          hourLabels.map((hour) => {
            const isFirst = hour === 7;
            const isLast = hour === 24;
            return h(
              "span",
              {
                key: hour,
                className: "t-mono",
                style: {
                  position: "absolute",
                  right: 10,
                  top: `${((hour - 7) / 17) * 100}%`,
                  transform: isFirst
                    ? "none"
                    : isLast
                      ? "translateY(-100%)"
                      : "translateY(-50%)",
                  fontSize: 10.5,
                  color: "var(--tomato-ink-3)",
                  whiteSpace: "nowrap",
                },
              },
              fmtHHMM(hour * 3600),
            );
          }),
        ),
      ),
      // 七列
      ...week.days.map((day, index) => {
        const isToday = day.date === week.today;
        return h(
          "div",
          {
            key: day.date,
            style: {
              flex: 1,
              minWidth: 96,
              borderLeft: "1px solid var(--tomato-line)",
              display: "flex",
              flexDirection: "column",
            },
          },
          // 列头
          h(
            "div",
            {
              style: {
                height: HEAD_H,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                background: isToday ? "var(--tomato-brand-soft)" : "transparent",
                borderRadius: isToday ? "10px 10px 0 0" : undefined,
                position: "relative",
              },
            },
            h(
              "div",
              {
                style: {
                  fontSize: 12.5,
                  fontWeight: isToday ? 650 : 550,
                  color: isToday ? "var(--tomato-brand-deep)" : "var(--tomato-ink)",
                },
              },
              weekdayLabel(index),
            ),
            h(
              "div",
              {
                className: "t-mono",
                style: { fontSize: 10.5, color: isToday ? "var(--tomato-brand-deep)" : "var(--tomato-ink-3)" },
              },
              day.date.slice(5).replace("-", "/"),
            ),
            conflictDays.has(index)
              ? h(Dot, {
                  color: "var(--dsw-alias-state-error-primary)",
                  size: 6,
                  style: { position: "absolute", top: 6, right: 7 },
                })
              : null,
          ),
          // 网格体
          h(
            "div",
            {
              style: { position: "relative", height: GRID_H, cursor: "copy" },
              onClick: (event) => onEmptyClick?.(event, index),
            },
            hourLabels.map((hour) =>
              h("i", {
                key: hour,
                style: {
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: `${((hour - 7) / 17) * 100}%`,
                  height: 1,
                  background: hour === 24 ? "var(--tomato-line-strong)" : "var(--tomato-line)",
                  pointerEvents: "none",
                },
              }),
            ),
            // 休息锁机（条纹）
            ...day.rests.map((rest) => {
              const range = bandRange(rest.start, rest.end);
              if (!range) return null;
              const position = gridPosition(range.start, range.end);
              return h(
                GridBand,
                {
                  key: `rest:${rest.id}`,
                  position,
                  title: `${rest.name || t("calendar.rest")} · ${fmtBand(rest.start, rest.end)}`,
                  onClick: () => onSelect({ kind: "rest", item: rest }),
                  style: {
                    left: 0,
                    right: 0,
                    borderRadius: 0,
                    borderLeft: "3px solid var(--tomato-plum)",
                    background:
                      "repeating-linear-gradient(135deg, color-mix(in srgb, var(--tomato-plum) 16%, transparent) 0 5px, transparent 5px 11px)",
                    color: "var(--tomato-ink-2)",
                    zIndex: 1,
                  },
                },
                h(BandText, {
                  band: true,
                  title: rest.name || t("calendar.rest"),
                  meta: fmtBand(rest.start, rest.end),
                }),
              );
            }),
            // 固定占用
            ...day.blocks.map((block) => {
              const range = bandRange(block.start, block.end);
              if (!range) return null;
              const position = gridPosition(range.start, range.end);
              const light = block.attention === "light";
              return h(
                GridBand,
                {
                  key: `block:${block.id}:${day.date}`,
                  position,
                  title: `${block.title || t("calendar.untitled")} · ${fmtBand(block.start, block.end)}`,
                  onClick: () => onSelect({ kind: "block", item: block }),
                  // 固定占用是「底纹带」：斜纹 + 直角，和实心圆角的任务块分开。
                  style: light
                    ? {
                        left: 0,
                        right: 0,
                        borderRadius: 0,
                        borderLeft: "3px dashed var(--tomato-leaf)",
                        background: "var(--tomato-surface-2)",
                        zIndex: 1,
                      }
                    : {
                        left: 0,
                        right: 0,
                        borderRadius: 0,
                        borderLeft: "3px solid var(--tomato-brand)",
                        background:
                          "repeating-linear-gradient(135deg, color-mix(in srgb, var(--tomato-brand) 16%, transparent) 0 6px, transparent 6px 12px)",
                        zIndex: 1,
                      },
                },
                h(BandText, {
                  band: true,
                  title: block.title || t("calendar.untitled"),
                  meta: `${fmtBand(block.start, block.end)}${light ? ` · ${t("calendar.legendLight")}` : ""}`,
                  color: light ? "var(--tomato-ink-2)" : "var(--tomato-brand-deep)",
                }),
              );
            }),
            // 任务（实心块，最上层）：高度按预计番茄 + 休息估算，点击打开任务。
            ...day.tasks.map((task) => {
              const position = gridPosition(task.startMin, task.endMin);
              const project = projectById(week.data, task.projectId);
              const color = (project && project.color) || "var(--tomato-ink-3)";
              return h(
                GridBand,
                {
                  key: `task:${task.raw.id}`,
                  position,
                  title: `${task.title} · ${fmtHHMM(task.startMin * 60)}`,
                  onClick: () => onTask?.(task.raw),
                  style: {
                    borderLeft: `3px solid ${color}`,
                    background: "var(--tomato-surface)",
                    opacity: task.completed ? 0.5 : 1,
                    zIndex: 3,
                  },
                },
                h(BandText, {
                  lead: fmtHHMM(task.startMin * 60),
                  title: task.title,
                  color: "var(--tomato-ink)",
                }),
              );
            }),
            // 课程 / 考试（项目色）
            ...day.teaching.map((item) => {
              const position = gridPosition(item.startMin, item.endMin);
              const project = projectById(week.data, item.projectId);
              const color = (project && project.color) || "var(--tomato-accent)";
              const kindLabel = item.kind === "exam" ? t("calendar.exam") : t("calendar.lesson");
              const timeLabel = `${fmtHHMM(item.startMin * 60)}–${fmtHHMM(item.endMin * 60)}`;
              return h(
                GridBand,
                {
                  key: `teaching:${item.raw.id}`,
                  position,
                  title: `${kindLabel} · ${item.title} · ${timeLabel}`,
                  onClick: () => onSelect({ kind: "teaching", item }),
                  style: {
                    borderLeft: `3px solid ${color}`,
                    background: tint(color, "var(--tomato-surface-2)"),
                  },
                },
                h(BandText, {
                  lead: `${kindLabel} · ${fmtHHMM(item.startMin * 60)}`,
                  title: item.title,
                  color: "var(--tomato-ink)",
                }),
              );
            }),
          ),
        );
      }),
    ),
  );
}

function Legend() {
  const item = (key, style, label) =>
    h(
      "span",
      { key, style: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--tomato-ink-3)" } },
      h("span", {
        style: { width: 12, height: 12, borderRadius: 3, borderLeft: "3px solid", ...style },
      }),
      label,
    );
  return h(
    "div",
    { style: { display: "flex", gap: 16, flexWrap: "wrap", padding: "0 18px 12px" } },
    item("teaching", { background: "var(--tomato-surface-2)", borderLeftColor: "var(--tomato-accent)" }, t("calendar.legendTeaching")),
    item(
      "task",
      { background: "var(--tomato-surface)", borderLeftColor: "var(--tomato-ink-3)" },
      t("calendar.legendTask"),
    ),
    item(
      "required",
      {
        background:
          "repeating-linear-gradient(135deg, color-mix(in srgb, var(--tomato-brand) 26%, transparent) 0 3px, transparent 3px 6px)",
        borderLeftColor: "var(--tomato-brand)",
      },
      t("calendar.legendRequired"),
    ),
    item("light", { background: "var(--tomato-surface-2)", borderLeftColor: "var(--tomato-leaf)", borderLeftStyle: "dashed" }, t("calendar.legendLight")),
    item(
      "rest",
      {
        background:
          "repeating-linear-gradient(135deg, color-mix(in srgb, var(--tomato-plum) 22%, transparent) 0 4px, transparent 4px 8px)",
        borderLeftColor: "var(--tomato-plum)",
      },
      t("calendar.legendRest"),
    ),
  );
}

// ---------- 对话框 ----------

function DetailRow({ label, value }) {
  return h(
    "div",
    { style: { display: "flex", gap: 12, padding: "6px 0", fontSize: 13 } },
    h("span", { style: { width: 64, flex: "none", color: "var(--tomato-ink-3)" } }, label),
    h("span", { style: { color: "var(--tomato-ink)", minWidth: 0, overflowWrap: "anywhere" } }, value),
  );
}

function BlockEditor({ editor, onChange, onClose, onSave, onDelete, saving }) {
  if (!editor) return null;
  const week = t("common.weekFull");
  const weekdays = Array.isArray(week) ? week : ["1", "2", "3", "4", "5", "6", "7"];
  const toggleDay = (day) => {
    const days = editor.days.includes(day)
      ? editor.days.filter((value) => value !== day)
      : [...editor.days, day].sort((a, b) => a - b);
    onChange({ ...editor, days, error: "" });
  };
  return h(
    Modal,
    {
      open: true,
      onClose,
      icon: "calendar",
      title: editor.id ? t("calendar.editBlockTitle") : t("calendar.newBlockTitle"),
      subtitle: t("calendar.clickHint"),
      width: 520,
      footer: h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 10, width: "100%" } },
        editor.id
          ? h(Btn, { variant: "danger", size: "sm", icon: "trash", onClick: onDelete }, t("calendar.deleteBlock"))
          : null,
        h("span", { style: { flex: 1 } }),
        h(Btn, { variant: "ghost", size: "md", onClick: onClose }, t("common.cancel")),
        h(Btn, { variant: "primary", size: "md", onClick: onSave, disabled: saving }, t("common.save")),
      ),
    },
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 14 } },
      h(Field, { label: t("calendar.nameLabel") }, h(Input, {
        value: editor.title,
        autoFocus: true,
        maxLength: 40,
        placeholder: t("calendar.namePlaceholder"),
        onChange: (value) => onChange({ ...editor, title: value, error: "" }),
      })),
      h(
        "div",
        { style: { display: "flex", gap: 12 } },
        h(Field, { label: t("calendar.startLabel"), style: { flex: 1 } }, h(Input, {
          type: "time",
          value: editor.start,
          onChange: (value) => onChange({ ...editor, start: value, error: "" }),
        })),
        h(Field, { label: t("calendar.endLabel"), hint: t("calendar.endHint"), style: { flex: 1 } }, h(Input, {
          type: "time",
          value: editor.end,
          onChange: (value) => onChange({ ...editor, end: value, error: "" }),
        })),
      ),
      h(
        Field,
        { label: t("calendar.daysLabel") },
        h(
          "div",
          { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
          weekdays.map((label, index) =>
            h(
              "button",
              {
                key: label + index,
                type: "button",
                className: "t-tab",
                "data-active": editor.days.includes(index + 1),
                onClick: () => toggleDay(index + 1),
                style: {
                  height: 30,
                  padding: "0 11px",
                  borderRadius: 9,
                  border: "1px solid var(--tomato-line)",
                  background: editor.days.includes(index + 1)
                    ? "var(--tomato-brand-soft)"
                    : "var(--tomato-surface-2)",
                  color: editor.days.includes(index + 1)
                    ? "var(--tomato-brand-deep)"
                    : "var(--tomato-ink-2)",
                  fontFamily: "inherit",
                  fontSize: 12.5,
                  cursor: "pointer",
                },
              },
              label,
            ),
          ),
        ),
      ),
      h(Field, { label: t("calendar.attentionLabel") }, h(Select, {
        value: editor.attention,
        options: [
          { value: "required", label: t("calendar.attentionRequired") },
          { value: "light", label: t("calendar.attentionLight") },
        ],
        onChange: (value) => onChange({ ...editor, attention: value }),
      })),
      h(Field, { label: t("calendar.notesLabel") }, h(TextArea, {
        value: editor.notes,
        rows: 2,
        placeholder: t("calendar.notesPlaceholder"),
        onChange: (value) => onChange({ ...editor, notes: value }),
      })),
      editor.error
        ? h(
            "div",
            {
              style: {
                fontSize: 12.5,
                color: "var(--dsw-alias-state-error-primary)",
                background: "color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent)",
                border: "1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 22%, transparent)",
                borderRadius: 10,
                padding: "8px 11px",
                lineHeight: 1.5,
              },
            },
            editor.error,
          )
        : null,
    ),
  );
}

// ---------- 页面 ----------

function CalendarPage({ state }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [editor, setEditor] = useState(null);
  const [detail, setDetail] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  // 网格里的任务块点击后直接打开任务编辑框（课程/占用仍走详情面板）。
  const [taskId, setTaskId] = useState(null);

  const week = buildWeek(state, weekOffset);
  const data = week.data;
  const conflicts = findConflicts(week.days);
  const allBlocks = Array.isArray(data.blocks) ? data.blocks : [];
  const allTasks = Array.isArray(data.tasks) ? data.tasks : [];
  const taskEditing = taskId ? allTasks.find((task) => task.id === taskId) || null : null;

  const itemCount =
    week.days.reduce(
      (total, day) => total + day.blocks.length + day.rests.length + day.teaching.length,
      0,
    );
  const teachingCount = week.days.reduce((total, day) => total + day.teaching.length, 0);
  const summary = t("calendar.summary", {
    range: `${week.days[0].date.slice(5).replace("-", "/")} – ${week.days[6].date.slice(5).replace("-", "/")}`,
    items: itemCount,
    teaching: teachingCount,
  });

  const openNewBlock = (seed = {}) => {
    setEditor({
      id: null,
      title: seed.title || "",
      days: Array.isArray(seed.days) && seed.days.length ? [...seed.days] : [weekdayIndex(week.today) + 1],
      start: seed.start || "09:00",
      end: seed.end || "10:00",
      attention: seed.attention || "required",
      notes: seed.notes || "",
      error: "",
    });
  };

  const openEditBlock = (block) => {
    setDetail(null);
    setEditor({
      id: block.id,
      title: block.title || "",
      days: Array.isArray(block.days) ? [...block.days] : [],
      start: block.start || "09:00",
      end: block.end || "10:00",
      attention: block.attention === "light" ? "light" : "required",
      notes: block.notes || "",
      error: "",
    });
  };

  const saveBlock = async () => {
    if (!editor) return;
    const title = String(editor.title || "").trim();
    if (title.length === 0 || Array.from(title).length > 40) {
      setEditor({ ...editor, error: t("calendar.validationName") });
      return;
    }
    if (!Array.isArray(editor.days) || editor.days.length === 0) {
      setEditor({ ...editor, error: t("calendar.validationDays") });
      return;
    }
    const start = parseHHMM(editor.start);
    const end = parseHHMM(editor.end);
    if (start === null || end === null || editor.start === editor.end) {
      setEditor({ ...editor, error: t("calendar.validationTime") });
      return;
    }
    setSaving(true);
    const result = await tryDispatch({
      type: "saveBlock",
      id: editor.id ?? null,
      title,
      days: [...editor.days].sort((a, b) => a - b),
      start: editor.start,
      end: editor.end,
      attention: editor.attention === "light" ? "light" : "required",
      notes: String(editor.notes || ""),
    });
    setSaving(false);
    if (!result.ok) {
      setEditor({ ...editor, error: t("calendar.saveFailed", { error: result.error }) });
      return;
    }
    setEditor(null);
    notify(t("calendar.savedToast"), "brand");
  };

  const deleteBlock = async (block) => {
    if (!block) return;
    const result = await tryDispatch({ type: "deleteBlock", id: block.id });
    if (!result.ok) {
      notify(result.error, "danger");
      return;
    }
    setPendingDelete(null);
    setDetail(null);
    notify(t("calendar.deletedToast"), "brand");
  };

  const onEmptyClick = (event, dayIndex) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect || rect.height <= 0) {
      openNewBlock({ days: [dayIndex + 1] });
      return;
    }
    const y = clamp(event.clientY - rect.top, 0, rect.height);
    const raw = START_MIN + (y / rect.height) * SPAN;
    const startMin = clamp(Math.round(raw / 30) * 30, START_MIN, END_MIN - 60);
    const endMin = Math.min(startMin + 60, END_MIN - 1);
    openNewBlock({
      days: [dayIndex + 1],
      start: fmtHHMM(startMin * 60),
      end: fmtHHMM(endMin * 60),
    });
  };

  const selectItem = (entry) => setDetail(entry);

  return h(
    "div",
    { className: "t-root" },
    h(PageHeader, {
      eyebrow: t("calendar.eyebrow"),
      title: t("nav.calendar"),
      subtitle: t("calendar.subtitle"),
      actions: [
        h(Btn, {
          key: "add",
          variant: "primary",
          icon: "plus",
          onClick: () => openNewBlock({}),
        }, t("calendar.addBlock")),
      ],
    }),

    // 周切换 + 网格
    h(
      Card,
      { pad: 0, style: { overflow: "hidden" } },
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 18px 10px",
            flexWrap: "wrap",
          },
        },
        h(IconBtn, {
          name: "chevronLeft",
          title: t("calendar.prev"),
          onClick: () => setWeekOffset((value) => value - 1),
        }),
        h(
          "div",
          { style: { flex: 1, minWidth: 220 } },
          h(
            "div",
            { className: "t-mono", style: { fontSize: 13.5, fontWeight: 600, color: "var(--tomato-ink)" } },
            summary,
          ),
          h("div", { style: { fontSize: 11.5, color: "var(--tomato-ink-3)", marginTop: 2 } }, t("calendar.clickHint")),
        ),
        weekOffset !== 0
          ? h(Btn, {
              variant: "soft",
              size: "sm",
              onClick: () => setWeekOffset(0),
            }, t("calendar.thisWeek"))
          : null,
        h(IconBtn, {
          name: "chevronRight",
          title: t("calendar.next"),
          onClick: () => setWeekOffset((value) => value + 1),
        }),
      ),
      h(Legend, null),
          h(WeekGrid, {
        week,
        conflicts,
        onSelect: selectItem,
        onEmptyClick,
        onTask: (task) => setTaskId(task.id),
      }),
    ),

    // 冲突与并行
    h(
      Card,
      { style: { marginTop: 16 } },
      h(SectionTitle, {
        icon: "bell",
        title: t("calendar.conflictsTitle"),
        hint: conflicts.length ? t("calendar.conflictCount", { n: conflicts.length }) : null,
      }),
      conflicts.length === 0
        ? h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12.5,
                color: "var(--tomato-ink-2)",
                padding: "2px 0 4px",
              },
            },
            h(Dot, { color: "var(--tomato-leaf)", size: 7 }),
            t("calendar.noConflict"),
          )
        : conflicts.map((item) =>
            h(
              "div",
              {
                key: item.key,
                style: {
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 9,
                  padding: "8px 0",
                  borderTop: "1px solid var(--tomato-line)",
                },
              },
              h(Dot, {
                color:
                  item.tone === "danger"
                    ? "var(--dsw-alias-state-error-primary)"
                    : "var(--tomato-leaf)",
                size: 7,
                style: { marginTop: 6 },
              }),
              h(
                "div",
                { style: { minWidth: 0 } },
                h(
                  "div",
                  { style: { fontSize: 10.5, color: "var(--tomato-ink-3)", marginBottom: 2 } },
                  t("calendar.conflictDay", {
                    day: weekdayLabel(item.dayIndex),
                    date: week.days[item.dayIndex].date.slice(5).replace("-", "/"),
                  }),
                ),
                h(
                  "div",
                  {
                    style: {
                      fontSize: 12.5,
                      lineHeight: 1.55,
                      color:
                        item.tone === "danger"
                          ? "var(--tomato-ink)"
                          : "var(--tomato-ink-2)",
                    },
                  },
                  item.message,
                ),
              ),
            ),
          ),
    ),

    // 每周固定占用（含网格视窗外时段的入口）
    h(
      Card,
      { style: { marginTop: 16 } },
      h(SectionTitle, {
        icon: "grip",
        title: t("calendar.blocksTitle"),
        hint: t("calendar.blocksHint", { n: allBlocks.length }),
        action: h(Btn, {
          variant: "ghost",
          size: "sm",
          icon: "plus",
          onClick: () => openNewBlock({}),
        }, t("calendar.addBlock")),
      }),
      allBlocks.length === 0
        ? h(Empty, {
            icon: "calendar",
            title: t("calendar.blocksEmptyTitle"),
            hint: t("calendar.blocksEmptyHint"),
            action: h(Btn, { variant: "soft", icon: "plus", onClick: () => openNewBlock({}) }, t("calendar.gridEmptyAction")),
          })
        : allBlocks
            .slice()
            .sort(
              (a, b) =>
                (a.days && a.days[0]) - (b.days && b.days[0]) ||
                String(a.start).localeCompare(String(b.start)) ||
                String(a.title).localeCompare(String(b.title)),
            )
            .map((block) => {
              const light = block.attention === "light";
              const dayText = (Array.isArray(block.days) ? block.days : [])
                .map((day) => weekdayLabel(day - 1))
                .join(" · ");
              return h(
                "div",
                {
                  key: block.id,
                  className: "t-row",
                  style: {
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "10px 4px",
                    borderTop: "1px solid var(--tomato-line)",
                  },
                },
                h(Dot, {
                  color: light ? "var(--tomato-leaf)" : "var(--tomato-brand)",
                  size: 7,
                  style: { marginTop: 7 },
                }),
                h(
                  "div",
                  { style: { flex: 1, minWidth: 0 } },
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
                    h("span", { style: { fontSize: 13.5, fontWeight: 600, color: "var(--tomato-ink)" } }, block.title || t("calendar.untitled")),
                    h(Chip, { tone: light ? "leaf" : "brand" }, light ? t("calendar.legendLight") : t("calendar.legendRequired")),
                  ),
                  h(
                    "div",
                    { style: { fontSize: 11.5, color: "var(--tomato-ink-3)", marginTop: 3 } },
                    `${dayText} · ${fmtBand(block.start, block.end)}${block.notes ? ` · ${block.notes}` : ""}`,
                  ),
                ),
                h(IconBtn, {
                  name: "edit",
                  title: t("common.edit"),
                  onClick: () => openEditBlock(block),
                }),
                h(IconBtn, {
                  name: "trash",
                  title: t("calendar.deleteBlock"),
                  onClick: () => setPendingDelete(block),
                }),
              );
            }),
    ),

    // 任务块 → 任务编辑框
    h(TaskDialog, {
      open: !!taskEditing,
      task: taskEditing,
      today: week.today,
      projects: Array.isArray(data.projects) ? data.projects : [],
      settings: data.settings || {},
      initialTitle: "",
      onClose: () => setTaskId(null),
    }),

    // 编辑/新建固定占用
    h(BlockEditor, {
      editor,
      saving,
      onChange: setEditor,
      onClose: () => setEditor(null),
      onSave: saveBlock,
      onDelete: () => {
        if (editor && editor.id) {
          const source = allBlocks.find((block) => block.id === editor.id);
          if (source) {
            setEditor(null);
            setPendingDelete(source);
          }
        }
      },
    }),

    // 详情
    detail
      ? h(
          Modal,
          {
            open: true,
            onClose: () => setDetail(null),
            icon:
              detail.kind === "teaching"
                ? detail.item.kind === "exam"
                  ? "calendar"
                  : "education"
                : detail.kind === "rest"
                  ? "moon"
                  : "calendar",
            title:
              detail.kind === "teaching"
                ? `${detail.item.kind === "exam" ? t("calendar.exam") : t("calendar.lesson")} · ${detail.item.title}`
                : detail.kind === "rest"
                  ? detail.item.name || t("calendar.rest")
                  : detail.item.title || t("calendar.untitled"),
            subtitle: t("calendar.details"),
            width: 480,
            footer: h(
              "div",
              { style: { display: "flex", gap: 10, justifyContent: "flex-end", width: "100%" } },
              detail.kind === "block"
                ? h(Btn, {
                    variant: "danger",
                    size: "sm",
                    icon: "trash",
                    onClick: () => {
                      setPendingDelete(detail.item);
                      setDetail(null);
                    },
                  }, t("calendar.deleteBlock"))
                : null,
              detail.kind === "block"
                ? h(Btn, {
                    variant: "primary",
                    size: "md",
                    icon: "edit",
                    onClick: () => openEditBlock(detail.item),
                  }, t("common.edit"))
                : null,
              h(Btn, { variant: "ghost", size: "md", onClick: () => setDetail(null) }, t("calendar.close")),
            ),
          },
          detail.kind === "teaching"
            ? [
                h(DetailRow, {
                  key: "kind",
                  label: t("calendar.detailAttention"),
                  value: detail.item.kind === "exam" ? t("calendar.exam") : t("calendar.lesson"),
                }),
                h(DetailRow, {
                  key: "project",
                  label: t("calendar.detailProject"),
                  value:
                    (projectById(data, detail.item.projectId) || {}).name || t("calendar.unknownProject"),
                }),
                h(DetailRow, {
                  key: "date",
                  label: t("calendar.detailTime"),
                  value: `${week.days.find((day) =>
                    day.teaching.some((entry) => entry.raw.id === detail.item.raw.id),
                  )?.date.slice(5).replace("-", "/") || ""} ${fmtHHMM(detail.item.startMin * 60)}–${fmtHHMM(detail.item.endMin * 60)}`,
                }),
                h(DetailRow, {
                  key: "state",
                  label: t("calendar.detailState"),
                  value:
                    detail.item.kind === "exam"
                      ? detail.item.raw.kind || ""
                      : detail.item.raw.state || "",
                }),
              ]
            : detail.kind === "rest"
              ? [
                  h(DetailRow, {
                    key: "time",
                    label: t("calendar.detailTime"),
                    value: fmtBand(detail.item.start, detail.item.end),
                  }),
                  h(DetailRow, {
                    key: "days",
                    label: t("calendar.detailDays"),
                    value: (Array.isArray(detail.item.days) ? detail.item.days : [])
                      .map((day) => weekdayLabel(day - 1))
                      .join(" · "),
                  }),
                  h(DetailRow, {
                    key: "strict",
                    label: t("calendar.detailStrict"),
                    value: detail.item.strict ? t("calendar.strict") : t("calendar.relaxed"),
                  }),
                  h(
                    "div",
                    { style: { fontSize: 12, color: "var(--tomato-ink-3)", marginTop: 8, lineHeight: 1.6 } },
                    t("calendar.detailRestHint"),
                  ),
                ]
              : [
                  h(DetailRow, {
                    key: "time",
                    label: t("calendar.detailTime"),
                    value: fmtBand(detail.item.start, detail.item.end),
                  }),
                  h(DetailRow, {
                    key: "days",
                    label: t("calendar.detailDays"),
                    value: (Array.isArray(detail.item.days) ? detail.item.days : [])
                      .map((day) => weekdayLabel(day - 1))
                      .join(" · "),
                  }),
                  h(DetailRow, {
                    key: "attention",
                    label: t("calendar.detailAttention"),
                    value:
                      detail.item.attention === "light"
                        ? t("calendar.legendLight")
                        : t("calendar.legendRequired"),
                  }),
                  h(DetailRow, {
                    key: "notes",
                    label: t("calendar.detailNotes"),
                    value: detail.item.notes || t("calendar.detailEmptyNotes"),
                  }),
                ],
        )
      : null,

    // 删除确认
    pendingDelete
      ? h(
          Modal,
          {
            open: true,
            onClose: () => setPendingDelete(null),
            icon: "trash",
            title: t("calendar.deleteConfirmTitle"),
            subtitle: t("calendar.deleteConfirmBody", {
              name: pendingDelete.title || t("calendar.untitled"),
            }),
            width: 440,
            footer: h(
              "div",
              { style: { display: "flex", gap: 10, justifyContent: "flex-end", width: "100%" } },
              h(Btn, { variant: "ghost", size: "md", onClick: () => setPendingDelete(null) }, t("common.cancel")),
              h(Btn, { variant: "danger", size: "md", icon: "trash", onClick: () => deleteBlock(pendingDelete) }, t("common.delete")),
            ),
          },
          h(
            "div",
            { style: { fontSize: 12.5, color: "var(--tomato-ink-2)", lineHeight: 1.7 } },
            `${fmtBand(pendingDelete.start, pendingDelete.end)} · ${
              (Array.isArray(pendingDelete.days) ? pendingDelete.days : [])
                .map((day) => weekdayLabel(day - 1))
                .join(" · ")
            }`,
          ),
        )
      : null,
  );
}

registerPage({
  id: "calendar",
  order: 50,
  icon: "calendar",
  titleKey: "nav.calendar",
  Component: CalendarPage,
});
