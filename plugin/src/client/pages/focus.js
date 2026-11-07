// 今日专注：把「现在做什么」收敛成一屏（SKIN 4.3 / Legacy 第 2 节）。
//
// 页面只读 store 快照，写操作全部走 tryDispatch；计时、待补窗口与保护状态
// 的判定都以 @tomato/core 和 shared/derive.js 为唯一权威，这里不复制规则。
// 布局：页头 → 三张统计卡 → 上排左番茄钟 / 右今日待办 → 整行本周节奏（旧版结构）。
import { h, useState, useEffect } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import { Icon } from "../shared/icons.js";
import {
  Btn,
  Card,
  Check,
  Chip,
  Dropdown,
  Empty,
  IconBtn,
  Input,
  Kbd,
  Modal,
  PageHeader,
  ProgressDots,
  Ring,
  SectionTitle,
  Segmented,
  Stat,
  notify,
} from "../shared/ui.js";
import { useSnapshot, tryDispatch } from "../shared/store.js";
import {
  catchUpTasks,
  completedOn,
  dayLabel,
  dueTasks,
  overdueTasks,
  todayTasks,
  fmtClock,
  greeting,
  isCatchUp,
  isOverdue,
  projectById,
  projectColor,
  protectionView,
  recentDays,
  taskById,
  taskRounds,
  timerView,
  toMinutes,
  todayKey,
  weekdayIndex,
} from "../shared/derive.js";
import { registerPage } from "../app/registry.js";
import { setActivePageId } from "../app/navigation.js";
import { TaskDialog } from "./task-dialog.js";
import { SearchDialog, useSearchHotkey } from "./search.js";
import { AMBIENCE_KINDS, useAmbience } from "../app/sound.js";
import { openImmersive } from "../app/immersive.js";

registerCopy("focus", {
  zh: {
    headline: "今天，也要慢慢向前。",
    sub: "专注当下，让每一小步都有回响。",
    newTask: "新建任务",
    statFocus: "今日专注",
    statFocusHint: "给重要的事留一点时间",
    unitMinutes: "分钟",
    statDone: "完成任务",
    statDoneHint: "{n} 项待办",
    unitItems: "项",
    statStreak: "连续专注",
    statStreakHint: "小小坚持，慢慢积累",
    unitDays: "天",
    timerTitle: "我的番茄钟",
    expand: "沉浸模式",
    allTasks: "全部任务",
    weekdays: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
    modeFocus: "专注",
    modeShort: "短休息",
    modeLong: "长休息",
    stateFocusing: "专注正在发生",
    statePaused: "暂停一下，随时继续",
    stateIdle: "准备好，进入心流",
    stateBreak: "好好休息，也很重要",
    roundOf: "第 {n} / {m} 个番茄",
    freeFocus: "自由专注 · 选择一个任务",
    pickTaskTitle: "选择专注任务",
    pickTaskSubtitle: "计时进行中不能切换任务；先结束当前这一轮。",
    pickTaskSearch: "搜索未完成的任务…",
    freeFocusOption: "自由专注（不选任务）",
    noPickTasks: "没有匹配的未完成任务",
    selected: "已选择「{title}」，准备好就开始吧",
    freeSelected: "自由专注，不绑定任务",
    reset: "重置计时",
    skip: "跳过当前阶段",
    startFocus: "开始专注",
    startBreak: "开始休息",
    resumeTimer: "继续计时",
    pauseFocus: "暂停专注",
    loop: "循环",
    loopHint: "一轮结束后自动开始下一轮",
    whitelistOn: "白名单保护中 · 允许 {n} 个应用",
    whitelistReady: "白名单保护已配置 · 允许 {n} 个应用",
    locked: "界面锁定中",
    lockReady: "界面锁定已开启 · 专注时生效",
    protectOff: "给自己一段不被打扰的时间",
    guardUnavailable: "专注保护不可用（后台 guard 未运行）",
    soundChoose: "选择背景音",
    soundTitle: "背景音",
    soundSubtitle: "选一种声音，让注意力有个落点。",
    timerBusy: "请先结束当前计时，再开始新的专注",
    todayTasks: "今日待办",
    tabActive: "待完成",
    tabDone: "已完成",
    groupCatchUp: "待补队列",
    groupTimed: "今日定时",
    groupUntimed: "今日未定时",
    catchUpHelp: "待补队列说明",
    catchUpTitle: "待补队列",
    catchUpDesignHeading: "设计理念",
    catchUpDesignText:
      "待补是给「还想做」留的位置，不是欠债清单：补不补由你决定，没做也不算失败。",
    catchUpWhenHeading: "什么时候进入",
    catchUpWhenText:
      "计划块结束了但还没做完时，普通组若仍在「重修窗口」内，就会进入待补队列，重新出现在今日专注里。",
    catchUpHabitHeading: "习惯漏做记缺勤",
    catchUpHabitText: "习惯过期后直接从今日待办移出并计一次缺勤。",
    catchUpExpireHeading: "超过窗口就报废",
    catchUpExpireText: "超过重修窗口，实例作废、不再提醒。跨日不补。",
    emptyActiveTitle: "今天没有待办任务",
    emptyActiveHint: "写下想做的事，把第一步留给现在。",
    emptyDoneTitle: "还没有完成的任务",
    emptyDoneHint: "完成的任务会出现在这里。",
    quickAdd: "添加一个想完成的任务",
    minutesPerSession: "{n} 分钟/次",
    overdue: "已逾期",
    catchUpBadge: "待补",
    overdueHint: "另有 {n} 件逾期任务",
    goTasks: "去全部任务",
    untitled: "（无标题）",
    taskCheck: "标记「{title}」为完成",
    taskUncheck: "重新打开「{title}」",
    taskPlay: "专注于「{title}」",
    taskPause: "暂停「{title}」",
    taskMore: "更多操作：{title}",
    rounds: "完成轮次 {n}/{m}",
    menuFocus: "开始专注",
    deleteTitle: "删除这个任务？",
    deleteBody: "专注记录会保留在统计里；这一步不能撤销。",
    deleteConfirm: "确认删除",
    deleted: "任务已删除",
    weekTitle: "这一周的专注节奏",
    viewStats: "查看统计",
    weekBarTitle: "{date} · {n} 分钟",
    loadingTitle: "正在读取今天的计划…",
    loadingHint: "读不到时会自动重试，不需要刷新页面。",
  },
  en: {
    headline: "Today, let's keep moving — slowly.",
    sub: "Stay with this moment; let each small step echo.",
    newTask: "New task",
    statFocus: "Focus today",
    statFocusHint: "Leave a little time for what matters",
    unitMinutes: "min",
    statDone: "Tasks done",
    statDoneHint: "{n} still open",
    unitItems: "",
    statStreak: "Focus streak",
    statStreakHint: "Small steps, kept up",
    unitDays: "days",
    timerTitle: "My pomodoro",
    expand: "Immersive mode",
    allTasks: "All tasks",
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    modeFocus: "Focus",
    modeShort: "Short break",
    modeLong: "Long break",
    stateFocusing: "Focus is happening",
    statePaused: "Paused — resume any time",
    stateIdle: "Ready when you are",
    stateBreak: "Resting matters too",
    roundOf: "Pomodoro {n} of {m}",
    freeFocus: "Free focus · pick a task",
    pickTaskTitle: "Pick a focus task",
    pickTaskSubtitle: "You can't switch tasks mid-round; end the current round first.",
    pickTaskSearch: "Search open tasks…",
    freeFocusOption: "Free focus (no task)",
    noPickTasks: "No matching open tasks",
    selected: "Selected “{title}” — start when you're ready",
    freeSelected: "Free focus, no task attached",
    reset: "Reset timer",
    skip: "Skip this phase",
    startFocus: "Start focus",
    startBreak: "Start break",
    resumeTimer: "Resume",
    pauseFocus: "Pause focus",
    loop: "Loop",
    loopHint: "Start the next round automatically when this one ends",
    whitelistOn: "Whitelist active · {n} apps allowed",
    whitelistReady: "Whitelist configured · {n} apps allowed",
    locked: "Screen locked",
    lockReady: "Screen lock on · applies during focus",
    protectOff: "Give yourself an undisturbed stretch",
    guardUnavailable: "Focus guard unavailable (background guard isn't running)",
    soundChoose: "Choose ambience",
    soundTitle: "Ambient sound",
    soundSubtitle: "Pick a sound to give your attention somewhere to land.",
    timerBusy: "Finish the current timer before starting a new focus round",
    todayTasks: "Today's tasks",
    tabActive: "To do",
    tabDone: "Done",
    groupCatchUp: "Catch-up",
    groupTimed: "Scheduled today",
    groupUntimed: "Unscheduled",
    catchUpHelp: "About the catch-up queue",
    catchUpTitle: "Catch-up queue",
    catchUpDesignHeading: "Why it exists",
    catchUpDesignText:
      "Catch-up is room for “still want to”, not a debt list: you decide whether to make it up, and skipping it isn't failure.",
    catchUpWhenHeading: "When tasks land here",
    catchUpWhenText:
      "If a plan block ends and the task is unfinished but still inside its repair window, it moves into the catch-up queue and shows up here again.",
    catchUpHabitHeading: "Missed habits count as absences",
    catchUpHabitText: "Once a habit expires it leaves today's list and records an absence.",
    catchUpExpireHeading: "Past the window, it's void",
    catchUpExpireText:
      "Beyond the repair window the instance is voided and stops reminding. It never carries to another day.",
    emptyActiveTitle: "No tasks for today",
    emptyActiveHint: "Write down one thing and keep the first step for now.",
    emptyDoneTitle: "Nothing finished yet",
    emptyDoneHint: "Completed tasks will show up here.",
    quickAdd: "Add one thing you want to finish",
    minutesPerSession: "{n} min / session",
    overdue: "Overdue",
    catchUpBadge: "Catch up",
    untitled: "(untitled)",
    taskCheck: "Mark “{title}” done",
    taskUncheck: "Reopen “{title}”",
    taskPlay: "Focus on “{title}”",
    taskPause: "Pause “{title}”",
    taskMore: "More actions: {title}",
    rounds: "Rounds {n}/{m}",
    menuFocus: "Start focus",
    deleteTitle: "Delete this task?",
    deleteBody: "Focus history stays in stats. This can't be undone.",
    deleteConfirm: "Delete",
    deleted: "Task deleted",
    weekTitle: "This week's focus rhythm",
    viewStats: "View stats",
    weekTotal: "{time} this week",
    weekBarTitle: "{date} · {n} min",
    loadingTitle: "Reading today's plan…",
    loadingHint: "It retries automatically; no need to refresh.",
  },
});

