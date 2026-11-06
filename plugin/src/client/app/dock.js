// 输入框上方的常驻入口卡：一句话状态 + 两个动作（开始专注 / 打开应用）。
//
// 保留它是因为「打开 DSH 就在场」的入口不能只有悬浮 HUD：对话是学习助手
// 的主场，入口卡是对话与专注之间的桥。
import { h, useState } from "../runtime.js";
import { t } from "../shared/copy.js";
import { Icon } from "../shared/icons.js";
import { Chip, notify } from "../shared/ui.js";
import { registerCopy } from "../shared/copy.js";
import { useSnapshot, tryDispatch } from "../shared/store.js";
import { timerView, fmtClock, dueTasks, todayKey } from "../shared/derive.js";
import { openImmersive } from "./immersive.js";

registerCopy("dock", {
  zh: {
    due: "今日待办 {n} 件",
    minutes: "已专注 {n} 分钟",
    start: "现在专注",
    view: "查看今天",
    running: "专注中 {time}",
    idle: "准备好就开始吧",
  },
  en: {
    due: "{n} due today",
    minutes: "{n} min focused",
    start: "Focus now",
    view: "Open today",
    running: "Focusing {time}",
    idle: "Ready when you are",
  },
});

export function DockCard({ openPanel }) {
  const state = useSnapshot();
  const [busy, setBusy] = useState(false);
  const data = (state && state.data) || {};
  const stats = (state && state.stats) || {};
  const today = todayKey(state && state.serverTime);
  const view = timerView(state);
  const due = dueTasks(data, today).length;
  const focusMinutes = Math.round((Number(stats.todaySeconds) || 0) / 60);

  const start = async () => {
    setBusy(true);
    const res = await tryDispatch({ type: view.running ? "pauseTimer" : "startTimer" });
    setBusy(false);
    if (!res.ok) {
      notify(res.error || t("common.writeFailed"), "danger");
      return;
    }
    if (!view.running) openImmersive();
  };

  return h(
    "div",
    {
      className: "t-root",
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 10px 7px 12px",
        marginBottom: 6,
        borderRadius: 14,
        border: "1px solid var(--tomato-line)",
        background: "color-mix(in srgb, var(--tomato-surface) 72%, transparent)",
        backdropFilter: "blur(8px)",
        fontSize: 12.5,
        color: "var(--tomato-ink-2)",
        flexWrap: "wrap",
      },
    },
    h(Icon, { name: "tomato", size: 16, style: { color: "var(--tomato-brand)" } }),
    h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, flexWrap: "wrap" } },
      h(
        "span",
        { style: { color: "var(--tomato-ink)", fontWeight: 550 } },
        view.running ? t("dock.running", { time: fmtClock(view.remainingSecs) }) : t("dock.idle"),
      ),
      h(Chip, { icon: "tasks" }, t("dock.due", { n: due })),
      h(Chip, { icon: "clock", tone: "brand" }, t("dock.minutes", { n: focusMinutes })),
    ),
    h(
      "button",
      {
        type: "button",
        className: "t-btn t-btn-soft",
        disabled: busy,
        onClick: start,
        style: {
          height: 27,
          padding: "0 11px",
          borderRadius: 9,
          fontFamily: "inherit",
          fontSize: 12,
          fontWeight: 600,
        },
      },
      h(Icon, { name: view.running ? "pause" : "play", size: 13 }),
      view.running ? t("hud.pause") : t("dock.start"),
    ),
    h(
      "button",
      {
        type: "button",
        className: "t-btn t-btn-plain",
        onClick: () => openPanel?.(),
        style: { height: 27, padding: "0 10px", borderRadius: 9, fontFamily: "inherit", fontSize: 12 },
      },
      t("dock.view"),
      h(Icon, { name: "chevronRight", size: 13 }),
    ),
  );
}
