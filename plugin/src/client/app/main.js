// 应用装配：主视图（main panel `tomato`）、侧栏入口、焦点 HUD/沉浸层、输入框入口卡。
//
// 皮肤在 skin/main.js 里先跑；这里只保证「打开 DSH 就有番茄」：
// - 侧栏一枚番茄图标 → 主视图（九页）
// - 对话右上角常驻专注 HUD + 沉浸层
// - 输入框上方的今日入口卡
import { h } from "../runtime.js";
import { Icon } from "../shared/icons.js";
import { setLocale } from "../shared/copy.js";
import {
  dispatch,
  startPolling,
  dispose as disposeStore,
} from "../shared/store.js";
import * as api from "../shared/api.js";
import { AppShell } from "./frame.js";
import { bindPanelOpener } from "./navigation.js";
import { AppOverlay } from "./overlay.js";
import { DockCard } from "./dock.js";
import "./nav-copy.js";
import "../pages/index.js";

/** 侧栏面板图标：跟随选中态改成品牌色。 */
function PanelIcon({ size, active }) {
  return h(Icon, {
    name: "tomato",
    size: size || 20,
    stroke: 1.5,
    style: { color: active ? "var(--tomato-brand)" : "currentColor" },
  });
}

function localeId(locale) {
  try {
    const snapshot = locale && typeof locale.getLocale === "function" ? locale.getLocale() : null;
    const active = snapshot && (snapshot.active || snapshot.locale);
    return typeof active === "string" && active !== "" ? active : "zh";
  } catch {
    return "zh";
  }
}

export function registerApp(ctx) {
  const locale = ctx.get ? ctx.get("locale") : null;
  setLocale(localeId(locale));
  let removeLocale = null;
  if (locale && typeof locale.subscribe === "function") {
    removeLocale = locale.subscribe(() => setLocale(localeId(locale)));
  }

  const stopPolling = startPolling();
  const cleanup = () => {
    stopPolling();
    disposeStore();
    try {
      removeLocale?.();
    } catch {
      /* already disposed */
    }
  };
  if (typeof ctx.effect === "function") ctx.effect(() => cleanup);

  const layout = ctx.get ? ctx.get("layout") : null;
  const openPanel = () => {
    try {
      if (layout && typeof layout.selectPanel === "function") layout.selectPanel("tomato");
    } catch {
      /* DSH 版本差异时忽略 */
    }
  };

  bindPanelOpener(openPanel);

  const pageProps = { dispatch, api };

  ctx.slots.inject("main", () =>
    ctx.slots.register({ name: "main", key: "tomato" }, () => h(AppShell, pageProps)),
  );

  ctx.slots.inject("sidebar.panellist", () =>
    ctx.slots.register(
      {
        name: "sidebar.panellist",
        id: "tomato",
        order: 5,
        label: () => "番茄 Todo",
      },
      PanelIcon,
    ),
  );

  ctx.slots.inject("shell.overlay", () =>
    ctx.slots.register(
      { name: "shell.overlay", id: "tomato-overlay", order: 900 },
      () => h(AppOverlay, { openPanel }),
    ),
  );

  ctx.slots.inject("conversation.composer.dock", () =>
    ctx.slots.register(
      { name: "conversation.composer.dock", id: "tomato-dock", order: 5 },
      () => h(DockCard, { openPanel }),
    ),
  );
}