// 背景音种类直接来自 sound.js 的契约；import 失败时由构建兜底，这里再留一层
// 运行期兜底，避免常量暂时缺失让整页白屏。
const SOUND_KINDS =
  Array.isArray(AMBIENCE_KINDS) && AMBIENCE_KINDS.length > 0
    ? AMBIENCE_KINDS
    : ["silent", "rain", "brown"];

const SOUND_ICONS = { silent: "mute", rain: "sound", brown: "coffee" };

/** 快照里的 cycle 是「今天已完成的番茄轮数」；derive 的缺省 1 只用于兜底。 */
function cycleOf(view) {
  const raw = view && view.timer ? Number(view.timer.cycle) : NaN;
  if (Number.isFinite(raw) && raw >= 0) return raw;
  return Math.max(0, Number(view && view.cycle) || 0);
}

function dateEyebrow(today) {
  if (!today) return "";
  const parts = String(today).split("-").map(Number);
  if (parts.length !== 3) return today;
  const week = t("common.weekFull");
  const name = Array.isArray(week) ? week[weekdayIndex(today)] : "";
  const day = t("common.monthDay", { m: parts[1], d: parts[2] });
  return name ? `${day} · ${name}` : day;
}

// ---------------------------------------------------------------- 统计卡

function StatRow({ stats, pendingCount }) {
  return h(
    "div",
    { style: { display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 } },
    h(Stat, {
      icon: "timer",
      label: t("focus.statFocus"),
      value: toMinutes(stats.todaySeconds),
      unit: t("focus.unitMinutes"),
      hint: t("focus.statFocusHint"),
      tone: "brand",
      style: { flex: "1 1 200px" },
    }),
    h(Stat, {
      icon: "check",
      label: t("focus.statDone"),
      value: Math.max(0, Number(stats.todayCompleted) || 0),
      unit: t("focus.unitItems"),
      hint: t("focus.statDoneHint", { n: pendingCount }),
      tone: "leaf",
      style: { flex: "1 1 200px" },
    }),
    h(Stat, {
      icon: "flame",
      label: t("focus.statStreak"),
      value: Math.max(0, Number(stats.streak) || 0),
      unit: t("focus.unitDays"),
      hint: t("focus.statStreakHint"),
      tone: "sun",
      style: { flex: "1 1 200px" },
    }),
  );
}

// ---------------------------------------------------------------- 番茄钟

