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
// 持久化 {panel, page, projectId}：刷新后不仅页要回来，面板也要回到用户原来的
// 地方；项目详情页还要回到同一个项目（只记 page 会把用户丢进「项目不存在」）。
// 新标签页 / 新会话是冷启动，按需求进今日专注。
const NAV_KEY = "tomato-dsh.nav"; // sessionStorage：{ panel, page, projectId }
const LEGACY_PAGE_KEY = "tomato-dsh.page"; // 旧版只存页（localStorage），保留兼容
const BOOT_KEY = "tomato-dsh.booted"; // sessionStorage：本标签页已经加载过一次

let activePageId = null;
let activeProjectId = null; // 只在 page === "project" 时有意义
let openPanelFn = null;
let panelInfoObs = null; // DSH layout 的面板真值源（有它就不用猜）
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
 * 读取 {panel, page, projectId}；没有会话记录时把旧版的 `tomato-dsh.page` 迁移过来。
 *
 * 旧版本只有页、没有面板信息，迁移时按「对话」处理：不能因为读到旧页就
 * 擅自把面板打开——那正是「刷新自动回到番茄页」的来源。更旧的记录也可能
 * 没有 projectId（项目页是后加的），缺字段按 null 处理，页面自己显示空态。
 */
function readNavState() {
  const raw = sessionGet(NAV_KEY);
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          panel: parsed.panel === "tomato" ? "tomato" : "conversation",
          page:
            typeof parsed.page === "string" && parsed.page !== ""
              ? parsed.page
              : null,
          projectId:
            typeof parsed.projectId === "string" && parsed.projectId !== ""
              ? parsed.projectId
              : null,
        };
      }
    } catch {
      /* 损坏的记录当作没有，走旧 key 迁移 */
    }
  }
  const legacy = readLegacyPage();
  if (legacy === null || legacy === "") return null;
  const migrated = { panel: "conversation", page: legacy, projectId: null };
  writeNavState(migrated);
  return migrated;
}

function writeNavState(state) {
  // projectId 只在真正进项目页时才写：其它页保持旧记录形状（{panel, page}），
  // 这样刷新恢复的语义没有变，旧版本写入的记录也不需要迁移。
  const payload = { panel: state.panel, page: state.page };
  if (typeof state.projectId === "string" && state.projectId !== "") {
    payload.projectId = state.projectId;
  }
  sessionSet(NAV_KEY, JSON.stringify(payload));
}

/** 清掉模块级导航缓存（测试隔离 / 浏览器控制台排查用）。 */
export function resetActivePageCache() {
  activePageId = null;
  activeProjectId = null;
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
    projectId: activeProjectId ?? (state ? state.projectId : null),
  });
}

export function isPanelVisible() {
  const state = readNavState();
  return !!state && state.panel === "tomato";
}

