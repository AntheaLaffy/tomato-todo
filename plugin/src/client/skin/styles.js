// 皮肤样式：番茄变量（--tomato-*）+ 氛围层 CSS + 组件系统 CSS。
//
// 选择器边界（硬约束）：只允许 html / body / #root / #tomato-* / [data-tomato-*]
// 与自带 t- 类。不碰 DSH 的 hash 类名——DSH 升级时皮肤不应随之断裂。
//
// 氛围层的两层结构与「为什么」写在 ambient.js；本文件只负责长相：
// - #tomato-ambient 是地面层（通常在 DSH 不透明底之下），静态；
// - [data-tomato-ambient=sky] 是天空层（shell.overlay，order -1000），可见，
//   所以笔触更淡、只出现在右下角并带渐隐；两层共用 .t-amb-* 的笔触参数。
import { UI_CSS } from "../shared/ui.css.js";

export const TOMATO_VARS = `
body{
  --tomato-paper:#f7f1e5;
  --tomato-surface:#fffdf7;
  --tomato-surface-2:#f1e9da;
  --tomato-surface-3:#e9dfcc;
  --tomato-ink:#3b3128;
  --tomato-ink-2:#7c6c59;
  --tomato-ink-3:#a2927d;
  --tomato-line:#00000014;
  --tomato-line-strong:#00000026;
  --tomato-brand:#d96d55;
  --tomato-brand-deep:#b9573f;
  --tomato-brand-soft:#f6e0d6;
  --tomato-on-brand:#fffaf6;
  --tomato-accent:#e9a178;
  --tomato-leaf:#7e9a6e;
  --tomato-sun:#d5a553;
  --tomato-plum:#a97c8f;
  --tomato-shadow:0 10px 30px -12px #6b4a2f2e;
  --tomato-ambient-opacity:1;
  /* 线描插画：按 SKIN.md 用 ink-3 的 30%；天空层压在内容上，单独再淡一档。 */
  --tomato-art-opacity:.30;
  --tomato-sky-art:.22;
  /* 窗光洗层整体不透明度：压在内容上，必须低到不改变中心栏文字对比。 */
  --tomato-wash:.10;
  --tomato-glass:color-mix(in srgb, #fffdf7 62%, transparent);
}
body[data-ds-dark-theme]{
  --tomato-paper:#1c1916;
  --tomato-surface:#262019;
  --tomato-surface-2:#2e2822;
  --tomato-surface-3:#3a322a;
  --tomato-ink:#f2eadf;
  --tomato-ink-2:#b3a593;
  --tomato-ink-3:#86796a;
  --tomato-line:#ffffff14;
  --tomato-line-strong:#ffffff26;
  --tomato-brand:#e8886c;
  --tomato-brand-deep:#d2705a;
  --tomato-brand-soft:#4a2f28;
  --tomato-on-brand:#241511;
  --tomato-accent:#d99a72;
  --tomato-leaf:#93ab84;
  --tomato-sun:#dcb06b;
  --tomato-plum:#b98fa2;
  --tomato-shadow:0 14px 34px -16px #00000078;
  --tomato-art-opacity:.22;
  --tomato-sky-art:.20;
  --tomato-wash:.07;
  --tomato-glass:color-mix(in srgb, #262019 62%, transparent);
}
`;