function ProtectionLine({ state, view, protection }) {
  const parts = [];
  if (protection.active && protection.mode === "whitelist") {
    parts.push(
      h(
        Chip,
        { key: "wl", tone: "leaf", icon: "shield" },
        t("focus.whitelistOn", { n: protection.effectiveWhitelist.length }),
      ),
    );
  } else if (protection.mode === "lock") {
    parts.push(
      h(
        Chip,
        { key: "lock", tone: "sun", icon: "lock" },
        protection.active ? t("focus.locked") : t("focus.lockReady"),
      ),
    );
  } else if (protection.mode === "whitelist") {
    parts.push(
      h(
        "span",
        { key: "wlReady", style: { fontSize: 11.5, color: "var(--tomato-ink-3)" } },
        t("focus.whitelistReady", {
          n: protection.effectiveWhitelist.length || protection.whitelist.length,
        }),
      ),
    );
  } else if (view.mode === "focus" && protection.mode === "off") {
    parts.push(
      h("span", { key: "off", style: { fontSize: 11.5, color: "var(--tomato-ink-3)" } }, t("focus.protectOff")),
    );
  }
  const guard = state && state.guard;
  if (guard && guard.available === false) {
    parts.push(
      h(
        "span",
        { key: "guard", style: { fontSize: 11.5, color: "var(--tomato-ink-3)" } },
        t("focus.guardUnavailable"),
      ),
    );
  }
  if (parts.length === 0) return null;
  return h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        flexWrap: "wrap",
        marginTop: 12,
      },
    },
    parts,
  );
}

function TimerCard({
  state,
  data,
  settings,
  view,
  amb,
  busy,
  onMode,
  onStart,
  onReset,
  onSkip,
  onPickTask,
  onToggleLoop,
  onSound,
  onExpand,
}) {
  const every = Math.max(1, Number(settings.longBreakEvery) || 4);
  const cycle = cycleOf(view);
  const filled = cycle % every;
  const resting = view.mode !== "focus";
  const ringColor = resting ? "var(--tomato-leaf)" : "var(--tomato-brand)";
  const selected = taskById(data, view.taskId);
  const protection = protectionView(state);

  const status = resting
    ? t("focus.stateBreak")
    : view.running
      ? t("focus.stateFocusing")
      : view.paused
        ? t("focus.statePaused")
        : t("focus.stateIdle");

  const startLabel = view.running
    ? t("focus.pauseFocus")
    : view.paused
      ? t("focus.resumeTimer")
      : resting
        ? t("focus.startBreak")
        : t("focus.startFocus");

  const modeItems = [
    { value: "focus", label: t("focus.modeFocus") },
    { value: "shortBreak", label: t("focus.modeShort") },
    { value: "longBreak", label: t("focus.modeLong") },
  ];

  const soundKind = (amb && amb.kind) || "silent";

  return h(
    Card,
    {
      pad: 0,
      id: "focus-timer",
      style: { display: "flex", flexDirection: "column", overflow: "hidden" },
    },
    // 标题行（与旧版一致：卡片名 + 沉浸入口）
    h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 8, padding: "16px 22px 0" } },
      h(Icon, { name: "clock", size: 15, style: { color: "var(--tomato-ink-3)" } }),
      h(
        "div",
        { style: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: 620, color: "var(--tomato-ink)" } },
        t("focus.timerTitle"),
      ),
      h(IconBtn, { name: "expand", size: 15, box: 28, title: t("focus.expand"), onClick: onExpand }),
    ),
    // 模式切换：占满卡片宽度，三段等分
    h(
      "div",
      { style: { padding: "14px 22px 0" } },
      h(Segmented, {
        items: modeItems,
        value: view.mode,
        onChange: onMode,
        size: "sm",
        style: { width: "100%" },
      }),
    ),
    h(
      "div",
      { style: { display: "flex", justifyContent: "center", padding: "12px 22px 0" } },
      h(
        Ring,
        {
          value: view.running || view.paused ? 1 - view.progress : 1,
          size: 280,
          stroke: 10,
          color: ringColor,
          pulse: view.running,
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 9,
              textAlign: "center",
            },
          },
          // 旧版只在计时进行/暂停/休息时显示状态，空闲时不占一行。
          view.running || view.paused || resting
            ? h("div", { style: { fontSize: 12, color: "var(--tomato-ink-3)" } }, status)
            : null,
          h(
            "div",
            {
              className: "t-mono",
              style: {
                fontSize: 66,
                fontWeight: 600,
                lineHeight: 1,
                letterSpacing: "-.02em",
                color: "var(--tomato-ink)",
              },
            },
            fmtClock(view.remainingSecs),
          ),
          h(ProgressDots, { total: every, done: filled, color: ringColor }),
          h(
            "div",
            { style: { fontSize: 11.5, color: "var(--tomato-ink-3)" } },
            t("focus.roundOf", { n: filled + 1, m: every }),
          ),
        ),
      ),
    ),
    h(
      "div",
      { style: { padding: "14px 22px 0" } },
      h(
        "button",
        {
          type: "button",
          className: "t-row",
          onClick: onPickTask,
          title: t("focus.pickTaskTitle"),
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            minHeight: 38,
            padding: "6px 10px",
            borderRadius: 10,
            border: "none",
            background: "transparent",
            color: "var(--tomato-ink-2)",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 13,
            textAlign: "left",
          },
        },
        h(Icon, {
          name: resting ? "coffee" : "tasks",
          size: 16,
          style: { color: "var(--tomato-ink-3)" },
        }),
        h(
          "span",
          {
            style: {
              minWidth: 0,
              maxWidth: "78%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            },
          },
          selected ? selected.title : t("focus.freeFocus"),
        ),
        h(Icon, { name: "chevronDown", size: 15, style: { color: "var(--tomato-ink-3)" } }),
      ),
    ),
    // 旧版的按钮组是居中的一小簇：重置 / 开始 / 跳过，不拉满整行。
    h(
      "div",
      { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "16px 22px 0" } },
      h(IconBtn, {
        name: "refresh",
        size: 17,
        box: 36,
        title: t("focus.reset"),
        onClick: onReset,
        disabled: busy,
      }),
      h(
        Btn,
        {
          variant: "primary",
          size: "lg",
          icon: view.running ? "pause" : "play",
          onClick: onStart,
          disabled: busy,
          style: { width: 200 },
        },
        startLabel,
      ),
      h(IconBtn, {
        name: "chevronRight",
        size: 17,
        box: 36,
        title: t("focus.skip"),
        onClick: onSkip,
        disabled: busy,
      }),
    ),
    h("div", { style: { padding: "0 22px" } }, h(ProtectionLine, { state, view, protection })),
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "2px 22px 0",
        },
      },
      h(
        Btn,
        {
          variant: "plain",
          size: "sm",
          icon: "refresh",
          title: t("focus.loopHint"),
          onClick: onToggleLoop,
          disabled: busy,
          style: settings.autoFocus
            ? {
                background: "var(--tomato-brand-soft)",
                color: "var(--tomato-brand-deep)",
              }
            : undefined,
        },
        t("focus.loop"),
      ),
      h(
        "span",
        {
          style: {
            fontSize: 11,
            color: "var(--tomato-ink-3)",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          },
        },
        t("focus.loopHint"),
      ),
    ),
    // 背景音是卡片底部的通栏（旧版样式），不再和内容挤在一起。
    h(
      "div",
      { style: { marginTop: 16 } },
      h(
        "button",
        {
          type: "button",
          className: "t-row",
          onClick: onSound,
          title: t("focus.soundTitle"),
          style: {
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "13px 22px",
            border: "none",
            borderTop: "1px solid var(--tomato-line)",
            background: "color-mix(in srgb, var(--tomato-surface-2) 45%, transparent)",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 12.5,
            color: "var(--tomato-ink-2)",
          },
        },
        h(Icon, { name: "sound", size: 16, style: { color: "var(--tomato-ink-3)" } }),
        h("span", { style: { flex: 1, textAlign: "left" } }, t("focus.soundChoose")),
        h("span", { style: { color: "var(--tomato-ink-3)" } }, t(`sound.${soundKind}`)),
        h(Icon, { name: "chevronRight", size: 14, style: { color: "var(--tomato-ink-3)" } }),
      ),
    ),
  );
}

