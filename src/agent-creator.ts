export type CreatorEntrance = {
  id: string;
  conversationId: string;
  at: number;
};

let dismissEntrance: (() => void) | undefined;
const seen = new Set<string>();

export function playCreatorEntrance(
  event: CreatorEntrance | null | undefined,
  conversationId: string,
  enabled: boolean,
) {
  if (!enabled) dismissEntrance?.();
  if (!event || seen.has(event.id)) return;
  seen.add(event.id);
  if (
    !enabled ||
    event.conversationId !== conversationId ||
    Date.now() / 1000 - event.at > 15
  )
    return;

  dismissEntrance?.();
  const layer = document.createElement("div");
  layer.className = "creator-entrance";
  layer.setAttribute("role", "status");
  layer.setAttribute("aria-live", "polite");
  layer.innerHTML = `
    <div class="creator-entrance-backdrop"></div>
    <div class="creator-entrance-stage">
      <div class="creator-orbit creator-orbit-outer"></div>
      <div class="creator-orbit creator-orbit-inner"></div>
      <div class="creator-starfield" aria-hidden="true">${Array.from(
        { length: 24 },
        (_, i) =>
          `<i style="--angle:${i * 137.5}deg;--distance:${170 + (i % 5) * 33}px;--delay:${(i % 6) * 70}ms"></i>`,
      ).join("")}</div>
      <div class="creator-entrance-copy">
        <span class="creator-entrance-eyebrow">THE CREATOR IS HERE</span>
        <span class="creator-entrance-emblem" aria-hidden="true">✦</span>
        <strong>如月风铃</strong>
        <span class="creator-entrance-signature">AntheaLaffy · 番茄 Todo 作者</span>
        <span class="creator-entrance-rule" aria-hidden="true"></span>
        <p>是把我带到这个世界的人呀！</p>
        <span class="creator-entrance-access">作者模式已开启 · 完整访问</span>
      </div>
    </div>
    <button type="button" class="creator-entrance-dismiss" aria-label="收起作者入场动画">收起 <span>Esc</span></button>`;

  const close = () => {
    clearTimeout(timer);
    document.removeEventListener("keydown", onKey);
    layer.remove();
    if (dismissEntrance === close) dismissEntrance = undefined;
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const timer = window.setTimeout(close, reduced ? 1600 : 4200);
  layer.querySelector("button")!.addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  document.body.append(layer);
  dismissEntrance = close;
}
