// 氛围层：整个 DSH 的「纸与光」作品（窗光 / 纸纹 / 线描书桌 / 圆相 / 竖排小字 / 微尘）。
//
// 为什么是两层（不是重复渲染）：
// DSH 的 AppFrame 用不透明的 --dsw-alias-bg-base 铺满视口，注入 body 的固定层会
// 被整块盖住。所以氛围分成两处，共用同一套笔触：
// 1) #tomato-ambient：注入 body 的「地面层」，保持 docs/SKIN.md 第 3 节的结构，
//    静态、零动画——壳层透明化或换成别的宿主时氛围仍在；
// 2) #tomato-sky：注册进 shell.overlay（order -1000）的「天空层」，才是真正可见
//    的那一版：窗光洗层 + 漂移微尘 + 右下角远景插画。为了让中心栏可读，它整体
//    pointer-events:none、透明度极低、只在右下角出现并带 mask 渐隐。
// 插画与微尘只在这里定义一次，两层复用，改作品只改一个地方。
//
// 性能：装饰层全部静态 CSS/矢量；动画只有「番茄苗摇摆」与「微尘漂移」，都只动
// transform/opacity，24–54s 一轮；低性能设备在启动时打一次 data-tomato-motion=lite，
// reduced-motion 由样式表的媒体查询直接关掉。
const ART = `
<svg class="t-amb-art" viewBox="0 0 520 360" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <g class="t-desk" opacity=".75">
    <path d="M2 322h516"/>
  </g>

  <g class="t-curtain" opacity=".4">
    <path d="M435 0c8 25 8 51 2 74-3 15-8 28-15 40"/>
    <path d="M495 0c-4 28-3 56 2 82 1 10 3 19 6 28"/>
    <path d="M422 119c25-8 51-11 78-9"/>
  </g>

  <g class="t-cat" opacity=".9">
    <path d="M33 316c-1-11 8-20 22-21 10-1 18 2 24 7"/>
    <path d="M78 303c2-5 8-8 14-7 5 1 9 4 11 7 2 2 2 5 0 7-2 3-6 5-10 5-6 1-12-2-15-7Z"/>
    <path d="M82 299l1-6 6 4Z"/>
    <path d="M93 299l5-5 3 6Z"/>
    <path d="M33 314c-8 1-11 5-4 7 5 2 11 1 16-1"/>
    <path d="M41 317c7 2 15 1 22-1"/>
  </g>

  <g class="t-book" transform="rotate(-3 204 290)">
    <path d="M204 249c-27-1-57 4-85 13-3 11-5 22-8 33 32 6 64 12 93 17"/>
    <path d="M204 249c27-3 56 1 86 10 5 11 8 21 11 31-33 7-66 14-97 22"/>
    <path d="M204 249c-1 21 0 42-1 63"/>
    <path d="M110 300c32 6 64 12 94 14 33-7 66-14 98-20" opacity=".65"/>
    <path d="M132 276c13-2 26-3 39-4"/>
    <path d="M128 284c14-1 28-2 42-3"/>
    <path d="M134 292c11-1 22-1 33-2"/>
    <path d="M229 270c12 1 24 3 35 5"/>
    <path d="M232 279c11 2 21 4 31 7"/>
    <path d="M236 288c9 2 17 4 25 7"/>
  </g>

  <g class="t-pot" opacity=".9">
    <path d="M316 301h44l-7 18h-31l-6-18Z"/>
    <path d="M311 301c15 3 38 3 54 0"/>
  </g>

  <g class="t-plant">
    <path d="M340 301c2-17 5-31 11-43 3-6 5-10 8-14"/>
    <path d="M344 270c-6-5-13-7-20-6-3 0-6 2-8 5 3 4 8 6 14 6 5 0 10-2 14-5Z"/>
    <path d="M350 250c5-5 12-6 19-4 3 1 5 3 7 6-4 4-10 5-16 4-4-1-7-3-10-6Z"/>
    <path d="M344 280c-4 0-8 1-11 3"/>
    <circle cx="326" cy="286" r="6.5"/>
    <path d="M327 280c1-2 2-3 4-3"/>
    <path d="M350 270c4 1 8 3 11 6"/>
    <circle cx="363" cy="280" r="5.5"/>
    <path d="M362 275c1-2 2-3 4-3"/>
  </g>

  <g class="t-tea" opacity=".9">
    <path d="M371 316c5-4 28-4 34 0"/>
    <path d="M375 296h28"/>
    <path d="M375 296c0 10 6 17 14 17s14-7 14-17"/>
    <path d="M403 300c6-1 9 3 6 6-2 3-6 3-9 2"/>
  </g>

  <g class="t-steam" opacity=".4">
    <path d="M386 292c-4-6 3-11-1-18 2-4 1-8-1-11"/>
  </g>

  <g class="t-lamp">
    <g class="t-lamp-shade" transform="rotate(22 450 190)">
      <path d="M441 161c5-2 13-2 18 0l24 45c4 7-9 13-33 13s-37-6-33-13l24-45Z"/>
    </g>
    <path d="M470 307C469 277 472 248 481 222c7-19 8-37-2-51"/>
    <path d="M479 171l-9-5"/>
    <circle cx="472" cy="168" r="2"/>
    <path d="M437 317c4-6 18-9 33-9 16 0 29 3 33 9"/>
    <path d="M437 317h66"/>
    <path d="M448 310c-1-3 1-5 3-5h25c2 0 4 2 3 5"/>
  </g>
</svg>
`;