// ---------------------------------------------------------------- 任务行

function TaskMeta({ task, project, color, today, catchUpFlag, overdue, settings }) {
  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  const doneSubtasks = subtasks.filter((sub) => sub && sub.done).length;
  const tags = Array.isArray(task.tags) ? task.tags : [];
  const focusMinutes =
    Number(task.focusMinutes) || Number(settings && settings.focusMinutes) || 0;
  const items = [];

  if (task.reminderTime) {
    items.push(
      h(
        "span",
        { key: "reminder", style: { display: "inline-flex", alignItems: "center", gap: 4 } },
        h(Icon, { name: "clock", size: 11.5 }),
        h("span", { className: "t-mono" }, task.reminderTime),
      ),
    );
  }
  if (focusMinutes > 0) {
    items.push(
      h("span", { key: "focus" }, t("focus.minutesPerSession", { n: focusMinutes })),
    );
  }
  if (project) {
    items.push(
      h(
        "span",
        { key: "project", style: { display: "inline-flex", alignItems: "center", gap: 4 } },
        h("span", {
          style: {
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: color,
            flex: "none",
          },
        }),
        project.name,
      ),
    );
  }
  if (overdue) {
    items.push(
      h(Chip, { key: "due", tone: "danger", style: { height: 18, fontSize: 10.5, padding: "0 6px" } }, t("focus.overdue")),
    );
  } else if (catchUpFlag) {
    items.push(
      h(Chip, { key: "due", tone: "sun", style: { height: 18, fontSize: 10.5, padding: "0 6px" } }, t("focus.catchUpBadge")),
    );
  } else if (task.dueDate) {
    items.push(
      h(
        "span",
        { key: "due", style: { color: task.dueDate === today ? "var(--tomato-ink-2)" : "var(--tomato-ink-3)" } },
        task.dueDate === today ? t("common.today") : dayLabel(task.dueDate, today),
      ),
    );
  }
  if (subtasks.length > 0) {
    items.push(
      h(
        "span",
        { key: "subs", style: { display: "inline-flex", alignItems: "center", gap: 3 } },
        h(Icon, { name: "tasks", size: 11.5 }),
        `${doneSubtasks}/${subtasks.length}`,
      ),
    );
  }
  for (const tag of tags.slice(0, 2)) {
    items.push(
      h(
        "span",
        {
          key: `tag-${tag}`,
          style: {
            display: "inline-flex",
            alignItems: "center",
            height: 17,
            padding: "0 6px",
            borderRadius: 5,
            background: "var(--tomato-surface-2)",
            color: "var(--tomato-ink-3)",
            fontSize: 10.5,
            maxWidth: 96,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          },
        },
        tag,
      ),
    );
  }

  return h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "3px 10px",
        flexWrap: "wrap",
        marginTop: 3,
        fontSize: 11.5,
        color: "var(--tomato-ink-3)",
        minWidth: 0,
      },
    },
    items,
  );
}

function TaskRow({ task, data, today, view, busy, actions }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const project = projectById(data, task.projectId);
  const color = projectColor(data, task.projectId);
  const rounds = taskRounds(data, task.id);
  const estimate = Math.max(1, Number(task.estimate) || 1);
  const reached = rounds >= estimate;
  const overdue = isOverdue(task, today);
  const catchUpFlag = isCatchUp(data, task, today);
  const activeTimer = !!view.running && view.taskId === task.id;
  const done = !!task.completed;

  return h(
    "div",
    {
      className: "t-row",
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        minHeight: 56,
        padding: "9px 8px",
        borderRadius: 12,
        // 待补任务用淡粉底 + 左侧细杆标出来（旧版样式），仍可正常勾选/开始。
        background:
          catchUpFlag && !done
            ? "color-mix(in srgb, var(--tomato-brand-soft) 62%, transparent)"
            : undefined,
        boxShadow: catchUpFlag && !done ? "inset 3px 0 0 var(--tomato-brand)" : undefined,
      },
    },
    h(Check, {
      checked: done,
      label: done
        ? t("focus.taskUncheck", { title: task.title || t("focus.untitled") })
        : t("focus.taskCheck", { title: task.title || t("focus.untitled") }),
      disabled: busy,
      onChange: () => actions.toggle(task),
    }),
    h(
      "button",
      {
        type: "button",
        onClick: () => actions.edit(task),
        style: {
          flex: 1,
          minWidth: 0,
          border: "none",
          background: "transparent",
          padding: 0,
          margin: 0,
          textAlign: "left",
          cursor: "pointer",
          fontFamily: "inherit",
        },
      },
      h(
        "div",
        {
          style: {
            fontSize: 13.5,
            fontWeight: 550,
            color: done ? "var(--tomato-ink-3)" : "var(--tomato-ink)",
            textDecoration: done ? "line-through" : "none",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          },
        },
        task.title || t("focus.untitled"),
      ),
      h(TaskMeta, {
        task,
        project,
        color,
        today,
        catchUpFlag,
        overdue,
        settings: data.settings || {},
      }),
    ),
    h(
      "div",
      { style: { position: "relative", display: "flex", alignItems: "center", gap: 2, flex: "none" } },
      h("span", {
        style: {
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "var(--tomato-surface-3)",
          marginLeft: 4,
          flex: "none",
        },
      }),
      h(
        "span",
        {
          className: "t-mono",
          title: t("focus.rounds", { n: rounds, m: estimate }),
          style: {
            fontSize: 11.5,
            minWidth: 34,
            textAlign: "right",
            color: reached ? "var(--tomato-leaf)" : "var(--tomato-ink-3)",
          },
        },
        `${rounds}/${estimate}`,
      ),
      done
        ? null
        : h(IconBtn, {
            name: activeTimer ? "pause" : "play",
            size: 15,
            box: 30,
            disabled: busy,
            title: activeTimer
              ? t("focus.taskPause", { title: task.title || t("focus.untitled") })
              : t("focus.taskPlay", { title: task.title || t("focus.untitled") }),
            onClick: () => actions.play(task),
          }),
      h(IconBtn, {
        name: "more",
        size: 16,
        box: 28,
        title: t("focus.taskMore", { title: task.title || t("focus.untitled") }),
        onClick: () => setMenuOpen((open) => !open),
      }),
      h(Dropdown, {
        open: menuOpen,
        align: "right",
        width: 188,
        onClose: () => setMenuOpen(false),
        items: [
          { id: "edit", label: t("common.edit"), icon: "edit", onClick: () => actions.edit(task) },
          ...(done
            ? []
            : [
                {
                  id: "focus",
                  label: t("focus.menuFocus"),
                  icon: "play",
                  onClick: () => actions.play(task),
                },
              ]),
          { divider: true },
          {
            id: "delete",
            label: t("common.delete"),
            icon: "trash",
            danger: true,
            onClick: () => actions.remove(task),
          },
        ],
      }),
    ),
  );
}

