// 沉浸式专注：开始专注后的全屏界面（Legacy 2a/2b，SKIN.md 4.4）。
//
// 视觉：同一套纸色压暗一档的暖色渐层 + 极慢呼吸光斑，中央巨型等宽计时；不做
// 玻璃拟态与霓虹，保持「纸与光」的夜读感。所有状态都从快照派生，写入只走
// tryDispatch（保护/严格模式语义以 @tomato/core 为唯一权威，这里不绕过）。
//
// 打开/关闭是模块级信号：overlay 宿主只渲染 <Immersive/>，HUD/Dock/主视图的
// 开始按钮都调用 openImmersive()；计时结束或被停止时本组件自动关闭。
// ESC 不直接退出（严格模式下需要用户明确确认），右下角 minimize 可退出沉浸。
import { h, useState, useEffect, useRef } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import { Icon } from "../shared/icons.js";
import { Btn, Chip, IconBtn, Dropdown, Modal, notify } from "../shared/ui.js";
import { useSnapshot, tryDispatch } from "../shared/store.js";
import {
  timerView,
  fmtClock,
  fmtHHMM,
  parseHHMM,
  todayKey,
  dayKey,
  weekdayIndex,
  taskById,
  protectionView,
  toMinutes,
} from "../shared/derive.js";
import { setDesktopFullscreen } from "../shared/api.js";
import { navigate } from "./navigation.js";
import { useAmbience, ensureAudio } from "./sound.js";

registerCopy("imm", {
  zh: {
    title: "要结束这一轮专注吗？",
    detail:
      "本轮已做完，就提前完成这颗番茄并进入休息，专注时长按实际用时记录；任务仍需手动勾选完成。临时中断请选择「结束并解锁」，本轮不计为完整番茄。",
    typeHint: "输入「结束专注」确认中断",
    confirmPhrase: "结束专注",
    back: "再坚持一下",
    earlyComplete: "提前完成",
    interrupt: "结束并解锁",
    noTimeHint: "还没有专注用时，再坚持一下就能提前完成。",
    strictWarning:
      "严格模式生效中：计时结束前不能提前完成或退出，到时自动解除。",
    badgeWhitelist: "应用白名单保护中",
    badgeLock: "界面锁定中",
    badgeBreakLock: "休息锁机中",
    badgeFree: "自由专注",
    badgeRest: "休息中",
    onlyThis: "此刻，只做这一件事。",
    allowHint: "允许使用 {n} 个应用，其他应用会被切回",
    cycle: "第 {n} / {total} 个番茄",
    schedule: "查看今天日程",
    agendaTitle: "今天 · 日程",
    agendaSubtitle: "{date} · 现在 {time}",
    agendaNowTask: "当前专注：{title}",
    agendaEmpty: "今天没有排定的日程。",
    agendaUntitled: "未命名",
    agendaBlock: "固定占用",
    agendaLesson: "课程",
    agendaExam: "考试",
    agendaTask: "任务",
    agendaRequired: "需专心",
    agendaLight: "水课",
    agendaDone: "已完成",
    agendaOpenFull: "打开完整本周日程",
    agendaClose: "回到专注",
    sound: "选择背景音",
    endEarly: "有急事，提前结束",
    exit: "退出沉浸模式",
    pause: "暂停一下",
    paused: "已暂停",
    resume: "继续专注",
    resumeRest: "继续休息",
    skipRest: "结束休息",
    restHint: "起来走走，喝口水。",
    restMinutes: "这一轮休息 {n} 分钟",
    focusLabel: "专注",
    notifyCompleted: "这一颗番茄完成了，去休息一下",
    notifyInterrupted: "本轮已中断，时长按实际记录",
    notifyRestEnded: "休息结束，准备好再开始",
  },
  en: {
    title: "End this focus round?",
    detail:
      "If the round is done, complete the pomodoro early and take the break; focus time is recorded as actually spent. The task still needs a manual check. For a temporary interruption choose “End and unlock” — the round won't count as a full pomodoro.",
    typeHint: "Type “end focus” to confirm the interruption",
    confirmPhrase: "end focus",
    back: "Keep going",
    earlyComplete: "Complete early",
    interrupt: "End and unlock",
    noTimeHint:
      "No focus time yet — a little longer and you can complete it early.",
    strictWarning:
      "Strict mode is on: you can't finish or leave early until the timer ends.",
    badgeWhitelist: "App whitelist active",
    badgeLock: "Screen locked",
    badgeBreakLock: "Break lock active",
    badgeFree: "Free focus",
    badgeRest: "On a break",
    onlyThis: "Just this one thing, right now.",
    allowHint: "{n} apps allowed; others are switched away",
    cycle: "Pomodoro {n} of {total}",
    schedule: "Today's schedule",
    agendaTitle: "Today · schedule",
    agendaSubtitle: "{date} · now {time}",
    agendaNowTask: "Focusing on: {title}",
    agendaEmpty: "Nothing scheduled for today.",
    agendaUntitled: "Untitled",
    agendaBlock: "Fixed block",
    agendaLesson: "Lesson",
    agendaExam: "Exam",
    agendaTask: "Task",
    agendaRequired: "Needs focus",
    agendaLight: "Light class",
    agendaDone: "Done",
    agendaOpenFull: "Open the full week",
    agendaClose: "Back to focus",
    sound: "Ambient sound",
    endEarly: "Something urgent — end early",
    exit: "Leave focus mode",
    pause: "Pause",
    paused: "Paused",
    resume: "Resume focus",
    resumeRest: "Resume the break",
    skipRest: "End the break",
    restHint: "Stand up, stretch, take a breath.",
    restMinutes: "Break for {n} min",
    focusLabel: "Focus",
    notifyCompleted: "Pomodoro complete — take a breather",
    notifyInterrupted: "Round interrupted; actual time recorded",
    notifyRestEnded: "Break over — ready when you are",
  },
});