const VERSE = "今天，也要慢慢向前。";

import { getSkinPrefs } from "./prefs.js";

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

function motesMarkup() {
  return MOTES.map(
    (m) =>
      `<span class="t-amb-mote" style="left:${m.left};top:${m.top};width:${m.size}px;height:${m.size}px;animation-duration:${m.dur}s;animation-delay:-${m.delay}s"></span>`,
  ).join("");
}

const VERSE_MARKUP = `<div class="t-amb-verse">${VERSE}</div><div class="t-amb-seal">慢</div>`;

/** 地面层（body，#tomato-ambient）：静态结构。 */
export const GROUND_INNER =
  '<div class="t-amb-glow"></div>' +
  '<div class="t-amb-grain"></div>' +
  ART +
  '<div class="t-amb-enso"></div>' +
  VERSE_MARKUP +
  motesMarkup();

/** 天空层（shell.overlay）：真正可见的那一层，洗层 + 插画 + 微尘。 */
export const SKY_INNER =
  '<div class="t-amb-wash"></div>' +
  '<div class="t-amb-lamp"></div>' +
  ART +
  '<div class="t-amb-enso"></div>' +
  VERSE_MARKUP +
  motesMarkup();

/** 根据本地时间设置时段（晨光/白天/黄昏/夜读）；手动时段优先。 */
export function applyDaypart() {
  const manual = getSkinPrefs().daypart;
  if (manual !== "auto") {
    document.documentElement.setAttribute("data-tomato-daypart", manual);
    return manual;
  }
  const hour = new Date().getHours();
  const part =
    hour >= 6 && hour < 11
      ? "morning"
      : hour < 17
        ? "day"
        : hour < 22
          ? "dusk"
          : "night";
  document.documentElement.setAttribute("data-tomato-daypart", part);
  return part;
}

/** 低性能设备探测：只跑一次，用 CSS 属性降级（不逐帧判断）。 */
function isLowPower() {
  try {
    const nav = typeof navigator !== "undefined" ? navigator : {};
    const cores = Number(nav.hardwareConcurrency);
    const memory = Number(nav.deviceMemory);
    const slow =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(update: slow)").matches;
    return (
      slow === true ||
      (Number.isFinite(cores) && cores > 0 && cores <= 2) ||
      (Number.isFinite(memory) && memory > 0 && memory <= 2)
    );
  } catch {
    return false;
  }
}

/** 把一次性的渲染预算写进 DOM；动画能否播放由 CSS 决定。 */
export function applyMotionBudget() {
  if (isLowPower())
    document.documentElement.setAttribute("data-tomato-motion", "lite");
  else document.documentElement.removeAttribute("data-tomato-motion");
}

/** 注入地面层；返回移除函数。 */
export function injectAmbient() {
  const previous = document.getElementById("tomato-ambient");
  if (previous) previous.remove();
  const layer = document.createElement("div");
  layer.id = "tomato-ambient";
  layer.setAttribute("data-tomato-ambient", "ground");
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML = GROUND_INNER;
  // 必须是 body 的第一个子节点：保证 #root 之后绘制、盖在氛围之上。
  document.body.insertBefore(layer, document.body.firstChild);
  applyDaypart();
  applyMotionBudget();
  const clock = setInterval(applyDaypart, 60_000);
  return () => {
    clearInterval(clock);
    layer.remove();
    document.documentElement.removeAttribute("data-tomato-daypart");
    document.documentElement.removeAttribute("data-tomato-motion");
  };
}
