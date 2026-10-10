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
  NodeSpec,
  MainlineNode,
  BlockRule,
  Habit,
  Mode,
  Vision,
  Project,
  Settings,
  Snapshot,
  Task,
  Template,
  LockSchedule,
  LineOutcome,
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
  templates: "印刷模板",
  goals: "目标·习惯·愿景",
  stats: "数据统计",
  schedule: "本周日程",
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
// Jurisdiction is defined once in the Rust core; read its frozen kind instead of
// re-deriving the category here.
const isHabit = (task: Task) => state.taskKinds[task.id] === "habit";
const dayLabel = (d: number) => "一二三四五六日"[d - 1] ?? "?";
const daysLabel = (days: number[]) => {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return "每天";
  if (sorted.join() === "1,2,3,4,5") return "工作日";
  if (sorted.join() === "6,7") return "周末";
  return "周" + sorted.map(dayLabel).join("");
};

const isTimed = (task: Task) => !!task.reminderTime;
const goalOf = (task: Task) =>
  state.data.goals.find((g) => g.id === task.goalId);
const nodeOf = (task: Task) =>
  goalOf(task)?.nodes.find((n) => n.spec.id === task.nodeId);
const isVoid = (task: Task) =>
  task.goalId
    ? !!nodeOf(task)?.result
    : !task.completed && isTimed(task) && task.reminderExpired;
const nodeProgress = (goalId: string, nodeId: string) =>
  state.nodeProgress.find((p) => p.goalId === goalId && p.nodeId === nodeId)!;
const verdictLabel = (verdict: string | null | undefined) =>
  verdict === "success" ? "成功" : verdict === "failure" ? "失败" : "尚未裁定";
const signalLabel = (kind: string) =>
  kind === "check" ? "检查" : verdictLabel(kind);