// ---------------------------------------------------------------- 今日待办

function TaskGroup({ title, tasks, data, today, view, busy, actions, onHelp }) {
  if (!tasks || tasks.length === 0) return null;
  return h(
    "section",
    { style: { minWidth: 0 } },
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "0 2px",
          marginBottom: 2,
        },
      },
      h("span", { style: { fontSize: 12.5, fontWeight: 550, color: "var(--tomato-ink-2)" } }, title),
      h(
        "span",
        { className: "t-mono", style: { fontSize: 11, color: "var(--tomato-ink-3)" } },
        tasks.length,
      ),
      onHelp
        ? h(
            "button",
            {
              type: "button",
              onClick: onHelp,
              title: t("focus.catchUpHelp"),
              "aria-label": t("focus.catchUpHelp"),
              style: {
                width: 16,
                height: 16,
                padding: 0,
                borderRadius: "50%",
                border: "1px solid var(--tomato-line-strong)",
                background: "transparent",
                color: "var(--tomato-ink-3)",
                fontSize: 10,
                lineHeight: 1,
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                fontFamily: "inherit",
              },
            },
            "?",
          )
        : null,
    ),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column" } },
      tasks.map((task, index) =>
        h(
          "div",
          {
            key: task.id,
            style: index === 0 ? undefined : { borderTop: "1px solid var(--tomato-line)" },
          },
          h(TaskRow, { task, data, today, view, busy, actions }),
        ),
      ),
    ),
  );
}

function TodayCard({ data, today, tab, onTab, view, busy, actions, onCatchUpHelp }) {
  // 今日专注只呈现「今天计划」的任务；逾期任务在全部任务里单独处理。
  const pending = todayTasks(data, today);
  const overdue = overdueTasks(data, today);
  const catchUps = catchUpTasks(data, today);
  const catchIds = new Set(catchUps.map((task) => task.id));
  const timed = pending.filter((task) => task.reminderTime && !catchIds.has(task.id));
  const untimed = pending.filter((task) => !task.reminderTime && !catchIds.has(task.id));
  const completed = completedOn(data, today);

  const tabs = [
    { value: "active", label: t("focus.tabActive"), count: pending.length },
    { value: "done", label: t("focus.tabDone"), count: completed.length },
  ];

  let body = null;
  if (tab === "done") {
    body =
      completed.length > 0
        ? h(
            "div",
            { style: { display: "flex", flexDirection: "column" } },
            completed.map((task, index) =>
              h(
                "div",
                {
                  key: task.id,
                  style: index === 0 ? undefined : { borderTop: "1px solid var(--tomato-line)" },
                },
                h(TaskRow, { task, data, today, view, busy, actions }),
              ),
            ),
          )
        : h(Empty, {
            icon: "check",
            title: t("focus.emptyDoneTitle"),
            hint: t("focus.emptyDoneHint"),
            style: { padding: "30px 16px" },
          });
  } else if (pending.length === 0) {
    body = h(Empty, {
      icon: "leaf",
      title: t("focus.emptyActiveTitle"),
      hint: t("focus.emptyActiveHint"),
      style: { padding: "30px 16px" },
    });
  } else {
    body = h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 14 } },
      h(TaskGroup, {
        title: t("focus.groupCatchUp"),
        tasks: catchUps,
        data,
        today,
        view,
        busy,
        actions,
        onHelp: onCatchUpHelp,
      }),
      h(TaskGroup, {
        title: t("focus.groupTimed"),
        tasks: timed,
        data,
        today,
        view,
        busy,
        actions,
      }),
      h(TaskGroup, {
        title: t("focus.groupUntimed"),
        tasks: untimed,
        data,
        today,
        view,
        busy,
        actions,
      }),
      overdue.length > 0
        ? h(
            "button",
            {
              type: "button",
              className: "t-btn t-btn-plain",
              onClick: () => setActivePageId("tasks"),
              style: {
                display: "flex",
                alignItems: "center",
                gap: 7,
                alignSelf: "flex-start",
                fontSize: 12,
                color: "var(--tomato-ink-3)",
                padding: "4px 2px",
              },
            },
            h(Icon, { name: "clock", size: 13 }),
            t("focus.overdueHint", { n: overdue.length }),
            h(Icon, { name: "arrowRight", size: 12 }),
            t("focus.goTasks"),
          )
        : null,
    );
  }

  return h(
    Card,
    { pad: 20 },
    h(SectionTitle, {
      icon: "tasks",
      title: t("focus.todayTasks"),
      style: { marginBottom: 6 },
      action: h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 10 } },
        h(
          Chip,
          { tone: "neutral", style: { height: 20, fontSize: 10.5, padding: "0 7px" } },
          String(pending.length),
        ),
        h(
          Btn,
          {
            variant: "plain",
            size: "sm",
            iconRight: "arrowRight",
            onClick: () => setActivePageId("tasks"),
          },
          t("focus.allTasks"),
        ),
      ),
    }),
    // 旧版的下划线 tab：待完成 / 已完成，数字跟着标签走。
    h(
      "div",
      { className: "t-tabline-row" },
      tabs.map((item) =>
        h(
          "button",
          {
            key: item.value,
            type: "button",
            className: "t-tabline",
            "data-active": item.value === tab,
            onClick: () => onTab(item.value),
          },
          item.label,
          h(
            "span",
            { className: "t-mono", style: { fontSize: 11, color: "var(--tomato-ink-3)" } },
            item.count,
          ),
        ),
      ),
    ),
    h("div", { style: { marginTop: 14 } }, body),
    // 虚线的快速添加行（旧版样式），N 是打开新建对话框的快捷键。
    h(
      "button",
      {
        type: "button",
        className: "t-row",
        onClick: actions.quickAdd,
        title: `${t("focus.quickAdd")} · N`,
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          marginTop: 14,
          padding: "10px 12px",
          border: "1px dashed var(--tomato-line-strong)",
          borderRadius: 12,
          background: "transparent",
          color: "var(--tomato-ink-3)",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 12.5,
        },
      },
      h(Icon, { name: "plus", size: 15 }),
      h("span", { style: { flex: 1, textAlign: "left" } }, t("focus.quickAdd")),
      h(Kbd, null, "N"),
    ),
  );
}

