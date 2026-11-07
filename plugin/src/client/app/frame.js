// 主视图框架：左导航 + 页面容器 + 底部状态（番茄应用页 = main panel `tomato`）。
//
// 框架只负责三件事：导航、当前页状态（localStorage 记住）、页头/底部的全局
// 信息。每个页面的内容、对话框、快捷键都在页面自己的模块里，框架不感知。
import { h, useState, useEffect, useRef } from "../runtime.js";
import { t } from "../shared/copy.js";
import { Icon } from "../shared/icons.js";
import { IconBtn, Ring, ToastHost } from "../shared/ui.js";
import { useSnapshot, refresh as refreshStore } from "../shared/store.js";
import { todayKey, timerView, greeting } from "../shared/derive.js";
import { pageList } from "./registry.js";
import { PersonaBoard } from "./persona.js";
import {
  getActivePageId,
  setActivePageId,
  subscribeActivePage,
} from "./navigation.js";

function loadActivePage(pages) {
  const saved = getActivePageId();
  if (saved && pages.some((page) => page.id === saved)) return saved;
  return pages.length > 0 ? pages[0].id : null;
}

function useViewportNarrow(threshold = 980) {
  const [narrow, setNarrow] = useState(
    typeof window !== "undefined" ? window.innerWidth < threshold : false,
  );
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < threshold);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [threshold]);
  return narrow;
}

function BrandBlock({ compact }) {
  return h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: compact ? "0" : "4px 8px 18px",
        flex: "none",
      },
    },
    h(
      "div",
      {
        style: {
          width: 36,
          height: 36,
          borderRadius: 12,
          background: "linear-gradient(145deg, var(--tomato-brand) 0%, var(--tomato-brand-deep) 100%)",
          color: "var(--tomato-on-brand)",
          display: "grid",
          placeItems: "center",
          boxShadow: "0 8px 18px -10px #b9573fbb",
          flex: "none",
        },
      },
      h(Icon, { name: "tomato", size: 21, stroke: 1.5 }),
    ),
    compact
      ? null
      : h(
          "div",
          { style: { minWidth: 0 } },
          h(
            "div",
            { style: { fontSize: 14.5, fontWeight: 700, color: "var(--tomato-ink)", letterSpacing: ".01em" } },
            "番茄 Todo",
          ),
          h(
            "div",
            { style: { fontSize: 11, color: "var(--tomato-ink-3)", marginTop: 1 } },
            "慢慢来，比较快",
          ),
        ),
  );
}

function NavItem({ page, active, onSelect, badge }) {
  return h(
    "button",
    {
      type: "button",
      className: "t-navitem",
      "data-active": active,
      onClick: () => onSelect(page.id),
      title: t(page.titleKey),
    },
    h(Icon, { name: page.icon, size: 18 }),
    h("span", { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" } }, t(page.titleKey)),
    badge !== null && badge !== undefined && badge !== 0
      ? h(
          "span",
          {
            className: "t-mono",
            style: {
              fontSize: 11,
              color: active ? "var(--tomato-brand-deep)" : "var(--tomato-ink-3)",
              background: active ? "transparent" : "var(--tomato-surface-2)",
              borderRadius: 6,
              padding: "1px 5px",
              minWidth: 18,
              textAlign: "center",
            },
          },
          badge,
        )
      : null,
  );
}

function AssistantItem({ compact, onLeave }) {
  if (!onLeave) return null;
  return h(
    "button",
    {
      type: "button",
      className: "t-navitem",
      onClick: onLeave,
      title: t("nav.assistantHint"),
      style: {
        marginTop: compact ? 0 : 10,
        flex: "none",
        borderTop: compact ? "none" : "1px solid var(--tomato-line)",
        borderRadius: compact ? 11 : "0 0 11px 11px",
        paddingTop: compact ? undefined : 12,
        color: "var(--tomato-ink-2)",
      },
    },
    h(Icon, { name: "chat", size: 17 }),
    h("span", { style: { flex: 1, minWidth: 0 } }, t("nav.assistant")),
    h(Icon, { name: "arrowRight", size: 13, style: { opacity: 0.55 } }),
  );
}

function NavFooter({ state, compact }) {
  const data = (state && state.data) || {};
  const settings = data.settings || {};
  const stats = (state && state.stats) || {};
  const goal = Number(settings.dailyGoal) || 8;
  const done = Number(stats.todayPomodoros) || 0;
  const online = state !== null;
  if (compact) return null;
  return h(
    "div",
    { style: { marginTop: "auto", paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 } },
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "11px 12px",
          borderRadius: 13,
          background: "var(--tomato-surface-2)",
        },
      },
      h(
        Ring,
        { value: goal > 0 ? done / goal : 0, size: 34, stroke: 4, color: "var(--tomato-brand)" },
        h(
          "span",
          { className: "t-mono", style: { fontSize: 10.5, fontWeight: 600, color: "var(--tomato-ink-2)" } },
          `${done}`,
        ),
      ),
      h(
        "div",
        { style: { minWidth: 0 } },
        h("div", { style: { fontSize: 12, color: "var(--tomato-ink)", fontWeight: 550 } }, "今日番茄"),
        h(
          "div",
          { className: "t-mono", style: { fontSize: 11, color: "var(--tomato-ink-3)", marginTop: 1 } },
          `${done} / ${goal}`,
        ),
      ),
    ),
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 7,
          fontSize: 11,
          color: online ? "var(--tomato-ink-3)" : "#b8503f",
          padding: "0 4px",
        },
      },
      h("span", {
        style: {
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: online ? "var(--tomato-leaf)" : "#b8503f",
          flex: "none",
        },
      }),
      online ? t("common.savedLocal") : t("common.offline"),
    ),
  );
}

