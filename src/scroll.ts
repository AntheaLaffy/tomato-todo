/**
 * 整体重绘 `#app` 会重建所有节点，浏览器不会保留滚动位置。给需要跨重绘存活的
 * 滚动容器标上 `data-keep-scroll="<稳定键>"`，替换前后各搬一次 scrollTop 即可。
 * 键只在同一块面板的同一份内容之间复用：导航到别的页面时找不到对应节点，位置
 * 自然丢弃，不必额外清理。
 */
export type ScrollMemory = Map<string, number>;

export function captureScroll(root: ParentNode = document): ScrollMemory {
  const memory: ScrollMemory = new Map();
  root
    .querySelectorAll<HTMLElement>("[data-keep-scroll]")
    .forEach((element) => {
      const key = element.dataset.keepScroll;
      if (key) memory.set(key, element.scrollTop);
    });
  return memory;
}

export function restoreScroll(
  memory: ScrollMemory,
  root: ParentNode = document,
): void {
  if (!memory.size) return;
  root
    .querySelectorAll<HTMLElement>("[data-keep-scroll]")
    .forEach((element) => {
      const key = element.dataset.keepScroll;
      const top = key ? memory.get(key) : undefined;
      if (top) element.scrollTop = top;
    });
}