// ---------------------------------------------------------------- 本周节奏

function WeekCard({ stats, today }) {
  const days = recentDays(stats, 7, today);
  const max = Math.max(1, ...days.map((day) => day.minutes || 0));
  const names = t("focus.weekdays");
  const CHART = 118;
  const ticks = [max, Math.round(max / 2), 0];

  return h(
    Card,
    { pad: 20 },
    h(SectionTitle, {
      icon: "stats",
      title: t("focus.weekTitle"),
      action: h(
        Btn,
        {
          variant: "plain",
          size: "sm",
          iconRight: "arrowRight",
          onClick: () => setActivePageId("stats"),
        },
        t("focus.viewStats"),
      ),
    }),
    h(
      "div",
      { style: { paddingLeft: 40, marginTop: 4 } },
      // 数值行：旧版把每天的数字固定排在最上面一排。
      h(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 8,
            marginBottom: 6,
          },
        },
        days.map((day) => {
          const minutes = Math.max(0, Number(day.minutes) || 0);
          const isToday = day.date === today;
          return h(
            "div",
            {
              key: day.date,
              className: "t-mono",
              style: {
                textAlign: "center",
                fontSize: 10,
                color: isToday ? "var(--tomato-brand-deep)" : "var(--tomato-ink-3)",
              },
            },
            minutes,
          );
        }),
      ),
      // 图表主体：左侧刻度 + 虚线网格 + 细柱
      h(
        "div",
        { style: { position: "relative", height: CHART } },
        ticks.map((value) =>
          h(
            "div",
            {
              key: value,
              style: {
                position: "absolute",
                left: 0,
                right: 0,
                bottom: `${max > 0 ? (value / max) * CHART : 0}px`,
                borderTop: "1px dashed var(--tomato-line)",
                pointerEvents: "none",
              },
            },
            h(
              "span",
              {
                className: "t-mono",
                style: {
                  position: "absolute",
                  left: -40,
                  top: -6,
                  width: 34,
                  textAlign: "right",
                  fontSize: 10,
                  color: "var(--tomato-ink-3)",
                },
              },
              value === 0 ? "0" : `${value}分`,
            ),
          ),
        ),
        h(
          "div",
          {
            style: {
              position: "absolute",
              inset: 0,
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 8,
              alignItems: "end",
            },
          },
          days.map((day) => {
            const minutes = Math.max(0, Number(day.minutes) || 0);
            const isToday = day.date === today;
            const height = minutes > 0 ? Math.max(3, Math.round((minutes / max) * CHART)) : 2;
            return h(
              "div",
              {
                key: day.date,
                title: t("focus.weekBarTitle", { date: dayLabel(day.date, today), n: minutes }),
                style: { display: "flex", justifyContent: "center", alignItems: "flex-end", height: "100%" },
              },
              h("div", {
                style: {
                  width: 22,
                  height,
                  borderRadius: "4px 4px 2px 2px",
                  background: isToday ? "var(--tomato-brand)" : "var(--tomato-leaf)",
                  opacity: isToday ? 1 : 0.5,
                  transition: "height .5s cubic-bezier(.3,.7,.3,1)",
                },
              }),
            );
          }),
        ),
      ),
      // 周几 / 今天
      h(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 8,
            marginTop: 8,
          },
        },
        days.map((day) => {
          const isToday = day.date === today;
          const label = Array.isArray(names)
            ? names[(weekdayIndex(day.date) + 1) % 7]
            : day.date;
          return h(
            "div",
            {
              key: day.date,
              style: {
                textAlign: "center",
                fontSize: 11,
                color: isToday ? "var(--tomato-brand-deep)" : "var(--tomato-ink-3)",
                fontWeight: isToday ? 600 : 400,
              },
            },
            isToday ? t("common.today") : label,
          );
        }),
      ),
    ),
  );
}

// ---------------------------------------------------------------- 每日目标

// ---------------------------------------------------------------- 任务选择器

function TaskPicker({ open, data, today, selectedId, onPick, onClose }) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  if (!open) return null;

  const allTasks = Array.isArray(data.tasks) ? data.tasks : [];
  const q = query.trim().toLowerCase();
  const tasks = allTasks
    .filter((task) => {
      if (!task || task.completed || task.reminderExpired) return false;
      if (q === "") return true;
      const tags = Array.isArray(task.tags) ? task.tags.join(" ") : "";
      return `${task.title ?? ""} ${tags}`.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const dueA = a.dueDate ?? "9999-12-31";
      const dueB = b.dueDate ?? "9999-12-31";
      if (dueA !== dueB) return dueA.localeCompare(dueB);
      return String(a.title ?? "").localeCompare(String(b.title ?? ""));
    });

  const body = h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 10 } },
    h(Input, {
      value: query,
      onChange: setQuery,
      placeholder: t("focus.pickTaskSearch"),
      autoFocus: true,
    }),
    h(
      "div",
      {
        className: "t-scroll",
        style: { display: "flex", flexDirection: "column", gap: 2, maxHeight: 330, paddingRight: 2 },
      },
      h(
        "button",
        {
          type: "button",
          className: "t-navitem",
          "data-active": selectedId === null || selectedId === undefined,
          onClick: () => onPick(null),
          style: { padding: "8px 10px" },
        },
        h(Icon, { name: "sparkle", size: 16 }),
        h("span", { style: { flex: 1, minWidth: 0 } }, t("focus.freeFocusOption")),
      ),
      tasks.length > 0
        ? tasks.map((task) =>
            h(
              "button",
              {
                key: task.id,
                type: "button",
                className: "t-navitem",
                "data-active": selectedId === task.id,
                onClick: () => onPick(task.id),
                style: { padding: "8px 10px" },
              },
              h(Icon, { name: "tasks", size: 16 }),
              h(
                "span",
                {
                  style: {
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  },
                },
                task.title || t("focus.untitled"),
              ),
              task.reminderTime
                ? h(
                    "span",
                    { className: "t-mono", style: { fontSize: 11, color: "var(--tomato-ink-3)" } },
                    task.reminderTime,
                  )
                : null,
            ),
          )
        : h(
            "div",
            { style: { padding: "22px 12px", fontSize: 12.5, color: "var(--tomato-ink-3)", textAlign: "center" } },
            t("focus.noPickTasks"),
          ),
    ),
  );

  return h(
    Modal,
    {
      open,
      onClose,
      icon: "focus",
      title: t("focus.pickTaskTitle"),
      subtitle: t("focus.pickTaskSubtitle"),
      width: 540,
      footer: h(
        "div",
        { style: { marginLeft: "auto" } },
        h(Btn, { variant: "plain", size: "sm", onClick: onClose }, t("common.cancel")),
      ),
    },
    body,
  );
}

