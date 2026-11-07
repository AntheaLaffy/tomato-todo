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
    open: "打开番茄 Todo 主视图",
  },
  en: {
    label: "Tomato Todo",
    pomodoro: "Today {done} / {goal} pomodoros",
    running: "Focusing {time}",
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

  return h(
    "button",
    {
      type: "button",
      onClick: () => openPanel?.(),
      title: `${title} · ${t("side.open")}`,
      "aria-label": t("side.label"),
      className: "t-root",
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 30,
        padding: wide ? "0 8px" : 0,
        width: wide ? "100%" : 30,
        justifyContent: wide ? "flex-start" : "center",
        border: "none",
        borderRadius: 9,
        background: "transparent",
        color: "var(--tomato-ink-2)",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 12.5,
        minWidth: 0,
        flex: wide ? "1 1 auto" : "none",
        textAlign: "left",
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
    h(Icon, { name: "tomato", size: 16, stroke: 1.5, style: { color: "var(--tomato-brand)", flex: "none" } }),
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
              fontWeight: 550,
            },
          },
          t("side.label"),
        )
      : null,
    h(
      "span",
      {
        className: "t-mono",
        style: {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          height: 18,
          padding: wide ? "0 6px" : 0,
          minWidth: wide ? 30 : 0,
          borderRadius: 6,
          fontSize: wide ? 10.5 : 9.5,
          fontWeight: 600,
          color: view.running ? "var(--tomato-brand-deep)" : "var(--tomato-ink-2)",
          background: view.running ? "var(--tomato-brand-soft)" : "var(--tomato-surface-2)",
          flex: "none",
        },
      },
      view.running ? fmtClock(view.remainingSecs) : `${done}/${goal}`,
    ),
  );
}
