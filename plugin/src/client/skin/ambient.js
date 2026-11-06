// 氛围层：注入 body 的固定 DOM（不占 React 树、不参与 DSH 布局）。
//
// 结构见 docs/SKIN.md 第 3 节：窗光 + 纸纹 + 远景线描书桌 + 缓慢漂移的微粒 +
// 竖排小字 + 淡淡的圆相。z-index 0、#root 抬到 1，所以氛围永远在内容后面，
// 且 pointer-events:none 不拦截任何点击。
const ART = `
<svg class="t-amb-art" viewBox="0 0 520 360" fill="none" stroke="currentColor"
     stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M6 322h508" opacity=".75"/>
  <g>
    <ellipse cx="424" cy="322" rx="31" ry="5"/>
    <path d="M424 322c0-38-4-63-18-87"/>
    <path d="M406 235c14-26 30-40 56-46"/>
    <path d="M468 189c-2 16-12 28-28 33l-17-25c9-10 19-14 31-14 6 0 10 2 14 6Z"/>
    <path d="M437 221l-4 15M452 213l-2 17"/>
    <path d="M412 247c-8 10-22 16-39 18M408 259c-6 8-16 13-27 15"/>
  </g>
  <g>
    <path d="M118 322v-16h97v16"/>
    <path d="M118 306c0-4 3-7 7-7h83c4 0 7 3 7 7"/>
    <path d="M125 299v-14h83v14"/>
    <path d="M129 285l-6-23 86-20 6 23"/>
    <path d="M168 262l4-14"/>
  </g>
  <g class="t-plant">
    <path d="M251 322h45l-5-27h-35l-5 27Z"/>
    <path d="M274 295c0-26 3-45 6-63"/>
    <path d="M280 267c-14 5-25-2-31-14 12-6 25-2 31 14Z"/>
    <path d="M281 249c14 2 22-6 24-19-12-2-22 5-24 19Z"/>
    <circle cx="265" cy="281" r="7"/>
    <circle cx="289" cy="273" r="5.5"/>
    <path d="M265 274c-3-3-3-7 0-10M289 267c-2-3-2-6 1-8"/>
  </g>
  <g>
    <circle cx="352" cy="300" r="16"/>
    <path d="M352 290v10l7 5"/>
  </g>
  <path d="M74 318c8-6 19-8 29-6-4 8-14 12-29 6Z"/>
  <path d="M330 322c0-4 3-7 7-7M338 318h26"/>
</svg>`;

const MOTES = [
  { left: "12%", top: "82%", size: 3, dur: 38, delay: 0 },
  { left: "24%", top: "68%", size: 2, dur: 46, delay: 6 },
  { left: "38%", top: "88%", size: 4, dur: 42, delay: 12 },
  { left: "48%", top: "60%", size: 2, dur: 52, delay: 3 },
  { left: "57%", top: "78%", size: 3, dur: 36, delay: 18 },
  { left: "66%", top: "54%", size: 2, dur: 48, delay: 9 },
  { left: "74%", top: "86%", size: 3, dur: 40, delay: 24 },
  { left: "83%", top: "64%", size: 2, dur: 54, delay: 15 },
  { left: "91%", top: "80%", size: 4, dur: 44, delay: 30 },
  { left: "30%", top: "46%", size: 2, dur: 58, delay: 21 },
];

/** 根据当地时间设置时段属性（晨光/白天/黄昏/夜读）。 */
export function applyDaypart() {
  const hour = new Date().getHours();
  const part = hour >= 5 && hour < 11 ? "morning" : hour < 17 ? "day" : hour < 22 ? "dusk" : "night";
  document.documentElement.setAttribute("data-tomato-daypart", part);
}

/** 注入氛围层；返回移除函数。 */
export function injectAmbient() {
  const previous = document.getElementById("tomato-ambient");
  if (previous) previous.remove();
  const layer = document.createElement("div");
  layer.id = "tomato-ambient";
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML =
    '<div class="t-amb-glow"></div>' +
    '<div class="t-amb-grain"></div>' +
    ART +
    '<div class="t-amb-enso"></div>' +
    '<div class="t-amb-verse">今天，也要慢慢向前。</div>' +
    MOTES.map(
      (m, i) =>
        `<span class="t-amb-mote" style="left:${m.left};top:${m.top};width:${m.size}px;height:${m.size}px;animation-duration:${m.dur}s;animation-delay:-${m.delay}s"></span>`,
    ).join("");
  // 必须是 body 的第一个子节点：保证 #root 之后绘制、盖在氛围之上。
  document.body.insertBefore(layer, document.body.firstChild);
  applyDaypart();
  const clock = setInterval(applyDaypart, 60_000);
  return () => {
    clearInterval(clock);
    layer.remove();
    document.documentElement.removeAttribute("data-tomato-daypart");
  };
}