// ---------------------------------------------------------------- 说明与声音

function CatchUpDialog({ open, onClose }) {
  const sections = [
    { heading: t("focus.catchUpDesignHeading"), text: t("focus.catchUpDesignText") },
    { heading: t("focus.catchUpWhenHeading"), text: t("focus.catchUpWhenText") },
    { heading: t("focus.catchUpHabitHeading"), text: t("focus.catchUpHabitText") },
    { heading: t("focus.catchUpExpireHeading"), text: t("focus.catchUpExpireText") },
  ];
  return h(
    Modal,
    {
      open,
      onClose,
      icon: "leaf",
      title: t("focus.catchUpTitle"),
      width: 560,
      footer: h(
        "div",
        { style: { marginLeft: "auto" } },
        h(Btn, { variant: "primary", size: "sm", onClick: onClose }, t("common.close")),
      ),
    },
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 16 } },
      sections.map((section) =>
        h(
          "div",
          { key: section.heading },
          h(
            "div",
            { style: { fontSize: 12.5, fontWeight: 600, color: "var(--tomato-ink)" } },
            section.heading,
          ),
          h(
            "div",
            {
              style: {
                marginTop: 4,
                fontSize: 12.5,
                lineHeight: 1.75,
                color: "var(--tomato-ink-2)",
              },
            },
            section.text,
          ),
        ),
      ),
    ),
  );
}

function SoundDialog({ open, onClose, amb }) {
  const kind = (amb && amb.kind) || "silent";
  const volume = Number(amb && amb.volume);
  const safeVolume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0;
  const percent = Math.round(safeVolume * 100);

  return h(
    Modal,
    {
      open,
      onClose,
      icon: "sound",
      title: t("focus.soundTitle"),
      subtitle: t("focus.soundSubtitle"),
      width: 460,
      footer: h(
        "div",
        { style: { marginLeft: "auto" } },
        h(Btn, { variant: "primary", size: "sm", onClick: onClose }, t("common.close")),
      ),
    },
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 18 } },
      h(
        "div",
        { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
        SOUND_KINDS.map((item) =>
          h(
            Chip,
            {
              key: item,
              tone: kind === item ? "brand" : "neutral",
              active: kind === item,
              icon: SOUND_ICONS[item] || "sound",
              onClick: () => {
                if (amb && typeof amb.setKind === "function") amb.setKind(item);
              },
            },
            t(`sound.${item}`),
          ),
        ),
      ),
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 8 } },
        h(
          "div",
          { style: { fontSize: 12, fontWeight: 550, color: "var(--tomato-ink-2)" } },
          t("sound.volume"),
        ),
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 10 } },
          h("input", {
            type: "range",
            min: 0,
            max: 1,
            step: 0.05,
            value: safeVolume,
            "aria-label": t("sound.volume"),
            onChange: (event) => {
              const next = Number(event.target.value);
              if (amb && typeof amb.setVolume === "function") amb.setVolume(next);
            },
            style: { flex: 1, accentColor: "var(--tomato-brand)" },
          }),
          h(
            "span",
            {
              className: "t-mono",
              style: { fontSize: 12, color: "var(--tomato-ink-2)", minWidth: 38, textAlign: "right" },
            },
            `${percent}%`,
          ),
        ),
      ),
      amb && amb.enabled === false
        ? h(
            "div",
            { style: { fontSize: 11.5, lineHeight: 1.6, color: "var(--tomato-ink-3)" } },
            t("sound.mutedHint"),
          )
        : null,
    ),
  );
}

function DeleteTaskDialog({ open, task, busy, onClose, onConfirm }) {
  return h(
    Modal,
    {
      open,
      onClose,
      icon: "trash",
      title: t("focus.deleteTitle"),
      width: 440,
      footer: h(
        "div",
        { style: { display: "flex", gap: 9, marginLeft: "auto" } },
        h(Btn, { variant: "plain", size: "sm", onClick: onClose, disabled: busy }, t("common.cancel")),
        h(
          Btn,
          { variant: "danger", size: "sm", icon: "trash", onClick: onConfirm, disabled: busy },
          t("focus.deleteConfirm"),
        ),
      ),
    },
    h(
      "div",
      { style: { fontSize: 13.5, fontWeight: 550, color: "var(--tomato-ink)", lineHeight: 1.6 } },
      task ? task.title || t("focus.untitled") : "",
    ),
    h(
      "div",
      { style: { fontSize: 12, lineHeight: 1.7, color: "var(--tomato-ink-3)", marginTop: 6 } },
      t("focus.deleteBody"),
    ),
  );
}

// ---------------------------------------------------------------- 页面

