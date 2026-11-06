// 主视图导航信号：跨模块切换页面 / 打开番茄面板。
//
// 为什么需要独立模块：主视图（frame.js）由 main panel 挂载，而 HUD/沉浸层挂在
// shell.overlay 上，二者不在同一 React 树里；沉浸层的「查看今天日程」要能把
// 主视图切到 calendar 页并打开面板，只能通过模块级信号 + 订阅实现。
const PAGE_KEY = "tomato-dsh.page";

let activePageId = null;
let openPanelFn = null;
const listeners = new Set();

function readStored() {
  try {
    return localStorage.getItem(PAGE_KEY);
  } catch {
    return null;
  }
}

/** 读取当前页；首次调用时从 localStorage 恢复。 */
export function getActivePageId() {
  if (activePageId === null) activePageId = readStored();
  return activePageId;
}

/** 切换页并持久化；主视图会重渲染到新页。 */
export function setActivePageId(id) {
  if (typeof id !== "string" || id === "") return;
  activePageId = id;
  try {
    localStorage.setItem(PAGE_KEY, id);
  } catch {
    /* 隐私模式：只在本次会话生效 */
  }
  for (const fn of Array.from(listeners)) {
    try {
      fn(id);
    } catch {
      /* 订阅者异常不影响其他订阅者 */
    }
  }
}

export function subscribeActivePage(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** app/main.js 在插件 apply 时把 ctx.layout.selectPanel("tomato") 绑进来。 */
export function bindPanelOpener(fn) {
  openPanelFn = typeof fn === "function" ? fn : null;
}

/** 打开番茄主视图；带 pageId 时同时切页（沉浸层「查看今天日程」用）。 */
export function openPanelAt(pageId) {
  if (pageId) setActivePageId(pageId);
  try {
    openPanelFn?.();
  } catch {
    /* DSH 版本差异时忽略 */
  }
}
