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
import { SidebarTomatoProgress } from "./sidebar-progress.js";
import { ReminderStrip } from "./reminders.js";
import "./nav-copy.js";
import "../pages/index.js";

function localeId(locale) {
  try {
    const snapshot = locale && typeof locale.getLocale === "function" ? locale.getLocale() : null;
    const active = snapshot && (snapshot.active || snapshot.locale);
    return typeof active === "string" && active !== "" ? active : "zh";
  } catch {
    return "zh";
  }
}

/**
 * 顶部居中的提醒条：去掉番茄入口胶囊后，提醒单独在顶栏正中显示；
 * 点整条进番茄面板，按钮各自执行（开始专注 / 稍后）。
 */
function TopReminder({ openPanel }) {
  return h(
    "div",
    {
      id: "tomato-top-reminder",
      style: {
        position: "fixed",
        top: "calc(var(--dsh-frame-overlay-top, 48px) + 4px)",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 44,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "auto",
        maxWidth: "min(560px, calc(100vw - 40px))",
      },
    },
    h(ReminderStrip, { variant: "inline", onOpen: openPanel }),
  );
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

  // 番茄入口只保留左下角那一条（面板列表里的顶部条目按用户要求移除）。
  safeInject("shell.overlay", { name: "shell.overlay", id: "tomato-overlay", order: 900 }, () =>
    h(AppOverlay, { openPanel }),
  );

  safeInject(
    "conversation.composer.dock",
    { name: "conversation.composer.dock", id: "tomato-dock", order: 5 },
    () => h(DockCard, { openPanel }),
  );

  // 顶栏正中：到点提醒（整条可点，进入番茄面板）。
  safeInject("shell.overlay", { name: "shell.overlay", id: "tomato-top-reminder", order: 850 }, () =>
    h(TopReminder, { openPanel }),
  );

  // 左下角「栏目」：侧栏底部的番茄预计/实际进度（展开态显示 0 / 8，收起只留环）。
  safeInject(
    "sidebar.footer.action",
    { name: "sidebar.footer.action", id: "tomato-progress", order: 5 },
    (props) => h(SidebarTomatoProgress, { ...props, openPanel }),
  );
}
