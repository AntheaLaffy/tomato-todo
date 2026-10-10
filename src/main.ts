import "./style.css";
import {
  createIcons,
  Sun,
  Moon,
  Timer,
  Inbox,
  CalendarDays,
  ChartNoAxesCombined,
  ShieldCheck,
  Settings2,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Maximize2,
  Minimize2,
  Ellipsis,
  Check,
  X,
  CircleHelp,
  Volume2,
  VolumeX,
  Headphones,
  Leaf,
  Flame,
  Target,
  CheckCheck,
  Clock3,
  Folder,
  Pencil,
  Trash2,
  Download,
  Upload,
  LockKeyhole,
  ShieldOff,
  Monitor,
  ListFilter,
  CheckCircle2,
  Coffee,
  Sparkles,
  Keyboard,
  AlertCircle,
  ListTodo,
  Flag,
  Link2,
  RefreshCw,
  ArrowUpDown,
} from "lucide";
import { listen } from "@tauri-apps/api/event";
import {
  desktop,
  dispatch,
  exportData,
  exportPlan,
  getGuard,
  getSnapshot,
  getDesktopStatus,
  saveDesktopSettings,
  hideToTray,
  quitApp,
  readImport,
  readPlan,
} from "./api";
import { chime, setNoise, setNoiseVolume, unlockAudio } from "./audio";
import type {
  AppData,
  DesktopStatus,
  GuardInfo,
  Goal,
  Habit,
  Mode,
  Vision,
  Project,
  Settings,
  Snapshot,
  Task,
  LockSchedule,
} from "./types";