export const ATMOS_CSS = `
/* ---------- 纸底与根容器 ---------- */
html{background:var(--tomato-paper)}
body{background:transparent}
#root{position:relative;z-index:1;animation:tomato-root-in .52s ease both}
@keyframes tomato-root-in{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:none}}
::selection{background:#d96d5536;color:inherit}
body{scrollbar-color:var(--tomato-line-strong) transparent}
body ::-webkit-scrollbar{width:10px;height:10px}
body ::-webkit-scrollbar-thumb{background:var(--tomato-line-strong);border-radius:8px;
  border:2px solid transparent;background-clip:content-box}
body ::-webkit-scrollbar-track{background:transparent}

/* ---------- 两层氛围的公共骨架 ---------- */
#tomato-ambient,[data-tomato-ambient=sky]{
  position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;
  opacity:var(--tomato-ambient-opacity);transition:opacity 1.2s ease;
  contain:layout paint}
/* 地面层：纸上的窗光。天空层：真正可见的洗层，光更薄。 */
#tomato-ambient .t-amb-glow{position:absolute;inset:0;
  background:
    radial-gradient(58% 48% at 82% -6%, #fff6e4a8 0%, #fff6e400 62%),
    radial-gradient(46% 42% at 4% 8%, #f3d9c87a 0%, #f3d9c800 60%),
    radial-gradient(70% 60% at 50% 118%, #e9d8bd66 0%, #e9d8bd00 62%);
  transition:opacity 1.4s ease,filter 1.4s ease}
body[data-ds-dark-theme] #tomato-ambient .t-amb-glow{opacity:.62;
  background:
    radial-gradient(56% 46% at 80% -8%, #ffd9a71f 0%, #ffd9a700 62%),
    radial-gradient(46% 44% at 6% 10%, #8a5a3f24 0%, #8a5a3f00 60%),
    radial-gradient(72% 60% at 50% 118%, #00000066 0%, #00000000 64%)}
[data-tomato-ambient=sky] .t-amb-wash{position:absolute;inset:0;
  background:
    radial-gradient(54% 46% at 88% -10%, #fff6e4 0%, #fff6e400 62%),
    radial-gradient(42% 38% at 2% 4%, #f3d9c8 0%, #f3d9c800 60%),
    linear-gradient(190deg, #fff3dc 0%, #fff3dc00 46%, #e7b98f 100%);
  opacity:var(--tomato-wash);transition:opacity 1.6s ease,filter 1.6s ease}
body[data-ds-dark-theme] [data-tomato-ambient=sky] .t-amb-wash{
  background:
    radial-gradient(52% 44% at 86% -12%, #ffd9a7 0%, #ffd9a700 60%),
    radial-gradient(44% 40% at 4% 8%, #8a5a3f 0%, #8a5a3f00 58%),
    linear-gradient(190deg, #ffd9a7 0%, #ffd9a700 44%, #00000000 100%)}
/* 纸纹：地面层用 multiply 融进纸里；天空层不加纹理（细节压在文字上不划算）。 */
#tomato-ambient .t-amb-grain{position:absolute;inset:0;opacity:.035;mix-blend-mode:multiply;
  background-size:180px 180px;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E")}
body[data-ds-dark-theme] #tomato-ambient .t-amb-grain{opacity:.07;mix-blend-mode:screen}

/* ---------- 线描书桌：两层同一套笔触，只改锚点、尺幅与可见度 ---------- */
.t-amb-art{position:absolute;right:-24px;bottom:-16px;width:min(560px,44vw);height:auto;
  color:var(--tomato-ink-3);opacity:var(--tomato-art-opacity);
  filter:saturate(.85);transform:translateZ(0)}
#tomato-ambient .t-amb-art{right:-30px;bottom:-22px}
[data-tomato-ambient=sky] .t-amb-art{
  right:-18px;bottom:-12px;width:min(520px,38vw);opacity:var(--tomato-sky-art);
  -webkit-mask-image:radial-gradient(165% 148% at 100% 100%, #000 38%, #0000 82%);
  mask-image:radial-gradient(165% 148% at 100% 100%, #000 38%, #0000 82%)}
/* 作品里的三个小动作：番茄苗摇、茶汽浮、灯罩呼吸。都只动 transform/opacity，
   周期 13–52s，避免任何「在动」的抢眼感。 */
.t-amb-art .t-plant{transform-origin:40% 100%;animation:t-sway 13s ease-in-out infinite}
.t-amb-art .t-steam{animation:t-steam 32s ease-in-out infinite}
.t-amb-art .t-lamp-shade{animation:t-lamp 52s ease-in-out infinite}
@keyframes t-sway{0%,100%{transform:rotate(-.6deg)}50%{transform:rotate(.8deg)}}
@keyframes t-steam{0%,100%{opacity:.32;transform:translateY(1px)}50%{opacity:.5;transform:translateY(-3px)}}
@keyframes t-lamp{0%,100%{opacity:.92}50%{opacity:1}}

/* 圆相：地面层在左下（SKIN.md），天空层在右下给插画一圈极淡的墨。 */
.t-amb-enso{position:absolute;border-radius:50%;border:1.4px solid var(--tomato-ink-3);
  opacity:.12;transform:rotate(-14deg)}
#tomato-ambient .t-amb-enso{left:-90px;bottom:-120px;width:380px;height:380px}
[data-tomato-ambient=sky] .t-amb-enso{right:-96px;bottom:-150px;width:440px;height:440px;
  border-width:1.2px;opacity:.06}

/* 竖排小字与一枚「慢」印：中文作品元素，字不多但决定这层像不像插画。 */
.t-amb-verse{position:absolute;writing-mode:vertical-rl;font-family:'Noto Serif SC','Songti SC',Georgia,serif;
  letter-spacing:.34em;color:var(--tomato-ink-3);user-select:none}
#tomato-ambient .t-amb-verse{left:26px;bottom:96px;font-size:12.5px;opacity:.42}
[data-tomato-ambient=sky] .t-amb-verse{right:30px;bottom:172px;font-size:12.5px;opacity:.30}
.t-amb-seal{position:absolute;display:grid;place-items:center;writing-mode:vertical-rl;
  font-family:'Noto Serif SC','Songti SC',Georgia,serif;font-size:10.5px;line-height:1;
  color:var(--tomato-brand-deep);border:1px solid currentColor;border-radius:2px;
  width:15px;height:15px;opacity:.36;user-select:none}
[data-tomato-ambient=sky] .t-amb-seal{right:31px;bottom:126px}
#tomato-ambient .t-amb-seal{left:30px;bottom:60px}

/* 台灯暖光：黄昏与夜读时从右下角渗出来的一点光（只加亮，不压暗）。 */
.t-amb-lamp{position:absolute;right:-6%;bottom:-18%;width:42vw;height:42vw;
  max-width:560px;max-height:560px;border-radius:50%;opacity:0;
  background:radial-gradient(circle,#ffd9a8 0%,#ffd9a800 62%);
  transition:opacity 1.8s ease}
[data-tomato-ambient=sky] .t-amb-lamp{display:block}
body[data-ds-dark-theme] .t-amb-lamp{background:radial-gradient(circle,#c98a5c 0%,#c98a5c00 66%)}
html[data-tomato-daypart=dusk] .t-amb-lamp{opacity:.16}
html[data-tomato-daypart=night] .t-amb-lamp{opacity:.22}

/* ---------- 漂移微粒：8 颗，24–54s 一轮，只用 transform/opacity ---------- */
.t-amb-mote{position:absolute;border-radius:50%;background:#fff3dc;
  box-shadow:0 0 8px 2px #ffe9c44d;opacity:.35;animation:t-mote linear infinite;
  will-change:transform,opacity}
body[data-ds-dark-theme] .t-amb-mote{background:#ffd9a8;box-shadow:0 0 9px 2px #ffb97733;opacity:.22}
/* 地面层通常被 DSH 不透明底盖住：微尘保持静态，不为看不见的动画付合成开销。 */
#tomato-ambient .t-amb-mote{animation:none;opacity:.2}
@keyframes t-mote{
  0%{transform:translate3d(0,3vh,0) scale(.6);opacity:0}
  10%{opacity:.45}
  46%{transform:translate3d(12px,-32vh,0) scale(.95);opacity:.4}
  74%{transform:translate3d(-6px,-54vh,0) scale(.85);opacity:.28}
  100%{transform:translate3d(4px,-76vh,0) scale(.7);opacity:0}
}

/* ---------- 时段：晨光 / 白天 / 黄昏 / 夜读（html[data-tomato-daypart]） ---------- */
html[data-tomato-daypart=morning] #tomato-ambient .t-amb-glow{filter:saturate(1.04)}
html[data-tomato-daypart=day] #tomato-ambient .t-amb-glow{opacity:.9;filter:saturate(.92)}
html[data-tomato-daypart=day] [data-tomato-ambient=sky] .t-amb-wash{filter:saturate(.9)}
html[data-tomato-daypart=dusk] #tomato-ambient .t-amb-glow{filter:hue-rotate(-8deg) saturate(1.15);
  opacity:.95}
html[data-tomato-daypart=dusk] [data-tomato-ambient=sky] .t-amb-wash{filter:hue-rotate(-7deg) saturate(1.12)}
html[data-tomato-daypart=dusk] [data-tomato-ambient=sky] .t-amb-art{filter:saturate(.9) sepia(.08)}
html[data-tomato-daypart=night] #tomato-ambient .t-amb-glow{filter:hue-rotate(-16deg) saturate(.8);
  opacity:.42}
html[data-tomato-daypart=night] [data-tomato-ambient=sky] .t-amb-wash{filter:hue-rotate(-12deg) saturate(.9)}
html[data-tomato-daypart=night] .t-amb-mote{opacity:.16}
html[data-tomato-daypart=night] .t-amb-verse{opacity:.24}
html[data-tomato-daypart=night] #tomato-ambient .t-amb-enso{opacity:.07}
html[data-tomato-daypart=night] [data-tomato-ambient=sky] .t-amb-enso{opacity:.04}
html[data-tomato-daypart=night] [data-tomato-ambient=sky] .t-amb-art{opacity:calc(var(--tomato-sky-art) * .9)}

/* ---------- 窄屏 / 矮屏：阅读优先，插画退场 ---------- */
@media (max-width:1280px){
  [data-tomato-ambient=sky] .t-amb-verse,
  [data-tomato-ambient=sky] .t-amb-seal{display:none}
}
@media (max-width:1100px){
  #tomato-ambient .t-amb-art{width:min(440px,52vw)}
  [data-tomato-ambient=sky] .t-amb-art{width:min(400px,48vw);opacity:calc(var(--tomato-sky-art) * .8)}
}
@media (max-width:960px){
  #tomato-ambient .t-amb-art{width:340px;right:-40px;bottom:-30px;opacity:.2}
  #tomato-ambient .t-amb-verse{display:none}
  [data-tomato-ambient=sky] .t-amb-art,
  [data-tomato-ambient=sky] .t-amb-enso,
  [data-tomato-ambient=sky] .t-amb-lamp{display:none}
}
@media (max-height:680px){
  .t-amb-verse,.t-amb-seal,#tomato-ambient .t-amb-enso{display:none}
}

/* ---------- reduced motion：停漂移与摇摆，保留 0–120ms 的必要过渡 ---------- */
@media (prefers-reduced-motion:reduce){
  #root{animation:none}
  .t-amb-mote{animation:none!important;opacity:.14}
  .t-amb-art .t-plant,.t-amb-art .t-steam,.t-amb-art .t-lamp-shade{animation:none!important}
  .t-amb-lamp,.t-amb-wash,.t-amb-glow,
  #tomato-ambient,[data-tomato-ambient=sky]{transition:none}
}

/* ---------- 系统高对比模式：装饰层整体退场 ---------- */
@media (forced-colors:active){
  #tomato-ambient,[data-tomato-ambient=sky]{display:none}
}

/* ---------- 低性能设备：JS 在启动时打一次 data-tomato-motion=lite ---------- */
[data-tomato-motion=lite] .t-amb-mote{animation:none;opacity:.12}
[data-tomato-motion=lite] .t-amb-art .t-plant,
[data-tomato-motion=lite] .t-amb-art .t-steam,
[data-tomato-motion=lite] .t-amb-art .t-lamp-shade{animation:none}
[data-tomato-motion=lite] .t-amb-lamp,
[data-tomato-motion=lite] .t-amb-wash,
[data-tomato-motion=lite] .t-amb-glow,[data-tomato-motion=lite] .t-amb-enso{transition:none}
`;

/** 注入（或替换）皮肤样式表；返回移除函数。 */
export function injectStyles() {
  const existing = document.getElementById("tomato-skin-style");
  if (existing) existing.remove();
  const style = document.createElement("style");
  style.id = "tomato-skin-style";
  style.textContent = TOMATO_VARS + UI_CSS + ATMOS_CSS;
  document.head.appendChild(style);
  return () => style.remove();
}
