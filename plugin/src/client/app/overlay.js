// shell.overlay 宿主：HUD、沉浸层、toast 都挂在同一帧上（order 900，位于
// DSH 自带浮层之下、普通内容之上）。overlay 层本身 click-through，各组件
// 自己开启 pointer-events。
import { h, Fragment } from "../runtime.js";
import { useLocale } from "../shared/copy.js";
import { ToastHost } from "../shared/ui.js";
import { Hud } from "./hud.js";
import { Immersive } from "./immersive.js";

export function AppOverlay({ openPanel }) {
  useLocale();
  return h(
    Fragment,
    null,
    h(Hud, { openPanel }),
    h(Immersive, null),
    h(ToastHost, null),
  );
}
