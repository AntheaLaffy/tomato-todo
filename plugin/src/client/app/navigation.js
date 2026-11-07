// 主视图导航：切页、打开番茄面板、刷新时恢复，全部收在这里。
//
// 为什么需要独立模块：主视图（frame.js）由 main panel 挂载，而 HUD/沉浸层挂在
// shell.overlay 上，二者不在同一 React 树里；沉浸层的「查看今天日程」要能把
// 主视图切到 calendar 页并打开面板，只能通过模块级信号 + 订阅实现。
//
// 为什么只有一个入口 navigate({page, reason})：界面被谁、在什么时候改变，是
// 一个容易写错成「状态成立就执行」的问题（例如每次刷新都把面板拉回番茄）。
// 所有原因都走 shouldGrab 的判定表，组件只报告原因，不自己决定跳不跳。
//
// 持久化 {panel, page}：刷新后不仅页要回来，面板也要回到用户原来的地方；
// 新标签页 / 新会话是冷启动，按需求进今日专注。
const NAV_KEY = "tomato-dsh.nav"; // sessionStorage：{ panel, page }
const LEGACY_PAGE_KEY = "tomato-dsh.page"; // 旧版只存页（localStorage），保留兼容
const BOOT_KEY = "tomato-dsh.booted"; // sessionStorage：本标签页已经加载过一次

let activePageId = null;
let openPanelFn = null;
let coldStart = null; // null = 本次页面加载还没判定
let lastCompleteSerial = 0;
const listeners = new Set();

// ---------------------------------------------------------------- 会话记忆

function sessionGet(key) {
  try {
    if (typeof sessionStorage === "undefined" || !sessionStorage) return null;
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function sessionSet(key, value) {
  try {
    if (typeof sessionStorage === "undefined" || !sessionStorage) return;
    sessionStorage.setItem(key, value);
  } catch {
    /* 隐私模式 / 存储被禁用：退化为「没有会话记忆」，不抛异常 */
  }
}

function readLegacyPage() {
  try {
    if (typeof localStorage === "undefined" || !localStorage) return null;
    return localStorage.getItem(LEGACY_PAGE_KEY);
  } catch {
    return null;
  }
}

function writeLegacyPage(id) {
  try {
    if (typeof localStorage === "undefined" || !localStorage) return;
    localStorage.setItem(LEGACY_PAGE_KEY, id);
  } catch {
    /* 隐私模式：只在本次会话生效 */
  }
}

/**
 * 读取 {panel, page}；没有会话记录时把旧版的 `tomato-dsh.page` 迁移过来。
 *
 * 旧版本只有页、没有面板信息，迁移时按「对话」处理：不能因为读到旧页就
 * 擅自把面板打开——那正是「刷新自动回到番茄页」的来源。
 */
function readNavState() {
  const raw = sessionGet(NAV_KEY);
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          panel: parsed.panel === "tomato" ? "tomato" : "conversation",
          page: typeof parsed.page === "string" && parsed.page !== "" ? parsed.page : null,
        };
      }
    } catch {
      /* 损坏的记录当作没有，走旧 key 迁移 */
    }
  }
  const legacy = readLegacyPage();
  if (legacy === null || legacy === "") return null;
  const migrated = { panel: "conversation", page: legacy };
  writeNavState(migrated);
  return migrated;
}

function writeNavState(state) {
  sessionSet(NAV_KEY, JSON.stringify(state));
}

/** 清掉模块级导航缓存（测试隔离 / 浏览器控制台排查用）。 */
export function resetActivePageCache() {
  activePageId = null;
  coldStart = null;
  lastCompleteSerial = 0;
}

/** 本次页面加载是不是冷启动（新标签页 / 新会话）。 */
export function isColdStart() {
  if (coldStart !== null) return coldStart;
  coldStart = false;
  try {
    if (typeof sessionStorage === "undefined" || !sessionStorage) return false;
    coldStart = sessionStorage.getItem(BOOT_KEY) === null;
    sessionStorage.setItem(BOOT_KEY, "1");
  } catch {
    coldStart = false;
  }
  return coldStart;
}

/** 记住当前面板是不是番茄主视图（刷新后据此恢复；对话则什么都不做）。 */
export function setPanelVisible(visible) {
  const state = readNavState();
  writeNavState({
    panel: visible ? "tomato" : "conversation",
    page: (state && state.page) || activePageId || readLegacyPage(),
  });
}

export function isPanelVisible() {
  const state = readNavState();
  return !!state && state.panel === "tomato";
}

