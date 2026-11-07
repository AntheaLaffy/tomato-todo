// 对话头部的番茄入口：比侧栏图标更显眼，常驻在会话标题左侧。
//
// 用户反馈「番茄 Todo 面板的进入不够显眼」——侧栏图标和 HUD 之外，这里在
// 对话头部给一枚带今日待办数与计时状态的胶囊，点一下进入番茄主视图。
import { h } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import { Icon } from "../shared/icons.js";
import { useSnapshot } from "../shared/store.js";
import { fmtClock, timerView, todayTasks, todayKey } from "../shared/derive.js";
import { ReminderStrip } from "./reminders.js";

registerCopy("header", {
  zh: { label: "番茄 Todo", today: "今日 {n}", running: "专注中", open: "进入番茄 Todo" },
  en: { label: "Tomato Todo", today: "{n} today", running: "Focusing", open: "Open Tomato Todo" },
});

/** 对话顶部左端的番茄簇：入口胶囊 +（到点时）提醒与「开始专注」。 */
export function TomatoHeaderCluster({ openPanel }) {
  return h(
    "div",
    {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        flex: "none",
        minWidth: 0,
      },
    },
    h(TomatoHeaderButton, { openPanel }),
    h(ReminderStrip, { variant: "inline" }),
  );
}

export function TomatoHeaderButton({ openPanel }) {
  const state = useSnapshot();
  const data = (state && state.data) || {};
  const today = (state && state.today) || todayKey(state && state.serverTime);
  const view = timerView(state);
  const count = todayTasks(data, today).length;

  return h(
    "button",
    {
      type: "button",
      onClick: () => openPanel?.(),
      title: t("header.open"),
      className: "t-root",
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        height: 28,
        padding: "0 10px 0 8px",
        marginRight: 6,
        borderRadius: 9,
        border: "1px solid var(--tomato-line)",
        background: "var(--tomato-brand-soft)",
        color: "var(--tomato-accent-fg)",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: "nowrap",
        flex: "none",
      },
    },
    h(Icon, { name: "tomato", size: 15, stroke: 1.6 }),
    t("header.label"),
    view.running
      ? h(
          "span",
          {
            className: "t-mono",
            style: { fontSize: 11, fontWeight: 600, padding: "1px 5px", borderRadius: 6, background: "#ffffff2e" },
          },
          fmtClock(view.remainingSecs),
        )
      : h(
          "span",
          {
            className: "t-mono",
            style: {
              fontSize: 11,
              fontWeight: 600,
              padding: "1px 5px",
              borderRadius: 6,
              background: "var(--tomato-surface)",
              color: "var(--tomato-ink-2)",
            },
          },
          count,
        ),
  );
}