/** 有对话框开着时不抢页面：切页会把未保存的草稿丢掉（页面内 Modal 都带 role=dialog）。 */
export function dialogOpen() {
  try {
    return (
      typeof document !== "undefined" &&
      !!(document && document.querySelector?.('[role="dialog"]'))
    );
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

/**
 * 读取当前项目（只在项目详情页有意义）。刷新后与页一起恢复；旧记录没有这个
 * 字段时返回 null——项目页会显示「项目不存在 / 已删除」，不会渲染半张页。
 */
export function getActiveProjectId() {
  if (activeProjectId === null) {
    const state = readNavState();
    activeProjectId =
      state && typeof state.projectId === "string" ? state.projectId : null;
  }
  return activeProjectId;
}

/** 写页 + 项目 + 广播；setActivePageId / openProject / restore 共用的唯一落点。 */
function applyPage(id, projectId) {
  activePageId = id;
  activeProjectId = projectId ?? null;
  const state = readNavState();
  writeNavState({
    panel: state && state.panel ? state.panel : "conversation",
    page: id,
    projectId: activeProjectId,
  });
  // 旧 key 继续写：旧版本 / 外部脚本仍按这个 key 读页。
  writeLegacyPage(id);
  for (const fn of Array.from(listeners)) {
    try {
      fn(id, activeProjectId);
    } catch {
      /* 订阅者异常不影响其他订阅者 */
    }
  }
}

/** 切换页并持久化；主视图会重渲染到新页。离开项目页时清掉 projectId。 */
export function setActivePageId(id) {
  if (typeof id !== "string" || id === "") return;
  // 显式切到 project 页时保留当前项目；切到别的页说明离开项目上下文。
  applyPage(id, id === "project" ? getActiveProjectId() : null);
}

/**
 * 打开某个项目的详情页。侧栏「我的项目」不再借用全部任务的筛选：项目有
 * 自己的任务、白名单与资料，筛选表达不了，也会把用户困在「全部任务」里。
 */
export function openProject(projectId) {
  if (typeof projectId !== "string" || projectId === "") return;
  applyPage("project", projectId);
}

/** 订阅当前页变化（frame.js 用它把外部导航反映到界面）；第二参是项目 id。 */
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
  // 项目页只有与 projectId 一起才有意义：restore 时从同一条记录取回；
  // 其余页一律清空，避免把上一次的项目带进「今日专注」。
  const projectId =
    target === "project" ? (state && state.projectId) || null : null;
  if (target && (target !== activePageId || projectId !== activeProjectId)) {
    activePageId = target;
    activeProjectId = projectId;
    writeLegacyPage(target);
    for (const fn of Array.from(listeners)) {
      try {
        fn(target, projectId);
      } catch {
        /* 订阅者异常不影响其他订阅者 */
      }
    }
  }
  selectPanelWithRetry("tomato");
  writeNavState({
    panel: "tomato",
    page: target || (state && state.page) || null,
    projectId: target ? projectId : activeProjectId,
  });
  return true;
}

/**
 * 页面加载时调用一次：冷启动进今日专注；刷新静默恢复上次的面板与页。
 * 返回是否改变了界面（测试与排查用）。
 */
export function restore() {
  if (isColdStart()) return navigate({ page: "focus", reason: "boot" });
  // 面板已经由 DSH 恢复成番茄（真值源这么说）：只把页恢复过去，不再调
  // selectPanel——重复设置会把「用户已经看到的界面」再切一次。
  if (currentPanelId() === "tomato") {
    const state = readNavState();
    const page = (state && state.page) || "focus";
    const projectId =
      page === "project" ? (state && state.projectId) || null : null;
    if (page !== activePageId || projectId !== activeProjectId) {
      activePageId = page;
      activeProjectId = projectId;
      writeLegacyPage(page);
      for (const fn of Array.from(listeners)) {
        try {
          fn(page, projectId);
        } catch {
          /* 订阅者异常不影响其他订阅者 */
        }
      }
    }
    writeNavState({ panel: "tomato", page, projectId });
    return false;
  }
  return navigate({ reason: "restore" });
}

// ---------------------------------------------------------------- 项目

// 侧栏「我的项目」→ 项目详情页（openProject）。仍保留「全部任务 + 项目筛选」
// 这条入口：其他页面里想直接看某个项目的任务清单时，用 openTasksForProject，
// 两个入口语义不同，不要合并。

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

/**
 * 绑定 DSH 的面板真值源（`ctx.layout.panelInfo`）。
 *
 * 为什么不能只靠「main 组件挂载 = 面板可见」：DSH 自己也能切面板（侧栏、对话
 * 按钮），组件挂载周期只是它的影子；而刷新时组件卸载与页面卸载的先后顺序并
 * 不可靠，用卸载写「已离开」会把「我在番茄页刷新」记成「我在对话页」。
 * 订阅真值源之后，{panel} 一直反映实际选择。
 */
export function bindPanelInfo(observer) {
  panelInfoObs =
    observer && typeof observer.subscribe === "function" ? observer : null;
  if (panelInfoObs === null) return;
  const sync = () => {
    const snapshot = panelInfoObs.getSnapshot?.() ?? null;
    setPanelVisible(snapshot?.activePanelId === "tomato");
  };
  sync();
  panelInfoObs.subscribe(sync);
}

/** 是否已经拿到面板真值源（拿不到时 frame.js 的挂载标记才是唯一线索）。 */
export function hasPanelInfo() {
  return panelInfoObs !== null;
}

/** 当前 DSH 选中的面板 id（拿不到真值源时返回 null）。 */
export function currentPanelId() {
  try {
    return panelInfoObs?.getSnapshot?.()?.activePanelId ?? null;
  } catch {
    return null;
  }
}

/**
 * 面板注册可能比 overlay 的 effect 晚一拍：selectPanel 对未注册的 id 会抛错。
 * 这里退避重试几次，而不是让「刷新恢复」因为一次时序竞态静默失败。
 */
function selectPanelWithRetry(panelId, attempt = 0) {
  try {
    openPanelFn?.(panelId);
    return true;
  } catch {
    if (attempt >= 20) return false;
    const delay = 50;
    if (typeof setTimeout === "function")
      setTimeout(() => selectPanelWithRetry(panelId, attempt + 1), delay);
    return false;
  }
}
