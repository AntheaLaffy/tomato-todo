// shell.overlay 宿主：HUD、沉浸层、toast 都挂在同一帧上（order 900，位于
// DSH 自带浮层之下、普通内容之上）。overlay 层本身 click-through，各组件
// 自己开启 pointer-events。
import { h, Fragment, useEffect } from "../runtime.js";
import { useLocale } from "../shared/copy.js";
import { ToastHost } from "../shared/ui.js";
import { restore } from "./navigation.js";
import { Hud } from "./hud.js";
import { Immersive } from "./immersive.js";

// 启动导航每次页面加载只判定一次：冷启动进今日专注，刷新静默恢复上次的面板
// 与页。放在 effect 里而不是 apply 里——apply 阶段 DSH 的 layout 未必可调用，
// 且静态渲染（冒烟）不应因为启动逻辑改变输出。
let restored = false;

function useStartupNavigation() {
  useEffect(() => {
    if (restored) return;
    restored = true;
    restore();
  }, []);
}

export function AppOverlay({ openPanel }) {
  useLocale();
  useStartupNavigation();
  return h(
    Fragment,
    null,
    h(Hud, { openPanel }),
    h(Immersive, null),
    h(ToastHost, null),
  );
}