function NavColumn({ pages, activeId, onSelect, state, compact, badges, onLeave }) {
  return h(
    "aside",
    {
      style: {
        width: compact ? "auto" : 236,
        flex: "none",
        display: "flex",
        flexDirection: compact ? "row" : "column",
        gap: 3,
        padding: compact ? "12px 16px" : "22px 16px 18px",
        borderRight: compact ? "none" : "1px solid var(--tomato-line)",
        borderBottom: compact ? "1px solid var(--tomato-line)" : "none",
        background: compact ? "transparent" : "color-mix(in srgb, var(--tomato-surface-2) 55%, transparent)",
        overflowX: compact ? "auto" : undefined,
        overflowY: "auto",
        alignItems: compact ? "center" : "stretch",
        // 抬到看板娘之上：内容实心盖住立绘，没被盖住的部分才显示。
        position: "relative",
        zIndex: 1,
      },
      className: "t-scroll",
    },
    compact
      ? h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 8, paddingRight: 10, flex: "none" } },
          h(BrandBlock, { compact: true }),
        )
      : h(BrandBlock, { compact: false }),
    pages.map((page) =>
      h(NavItem, {
        key: page.id,
        page,
        active: page.id === activeId,
        onSelect,
        badge: page.badge ? page.badge(state) : null,
      }),
    ),
    h(AssistantItem, { compact, onLeave }),
    h(NavFooter, { state, compact }),
  );
}

/**
 * AppShell：main panel `tomato` 的内容。页面组件由注册表提供，
 * 每个页面拿到 { state, dispatch, refresh }，自己订阅派生数据。
 */
export function AppShell(props) {
  const state = useSnapshot();

  // 标记「番茄页接管中」：顶部常驻提醒（对话用）在番茄页里隐藏，避免和页面内提醒重复。
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-tomato-takeover", "1");
    return () => root.removeAttribute("data-tomato-takeover");
  }, []);

  // 兜底：即使 fixed 接管受祖先裁剪影响，也把 DSH 侧栏收起来（离开时还原）。
  useEffect(() => {
    const collapse = props.collapseSidebar;
    const restore = props.restoreSidebar;
    if (typeof collapse !== "function") return undefined;
    const collapsedByUs = collapse();
    return () => {
      if (collapsedByUs && typeof restore === "function") restore();
    };
  }, []);
  useEffect(() => {
    // apply 生命周期里也会启动轮询；这里只保证面板打开时数据是新的。
    refreshStore();
  }, []);
  const pages = pageList();
  const [activeId, setActiveId] = useState(() => loadActivePage(pages));
  const narrow = useViewportNarrow();
  const active = pages.find((page) => page.id === activeId) ?? pages[0] ?? null;

  // 跨模块导航：沉浸层等外部入口经 navigation.js 切页。
  useEffect(() => subscribeActivePage(setActiveId), []);

  useEffect(() => {
    if (active === null && pages.length > 0) setActivePageId(pages[0].id);
  }, [pages.length]);

  const badges = {};
  for (const page of pages) {
    badges[page.id] = page.badge ? page.badge(state) : null;
  }

  return h(
    "div",
    {
      className: "t-root",
      style: {
        display: "flex",
        flexDirection: narrow ? "column" : "row",
        // 全屏接管：番茄主视图固定铺满视口，盖住 DSH 的侧栏与顶部栏；
        // 点「学习助手」切回对话面板时本组件卸载，DSH 界面自然恢复。
        // 不设 z-index：保持 z-auto，让 shell.overlay（DSH 固定 z20：HUD/提醒/沉浸）
        // 与自家对话框（z60）仍在正确的层级里。
        position: "fixed",
        inset: 0,
        height: "100%",
        width: "100%",
        minHeight: 0,
        background: "var(--tomato-paper)",
        overflow: "hidden",
      },
    },
    h(PersonaBoard, null),
    h(NavColumn, {
      pages,
      activeId: active ? active.id : null,
      onSelect: setActivePageId,
      state,
      compact: narrow,
      badges,
      onLeave: props.onLeave,
    }),
    h(
      "main",
      {
        className: "t-scroll t-root t-appmain",
        style: { flex: 1, minWidth: 0, minHeight: 0, overflowY: "auto", position: "relative", zIndex: 1 },
      },
      h(
        "div",
        {
          key: active ? active.id : "empty",
          className: "t-fadein t-appcontent",
          // 顶部留出悬浮提醒条的位置（提醒在页面最顶端居中）。
          style: { maxWidth: 1180, margin: "0 auto", padding: narrow ? "40px 18px 60px" : "44px 40px 72px" },
        },
        active
          ? h(active.Component, { state, dispatch: props.dispatch, refresh: refreshStore, api: props.api })
          : null,
      ),
    ),
    h(ToastHost, null),
  );
}