// ------------------------------------------------------------ 模块级开关信号

let openState = false;
let endTick = 0;
const listeners = new Set();

function emit() {
  for (const fn of Array.from(listeners)) {
    try {
      fn();
    } catch {
      /* 订阅者异常不影响其他订阅者 */
    }
  }
}

export function openImmersive() {
  if (openState) return;
  openState = true;
  emit();
}

export function closeImmersive() {
  if (!openState) return;
  openState = false;
  emit();
}

/** 打开沉浸层并直接弹出「结束专注」确认框（HUD 的结束本轮用）。 */
export function openEndDialog() {
  openState = true;
  endTick += 1;
  emit();
}

export function useImmersiveOpen() {
  const [open, setOpen] = useState(openState);
  useEffect(() => {
    const fn = () => setOpen(openState);
    listeners.add(fn);
    fn();
    return () => listeners.delete(fn);
  }, []);
  return open;
}

function useEndTick() {
  const [tick, setTick] = useState(endTick);
  useEffect(() => {
    const fn = () => setTick(endTick);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return tick;
}

// ---------------------------------------------------------------- 小工具

const NARROW_QUERY = 720;

function useNarrow() {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.innerWidth < NARROW_QUERY,
  );
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => setNarrow(window.innerWidth < NARROW_QUERY);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return narrow;
}

function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/** 沉浸层是「夜读」的暗暖色：纸色压暗一档，仍与皮肤同源。 */
const INK = "#fbf3e6";
const INK_2 = "#c9b7a1";
const INK_3 = "#8f7d6b";
const HAIRLINE = "#ffffff12";

// ------------------------------------------------------------ 结束确认（2b）

function EndDialog({
  strictActive,
  canEarly,
  busy,
  focusMinutes,
  mode,
  onCancel,
  onEarly,
  onInterrupt,
  onSkipRest,
}) {
  const [phrase, setPhrase] = useState("");
  const confirmed = phrase.trim() === t("imm.confirmPhrase");
  const resting = mode !== "focus";
  return h(
    Modal,
    {
      open: true,
      onClose: onCancel,
      icon: resting ? "coffee" : "clock",
      title: t("imm.title"),
      width: 500,
      footer: resting
        ? h(
            "div",
            {
              style: {
                display: "flex",
                gap: 9,
                justifyContent: "flex-end",
                width: "100%",
              },
            },
            h(Btn, { size: "md", onClick: onCancel }, t("imm.back")),
            h(
              Btn,
              {
                size: "md",
                variant: "primary",
                icon: "check",
                disabled: busy || strictActive,
                onClick: onSkipRest,
              },
              t("imm.skipRest"),
            ),
          )
        : h(
            "div",
            {
              style: {
                display: "flex",
                gap: 9,
                justifyContent: "flex-end",
                width: "100%",
                flexWrap: "wrap",
              },
            },
            h(Btn, { size: "md", onClick: onCancel }, t("imm.back")),
            h(
              Btn,
              {
                size: "md",
                variant: "soft",
                icon: "check",
                disabled: busy || strictActive || !canEarly,
                title: canEarly ? t("imm.earlyComplete") : t("imm.noTimeHint"),
                onClick: onEarly,
              },
              t("imm.earlyComplete"),
            ),
            h(
              Btn,
              {
                size: "md",
                variant: "danger",
                icon: "unlock",
                disabled: busy || strictActive || !confirmed,
                onClick: onInterrupt,
              },
              t("imm.interrupt"),
            ),
          ),
    },
    h(
      "div",
      {
        style: {
          fontSize: 12.5,
          lineHeight: 1.8,
          color: "var(--tomato-ink-2)",
        },
      },
      t("imm.detail"),
    ),
    focusMinutes > 0 && !resting
      ? h(
          "div",
          {
            style: { marginTop: 8, fontSize: 12, color: "var(--tomato-ink-3)" },
          },
          t("common.minutes", { n: focusMinutes }),
        )
      : null,
    strictActive
      ? h(
          "div",
          {
            style: {
              marginTop: 12,
              padding: "9px 12px",
              borderRadius: 10,
              background: "var(--tomato-surface-2)",
              border: "1px solid var(--tomato-line)",
              color: "var(--tomato-ink-2)",
              fontSize: 12,
              lineHeight: 1.65,
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
            },
          },
          h(Icon, {
            name: "lock",
            size: 15,
            style: { color: "var(--tomato-sun)", flex: "none", marginTop: 1 },
          }),
          t("imm.strictWarning"),
        )
      : null,
    resting
      ? null
      : h(
          "div",
          { style: { marginTop: 16 } },
          h(
            "div",
            {
              style: {
                fontSize: 11.5,
                color: "var(--tomato-ink-3)",
                marginBottom: 6,
              },
            },
            t("imm.typeHint"),
          ),
          h("input", {
            value: phrase,
            onChange: (e) => setPhrase(e.target.value),
            placeholder: t("imm.confirmPhrase"),
            autoFocus: true,
            className: "t-root t-input",
            style: { height: 38, fontSize: 13.5 },
          }),
          !canEarly
            ? h(
                "div",
                {
                  style: {
                    marginTop: 8,
                    fontSize: 11.5,
                    color: "var(--tomato-ink-3)",
                  },
                },
                t("imm.noTimeHint"),
              )
            : null,
        ),
  );
}

// ---------------------------------------------------------------- 主组件

/** 今天的日程条目：固定占用、课程/考试、带提醒时刻的任务，按开始时间排序。 */
function todayAgenda(state, atSecs) {
  const data = (state && state.data) || {};
  const today = (state && state.today) || todayKey(state && state.serverTime);
  const at =
    Number.isFinite(Number(atSecs)) && Number(atSecs) > 0
      ? Number(atSecs)
      : state && Number.isFinite(Number(state.serverTime))
        ? Number(state.serverTime)
        : Date.now() / 1000;
  const dayStart = new Date(`${today}T00:00:00`).getTime() / 1000;
  const weekday = weekdayIndex(today) + 1;
  const education = data.education || {};
  const lessonTaskIds = new Set(
    (Array.isArray(education.focusTasks) ? education.focusTasks : [])
      .filter((link) => link && link.kind === "lesson")
      .map((link) => link.taskId),
  );
  const rows = [];
  const minutesOf = (seconds) => Math.floor(Number(seconds) / 60);
  const clockOfTs = (ts) => {
    const seconds = Number(ts) - dayStart;
    return seconds >= 0 && seconds < 86400 ? fmtHHMM(seconds) : "";
  };

  for (const block of Array.isArray(data.blocks) ? data.blocks : []) {
    if (!block || !Array.isArray(block.days) || !block.days.includes(weekday))
      continue;
    const start = parseHHMM(block.start);
    const end = parseHHMM(block.end);
    if (start === null) continue;
    rows.push({
      key: `block-${block.id || block.title}-${block.start}`,
      kind: "block",
      title: block.title || t("imm.agendaUntitled"),
      startMin: minutesOf(start),
      endMin: end === null ? null : minutesOf(end),
      startLabel: fmtHHMM(start),
      endLabel: end === null ? "" : fmtHHMM(end),
      attention: block.attention === "light" ? "light" : "required",
      completed: false,
    });
  }

  for (const lesson of Array.isArray(education.lessons)
    ? education.lessons
    : []) {
    if (!lesson || typeof lesson.startsAt !== "number") continue;
    if (dayKey(lesson.startsAt) !== today) continue;
    rows.push({
      key: `lesson-${lesson.id}`,
      kind: "lesson",
      title: lesson.title || t("imm.agendaUntitled"),
      startMin: minutesOf(lesson.startsAt - dayStart),
      endMin: minutesOf(lesson.endsAt - dayStart),
      startLabel: clockOfTs(lesson.startsAt),
      endLabel: clockOfTs(lesson.endsAt),
      attended: lesson.attended === true,
      completed: false,
    });
  }

  for (const exam of Array.isArray(education.assessments)
    ? education.assessments
    : []) {
    if (!exam || exam.kind === "homework" || typeof exam.startsAt !== "number")
      continue;
    if (dayKey(exam.startsAt) !== today) continue;
    rows.push({
      key: `exam-${exam.id}`,
      kind: "exam",
      title: exam.title || t("imm.agendaUntitled"),
      startMin: minutesOf(exam.startsAt - dayStart),
      endMin: minutesOf(exam.endsAt - dayStart),
      startLabel: clockOfTs(exam.startsAt),
      endLabel: clockOfTs(exam.endsAt),
      completed: false,
    });
  }

  for (const task of Array.isArray(data.tasks) ? data.tasks : []) {
    if (!task || task.dueDate !== today || !task.reminderTime) continue;
    if (lessonTaskIds.has(task.id)) continue;
    const start = parseHHMM(task.reminderTime);
    if (start === null) continue;
    rows.push({
      key: `task-${task.id}`,
      kind: "task",
      title: task.title || t("imm.agendaUntitled"),
      startMin: minutesOf(start),
      endMin: null,
      startLabel: fmtHHMM(start),
      endLabel: "",
      completed: task.completed === true,
    });
  }

  rows.sort((a, b) => a.startMin - b.startMin);
  const nowMin = Math.max(0, Math.min(1439, minutesOf(at - dayStart)));
  return {
    today,
    nowMin,
    nowLabel: fmtHHMM(nowMin * 60),
    rows,
  };
}

/** 日程弹层里的一条：时间、类型、标题与状态。 */
function AgendaRow({ item, active }) {
  const kindLabel =
    item.kind === "block"
      ? t("imm.agendaBlock")
      : item.kind === "lesson"
        ? t("imm.agendaLesson")
        : item.kind === "exam"
          ? t("imm.agendaExam")
          : t("imm.agendaTask");
  return h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "8px 10px",
        borderRadius: 10,
        background: active
          ? "color-mix(in srgb, var(--tomato-brand-soft) 70%, transparent)"
          : undefined,
        borderBottom: "1px solid var(--tomato-line)",
      },
    },
    h(
      "div",
      {
        className: "t-mono",
        style: {
          width: 92,
          flex: "none",
          fontSize: 12,
          color: active ? "var(--tomato-brand-deep)" : "var(--tomato-ink-2)",
          fontVariantNumeric: "tabular-nums",
          paddingTop: 1,
        },
      },
      item.endLabel ? `${item.startLabel}–${item.endLabel}` : item.startLabel,
    ),
    h(
      "div",
      { style: { flex: 1, minWidth: 0 } },
      h(
        "div",
        {
          style: {
            fontSize: 13,
            color: item.completed ? "var(--tomato-ink-3)" : "var(--tomato-ink)",
            textDecoration: item.completed ? "line-through" : "none",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          },
        },
        item.title,
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            flexWrap: "wrap",
            gap: 5,
            marginTop: 3,
          },
        },
        h(Chip, { tone: "neutral" }, kindLabel),
        item.attention === "required"
          ? h(Chip, { tone: "sun" }, t("imm.agendaRequired"))
          : null,
        item.attention === "light"
          ? h(Chip, { tone: "leaf" }, t("imm.agendaLight"))
          : null,
        item.kind === "lesson" && item.attended
          ? h(Chip, { tone: "brand" }, t("imm.agendaDone"))
          : null,
        item.completed ? h(Chip, { tone: "leaf" }, t("imm.agendaDone")) : null,
      ),
    ),
  );
}

