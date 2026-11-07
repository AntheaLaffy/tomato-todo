// 主视图框架：左导航 + 页面容器 + 底部状态（番茄应用页 = main panel `tomato`）。
//
// 框架只负责三件事：导航、当前页状态（localStorage 记住）、页头/底部的全局
// 信息。每个页面的内容、对话框、快捷键都在页面自己的模块里，框架不感知。
import { h, useState, useEffect, useRef } from "../runtime.js";
import { t, useLocale } from "../shared/copy.js";
import { Icon } from "../shared/icons.js";
import { Bar, Dot, IconBtn, Ring, ToastHost } from "../shared/ui.js";
import { useSnapshot, refresh as refreshStore } from "../shared/store.js";
import { todayKey, timerView, greeting } from "../shared/derive.js";
import { pageList } from "./registry.js";
import {
  getActivePageId,
  openTasksForProject,
  setActivePageId,
  setPanelVisible,
  subscribe,
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
        padding: compact ? "0" : "4px 8px 6px",
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
          background:
            "linear-gradient(145deg, var(--tomato-brand) 0%, var(--tomato-brand-deep) 100%)",
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
            {
              style: {
                fontSize: 14.5,
                fontWeight: 700,
                color: "var(--tomato-ink)",
                letterSpacing: ".01em",
              },
            },
            "番茄 Todo",
          ),
          h(
            "div",
            {
              style: {
                fontSize: 11,
                color: "var(--tomato-ink-3)",
                marginTop: 1,
              },
            },
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
    h(
      "span",
      {
        style: {
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
        },
      },
      t(page.titleKey),
    ),
    badge !== null && badge !== undefined && badge !== 0
      ? active
        ? // 选中项用一颗小红点（旧版样式），未选中项才显示数字。
          h("span", {
            style: {
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--tomato-brand)",
              flex: "none",
              marginRight: 2,
            },
          })
        : h(
            "span",
            {
              className: "t-mono",
              style: {
                fontSize: 11,
                color: "var(--tomato-ink-3)",
                background: "var(--tomato-surface-2)",
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

function SideCaption({ title, right, style }) {
  return h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 8,
        padding: "0 9px",
        margin: "12px 0 6px",
        ...style,
      },
    },
    h(
      "span",
      {
        style: {
          fontSize: 11,
          color: "var(--tomato-ink-3)",
          letterSpacing: ".02em",
        },
      },
      title,
    ),
    right
      ? h(
          "span",
          {
            style: {
              fontSize: 9,
              letterSpacing: ".16em",
              color: "var(--tomato-ink-3)",
              opacity: 0.75,
            },
          },
          right,
        )
      : null,
  );
}

function NavFooter({ state, compact, activeId, onSelect }) {
  if (compact) return null;
  const data = (state && state.data) || {};
  const settings = data.settings || {};
  const stats = (state && state.stats) || {};
  const goal = Math.max(1, Number(settings.dailyGoal) || 8);
  const done = Math.max(0, Number(stats.todayPomodoros) || 0);
  const completedTasks = Math.max(0, Number(stats.todayCompleted) || 0);
  const reached = done >= goal;
  const online = state !== null;
  return h(
    "div",
    {
      style: {
        marginTop: "auto",
        paddingTop: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      },
    },
    // 每日番茄目标（旧版侧栏卡片）：数值 + 细进度条 + 说明。
    h(
      "div",
      { style: { padding: "0 9px" } },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 7 } },
        h(Icon, {
          name: "leaf",
          size: 14,
          style: { color: "var(--tomato-ink-3)" },
        }),
        h(
          "span",
          {
            style: {
              flex: 1,
              minWidth: 0,
              fontSize: 12,
              fontWeight: 550,
              color: "var(--tomato-ink)",
            },
          },
          t("nav.goalTitle"),
        ),
        h(
          "span",
          {
            className: "t-mono",
            style: {
              fontSize: 12,
              fontWeight: 600,
              color: "var(--tomato-ink)",
            },
          },
          `${done} / ${goal}`,
        ),
      ),
      h(
        "div",
        { style: { marginTop: 9 } },
        h(Bar, {
          value: done,
          max: goal,
          height: 4,
          color: reached ? "var(--tomato-leaf)" : "var(--tomato-brand)",
        }),
      ),
      h(
        "div",
        {
          style: {
            marginTop: 7,
            fontSize: 10.5,
            lineHeight: 1.5,
            color: "var(--tomato-ink-3)",
          },
        },
        t("nav.goalHint", { n: completedTasks }),
      ),
    ),
    h("div", {
      style: { height: 1, background: "var(--tomato-line)", margin: "2px 9px" },
    }),
    h(
      "button",
      {
        type: "button",
        className: "t-navitem",
        "data-active": activeId === "preferences",
        onClick: () => onSelect?.("preferences"),
        style: { padding: "9px 12px" },
      },
      h(Icon, { name: "settings", size: 17 }),
      h("span", { style: { flex: 1, minWidth: 0 } }, t("nav.preferences")),
    ),
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 7,
          fontSize: 10.5,
          color: online ? "var(--tomato-ink-3)" : "#b8503f",
          padding: "0 10px",
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
      online ? t("nav.storage") : t("common.offline"),
    ),
  );
}

