// 皮肤样式：番茄变量（--tomato-*）+ 氛围层 CSS + 组件系统 CSS。
//
// 选择器边界（硬约束）：只允许 html / body / #root / #tomato-* / [data-tomato-*]
// 与自带 t- 类。不碰 DSH 的 hash 类名——DSH 升级时皮肤不应随之断裂。
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
  --tomato-art-opacity:.30;
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
  --tomato-glass:color-mix(in srgb, #262019 62%, transparent);
}
`;

export const ATMOS_CSS = `
html{background:var(--tomato-paper)}
body{background:transparent}
#root{position:relative;z-index:1;animation:tomato-root-in .6s ease both}
@keyframes tomato-root-in{from{opacity:0}to{opacity:1}}
::selection{background:#d96d5536;color:inherit}
body{scrollbar-color:var(--tomato-line-strong) transparent}
body ::-webkit-scrollbar-thumb{background:var(--tomato-line-strong);border-radius:8px}

#tomato-ambient{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;
  opacity:var(--tomato-ambient-opacity);transition:opacity 1.2s ease}
#tomato-ambient .t-amb-glow{position:absolute;inset:0;
  background:
    radial-gradient(58% 48% at 82% -6%, #fff6e4a8 0%, #fff6e400 62%),
    radial-gradient(46% 42% at 4% 8%, #f3d9c87a 0%, #f3d9c800 60%),
    radial-gradient(70% 60% at 50% 118%, #e9d8bd66 0%, #e9d8bd00 62%);
  transition:opacity 1.4s ease}
body[data-ds-dark-theme] #tomato-ambient .t-amb-glow{opacity:.62;
  background:
    radial-gradient(56% 46% at 80% -8%, #ffd9a71f 0%, #ffd9a700 62%),
    radial-gradient(46% 44% at 6% 10%, #8a5a3f24 0%, #8a5a3f00 60%),
    radial-gradient(72% 60% at 50% 118%, #00000066 0%, #00000000 64%)}
#tomato-ambient .t-amb-grain{position:absolute;inset:0;opacity:.05;mix-blend-mode:multiply;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E")}
body[data-ds-dark-theme] #tomato-ambient .t-amb-grain{opacity:.09;mix-blend-mode:screen}
#tomato-ambient .t-amb-art{position:absolute;right:-30px;bottom:-22px;width:min(560px,46vw);
  height:auto;color:var(--tomato-ink-3);opacity:var(--tomato-art-opacity);filter:saturate(.8)}
#tomato-ambient .t-amb-enso{position:absolute;left:-90px;bottom:-120px;width:380px;height:380px;
  border-radius:50%;border:1.4px solid var(--tomato-ink-3);opacity:.12;transform:rotate(-14deg)}
#tomato-ambient .t-amb-verse{position:absolute;left:26px;bottom:96px;writing-mode:vertical-rl;
  font-family:'Noto Serif SC','Songti SC',Georgia,serif;font-size:12.5px;letter-spacing:.34em;
  color:var(--tomato-ink-3);opacity:.42;user-select:none}
#tomato-ambient .t-amb-mote{position:absolute;border-radius:50%;
  background:#fff3dc;box-shadow:0 0 8px 2px #ffe9c44d;opacity:.35;
  animation:t-mote linear infinite}
body[data-ds-dark-theme] #tomato-ambient .t-amb-mote{background:#ffd9a8;box-shadow:0 0 9px 2px #ffb97733;opacity:.22}
@keyframes t-mote{
  0%{transform:translate3d(0,0,0) scale(.7);opacity:0}
  12%{opacity:.5}
  50%{transform:translate3d(14px,-38vh,0) scale(1)}
  88%{opacity:.35}
  100%{transform:translate3d(-8px,-78vh,0) scale(.8);opacity:0}
}
@keyframes t-sway{0%,100%{transform:rotate(-.5deg)}50%{transform:rotate(.7deg)}}
#tomato-ambient .t-amb-art .t-plant{transform-origin:60% 100%;animation:t-sway 11s ease-in-out infinite}

/* 时段：晨光 / 白天 / 黄昏 / 夜读 */
html[data-tomato-daypart=dusk] #tomato-ambient .t-amb-glow{filter:hue-rotate(-8deg) saturate(1.15);
  opacity:.95}
html[data-tomato-daypart=dusk] #tomato-ambient .t-amb-art{opacity:calc(var(--tomato-art-opacity) * .9)}
html[data-tomato-daypart=night] #tomato-ambient .t-amb-glow{filter:hue-rotate(-16deg) saturate(.8);
  opacity:.42}
html[data-tomato-daypart=night] #tomato-ambient .t-amb-mote{opacity:.16}
html[data-tomato-daypart=night] #tomato-ambient .t-amb-verse{opacity:.26}

@media (max-width:900px){
  #tomato-ambient .t-amb-art{width:340px;right:-40px;bottom:-30px;opacity:.2}
  #tomato-ambient .t-amb-verse{display:none}
}
@media (prefers-reduced-motion:reduce){
  #root{animation:none}
  #tomato-ambient .t-amb-mote{animation:none;opacity:.18}
  #tomato-ambient .t-amb-art .t-plant{animation:none}
}
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