/** 沉浸层内的今日日程弹层：不结束计时，只把今天剩下的安排摊开。 */
export function AgendaDialog({
  open,
  onClose,
  onOpenFull,
  state,
  atSecs,
  task,
}) {
  if (!open) return null;
  const agenda = todayAgenda(state, atSecs);
  const nodes = [];
  let insertedNow = false;
  for (const item of agenda.rows) {
    if (!insertedNow && item.startMin > agenda.nowMin) {
      nodes.push(
        h(
          "div",
          {
            key: "now",
            style: {
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 2px",
            },
          },
          h("div", {
            style: {
              flex: 1,
              height: 1,
              background: "var(--tomato-brand)",
              opacity: 0.5,
            },
          }),
          h(
            "span",
            {
              style: {
                fontSize: 11,
                fontWeight: 600,
                color: "var(--tomato-brand-deep)",
                fontVariantNumeric: "tabular-nums",
              },
            },
            t("imm.agendaSubtitle", {
              date: agenda.today,
              time: agenda.nowLabel,
            }),
          ),
          h("div", {
            style: {
              flex: 1,
              height: 1,
              background: "var(--tomato-brand)",
              opacity: 0.5,
            },
          }),
        ),
      );
      insertedNow = true;
    }
    const active =
      item.startMin <= agenda.nowMin &&
      (item.endMin === null
        ? item.startMin + 30 > agenda.nowMin
        : item.endMin > agenda.nowMin);
    nodes.push(h(AgendaRow, { key: item.key, item, active }));
  }
  if (!insertedNow && agenda.rows.length > 0) {
    nodes.push(
      h(
        "div",
        {
          key: "now",
          style: {
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 2px",
          },
        },
        h("div", {
          style: {
            flex: 1,
            height: 1,
            background: "var(--tomato-brand)",
            opacity: 0.5,
          },
        }),
        h(
          "span",
          {
            style: {
              fontSize: 11,
              fontWeight: 600,
              color: "var(--tomato-brand-deep)",
            },
          },
          t("imm.agendaSubtitle", {
            date: agenda.today,
            time: agenda.nowLabel,
          }),
        ),
        h("div", {
          style: {
            flex: 1,
            height: 1,
            background: "var(--tomato-brand)",
            opacity: 0.5,
          },
        }),
      ),
    );
  }

  const body = h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 2 } },
    task && task.title
      ? h(
          "div",
          {
            style: {
              padding: "8px 10px 10px",
              fontSize: 12.5,
              color: "var(--tomato-brand-deep)",
            },
          },
          t("imm.agendaNowTask", { title: task.title }),
        )
      : null,
    agenda.rows.length === 0
      ? h(
          "div",
          {
            style: {
              padding: "28px 12px",
              textAlign: "center",
              fontSize: 12.5,
              color: "var(--tomato-ink-3)",
            },
          },
          t("imm.agendaEmpty"),
        )
      : nodes,
  );

  return h(
    Modal,
    {
      open,
      onClose,
      icon: "calendar",
      title: t("imm.agendaTitle"),
      subtitle: t("imm.agendaSubtitle", {
        date: agenda.today,
        time: agenda.nowLabel,
      }),
      width: 620,
      footer: h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            flexWrap: "wrap",
          },
        },
        h("div", { style: { flex: 1 } }),
        h(
          Btn,
          { variant: "ghost", size: "sm", onClick: onOpenFull },
          t("imm.agendaOpenFull"),
        ),
        h(
          Btn,
          { variant: "primary", size: "sm", onClick: onClose },
          t("imm.agendaClose"),
        ),
      ),
    },
    body,
  );
}

