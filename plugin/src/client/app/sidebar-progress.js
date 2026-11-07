// 侧栏底部的番茄进度：左下角「栏目」里的常驻小卡（不是页面最下面那条）。
//
// 用户要求番茄预计/实际不要放右上角，也不要塞在输入框下方最底部；这里放在
// 左侧栏底部操作区（Settings 旁），展开态显示进度环 + 「0 / 8」，收起成窄条时
// 只留环。点击进入番茄主视图。
import { h } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import { Ring } from "../shared/ui.js";
import { useSnapshot } from "../shared/store.js";
import { fmtClock, timerView } from "../shared/derive.js";

registerCopy("side", {
  zh: {
    pomodoro: "今日番茄 {done} / {goal}",
    running: "专注中 {time}",
    open: "打开番茄 Todo",
  },
  en: {
    pomodoro: "Today {done} / {goal} pomodoros",
    running: "Focusing {time}",
    open: "Open Tomato Todo",
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
      className: "t-root",
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        height: 30,
        padding: wide ? "0 9px 0 7px" : 0,
        width: wide ? "auto" : 30,
        justifyContent: "center",
        border: "none",
        borderRadius: 9,
        background: "transparent",
        color: "var(--tomato-ink-2)",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 11.5,
        fontWeight: 600,
        minWidth: 0,
        flex: "none",
      },
      onMouseEnter: (e) => {
        e.currentTarget.style.background = "var(--tomato-surface-2)";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.background = "transparent";
      },
    },
    h(
      Ring,
      {
        value: goal > 0 ? Math.min(1, done / goal) : 0,
        size: 19,
        stroke: 3,
        color: view.running ? "var(--tomato-brand)" : "var(--tomato-leaf)",
      },
      h(
        "span",
        {
          className: "t-mono",
          style: { fontSize: 8.5, fontWeight: 700, color: "var(--tomato-ink-2)", lineHeight: 1 },
        },
        done,
      ),
    ),
    wide
      ? h(
          "span",
          {
            className: "t-mono",
            style: {
              fontSize: 11,
              color: "var(--tomato-ink-2)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            },
          },
          view.running ? fmtClock(view.remainingSecs) : `${done} / ${goal}`,
        )
      : null,
  );
}
