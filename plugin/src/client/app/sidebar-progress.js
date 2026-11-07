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
            gap: 10,
            width: "calc(100% - 16px)",
            margin: "6px 8px 4px",
            padding: "8px 10px",
            borderRadius: 13,
            border: "1px solid color-mix(in srgb, var(--tomato-brand) 28%, transparent)",
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--tomato-brand-soft) 82%, var(--tomato-surface)) 0%, var(--tomato-surface) 100%)",
            boxShadow: "0 10px 22px -16px color-mix(in srgb, var(--tomato-brand-deep) 65%, transparent)",
            color: "var(--tomato-ink)",
            cursor: "pointer",
            fontFamily: "inherit",
            textAlign: "left",
            minWidth: 0,
            flex: "1 1 100%",
            transition: "transform .18s ease, box-shadow .18s ease",
          }
        : {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 34,
            height: 34,
            padding: 0,
            border: "none",
            borderRadius: 10,
            background: "color-mix(in srgb, var(--tomato-brand-soft) 75%, transparent)",
            color: "var(--tomato-brand-deep)",
            cursor: "pointer",
            flex: "none",
          },
      onMouseEnter: (e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow =
          "0 14px 26px -16px color-mix(in srgb, var(--tomato-brand-deep) 75%, transparent)";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = wide
          ? "0 10px 22px -16px color-mix(in srgb, var(--tomato-brand-deep) 65%, transparent)"
          : "none";
      },
    },
    wide
      ? h(
          "span",
          {
            style: {
              width: 27,
              height: 27,
              borderRadius: 9,
              background: "var(--tomato-brand-soft)",
              display: "grid",
              placeItems: "center",
              flex: "none",
            },
          },
          h(Icon, { name: "tomato", size: 16, stroke: 1.6, style: { color: "var(--tomato-brand-deep)" } }),
        )
      : h(Icon, { name: "tomato", size: 18, stroke: 1.6 }),
    wide
      ? h(
          "span",
          { style: { display: "flex", flexDirection: "column", gap: 1, flex: 1, minWidth: 0 } },
          h(
            "span",
            {
              style: {
                fontSize: 13.5,
                fontWeight: 650,
                color: "var(--tomato-ink)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                letterSpacing: ".01em",
              },
            },
            t("side.label"),
          ),
          h(
            "span",
            {
              style: {
                fontSize: 10.5,
                color: "var(--tomato-ink-3)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              },
            },
            view.running
              ? t("side.subRunning", { round: view.cycle || 1 })
              : t("side.sub", { done, goal }),
          ),
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
          height: wide ? 21 : 0,
          minWidth: wide ? 40 : 0,
          padding: wide ? "0 7px" : 0,
          borderRadius: 7,
          fontSize: wide ? 11 : 0,
          fontWeight: 700,
          flex: "none",
          color: view.running ? "var(--tomato-brand-deep)" : "var(--tomato-on-brand)",
          background: view.running ? "var(--tomato-brand-soft)" : "var(--tomato-btn-fill)",
          border: view.running ? "1px solid color-mix(in srgb, var(--tomato-brand) 35%, transparent)" : "none",
        },
      },
      wide ? (view.running ? fmtClock(view.remainingSecs) : `${done} / ${goal}`) : null,
    ),
    wide
      ? h(Icon, {
          name: "arrowRight",
          size: 14,
          style: { color: "var(--tomato-brand-deep)", opacity: 0.6, flex: "none" },
        })
      : null,
  );
}
