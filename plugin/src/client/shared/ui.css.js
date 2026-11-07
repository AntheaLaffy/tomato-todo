// 组件系统的 CSS（lead 维护）：hover / focus / 过渡 / 动画这些 inline style
// 表达不了的状态集中在这里，类名前缀 `t-`。注入由 skin/main.js 负责。
//
// 只允许使用 --tomato-* 与 --dsw-alias-* 变量；不写死颜色（作品图形除外）。
export const UI_CSS = `
.t-root{color:var(--tomato-ink);font-variant-numeric:tabular-nums;
  -webkit-font-smoothing:antialiased}
.t-mono{font-family:'JetBrains Mono',ui-monospace,'SFMono-Regular',Menlo,monospace;font-variant-numeric:tabular-nums}

/* ---------- surfaces ---------- */
.t-card{background:var(--tomato-surface);border:1px solid var(--tomato-line);
  border-radius:16px;box-shadow:var(--tomato-shadow)}
.t-card-flat{background:var(--tomato-surface);border:1px solid var(--tomato-line);border-radius:16px}
.t-card:hover{box-shadow:0 14px 34px -16px #6b4a2f38}
body[data-ds-dark-theme] .t-card:hover{box-shadow:0 16px 38px -18px #000000a0}

/* ---------- buttons ---------- */
.t-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;
  border:1px solid transparent;border-radius:11px;cursor:pointer;user-select:none;
  font-family:inherit;font-weight:550;letter-spacing:.01em;white-space:nowrap;
  transition:background .18s ease,border-color .18s ease,color .18s ease,
    transform .18s ease,opacity .18s ease;background:transparent;color:var(--tomato-ink)}
.t-btn:disabled{opacity:.45;cursor:default;transform:none!important}
.t-btn:active:not(:disabled){transform:translateY(1px)}
.t-btn:focus-visible{outline:2px solid var(--tomato-brand);outline-offset:2px}
.t-btn-primary{background:var(--tomato-btn-fill);color:var(--tomato-on-brand);
  box-shadow:0 6px 16px -8px #b9573f73}
.t-btn-primary:hover:not(:disabled){background:var(--tomato-btn-fill-hover)}
.t-btn-soft{background:var(--tomato-brand-soft);color:var(--tomato-accent-fg)}
.t-btn-soft:hover:not(:disabled){background:var(--tomato-surface-3)}
.t-btn-ghost{background:transparent;border-color:var(--tomato-line);color:var(--tomato-ink)}
.t-btn-ghost:hover:not(:disabled){background:var(--tomato-surface-2)}
.t-btn-plain{background:transparent;color:var(--tomato-ink-2)}
.t-btn-plain:hover:not(:disabled){background:var(--tomato-surface-2);color:var(--tomato-ink)}
.t-btn-danger{background:transparent;border-color:var(--tomato-line-strong);color:#b8503f}
body[data-ds-dark-theme] .t-btn-danger{color:#e07f6a}
.t-btn-danger:hover:not(:disabled){background:#b8503f14}
.t-btn-block{width:100%}

.t-iconbtn{display:inline-flex;align-items:center;justify-content:center;border:none;
  background:transparent;color:var(--tomato-ink-2);border-radius:10px;cursor:pointer;
  transition:background .16s ease,color .16s ease;padding:0;flex:none}
.t-iconbtn:hover:not(:disabled){background:var(--tomato-surface-2);color:var(--tomato-ink)}
.t-iconbtn:focus-visible{outline:2px solid var(--tomato-brand);outline-offset:2px}
.t-iconbtn:disabled{opacity:.4;cursor:default}

/* ---------- inputs ---------- */
.t-input{font-family:inherit;color:var(--tomato-ink);background:var(--tomato-surface-2);
  border:1px solid transparent;border-radius:11px;padding:0 12px;outline:none;
  transition:border-color .16s ease,background .16s ease,box-shadow .16s ease;width:100%}
.t-input::placeholder{color:var(--tomato-ink-3)}
.t-input:hover{background:var(--tomato-surface-3)}
.t-input:focus{background:var(--tomato-surface);border-color:var(--tomato-brand);
  box-shadow:0 0 0 3px #d96d5522}
.t-textarea{font-family:inherit;color:var(--tomato-ink);background:var(--tomato-surface-2);
  border:1px solid transparent;border-radius:12px;padding:10px 12px;outline:none;
  resize:vertical;min-height:76px;line-height:1.55;width:100%;
  transition:border-color .16s ease,background .16s ease,box-shadow .16s ease}
.t-textarea:focus{background:var(--tomato-surface);border-color:var(--tomato-brand);
  box-shadow:0 0 0 3px #d96d5522}
.t-select{font-family:inherit;color:var(--tomato-ink);background:var(--tomato-surface-2);
  border:1px solid transparent;border-radius:10px;padding:0 30px 0 10px;outline:none;
  appearance:none;cursor:pointer;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%237c6c59' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M6 9.5l6 5.5 6-5.5'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 9px center}
.t-select:focus{border-color:var(--tomato-brand);box-shadow:0 0 0 3px #d96d5522}

/* ---------- rows / nav ---------- */
.t-row{transition:background .16s ease}
.t-row:hover{background:var(--tomato-surface-2)}
.t-navitem{display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:11px;
  cursor:pointer;color:var(--tomato-ink-2);position:relative;
  transition:background .18s ease,color .18s ease;border:none;background:transparent;
  font-family:inherit;font-size:13.5px;text-align:left;width:100%}
.t-navitem:hover{background:var(--tomato-surface-2);color:var(--tomato-ink)}
.t-navitem[data-active=true]{background:var(--tomato-brand-soft);color:var(--tomato-accent-fg);
  font-weight:600}
.t-navitem[data-active=true]:before{content:'';position:absolute;left:0;top:9px;bottom:9px;
  width:3px;border-radius:3px;background:var(--tomato-brand)}
.t-navitem:focus-visible{outline:2px solid var(--tomato-brand);outline-offset:2px}

.t-tab{padding:6px 13px;border-radius:9px;border:none;background:transparent;
  color:var(--tomato-ink-2);font-family:inherit;font-size:12.5px;cursor:pointer;
  transition:background .16s ease,color .16s ease;white-space:nowrap}
.t-tab:hover{background:var(--tomato-surface-2);color:var(--tomato-ink)}
.t-tab[data-active=true]{background:var(--tomato-surface);color:var(--tomato-ink);
  font-weight:600;box-shadow:0 1px 3px #00000012}
.t-seg{display:inline-flex;gap:2px;padding:3px;border-radius:11px;background:var(--tomato-surface-2)}
/* 番茄钟卡片里的模式切换：占满整行，三段等分。 */
#focus-timer .t-seg{display:flex;width:100%}
#focus-timer .t-seg .t-tab{flex:1;justify-content:center;min-width:0}

/* 下划线标签（今日待办：待完成 / 已完成），旧版样式。 */
.t-tabline-row{display:flex;gap:22px;border-bottom:1px solid var(--tomato-line);margin-top:10px}
.t-tabline{position:relative;display:inline-flex;align-items:center;gap:6px;
  padding:8px 2px 9px;border:none;background:transparent;font-family:inherit;
  font-size:12.5px;color:var(--tomato-ink-3);cursor:pointer;transition:color .16s ease}
.t-tabline:hover{color:var(--tomato-ink)}
.t-tabline[data-active=true]{color:var(--tomato-brand-deep);font-weight:600}
.t-tabline[data-active=true]:after{content:'';position:absolute;left:0;right:0;bottom:-1px;
  height:2px;border-radius:2px;background:var(--tomato-brand)}
.t-tabline:focus-visible{outline:2px solid var(--tomato-brand);outline-offset:2px}

.t-check{width:20px;height:20px;border-radius:6px;border:1.6px solid var(--tomato-line-strong);
  background:transparent;cursor:pointer;display:inline-flex;align-items:center;
  justify-content:center;flex:none;padding:0;color:transparent;
  transition:background .18s ease,border-color .18s ease,color .18s ease,transform .18s ease}
.t-check:hover{border-color:var(--tomato-brand)}
.t-check[data-checked=true]{background:var(--tomato-leaf);border-color:var(--tomato-leaf);
  color:#fff}
.t-check:focus-visible{outline:2px solid var(--tomato-brand);outline-offset:2px}

/* ---------- modal ---------- */
.t-mask{position:fixed;inset:0;background:#2b1d1240;backdrop-filter:blur(3px);
  display:flex;align-items:center;justify-content:center;padding:24px;z-index:60;
  animation:t-fade .22s ease}
body[data-ds-dark-theme] .t-mask{background:#00000073}
.t-modal{background:var(--tomato-surface);border:1px solid var(--tomato-line);
  border-radius:20px;box-shadow:0 30px 80px -30px #3a241566;max-height:86vh;
  display:flex;flex-direction:column;animation:t-pop .26s cubic-bezier(.22,.8,.3,1)}
@keyframes t-fade{from{opacity:0}to{opacity:1}}
@keyframes t-pop{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}
.t-modal-head{display:flex;align-items:flex-start;gap:12px;padding:22px 24px 0}
.t-modal-body{padding:18px 24px 22px;overflow:auto}
.t-modal-foot{display:flex;align-items:center;justify-content:flex-end;gap:10px;
  padding:14px 24px 20px;border-top:1px solid var(--tomato-line)}

/* ---------- misc ---------- */
.t-kbd{font-family:inherit;font-size:11px;padding:1px 6px;border-radius:6px;
  border:1px solid var(--tomato-line-strong);color:var(--tomato-ink-3);
  background:var(--tomato-surface-2)}
.t-scroll{overflow:auto;scrollbar-width:thin;scrollbar-color:var(--tomato-line-strong) transparent}
.t-scroll::-webkit-scrollbar{width:8px;height:8px}
.t-scroll::-webkit-scrollbar-thumb{background:var(--tomato-line-strong);border-radius:8px}
.t-scroll::-webkit-scrollbar-track{background:transparent}
.t-link{color:var(--tomato-brand-deep);cursor:pointer;background:none;border:none;
  font-family:inherit;font-size:inherit;padding:0;text-decoration:none}
.t-link:hover{text-decoration:underline}
.t-ring-progress{transition:stroke-dashoffset .9s cubic-bezier(.3,.7,.3,1)}
.t-pulse{animation:t-breathe 4.2s ease-in-out infinite}
@keyframes t-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}
@keyframes t-breathe{0%,100%{opacity:.75}50%{opacity:1}}
.t-fadein{animation:t-soft .5s ease both}
@keyframes t-soft{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

@media (prefers-reduced-motion:reduce){
  .t-btn,.t-row,.t-navitem,.t-tab,.t-check,.t-input,.t-textarea,.t-iconbtn,
  .t-ring-progress{transition:none!important}
  .t-mask,.t-modal,.t-fadein,.t-pulse,
  #tomato-persona,#tomato-persona-switch{animation:none!important}
}

/* 番茄页接管时，顶部悬浮提醒上移到页面最顶端（没有 DSH 头部了）。 */
html[data-tomato-takeover] #tomato-top-reminder{top:6px!important}

/* ---------- 看板娘 + 角色切换 ----------
   外层 #tomato-persona-wrap 负责定位（右下角、竖排：切换列在左、立绘在右），
   立绘本身 pointer-events:none，所以页面点击照常穿过；切换列单独放开点击。
   桌面靠 pointermove 命中几何区域唤出（见 app/persona.js），触摸设备没有 hover，
   这里在 hover:none 时放开立绘的 pointer-events，点一下开合。 */
#tomato-persona-wrap{
  position:fixed;
  right:max(10px, 1.6vw);
  bottom:5vh;
  display:flex;
  align-items:flex-end;
  gap:12px;
  z-index:30;
  pointer-events:none;
  font-family:inherit;
}
#tomato-persona{animation:t-persona-in .42s ease both}
@keyframes t-persona-in{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}
#tomato-persona-switch{
  pointer-events:auto;
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:7px;
  padding:9px 7px 10px;
  border-radius:20px;
  background:var(--tomato-glass, #fffdf7c7);
  border:1px solid var(--tomato-line);
  box-shadow:var(--tomato-shadow);
  backdrop-filter:blur(16px) saturate(1.08);
  -webkit-backdrop-filter:blur(16px) saturate(1.08);
  animation:t-persona-pop .2s ease both;
}
@keyframes t-persona-pop{from{opacity:0;transform:translate(6px,4px) scale(.96)}to{opacity:1;transform:none}}
#tomato-persona-switch .t-persona-cap{
  font-size:10.5px;
  line-height:1.35;
  letter-spacing:.06em;
  color:var(--tomato-ink-3);
  white-space:nowrap;
}
.t-persona-pick{
  width:42px;height:42px;padding:0;flex:none;
  border-radius:50%;border:2px solid transparent;
  background:var(--tomato-surface-2);
  overflow:hidden;cursor:pointer;
  transition:border-color .16s ease,transform .16s ease,box-shadow .16s ease;
}
.t-persona-pick img{width:100%;height:100%;object-fit:cover;object-position:50% 16%;display:block;
  transform:scale(1.04)}
.t-persona-pick:hover{border-color:var(--tomato-line-strong);transform:translateY(-1px)}
.t-persona-pick[data-active=true]{
  border-color:var(--tomato-brand);
  box-shadow:0 0 0 3px var(--tomato-brand-soft);
}
.t-persona-pick:focus-visible{outline:2px solid var(--tomato-brand);outline-offset:2px}
@media (hover:none){
  #tomato-persona{pointer-events:auto;cursor:pointer}
  #tomato-persona-wrap{gap:8px}
}

/* 竖屏/窄窗口：看板娘照样显示，只按窗口收紧尺寸并往右下角让位。 */
@media (max-width:1500px){
  #tomato-persona{height:min(36vh, 320px)!important;max-width:26vw!important}
  #tomato-persona-wrap{bottom:4vh!important}
}
@media (max-width:1100px){
  #tomato-persona{height:min(28vh, 240px)!important;max-width:32vw!important}
  #tomato-persona-wrap{right:6px!important;bottom:2vh!important}
}
@media (max-width:760px){
  #tomato-persona{height:min(21vh, 170px)!important;max-width:38vw!important}
  .t-persona-pick{width:34px;height:34px}
  #tomato-persona-switch{padding:6px 5px 7px;gap:5px;border-radius:16px}
  #tomato-persona-switch .t-persona-cap{font-size:9.5px}
}
@media (max-width:520px){
  #tomato-persona-wrap{display:none!important}
}

/* 看板娘开启时，线描书桌插画/圆相退场（两套画风不叠加）。 */
/* 内容列左对齐（旧版布局）：卡片从侧栏右侧开始，右侧空余留给看板娘。 */

html[data-tomato-persona=on] #tomato-sky .t-amb-art,
html[data-tomato-persona=on] #tomato-ambient .t-amb-art,
html[data-tomato-persona=on] #tomato-sky .t-amb-enso,
html[data-tomato-persona=on] #tomato-ambient .t-amb-enso{display:none!important}
`;