const iconSet = {
  Sun,
  Moon,
  Timer,
  Inbox,
  CalendarDays,
  ChartNoAxesCombined,
  ShieldCheck,
  Settings2,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Maximize2,
  Minimize2,
  Ellipsis,
  Check,
  X,
  CircleHelp,
  Volume2,
  VolumeX,
  Headphones,
  Leaf,
  Flame,
  Target,
  CheckCheck,
  Clock3,
  Folder,
  Pencil,
  Trash2,
  Download,
  Upload,
  LockKeyhole,
  ShieldOff,
  Monitor,
  ListFilter,
  CheckCircle2,
  Coffee,
  Sparkles,
  Keyboard,
  AlertCircle,
  ListTodo,
  Flag,
  Link2,
  RefreshCw,
  ArrowUpDown,
};
const $ = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const escape = (text: unknown) =>
  String(text ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const icon = (name: string, cls = "") =>
  `<i data-lucide="${name}" class="${cls}" aria-hidden="true"></i>`;
const icons = () =>
  createIcons({ icons: iconSet, attrs: { "stroke-width": 1.7 } });
const logo = `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 12C8 5 3 19 8 32c3 9 12 12 16 8 5 4 15 0 17-9C45 17 38 6 24 12Z" fill="currentColor"/><path d="m24 13-8-5 8 2 5-6-1 7 8 1-10 3" fill="#7c997a"/><path d="M14 22c-1 4 0 7 2 9" stroke="white" stroke-opacity=".65" stroke-width="3" stroke-linecap="round"/></svg>`;
let state: Snapshot;
let page = "focus";
let goalsTab = "goals";
let selectMode = false;
const selectedTaskIds = new Set<string>();
let visibleTaskIds: string[] = [];
let dragProjectId: string | null = null;
let filter = "active";
let reminderSeen = "";
let priority = "all";
let sort = "time";
let search = "";
let immersive = false;
let noiseKind = "off";
let guardInfo: GuardInfo | null = null;
let nativeStatus: DesktopStatus | null = null;
let pending = false;
let serial = -1;
let disconnected = false;
let settingsDirty = false;
let blockedCount = 0;
let lastFocus: HTMLElement | null = null;
let undo: (() => Promise<void>) | null = null;
let toastTimer: ReturnType<typeof setTimeout>;
const labels: Record<string, string> = {
  focus: "今日专注",
  tasks: "全部任务",
  goals: "目标·习惯·愿景",
  stats: "数据统计",
  guard: "专注保护",
  lock: "定时锁机",
  settings: "偏好设置",
};
const modeLabels: Record<Mode, string> = {
  focus: "专注",
  shortBreak: "短休息",
  longBreak: "长休息",
};
const protectedNow = () =>
  !!state.data.lock.active ||
  (state.data.timer.running &&
    state.data.timer.mode === "focus" &&
    state.data.settings.protection.mode !== "off");
const strictNow = () =>
  state.data.lock.active
    ? state.data.lock.active.strict
    : protectedNow() && state.data.settings.protection.strict;
const projectOf = (task: Task) =>
  state.data.projects.find((p) => p.id === task.projectId);
// Categories are derived, not stored: a goal task accumulates, any other timed
// task is a routine (a spent one does not roll over), the rest is flexible.
const isHabit = (task: Task) =>
  !!task.reminderTime &&
  !task.goalId &&
  (!!task.habitId || task.repeat !== "none");
const dayLabel = (d: number) => "一二三四五六日"[d - 1] ?? "?";
const daysLabel = (days: number[]) => {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return "每天";
  if (sorted.join() === "1,2,3,4,5") return "工作日";
  if (sorted.join() === "6,7") return "周末";
  return "周" + sorted.map(dayLabel).join("");
};

const isTimed = (task: Task) => !!task.reminderTime;
const goalProgress = (g: Goal) => {
  if (g.measure === "time") {
    const ids = new Set(
      state.data.tasks.filter((t) => t.goalId === g.id).map((t) => t.id),
    );
    const seconds = state.data.sessions
      .filter((s) => s.taskId && ids.has(s.taskId))
      .reduce((sum, s) => sum + s.durationSecs, 0);
    return seconds / 3600;
  }
  return state.data.tasks.filter((t) => t.goalId === g.id && t.completed)
    .length;
};
const progressLabel = (g: Goal) => {
  const done = goalProgress(g);
  return `${g.measure === "time" ? done.toFixed(1) : done}/${g.target}`;
};
const goalOf = (task: Task) =>
  state.data.goals.find((g) => g.id === task.goalId);
// Failure belongs to the goal, not the task: its work can be made up any time
// before the deadline, then the goal fails and everything under it is void.
const goalState = (g: Goal): "achieved" | "failed" | "active" => {
  if (goalProgress(g) >= g.target) return "achieved";
  if (g.dueDate && g.dueDate < state.today) return "failed";
  return "active";
};
const isVoid = (task: Task) => {
  if (task.completed) return false;
  const goal = goalOf(task);
  if (goal) return goalState(goal) === "failed";
  // A timed non-goal item — a routine or a one-off appointment — is spent once
  // its time passes, whether or not it repeats.
  return isTimed(task) && task.reminderExpired;
};
const completedPomodoros = (task: Task) =>
  state.data.sessions.filter((s) => s.taskId === task.id && s.completed).length;
const time = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const duration = (seconds: number) =>
  seconds >= 3600
    ? `${Math.floor(seconds / 3600)} 小时 ${Math.floor((seconds % 3600) / 60)} 分钟`
    : `${Math.floor(seconds / 60)} 分钟`;
const dateLabel = (date: string | null) =>
  !date
    ? ""
    : date === state.today
      ? "今天"
      : date < state.today
        ? "已逾期"
        : new Date(`${date}T12:00:00`).toLocaleDateString("zh-CN", {
            month: "numeric",
            day: "numeric",
          });
const pageTitle = () =>
  page.startsWith("project:")
    ? state.data.projects.find((p) => p.id === page.slice(8))?.name || "项目"
    : labels[page];

function toast(message: string, action?: () => Promise<void>) {
  clearTimeout(toastTimer);
  undo = action || null;
  $("#toast").innerHTML =
    `${icon("check-circle-2")}<span>${escape(message)}</span>${action ? '<button data-action="undo">撤销</button>' : ""}`;
  $("#toast").classList.add("visible");
  icons();
  toastTimer = setTimeout(
    () => $("#toast").classList.remove("visible"),
    action ? 9000 : 4500,
  );
}
async function act(
  action: Record<string, unknown>,
  message?: string,
): Promise<boolean> {
  if (pending) return false;
  pending = true;
  try {
    accept(await dispatch(action));
    if (message) toast(message);
    return true;
  } catch (e) {
    toast(String(e instanceof Error ? e.message : e));
    return false;
  } finally {
    pending = false;
  }
}
function accept(next: Snapshot) {
  const wasProtected = state ? protectedNow() : false;
  const changed =
    !state ||
    JSON.stringify(state.data) !== JSON.stringify(next.data) ||
    state.today !== next.today;
  state = next;
  if (!wasProtected && protectedNow()) closeModal();
  if (serial !== -1 && state.data.timer.completionSerial > serial) {
    if (state.data.settings.sound) chime();
    toast(
      state.data.timer.lastFinishedMode === "focus"
        ? "完成一个番茄，辛苦了！起来休息一下吧。"
        : "休息结束，开始下一段专注吧。",
    );
  }
  const reminder = pendingReminder();
  const reminderKey = reminder
    ? `${reminder.id}/${reminder.dueDate}/${reminder.reminderTime}`
    : "";
  const reveal = reminderKey && reminderKey !== reminderSeen;
  reminderSeen = reminderKey;
  if (reveal && !settingsDirty && !$("#modal-root").innerHTML) {
    page = "focus";
    immersive = false;
  }
  serial = state.data.timer.completionSerial;
  applyTheme();
  if (changed && (protectedNow() || !(page === "settings" && settingsDirty)))
    render();
  if (reveal) {
    toast(`到时间了：${reminder!.title}`);
    if (!settingsDirty && !$("#modal-root").innerHTML)
      requestAnimationFrame(() =>
        document
          .querySelector(".reminder-banner")
          ?.scrollIntoView({ block: "center" }),
      );
  }
  updateClock();
}
function applyTheme() {
  const theme = state.data.settings.theme;
  document.documentElement.dataset.theme =
    theme === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
}
function navigate(next: string) {
  if (protectedNow()) return toast("专注保护中，先把眼前这件事做好。");
  if (page === "settings" && settingsDirty && next !== page)
    return confirmDialog(
      "还有未保存的设置",
      "离开后将放弃这些修改。",
      "放弃修改",
      () => {
        settingsDirty = false;
        navigate(next);
      },
    );
  page = next;
  search = "";
  filter = "active";
  priority = "all";
  selectMode = false;
  selectedTaskIds.clear();
  settingsDirty = false;
  render();
  if (desktop && next === "settings") {
    void getDesktopStatus()
      .then((status) => {
        nativeStatus = status;
        if (page === "settings" && !settingsDirty) render();
      })
      .catch((error) => toast(String(error)));
  }
}
function render() {
  if (protectedNow() || immersive) {
    renderImmersive();
    return;
  }
  const d = state.data,
    s = state.stats;
  $("#app").innerHTML = `<aside class="sidebar">
    <button class="brand" data-page="focus"><span class="brand-mark">${logo}</span><span>番茄 <b>Todo</b><small>让专注，成为日常</small></span></button>
    <div class="workspace-label">我的空间 <span>PERSONAL</span></div>
    <nav aria-label="主导航">${[
      ["focus", "sun"],
      ["tasks", "inbox"],
      ["goals", "target"],
      ["stats", "chart-no-axes-combined"],
      ["guard", "shield-check"],
      ["lock", "moon"],
    ]
      .map(
        ([id, ic]) =>
          `<button class="nav-item ${page === id ? "active" : ""}" data-page="${id}">${icon(ic)}<span>${labels[id]}</span>${id === "tasks" ? `<b>${d.tasks.filter((t) => !t.completed).length}</b>` : id === "focus" ? '<span class="nav-dot"></span>' : ""}</button>`,
      )
      .join("")}</nav>
    <div class="sidebar-section"><span>我的项目</span><button class="icon-btn tiny" data-action="sort-projects" aria-label="项目排序">${icon("arrow-up-down")}</button><button class="icon-btn tiny" data-action="new-project" aria-label="新建项目">${icon("plus")}</button></div>
    <nav class="projects" aria-label="项目">${d.projects.map((p) => `<button class="nav-item project-nav ${page === `project:${p.id}` ? "active" : ""}" data-page="project:${p.id}" data-project-menu="${p.id}" draggable="true"><span class="project-dot" style="--project:${escape(p.color)}"></span><span>${escape(p.name)}</span><b>${d.tasks.filter((t) => t.projectId === p.id && !t.completed).length}</b></button>`).join("")}</nav>
    <div class="sidebar-bottom"><div class="daily-goal"><div><span>${icon("sprout").replace("sprout", "leaf")} 每日小目标</span><b>${s.todayPomodoros}<small> / ${d.settings.dailyGoal}</small></b></div><div class="progress-track"><i style="width:${Math.min(100, (s.todayPomodoros / d.settings.dailyGoal) * 100)}%"></i></div><p>${s.todayPomodoros >= d.settings.dailyGoal ? "目标达成！今天的你很棒。" : "不必急，每一份专注都有意义。"}</p></div>
    <button class="nav-item ${page === "settings" ? "active" : ""}" data-page="settings">${icon("settings-2")}<span>偏好设置</span></button><div class="local-status"><span class="status-dot"></span>本地存储 · 安心专注 <span>v0.4.0</span></div></div>
  </aside>
  <div class="workspace"><header class="topbar"><div class="breadcrumb">我的空间 ${icon("chevron-right")} <span>${escape(pageTitle())}</span></div><div class="top-actions"><button class="search-trigger" data-action="search">${icon("search")}<span>搜索任务</span><kbd>Ctrl K</kbd></button><span class="separator"></span><button class="icon-btn" data-action="theme" aria-label="切换明暗主题">${icon(document.documentElement.dataset.theme === "dark" ? "sun" : "moon")}</button><button class="icon-btn" data-action="help" aria-label="快捷键帮助">${icon("circle-help")}</button><div class="avatar">我</div></div></header>
  <main>${reminderBanner()}${page === "focus" ? focusPage() : page === "goals" ? goalsPage() : page === "stats" ? statsPage() : page === "settings" ? settingsPage() : page === "guard" ? guardPage() : page === "lock" ? lockPage() : tasksPage()}</main><footer class="workspace-footer"><span>${icon("leaf")} 把时间留给真正重要的事。</span><span id="connection">${disconnected ? "连接中断，正在重试…" : "所有更改已保存到本机"}</span></footer></div>`;
  bindForms();
  icons();
  updateClock();
}
function heading(
  title: string,
  subtitle: string,
  eyebrow = "A LITTLE FOCUS, A BETTER DAY",
  action = true,
) {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div>${action ? `<button class="button primary" data-action="new-task">${icon("plus")} 新建任务 <kbd>N</kbd></button>` : ""}</div>`;
}
function metric(
  iconName: string,
  label: string,
  value: number | string,
  unit: string,
  detail: string,
  color: string,
) {
  return `<div class="metric"><span class="metric-icon ${color}">${icon(iconName)}</span><div><p>${label}</p><div class="metric-value">${value}<small>${unit}</small></div></div><span class="metric-detail">${detail}</span></div>`;
}
function pendingReminder() {
  if (
    !state ||
    state.data.timer.running ||
    state.data.timer.startedAt !== null ||
    state.data.timer.remainingSecs !== state.data.timer.durationSecs ||
    state.data.lock.active
  )
    return undefined;
  return state.data.tasks
    .filter((t) => !t.completed && t.reminderPending)
    .sort((a, b) =>
      `${a.dueDate} ${a.reminderTime} ${a.id}`.localeCompare(
        `${b.dueDate} ${b.reminderTime} ${b.id}`,
      ),
    )[0];
}
function reminderBanner() {
  const t = pendingReminder();
  if (!t) return "";
  return `<section class="reminder-banner" role="region" aria-label="任务时间提醒"><div><small>${escape(t.reminderTime)} · ${t.focusMinutes || state.data.settings.focusMinutes} 分钟专注</small><h2>${escape(t.title)}</h2><p>到计划时间了，准备好就开始吧。</p></div><div class="reminder-actions"><button class="button primary" data-start-reminder="${escape(t.id)}">${icon("play")} 一键开始</button></div></section>`;
}
function focusPage() {
  const s = state.stats;
  const weekday = new Date(`${state.today}T12:00:00`).toLocaleDateString(
    "zh-CN",
    { month: "long", day: "numeric", weekday: "long" },
  );
  const todayTasks = state.data.tasks.filter(
    (t) =>
      !t.completed && (!t.dueDate || t.dueDate <= state.today) && !isVoid(t),
  );
  return `${heading("今天，也要慢慢向前。", `${weekday} <span class="dot-separator">·</span> 专注当下，让每一小步都有回响。`)}
    <div class="metrics">${metric("timer", "今日专注", Math.floor(s.todaySeconds / 60), "分钟", "给重要的事留一点时间", "coral")}${metric("check-check", "完成任务", s.todayCompleted, "项", `${todayTasks.length} 项待办，按自己的节奏来`, "sage")}${metric("flame", "连续专注", s.streak, "天", "小小坚持，慢慢积累", "amber")}</div>
    <div class="focus-grid"><section class="card focus-card"><div class="card-heading"><h2>${icon("timer")} 我的番茄钟</h2><button class="icon-btn" data-action="immersive" aria-label="进入沉浸模式">${icon("maximize-2")}</button></div>${timerContent()}
    <div class="sound-bar"><button class="sound-button ${noiseKind !== "off" ? "on" : ""}" data-action="sound">${icon("headphones")}<span>${noiseKind === "off" ? "来一点背景音？" : noiseKind === "rain" ? "雨声 · 正在播放" : "棕噪音 · 正在播放"}</span>${icon("chevron-right")}</button><button class="icon-btn" data-action="toggle-chime" aria-label="${state.data.settings.sound ? "关闭" : "开启"}完成提示音">${icon(state.data.settings.sound ? "volume-2" : "volume-x")}</button></div></section>
    <section class="card today-card"><div class="card-heading"><h2>今日待办 <span class="count-label">${todayTasks.length}</span></h2><button class="text-button" data-page="tasks">全部任务 ${icon("arrow-up-right")}</button></div><div class="list-tabs"><button class="${filter === "active" ? "active" : ""}" data-filter="active">待完成 <span>${todayTasks.length}</span></button><button class="${filter === "completed" ? "active" : ""}" data-filter="completed">已完成 <span>${s.todayCompleted}</span></button><span class="list-tabs-line"></span><span class="subtle small">一步一步，来就好</span></div>
    <div class="today-list">${taskList(filter === "completed" ? state.data.tasks.filter((t) => t.completed && t.completedAt && new Date(t.completedAt * 1000).toLocaleDateString("sv-SE") === state.today) : todayTasks, true)}</div>
    <button class="quick-add" data-action="new-task">${icon("plus")} 添加一个想完成的小目标 <kbd>N</kbd></button><div class="list-footnote">${icon("sparkles")} 开始之前，先选一件最重要的事。</div></section></div>
    <div class="bottom-grid"><section class="card week-card"><div class="card-heading"><h2>这一周的专注节奏</h2><button class="text-button" data-page="stats">查看统计 ${icon("arrow-up-right")}</button></div>${weekChart(false)}</section><section class="quote-card"><div class="quote-leaf">${icon("leaf")}</div><span class="eyebrow">ONE THING AT A TIME</span><h3>不求每一天都满分，<br>只求每一刻都投入。</h3><p>一个番茄，一点进步。</p><div class="quote-dots"><i></i><i></i><i></i></div></section></div>`;
}
function timerContent() {
  const t = state.data.timer,
    selected = state.data.tasks.find((task) => task.id === t.taskId);
  const started = t.remainingSecs !== t.durationSecs || t.running;
  return `<div class="mode-tabs" role="group" aria-label="计时模式">${(Object.keys(modeLabels) as Mode[]).map((mode) => `<button class="${mode === t.mode ? "active" : ""}" data-mode="${mode}">${modeLabels[mode]}</button>`).join("")}</div>
    <div class="timer-ring ${t.mode !== "focus" ? "break" : ""}"><svg viewBox="0 0 300 300" aria-hidden="true"><circle class="ring-track" cx="150" cy="150" r="134"/><circle class="ring-progress" cx="150" cy="150" r="134"/><circle class="ring-inner" cx="150" cy="150" r="121"/></svg><div class="timer-center"><span class="timer-eyebrow">${t.mode === "focus" ? (t.running ? "专注正在发生" : started ? "暂停一下，随时继续" : "准备好，进入心流") : "好好休息，也很重要"}</span><div class="clock" aria-live="off">${time(state.remainingSecs)}</div><div class="cycle-dots">${Array.from({ length: state.data.settings.longBreakEvery }, (_, i) => `<span class="${i < t.cycle % state.data.settings.longBreakEvery ? "filled" : ""}">${logo}</span>`).join("")}</div><span class="timer-cycle">第 ${(t.cycle % state.data.settings.longBreakEvery) + 1} / ${state.data.settings.longBreakEvery} 个番茄</span></div></div>
    <button class="current-task" data-action="select-task">${icon(t.mode === "focus" ? "target" : "coffee")}<span>${selected ? escape(selected.title) : "自由专注 · 选择一个任务"}</span>${icon("chevron-down")}</button>
    <div class="timer-controls"><button class="icon-btn control-secondary" data-action="reset" aria-label="重置计时">${icon("rotate-ccw")}</button><button class="button primary start-button" data-action="toggle-timer">${icon(t.running ? "pause" : "play")} ${t.running ? "暂停专注" : started ? "继续计时" : t.mode === "focus" ? "开始专注" : "开始休息"}</button><button class="icon-btn control-secondary" data-action="skip" aria-label="跳过当前阶段">${icon("skip-forward")}</button></div><div class="timer-hint"><kbd>Space</kbd> ${t.running ? "暂停" : "开始"} <span>·</span> ${state.data.settings.protection.mode === "off" ? "给自己一段不被打扰的时间" : `${state.data.settings.protection.mode === "lock" ? "界面锁定" : "白名单"}保护已配置`}</div>`;
}
function taskList(tasks: Task[], compact = false) {
  const items = [...tasks].sort((a, b) =>
    sort === "priority"
      ? b.priority - a.priority
      : sort === "time"
        ? (a.dueDate || "9999-12-31").localeCompare(
            b.dueDate || "9999-12-31",
          ) ||
          (a.reminderTime || "99:99").localeCompare(
            b.reminderTime || "99:99",
          ) ||
          a.createdAt - b.createdAt
        : a.createdAt - b.createdAt,
  );
  if (!items.length)
    return `<div class="empty-state"><div class="empty-illustration">${icon(filter === "completed" ? "check-check" : "leaf")}</div><h3>${search ? "没有找到匹配的任务" : filter === "completed" ? "每一次完成，都值得被记录" : "给今天，一个小小的开始"}</h3><p>${search ? "试试其他关键词，或新建一个任务。" : filter === "completed" ? "完成的任务会出现在这里。" : "写下想做的事，把第一步留给现在。"}</p>${!state.data.tasks.length ? '<button class="text-button" data-action="example">还没想好？体验示例任务 →</button>' : ""}</div>`;
  visibleTaskIds = items.map((t) => t.id);
  return items
    .map((task) => {
      const p = projectOf(task),
        done = completedPomodoros(task),
        selected = task.id === state.data.timer.taskId,
        picked = selectMode && selectedTaskIds.has(task.id),
        catchUp =
          !!task.goalId &&
          !!task.dueDate &&
          task.dueDate < state.today &&
          !task.completed &&
          !isVoid(task);
      return `<article data-task-id="${escape(task.id)}" class="task-row ${selectMode ? "selecting" : ""} ${picked ? "picked" : ""} ${task.reminderPending ? "reminded" : ""} ${catchUp ? "catch-up" : ""} ${task.completed ? "completed" : ""} ${selected && !task.completed ? "selected" : ""}">${selectMode ? `<button class="task-checkbox pick ${picked ? "on" : ""}" data-select-task="${task.id}" aria-label="选择 ${escape(task.title)}">${picked ? icon("check") : ""}</button>` : `<button class="task-checkbox p${task.priority}" data-toggle-task="${task.id}" aria-label="${task.completed ? "重新打开" : "完成"}任务 ${escape(task.title)}" aria-pressed="${task.completed}">${task.completed ? icon("check") : ""}</button>`}<button class="task-body" ${selectMode ? `data-select-task="${task.id}"` : `data-edit-task="${task.id}"`}><span class="task-title">${escape(task.title)}${catchUp ? '<span class="catch-up-chip">待补</span>' : ""}</span><span class="task-meta">${task.reminderTime ? `<span>${icon("clock-3")}${escape(task.reminderTime)} 提醒</span>` : ""}${task.focusMinutes ? `<span>${task.focusMinutes} 分钟/次</span>` : ""}${p ? `<span class="task-project" style="--project:${escape(p.color)}"><i></i>${escape(p.name)}</span>` : ""}${task.dueDate ? `<span class="${task.dueDate < state.today && !task.completed ? "overdue" : ""}">${icon("calendar-days")}${dateLabel(task.dueDate)}</span>` : ""}${task.repeat !== "none" ? `<span>${icon("refresh-cw")}${{ daily: "每天", weekdays: "工作日", weekly: "每周" }[task.repeat]}</span>` : ""}${task.subtasks.length ? `<span>${icon("list-todo")}${task.subtasks.filter((s) => s.done).length}/${task.subtasks.length}</span>` : ""}${!compact && task.tags.length ? `<span class="tag"># ${escape(task.tags.join(" # "))}</span>` : ""}</span></button><div class="task-trailing"><span class="tomato-count ${done >= task.estimate ? "achieved" : ""}">${logo}<span>${done}<small>/${task.estimate}</small></span></span>${selectMode ? "" : `${!task.completed ? `<button class="task-play icon-btn" data-focus-task="${task.id}" aria-label="专注于 ${escape(task.title)}">${icon(selected && state.data.timer.running ? "pause" : "play")}</button>` : ""}<button class="icon-btn task-more" data-edit-task="${task.id}" aria-label="编辑 ${escape(task.title)}">${icon("ellipsis")}</button>`}</div></article>`;
    })
    .join("");
}
function tasksPage() {
  const project = page.startsWith("project:")
    ? state.data.projects.find((p) => p.id === page.slice(8))
    : undefined;
  let tasks = state.data.tasks.filter(
    (t) => !project || t.projectId === project.id,
  );
  const count = tasks.filter((t) => !t.completed).length;
  tasks = tasks.filter(
    (t) =>
      filter === "all" || (filter === "completed" ? t.completed : !t.completed),
  );
  if (search)
    tasks = tasks.filter((t) =>
      `${t.title} ${t.notes} ${t.tags.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  if (priority !== "all")
    tasks = tasks.filter((t) => t.priority === Number(priority));
  const title = project
    ? `${escape(project.name)} <button class="icon-btn title-edit" data-edit-project="${project.id}" aria-label="编辑项目">${icon("pencil")}</button>`
    : "把想做的事，慢慢完成。";
  return `${heading(title, `还有 ${count} 件事等着你。清空头脑，让清单帮你记住。`, "SMALL STEPS, REAL PROGRESS")}
  ${project ? projectWhitelistCard(project) + projectVisionCard(project) : ""}
  <section class="card all-tasks-card"><div class="task-toolbar"><div class="list-tabs">${[
    ["active", "待完成"],
    ["completed", "已完成"],
    ["all", "全部"],
  ]
    .map(
      ([f, l]) =>
        `<button data-filter="${f}" class="${f === filter ? "active" : ""}">${l}</button>`,
    )
    .join(
      "",
    )}</div><div class="toolbar-controls"><label class="inline-search">${icon("search")}<input id="task-search" aria-label="搜索任务" placeholder="搜索标题、标签或备注" value="${escape(search)}"></label><select id="priority-filter" aria-label="筛选优先级"><option value="all">全部优先级</option>${[
    [3, "高优先级"],
    [2, "中优先级"],
    [1, "低优先级"],
    [0, "无优先级"],
  ]
    .map(
      ([v, l]) =>
        `<option value="${v}" ${String(v) === priority ? "selected" : ""}>${l}</option>`,
    )
    .join(
      "",
    )}</select><select id="task-sort" aria-label="排序"><option value="time" ${sort === "time" ? "selected" : ""}>按时间</option><option value="priority" ${sort === "priority" ? "selected" : ""}>优先级</option><option value="created" ${sort === "created" ? "selected" : ""}>创建顺序</option></select>${selectControls()}</div></div><div id="tasks-results">${taskList(tasks)}</div><button class="quick-add" data-action="new-task">${icon("plus")} 添加任务 <kbd>N</kbd></button></section>`;
}
function goalsPage() {
  const goals = state.data.goals;
  const habits = state.data.tasks.filter((t) => isHabit(t) && !t.completed);
  return `${heading("目标、习惯与愿景", "长期的事慢慢积累，日常的事一次做完，远方的事写下来。", "LONG GAMES, SMALL STEPS", false)}
  <section class="card all-tasks-card"><div class="task-toolbar"><div class="list-tabs"><button data-goals-tab="goals" class="${goalsTab === "goals" ? "active" : ""}">目标 <span>${goals.length}</span></button><button data-goals-tab="habits" class="${goalsTab === "habits" ? "active" : ""}">习惯 <span>${state.data.habits.length}</span></button><button data-goals-tab="visions" class="${goalsTab === "visions" ? "active" : ""}">愿景 <span>${state.data.visions.length}</span></button></div><div class="toolbar-controls">${
    goalsTab === "habits"
      ? `<button class="button secondary small-button" data-action="new-habit">${icon("plus")} 新建习惯</button>`
      : goalsTab === "visions"
        ? `<button class="button secondary small-button" data-new-vision="">${icon("plus")} 新建愿景</button>`
        : `<button class="button secondary small-button" data-action="new-goal">${icon("plus")} 新建目标</button>`
  }</div></div>
  ${goalsTab === "habits" ? habitsTab(habits) : goalsTab === "visions" ? visionsTab() : goalsTabContent(goals)}
  </section>`;
}
function goalsTabContent(goals: Goal[]) {
  if (!goals.length)
    return `<div class="empty-state"><div class="empty-illustration">${icon("target")}</div><h3>还没有目标</h3><p>把需要长期积累的事建成目标，把听课、作业等任务挂到它下面。</p><button class="text-button" data-action="new-goal">新建目标 →</button></div>`;
  return goals
    .map((g) => {
      const status = goalState(g);
      const remaining = state.data.tasks.filter(
        (t) => t.goalId === g.id && !t.completed,
      );
      const note =
        status === "achieved"
          ? " · 已达成"
          : status === "failed"
            ? " · 已逾期，任务作废"
            : "";
      const body =
        status === "failed"
          ? `<h4 class="group-title">已作废<span>${remaining.length}</span></h4>${remaining.length ? taskList(remaining) : ""}<p class="subtle small">目标已逾期，这些任务不再补做。</p>`
          : `<h4 class="group-title">待完成<span>${remaining.length}</span></h4>${remaining.length ? taskList(remaining) : '<p class="subtle small">这个目标暂时没有待完成的任务。</p>'}`;
      return `<section class="goal-section"><div class="goal-head"><h3>${icon("target")} ${escape(g.name)}</h3><button class="icon-btn" data-edit-goal="${g.id}" aria-label="编辑目标">${icon("pencil")}</button></div><div class="goal-figure"><b>${progressLabel(g)}</b><span>${escape(g.unit)}${g.dueDate ? ` · 截止 ${dateLabel(g.dueDate)}` : ""}${note}</span></div><div class="progress-track"><i style="width:${Math.min(100, (goalProgress(g) / g.target) * 100)}%"></i></div>${goalVisions(g)}${body}</section>`;
    })
    .join("");
}
function habitsTab(habits: Task[]) {
  const managed = state.data.habits;
  const adhoc = habits.filter((t) => !t.habitId);
  if (!managed.length && !adhoc.length)
    return `<div class="empty-state"><div class="empty-illustration">${icon("clock-3")}</div><h3>还没有习惯</h3><p>把每天要做的事建成习惯，可以为不同星期设置不同时间；过期未做会从今日待办移出并计一次缺勤。</p><button class="text-button" data-action="new-habit">新建习惯 →</button></div>`;
  return [
    ...managed.map((h) => {
      const project = state.data.projects.find((p) => p.id === h.projectId);
      const schedule = h.slots
        .map((s) => `${daysLabel(s.days)} ${s.time}`)
        .join(" · ");
      const today = state.data.tasks.filter(
        (t) => t.habitId === h.id && !t.completed,
      );
      return `<section class="goal-section"><div class="goal-head"><h3>${icon("clock-3")} ${escape(h.name)}</h3><button class="icon-btn" data-edit-habit="${h.id}" aria-label="编辑习惯">${icon("pencil")}</button></div><p class="habit-meta">${project ? `${escape(project.name)} · ` : ""}${escape(schedule)}${h.focusMinutes ? ` · ${h.focusMinutes} 分钟/次` : ""}</p>${today.length ? taskList(today) : '<p class="subtle small">今天没有这一次。</p>'}</section>`;
    }),
    ...(adhoc.length
      ? [
          `<h3 class="group-title">临时定时任务<span>${adhoc.length}</span></h3>${taskList(adhoc)}`,
        ]
      : []),
  ].join("");
}
function habitSlotHtml(days: number[], time: string) {
  return `<div class="habit-slot" data-slot><div class="slot-days">${[1, 2, 3, 4, 5, 6, 7].map((d) => `<label><input type="checkbox" value="${d}" ${days.includes(d) ? "checked" : ""}>${dayLabel(d)}</label>`).join("")}</div><input type="time" value="${escape(time)}" aria-label="时段"><button type="button" class="icon-btn tiny" data-remove-slot aria-label="移除时段">${icon("x")}</button></div>`;
}
function habitDialog(id?: string) {
  const h = state.data.habits.find((h) => h.id === id);
  const slotRow = habitSlotHtml;
  const slots = h?.slots.length ? h.slots : [{ days: [], time: "" }];
  modal(
    `${modalHeader(h ? "编辑习惯" : "新建习惯", "同一个习惯，可以每天不同时间。")}<form id="habit-form"><label class="form-field"><span>习惯名称</span><input name="name" maxlength="40" required autofocus value="${escape(h?.name)}" placeholder="例如：午饭"></label><div class="form-grid"><label class="form-field"><span>所属项目</span><select name="projectId"><option value="">不分类</option>${state.data.projects.map((p) => `<option value="${p.id}" ${h?.projectId === p.id ? "selected" : ""}>${escape(p.name)}</option>`).join("")}</select></label><label class="form-field"><span>单次时长 <small>可选</small></span><input name="focusMinutes" type="number" min="1" max="180" value="${h?.focusMinutes ?? ""}" placeholder="${state.data.settings.focusMinutes} 分钟"></label></div><div class="form-field"><span>每周时段</span><div id="habit-slots">${slots.map((s) => slotRow(s.days, s.time)).join("")}</div><button type="button" class="text-button" id="add-slot">${icon("plus")} 添加时段</button></div><div class="modal-actions">${h ? `<button type="button" class="text-button danger-text" id="delete-habit">删除习惯</button>` : "<span></span>"}<button type="submit" class="button primary">保存习惯</button></div></form>`,
  );
  $("#add-slot").onclick = () =>
    $("#habit-slots").insertAdjacentHTML("beforeend", slotRow([], ""));
  $("#habit-form").addEventListener("click", (e) => {
    const btn = (e.target as Element).closest("[data-remove-slot]");
    if (btn && document.querySelectorAll("[data-slot]").length > 1)
      (btn as HTMLElement).closest("[data-slot]")?.remove();
  });
  $("#habit-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    const formSlots = [
      ...document.querySelectorAll<HTMLElement>("[data-slot]"),
    ].map((row) => ({
      days: [...row.querySelectorAll<HTMLInputElement>("input:checked")].map(
        (c) => Number(c.value),
      ),
      time: row.querySelector<HTMLInputElement>("input[type=time]")!.value,
    }));
    if (
      await act(
        {
          type: "saveHabit",
          id: h?.id || null,
          name: f.get("name"),
          projectId: f.get("projectId") || null,
          focusMinutes: f.get("focusMinutes")
            ? Number(f.get("focusMinutes"))
            : null,
          slots: formSlots,
        },
        "习惯已保存",
      )
    )
      closeModal();
  };
  if (h)
    $("#delete-habit").onclick = () =>
      confirmDialog(
        "删除这个习惯？",
        "已经生成的当天任务会保留为普通定时任务。",
        "删除习惯",
        async () => {
          await act({ type: "deleteHabit", id: h.id }, "习惯已删除");
          closeModal();
        },
        true,
      );
}

function goalVisions(goal: Goal) {
  return state.data.visions
    .filter((v) => v.goalId === goal.id)
    .map(
      (v) =>
        `<p class="vision-line">${icon("sparkles")} <b>${escape(v.name)}</b>${v.notes ? ` — ${escape(v.notes)}` : ""}</p>`,
    )
    .join("");
}
function visionCard(v: Vision) {
  const owner = v.projectId
    ? state.data.projects.find((p) => p.id === v.projectId)?.name || "项目"
    : v.goalId
      ? `目标 · ${state.data.goals.find((g) => g.id === v.goalId)?.name || ""}`
      : "总愿景";
  return `<section class="vision-card"><div class="vision-head"><h3>${icon("sparkles")} ${escape(v.name)}</h3><button class="icon-btn" data-edit-vision="${v.id}" aria-label="编辑愿景">${icon("pencil")}</button></div><span class="vision-owner">${escape(owner)}</span>${v.notes ? `<p class="vision-notes">${escape(v.notes)}</p>` : ""}</section>`;
}
function visionsTab() {
  const all = state.data.visions;
  if (!all.length)
    return `<div class="empty-state"><div class="empty-illustration">${icon("sparkles")}</div><h3>还没有愿景</h3><p>写下你真正想去的地方、想成为的样子。它不影响任务和进度，只写给你自己看。</p><button class="text-button" data-new-vision="">新建愿景 →</button></div>`;
  const global = all.filter((v) => !v.projectId && !v.goalId);
  const owned = all.filter((v) => v.projectId || v.goalId);
  return [
    ...global.map((v) => visionCard(v)),
    ...(owned.length
      ? [
          `<h3 class="group-title">项目与目标的愿景<span>${owned.length}</span></h3>`,
          ...owned.map((v) => visionCard(v)),
        ]
      : []),
  ].join("");
}
function projectVisionCard(project: Project) {
  const items = state.data.visions.filter((v) => v.projectId === project.id);
  return `<section class="card vision-card"><div class="card-heading"><div><h2>愿景</h2><p class="subtle small">这个项目想达成什么；只写给自己看，不参与任务与进度。</p></div><button class="button secondary small-button" data-new-vision="project:${project.id}">${icon("plus")} 添加愿景</button></div>${
    items.length
      ? items
          .map(
            (v) =>
              `<div class="vision-row"><div><b>${escape(v.name)}</b>${v.notes ? `<p>${escape(v.notes)}</p>` : ""}</div><button class="icon-btn" data-edit-vision="${v.id}" aria-label="编辑愿景">${icon("pencil")}</button></div>`,
          )
          .join("")
      : '<p class="subtle small">还没有愿景。</p>'
  }</section>`;
}
function visionDialog(id?: string, ownerArg?: string) {
  const v = state.data.visions.find((v) => v.id === id);
  const owner = v
    ? v.projectId
      ? `project:${v.projectId}`
      : v.goalId
        ? `goal:${v.goalId}`
        : ""
    : ownerArg || "";
  const options: [string, string][] = [
    ["", "总愿景（顶层）"],
    ...state.data.projects.map((p): [string, string] => [
      `project:${p.id}`,
      `项目 · ${p.name}`,
    ]),
    ...state.data.goals.map((g): [string, string] => [
      `goal:${g.id}`,
      `目标 · ${g.name}`,
    ]),
  ];
  modal(
    `${modalHeader(v ? "编辑愿景" : "新建愿景", "它是方向，不是任务：不影响进度，也不会有缺勤。")}<form id="vision-form"><label class="form-field"><span>愿景</span><input name="name" maxlength="40" required autofocus value="${escape(v?.name)}" placeholder="例如：考上北大"></label><label class="form-field"><span>归属</span><select name="owner">${options.map(([val, label]) => `<option value="${val}" ${owner === val ? "selected" : ""}>${escape(label)}</option>`).join("")}</select></label><label class="form-field"><span>写点什么 <small>鸡汤、目标值、想去的地方…</small></span><textarea name="notes" rows="5" placeholder="研究生工资、未来的生活…">${escape(v?.notes)}</textarea></label><div class="modal-actions">${v ? `<button type="button" class="text-button danger-text" id="delete-vision">删除愿景</button>` : "<span></span>"}<button type="submit" class="button primary">保存愿景</button></div></form>`,
  );
  $("#vision-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    const chosen = String(f.get("owner") || "");
    if (
      await act(
        {
          type: "saveVision",
          id: v?.id || null,
          name: f.get("name"),
          notes: f.get("notes"),
          projectId: chosen.startsWith("project:") ? chosen.slice(8) : null,
          goalId: chosen.startsWith("goal:") ? chosen.slice(5) : null,
        },
        "愿景已保存",
      )
    )
      closeModal();
  };
  if (v)
    $("#delete-vision").onclick = () =>
      confirmDialog(
        "删除这个愿景？",
        "只是这段文字，不影响任务与进度。",
        "删除愿景",
        async () => {
          await act({ type: "deleteVision", id: v.id }, "愿景已删除");
          closeModal();
        },
        true,
      );
}
function weekChart(large: boolean) {
  const days = state.stats.days.slice(-7),
    max = Math.max(60 * 60, ...days.map((d) => d.seconds));
  return `<div class="week-chart ${large ? "large" : ""}"><div class="chart-axis"><span>${Math.ceil(max / 60)} 分</span><span>${Math.ceil(max / 120)} 分</span><span>0</span></div><div class="chart-plot"><div class="grid-lines"><i></i><i></i><i></i></div>${days.map((d, i) => `<div class="chart-column"><span class="bar-value">${Math.floor(d.seconds / 60)}<small> 分</small></span><div class="bar-slot"><div class="chart-bar ${i === 6 ? "today" : ""}" style="height:${Math.max(2, (d.seconds / max) * 100)}%" title="${d.date}：${duration(d.seconds)}"></div></div><span class="bar-label ${i === 6 ? "today" : ""}">${i === 6 ? "今天" : new Date(`${d.date}T12:00:00`).toLocaleDateString("zh-CN", { weekday: "short" })}</span></div>`).join("")}</div></div>`;
}
function statsPage() {
  const s = state.stats,
    sessions = [...state.data.sessions].reverse();
  const totals = new Map<string, number>();
  sessions.forEach((session) =>
    totals.set(
      session.projectName,
      (totals.get(session.projectName) || 0) + session.durationSecs,
    ),
  );
  return `${heading("你的投入，都有迹可循。", "不和别人比较，只看见自己的每一点进步。", "YOUR TIME, WELL SPENT", false)}<div class="metrics">${metric("clock-3", "累计专注", Math.floor(s.totalSeconds / 60), "分钟", "每一分钟都算数", "coral")}${metric("target", "完成番茄", s.totalPomodoros, "个", "完整完成的专注周期", "sage")}${metric("flame", "连续专注", s.streak, "天", "从一个小小的坚持开始", "amber")}${metric(
    "alert-circle",
    "习惯缺勤",
    s.days.reduce((a, d) => a + d.missed, 0),
    "次",
    "近 28 天未完成的定时习惯",
    "coral",
  )}</div>
  <div class="stats-grid"><section class="card"><div class="card-heading"><h2>最近 7 天</h2><span class="subtle small">总计 ${duration(s.days.slice(-7).reduce((n, d) => n + d.seconds, 0))}</span></div>${weekChart(true)}</section><section class="card distribution"><div class="card-heading"><h2>时间花在哪里</h2>${icon("folder")}</div>${
    totals.size
      ? [...totals]
          .sort((a, b) => b[1] - a[1])
          .map(
            ([name, secs], i) =>
              `<div class="distribution-row"><div><span>${escape(name)}</span><b>${duration(secs)}</b></div><div class="progress-track"><i style="width:${(secs / s.totalSeconds) * 100}%;background:${["#d87662", "#8b9d7e", "#d1b072", "#a295b9"][i % 4]}"></i></div></div>`,
          )
          .join("")
      : '<div class="small-empty">完成第一段专注，<br>看看时间去了哪里。</div>'
  }</section></div>
  <section class="card history-card"><div class="card-heading"><h2>专注足迹 <span class="count-label">${sessions.length}</span></h2><span class="subtle small">包含提前结束的实际专注时间</span></div>${
    sessions.length
      ? `<div class="history-table"><div class="history-head"><span>任务 / 项目</span><span>日期</span><span>专注时长</span><span>状态</span></div>${sessions
          .slice(0, 100)
          .map(
            (s) =>
              `<div class="history-row"><div><strong>${escape(s.taskTitle)}</strong><small>${escape(s.projectName)}</small></div><span>${new Date(s.endedAt * 1000).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span><span>${duration(s.durationSecs)}</span><span class="badge ${s.completed ? "success" : ""}">${s.completed ? "已完成" : "提前结束"}</span></div>`,
          )
          .join(
            "",
          )}</div>${sessions.length > 100 ? '<p class="subtle small">显示最近 100 条，导出备份可查看全部记录。</p>' : ""}`
      : '<div class="empty-state short"><div class="empty-illustration">' +
        icon("clock-3") +
        '</div><h3>从第一个番茄开始</h3><p>你的每一段专注，都会在这里留下足迹。</p><button class="button secondary" data-page="focus">去专注 ' +
        icon("arrow-right") +
        "</button></div>"
  }</section>`;
}
function settingNumber(
  name: keyof Settings,
  label: string,
  hint: string,
  min: number,
  max: number,
  unit: string,
) {
  return `<label class="setting-row"><span><strong>${label}</strong><small>${hint}</small></span><span class="number-field"><input name="${name}" type="number" min="${min}" max="${max}" required value="${state.data.settings[name]}"><span>${unit}</span></span></label>`;
}
function settingSwitch(name: keyof Settings, label: string, hint: string) {
  return `<label class="setting-row"><span><strong>${label}</strong><small>${hint}</small></span><input class="switch" name="${name}" type="checkbox" ${state.data.settings[name] ? "checked" : ""}></label>`;
}
function settingsPage() {
  const s = state.data.settings;
  return `${heading("找到适合你的节奏。", "好的工具，应该顺着你的习惯。", "MAKE IT YOURS", false)}<form id="settings-form"><div class="settings-grid"><section class="card settings-card"><h2>${icon("timer")} 专注与休息</h2>${settingNumber("focusMinutes", "专注时长", "每个番茄的持续时间", 1, 180, "分钟")}${settingNumber("shortBreakMinutes", "短休息", "让大脑喘口气", 1, 60, "分钟")}${settingNumber("longBreakMinutes", "长休息", "完成一轮后，好好放松", 1, 120, "分钟")}${settingNumber("longBreakEvery", "长休息间隔", "每完成多少个番茄后长休息", 2, 12, "个")}${settingNumber("dailyGoal", "每日目标", "给自己一个可实现的小目标", 1, 30, "个")}${settingSwitch("autoBreak", "自动开始休息", "专注结束后直接进入休息")}${settingSwitch("autoFocus", "自动开始下一轮", "休息结束后自动进入专注")}</section><div><section class="card settings-card"><h2>${icon("settings-2")} 体验与提醒</h2><label class="setting-row"><span><strong>外观主题</strong><small>给专注一个舒服的底色</small></span><select name="theme"><option value="light" ${s.theme === "light" ? "selected" : ""}>奶油白</option><option value="dark" ${s.theme === "dark" ? "selected" : ""}>夜间深色</option><option value="system" ${s.theme === "system" ? "selected" : ""}>跟随系统</option></select></label>${settingSwitch("sound", "完成提示音", "阶段结束时，播放轻柔提示音")}${settingSwitch("notifications", "桌面通知", "在桌面版中提醒专注与休息结束")}${desktop ? settingSwitch("alwaysOnTop", "窗口置顶", "由桌面窗口管理器决定是否支持") : ""}<button type="button" class="text-button" data-action="test-sound">${icon("volume-2")} 试听完成提示音</button></section>${desktopSettingsCard()}<section class="card settings-card data-settings"><h2>${icon("list-todo")} 学习计划</h2><p>导出全部未完成任务与步骤，方便编辑或分享。导入时合并新任务，同 ID 的已有任务保留进度。计划文件不含计时记录和设置。</p><div class="button-row"><button type="button" class="button secondary" data-action="export-plan">${icon("download")} 导出计划</button><button type="button" class="button secondary" data-action="import-plan">${icon("upload")} 导入计划</button></div><div class="note">新导入的任务和步骤从未完成开始；完整进度请使用下方备份。</div></section><section class="card settings-card data-settings"><h2>${icon("download")} 数据与备份</h2><p>任务、设置和专注记录保存在本机。换电脑前，可以导出一份完整备份。</p><div class="button-row"><button type="button" class="button secondary" data-action="export">${icon("download")} 导出备份</button><button type="button" class="button secondary" data-action="import">${icon("upload")} 导入备份</button></div><div class="note">${icon("lock-keyhole")} 无需账号，离线也能使用。</div></section><section class="settings-tip">${icon("leaf")}<p>25 分钟只是起点。<br>最好的节奏，是你能坚持的节奏。</p></section></div></div><div class="settings-save"><span id="settings-status">更改后记得保存</span><button type="submit" class="button primary">${icon("check")} 保存设置</button></div></form>`;
}
function desktopSettingsCard() {
  if (!desktop || !nativeStatus) return "";
  const toggle = (
    name: "autostart" | "closeToTray",
    label: string,
    hint: string,
  ) =>
    `<label class="setting-row"><span><strong>${label}</strong><small>${hint}</small></span><input class="switch" name="${name}" type="checkbox" ${nativeStatus![name] ? "checked" : ""}></label>`;
  return `<section class="card settings-card"><h2>${icon("monitor")} 桌面集成</h2>${toggle("autostart", "登录后自动启动", "后台启动到托盘，点击图标打开窗口")}${toggle("closeToTray", "关闭窗口后留在托盘", "继续计时和提醒；从托盘菜单可以完全退出")}<p class="subtle small">${nativeStatus.trayAvailable ? "托盘已连接。收起窗口后，专注仍会继续。" : "当前未检测到托盘，关闭时会正常退出，后台启动时会显示窗口。"}</p><div class="button-row"><button type="button" class="button secondary" data-action="hide-tray" ${nativeStatus.trayAvailable ? "" : "disabled"}>${icon("minimize-2")} 收起到托盘</button><button type="button" class="text-button" data-action="quit-app">退出应用</button></div></section>`;
}
function projectWhitelistCard(project: Project) {
  if (!guardInfo) void refreshGuard();
  const list = project.appWhitelist ?? [];
  const available = [
    ...new Map(
      (guardInfo?.windows || [])
        .filter((w) => w.app_id)
        .map((w) => [w.app_id!, w]),
    ).values(),
  ];
  const global = state.data.settings.protection.whitelist.length;
  return `<section class="card whitelist-card"><div class="card-heading"><div><h2>应用白名单</h2><p class="subtle small">${
    project.appWhitelist
      ? "已启用专属白名单：专注这个项目的任务时只用这份清单，不再套用通用白名单。导出计划可让 AI 批量修改 appWhitelist 再导入。"
      : `未启用：专注这个项目的任务时沿用通用白名单（当前 ${global} 个应用）。`
  }</p></div>${
    project.appWhitelist
      ? `<button type="button" class="text-button" data-guard-project="${escape(project.id)}" data-disable-project-whitelist="true">改用通用白名单</button>`
      : `<button type="button" class="button secondary small-button" data-guard-project="${escape(project.id)}" data-enable-project-whitelist="true">${icon("plus")} 启用专属白名单</button>`
  }</div>${
    project.appWhitelist
      ? `<div class="whitelist-tags">${
          list
            .map(
              (app) =>
                `<span class="app-tag">${icon("monitor")} ${escape(app)}<button class="icon-btn tiny" data-guard-project="${escape(project.id)}" data-remove-project-app="${escape(app)}" aria-label="移除 ${escape(app)}">${icon("x")}</button></span>`,
            )
            .join("") ||
          '<p class="subtle small">专属清单是空的，专注这个项目时只允许番茄 Todo。</p>'
        }</div><div class="available-apps">${available
          .map(
            (w) =>
              `<button class="available-app" data-guard-project="${escape(project.id)}" data-add-project-app="${escape(w.app_id)}" ${list.includes(w.app_id!) ? "disabled" : ""}>${icon("monitor")}<span><strong>${escape(w.app_id)}</strong><small>${escape(w.title)}</small></span>${icon(list.includes(w.app_id!) ? "check" : "plus")}</button>`,
          )
          .join(
            "",
          )}</div><form id="project-whitelist-form" class="manual-app"><input type="hidden" name="projectId" value="${escape(project.id)}"><input name="appId" maxlength="200" placeholder="手动输入应用 ID，例如 org.mozilla.firefox" aria-label="项目应用 ID" required><button class="button secondary" type="submit">${icon("plus")} 添加</button></form>`
      : ""
  }</section>`;
}
function guardPage() {
  const p = state.data.settings.protection;
  if (!guardInfo) void refreshGuard();
  return `${heading("让分心，暂时留在外面。", "为重要的事，留出一段有边界的时间。", "A QUIETER SPACE FOR YOUR MIND", false)}
  <div class="guard-intro"><div class="guard-emblem">${icon("shield-check")}</div><div><h2>专注保护</h2><p>只在专注计时期间生效，休息时自动解除。保护中无法暂停、修改设置或关闭应用；开启严格模式后，必须等到计时结束。</p></div><span class="badge ${guardInfo?.available ? "success" : ""}">${escape(guardInfo?.backend || "正在检测桌面…")}</span></div>
  <section class="card guard-card"><div class="card-heading"><h2>选择你的专注方式</h2></div><div class="guard-modes">${[
    ["off", "shield-off", "自由专注", "按自己的节奏，随时暂停。"],
    [
      "lock",
      "lock-keyhole",
      "界面锁定",
      "回到全屏专注界面，暂时远离其他应用。",
    ],
    [
      "whitelist",
      "shield-check",
      "应用白名单",
      "允许工作所需的软件，切走时自动拉回。",
    ],
  ]
    .map(
      ([mode, ic, title, desc]) =>
        `<button class="guard-mode ${p.mode === mode ? "selected" : ""}" data-guard-mode="${mode}" ${mode !== "off" && !guardInfo?.available ? "disabled" : ""}>${icon(ic)}<strong>${title}</strong><p>${desc}</p><span class="radio-dot">${p.mode === mode ? icon("check") : ""}</span></button>`,
    )
    .join(
      "",
    )}</div><div class="guard-capability ${guardInfo?.available ? "available" : ""}">${icon(guardInfo?.available ? "check-circle-2" : "alert-circle")}<span>${escape(guardInfo?.message || "正在检查窗口控制接口…")}</span></div></section>
  <section class="card guard-card"><label class="setting-row"><span><strong>严格模式 · 不允许临时退出</strong><small>用于界面锁定和应用白名单。开启后，计时中不能暂停、提前结束或关闭保护；结束时自动解除。</small></span><input id="guard-strict" class="switch" type="checkbox" ${p.strict ? "checked" : ""} ${!guardInfo?.available ? "disabled" : ""}></label><p class="subtle small">请在开始前确认所需应用已加入白名单。未开启严格模式时，仍可通过确认文字提前结束。</p></section><section class="card whitelist-card"><div class="card-heading"><div><h2>允许使用的应用 <span class="count-label">${p.whitelist.length}</span></h2><p class="subtle small">以应用 ID 精确匹配。番茄 Todo 始终允许使用。</p></div><button class="button secondary small-button" data-action="refresh-apps">${icon("refresh-cw")} 刷新应用</button></div><div class="whitelist-tags">${p.whitelist.map((app) => `<span class="app-tag">${icon("monitor")} ${escape(app)}<button class="icon-btn tiny" data-remove-app="${escape(app)}" aria-label="移除 ${escape(app)}">${icon("x")}</button></span>`).join("") || '<p class="subtle small">还没有添加应用。先打开需要使用的软件，再从下方添加。</p>'}</div><div class="available-apps">${[...new Map((guardInfo?.windows || []).filter((w) => w.app_id).map((w) => [w.app_id!, w])).values()].map((w) => `<button class="available-app" data-add-app="${escape(w.app_id)}" ${p.whitelist.includes(w.app_id!) ? "disabled" : ""}>${icon("monitor")}<span><strong>${escape(w.app_id)}</strong><small>${escape(w.title)}</small></span>${icon(p.whitelist.includes(w.app_id!) ? "check" : "plus")}</button>`).join("")}</div><form id="whitelist-form" class="manual-app"><input name="appId" maxlength="200" placeholder="手动输入应用 ID，例如 org.mozilla.firefox" aria-label="应用 ID" required><button class="button secondary" type="submit">${icon("plus")} 添加</button></form></section>
  <div class="guard-explanation">${icon("circle-help")}<p>白名单限制的是整个应用，不区分浏览器网站。此功能使用 niri 的窗口接口，每 0.6 秒检查一次并拉回未允许的窗口；不会结束其他软件。系统快捷键、桌面概览、多个显示器和主动终止进程不属于这项自律保护的管控范围。</p></div>`;
}
async function refreshGuard() {
  try {
    guardInfo = await getGuard();
    if (page === "guard" || page === "lock" || page.startsWith("project:"))
      render();
  } catch (e) {
    toast(String(e));
  }
}
function lockPage() {
  if (!guardInfo) void refreshGuard();
  const available = !!guardInfo?.available;
  const days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  return `${heading("按时放下，也是一种进步。", "给睡眠和休息留一个固定的位置。", "TIME TO REST", false)}
    <section class="card lock-intro"><span class="metric-icon sage">${icon("moon")}</span><div><h2>小憩与定时锁机</h2><p>到点进入全屏休息空间，暂时拦住其他应用。锁机不计入专注时长，结束后自动解除。</p></div></section>
    <div class="lock-grid"><section class="card settings-card"><h2>现在休息一会儿</h2><form id="quick-lock-form"><div class="button-row lock-presets">${[2, 5, 10, 25, 60].map((n) => `<button type="button" class="button secondary" data-lock-minutes="${n}">${n} 分钟</button>`).join("")}</div><label class="form-field"><span>自定义时长（分钟）</span><input name="minutes" type="number" min="1" max="720" value="25" required></label><label class="setting-row"><span><strong>严格执行</strong><small>期间不能提前结束，到时自动解除</small></span><input class="switch" name="strict" type="checkbox"></label><button class="button primary" type="submit" ${available ? "" : "disabled"}>${icon("lock-keyhole")} 开始快速锁机</button></form></section>
    <section class="card settings-card"><div class="card-heading"><h2>固定休息时段</h2><button class="button secondary" data-action="new-lock" ${available ? "" : "disabled"}>${icon("plus")} 添加时段</button></div><p class="subtle small">支持跨午夜，例如 23:00 至次日 07:00。星期按开始的那一天计算；启用的定时时段不能重叠。</p><div class="lock-schedules">${state.data.lock.schedules.map((s) => `<article class="lock-schedule"><div><strong>${escape(s.name)}</strong><span class="badge">${s.strict ? "严格执行" : "可提前结束"}</span><h3>${s.start} — ${s.end <= s.start ? "次日 " : ""}${s.end}</h3><p class="subtle small">${s.days.map((d) => days[d - 1]).join(" · ")}</p></div><div class="button-row"><button class="button secondary small-button" data-toggle-lock="${escape(s.id)}" ${available || s.enabled ? "" : "disabled"}>${s.enabled ? "停用" : "启用"}</button><button class="icon-btn" data-edit-lock="${escape(s.id)}" aria-label="编辑 ${escape(s.name)}">${icon("pencil")}</button><button class="icon-btn" data-delete-lock="${escape(s.id)}" aria-label="删除 ${escape(s.name)}">${icon("trash-2")}</button></div></article>`).join("") || '<p class="small-empty">还没有安排锁机时段。先给今晚的睡眠留出时间吧。</p>'}</div></section></div>
    <div class="guard-capability ${available ? "available" : ""}">${icon(available ? "check-circle-2" : "alert-circle")}<span>${escape(guardInfo?.message || "正在检查桌面…")}</span></div>
    <p class="subtle small">应用需要保持运行，可收起到托盘并开启登录自启动。电脑休眠期间不唤醒，恢复或重新打开时若仍在时段内会继续锁机。严格模式限制应用内退出；系统快捷键和外部结束进程仍由操作系统控制。</p>`;
}
async function saveLockSchedule(schedule: LockSchedule) {
  const save = async () => {
    await act({ type: "saveLockSchedule", schedule }, "锁机时段已保存");
  };
  if (schedule.enabled) {
    confirmDialog(
      "启用这个锁机时段？",
      `${schedule.name}：${schedule.start} — ${schedule.end <= schedule.start ? "次日 " : ""}${schedule.end}。${schedule.strict ? "严格执行期间不能提前退出。" : "可通过确认文字提前结束本轮。"}若当前已在所选时段内，会立即锁机。`,
      "启用时段",
      save,
    );
  } else await save();
}
function lockDialog(id?: string) {
  const s = state.data.lock.schedules.find((s) => s.id === id);
  modal(
    `${modalHeader(s ? "编辑锁机时段" : "为休息留出时间")}<form id="lock-schedule-form"><label class="form-field"><span>名称</span><input name="name" maxlength="40" required value="${escape(s?.name || "睡眠")}"></label><div class="form-grid"><label class="form-field"><span>开始时间</span><input name="start" type="time" value="${s?.start || "23:00"}" required></label><label class="form-field"><span>结束时间（早于开始则跨午夜）</span><input name="end" type="time" value="${s?.end || "07:00"}" required></label></div><div class="lock-days">${["一", "二", "三", "四", "五", "六", "日"].map((d, i) => `<label><input type="checkbox" name="days" value="${i + 1}" ${!s || s.days.includes(i + 1) ? "checked" : ""}>周${d}</label>`).join("")}</div><label class="setting-row"><span><strong>严格执行</strong><small>生效期间不允许临时退出或改动规则</small></span><input class="switch" name="strict" type="checkbox" ${s?.strict ? "checked" : ""}></label><label class="setting-row"><span><strong>启用时段</strong><small>保存后按所选日期和时间执行</small></span><input class="switch" name="enabled" type="checkbox" ${!s || s.enabled ? "checked" : ""}></label><div class="modal-actions"><button type="button" class="button secondary" data-action="close-modal">取消</button><button class="button primary" type="submit">保存时段</button></div></form>`,
  );
  $("#lock-schedule-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    const days = f.getAll("days").map(Number);
    if (!days.length) {
      toast("请至少选择一天");
      return;
    }
    if (f.get("start") === f.get("end")) {
      toast("开始和结束时间不能相同");
      return;
    }
    const schedule: LockSchedule = {
      id: s?.id || crypto.randomUUID(),
      name: String(f.get("name")).trim(),
      start: String(f.get("start")),
      end: String(f.get("end")),
      days,
      strict: f.has("strict"),
      enabled: f.has("enabled"),
    };
    closeModal();
    await saveLockSchedule(schedule);
  });
}
function renderImmersive() {
  const locked = protectedNow(),
    p = state.data.settings.protection,
    rest = state.data.lock.active;
  const remaining = rest
    ? Math.max(0, rest.endsAt - state.serverTime)
    : state.remainingSecs;
  $("#app").innerHTML =
    `<div class="immersive ${locked ? "protected" : ""} ${rest ? "sleep-space" : ""}"><header><span class="brand"><span class="brand-mark">${logo}</span>番茄 Todo</span><span class="badge">${icon(rest ? "moon" : locked ? "shield-check" : "leaf")} ${rest ? "休息锁机中" : locked ? (p.mode === "lock" ? "界面锁定中" : "应用白名单保护中") : "沉浸专注"}</span>${!locked ? `<button class="icon-btn" data-action="immersive" aria-label="退出沉浸模式">${icon("minimize-2")}</button>` : "<span></span>"}</header><section><div class="eyebrow">${rest ? "REST IS PART OF THE PLAN" : "JUST YOU AND THIS MOMENT"}</div><h1>${rest ? "今天的努力，值得一场好眠。" : locked ? "此刻，只做这一件事。" : "让世界安静一会儿。"}</h1>${locked ? `<div class="protected-clock clock">${time(remaining)}</div><p>${escape(rest?.name || state.data.tasks.find((t) => t.id === state.data.timer.taskId)?.title || "自由专注")}</p><div class="protected-note">${icon("shield-check")} ${rest ? `预计 ${new Date(rest.endsAt * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 自动解除 · 不计入专注时长` : p.mode === "lock" ? "其他应用会被自动切回这个专注空间" : `允许使用 ${p.whitelist.length} 个应用，其他应用会被切回`}</div><div class="subtle small" id="blocked-count">${blockedCount ? `已为你挡住 ${blockedCount} 次分心` : rest ? "放下屏幕，让眼睛和思绪一起休息。" : "你只需要照顾好眼前这一小段时间。"}</div>${strictNow() ? '<p class="strict-status">严格执行中 · 到时自动解除</p>' : '<button class="text-button emergency" data-action="emergency">有急事，提前结束</button>'}` : timerContent()}</section><footer>${rest ? "晚安，明天再慢慢向前。" : "呼吸，放松肩膀。你正在向前走。"}</footer></div>`;
  icons();
  updateClock();
}
function updateClock() {
  document
    .querySelectorAll(".clock")
    .forEach(
      (el) =>
        (el.textContent = time(
          state.data.lock.active
            ? Math.max(0, state.data.lock.active.endsAt - state.serverTime)
            : state.remainingSecs,
        )),
    );
  const ring = document.querySelector<SVGCircleElement>(".ring-progress");
  if (ring) {
    ring.style.strokeDasharray = `${2 * Math.PI * 134}`;
    ring.style.strokeDashoffset = `${2 * Math.PI * 134 * (1 - state.remainingSecs / state.data.timer.durationSecs)}`;
  }
  document.title = state.data.timer.running
    ? `${time(state.remainingSecs)} · ${modeLabels[state.data.timer.mode]} · 番茄 Todo`
    : "番茄 Todo · 把时间留给重要的事";
}

function modal(content: string, wide = false) {
  lastFocus = document.activeElement as HTMLElement;
  $("#modal-root").innerHTML =
    `<div class="modal-backdrop"><section class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title">${content}</section></div>`;
  $("#app").inert = true;
  icons();
  requestAnimationFrame(() =>
    document
      .querySelector<HTMLElement>(
        ".modal [autofocus], .modal input, .modal button",
      )
      ?.focus(),
  );
}
function closeModal() {
  $("#modal-root").innerHTML = "";
  $("#app").inert = false;
  lastFocus?.focus();
}
const modalHeader = (title: string, subtitle = "") =>
  `<div class="modal-heading"><div><h2 id="modal-title">${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div><button class="icon-btn" data-action="close-modal" aria-label="关闭对话框">${icon("x")}</button></div>`;
function confirmDialog(
  title: string,
  message: string,
  confirm: string,
  callback: () => void,
  danger = false,
) {
  modal(
    `${modalHeader(title)}<p class="confirm-message">${escape(message)}</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">取消</button><button class="button ${danger ? "danger" : "primary"}" id="confirm-button">${confirm}</button></div>`,
  );
  $("#confirm-button").onclick = () => {
    closeModal();
    callback();
  };
}
function taskDialog(id?: string) {
  const task = state.data.tasks.find((t) => t.id === id);
  const projectId =
    task?.projectId || (page.startsWith("project:") ? page.slice(8) : "");
  const subs = task?.subtasks.map((s) => ({ ...s })) || [];
  modal(
    `${modalHeader(task ? "编辑任务" : "种下一个小目标", "把事情写下来，就已经开始了。")}<form id="task-form"><label class="form-field"><span>任务名称</span><input name="title" placeholder="你想完成什么？" maxlength="200" required autofocus value="${escape(task?.title)}"></label><label class="form-field"><span>类型 <small>按条件自动识别，也可手动指定</small></span><select name="taskType" id="task-type"><option value="focus">普通任务</option><option value="goal">目标</option><option value="habit">习惯</option></select></label><p id="task-type-hint" class="type-hint"></p><div id="new-habit-inline" class="inline-create" hidden><span class="subtle small">习惯按不同星期可有不同时间，为它加上时段：</span><div id="task-habit-slots">${habitSlotHtml([], "")}</div><button type="button" id="add-task-slot" class="text-button">${icon("plus")} 添加时段</button><button type="button" id="create-habit" class="button secondary small-button">创建习惯组</button></div><div class="form-grid"><label class="form-field"><span>所属项目</span><select name="projectId"><option value="">收件箱 · 不分类</option>${state.data.projects.map((p) => `<option value="${p.id}" ${projectId === p.id ? "selected" : ""}>${escape(p.name)}</option>`).join("")}</select></label><label class="form-field"><span>所属目标</span><select name="goalId"><option value="">不属于目标</option>${state.data.goals.map((g) => `<option value="${g.id}" ${task?.goalId === g.id ? "selected" : ""}>${escape(g.name)}</option>`).join("")}<option value="__new__">＋ 新建目标…</option></select></label><div id="new-goal-inline" class="inline-create" hidden><input name="newGoalName" maxlength="40" placeholder="目标名称"><input name="newGoalTarget" type="number" min="0.1" step="0.1" value="1" placeholder="目标量" aria-label="目标量"><input name="newGoalUnit" maxlength="10" placeholder="单位（节/小时）" aria-label="单位"><button type="button" id="create-goal" class="button secondary small-button">创建并选用</button></div><label class="form-field"><span>计划日期</span><input name="dueDate" type="date" value="${task ? task.dueDate || "" : state.today}"></label><label class="form-field"><span>提醒时间 <small>可选，到点唤出任务</small></span><input name="reminderTime" type="time" value="${escape(task?.reminderTime)}"></label><label class="form-field"><span>单次专注时长 <small>可选，留空跟随全局设置</small></span><input name="focusMinutes" type="number" min="1" max="180" placeholder="${state.data.settings.focusMinutes} 分钟" value="${task?.focusMinutes || ""}"></label><label class="form-field"><span>优先级</span><select name="priority">${[
      [0, "无优先级"],
      [1, "低优先级"],
      [2, "中优先级"],
      [3, "高优先级"],
    ]
      .map(
        ([v, l]) =>
          `<option value="${v}" ${v === (task?.priority || 0) ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label><label class="form-field"><span>预计番茄数</span><input name="estimate" type="number" min="1" max="99" required value="${task?.estimate || 1}"></label></div><p class="subtle small">时间要求明确时填写提醒时间与单次时长；灵活任务留空即可，不会自动唤出窗口。提醒需要计划日期，重复任务沿用此时间。</p><label class="form-field"><span>重复计划 <small>完成后自动创建下一次任务</small></span><select name="repeat">${[
      ["none", "不重复"],
      ["daily", "每天"],
      ["weekdays", "工作日"],
      ["weekly", "每周"],
    ]
      .map(
        ([v, l]) =>
          `<option value="${v}" ${v === (task?.repeat || "none") ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label><label class="form-field"><span>备注 <small>可选</small></span><textarea name="notes" rows="3" maxlength="15000" placeholder="思路、参考资料，或者给自己的提醒…">${escape(task?.notes)}</textarea></label><label class="form-field"><span>标签 <small>用逗号分隔</small></span><input name="tags" placeholder="例如：重要, 阅读" value="${escape(task?.tags.join(", "))}"></label><div class="form-field"><span>拆成更小的步骤</span><div id="subtask-editor"></div><div class="subtask-add"><input id="subtask-input" placeholder="添加一个子任务" maxlength="200"><button type="button" class="icon-btn" id="add-subtask" aria-label="添加子任务">${icon("plus")}</button></div></div><div class="modal-actions">${task ? `<button type="button" class="text-button danger-text" data-delete-task="${task.id}">${icon("trash-2")} 删除任务</button>` : '<span class="subtle small">从一件小事开始。</span>'}<div><button type="button" class="button secondary" data-action="close-modal">取消</button><button type="submit" class="button primary">${icon("check")} ${task ? "保存修改" : "创建任务"}</button></div></div></form>`,
    true,
  );
  function drawSubs() {
    $("#subtask-editor").innerHTML = subs
      .map(
        (s, i) =>
          `<div class="subtask-editor-row"><input type="checkbox" data-sub-index="${i}" aria-label="完成子任务" ${s.done ? "checked" : ""}><span>${escape(s.title)}</span><button class="icon-btn tiny" type="button" data-sub-delete="${i}" aria-label="删除子任务">${icon("x")}</button></div>`,
      )
      .join("");
    icons();
    document.querySelectorAll<HTMLInputElement>("[data-sub-index]").forEach(
      (el) =>
        (el.onchange = () => {
          subs[Number(el.dataset.subIndex)].done = el.checked;
        }),
    );
    document.querySelectorAll<HTMLButtonElement>("[data-sub-delete]").forEach(
      (el) =>
        (el.onclick = () => {
          subs.splice(Number(el.dataset.subDelete), 1);
          drawSubs();
        }),
    );
  }
  const addSub = () => {
    const input = $<HTMLInputElement>("#subtask-input");
    if (input.value.trim()) {
      subs.push({
        id: crypto.randomUUID(),
        title: input.value.trim(),
        done: false,
      });
      input.value = "";
      drawSubs();
    }
  };
  $("#add-subtask").onclick = addSub;
  $("#subtask-input").addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") {
      e.preventDefault();
      addSub();
    }
  });
  drawSubs();
  // Type is derived from the fields until the user picks one; after that we only
  // validate and give feedback instead of switching it around.
  const form = document.querySelector<HTMLFormElement>("#task-form")!;
  const typeSelect = document.querySelector<HTMLSelectElement>("#task-type")!;
  const hint = document.querySelector<HTMLElement>("#task-type-hint")!;
  const value = (name: string) =>
    (form.querySelector(`[name=${name}]`) as HTMLInputElement | null)?.value ??
    "";
  let typeOverridden = false;
  const derivedType = () => {
    if (value("goalId")) return "goal";
    if (value("reminderTime") && value("repeat") !== "none") return "habit";
    return "focus";
  };
  const typeErrors = (type: string) => {
    const goalId = value("goalId"),
      reminder = value("reminderTime"),
      repeat = value("repeat"),
      errors: string[] = [];
    if (type === "goal") {
      if (!goalId) errors.push("目标任务要选择所属目标");
      if (!reminder) errors.push("目标任务要有精确时间");
      if (repeat !== "none") errors.push("目标任务不能重复，请改用习惯");
    } else if (type === "habit") {
      if (!reminder) errors.push("习惯要有精确时间");
      if (repeat === "none") errors.push("习惯要设置重复周期");
      if (goalId) errors.push("习惯不能属于目标");
    } else {
      if (goalId) errors.push("普通任务不能属于目标");
      if (reminder && repeat !== "none")
        errors.push("有提醒和重复，应归为习惯");
    }
    return errors;
  };
  const typeLabels: Record<string, string> = {
    focus: "普通任务",
    goal: "目标",
    habit: "习惯",
  };
  const habitInline = document.querySelector<HTMLElement>("#new-habit-inline")!;
  const goalInline = document.querySelector<HTMLElement>("#new-goal-inline")!;
  const goalSelect = document.querySelector<HTMLSelectElement>(
    "#task-form [name=goalId]",
  )!;
  const syncType = () => {
    if (!typeOverridden) typeSelect.value = derivedType();
    const type = typeSelect.value;
    const errors = typeErrors(type);
    hint.className = `type-hint ${errors.length ? "error" : ""}`;
    hint.textContent = errors.length
      ? errors[0]
      : typeOverridden
        ? `已手动指定为「${typeLabels[type]}」，按该类型校验`
        : `自动识别为「${typeLabels[type]}」`;
    habitInline.hidden = type !== "habit";
  };
  form.addEventListener("input", syncType);
  form.addEventListener("change", syncType);
  typeSelect.addEventListener("change", () => {
    typeOverridden = true;
    syncType();
  });
  goalSelect.addEventListener("change", () => {
    goalInline.hidden = goalSelect.value !== "__new__";
    if (goalSelect.value === "__new__") goalSelect.value = "";
    syncType();
  });
  $("#create-goal").addEventListener("click", async () => {
    const name = value("newGoalName").trim();
    if (!name) return toast("先给目标起个名字");
    await act(
      {
        type: "saveGoal",
        id: null,
        name,
        target: Number(value("newGoalTarget")) || 1,
        unit: value("newGoalUnit").trim() || "次",
        measure: "count",
        dueDate: null,
      },
      "目标已创建",
    );
    const created = state.data.goals[state.data.goals.length - 1];
    if (created) goalSelect.value = created.id;
    goalInline.hidden = true;
    syncType();
  });
  $("#add-task-slot").addEventListener("click", () =>
    $("#task-habit-slots").insertAdjacentHTML(
      "beforeend",
      habitSlotHtml([], ""),
    ),
  );
  $("#new-habit-inline").addEventListener("click", (e) => {
    const btn = (e.target as Element).closest("[data-remove-slot]");
    if (
      btn &&
      document.querySelectorAll("#task-habit-slots [data-slot]").length > 1
    )
      (btn as HTMLElement).closest("[data-slot]")?.remove();
  });
  $("#create-habit").addEventListener("click", async () => {
    const title = value("title").trim();
    if (!title) return toast("先给习惯起个名字");
    const slots = [
      ...document.querySelectorAll<HTMLElement>(
        "#task-habit-slots [data-slot]",
      ),
    ].map((row) => ({
      days: [...row.querySelectorAll<HTMLInputElement>("input:checked")].map(
        (c) => Number(c.value),
      ),
      time: row.querySelector<HTMLInputElement>("input[type=time]")!.value,
    }));
    await act(
      {
        type: "saveHabit",
        id: null,
        name: title,
        projectId: value("projectId") || null,
        focusMinutes: value("focusMinutes")
          ? Number(value("focusMinutes"))
          : null,
        slots,
      },
      "习惯组已创建",
    );
    closeModal();
  });
  syncType();
  $("#task-form").onsubmit = async (e) => {
    e.preventDefault();
    addSub();
    if (typeErrors(typeSelect.value).length) {
      syncType();
      hint.scrollIntoView({ block: "center" });
      return;
    }
    const f = new FormData(e.target as HTMLFormElement);
    const ok = await act(
      {
        type: "saveTask",
        task: {
          id: task?.id || null,
          title: f.get("title"),
          notes: f.get("notes"),
          projectId: f.get("projectId") || null,
          goalId: f.get("goalId") || null,
          dueDate: f.get("dueDate") || null,
          reminderTime: f.get("reminderTime") || null,
          focusMinutes: f.get("focusMinutes")
            ? Number(f.get("focusMinutes"))
            : null,
          priority: Number(f.get("priority")),
          estimate: Number(f.get("estimate")),
          repeat: f.get("repeat"),
          tags: String(f.get("tags"))
            .split(/[,，]/)
            .map((s) => s.trim())
            .filter(Boolean),
          subtasks: subs,
        },
      },
      task ? "任务已更新" : "新的小目标已添加",
    );
    if (ok) closeModal();
  };
}
function projectDialog(id?: string) {
  const p = state.data.projects.find((p) => p.id === id),
    colors = ["#df7561", "#849b7d", "#d5a553", "#8b92b9", "#75a5ac", "#b787a3"];
  modal(
    `${modalHeader(p ? "编辑项目" : "新建项目", "把相关的任务，放在一起。")}<form id="project-form"><label class="form-field"><span>项目名称</span><input name="name" maxlength="40" required autofocus value="${escape(p?.name)}" placeholder="例如：学习 Rust"></label><label class="form-field"><span>项目颜色</span><input name="color" type="color" value="${p?.color || colors[state.data.projects.length % colors.length]}"></label><div class="modal-actions">${p ? `<button type="button" class="text-button danger-text" id="delete-project">删除项目</button>` : "<span></span>"}<button type="submit" class="button primary">保存项目</button></div></form>`,
  );
  $("#project-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    if (
      await act(
        {
          type: "saveProject",
          id: p?.id || null,
          name: f.get("name"),
          color: f.get("color"),
        },
        "项目已保存",
      )
    )
      closeModal();
  };
  if (p)
    $("#delete-project").onclick = () =>
      confirmDialog(
        "删除这个项目？",
        "项目中的任务会移到收件箱，专注记录会保留。",
        "删除项目",
        async () => {
          page = "tasks";
          await act({ type: "deleteProject", id: p.id }, "项目已删除");
        },
        true,
      );
}
function goalDialog(id?: string) {
  const g = state.data.goals.find((g) => g.id === id);
  modal(
    `${modalHeader(g ? "编辑目标" : "新建目标", "给长期的事，一个能积累的位置。")}<form id="goal-form"><label class="form-field"><span>目标名称</span><input name="name" maxlength="40" required autofocus value="${escape(g?.name)}" placeholder="例如：OpenCamp 学习"></label><div class="form-grid"><label class="form-field"><span>计量方式</span><select name="measure"><option value="count" ${g?.measure !== "time" ? "selected" : ""}>按数量</option><option value="time" ${g?.measure === "time" ? "selected" : ""}>按时长</option></select></label><label class="form-field"><span>目标量</span><input name="target" type="number" min="0.1" step="0.1" required value="${g?.target ?? 1}"></label><label class="form-field"><span>单位</span><input name="unit" maxlength="10" required value="${escape(g?.unit)}" placeholder="节 / 小时 / 次"></label><label class="form-field"><span>截止日期 <small>可选</small></span><input name="dueDate" type="date" value="${g?.dueDate || ""}"></label></div><div class="modal-actions">${g ? `<button type="button" class="text-button danger-text" id="delete-goal">删除目标</button>` : "<span></span>"}<button type="submit" class="button primary">保存目标</button></div></form>`,
  );
  $("#goal-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    if (
      await act(
        {
          type: "saveGoal",
          id: g?.id || null,
          name: f.get("name"),
          target: Number(f.get("target")),
          unit: f.get("unit"),
          measure: f.get("measure"),
          dueDate: f.get("dueDate") || null,
        },
        "目标已保存",
      )
    )
      closeModal();
  };
  if (g)
    $("#delete-goal").onclick = () =>
      confirmDialog(
        "删除这个目标？",
        "目标下的任务会保留，但不再计入目标。",
        "删除目标",
        async () => {
          page = "tasks";
          await act({ type: "deleteGoal", id: g.id }, "目标已删除");
        },
        true,
      );
}
function chooseTask() {
  const tasks = state.data.tasks.filter((t) => !t.completed);
  modal(
    `${modalHeader("这一刻，专注什么？")}<div class="task-picker"><button data-pick-task="">${icon("leaf")}<span>自由专注<small>留一段属于自己的时间</small></span>${icon("chevron-right")}</button>${tasks.map((t) => `<button data-pick-task="${t.id}">${icon("target")}<span>${escape(t.title)}<small>${escape(projectOf(t)?.name || "收件箱")}</small></span>${icon("chevron-right")}</button>`).join("")}</div>`,
  );
}
function searchDialog() {
  modal(
    `${modalHeader("找一件想做的事")}<label class="global-search">${icon("search")}<input id="global-search-input" placeholder="搜索任务、备注或标签…" autofocus></label><div id="global-search-results" class="task-picker"></div>`,
  );
  const draw = () => {
    const q = $<HTMLInputElement>("#global-search-input").value.toLowerCase();
    const tasks = state.data.tasks
      .filter((t) =>
        `${t.title} ${t.notes} ${t.tags.join(" ")}`.toLowerCase().includes(q),
      )
      .slice(0, 30);
    $("#global-search-results").innerHTML =
      tasks
        .map(
          (t) =>
            `<button data-edit-task="${t.id}">${icon(t.completed ? "check-circle-2" : "list-todo")}<span>${escape(t.title)}<small>${escape(projectOf(t)?.name || "收件箱")}</small></span>${icon("chevron-right")}</button>`,
        )
        .join("") || '<p class="small-empty">没有匹配的任务</p>';
    icons();
  };
  $("#global-search-input").addEventListener("input", draw);
  draw();
}
function helpDialog() {
  modal(
    `${modalHeader("让操作更轻一点")}<div class="shortcut-list">${[
      ["N / Ctrl N", "新建任务"],
      ["Ctrl K / Ctrl F", "搜索所有任务"],
      ["Space", "开始 / 暂停计时"],
      ["Esc", "关闭弹窗 / 退出沉浸模式"],
    ]
      .map(
        ([key, label]) => `<div><span>${label}</span><kbd>${key}</kbd></div>`,
      )
      .join(
        "",
      )}</div><p class="subtle small">输入文字时不会触发计时快捷键。专注保护期间只开放紧急退出。</p>`,
  );
}
function soundDialog() {
  modal(
    `${modalHeader("为专注，添一点声音", "在本地合成的背景音，不需要联网。")}<div class="sound-options">${[
      ["off", "volume-x", "安静"],
      ["rain", "headphones", "柔和雨声"],
      ["brown", "leaf", "低沉棕噪音"],
    ]
      .map(
        ([kind, ic, title]) =>
          `<button class="${noiseKind === kind ? "selected" : ""}" data-noise="${kind}">${icon(ic)}${title}</button>`,
      )
      .join(
        "",
      )}</div><label class="form-field"><span>音量</span><input id="noise-volume" type="range" min="0" max="0.8" step="0.02" value="0.2"></label>`,
  );
  $("#noise-volume").addEventListener("input", (e) =>
    setNoiseVolume(Number((e.target as HTMLInputElement).value)),
  );
}
function emergencyDialog() {
  if (strictNow()) {
    toast("严格模式中，请等待结束后自动解除");
    return;
  }
  modal(
    `${modalHeader("有更重要的事，需要现在处理？")}<p class="confirm-message">提前结束会解除所有专注保护。已经投入的时间仍会保留，本轮不计为完整番茄。</p><label class="form-field"><span>输入「结束专注」以确认</span><input id="emergency-text" autocomplete="off" placeholder="结束专注" autofocus></label><div class="modal-actions"><button class="button secondary" data-action="close-modal">继续专注</button><button class="button danger" id="emergency-confirm" disabled>结束并解锁</button></div>`,
  );
  $("#emergency-text").addEventListener("input", (e) => {
    $<HTMLButtonElement>("#emergency-confirm").disabled =
      (e.target as HTMLInputElement).value !== "结束专注";
  });
  $("#emergency-confirm").onclick = async () => {
    if (await act({ type: "emergencyUnlock" }, "已解除保护，专注时间已保留")) {
      immersive = false;
      closeModal();
      render();
    }
  };
}
function bindForms() {
  document
    .querySelector<HTMLInputElement>("#guard-strict")
    ?.addEventListener("change", async (e) => {
      const strict = (e.target as HTMLInputElement).checked;
      const save = async () => {
        await act(
          {
            type: "saveSettings",
            settings: {
              ...state.data.settings,
              protection: { ...state.data.settings.protection, strict },
            },
          },
          "严格模式设置已保存",
        );
      };
      if (strict) {
        (e.target as HTMLInputElement).checked = false;
        confirmDialog(
          "启用严格模式？",
          "下次开始界面锁定或白名单专注后，不能暂停、提前结束、修改规则或从应用内退出。请提前确认白名单。",
          "启用严格模式",
          save,
        );
      } else await save();
    });
  document
    .querySelector<HTMLFormElement>("#quick-lock-form")
    ?.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = new FormData(e.target as HTMLFormElement);
      const minutes = Number(f.get("minutes")),
        strict = f.has("strict");
      confirmDialog(
        "现在开始锁机？",
        `将锁机 ${minutes} 分钟。${strict ? "严格执行期间不能临时退出。" : "可通过确认文字提前结束。"}当前专注会结束并保留实际用时，休息不计入专注统计。`,
        "开始锁机",
        async () => {
          await act({ type: "startQuickLock", minutes, strict });
        },
      );
    });
  document
    .querySelector<HTMLFormElement>("#settings-form")
    ?.addEventListener("input", () => {
      settingsDirty = true;
      $("#settings-status").textContent = "有未保存的更改";
    });
  document
    .querySelector<HTMLFormElement>("#settings-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target as HTMLFormElement);
      const settings = { ...state.data.settings };
      for (const key of [
        "focusMinutes",
        "shortBreakMinutes",
        "longBreakMinutes",
        "longBreakEvery",
        "dailyGoal",
      ] as const)
        settings[key] = Number(f.get(key));
      for (const key of [
        "autoBreak",
        "autoFocus",
        "sound",
        "notifications",
      ] as const)
        settings[key] = f.has(key);
      if (desktop) settings.alwaysOnTop = f.has("alwaysOnTop");
      settings.theme = f.get("theme") as Settings["theme"];
      if (desktop && nativeStatus) {
        try {
          nativeStatus = await saveDesktopSettings(
            f.has("autostart"),
            f.has("closeToTray"),
          );
        } catch (error) {
          toast(`桌面设置未保存：${String(error)}`);
          return;
        }
      }
      if (
        await act({ type: "saveSettings", settings }, "已保存，按你的节奏来。")
      ) {
        settingsDirty = false;
        render();
      }
    });
  document
    .querySelector<HTMLInputElement>("#task-search")
    ?.addEventListener("input", (e) => {
      search = (e.target as HTMLInputElement).value;
      updateTaskResults();
    });
  document
    .querySelector<HTMLSelectElement>("#priority-filter")
    ?.addEventListener("change", (e) => {
      priority = (e.target as HTMLSelectElement).value;
      updateTaskResults();
    });
  document
    .querySelector<HTMLSelectElement>("#task-sort")
    ?.addEventListener("change", (e) => {
      sort = (e.target as HTMLSelectElement).value;
      updateTaskResults();
    });
  document
    .querySelector<HTMLFormElement>("#whitelist-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target as HTMLFormElement);
      await addWhitelist(String(f.get("appId")).trim());
    });
  document
    .querySelector<HTMLFormElement>("#project-whitelist-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target as HTMLFormElement);
      await addProjectWhitelist(
        String(f.get("projectId")),
        String(f.get("appId")).trim(),
      );
    });
}
function updateTaskResults() {
  let tasks = state.data.tasks.filter(
    (t) =>
      (!page.startsWith("project:") || t.projectId === page.slice(8)) &&
      (filter === "all" ||
        (filter === "completed" ? t.completed : !t.completed)) &&
      (priority === "all" || t.priority === Number(priority)) &&
      `${t.title} ${t.notes} ${t.tags.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  $("#tasks-results").innerHTML = taskList(tasks);
  icons();
}
async function addWhitelist(app: string) {
  if (!app) return;
  const p = state.data.settings.protection;
  if (!p.whitelist.includes(app))
    await act(
      {
        type: "saveSettings",
        settings: {
          ...state.data.settings,
          protection: { ...p, whitelist: [...p.whitelist, app] },
        },
      },
      "已加入白名单",
    );
}
async function saveProjectWhitelist(
  id: string,
  whitelist: string[] | null,
  message?: string,
) {
  await act({ type: "setProjectWhitelist", id, whitelist }, message);
}
async function addProjectWhitelist(id: string, app: string) {
  const project = state.data.projects.find((p) => p.id === id);
  if (!project || !app || project.appWhitelist?.includes(app)) return;
  await saveProjectWhitelist(
    id,
    [...(project.appWhitelist ?? []), app],
    "已加入项目白名单",
  );
}
async function removeProjectWhitelist(id: string, app: string) {
  const project = state.data.projects.find((p) => p.id === id);
  if (!project?.appWhitelist) return;
  await saveProjectWhitelist(
    id,
    project.appWhitelist.filter((a) => a !== app),
  );
}
async function toggleTimer() {
  if (
    !state.data.timer.running &&
    state.data.timer.mode === "focus" &&
    state.data.settings.protection.mode !== "off" &&
    state.data.settings.protection.strict
  ) {
    confirmDialog(
      "开始严格专注？",
      `本轮剩余 ${time(state.remainingSecs)}，期间不能临时退出或更改白名单。到时自动解除。`,
      "开始严格专注",
      async () => {
        unlockAudio();
        await act({ type: "startTimer" });
      },
    );
    return;
  }
  unlockAudio();
  await act({ type: state.data.timer.running ? "pauseTimer" : "startTimer" });
}
async function importBackup() {
  try {
    const data = await readImport();
    if (!data) return;
    confirmDialog(
      "用备份替换当前数据？",
      "任务、项目、专注记录和设置将被备份替换。导入的计时器会暂停，定时锁机规则会保留但停用。建议先导出当前数据。",
      "导入并替换",
      async () => {
        await act({ type: "import", data }, "备份已导入");
      },
      true,
    );
  } catch (e) {
    toast(String(e));
  }
}
async function importPlan() {
  try {
    const plan = await readPlan();
    if (!plan) return;
    if (
      plan.format !== "tomato-todo-plan" ||
      ![1, 2].includes(plan.version) ||
      !Array.isArray(plan.tasks) ||
      !Array.isArray(plan.projects)
    ) {
      throw new Error(
        "请选择 tomato-todo-plan v1/v2 计划文件；完整备份请使用“导入备份”。",
      );
    }
    const existing = new Set(state.data.tasks.map((t) => t.id));
    const added = plan.tasks.filter((t) => !existing.has(t.id)).length;
    const whitelisted = plan.projects.filter((p) =>
      Array.isArray(p.appWhitelist),
    ).length;
    confirmDialog(
      "合并学习计划？",
      `文件含 ${plan.tasks.length} 个任务，预计新增 ${added} 个。同 ID 的已有任务和进度保留；新任务从未完成开始。指定单次时长的任务保持其安排，其余预计番茄数按当前 ${state.data.settings.focusMinutes} 分钟向上折算，设置和专注记录保留。${whitelisted ? `文件里 ${whitelisted} 个项目的应用白名单会覆盖本机同名项目。` : ""}`,
      "导入计划",
      async () => {
        await act({ type: "importPlan", plan }, "学习计划已合并");
      },
    );
  } catch (e) {
    toast(String(e));
  }
}
document.addEventListener("click", async (e) => {
  const el = (e.target as Element).closest<HTMLElement>("button");
  if (!el || el.hasAttribute("disabled")) return;
  const d = el.dataset;
  if (d.selectMode) {
    selectMode = d.selectMode === "on";
    selectedTaskIds.clear();
    render();
    return;
  }
  if (d.selectTask) {
    if (selectedTaskIds.has(d.selectTask)) selectedTaskIds.delete(d.selectTask);
    else selectedTaskIds.add(d.selectTask);
    render();
    return;
  }
  if (d.selectAll) {
    selectedTaskIds.clear();
    visibleTaskIds.forEach((id) => selectedTaskIds.add(id));
    render();
    return;
  }
  if (d.deleteSelected !== undefined) {
    await deleteSelectedTasks();
    return;
  }
  if (d.detachSelected !== undefined) {
    const r = el.getBoundingClientRect();
    showContextMenu(r.left, r.bottom + 4, [
      ["移出所属项目", () => void detachSelected("project")],
      ["移出所属目标", () => void detachSelected("goal")],
      ["移出所属习惯", () => void detachSelected("habit")],
    ]);
    return;
  }
  if (d.startReminder) {
    if (await act({ type: "startReminder", id: d.startReminder }))
      navigate("focus");
    return;
  }
  if (d.goalsTab) {
    goalsTab = d.goalsTab;
    render();
    return;
  }
  if (d.page) {
    navigate(d.page);
    return;
  }
  if (d.filter) {
    filter = d.filter;
    render();
    return;
  }
  if (d.mode) {
    const mode = d.mode as Mode;
    if (
      state.data.timer.running ||
      state.remainingSecs < state.data.timer.durationSecs
    )
      confirmDialog(
        "切换计时模式？",
        "当前专注将提前结束，已投入的时间会保留。",
        "切换模式",
        () => void act({ type: "setMode", mode }),
      );
    else await act({ type: "setMode", mode });
    return;
  }
  if (d.editTask) {
    taskDialog(d.editTask);
    return;
  }
  if (d.toggleTask) {
    await act({ type: "toggleTask", id: d.toggleTask });
    return;
  }
  if (d.focusTask) {
    if (d.focusTask === state.data.timer.taskId) {
      await toggleTimer();
    } else if (await act({ type: "selectTask", id: d.focusTask })) {
      if (await act({ type: "setMode", mode: "focus" })) {
        navigate("focus");
        toast("已选择任务，准备好就开始吧。");
      }
    }
    return;
  }
  if (d.pickTask !== undefined) {
    if (await act({ type: "selectTask", id: d.pickTask || null })) closeModal();
    return;
  }
  if (d.deleteTask) {
    const task = state.data.tasks.find((t) => t.id === d.deleteTask)!;
    confirmDialog(
      "删除这个任务？",
      "任务会被移除，已有专注记录会保留。",
      "删除任务",
      async () => {
        if (await act({ type: "deleteTask", id: task.id }))
          toast("任务已删除", async () => {
            await act({ type: "restoreTask", task }, "任务已恢复");
          });
      },
      true,
    );
    return;
  }
  if (d.editProject) {
    projectDialog(d.editProject);
    return;
  }
  if (d.editGoal) {
    goalDialog(d.editGoal);
    return;
  }
  if (d.editHabit) {
    habitDialog(d.editHabit);
    return;
  }
  if (d.newVision !== undefined) {
    visionDialog(undefined, d.newVision);
    return;
  }
  if (d.editVision) {
    visionDialog(d.editVision);
    return;
  }
  if (d.guardMode) {
    await act(
      {
        type: "saveSettings",
        settings: {
          ...state.data.settings,
          protection: { ...state.data.settings.protection, mode: d.guardMode },
        },
      },
      "专注保护已设置，将在开始专注时生效",
    );
    return;
  }
  if (d.lockMinutes) {
    $<HTMLInputElement>('#quick-lock-form [name="minutes"]').value =
      d.lockMinutes;
    return;
  }
  if (d.editLock) {
    lockDialog(d.editLock);
    return;
  }
  if (d.toggleLock) {
    const schedule = state.data.lock.schedules.find(
      (s) => s.id === d.toggleLock,
    )!;
    await saveLockSchedule({ ...schedule, enabled: !schedule.enabled });
    return;
  }
  if (d.deleteLock) {
    confirmDialog(
      "删除这个锁机时段？",
      "之后不再按此时段锁机。",
      "删除时段",
      async () => {
        await act(
          { type: "deleteLockSchedule", id: d.deleteLock },
          "时段已删除",
        );
      },
      true,
    );
    return;
  }
  if (d.addApp) {
    await addWhitelist(d.addApp);
    return;
  }
  if (d.addProjectApp && d.guardProject) {
    await addProjectWhitelist(d.guardProject, d.addProjectApp);
    return;
  }
  if (d.removeProjectApp && d.guardProject) {
    await removeProjectWhitelist(d.guardProject, d.removeProjectApp);
    return;
  }
  if (d.enableProjectWhitelist && d.guardProject) {
    await saveProjectWhitelist(d.guardProject, [], "已启用专属白名单");
    return;
  }
  if (d.disableProjectWhitelist && d.guardProject) {
    await saveProjectWhitelist(d.guardProject, null, "已改用通用白名单");
    return;
  }
  if (d.removeApp) {
    await act({
      type: "saveSettings",
      settings: {
        ...state.data.settings,
        protection: {
          ...state.data.settings.protection,
          whitelist: state.data.settings.protection.whitelist.filter(
            (a) => a !== d.removeApp,
          ),
        },
      },
    });
    return;
  }
  if (d.noise) {
    noiseKind = d.noise;
    setNoise(noiseKind);
    render();
    soundDialog();
    return;
  }
  switch (d.action) {
    case "hide-tray":
      try {
        await hideToTray();
      } catch (error) {
        toast(String(error));
      }
      break;
    case "quit-app":
      confirmDialog(
        "退出番茄 Todo？",
        "当前计时会结束并保留已投入的时间。",
        "退出应用",
        async () => {
          try {
            await quitApp();
          } catch (error) {
            toast(String(error));
          }
        },
      );
      break;
    case "new-task":
      taskDialog();
      break;
    case "new-project":
      projectDialog();
      break;
    case "sort-projects": {
      const r = el.getBoundingClientRect();
      showContextMenu(r.left, r.bottom + 4, [
        ["按名称", () => void sortProjects("name")],
        ["按未完成数", () => void sortProjects("count")],
      ]);
      break;
    }
    case "new-goal":
      goalDialog();
      break;
    case "new-habit":
      habitDialog();
      break;
    case "close-modal":
      closeModal();
      break;
    case "toggle-timer":
      await toggleTimer();
      break;
    case "reset":
      confirmDialog(
        "重新开始这一轮？",
        "当前专注将提前结束，已投入的时间会记录下来。",
        "重置计时",
        () => void act({ type: "resetTimer" }),
      );
      break;
    case "skip":
      confirmDialog(
        "跳过当前阶段？",
        "提前结束的专注不会计为完整番茄。",
        "跳过",
        () => void act({ type: "skipTimer" }),
      );
      break;
    case "select-task":
      chooseTask();
      break;
    case "immersive":
      immersive = !immersive;
      render();
      break;
    case "theme":
      await act({
        type: "saveSettings",
        settings: {
          ...state.data.settings,
          theme:
            document.documentElement.dataset.theme === "dark"
              ? "light"
              : "dark",
        },
      });
      break;
    case "help":
      helpDialog();
      break;
    case "search":
      searchDialog();
      break;
    case "sound":
      soundDialog();
      break;
    case "toggle-chime":
      await act({
        type: "saveSettings",
        settings: { ...state.data.settings, sound: !state.data.settings.sound },
      });
      break;
    case "test-sound":
      chime();
      break;
    case "example":
      await act(
        { type: "loadExample" },
        "已添加 3 个示例任务，可以随时编辑或删除",
      );
      break;
    case "refresh-apps":
      await refreshGuard();
      break;
    case "emergency":
      emergencyDialog();
      break;
    case "export":
      try {
        if (await exportData(state.data)) toast("数据备份已导出");
      } catch (e) {
        toast(String(e));
      }
      break;
    case "import":
      await importBackup();
      break;
    case "export-plan":
      try {
        if (await exportPlan()) toast("未完成任务已导出为学习计划");
      } catch (e) {
        toast(String(e));
      }
      break;
    case "import-plan":
      await importPlan();
      break;
    case "new-lock":
      lockDialog();
      break;
    case "undo": {
      const cb = undo;
      undo = null;
      await cb?.();
      break;
    }
  }
});
document.addEventListener("keydown", (e) => {
  if (!state) return;
  const modalOpen = !!document.querySelector(".modal");
  if (e.key === "Escape") {
    if (modalOpen) closeModal();
    else if (immersive && !protectedNow()) {
      immersive = false;
      render();
    }
    return;
  }
  if (modalOpen && e.key === "Tab") {
    const focusable = [
      ...document.querySelectorAll<HTMLElement>(
        ".modal button:not([disabled]),.modal input,.modal textarea,.modal select",
      ),
    ];
    const first = focusable[0],
      last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
    return;
  }
  if (modalOpen || protectedNow()) return;
  if ((e.ctrlKey || e.metaKey) && ["k", "f"].includes(e.key.toLowerCase())) {
    e.preventDefault();
    searchDialog();
    return;
  }
  const input = (e.target as Element).closest(
    'input,textarea,select,[contenteditable="true"]',
  );
  if (input) return;
  if (e.key.toLowerCase() === "n" && !e.altKey) {
    e.preventDefault();
    taskDialog();
  }
  if (
    e.code === "Space" &&
    !e.repeat &&
    (e.target as Element).tagName !== "BUTTON"
  ) {
    e.preventDefault();
    void toggleTimer();
  }
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (state) {
    applyTheme();
  }
});
function confirmDeleteProject(id: string) {
  const target = state.data.projects.find((p) => p.id === id);
  if (!target) return;
  confirmDialog(
    "删除这个项目？",
    "项目中的任务会移到收件箱，专属白名单与愿景会一并删除，专注记录保留。",
    "删除项目",
    async () => {
      page = "tasks";
      await act({ type: "deleteProject", id: target.id }, "项目已删除");
    },
    true,
  );
}
function hideContextMenu() {
  document.querySelector("#context-menu")?.remove();
}
function showContextMenu(x: number, y: number, items: [string, () => void][]) {
  hideContextMenu();
  const menu = document.createElement("div");
  menu.id = "context-menu";
  menu.className = "context-menu";
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  items.forEach(([label, run]) => {
    const item = document.createElement("button");
    item.textContent = label;
    item.addEventListener("click", () => {
      hideContextMenu();
      run();
    });
    menu.appendChild(item);
  });
  document.body.appendChild(menu);
}
document.addEventListener("contextmenu", (e) => {
  hideContextMenu();
  const el = (e.target as Element).closest<HTMLElement>("[data-project-menu]");
  if (!el) return;
  e.preventDefault();
  const id = el.dataset.projectMenu!;
  showContextMenu(e.clientX, e.clientY, [
    ["重命名 / 编辑", () => projectDialog(id)],
    ["删除项目", () => confirmDeleteProject(id)],
  ]);
});
document.addEventListener("click", () => hideContextMenu());

function selectControls() {
  return selectMode
    ? `<button class="button secondary small-button" data-select-all="on">全选</button><button class="button secondary small-button" data-detach-selected="on" ${selectedTaskIds.size ? "" : "disabled"}>移出（${selectedTaskIds.size}）</button><button class="button danger small-button" data-delete-selected ${selectedTaskIds.size ? "" : "disabled"}>删除所选（${selectedTaskIds.size}）</button><button class="text-button" data-select-mode="off">退出选择</button>`
    : `<button class="button secondary small-button" data-select-mode="on">${icon("check-check")} 选择</button>`;
}
async function detachSelected(target: "project" | "goal" | "habit") {
  const ids = [...selectedTaskIds];
  if (!ids.length) return;
  selectedTaskIds.clear();
  render();
  await act(
    { type: "detachTasks", ids, target },
    `已移出 ${ids.length} 个任务`,
  );
}
async function deleteSelectedTasks() {
  const ids = [...selectedTaskIds];
  if (!ids.length) return;
  const snapshots = ids
    .map((id) => state.data.tasks.find((t) => t.id === id))
    .filter((t): t is Task => !!t);
  confirmDialog(
    `删除选中的 ${ids.length} 个任务？`,
    "任务会被移除，已有专注记录会保留。",
    "删除所选",
    async () => {
      for (const id of ids) await act({ type: "deleteTask", id });
      selectedTaskIds.clear();
      selectMode = false;
      render();
      toast(`已删除 ${ids.length} 个任务`, async () => {
        for (const task of snapshots) await act({ type: "restoreTask", task });
      });
    },
    true,
  );
}
function dragProject(id: string | null) {
  dragProjectId = id;
}
async function sortProjects(by: "name" | "count") {
  const ids = [...state.data.projects]
    .sort((a, b) =>
      by === "name"
        ? a.name.localeCompare(b.name, "zh")
        : state.data.tasks.filter((t) => t.projectId === b.id && !t.completed)
            .length -
          state.data.tasks.filter((t) => t.projectId === a.id && !t.completed)
            .length,
    )
    .map((p) => p.id);
  await act({ type: "reorderProjects", ids }, "项目顺序已更新");
}
document.addEventListener("dragstart", (e) => {
  const el = (e.target as Element).closest<HTMLElement>("[data-project-menu]");
  if (el) dragProject(el.dataset.projectMenu!);
});
document.addEventListener("dragover", (e) => {
  if (dragProjectId && (e.target as Element).closest("[data-project-menu]"))
    e.preventDefault();
});
document.addEventListener("drop", (e) => {
  const el = (e.target as Element).closest<HTMLElement>("[data-project-menu]");
  if (!el || !dragProjectId) return;
  e.preventDefault();
  const target = el.dataset.projectMenu!;
  const dragged = dragProjectId;
  dragProject(null);
  if (target === dragged) return;
  const ids = state.data.projects
    .map((p) => p.id)
    .filter((id) => id !== dragged);
  ids.splice(ids.indexOf(target), 0, dragged);
  void act({ type: "reorderProjects", ids }, "项目顺序已更新");
});
document.addEventListener("dragend", () => dragProject(null));

async function boot() {
  try {
    if (desktop) nativeStatus = await getDesktopStatus();
    accept(await getSnapshot());
  } catch (e) {
    $("#app").innerHTML =
      `<div class="boot error"><span class="brand-mark">${logo}</span><h1>专注空间暂时没有连上</h1><p>${escape(String(e))}</p><p>请检查 Rust 服务是否已经启动。</p><button class="button primary" id="retry">重新连接</button></div>`;
    $("#retry").onclick = () => void boot();
    return;
  }
  if (desktop) {
    await listen("distraction-blocked", () => {
      blockedCount++;
      const el = document.getElementById("blocked-count");
      if (el) el.textContent = `已为你挡住 ${blockedCount} 次分心`;
    });
    await listen<string>("protection-error", (e) =>
      toast(`窗口保护已停止，本轮已结束：${e.payload}`),
    );
    await listen("close-blocked", () =>
      toast("专注保护中。如有急事，请使用「提前结束」。"),
    );
    await listen<string>("desktop-error", (e) => toast(e.payload));
  }
  setInterval(async () => {
    if (pending) return;
    try {
      const next = await getSnapshot();
      disconnected = false;
      accept(next);
      const el = document.getElementById("connection");
      if (el) el.textContent = "所有更改已保存到本机";
    } catch {
      disconnected = true;
      const el = document.getElementById("connection");
      if (el) el.textContent = "连接中断，正在重试…";
    }
  }, 1000);
}
void boot();