/** 有对话框开着时不抢页面：切页会把未保存的草稿丢掉（页面内 Modal 都带 role=dialog）。 */
export function dialogOpen() {
  try {
    return typeof document !== "undefined" && !!(document && document.querySelector?.('[role="dialog"]'));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- 页面信号

/** 读取当前页；首次调用时从会话记录（或旧版 localStorage）恢复。 */
export function getActivePageId() {
  if (activePageId === null) {
    const state = readNavState();
    activePageId = state && state.page ? state.page : readLegacyPage();
  }
  return activePageId;
}

/** 切换页并持久化；主视图会重渲染到新页。 */
export function setActivePageId(id) {
  if (typeof id !== "string" || id === "") return;
  activePageId = id;
  const state = readNavState();
  writeNavState({
    panel: state && state.panel ? state.panel : "conversation",
    page: id,
  });
  // 旧 key 继续写：旧版本 / 外部脚本仍按这个 key 读页。
  writeLegacyPage(id);
  for (const fn of Array.from(listeners)) {
    try {
      fn(id);
    } catch {
      /* 订阅者异常不影响其他订阅者 */
    }
  }
}

/** 订阅当前页变化（frame.js 用它把外部导航反映到界面）。 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------------------------------------------------------------- 注意力判定

/**
 * 哪种「原因」允许改变界面。表驱动、纯函数，方便逐行测试。
 *
 * | reason   | 结果 |
 * | boot     | 总是：冷启动进今日专注 |
 * | restore  | 仅当上次停在番茄面板：刷新静默还原，否则完全不动 |
 * | reminder | 从不：只亮 HUD / 顶栏提醒条并播放提示音，不能打断正在输入的对话 |
 * | complete | 没有对话框且 completionSerial 比上次已处理的大：切到今日专注 |
 * | user     | 总是：用户主动点击入口 / 日程 |
 */
export function shouldGrab(reason, ctx = {}) {
  switch (reason) {
    case "boot":
    case "user":
      return true;
    case "restore":
      return ctx.panel === "tomato";
    case "reminder":
      return false;
    case "complete":
      if (ctx.dialogOpen === true) return false;
      return Number(ctx.serial) > Number(ctx.lastSerial ?? 0);
    default:
      return false;
  }
}

function targetPage(reason, page, state) {
  if (reason === "boot" || reason === "complete") return "focus";
  if (reason === "restore") return (state && state.page) || "focus";
  return page;
}

/**
 * 唯一的界面切换入口。
 *
 * @param {object} options
 * @param {string|null} options.page 目标页；boot/complete 固定今日专注，restore 用保存页
 * @param {"boot"|"restore"|"reminder"|"complete"|"user"} options.reason 谁在请求
 * @param {number|null} options.serial complete 事件的 completionSerial（去重用）
 * @returns {boolean} 是否真的改变了界面
 */
export function navigate({ page = null, reason = "user", serial = null } = {}) {
  const state = readNavState();
  const completed = serial === null ? null : Number(serial) || 0;
  const grab = shouldGrab(reason, {
    dialogOpen: dialogOpen(),
    panel: state && state.panel,
    serial: completed ?? 0,
    lastSerial: lastCompleteSerial,
  });
  // 一轮结束是一个瞬间：即使这次因为有对话框而让位，也不要在对话框关掉后补跳。
  if (reason === "complete" && completed !== null) {
    lastCompleteSerial = Math.max(lastCompleteSerial, completed);
  }
  if (!grab) return false;

  const target = targetPage(reason, page, state);
  if (target && target !== activePageId) {
    activePageId = target;
    writeLegacyPage(target);
    for (const fn of Array.from(listeners)) {
      try {
        fn(target);
      } catch {
        /* 订阅者异常不影响其他订阅者 */
      }
    }
  }
  try {
    openPanelFn?.("tomato");
  } catch {
    /* DSH 版本差异时忽略 */
  }
  writeNavState({ panel: "tomato", page: target || (state && state.page) || null });
  return true;
}

/**
 * 页面加载时调用一次：冷启动进今日专注；刷新静默恢复上次的面板与页。
 * 返回是否改变了界面（测试与排查用）。
 */
export function restore() {
  return isColdStart()
    ? navigate({ page: "focus", reason: "boot" })
    : navigate({ reason: "restore" });
}

// ---------------------------------------------------------------- 项目筛选

// 侧栏项目列表 → 全部任务的项目筛选。导航信号只负责「切页」，筛选值单独走这里：
// 全部任务页挂载时取一次，切页后仍停在项目筛选上，用户可在页内改回全部项目。
let pendingTasksFilter = null;
const filterListeners = new Set();

/** 请全部任务页切到某个项目（null = 全部项目），并跳到该页。 */
export function openTasksForProject(projectId = null) {
  pendingTasksFilter = projectId;
  for (const fn of Array.from(filterListeners)) {
    try {
      fn(projectId);
    } catch {
      /* 订阅者异常不影响其他订阅者 */
    }
  }
  setActivePageId("tasks");
}

/** 全部任务页取走挂起的筛选值（消费一次）。 */
export function takeTasksFilter() {
  const value = pendingTasksFilter;
  pendingTasksFilter = null;
  return value;
}

export function subscribeTasksFilter(fn) {
  filterListeners.add(fn);
  return () => filterListeners.delete(fn);
}

/** app/main.js 在插件 apply 时把 ctx.layout.selectPanel 绑进来（参数是面板 id）。 */
export function bindPanelOpener(fn) {
  openPanelFn = typeof fn === "function" ? fn : null;
}