const nodeTimeLabel = (time: string) => time.replace("T", " ");
const blockLabels: Record<BlockRule, string> = {
  never: "不阻断",
  always: "无条件阻断",
  unpaired: "尚未配对时阻断",
  unfinishedTasks: "配对任务仍未全部完成时阻断",
  incomplete: "节点尚未完成时阻断",
  completed: "节点已经完成时阻断",
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
      ["schedule", "calendar-days"],
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
    <button class="nav-item ${page === "settings" ? "active" : ""}" data-page="settings">${icon("settings-2")}<span>偏好设置</span></button><div class="local-status"><span class="status-dot"></span>本地存储 · 安心专注 <span>v0.5.0</span></div></div>
  </aside>
  <div class="workspace"><header class="topbar"><div class="breadcrumb">我的空间 ${icon("chevron-right")} <span>${escape(pageTitle())}</span></div><div class="top-actions"><button class="search-trigger" data-action="search">${icon("search")}<span>搜索任务</span><kbd>Ctrl K</kbd></button><span class="separator"></span><button class="icon-btn" data-action="theme" aria-label="切换明暗主题">${icon(document.documentElement.dataset.theme === "dark" ? "sun" : "moon")}</button><button class="icon-btn" data-action="help" aria-label="快捷键帮助">${icon("circle-help")}</button><div class="avatar">我</div></div></header>
  <main>${reminderBanner()}${page === "focus" ? focusPage() : page === "goals" ? goalsPage() : page === "stats" ? statsPage() : page === "schedule" ? schedulePage() : page === "settings" ? settingsPage() : page === "guard" ? guardPage() : page === "lock" ? lockPage() : tasksPage()}</main><footer class="workspace-footer"><span>${icon("leaf")} 把时间留给真正重要的事。</span><span id="connection">${disconnected ? "连接中断，正在重试…" : "所有更改已保存到本机"}</span></footer></div>`;
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
  const catchUpTasks = todayTasks.filter(isCatchUp);
  const regularTasks = todayTasks.filter((t) => !isCatchUp(t));
  return `${heading("今天，也要慢慢向前。", `${weekday} <span class="dot-separator">·</span> 专注当下，让每一小步都有回响。`)}
    <div class="metrics">${metric("timer", "今日专注", Math.floor(s.todaySeconds / 60), "分钟", "给重要的事留一点时间", "coral")}${metric("check-check", "完成任务", s.todayCompleted, "项", `${todayTasks.length} 项待办，按自己的节奏来`, "sage")}${metric("flame", "连续专注", s.streak, "天", "小小坚持，慢慢积累", "amber")}</div>
    <div class="focus-grid"><section class="card focus-card"><div class="card-heading"><h2>${icon("timer")} 我的番茄钟</h2><button class="icon-btn" data-action="immersive" aria-label="进入沉浸模式">${icon("maximize-2")}</button></div>${timerContent()}
    <div class="sound-bar"><button class="sound-button ${noiseKind !== "off" ? "on" : ""}" data-action="sound">${icon("headphones")}<span>${noiseKind === "off" ? "来一点背景音？" : noiseKind === "rain" ? "雨声 · 正在播放" : "棕噪音 · 正在播放"}</span>${icon("chevron-right")}</button><button class="icon-btn" data-action="toggle-chime" aria-label="${state.data.settings.sound ? "关闭" : "开启"}完成提示音">${icon(state.data.settings.sound ? "volume-2" : "volume-x")}</button></div></section>
    <section class="card today-card"><div class="card-heading"><h2>今日待办 <span class="count-label">${todayTasks.length}</span></h2><button class="text-button" data-page="tasks">全部任务 ${icon("arrow-up-right")}</button></div><div class="list-tabs"><button class="${filter === "active" ? "active" : ""}" data-filter="active">待完成 <span>${todayTasks.length}</span></button><button class="${filter === "completed" ? "active" : ""}" data-filter="completed">已完成 <span>${s.todayCompleted}</span></button><span class="list-tabs-line"></span><span class="subtle small">一步一步，来就好</span></div>
    <div class="today-list">${taskList(filter === "completed" ? state.data.tasks.filter((t) => t.completed && t.completedAt && new Date(t.completedAt * 1000).toLocaleDateString("sv-SE") === state.today) : regularTasks, true)}${filter !== "completed" && catchUpTasks.length ? `<h3 class="group-title">待补队列<span>${catchUpTasks.length}</span></h3>${taskList(catchUpTasks, true)}` : ""}</div>
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
function isCatchUp(task: Task) {
  if (task.completed || isVoid(task) || isHabit(task)) return false;
  if (task.goalId && task.dueDate && task.dueDate < state.today) return true;
  if (task.dueDate !== state.today || !task.reminderTime) return false;
  const settings = state.data.settings;
  const sessions = Math.max(1, task.estimate);
  let minutes = sessions * (task.focusMinutes || settings.focusMinutes);
  for (let i = 1; i < sessions; i++)
    minutes +=
      i % settings.longBreakEvery === 0
        ? settings.longBreakMinutes
        : settings.shortBreakMinutes;
  const [hour, minute] = task.reminderTime.split(":").map(Number);
  const end = new Date(`${state.today}T00:00:00`);
  end.setMinutes(hour * 60 + minute + minutes);
  return state.serverTime >= end.getTime() / 1000;
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
        catchUp = isCatchUp(task);
      return `<article data-task-id="${escape(task.id)}" class="task-row ${selectMode ? "selecting" : ""} ${picked ? "picked" : ""} ${task.reminderPending ? "reminded" : ""} ${catchUp ? "catch-up" : ""} ${task.completed ? "completed" : ""} ${selected && !task.completed ? "selected" : ""}">${selectMode ? `<button class="task-checkbox pick ${picked ? "on" : ""}" data-select-task="${task.id}" aria-label="选择 ${escape(task.title)}">${picked ? icon("check") : ""}</button>` : `<button class="task-checkbox p${task.priority}" data-toggle-task="${task.id}" aria-label="${task.completed ? "重新打开" : "完成"}任务 ${escape(task.title)}" aria-pressed="${task.completed}" ${isVoid(task) ? "disabled" : ""}>${task.completed ? icon("check") : ""}</button>`}<button class="task-body" ${selectMode ? `data-select-task="${task.id}"` : `data-edit-task="${task.id}"`}><span class="task-title">${escape(task.title)}${catchUp ? '<span class="catch-up-chip">待补</span>' : ""}</span><span class="task-meta">${goalOf(task) ? `<span>${icon("target")}${escape(goalOf(task)!.name)}${nodeOf(task) ? ` · ${escape(nodeOf(task)!.spec.name)}` : ""}${isVoid(task) ? " · 已报废" : ""}</span>` : ""}${task.reminderTime ? `<span>${icon("clock-3")}${escape(task.reminderTime)} 提醒</span>` : ""}${task.focusMinutes ? `<span>${task.focusMinutes} 分钟/次</span>` : ""}${p ? `<span class="task-project" style="--project:${escape(p.color)}"><i></i>${escape(p.name)}</span>` : ""}${task.dueDate ? `<span class="${task.dueDate < state.today && !task.completed ? "overdue" : ""}">${icon("calendar-days")}${dateLabel(task.dueDate)}</span>` : ""}${task.subtasks.length ? `<span>${icon("list-todo")}${task.subtasks.filter((s) => s.done).length}/${task.subtasks.length}</span>` : ""}${!compact && task.tags.length ? `<span class="tag"># ${escape(task.tags.join(" # "))}</span>` : ""}</span></button><div class="task-trailing"><span class="tomato-count ${done >= task.estimate ? "achieved" : ""}">${logo}<span>${done}<small>/${task.estimate}</small></span></span>${selectMode ? "" : `${!task.completed && !isVoid(task) ? `<button class="task-play icon-btn" data-focus-task="${task.id}" aria-label="专注于 ${escape(task.title)}">${icon(selected && state.data.timer.running ? "pause" : "play")}</button>` : ""}<button class="icon-btn task-more" data-edit-task="${task.id}" aria-label="编辑 ${escape(task.title)}">${icon("ellipsis")}</button>`}</div></article>`;
    })
    .join("");
}
let weekOffset = 0;
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function schedulePage() {
  const base = new Date(`${state.today}T12:00:00`);
  const monday = new Date(base);
  monday.setDate(base.getDate() - ((base.getDay() + 6) % 7) + weekOffset * 7);
  const weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  const start = 7 * 60;
  const end = 23 * 60;
  const span = end - start;
  const toMin = (time: string | null | undefined) =>
    time ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) : start;
  const focus = state.data.settings.focusMinutes;
  const brk = state.data.settings.shortBreakMinutes;
  const lists = days.map((d) =>
    state.data.tasks
      .filter((t) => t.dueDate === isoDate(d))
      .sort((a, b) => toMin(a.reminderTime) - toMin(b.reminderTime)),
  );
  const total = lists.reduce(
    (n, ts) => n + ts.reduce((m, t) => m + t.estimate, 0),
    0,
  );
  const range = `${isoDate(days[0]).slice(5).replace("-", "/")}–${isoDate(days[6]).slice(5).replace("-", "/")}`;
  const hours = Array.from({ length: span / 60 + 1 }, (_, i) => start / 60 + i);
  const pct = (min: number) => ((min - start) / span) * 100;
  return `${heading("这一周的日程", "横轴星期、纵轴时间，方块就是任务。", "WEEK AT A GLANCE", false)}
  <div class="week-nav"><button class="text-button" data-week-prev>${icon("arrow-left")} 上一周</button><span>${range} · 共 ${total} 番茄</span>${weekOffset === 0 ? "" : '<button class="text-button" data-week-now>回到本周</button>'}<button class="text-button" data-week-next>下一周 ${icon("arrow-right")}</button></div>
  <section class="calendar">
    <div class="calendar-head"><span class="calendar-gutter"></span>${days
      .map((d, i) => {
        const est = lists[i].reduce((m, t) => m + t.estimate, 0);
        return `<div class="calendar-day ${isoDate(d) === state.today ? "today" : ""}"><b>${weekdays[i]}</b><small>${isoDate(d).slice(5).replace("-", "/")}</small>${est ? `<em>${est} 番茄</em>` : ""}</div>`;
      })
      .join("")}</div>
    <div class="calendar-body">
      <div class="calendar-gutter">${hours.map((h) => `<span style="top:${pct(h * 60)}%">${String(h).padStart(2, "0")}:00</span>`).join("")}</div>
      ${days
        .map(
          (_, i) =>
            `<div class="calendar-col">${hours.map((h) => `<i class="hour-line" style="top:${pct(h * 60)}%"></i>`).join("")}${lists[
              i
            ]
              .map((t) => {
                const top = Math.max(0, pct(toMin(t.reminderTime)));
                const minutes = Math.max(
                  30,
                  t.estimate * focus + Math.max(0, t.estimate - 1) * brk,
                );
                const height = Math.max(
                  3,
                  Math.min(100 - top, (minutes / span) * 100),
                );
                const p = projectOf(t);
                return `<button class="calendar-block ${t.completed ? "done" : ""}" style="top:${top}%;height:${height}%;border-left-color:${escape(p?.color || "#c9c4ba")}" data-edit-task="${escape(t.id)}"><b>${escape(t.reminderTime || "")}</b><span>${escape(t.title)}</span></button>`;
              })
              .join("")}</div>`,
        )
        .join("")}
    </div>
  </section>`;
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
    )}</select><select id="task-sort" aria-label="排序"><option value="time" ${sort === "time" ? "selected" : ""}>按时间</option><option value="priority" ${sort === "priority" ? "selected" : ""}>优先级</option><option value="created" ${sort === "created" ? "selected" : ""}>创建顺序</option></select>${selectControls()}</div></div><div id="tasks-results">${taskList(tasks)}</div><button class="quick-add" data-action="new-task">${icon("plus")} 添加任务 <kbd>N</kbd></button></section>${templatesCard(project?.id)}`;
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
    return `<div class="empty-state"><div class="empty-illustration">${icon("target")}</div><h3>还没有目标组</h3><p>为主线设置节点，再把不同任务按组标识与执行时间配对。</p><button class="text-button" data-action="new-goal">新建目标 →</button></div>`;
  return goals
    .map((g) => {
      const tasks = state.data.tasks.filter((t) => t.goalId === g.id);
      const nodes = g.nodes
        .map((n) => {
          const p = nodeProgress(g.id, n.spec.id);
          const matched = tasks.filter((t) => t.nodeId === n.spec.id);
          const deleted = state.data.nodeBindings.filter(
            (b) =>
              b.goalId === g.id &&
              b.nodeId === n.spec.id &&
              !tasks.some((t) => t.id === b.taskId),
          );
          const restore =
            !n.result && deleted.length
              ? `<p class="subtle small">${deleted.length} 条已删除的配对记录仍保留，删除不代表完成。</p>${deleted.map((b) => (state.data.identities.some((r) => r.id === b.taskId && r.retired && r.restoreTask) ? `<button class="text-button" data-restore-paired="${escape(b.taskId)}">恢复已删除${b.completed ? "已完成" : "未完成"}任务</button>` : "")).join("")}`
              : "";
          const status = n.result
            ? verdictLabel(n.result.verdict)
            : p.completed
              ? "已完成，等待裁定"
              : p.pairedCount
                ? "进行中"
                : "尚未配对";
          return `<section class="mainline-node ${n.result?.verdict || "pending"}" data-mainline-node="${escape(n.spec.id)}"><div class="goal-head"><h4>${escape(n.spec.name)}</h4><span class="badge">${status}</span></div><p class="subtle small">${escape(nodeTimeLabel(n.spec.start))} 至 ${escape(nodeTimeLabel(n.spec.end))}（结束不含）</p><p class="small">已配对 ${p.pairedCount} 条 · 已完成 ${p.completedCount} 条${n.spec.requiredTasks > 1 ? ` · 至少需 ${n.spec.requiredTasks} 条` : ""}</p>${n.spec.signal ? `<p class="subtle small">${escape(nodeTimeLabel(n.spec.signal.at))} · 向${n.spec.signal.direction === "head" ? "头" : "尾"}发送${signalLabel(n.spec.signal.kind)}信号${n.emitted ? " · 已发出" : ""}</p>` : ""}${n.result ? `<p class="subtle small">节点已裁定，所有配对实例报废，历史保留。</p>` : n.spec.confirmationRequired ? `<button class="button secondary small-button" data-confirm-node="${escape(n.spec.id)}" data-node-goal="${escape(g.id)}" data-confirmed="${!n.confirmed}">${n.confirmed ? "撤回阶段确认" : "确认阶段要求已完成"}</button>` : ""}${matched.length ? taskList(matched) : ""}${restore}</section>`;
        })
        .join("");
      const unmatched = tasks.filter((t) => !t.nodeId);
      const events = state.data.signalEvents
        .filter((e) => e.goalId === g.id)
        .slice(-30)
        .reverse();
      const history = events.length
        ? `<details class="editor-details signal-history"><summary>信号记录 <small>${events.length} 条最近记录</small></summary>${events.map((e) => `<section class="signal-event"><b>${escape(g.nodes.find((n) => n.spec.id === e.sourceNodeId)?.spec.name || "节点")} · ${signalLabel(e.kind)} · 向${e.direction === "head" ? "头" : "尾"}</b><p class="subtle small">${new Date(e.emittedAt * 1000).toLocaleString("zh-CN")}</p><ul>${e.deliveries.map((d) => `<li>${escape(g.nodes.find((n) => n.spec.id === d.nodeId)?.spec.name || "节点")}：${d.blocked ? `阻断（${blockLabels[d.blockRule]}）` : d.before ? `保持${verdictLabel(d.before)}` : d.after ? `裁定${verdictLabel(d.after)}` : "未完成，保持尚未裁定"} · ${d.completedCount}/${d.pairedCount} 条任务已完成</li>`).join("")}</ul></section>`).join("")}</details>`
        : "";
      return `<section class="goal-section" data-goal-id="${escape(g.id)}"><div class="goal-head"><h3>${icon("target")} ${escape(g.name)}</h3><button class="icon-btn" data-edit-goal="${escape(g.id)}" aria-label="编辑目标">${icon("pencil")}</button></div><p class="subtle small">${g.nodes.filter((n) => n.result?.verdict === "success").length} 个成功 · ${g.nodes.filter((n) => n.result?.verdict === "failure").length} 个失败 · ${g.nodes.filter((n) => !n.result).length} 个尚未裁定</p>${goalVisions(g)}${nodes || '<p class="subtle small">主线尚未设置节点。编辑目标组可添加阶段。</p>'}${unmatched.length ? `<h4>尚未配对节点的实例</h4>${taskList(unmatched)}` : ""}${history}</section>`;
    })
    .join("");
}

function habitsTab(habits: Task[]) {
  if (!state.data.habits.length && !habits.length)
    return `<div class="empty-state"><h3>还没有习惯</h3><p>在一份模板中设置开始时间及其周期单元，按习惯组查看执行情况。</p><button class="text-button" data-action="new-habit">新建习惯 →</button></div>`;
  const groups = state.data.habits
    .map((h) => {
      const templates = state.data.templates.filter(
        (t) => t.shape.habitId === h.id,
      );
      const tasks = habits.filter((t) => t.habitId === h.id && !t.completed);
      return `<section class="goal-section" data-habit-id="${escape(h.id)}"><div class="goal-head"><h3>${escape(h.name)}</h3><button class="text-button danger-text" data-delete-habit="${escape(h.id)}">删除习惯组</button></div>${templates.map((t) => `<div class="habit-template"><div class="goal-head"><b>${escape(t.shape.title)}</b><button class="icon-btn" data-edit-template="${escape(t.id)}" aria-label="编辑习惯模板">${icon("pencil")}</button></div><p class="habit-meta">${escape(printingLabel(t))}</p><button class="text-button" data-print-template="${escape(t.id)}">手动印刷整周期</button></div>`).join("") || '<p class="subtle small">模板已移除，已印实例与管辖记录仍保留。</p>'}${tasks.length ? taskList(tasks) : '<p class="subtle small">没有待完成实例。</p>'}</section>`;
    })
    .join("");
  const detached = habits.filter((t) => !t.habitId && !t.completed);
  return (
    groups + (detached.length ? `<h3>习惯记录</h3>${taskList(detached)}` : "")
  );
}

function habitSlotHtml(days: number[], time: string) {
  return `<div class="habit-slot" data-slot><div class="slot-days">${[1, 2, 3, 4, 5, 6, 7].map((d) => `<label><input type="checkbox" value="${d}" ${days.includes(d) ? "checked" : ""}>${dayLabel(d)}</label>`).join("")}</div><input type="time" value="${escape(time)}" aria-label="时段"><button type="button" class="icon-btn tiny" data-remove-slot aria-label="移除时段">${icon("x")}</button></div>`;
}
function calendarDateHtml(date: string) {
  return `<div class="calendar-date"><input type="date" value="${escape(date)}" aria-label="日程日期"><button type="button" class="icon-btn tiny" data-remove-date aria-label="移除日期">${icon("x")}</button></div>`;
}
function calendarEntryHtml(dates: string[], time: string) {
  return `<section class="calendar-entry" data-calendar-entry><div class="calendar-slot-head"><label class="form-field"><span>开始时间（可选）</span><input type="time" value="${escape(time)}" aria-label="日程开始时间"></label><button type="button" class="icon-btn tiny" data-remove-calendar aria-label="移除时段">${icon("x")}</button></div><span class="subtle small">这个时段安排在哪些日期？</span><div class="calendar-dates">${dates.map(calendarDateHtml).join("")}</div><button type="button" class="text-button" data-add-date>＋ 添加日期</button></section>`;
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
const lineOutcomeLabel: Record<LineOutcome, string> = {
  empty: "尚未设置节点",
  pending: "进行中",
  success: "全线成功",
  failure: "主线失败",
};
const stamp = (ts: number | null) =>
  ts === null
    ? ""
    : new Date(ts * 1000).toLocaleString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
const spanLabel = (start: string, end: string) =>
  `${start.slice(5, 16).replace("T", " ")}\u2013${end.slice(11, 16)}`;
function goalStatsCard() {
  const goals = state.stats.goals;
  return `<section class="card mainline-card"><div class="card-heading"><h2>主线</h2><span class="subtle small">整条线通过才算成功，失败与未完成更值得回看</span></div>${
    goals.length
      ? goals
          .map((g) => {
            const when = g.decidedAt
              ? `${stamp(g.decidedAt)} ${g.outcome === "failure" ? "裁定失败" : "全线成功"}`
              : "尚未裁定";
            return `<div class="mainline-stat ${g.outcome}"><div class="mainline-stat-head"><b>${escape(g.name)}</b><span class="badge ${g.outcome}">${lineOutcomeLabel[g.outcome]}</span></div><p class="subtle small">${g.nodes.length} 个节点 · 配对 ${g.paired} · 完成 ${g.completed} · ${when}</p><div class="mainline-nodes">${g.nodes
              .map(
                (n) =>
                  `<div class="mainline-node-stat ${n.verdict ?? "pending"}"><span>${escape(n.name)}</span><small>${escape(spanLabel(n.start, n.end))}</small><em class="badge ${n.verdict ?? "pending"}">${n.verdict === "success" ? "成功" : n.verdict === "failure" ? "失败" : n.nodeCompleted ? "已完成" : "未完成"}</em><small>${n.completed}/${n.paired}</small></div>`,
              )
              .join("")}</div></div>`;
          })
          .join("")
      : '<div class="small-empty">还没有目标组。主线失败往往比成功更值得回看。</div>'
  }</section>`;
}
function crossSectionCard() {
  const days = state.stats.days
    .slice(-14)
    .filter(
      (d) =>
        d.goalFailure || d.goalSuccess || d.goalVoided || d.voided || d.missed,
    );
  return `<section class="card cross-section"><div class="card-heading"><h2>纵切面</h2><span class="subtle small">同一天的成败并排看，才看得见相互影响</span></div>${
    days.length
      ? `<div class="cross-table"><div class="cross-head"><span>日期</span><span>完成</span><span>缺勤</span><span>作废</span><span>主线成功</span><span>主线失败</span><span>主线报废</span></div>${days
          .map(
            (d) =>
              `<div class="cross-row ${d.goalFailure ? "has-failure" : ""}"><span>${d.date.slice(5).replace("-", "/")}</span><span>${d.completed || "·"}</span><span>${d.missed || "·"}</span><span>${d.voided || "·"}</span><span>${d.goalSuccess || "·"}</span><span>${d.goalFailure ? `<b>${d.goalFailure}</b>` : "·"}</span><span>${d.goalVoided || "·"}</span></div>`,
          )
          .join("")}</div>`
      : '<div class="small-empty">最近两周还没有可纵向对比的成败记录。</div>'
  }</section>`;
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
  }</section></div>${goalStatsCard()}${crossSectionCard()}
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
  <section class="card guard-card guard-strict-card"><label class="setting-row"><span><strong>严格模式 · 不允许临时退出</strong><small>用于界面锁定和应用白名单。开启后，计时中不能暂停、提前结束或关闭保护；结束时自动解除。</small></span><input id="guard-strict" class="switch" type="checkbox" ${p.strict ? "checked" : ""} ${!guardInfo?.available ? "disabled" : ""}></label><p class="subtle small">请在开始前确认所需应用已加入白名单。未开启严格模式时，仍可通过确认文字提前结束。</p></section><section class="card whitelist-card"><div class="card-heading"><div><h2>允许使用的应用 <span class="count-label">${p.whitelist.length}</span></h2><p class="subtle small">以应用 ID 精确匹配。番茄 Todo 始终允许使用。</p></div><button class="button secondary small-button" data-action="refresh-apps">${icon("refresh-cw")} 刷新应用</button></div><div class="whitelist-tags">${p.whitelist.map((app) => `<span class="app-tag">${icon("monitor")} ${escape(app)}<button class="icon-btn tiny" data-remove-app="${escape(app)}" aria-label="移除 ${escape(app)}">${icon("x")}</button></span>`).join("") || '<p class="subtle small">还没有添加应用。先打开需要使用的软件，再从下方添加。</p>'}</div><div class="available-apps">${[...new Map((guardInfo?.windows || []).filter((w) => w.app_id).map((w) => [w.app_id!, w])).values()].map((w) => `<button class="available-app" data-add-app="${escape(w.app_id)}" ${p.whitelist.includes(w.app_id!) ? "disabled" : ""}>${icon("monitor")}<span><strong>${escape(w.app_id)}</strong><small>${escape(w.title)}</small></span>${icon(p.whitelist.includes(w.app_id!) ? "check" : "plus")}</button>`).join("")}</div><form id="whitelist-form" class="manual-app"><input name="appId" maxlength="200" placeholder="手动输入应用 ID，例如 org.mozilla.firefox" aria-label="应用 ID" required><button class="button secondary" type="submit">${icon("plus")} 添加</button></form></section>
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
    <div class="lock-grid"><section class="card settings-card"><h2>现在休息一会儿</h2><form id="quick-lock-form"><div class="button-row lock-presets">${[2, 5, 10, 25, 60].map((n) => `<button type="button" class="button secondary" data-lock-minutes="${n}">${n} 分钟</button>`).join("")}</div><label class="form-field"><span>自定义时长（分钟）</span><input name="minutes" type="number" min="1" max="720" value="25" required></label><label class="setting-row"><span><strong>严格模式</strong><small>期间不能提前结束，到时自动解除</small></span><input class="switch" name="strict" type="checkbox"></label><button class="button primary" type="submit" ${available ? "" : "disabled"}>${icon("lock-keyhole")} 开始快速锁机</button></form></section>
    <section class="card settings-card"><div class="card-heading"><h2>固定休息时段</h2><button class="button secondary" data-action="new-lock" ${available ? "" : "disabled"}>${icon("plus")} 添加时段</button></div><p class="subtle small">每个时段都可独立开启严格模式。支持跨午夜，例如 23:00 至次日 07:00；星期按开始日期计算，启用的时段不能重叠。</p><div class="lock-schedules">${state.data.lock.schedules.map((s) => `<article class="lock-schedule" data-lock-schedule="${escape(s.id)}"><div><strong>${escape(s.name)}</strong><span class="badge">${s.strict ? "严格模式" : "可提前结束"}</span><h3>${s.start} — ${s.end <= s.start ? "次日 " : ""}${s.end}</h3><p class="subtle small">${s.days.map((d) => days[d - 1]).join(" · ")}</p></div><label class="setting-row lock-strict-setting"><span><strong>严格模式</strong><small>此时段生效期间不能提前结束或修改规则，到时自动解除。</small></span><input class="switch" type="checkbox" data-strict-lock="${escape(s.id)}" aria-label="${escape(s.name)} 严格模式" ${s.strict ? "checked" : ""} ${!available && s.enabled ? "disabled" : ""}></label><div class="button-row"><button class="button secondary small-button" data-toggle-lock="${escape(s.id)}" ${available || s.enabled ? "" : "disabled"}>${s.enabled ? "停用" : "启用"}</button><button class="icon-btn" data-edit-lock="${escape(s.id)}" aria-label="编辑 ${escape(s.name)}">${icon("pencil")}</button><button class="icon-btn" data-delete-lock="${escape(s.id)}" aria-label="删除 ${escape(s.name)}">${icon("trash-2")}</button></div></article>`).join("") || '<p class="small-empty">还没有安排锁机时段。先给今晚的睡眠留出时间吧。</p>'}</div></section></div>
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
    `${modalHeader(s ? "编辑锁机时段" : "为休息留出时间")}<form id="lock-schedule-form"><label class="form-field"><span>名称</span><input name="name" maxlength="40" required value="${escape(s?.name || "睡眠")}"></label><div class="form-grid"><label class="form-field"><span>开始时间</span><input name="start" type="time" value="${s?.start || "23:00"}" required></label><label class="form-field"><span>结束时间（早于开始则跨午夜）</span><input name="end" type="time" value="${s?.end || "07:00"}" required></label></div><div class="lock-days">${["一", "二", "三", "四", "五", "六", "日"].map((d, i) => `<label><input type="checkbox" name="days" value="${i + 1}" ${!s || s.days.includes(i + 1) ? "checked" : ""}>周${d}</label>`).join("")}</div><label class="setting-row"><span><strong>严格模式</strong><small>生效期间不允许临时退出或改动规则</small></span><input class="switch" name="strict" type="checkbox" ${s?.strict ? "checked" : ""}></label><label class="setting-row"><span><strong>启用时段</strong><small>保存后按所选日期和时间执行</small></span><input class="switch" name="enabled" type="checkbox" ${!s || s.enabled ? "checked" : ""}></label><div class="modal-actions"><button type="button" class="button secondary" data-action="close-modal">取消</button><button class="button primary" type="submit">保存时段</button></div></form>`,
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
function printingLabel(template: Template) {
  const rule = template.printing;
  const schedule =
    rule.kind === "once"
      ? `单次${rule.time ? ` · ${rule.time}` : ""}`
      : rule.kind === "calendar"
        ? `不重复 · ${rule.slots.reduce((n, s) => n + s.dates.length, 0)} 份日程`
        : rule.slots
            .map(
              (s) =>
                `${daysLabel(s.days)}${s.time ? ` ${s.time}` : "（不定时）"}`,
            )
            .join(" · ");
  return `${template.automatic ? `自动预印 ${template.printAheadDays} 天` : "手动印刷"} · ${schedule}`;
}
function templatesCard(projectId?: string) {
  const templates = state.data.templates.filter(
    (t) => !projectId || t.shape.projectId === projectId,
  );
  return `<section class="card templates-card"><div class="card-heading"><div><h2>印刷模板 <span class="count-label">${templates.length}</span></h2><p class="subtle small">模板保留形状，实例记录每一次执行。关闭自动印刷后可以随时手动使用。</p></div><button class="button secondary" data-action="new-template">${icon("plus")} 新建模板</button></div>${templates.map((t) => `<section class="goal-section" data-template-id="${escape(t.id)}"><div class="goal-head"><h3>${escape(t.shape.title)}</h3><button class="icon-btn" data-edit-template="${escape(t.id)}" aria-label="编辑模板 ${escape(t.shape.title)}">${icon("pencil")}</button></div><p class="subtle small">${escape(printingLabel(t))} · ${t.shape.goalId ? "目标组" : t.printing.kind === "weekly" && t.printing.slots.some((s) => s.time) ? "习惯组" : "普通组"}</p><div class="template-actions"><button class="button secondary small-button" data-print-template="${escape(t.id)}">手动印刷</button><button class="text-button" data-sync-template="${escape(t.id)}">同步到未完成实例</button><button class="text-button danger-text" data-delete-template="${escape(t.id)}">删除模板</button></div></section>`).join("") || '<p class="subtle">还没有模板。也可以在编辑器中直接创建一条实例。</p>'}</section>`;
}
function shiftedDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
function datesForPrinting(
  rule: Template["printing"],
  start: string | null,
  end: string | null,
) {
  if (!start && !end && rule.kind === "once") return [null];
  if (!start || !end || end < start) throw new Error("请选择有效的起止日期");
  if (rule.kind === "calendar") {
    const dates = [
      ...new Set(
        rule.slots
          .flatMap((s) => s.dates)
          .filter((date) => date >= start && date <= end),
      ),
    ].sort();
    if (!dates.length) throw new Error("所选范围内没有日程");
    return dates;
  }
  const dates: (string | null)[] = [];
  let date = start;
  for (let i = 0; i < 366 && date <= end; i++, date = shiftedDate(date, 1)) {
    // Any day selects its containing cycle; the core expands the whole cycle.
    dates.push(date);
  }
  if (date <= end) throw new Error("一次最多印刷 366 天");
  if (!dates.length) throw new Error("该范围内没有符合印刷规则的日期");
  return dates;
}
function printDialog(id: string) {
  const template = state.data.templates.find((t) => t.id === id);
  if (!template) return;
  modal(
    `${modalHeader("手动印刷", template.shape.title)}<form id="print-form"><div class="form-grid"><label class="form-field"><span>起始日期</span><input type="date" name="start" value="${template.printing.kind === "calendar" ? template.printing.slots.flatMap((s) => s.dates).sort()[0] : state.today}"></label><label class="form-field"><span>结束日期</span><input type="date" name="end" value="${
      template.printing.kind === "calendar"
        ? template.printing.slots
            .flatMap((s) => s.dates)
            .sort()
            .at(-1)
        : state.today
    }"></label></div><p class="subtle small">重复模板会印出所选日期涉及的完整周（周一至周日）；日程表印出范围内全部日程。单次模板可用于其他日期；不定时模板可留空，印出一个无日期实例。已印日期自动跳过。</p><div class="modal-actions"><button type="button" class="button secondary" data-action="close-modal">取消</button><button class="button primary" type="submit">印刷全部实例</button></div></form>`,
  );
  $("#print-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    try {
      const dates = datesForPrinting(
        template.printing,
        String(f.get("start")) || null,
        String(f.get("end")) || null,
      );
      if (await act({ type: "printTemplate", id, dates }, "范围内的实例已印出"))
        closeModal();
    } catch (error) {
      toast(String(error));
    }
  };
}
function focusBudget(minutes: number, override: number | null) {
  const focus = override ?? Math.min(minutes, state.data.settings.focusMinutes);
  const estimate = Math.ceil(minutes / focus);
  if (
    !Number.isInteger(minutes) ||
    minutes < 1 ||
    !Number.isInteger(focus) ||
    focus < 1 ||
    focus > 180 ||
    estimate > 99
  )
    throw new Error("请输入有效的预计分钟数；用时太长时请拆成多个任务。");
  const workMinutes = estimate * focus;
  let blockMinutes = workMinutes;
  for (let i = 1; i < estimate; i++)
    blockMinutes +=
      i % state.data.settings.longBreakEvery === 0
        ? state.data.settings.longBreakMinutes
        : state.data.settings.shortBreakMinutes;
  return {
    estimate,
    focusMinutes:
      override ?? (focus < state.data.settings.focusMinutes ? focus : null),
    workMinutes,
    blockMinutes,
  };
}
function templateDialog(
  id?: string,
  weekly = false,
  initialMode?: "instance" | "manual" | "automatic",
) {
  const template = state.data.templates.find((t) => t.id === id),
    shape = template?.shape,
    rule = template?.printing;
  const mode = template
    ? template.automatic
      ? "automatic"
      : "manual"
    : (initialMode ?? (weekly ? "automatic" : "instance"));
  const slots =
    rule?.kind === "weekly"
      ? rule.slots
      : [
          {
            days: [new Date(`${state.today}T12:00:00`).getDay() || 7],
            time: "",
          },
        ];
  const calendar =
    rule?.kind === "calendar"
      ? rule.slots
      : [{ dates: [state.today], time: null }];
  const kind = rule?.kind ?? (weekly ? "weekly" : "once");
  modal(
    `${modalHeader(template ? "编辑模板" : "新建任务", "先选择用途，只填写这次需要的信息。")}
  <form id="template-form">
    <label class="form-field"><span>这次想怎么创建？</span><select name="creationMode"><option value="instance" ${mode === "instance" ? "selected" : ""}>临时实例 · 只做这一次</option><option value="manual" ${mode === "manual" ? "selected" : ""}>手动模板 · 保留，以后再用</option><option value="automatic" ${mode === "automatic" ? "selected" : ""}>自动模板 · 按安排持续印刷</option></select></label><p id="creation-mode-hint" class="editor-hint"></p>
    <label class="form-field"><span>任务名称</span><input name="title" required maxlength="200" autofocus value="${escape(shape?.title)}" placeholder="你想完成什么？"></label>
    <label class="form-field"><span>预计用时（分钟）</span><input name="durationMinutes" type="number" min="1" max="17820" required value="${(shape?.estimate ?? 1) * (shape?.focusMinutes ?? state.data.settings.focusMinutes)}"><small id="duration-preview"></small></label>
    <div id="template-once" class="form-grid"><label class="form-field" id="instance-date-field"><span id="instance-date-label">计划日期</span><input name="dueDate" type="date" value="${rule?.kind === "once" && rule.date ? rule.date : state.today}"></label><label class="form-field"><span>提醒时间（可选）</span><input name="reminderTime" type="time" value="${rule?.kind === "once" ? (rule.time ?? "") : ""}"></label></div>
    <button type="button" id="instance-more-dates" class="text-button">＋ 添加更多具体日程</button>
    <div id="template-calendar" class="form-field"><span>具体日程 <small>一个开始时间对应多个日期；所有时段共用任务内容</small></span><div id="calendar-entries">${calendar.map((e) => calendarEntryHtml(e.dates, e.time ?? "")).join("")}</div><button type="button" id="calendar-add" class="text-button">＋ 添加另一开始时间</button></div>
    <details class="editor-details" ${shape?.notes || shape?.tags.length || shape?.subtasks.length ? "open" : ""}><summary>备注、标签与步骤 <small>可选</small></summary><label class="form-field"><span>备注</span><textarea name="notes" rows="2" maxlength="15000">${escape(shape?.notes)}</textarea></label><label class="form-field"><span>标签（逗号分隔）</span><input name="tags" value="${escape(shape?.tags.join(", "))}"></label><label class="form-field"><span>子任务（每行一步）</span><textarea name="subtasks" rows="3">${escape(shape?.subtasks.map((s) => s.title).join("\n"))}</textarea></label></details>
    <details class="editor-details" ${shape?.projectId || shape?.goalId ? "open" : ""}><summary>项目、目标与优先级 <small>可选</small></summary><div class="form-grid"><label class="form-field"><span>所属项目</span><select name="projectId"><option value="">不分类</option>${state.data.projects.map((p) => `<option value="${p.id}" ${p.id === (shape?.projectId || (page.startsWith("project:") ? page.slice(8) : "")) ? "selected" : ""}>${escape(p.name)}</option>`).join("")}</select></label><label class="form-field"><span>所属目标</span><select name="goalId"><option value="">不属于目标</option>${state.data.goals.map((g) => `<option value="${g.id}" ${g.id === shape?.goalId ? "selected" : ""}>${escape(g.name)}</option>`).join("")}<option value="__new__">＋ 新建目标…</option></select></label><label class="form-field"><span>优先级</span><select name="priority">${[0, 1, 2, 3].map((v) => `<option value="${v}" ${v === (shape?.priority ?? 0) ? "selected" : ""}>${["无", "低", "中", "高"][v]}</option>`).join("")}</select></label></div><div id="template-goal-inline" class="inline-create" hidden><input name="newGoalName" maxlength="40" placeholder="目标名称"><button id="template-create-goal" type="button" class="button secondary">创建并选用</button></div></details>
    <details class="editor-details" ${shape?.focusMinutes || shape?.scrapMinutes ? "open" : ""}><summary>专注时段与补做 <small>可选</small></summary><div class="form-grid"><label class="form-field"><span>每段专注时长（分钟）</span><input name="focusMinutes" type="number" min="1" max="180" value="${shape?.focusMinutes ?? ""}" placeholder="${state.data.settings.focusMinutes}，留空自动安排"></label><label class="form-field" id="repair-window-field"><span>重修窗口（分钟）</span><input name="scrapMinutes" type="number" min="0" max="10080" value="${shape?.scrapMinutes ?? 0}"><small>计划块结束后可补做的时间，仅当天有效。</small></label></div></details>
    <details class="editor-details" id="template-printing-options" ${mode === "automatic" || kind === "weekly" ? "open" : ""}><summary>印刷安排 <small id="printing-option-label">自动印刷时填写</small></summary><label class="form-field"><span>印刷规则</span><select name="printing"><option value="once" ${kind === "once" ? "selected" : ""}>不重复 · 按具体日期安排</option><option value="calendar" ${kind === "calendar" ? "selected" : ""}>不重复 · 分时日程表</option><option value="weekly" ${kind === "weekly" ? "selected" : ""}>重复 · 每周循环</option></select></label><div id="automatic-printing-options"><label class="form-field"><span>提前印出未来多少天？</span><input name="printAheadDays" type="number" min="0" max="90" value="${template?.printAheadDays ?? 7}"><small>默认提前 7 天；重复安排印完涉及的完整周。0 表示本周或当天日程，运行时补齐尚未报废的遗漏。</small></label></div><div id="template-weekly" class="form-field"><span>周期内时段 <small>默认一周；一个开始时间对应多个星期单元，每次印完完整周</small></span><div id="template-slots">${slots.map((s) => habitSlotHtml(s.days, s.time ?? "")).join("")}</div><button type="button" id="template-add-slot" class="text-button">${icon("plus")} 添加周期时段</button></div><div id="habit-group-field"><label class="form-field"><span>习惯分组</span><select name="habitId"><option value="">自动按任务名称创建</option>${state.data.habits.map((h) => `<option value="${escape(h.id)}" ${h.id === shape?.habitId ? "selected" : ""}>${escape(h.name)}</option>`).join("")}<option value="__new__">＋ 新建习惯组…</option></select></label><div id="habit-group-inline" class="inline-create" hidden><input name="newHabitName" maxlength="40" placeholder="习惯组名称"><button type="button" id="template-create-habit" class="button secondary">创建并选用</button></div></div></details>
    <div id="manual-printing-options"><label class="setting-row"><span><strong>保存时一起印刷</strong><small>关闭时只保留模板，需要时再手动印刷。</small></span><input name="printNow" class="switch" type="checkbox"></label><div class="form-grid" id="manual-print-range"><label class="form-field"><span>印刷起始日期</span><input name="printDate" type="date" value="${state.today}"></label><label class="form-field"><span>印刷结束日期</span><input name="printUntil" type="date" value="${state.today}"></label></div></div>
    <p id="template-type" class="editor-hint"></p><div class="modal-actions"><button type="button" class="button secondary" data-action="close-modal">取消</button><div><button type="submit" name="save" value="only" id="save-template-only" class="button secondary">保存模板</button><button type="submit" name="save" value="print" id="create-from-editor" class="button primary">创建任务</button></div></div>
  </form>`,
    true,
  );
  const form = $<HTMLFormElement>("#template-form"),
    input = (name: string) => form.elements.namedItem(name) as HTMLInputElement;
  let previousMode: string = mode;
  let printingTouched = !!rule || weekly;
  input("printing").addEventListener("change", () => {
    printingTouched = true;
  });
  const update = () => {
    const mode = input("creationMode").value;
    const retained = mode !== "instance",
      automatic = mode === "automatic",
      print = mode === "manual" && input("printNow").checked;
    const weekly = retained && input("printing").value === "weekly";
    const calendar = input("printing").value === "calendar";
    const goal = !!input("goalId").value;
    $("#creation-mode-hint").textContent =
      mode === "instance"
        ? "印出本次实例或整份日程，不保留模板。"
        : automatic
          ? "保留模板，运行时按安排自动印出近期任务。"
          : "保留模板与安排，需要时手动印刷整份日程或完整周期。";
    $("#template-printing-options").hidden = !retained;
    $("#automatic-printing-options").hidden = !automatic;
    input("printAheadDays").disabled = !automatic;
    input("printing").disabled = false;
    input("dueDate").disabled = mode === "manual" || calendar || weekly;
    input("printDate").disabled = !print || calendar;
    input("printUntil").disabled = !print || calendar;
    input("reminderTime").disabled = weekly || calendar;
    input("reminderTime").required = false;
    input("dueDate").required = automatic && !weekly && !calendar;
    $("#template-calendar").hidden = !calendar;
    $("#instance-more-dates").hidden = retained || calendar;
    form
      .querySelectorAll<HTMLInputElement>("#calendar-entries input")
      .forEach((i) => {
        i.disabled = !calendar;
        i.required = calendar && i.type === "date";
      });
    form
      .querySelectorAll<HTMLInputElement>("#template-slots input")
      .forEach((i) => {
        i.disabled = !weekly;
      });
    $("#manual-printing-options").hidden = mode !== "manual";
    $("#manual-print-range").hidden = !print || calendar;
    $("#printing-option-label").textContent = automatic
      ? "周期与预印"
      : "可选，批量使用时再填写";
    $("#template-weekly").hidden = !weekly;
    $("#template-once").hidden =
      weekly ||
      calendar ||
      (mode === "manual" &&
        !print &&
        !goal &&
        !input("reminderTime").value &&
        !$<HTMLDetailsElement>("#template-printing-options").open);
    $("#instance-date-field").hidden = mode === "manual";
    $("#instance-date-label").textContent = automatic
      ? "自动印刷日期"
      : "计划日期";
    $("#template-goal-inline").hidden = input("goalId").value !== "__new__";
    const timed = weekly
      ? [
          ...form.querySelectorAll<HTMLInputElement>(
            "#template-slots input[type=time]",
          ),
        ].some((i) => !!i.value)
      : calendar
        ? [
            ...form.querySelectorAll<HTMLInputElement>(
              "#calendar-entries input[type=time]",
            ),
          ].some((i) => !!i.value)
        : !!input("reminderTime").value;
    const habit = weekly && timed;
    $("#habit-group-field").hidden = !habit;
    input("habitId").disabled = !habit;
    $("#habit-group-inline").hidden = input("habitId").value !== "__new__";
    $("#repair-window-field").hidden = goal || habit || !timed;
    input("scrapMinutes").disabled = goal || habit;
    $("#template-type").textContent = goal
      ? "实例按组标识和执行日期配对主线节点，节点裁定后报废；可使用重复安排。"
      : habit
        ? "习惯漏做记缺勤，不补做。"
        : timed
          ? "超过计划块但还在重修窗口内时，会进入待补队列。"
          : "";
    $("#save-template-only").hidden = mode !== "manual" || !print;
    $("#create-from-editor").textContent =
      mode === "instance"
        ? "创建任务"
        : mode === "manual" && print
          ? "保存并印刷"
          : "保存模板";
    try {
      const budget = focusBudget(
        Number(input("durationMinutes").value),
        input("focusMinutes").value
          ? Number(input("focusMinutes").value)
          : null,
      );
      $("#duration-preview").textContent =
        budget.blockMinutes === budget.workMinutes
          ? `自动安排，预留 ${budget.workMinutes} 分钟专注。`
          : `自动安排，预留 ${budget.workMinutes} 分钟专注，含休息约 ${budget.blockMinutes} 分钟。`;
      input("durationMinutes").setCustomValidity("");
    } catch (error) {
      $("#duration-preview").textContent = String(error);
      input("durationMinutes").setCustomValidity("请填写有效的预计用时");
    }
  };
  input("creationMode").addEventListener("change", () => {
    const next = input("creationMode").value;
    if (next === "instance" && input("printing").value === "weekly")
      input("printing").value = "once";
    if (next === "automatic" && previousMode !== "automatic") {
      if (!printingTouched) input("printing").value = "weekly";
      $<HTMLDetailsElement>("#template-printing-options").open = true;
    }
    if (next === "manual" && previousMode !== "manual") {
      if (!printingTouched) input("printing").value = "once";
      $<HTMLDetailsElement>("#template-printing-options").open =
        input("printing").value === "weekly";
    }
    previousMode = next;
    update();
  });
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  $("#template-printing-options").addEventListener("toggle", update);
  $("#template-add-slot").onclick = () => {
    $("#template-slots").insertAdjacentHTML("beforeend", habitSlotHtml([], ""));
    icons();
    update();
  };
  $("#instance-more-dates").onclick = () => {
    const row = $("#calendar-entries [data-calendar-entry]");
    row.querySelector<HTMLInputElement>("input[type=date]")!.value =
      input("dueDate").value || state.today;
    row.querySelector<HTMLInputElement>("input[type=time]")!.value =
      input("reminderTime").value;
    input("printing").value = "calendar";
    printingTouched = true;
    update();
  };
  $("#calendar-add").onclick = () => {
    $("#calendar-entries").insertAdjacentHTML(
      "beforeend",
      calendarEntryHtml([state.today], ""),
    );
    icons();
    update();
  };
  form.addEventListener("click", (e) => {
    const target = e.target as Element;
    const addDate = target.closest("[data-add-date]");
    if (addDate) {
      addDate
        .closest("[data-calendar-entry]")!
        .querySelector(".calendar-dates")!
        .insertAdjacentHTML("beforeend", calendarDateHtml(state.today));
      icons();
      update();
    }
    const removeDate = target.closest("[data-remove-date]");
    if (
      removeDate &&
      removeDate.closest(".calendar-dates")!.querySelectorAll("input").length >
        1
    ) {
      removeDate.closest(".calendar-date")?.remove();
      update();
    }
    const calendarButton = (e.target as Element).closest(
      "[data-remove-calendar]",
    );
    if (
      calendarButton &&
      form.querySelectorAll("[data-calendar-entry]").length > 1
    ) {
      calendarButton.closest("[data-calendar-entry]")?.remove();
      update();
    }
    const button = (e.target as Element).closest("[data-remove-slot]");
    if (button && form.querySelectorAll("[data-slot]").length > 1) {
      button.closest("[data-slot]")?.remove();
      update();
    }
  });
  $("#template-create-goal").onclick = async () => {
    if (
      await act(
        {
          type: "saveGoal",
          id: null,
          name: input("newGoalName").value,
          nodes: [],
        },
        "目标已创建",
      )
    ) {
      const goal = state.data.goals.at(-1)!;
      input("goalId").insertAdjacentHTML(
        "beforeend",
        `<option value="${escape(goal.id)}">${escape(goal.name)}</option>`,
      );
      input("goalId").value = goal.id;
      update();
    }
  };
  $("#template-create-habit").onclick = async () => {
    if (
      await act(
        { type: "saveHabitGroup", id: null, name: input("newHabitName").value },
        "习惯组已创建",
      )
    ) {
      const habit = state.data.habits.at(-1)!;
      input("habitId").insertAdjacentHTML(
        "beforeend",
        `<option value="${escape(habit.id)}">${escape(habit.name)}</option>`,
      );
      input("habitId").value = habit.id;
      update();
    }
  };
  update();
  form.onsubmit = async (event) => {
    event.preventDefault();
    const mode = input("creationMode").value,
      weekly = mode !== "instance" && input("printing").value === "weekly";
    const formSlots = [
      ...form.querySelectorAll<HTMLElement>("[data-slot]"),
    ].map((row) => ({
      days: [...row.querySelectorAll<HTMLInputElement>("input:checked")].map(
        (i) => Number(i.value),
      ),
      time:
        row.querySelector<HTMLInputElement>("input[type=time]")!.value || null,
    }));
    const budget = focusBudget(
      Number(input("durationMinutes").value),
      input("focusMinutes").value ? Number(input("focusMinutes").value) : null,
    );
    const substeps = input("subtasks")
      .value.split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((title, i) => ({
        id:
          shape?.subtasks[i]?.title === title
            ? shape.subtasks[i].id
            : crypto.randomUUID(),
        title,
      }));
    const nextShape = {
      title: input("title").value,
      notes: input("notes").value,
      projectId: input("projectId").value || null,
      goalId: input("goalId").value || null,
      habitId:
        weekly && formSlots.some((s) => s.time)
          ? input("habitId").value || null
          : null,
      focusMinutes: budget.focusMinutes,
      estimate: budget.estimate,
      scrapMinutes: input("scrapMinutes").disabled
        ? 0
        : Number(input("scrapMinutes").value),
      priority: Number(input("priority").value),
      tags: input("tags")
        .value.split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
      subtasks: substeps,
    };
    const calendar = input("printing").value === "calendar";
    const calendarSlots = [
      ...form.querySelectorAll<HTMLElement>("[data-calendar-entry]"),
    ].map((row) => ({
      dates: [
        ...row.querySelectorAll<HTMLInputElement>("input[type=date]"),
      ].map((i) => i.value),
      time:
        row.querySelector<HTMLInputElement>("input[type=time]")!.value || null,
    }));
    const date =
      mode === "manual"
        ? input("printDate").value || null
        : input("dueDate").value || null;
    const printing: Template["printing"] = weekly
      ? { kind: "weekly", slots: formSlots }
      : calendar
        ? { kind: "calendar", slots: calendarSlots }
        : {
            kind: "once",
            date: mode === "manual" ? null : date,
            time: input("reminderTime").value || null,
          };
    if (mode === "instance") {
      if (
        await act(
          { type: "printInstances", shape: nextShape, printing },
          "实例已印出",
        )
      )
        closeModal();
      return;
    }
    const next: Template = {
      id: template?.id || crypto.randomUUID(),
      automatic: mode === "automatic",
      printAheadDays:
        mode === "automatic"
          ? Number(input("printAheadDays").value)
          : (template?.printAheadDays ?? 7),
      shape: nextShape,
      printing,
    };
    const print =
      mode === "manual" &&
      input("printNow").checked &&
      (event as SubmitEvent).submitter?.getAttribute("value") === "print";
    let printDates: (string | null)[] = [];
    try {
      if (print && printing.kind === "calendar")
        printDates = [...new Set(printing.slots.flatMap((s) => s.dates))];
      else if (print)
        printDates = datesForPrinting(
          next.printing,
          date,
          input("printUntil").value || null,
        );
    } catch (error) {
      toast(String(error));
      return;
    }
    if (
      await act(
        { type: "saveTemplate", template: next, printDates },
        print ? "模板已保存，实例已印出" : "模板已保存",
      )
    )
      closeModal();
  };
}

