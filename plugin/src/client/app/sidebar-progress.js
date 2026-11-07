// 左侧栏底部的番茄入口 + 今日番茄预计/实际。
//
// 和番茄面板里的「学习助手」入口保持一致：同样是「图标 + 文案 + 右侧计数」的
// 条目样式（面板里是 chat 图标 + 学习助手 + →；这里是番茄图标 + 番茄 Todo + 0/8）。
// 放在侧栏底部（Settings 旁），点击进入番茄主视图；侧栏收起成窄条时只留图标。
import { h } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import { Icon } from "../shared/icons.js";
import { useSnapshot } from "../shared/store.js";
import { fmtClock, timerView } from "../shared/derive.js";

registerCopy("side", {
  zh: {
    label: "番茄 Todo",
    pomodoro: "今日番茄 {done} / {goal}",
    running: "专注中 {time}",
    sub: "今日 {done} / {goal} 颗番茄",
    subRunning: "专注中 · 第 {round} 轮",
    open: "打开番茄 Todo 主视图",
  },
  en: {
    label: "Tomato Todo",
    pomodoro: "Today {done} / {goal} pomodoros",
    running: "Focusing {time}",
    sub: "Today {done} / {goal} pomodoros",
    subRunning: "Focusing · round {round}",
    open: "Open the Tomato Todo view",
  },
});

/**
 * 侧栏底部 action。owner props: { wide }（展开/收起两态）。
 * 通过注册闭包拿到 openPanel。
 */
export function SidebarTomatoProgress({ wide = true, openPanel }) {
  const state = useSnapshot();
  const data = (state && state.data) || {};
  const settings = data.settings || {};
  const stats = (state && state.stats) || {};
  const goal = Number(settings.dailyGoal) || 8;
  const done = Number(stats.todayPomodoros) || 0;
  const view = timerView(state);

  const title = view.running
    ? t("side.running", { time: fmtClock(view.remainingSecs) })
    : t("side.pomodoro", { done, goal });

  // 降一档：不做卡片，回到「图标 + 文案 + 计数 + →」的普通行样式，
  // 和番茄面板里的「学习助手」行同一种克制程度；hover 只给浅底。
  return h(
    "button",
    {
      type: "button",
      onClick: () => openPanel?.(),
      title: `${title} · ${t("side.open")}`,
      "aria-label": t("side.label"),
      className: "t-root",
      style: wide
        ? {
            display: "flex",
            alignItems: "center",
            gap: 9,
            height: 34,
            width: "calc(100% - 12px)",
            margin: "2px 6px 4px",
            padding: "0 8px",
            border: "none",
            borderRadius: 9,
            background: "transparent",
            color: "var(--tomato-ink-2)",
            cursor: "pointer",
            fontFamily: "inherit",
            textAlign: "left",
            minWidth: 0,
            flex: "1 1 100%",
          }
        : {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            padding: 0,
            border: "none",
            borderRadius: 8,
            background: "transparent",
            color: "var(--tomato-ink-2)",
            cursor: "pointer",
            flex: "none",
          },
      onMouseEnter: (e) => {
        e.currentTarget.style.background = "var(--tomato-surface-2)";
        e.currentTarget.style.color = "var(--tomato-ink)";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--tomato-ink-2)";
      },
    },
    h(Icon, {
      name: "tomato",
      size: 17,
      stroke: 1.5,
      style: { color: "var(--tomato-brand)", flex: "none" },
    }),
    wide
      ? h(
          "span",
          {
            style: {
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: 13,
              fontWeight: 550,
              color: "var(--tomato-ink)",
            },
          },
          t("side.label"),
        )
      : null,
    wide
      ? h(
          "span",
          {
            className: "t-mono",
            style: {
              flex: "none",
              fontSize: 10.5,
              fontWeight: 600,
              color: view.running ? "var(--tomato-brand-deep)" : "var(--tomato-ink-3)",
              background: "var(--tomato-surface-2)",
              borderRadius: 6,
              padding: "1px 6px",
            },
          },
          view.running ? fmtClock(view.remainingSecs) : `${done} / ${goal}`,
        )
      : null,
    wide
      ? h(Icon, { name: "arrowRight", size: 13, style: { opacity: 0.4, flex: "none" } })
      : null,
  );
}
