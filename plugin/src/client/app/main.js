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
import {
  bindPanelOpener,
  getActivePageId,
  resetActivePageCache,
  setActivePageId,
} from "./navigation.js";
import { AppOverlay } from "./overlay.js";
import { DockCard } from "./dock.js";
import { TomatoHeaderButton } from "./header-entry.js";
import { ReminderStrip } from "./reminders.js";
import "./nav-copy.js";
import "../pages/index.js";

/** 侧栏面板图标：跟随选中态改成品牌色。 */
function PanelIcon({ size, active }) {
  return h(Icon, {
    name: "tomato",
    size: size || 20,
    stroke: active ? 1.8 : 1.5,
    style: { color: active ? "var(--tomato-brand-deep)" : "var(--tomato-brand)" },
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

  // 测试钩子：无浏览器冒烟（scripts/smoke-client.mjs）需要跨页重挂主视图；
  // 也方便在真实页面控制台里排查导航。只有测试页显式置位时才暴露。
  try {
    if (typeof window !== "undefined" && window.__TOMATO_TEST__) {
      window.__tomatoDsh = {
        setActivePageId,
        getActivePageId,
        resetActivePageCache,
      };
    }
  } catch {
    /* 非浏览器环境忽略 */
  }

  const leaveToConversation = () => {
    try {
      if (layout && typeof layout.selectPanel === "function") layout.selectPanel(null);
    } catch {
      /* DSH 版本差异时忽略 */
    }
  };

  // 进入番茄页时收起 DSH 侧栏（若本来就收起则不重复切换）；离开时还原。
  const collapseSidebar = () => {
    try {
      if (typeof document !== "undefined" && document.querySelector("[data-sidebar-collapsed]")) {
        return false;
      }
      if (layout && typeof layout.toggleSidebar === "function") {
        layout.toggleSidebar();
        return true;
      }
    } catch {
      /* DSH 版本差异时忽略 */
    }
    return false;
  };
  const restoreSidebar = () => {
    try {
      if (layout && typeof layout.toggleSidebar === "function") layout.toggleSidebar();
    } catch {
      /* ignore */
    }
  };

  const pageProps = {
    dispatch,
    api,
    onLeave: leaveToConversation,
    collapseSidebar,
    restoreSidebar,
  };

  // 逐个 slot 容错：任何一个槽位在 DSH 版本差异下不存在，都不该让整块插件挂掉
  // （皮肤与 HUD 仍是独立的可用部分）。
  const safeInject = (key, options, Component) => {
    try {
      ctx.slots.inject(key, () => ctx.slots.register(options, Component));
    } catch (e) {
      console.warn(`[tomato] slot ${key} 注册失败：`, e && e.message ? e.message : e);
    }
  };

  safeInject("main", { name: "main", key: "tomato" }, () => h(AppShell, pageProps));

  safeInject(
    "sidebar.panellist",
    { name: "sidebar.panellist", id: "tomato", order: 5, label: () => "番茄 Todo" },
    PanelIcon,
  );

  safeInject("shell.overlay", { name: "shell.overlay", id: "tomato-overlay", order: 900 }, () =>
    h(AppOverlay, { openPanel }),
  );

  safeInject(
    "conversation.composer.dock",
    { name: "conversation.composer.dock", id: "tomato-reminder", order: 4 },
    () => h(ReminderStrip, { variant: "dock" }),
  );

  safeInject(
    "conversation.composer.dock",
    { name: "conversation.composer.dock", id: "tomato-dock", order: 5 },
    () => h(DockCard, { openPanel }),
  );

  safeInject(
    "conversation.header.leading",
    { name: "conversation.header.leading" },
    () => h(TomatoHeaderButton, { openPanel }),
  );
}