function taskDialog(id?: string) {
  const task = state.data.tasks.find((t) => t.id === id);
  if (task && nodeOf(task)?.result) {
    const n = nodeOf(task)!;
    modal(
      `${modalHeader("实例记录", task.title)}<p>所属节点「${escape(n.spec.name)}」已裁定${verdictLabel(n.result!.verdict)}，本实例已报废。</p><p class="subtle">${task.completed ? "这条任务已完成，完成记录保留。" : "这条任务未完成，原完成状态保留。"}</p><p class="preserve-lines">${escape(task.notes)}</p><ul>${task.subtasks.map((s) => `<li>${s.done ? "已完成" : "未完成"} · ${escape(s.title)}</li>`).join("")}</ul><div class="modal-actions"><button class="button secondary" data-action="close-modal">关闭</button></div>`,
    );
    return;
  }
  const subs = task?.subtasks.map((s) => ({ ...s })) || [];
  const projectId =
    task?.projectId || (page.startsWith("project:") ? page.slice(8) : "");
  modal(
    `${modalHeader(task ? "编辑实例" : "直接创建实例", "日期、完成状态和专注记录属于这一次执行。")}
    <form id="task-form"><label class="form-field"><span>任务名称</span><input name="title" maxlength="200" required autofocus value="${escape(task?.title)}"></label>
    <div class="form-grid"><label class="form-field"><span>所属项目</span><select name="projectId"><option value="">不分类</option>${state.data.projects.map((p) => `<option value="${p.id}" ${p.id === projectId ? "selected" : ""}>${escape(p.name)}</option>`).join("")}</select></label><label class="form-field"><span>所属目标</span><select name="goalId"><option value="">不属于目标</option>${state.data.goals.map((g) => `<option value="${g.id}" ${g.id === task?.goalId ? "selected" : ""}>${escape(g.name)}</option>`).join("")}</select></label><label class="form-field"><span>计划日期</span><input name="dueDate" type="date" value="${task ? task.dueDate || "" : state.today}"></label><label class="form-field"><span>提醒时间</span><input name="reminderTime" type="time" value="${escape(task?.reminderTime)}"></label><label class="form-field"><span>单次专注时长</span><input name="focusMinutes" type="number" min="1" max="180" value="${task?.focusMinutes ?? ""}" placeholder="${state.data.settings.focusMinutes}"></label><label class="form-field"><span>预计用时（分钟）</span><input name="durationMinutes" type="number" min="1" max="17820" required value="${(task?.estimate ?? 1) * (task?.focusMinutes ?? state.data.settings.focusMinutes)}"><small id="instance-duration-preview"></small></label><label class="form-field"><span>优先级</span><select name="priority">${[0, 1, 2, 3].map((v) => `<option value="${v}" ${v === (task?.priority ?? 0) ? "selected" : ""}>${["无", "低", "中", "高"][v]}</option>`).join("")}</select></label><label class="form-field"><span>重修窗口（分钟）</span><input name="scrapMinutes" type="number" min="0" max="10080" required value="${task?.scrapMinutes ?? 0}"></label></div>
    <p class="subtle small">普通实例在计划块结束后、当天内可重修；目标实例由配对节点裁定报废，习惯不重修。重复安排请在模板编辑器中设置。</p><label class="form-field"><span>备注</span><textarea name="notes" rows="3" maxlength="15000">${escape(task?.notes)}</textarea></label><label class="form-field"><span>标签（逗号分隔）</span><input name="tags" value="${escape(task?.tags.join(", "))}"></label><div class="form-field"><span>子任务</span><div id="subtask-editor"></div><div class="subtask-add"><input id="subtask-input" maxlength="200" placeholder="添加一个子任务"><button type="button" class="icon-btn" id="add-subtask" aria-label="添加子任务">${icon("plus")}</button></div></div>
    <div class="modal-actions">${task ? `<button type="button" class="text-button danger-text" data-delete-task="${task.id}">删除任务</button>` : '<button type="button" class="text-button" data-action="new-task">使用模板编辑器</button>'}<div><button type="button" class="button secondary" data-action="close-modal">取消</button><button type="submit" class="button primary">${task ? "保存修改" : "创建任务"}</button></div></div></form>`,
    true,
  );
  const draw = () => {
    $("#subtask-editor").innerHTML = subs
      .map(
        (s, i) =>
          `<div class="subtask-editor-row"><input type="checkbox" data-sub-index="${i}" aria-label="完成子任务" ${s.done ? "checked" : ""}><span>${escape(s.title)}</span><button type="button" class="icon-btn tiny" data-sub-delete="${i}" aria-label="删除子任务">${icon("x")}</button></div>`,
      )
      .join("");
    icons();
    document
      .querySelectorAll<HTMLInputElement>("[data-sub-index]")
      .forEach((el) => {
        el.onchange = () => {
          subs[Number(el.dataset.subIndex)].done = el.checked;
        };
      });
    document
      .querySelectorAll<HTMLButtonElement>("[data-sub-delete]")
      .forEach((el) => {
        el.onclick = () => {
          subs.splice(Number(el.dataset.subDelete), 1);
          draw();
        };
      });
  };
  const add = () => {
    const input = $<HTMLInputElement>("#subtask-input");
    if (input.value.trim()) {
      subs.push({
        id: crypto.randomUUID(),
        title: input.value.trim(),
        done: false,
      });
      input.value = "";
      draw();
    }
  };
  $("#add-subtask").onclick = add;
  $("#subtask-input").addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") {
      e.preventDefault();
      add();
    }
  });
  draw();
  const taskForm = $<HTMLFormElement>("#task-form");
  const updateDuration = () => {
    const f = new FormData(taskForm);
    const duration = taskForm.elements.namedItem(
      "durationMinutes",
    ) as HTMLInputElement;
    try {
      const budget = focusBudget(
        Number(f.get("durationMinutes")),
        f.get("focusMinutes") ? Number(f.get("focusMinutes")) : null,
      );
      $("#instance-duration-preview").textContent =
        `自动安排，预留 ${budget.workMinutes} 分钟专注，含休息约 ${budget.blockMinutes} 分钟。`;
      duration.setCustomValidity("");
    } catch {
      duration.setCustomValidity("请填写有效的预计用时");
    }
  };
  taskForm.addEventListener("input", updateDuration);
  updateDuration();
  $("#task-form").onsubmit = async (e) => {
    e.preventDefault();
    add();
    const f = new FormData(e.target as HTMLFormElement);
    const budget = focusBudget(
      Number(f.get("durationMinutes")),
      f.get("focusMinutes") ? Number(f.get("focusMinutes")) : null,
    );
    if (
      await act(
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
            focusMinutes: budget.focusMinutes,
            scrapMinutes: Number(f.get("scrapMinutes")),
            priority: Number(f.get("priority")),
            estimate: budget.estimate,
            tags: String(f.get("tags"))
              .split(/[,，]/)
              .map((s) => s.trim())
              .filter(Boolean),
            subtasks: subs,
          },
        },
        task ? "实例已更新" : "实例已创建",
      )
    )
      closeModal();
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
function nodeEditorHtml(
  spec: NodeSpec,
  runtime: MainlineNode | undefined,
  last: boolean,
) {
  const locked = !!runtime?.result;
  const field = (
    key: string,
    type: string,
    value: string | number,
    extra = "",
  ) =>
    `<input data-node-field="${key}" name="node${key}" type="${type}" value="${escape(String(value))}" ${extra}>`;
  const options = <T extends string>(
    entries: [T, string][],
    selected: string,
  ) =>
    entries
      .map(
        ([key, label]) =>
          `<option value="${key}" ${selected === key ? "selected" : ""}>${label}</option>`,
      )
      .join("");
  const blocks = Object.entries(blockLabels) as [BlockRule, string][];
  const signal = spec.signal;
  return `<section class="node-editor" data-node-row="${escape(spec.id)}" data-locked="${locked}" data-last-end="${escape(spec.end)}"><div class="goal-head"><h3>阶段节点</h3><button type="button" class="icon-btn" data-remove-node ${runtime?.result || runtime?.emitted || (runtime && state.data.nodeBindings.some((b) => b.nodeId === spec.id)) || state.data.signalEvents.some((e) => e.deliveries.some((d) => d.nodeId === spec.id)) ? "disabled" : ""} aria-label="移除节点">${icon("x")}</button></div><label class="form-field"><span>节点名称</span>${field("name", "text", spec.name, 'required maxlength="80"')}</label><div class="form-grid"><label class="form-field"><span>配对起始时间</span>${field("start", "datetime-local", spec.start, "required")}</label><label class="form-field"><span>配对结束时间（不含）</span>${field("end", "datetime-local", spec.end, "required")}</label></div><details class="editor-details" ${spec.requiredTasks > 1 || spec.confirmationRequired ? "open" : ""}><summary>阶段完成要求 <small>默认配对任务全部完成</small></summary><label class="form-field"><span>至少配对几条任务</span>${field("requiredTasks", "number", spec.requiredTasks, 'min="1" max="50000" required')}<small>没有配对任务时不会视为完成；所有已配对任务都必须完成。</small></label><label class="setting-row"><span><strong>还需要手动确认阶段要求</strong><small>用于验收、考试或其他不能只靠任务勾选判断的要求。</small></span><input data-node-field="confirmationRequired" class="switch" type="checkbox" ${spec.confirmationRequired ? "checked" : ""}></label></details><label class="form-field"><span>发出的信号</span><select data-node-field="signalKind">${options([["none", "不发信号"], ["success", "裁定成功"], ["failure", "裁定失败"], ...(last ? ([["check", "末节点检查"]] as [string, string][]) : [])], signal?.kind ?? "none")}</select><small>成功或失败都会报废配对实例，裁定不可撤销。</small></label><div data-signal-controls><div class="form-grid"><label class="form-field"><span>何时发出</span>${field("signalAt", "datetime-local", signal?.at ?? spec.end, "required")}</label><label class="form-field"><span>传播方向</span><select data-node-field="direction">${options(
    [
      ["head", "向头节点"],
      ["tail", "向尾节点"],
    ],
    signal?.direction ?? "head",
  )}</select></label><label class="form-field"><span>到时还需满足</span><select data-node-field="condition">${options(
    [
      ["always", "不检查自身完成情况"],
      ["completed", "自身节点已经完成"],
      ["incomplete", "自身节点尚未完成"],
    ],
    signal?.condition ?? "always",
  )}</select></label></div><details class="editor-details" ${spec.blockSuccess !== "never" || spec.blockFailure !== "never" ? "open" : ""}><summary>阻断外来报废信号 <small>成功与失败分别设置</small></summary><label class="form-field"><span>接收成功信号时</span><select data-node-field="blockSuccess">${options(blocks, spec.blockSuccess)}</select></label><label class="form-field"><span>接收失败信号时</span><select data-node-field="blockFailure">${options(blocks, spec.blockFailure)}</select></label><p class="subtle small">条件按本节点的配对及完成情况判断。自身信号和末节点检查始终接受。</p></details></div>${locked ? `<p class="editor-hint">已裁定${verdictLabel(runtime!.result!.verdict)}，只能改名，规则与范围已冻结。</p>` : runtime?.emitted ? '<p class="editor-hint">信号已发出，不能改写原信号。</p>' : ""}</section>`;
}
function goalDialog(id?: string) {
  const goal = state.data.goals.find((g) => g.id === id);
  let specs = goal?.nodes.map((n) => structuredClone(n.spec)) ?? [];
  modal(
    `${modalHeader(goal ? "编辑目标组与主线" : "新建目标", "主线管理节点与裁定，实例仍由模板印刷。")}
    <form id="goal-form"><label class="form-field"><span>任务组名称</span><input name="name" required maxlength="40" autofocus value="${escape(goal?.name)}" placeholder="例如：操作系统学习"></label>${goal ? `<details class="editor-details"><summary>永久配对标识符</summary><p class="identity-value">${escape(goal.id)}</p><p class="subtle small">改名和编辑主线都不会改变；删除后的 ID 也不能用于新建实体。</p></details>` : '<p class="editor-hint">保存时生成永久唯一的任务组标识符。</p>'}<div id="mainline-editor"></div><button type="button" id="add-mainline-node" class="text-button">${icon("plus")} 添加节点</button><p class="subtle small">按执行开始时间匹配，区间不重叠。到时未完成不会自行过期，只有信号能够裁定。</p><div class="modal-actions">${goal && !goal.nodes.some((n) => n.result || n.emitted) ? '<button type="button" class="text-button danger-text" id="delete-goal">删除目标组</button>' : "<span></span>"}<div><button type="button" class="button secondary" data-action="close-modal">取消</button><button type="submit" class="button primary">保存目标</button></div></div></form>`,
    true,
  );
  const form = $<HTMLFormElement>("#goal-form");
  const get = (row: Element, key: string) =>
    row.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[data-node-field="${key}"]`,
    )!;
  const collect = (): NodeSpec[] =>
    [...form.querySelectorAll<HTMLElement>("[data-node-row]")].map((row) => {
      const kind = get(row, "signalKind").value;
      return {
        id: row.dataset.nodeRow!,
        name: get(row, "name").value,
        start: get(row, "start").value,
        end: get(row, "end").value,
        requiredTasks: Number(get(row, "requiredTasks").value),
        confirmationRequired: (
          get(row, "confirmationRequired") as HTMLInputElement
        ).checked,
        signal:
          kind === "none"
            ? null
            : {
                kind: kind as "success" | "failure" | "check",
                direction: get(row, "direction").value as "head" | "tail",
                at: get(row, "signalAt").value,
                condition: get(row, "condition").value as
                  "always" | "completed" | "incomplete",
              },
        blockSuccess:
          kind === "none"
            ? "never"
            : (get(row, "blockSuccess").value as BlockRule),
        blockFailure:
          kind === "none"
            ? "never"
            : (get(row, "blockFailure").value as BlockRule),
      };
    });
  const update = () => {
    for (const row of form.querySelectorAll<HTMLElement>("[data-node-row]")) {
      const kind = get(row, "signalKind").value,
        hasSignal = kind !== "none",
        check = kind === "check";
      const runtime = goal?.nodes.find(
        (n) => n.spec.id === row.dataset.nodeRow,
      );
      (row.querySelector("[data-signal-controls]") as HTMLElement).hidden =
        !hasSignal;
      if (check) {
        get(row, "direction").value = "head";
        get(row, "condition").value = "always";
      }
      row
        .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
          "[data-node-field]",
        )
        .forEach((input) => {
          const key = input.dataset.nodeField!;
          const signalField = [
            "signalAt",
            "direction",
            "condition",
            "blockSuccess",
            "blockFailure",
          ].includes(key);
          input.disabled =
            (row.dataset.locked === "true" && key !== "name") ||
            (signalField && !hasSignal) ||
            (check && ["direction", "condition"].includes(key)) ||
            (!!runtime?.emitted &&
              ["signalKind", "signalAt", "direction", "condition"].includes(
                key,
              ));
        });
      get(row, "end").setCustomValidity(
        get(row, "end").value <= get(row, "start").value
          ? "结束时间必须晚于起始时间"
          : "",
      );
    }
  };
  const draw = () => {
    $("#mainline-editor").innerHTML = specs
      .map((s, i) =>
        nodeEditorHtml(
          s,
          goal?.nodes.find((n) => n.spec.id === s.id),
          i === specs.length - 1,
        ),
      )
      .join("");
    $("#add-mainline-node").toggleAttribute(
      "disabled",
      !!goal?.nodes.at(-1)?.emitted || !!goal?.nodes.at(-1)?.result,
    );
    icons();
    update();
  };
  $("#add-mainline-node").onclick = () => {
    specs = collect();
    const previous = specs.at(-1);
    if (previous?.signal?.kind === "check") {
      previous.signal = null;
      previous.blockSuccess = "never";
      previous.blockFailure = "never";
    }
    const start = previous?.end ?? `${state.today}T00:00`;
    const end = `${shiftedDate(start.slice(0, 10), 7)}T${start.slice(11)}`;
    specs.push({
      id: crypto.randomUUID(),
      name: "",
      start,
      end,
      requiredTasks: 1,
      confirmationRequired: false,
      signal: {
        kind: "check",
        direction: "head",
        at: end,
        condition: "always",
      },
      blockSuccess: "never",
      blockFailure: "never",
    });
    draw();
  };
  form.addEventListener("input", (e) => {
    const input = e.target as HTMLInputElement;
    if (input.dataset.nodeField === "end") {
      const row = input.closest<HTMLElement>("[data-node-row]")!;
      if (get(row, "signalAt").value === row.dataset.lastEnd)
        get(row, "signalAt").value = input.value;
      row.dataset.lastEnd = input.value;
    }
    update();
  });
  form.addEventListener("change", update);
  form.addEventListener("click", (e) => {
    const button = (e.target as Element).closest("[data-remove-node]");
    if (!button) return;
    specs = collect().filter(
      (s) =>
        s.id !==
        button.closest<HTMLElement>("[data-node-row]")!.dataset.nodeRow,
    );
    draw();
  });
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (
      await act(
        {
          type: "saveGoal",
          id: goal?.id ?? null,
          name: form.querySelector<HTMLInputElement>("[name=name]")!.value,
          nodes: collect(),
        },
        "目标组与主线已保存",
      )
    )
      closeModal();
  };
  const deleteButton = form.querySelector<HTMLButtonElement>("#delete-goal");
  if (deleteButton)
    deleteButton.onclick = () =>
      confirmDialog(
        "删除目标组？",
        "未裁定实例保留并移出任务组，组与节点的 ID 将永久保留，不能复用。",
        "删除目标组",
        async () => {
          await act({ type: "deleteGoal", id: goal!.id }, "目标组已删除");
        },
        true,
      );
  draw();
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
    .querySelectorAll<HTMLInputElement>("[data-strict-lock]")
    .forEach((input) => {
      input.addEventListener("change", async () => {
        const schedule = state.data.lock.schedules.find(
          (s) => s.id === input.dataset.strictLock,
        );
        if (!schedule) return;
        const strict = input.checked;
        input.checked = schedule.strict;
        await saveLockSchedule({ ...schedule, strict });
      });
    });
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
      ![1, 2, 3, 4].includes(plan.version) ||
      !Array.isArray(plan.tasks) ||
      !Array.isArray(plan.projects)
    ) {
      throw new Error(
        "请选择 tomato-todo-plan v1/v2/v3/v4 计划文件；完整备份请使用“导入备份”。",
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
  if (d.deleteHabit) {
    confirmDialog(
      "删除习惯组？",
      "已印实例会移出习惯组并保留，后续自动印刷停止。",
      "删除习惯组",
      async () => {
        await act(
          { type: "deleteHabit", id: d.deleteHabit },
          "习惯组已删除，实例已保留",
        );
      },
      true,
    );
    return;
  }
  if (d.editTemplate) {
    templateDialog(d.editTemplate);
    return;
  }
  if (d.printTemplate) {
    printDialog(d.printTemplate);
    return;
  }
  if (d.syncTemplate) {
    confirmDialog(
      "同步到未完成实例？",
      "只同步形状；保留日期、管辖、步骤进度和专注记录。已完成实例保持原样。",
      "同步实例",
      async () => {
        await act(
          { type: "syncTemplate", id: d.syncTemplate },
          "未完成实例已同步",
        );
      },
    );
    return;
  }
  if (d.deleteTemplate) {
    confirmDialog(
      "删除模板？",
      "保留已印出的实例，停止今后的自动印刷。",
      "删除模板",
      async () => {
        await act(
          { type: "deleteTemplate", id: d.deleteTemplate },
          "模板已删除",
        );
      },
      true,
    );
    return;
  }
  if (d.action === "direct-instance") {
    taskDialog();
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
  if (d.weekPrev !== undefined) {
    weekOffset -= 1;
    render();
    return;
  }
  if (d.weekNext !== undefined) {
    weekOffset += 1;
    render();
    return;
  }
  if (d.weekNow !== undefined) {
    weekOffset = 0;
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
  if (d.restorePaired) {
    const record = state.data.identities.find(
      (r) => r.id === d.restorePaired && r.retired && r.restoreTask,
    );
    if (record?.restoreTask)
      await act(
        { type: "restoreTask", task: JSON.parse(record.restoreTask) },
        "原配对任务已恢复",
      );
    return;
  }
  if (d.confirmNode) {
    await act(
      {
        type: "confirmNode",
        goalId: d.nodeGoal,
        nodeId: d.confirmNode,
        confirmed: d.confirmed === "true",
      },
      "阶段完成确认已保存",
    );
    return;
  }
  if (d.editGoal) {
    goalDialog(d.editGoal);
    return;
  }
  if (d.editHabit) {
    const template = state.data.templates.find(
      (t) => t.shape.habitId === d.editHabit,
    );
    if (template) templateDialog(template.id);
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
    case "new-template":
      templateDialog(undefined, false, "manual");
      break;
    case "new-task":
      templateDialog();
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
      templateDialog(undefined, true);
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
    templateDialog();
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