export function FocusPage() {
  const state = useSnapshot();
  const [tab, setTab] = useState("active");
  const [editor, setEditor] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);
  const [catchUpOpen, setCatchUpOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const amb = useAmbience();

  useSearchHotkey(() => setSearchOpen(true));

  // 快速新建：N（旧版同款）。输入框/对话框里不抢键，避免打字时弹出表单。
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "n" && e.key !== "N") return;
      const el = e.target;
      const tag = (el && el.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el && el.isContentEditable)) return;
      if (editor || searchOpen || pickerOpen || soundOpen || catchUpOpen || deleteTarget) return;
      e.preventDefault();
      setEditor({ title: "" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor, searchOpen, pickerOpen, soundOpen, catchUpOpen, deleteTarget]);

  const data = (state && state.data) || {};
  // derive.isCatchUp 读 data.taskKinds，而快照把 taskKinds 放在 state 顶层；
  // 合并一份视图数据，任务行与今日分组共用同一份判定。
  const viewData = { ...data, taskKinds: (state && state.taskKinds) || {} };
  const settings = data.settings || {};
  const stats = (state && state.stats) || {};
  const today = (state && state.today) || todayKey(state && state.serverTime);
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const view = timerView(state);
  const pending = todayTasks(data, today);

  const run = async (action, message) => {
    setBusy(true);
    const result = await tryDispatch(action);
    setBusy(false);
    if (!result.ok) {
      notify(result.error || t("common.writeFailed"), "danger");
      return false;
    }
    if (message) notify(message, "brand");
    return true;
  };

  const changeMode = async (mode) => {
    await run({ type: "setMode", mode });
  };

  const startTimer = async () => {
    if (view.running) {
      await run({ type: "pauseTimer" });
      return;
    }
    const started = await run({ type: "startTimer" });
    // 只有用户主动开始才进入沉浸；轮询/effect 不会自动弹。
    if (started) openImmersive();
  };

  const toggleLoop = async () => {
    await run({
      type: "saveSettings",
      settings: { ...settings, autoFocus: !settings.autoFocus },
    });
  };

  const chooseTask = async (id) => {
    const ok = await run({ type: "selectTask", id });
    if (!ok) return;
    setPickerOpen(false);
    const picked = id ? taskById(data, id) : null;
    notify(
      picked
        ? t("focus.selected", { title: picked.title || t("focus.untitled") })
        : t("focus.freeSelected"),
      picked ? "brand" : "neutral",
    );
  };

  const playTask = async (task) => {
    if (!task || task.completed) return;
    if (view.taskId === task.id && view.running) {
      await run({ type: "pauseTimer" });
      return;
    }
    if (view.running || view.paused) {
      notify(t("focus.timerBusy"), "danger");
      return;
    }
    const selected = await run({ type: "selectTask", id: task.id });
    if (!selected) return;
    const modeChanged = await run({ type: "setMode", mode: "focus" });
    if (!modeChanged) return;
    const started = await run({ type: "startTimer" });
    if (started) openImmersive();
  };

  const openNew = () => setEditor({ title: "" });
  const openEdit = (task) => setEditor({ id: task.id });
  const openFromSearch = (title) => setEditor({ title });

  const actions = {
    toggle: (task) => {
      run({ type: "toggleTask", id: task.id });
    },
    edit: openEdit,
    play: playTask,
    remove: (task) => setDeleteTarget(task),
    quickAdd: openNew,
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const ok = await run({ type: "deleteTask", id: deleteTarget.id });
    if (ok) {
      setDeleteTarget(null);
      notify(t("focus.deleted"), "neutral");
    }
  };

  const editorTask = editor && editor.id ? taskById(data, editor.id) : null;

  // 页头在加载态也要出现：日期信息缺失时只保留标题与副标题。
  const header = h(PageHeader, {
    eyebrow: state ? dateEyebrow(today) : "",
    title: t("focus.headline"),
    subtitle: `${greeting()} · ${t("focus.sub")}`,
    actions: [
      h(
        Btn,
        {
          key: "search",
          variant: "ghost",
          icon: "search",
          onClick: () => setSearchOpen(true),
          title: `${t("common.search")} (Ctrl K)`,
        },
        t("common.search"),
        h(Kbd, { key: "kbd" }, "Ctrl K"),
      ),
      h(
        Btn,
        {
          key: "new",
          variant: "primary",
          icon: "plus",
          onClick: openNew,
        },
        t("focus.newTask"),
      ),
    ],
  });

  if (state === null) {
    return h(
      "div",
      { className: "t-root", style: { width: "100%", minWidth: 0 } },
      header,
      h(
        Card,
        { pad: 24 },
        h(Empty, {
          icon: "focus",
          title: t("focus.loadingTitle"),
          hint: t("focus.loadingHint"),
          style: { padding: "52px 20px" },
        }),
      ),
    );
  }

  return h(
    "div",
    { className: "t-root", style: { width: "100%", minWidth: 0 } },
    header,
    h(StatRow, { stats, pendingCount: pending.length }),
    h(
      "div",
      { style: { display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" } },
      h(
        "div",
        { style: { flex: "1 1 420px", maxWidth: 500, minWidth: 0 } },
        h(TimerCard, {
          state,
          data,
          settings,
          view,
          amb,
          busy,
          onMode: changeMode,
          onStart: startTimer,
          onReset: () => run({ type: "resetTimer" }),
          onSkip: () => run({ type: "skipTimer" }),
          onPickTask: () => setPickerOpen(true),
          onToggleLoop: toggleLoop,
          onSound: () => setSoundOpen(true),
          onExpand: () => openImmersive(),
        }),
      ),
      h(
        "div",
        { style: { flex: "2 1 460px", minWidth: 0 } },
        h(TodayCard, {
          data: viewData,
          today,
          tab,
          onTab: setTab,
          view,
          busy,
          actions,
          onCatchUpHelp: () => setCatchUpOpen(true),
        }),
      ),
    ),
    // 本周节奏占满整行（旧版结构），不挤在右列里。
    h("div", { style: { marginTop: 20 } }, h(WeekCard, { stats, today })),
    h(TaskDialog, {
      open: !!editor,
      task: editorTask,
      today,
      projects,
      settings,
      initialTitle: (editor && editor.title) || "",
      onClose: () => setEditor(null),
    }),
    h(SearchDialog, {
      open: searchOpen,
      onClose: () => setSearchOpen(false),
      onOpenTask: (id) => {
        setSearchOpen(false);
        setEditor({ id });
      },
      onCreate: (title) => {
        setSearchOpen(false);
        openFromSearch(title);
      },
    }),
    h(TaskPicker, {
      open: pickerOpen,
      data: viewData,
      today,
      selectedId: view.taskId,
      onPick: chooseTask,
      onClose: () => setPickerOpen(false),
    }),
    h(SoundDialog, { open: soundOpen, onClose: () => setSoundOpen(false), amb }),
    h(CatchUpDialog, { open: catchUpOpen, onClose: () => setCatchUpOpen(false) }),
    h(DeleteTaskDialog, {
      open: !!deleteTarget,
      task: deleteTarget,
      busy,
      onClose: () => setDeleteTarget(null),
      onConfirm: confirmDelete,
    }),
  );
}

registerPage({
  id: "focus",
  order: 10,
  icon: "focus",
  titleKey: "nav.focus",
  Component: FocusPage,
  // 没有快照时按 0 计，避免导航计数在首次渲染时闪一下 undefined。
  badge: (snapshot) => {
    if (!snapshot || !snapshot.data) return 0;
    const today = snapshot.today || todayKey(snapshot.serverTime);
    return todayTasks(snapshot.data, today).length;
  },
});