function ProjectList({ projects, counts }) {
  if (!projects || projects.length === 0) return null;
  return h(
    "div",
    { style: { marginTop: 18 } },
    h(SideCaption, { title: t("nav.projects") }),
    projects.map((project) =>
      h(
        "button",
        {
          key: project.id,
          type: "button",
          className: "t-navitem",
          title: project.name,
          onClick: () => openTasksForProject(project.id),
          style: { padding: "8px 12px", fontSize: 13 },
        },
        h(Dot, { color: project.color || "var(--tomato-ink-3)", size: 8 }),
        h(
          "span",
          {
            style: {
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            },
          },
          project.name,
        ),
        h(
          "span",
          {
            className: "t-mono",
            style: { fontSize: 11, color: "var(--tomato-ink-3)" },
          },
          counts.get(project.id) || 0,
        ),
      ),
    ),
  );
}

function NavColumn({
  pages,
  activeId,
  onSelect,
  state,
  compact,
  badges,
  onLeave,
}) {
  const data = (state && state.data) || {};
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  const counts = new Map();
  for (const task of tasks) {
    if (!task || task.completed || !task.projectId) continue;
    counts.set(task.projectId, (counts.get(task.projectId) || 0) + 1);
  }
  // 偏好设置从导航列表移到页脚（旧版位置）；窄屏保持扁平列表。
  const navPages = compact
    ? pages
    : pages.filter((page) => page.id !== "preferences");
  const items = [];
  for (const page of navPages) {
    items.push(
      h(NavItem, {
        key: page.id,
        page,
        active: page.id === activeId,
        onSelect,
        badge: page.badge ? page.badge(state) : null,
      }),
    );
    if (!compact && page.id === "education") {
      items.push(h(AssistantItem, { key: "assistant", compact, onLeave }));
    }
  }
  if (compact)
    items.push(h(AssistantItem, { key: "assistant", compact, onLeave }));

  return h(
    "aside",
    {
      style: {
        width: compact ? "auto" : 228,
        flex: "none",
        display: "flex",
        flexDirection: compact ? "row" : "column",
        gap: 3,
        padding: compact ? "12px 16px" : "22px 14px 18px",
        borderRight: compact ? "none" : "1px solid var(--tomato-line)",
        borderBottom: compact ? "1px solid var(--tomato-line)" : "none",
        background: compact
          ? "transparent"
          : "color-mix(in srgb, var(--tomato-surface-2) 55%, transparent)",
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
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 8,
              paddingRight: 10,
              flex: "none",
            },
          },
          h(BrandBlock, { compact: true }),
        )
      : h(BrandBlock, { compact: false }),
    compact
      ? null
      : h(SideCaption, {
          title: t("nav.space"),
          right: t("nav.personal"),
          style: { marginTop: 8 },
        }),
    items,
    compact ? null : h(ProjectList, { projects, counts }),
    h(NavFooter, { state, compact, activeId, onSelect }),
  );
}

/**
 * AppShell：main panel `tomato` 的内容。页面组件由注册表提供，
 * 每个页面拿到 { state, dispatch, refresh }，自己订阅派生数据。
 */
export function AppShell(props) {
  useLocale();
  const state = useSnapshot();

  // 标记「番茄页接管中」：顶部常驻提醒（对话用）在番茄页里隐藏，避免和页面内提醒重复。
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-tomato-takeover", "1");
    return () => root.removeAttribute("data-tomato-takeover");
  }, []);

  // 记住番茄面板是否可见：DSH 自己也能打开/关闭面板（侧栏入口、切回对话），
  // 不经过 app/main.js 的 openPanel/leaveToConversation，所以以本组件的挂载
  // 周期为准。刷新时按这个标记恢复面板，避免「在对话里刷新却被拉回番茄」。
  useEffect(() => {
    setPanelVisible(true);
    return () => setPanelVisible(false);
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
  useEffect(() => subscribe(setActiveId), []);

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
        style: {
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflowY: "auto",
          position: "relative",
          zIndex: 1,
        },
      },
      h(
        "div",
        {
          key: active ? active.id : "empty",
          className: "t-appcontent",
          // 顶部留出悬浮提醒条的位置（提醒在页面最顶端居中）。
          style: {
            maxWidth: 1270,
            margin: 0,
            padding: narrow ? "40px 18px 60px" : "44px 28px 72px",
          },
        },
        active
          ? h(active.Component, {
              state,
              dispatch: props.dispatch,
              refresh: refreshStore,
              api: props.api,
              onLeave: props.onLeave,
              onAssistant: props.onAssistant,
              onLanguageChange: props.onLanguageChange,
            })
          : null,
      ),
    ),
    h(ToastHost, null),
  );
}
