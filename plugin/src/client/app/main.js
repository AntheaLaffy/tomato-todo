// 应用装配：主视图（main panel `tomato`）、侧栏入口、焦点 HUD/沉浸层、输入框入口卡。
//
// 皮肤在 skin/main.js 里先跑；这里只保证「打开 DSH 就有番茄」：
// - 侧栏一枚番茄图标 → 主视图（九页）
// - 对话右上角常驻专注 HUD + 沉浸层
// - 输入框上方的今日入口卡
import { h } from "../runtime.js";
import { Icon } from "../shared/icons.js";
import { setLocale, t, useLocale } from "../shared/copy.js";
import {
  dispatch,
  startPolling,
  dispose as disposeStore,
} from "../shared/store.js";
import * as api from "../shared/api.js";
import { AppShell } from "./frame.js";
import { assistantPrompt } from "./assistant-prompt.js";
import {
  bindPanelOpener,
  getActivePageId,
  navigate,
  resetActivePageCache,
  setActivePageId,
  setPanelVisible,
} from "./navigation.js";
import { AppOverlay } from "./overlay.js";
import { DockCard } from "./dock.js";
import { SidebarTomatoIcon } from "./sidebar-progress.js";
import { ReminderStrip } from "./reminders.js";
import { notify } from "../shared/ui.js";
import { PersonaBackdrop } from "./persona.js";
import "./nav-copy.js";
import "../pages/index.js";

function localeId(locale) {
  try {
    const snapshot = locale && typeof locale.getLocale === "function" ? locale.getLocale() : null;
    const active = snapshot && (snapshot.active || snapshot.locale);
    return typeof active === "string" && active !== "" ? active : (typeof navigator !== "undefined" ? navigator.language : "en");
  } catch {
    return typeof navigator !== "undefined" ? navigator.language : "en";
  }
}

/**
 * 顶部居中的提醒条：去掉番茄入口胶囊后，提醒单独在顶栏正中显示；
 * 点整条进番茄面板，按钮各自执行（开始专注 / 稍后）。
 */
function TopReminder({ openPanel }) {
  useLocale();
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
  const hasJapanese = locale && typeof locale.getLocale === "function" &&
    locale.getLocale().locales?.some((item) => item.id === "ja");
  const removeJapanese = !hasJapanese && typeof locale?.addLanguage === "function"
    ? locale.addLanguage({ id: "ja", label: "日本語", fallback: "en" })
    : null;
  let removeJapaneseSettings = null;
  if (typeof locale?.register === "function") {
    try {
      removeJapaneseSettings = locale.register("settings.locale", "ja", { "language.title": "言語" });
    } catch (error) {
      // DSH 的独立日语包可能已占有该字典；重复贡献不能阻断整个插件启动。
      if (!String(error?.message || error).includes('already has locale')) throw error;
    }
  }
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
      removeJapaneseSettings?.();
      removeJapanese?.();
    } catch {
      /* already disposed */
    }
  };
  if (typeof ctx.effect === "function") ctx.effect(() => cleanup);

  const layout = ctx.get ? ctx.get("layout") : null;
  // 组件里的「打开番茄」是用户主动动作：交给 navigate 统一持久化面板状态。
  const openPanel = () => navigate({ reason: "user" });

  // navigate 需要的是裸的 selectPanel，不是会再次进入 navigate 的 openPanel。
  bindPanelOpener(
    layout && typeof layout.selectPanel === "function"
      ? (panelId) => layout.selectPanel(panelId)
      : null,
  );

  // 测试钩子：无浏览器冒烟（scripts/smoke-client.mjs）需要跨页重挂主视图；
  // 也方便在真实页面控制台里排查导航。只有测试页显式置位时才暴露。
  try {
    if (typeof window !== "undefined" && window.__TOMATO_TEST__) {
      window.__tomatoDsh = {
        setActivePageId,
        getActivePageId,
        resetActivePageCache,
        openAssistant: (...args) => openAssistant(...args),
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
    // 主动回到对话也要记住：刷新后不该再把面板打开。
    setPanelVisible(false);
  };
  const openAssistant = (kind, records) => {
    const prompt = assistantPrompt(kind, records);
    try {
      const sessions = ctx.get?.("sessions") ?? ctx.sessions;
      const conversation = ctx.get?.("conversation") ?? ctx.conversation;
      const current = Object.values(sessions?.list?.getSnapshot?.()?.byId ?? {})
        .find((row) => (row.retainedBy?.mainView ?? 0) > 0)?.id;
      const binding = current ? sessions?.binding?.(current) : null;
      if (binding && conversation?.input?.requestDraftInitialization) {
        const result = conversation.input.requestDraftInitialization(binding, {
          prompt, whenDraftExists: "append",
        });
        if (result === "blocked") throw new Error("conversation draft busy");
        leaveToConversation();
        const scope = sessions.scope?.(current);
        if (scope) conversation.input.for(scope)?.focus?.();
        return true;
      }
      const workspace = ctx.get?.("uiWorkspace") ?? ctx.uiWorkspace;
      if (typeof workspace?.startSession === "function") {
        leaveToConversation();
        workspace.startSession(undefined, { prompt, whenDraftExists: "append" });
        return true;
      }
    } catch (error) {
      console.warn("[tomato] assistant draft unavailable:", error);
    }
    notify(t("assistantPrompt.unavailable"), "danger");
    return false;
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
    onAssistant: openAssistant,
    onLanguageChange: (id) => {
      if (typeof locale?.setLocale === "function") locale.setLocale(id);
      else setLocale(id);
    },
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

  // 与主面板共用 tomato ID，侧栏负责导航和选中态。
  safeInject(
    "sidebar.panellist",
    { name: "sidebar.panellist", id: "tomato", order: 10, label: () => t("side.label") },
    SidebarTomatoIcon,
  );

  safeInject("shell.overlay", { name: "shell.overlay", id: "tomato-overlay", order: 900 }, () =>
    h(AppOverlay, { openPanel }),
  );

  safeInject(
    "conversation.composer.dock",
    { name: "conversation.composer.dock", id: "tomato-dock", order: 5 },
    () => h(DockCard, { openPanel }),
  );

  // 看板娘：DSH 的每个界面右下角都显示（沉浸层 z70 会盖住它）。
  safeInject("shell.overlay", { name: "shell.overlay", id: "tomato-persona", order: -990 }, PersonaBackdrop);

  // 顶栏正中：到点提醒（整条可点，进入番茄面板）。
  safeInject("shell.overlay", { name: "shell.overlay", id: "tomato-top-reminder", order: 850 }, () =>
    h(TopReminder, { openPanel }),
  );

}