export function Immersive() {
  const open = useImmersiveOpen();
  const endRequest = useEndTick();
  const state = useSnapshot();
  const narrow = useNarrow();
  const ambience = useAmbience();
  const [ending, setEnding] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [soundMenu, setSoundMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const seenEndRef = useRef(endRequest);

  const view = timerView(state);
  const data = (state && state.data) || {};
  const settings = data.settings || {};
  const task = taskById(data, view.taskId);
  const protection = protectionView(state);
  const lockActive = !!(data.lock && data.lock.active);
  const forced =
    lockActive || (protection.active && protection.mode === "lock");
  const visible = open || forced;
  const now = useNow((view.running || lockActive) && visible);

  const liveRemaining = lockActive
    ? Math.max(0, Math.ceil(data.lock.active.endsAt - now / 1000))
    : view.running && typeof view.timer.deadline === "number"
      ? Math.max(0, Math.round(view.timer.deadline - now / 1000))
      : view.remainingSecs;
  const totalSecs = lockActive
    ? data.lock.active.endsAt - data.lock.active.startedAt
    : view.totalSecs;
  const progress =
    totalSecs > 0 ? Math.max(0, Math.min(1, 1 - liveRemaining / totalSecs)) : 0;
  const resting = lockActive || view.mode !== "focus";
  const focusMinutes = toMinutes(view.totalSecs - liveRemaining);
  const cycleEvery = Number(settings.longBreakEvery) || 4;
  const cycle = Number(view.cycle) || 1;

  useEffect(() => {
    if (!visible) return;
    setDesktopFullscreen(true).catch((error) => {
      notify(error.userMessage || error.message, "danger");
    });
    return () => {
      setDesktopFullscreen(false).catch((error) => {
        notify(error.userMessage || error.message, "danger");
      });
    };
  }, [visible]);

  // 计时结束 / 被停止（且不是暂停）时自动让出全屏；休息模式保留轻量界面。
  useEffect(() => {
    if (!open) return;
    if (!view.running && !view.paused) closeImmersive();
  }, [open, view.running, view.paused]);

  // HUD「结束本轮」经模块信号请求打开结束确认框。
  useEffect(() => {
    if (endRequest !== seenEndRef.current) {
      seenEndRef.current = endRequest;
      if (open) setEnding(true);
    }
  }, [endRequest, open]);

  useEffect(() => {
    if (!open) {
      setEnding(false);
      setScheduleOpen(false);
      setSoundMenu(false);
    }
  }, [open]);

  const act = async (action, done) => {
    setBusy(true);
    const res = await tryDispatch(action);
    setBusy(false);
    if (!res.ok) {
      notify(res.error || t("common.writeFailed"), "danger");
      return false;
    }
    done?.();
    return true;
  };

  const resume = async () => {
    ensureAudio();
    await act({ type: "startTimer" });
  };

  const skipRest = async () => {
    const ok = await act({ type: "skipTimer" }, () => {
      setEnding(false);
      closeImmersive();
      notify(t("imm.notifyRestEnded"), "neutral");
    });
    return ok;
  };

  const earlyComplete = () =>
    act({ type: "completeFocus" }, () => {
      setEnding(false);
      notify(t("imm.notifyCompleted"), "brand");
      // 自动进休息时保持沉浸层（轻量休息界面）；否则由自动关闭逻辑收尾。
    });

  const interrupt = () =>
    act({ type: "emergencyUnlock" }, () => {
      setEnding(false);
      closeImmersive();
      notify(t("imm.notifyInterrupted"), "neutral");
    });

  // 「查看今天日程」在沉浸层内展开：不结束计时、不退出沉浸，用户只是瞄一眼
  // 今天还剩什么；只有明确点「打开完整本周日程」才离开专注。
  const goCalendar = () => {
    setScheduleOpen(false);
    closeImmersive();
    navigate({ page: "calendar", reason: "user" });
  };

  if (!visible) return null;

  const badge = (() => {
    if (lockActive) return { icon: "moon", text: t("imm.badgeBreakLock") };
    if (protection.locked) return { icon: "lock", text: t("imm.badgeLock") };
    if (protection.focusing && protection.mode === "whitelist") {
      return { icon: "shield", text: t("imm.badgeWhitelist") };
    }
    if (protection.focusing && protection.mode === "lock") {
      return { icon: "shield", text: t("imm.badgeLock") };
    }
    if (resting) return { icon: "coffee", text: t("imm.badgeRest") };
    return { icon: "sparkle", text: t("imm.badgeFree") };
  })();

  const whitelistCount = protection.effectiveWhitelist.length;
  const showAllowHint = protection.focusing && protection.mode === "whitelist";

  const strictActive = !!(
    (data.lock && data.lock.active && data.lock.active.strict) ||
    (view.running &&
      view.mode === "focus" &&
      protection.mode !== "off" &&
      protection.strict)
  );
  const canEarly =
    !lockActive && !resting && view.remainingSecs < view.totalSecs;

  const soundKind = ambience.kind || "silent";
  const soundKindLabel =
    soundKind === "rain"
      ? t("sound.rain")
      : soundKind === "brown"
        ? t("sound.brown")
        : "";
  // 静音时显示入口名，播放中带上当前音色，一眼知道「现在在放什么」。
  const soundLabel =
    soundKindLabel === ""
      ? t("imm.sound")
      : `${t("imm.sound")} · ${soundKindLabel}`;
  const soundItems = ["rain", "brown", "silent"].map((kind) => ({
    id: kind,
    icon: kind === soundKind ? "check" : kind === "silent" ? "mute" : "sound",
    label:
      (kind === "rain"
        ? t("sound.rain")
        : kind === "brown"
          ? t("sound.brown")
          : t("sound.silent")) + (kind === soundKind ? " ·" : ""),
    onClick: () => ambience.setKind(kind),
  }));

  return h(
    "div",
    {
      className: "t-root t-fadein",
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background:
          "radial-gradient(120% 120% at 50% -18%, #3a2a20 0%, #251b14 46%, #16100c 100%)",
        color: INK,
      },
    },
    // 极慢呼吸光斑（两个不同相位；reduced-motion 由 .t-pulse 的全局规则关掉）
    h("div", {
      className: "t-pulse",
      "aria-hidden": "true",
      style: {
        position: "absolute",
        top: "-26%",
        left: "-14%",
        width: "74vmax",
        height: "74vmax",
        borderRadius: "50%",
        pointerEvents: "none",
        background: "radial-gradient(circle, #e8886c14 0%, #e8886c00 62%)",
        filter: "blur(30px)",
        animation: "t-breathe 9s ease-in-out infinite",
      },
    }),
    h("div", {
      className: "t-pulse",
      "aria-hidden": "true",
      style: {
        position: "absolute",
        right: "-18%",
        bottom: "-30%",
        width: "66vmax",
        height: "66vmax",
        borderRadius: "50%",
        pointerEvents: "none",
        background: "radial-gradient(circle, #f3d9c80d 0%, #f3d9c800 60%)",
        filter: "blur(36px)",
        animation: "t-breathe 13s ease-in-out infinite 1.6s",
      },
    }),
    // 底部极细进度：不抢计时数字的视觉重心
    h(
      "div",
      {
        "aria-hidden": "true",
        style: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 2,
          background: "#ffffff0a",
        },
      },
      h("div", {
        style: {
          height: "100%",
          width: `${progress * 100}%`,
          background: "#e8886c66",
          transition: "width 1s linear",
        },
      }),
    ),
    // 顶部状态徽章
    h(
      "div",
      {
        style: {
          position: "absolute",
          top: narrow ? 18 : 26,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 15px",
          borderRadius: 22,
          border: `1px solid ${HAIRLINE}`,
          background: "#ffffff0d",
          fontSize: 12,
          letterSpacing: ".02em",
          color: "#e8d8c2",
          maxWidth: "calc(100vw - 120px)",
          whiteSpace: "nowrap",
        },
      },
      h(Icon, { name: badge.icon, size: 14 }),
      badge.text,
    ),
    // 中央：巨型等宽计时 + 一句话 + 任务名
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: narrow ? 12 : 18,
          padding: narrow ? "0 18px" : "0 32px",
          maxWidth: 900,
          width: "100%",
          textAlign: "center",
        },
      },
      h(
        "div",
        {
          style: {
            fontSize: 11.5,
            letterSpacing: ".22em",
            textTransform: "uppercase",
            color: INK_3,
            opacity: 0.9,
          },
        },
        lockActive
          ? data.lock.active.name
          : resting
            ? t("imm.badgeRest")
            : t("imm.focusLabel"),
      ),
      h(
        "div",
        {
          className: "t-mono",
          style: {
            fontSize: "clamp(96px, 16vw, 160px)",
            fontWeight: 250,
            letterSpacing: "-.035em",
            lineHeight: 1,
            color: view.paused ? "#cbbca8" : INK,
            textShadow: "0 8px 40px #00000059",
            transition: "color .4s ease",
            fontVariantNumeric: "tabular-nums",
          },
        },
        fmtClock(liveRemaining),
      ),
      view.paused
        ? h(
            "div",
            {
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "5px 13px",
                borderRadius: 18,
                border: `1px solid ${HAIRLINE}`,
                background: "#ffffff0d",
                fontSize: 12,
                color: INK_2,
              },
            },
            h(Icon, { name: "pause", size: 13 }),
            t("imm.paused"),
          )
        : h(
            "div",
            {
              style: {
                fontSize: narrow ? 13 : 14.5,
                color: INK_2,
                letterSpacing: ".04em",
                lineHeight: 1.7,
              },
            },
            resting ? t("imm.restHint") : t("imm.onlyThis"),
          ),
      task && !resting && !lockActive
        ? h(
            "div",
            {
              style: {
                fontSize: narrow ? 16 : 20,
                fontWeight: 600,
                color: "var(--tomato-brand)",
                lineHeight: 1.45,
                maxWidth: "min(760px, 82vw)",
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              },
            },
            task.title,
          )
        : null,
      resting
        ? h(
            "div",
            { style: { fontSize: 12.5, color: INK_3 } },
            t("imm.restMinutes", { n: toMinutes(view.totalSecs) }),
          )
        : null,
      showAllowHint
        ? h(
            "div",
            { style: { fontSize: 12.5, color: INK_3, letterSpacing: ".01em" } },
            t("imm.allowHint", { n: whitelistCount }),
          )
        : null,
      view.paused
        ? h(
            Btn,
            {
              variant: "soft",
              size: "md",
              icon: "play",
              onClick: resume,
              disabled: busy,
              style: { marginTop: 4 },
            },
            resting ? t("imm.resumeRest") : t("imm.resume"),
          )
        : null,
    ),
    // 底部动作区（休息模式只留日程与结束休息）
    h(
      "div",
      {
        style: {
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: narrow ? 76 : 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: narrow ? 6 : 10,
          flexWrap: "wrap",
          width: "calc(100vw - 40px)",
        },
      },
      !forced &&
        h(
          Btn,
          {
            size: "sm",
            variant: "plain",
            icon: "calendar",
            style: {
              color: INK_2,
              background: "transparent",
              border: `1px solid ${HAIRLINE}`,
            },
            onClick: () => setScheduleOpen(true),
          },
          t("imm.schedule"),
        ),
      !resting
        ? h(
            "div",
            { style: { position: "relative", display: "inline-flex" } },
            h(
              Btn,
              {
                size: "sm",
                variant: "plain",
                icon: soundKind === "silent" ? "mute" : "sound",
                style: {
                  color: INK_2,
                  background: "transparent",
                  border: `1px solid ${HAIRLINE}`,
                },
                onClick: () => {
                  ensureAudio();
                  setSoundMenu((v) => !v);
                },
              },
              soundLabel,
            ),
            h(Dropdown, {
              open: soundMenu,
              onClose: () => setSoundMenu(false),
              items: soundItems,
              align: "left",
              width: 208,
              style: {
                top: "auto",
                bottom: "calc(100% + 8px)",
                left: "auto",
                right: 0,
              },
            }),
          )
        : null,
      lockActive
        ? h(
            Btn,
            {
              size: "sm",
              icon: "unlock",
              disabled: busy || strictActive,
              onClick: interrupt,
            },
            t("imm.interrupt"),
          )
        : !resting
          ? h(
              Btn,
              {
                size: "sm",
                variant: "plain",
                style: {
                  color: "#d8b7a2",
                  background: "transparent",
                  border: `1px solid ${HAIRLINE}`,
                },
                onClick: () => setEnding(true),
              },
              t("imm.endEarly"),
            )
          : h(
              Btn,
              {
                size: "sm",
                variant: "plain",
                icon: "check",
                style: {
                  color: INK_2,
                  background: "transparent",
                  border: `1px solid ${HAIRLINE}`,
                },
                disabled: busy || strictActive,
                title: strictActive ? t("imm.strictWarning") : undefined,
                onClick: skipRest,
              },
              t("imm.skipRest"),
            ),
    ),
    // 左下：轮次信息（安静地放，不抢焦点）
    !narrow
      ? h(
          "div",
          {
            style: {
              position: "absolute",
              left: 26,
              bottom: 30,
              fontSize: 11,
              letterSpacing: ".02em",
              color: INK_3,
            },
          },
          t("imm.cycle", { n: cycle, total: cycleEvery }),
        )
      : null,
    // 锁机不能通过关闭沉浸层离开保护界面。
    !forced &&
      h(
        "div",
        {
          style: {
            position: "absolute",
            right: narrow ? 14 : 24,
            bottom: narrow ? 16 : 24,
            display: "flex",
          },
        },
        h(IconBtn, {
          name: "minimize",
          size: 18,
          box: 36,
          title: t("imm.exit"),
          style: {
            color: INK_2,
            border: `1px solid ${HAIRLINE}`,
            background: "#ffffff0a",
            borderRadius: 12,
          },
          onClick: closeImmersive,
        }),
      ),
    h(AgendaDialog, {
      open: scheduleOpen,
      onClose: () => setScheduleOpen(false),
      onOpenFull: goCalendar,
      state,
      atSecs: Math.floor(now / 1000),
      task,
    }),
    ending
      ? h(EndDialog, {
          strictActive,
          canEarly,
          busy,
          focusMinutes,
          mode: view.mode,
          onCancel: () => setEnding(false),
          onEarly: earlyComplete,
          onInterrupt: interrupt,
          onSkipRest: skipRest,
        })
      : null,
  );
}
