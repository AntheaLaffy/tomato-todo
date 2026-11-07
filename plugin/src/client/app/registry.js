// 页面注册表：页面模块自注册，框架只认注册结果。
//
// 这样做的原因：九个页面由不同工作流并行开发，框架（app/frame.js）不应在
// 每个页面落地时改动；页面自己的文件被替换/新增就等于加页面。注册顺序按
// order，导航计数用可选的 badge(state)。
const PAGES = new Map();

/**
 * registerPage({id, order, titleKey, icon, Component, badge?})
 * - titleKey：copy 键，如 "nav.focus"
 * - Component(props)：props = { state, dispatch, refresh, api }
 * - badge(state): number|null，导航右侧计数
 */
export function registerPage(page) {
  if (
    !page ||
    typeof page.id !== "string" ||
    typeof page.Component !== "function"
  ) {
    throw new Error("registerPage: 需要 {id, Component}");
  }
  PAGES.set(page.id, {
    order: 100,
    icon: "sparkle",
    titleKey: page.id,
    badge: null,
    ...page,
  });
}

export function pageList() {
  return Array.from(PAGES.values()).sort((a, b) => a.order - b.order);
}

export function pageById(id) {
  return PAGES.get(id) ?? null;
}

export function pageIds() {
  return Array.from(PAGES.keys());
}
