// 专注 HUD：常驻在对话右上角的番茄状态胶囊（不打开面板也能感知专注）。
//
// 由 overlay 宿主渲染；点击展开迷你控制，不进入主视图也能开始/暂停一轮专注。
// 沉浸模式下自行隐藏（见 immersive.js 的 useImmersiveOpen）。
import { h, useState, useEffect } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import { Icon } from "../shared/icons.js";
import { Ring, Btn, IconBtn, notify } from "../shared/ui.js";
import { useSnapshot, tryDispatch } from "../shared/store.js";
import { timerView, fmtClock, taskById, protectionView } from "../shared/derive.js";
import { useImmersiveOpen, openImmersive } from "./immersive.js";

registerCopy("hud", {
  zh: {
    focusing: "专注中",
    paused: "已暂停",
    pomodoro: "个番茄",
    hint: "今日专注",
    openImmersive: "回到沉浸专注",
    noTask: "准备开始今天的第一轮",
    protected: "保护中",
    start: "开始专注",
    pause: "暂停",
    reset: "结束本轮",
    openApp: "打开番茄 Todo",
    notifyPaused: "已暂停，休息一下",
  },
  en: {
    focusing: "Focusing",
    paused: "Paused",
    pomodoro: "pomodoros",
    hint: "Today's focus",
    openImmersive: "Back to focus mode",
    noTask: "Ready for today's first round",
    protected: "Protected",
    start: "Start focus",
    pause: "Pause",
    reset: "End round",
    openApp: "Open Tomato Todo",
    notifyPaused: "Paused — take a breath",
  },
});

function useNow(active) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/**
 * Hud({ openPanel })
 * openPanel：切换到主视图（由 app/main.js 注入 ctx.layout.selectPanel）。
 */
export function Hud({ openPanel }) {
  const state = useSnapshot();
  const immersive = useImmersiveOpen();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const view = timerView(state);
  const data = (state && state.data) || {};
  const stats = (state && state.stats) || {};
  const settings = data.settings || {};
  const task = taskById(data, view.taskId);
  const protection = protectionView(state);
  useNow(view.running && !immersive);

  const goal = Number(settings.dailyGoal) || 8;
  const done = Number(stats.todayPomodoros) || 0;

  const act = async (action, message) => {
    setBusy(true);
    const res = await tryDispatch(action);
    setBusy(false);
    if (!res.ok) {
      notify(res.error || t("common.writeFailed"), "danger");
      return;
    }
    if (message) notify(message, "brand");
  };

  if (immersive) return null;

  const label = view.running
    ? `${t("hud.focusing")} ${fmtClock(view.remainingSecs)}`
    : view.paused
      ? t("hud.paused")
      : `${done} / ${goal} ${t("hud.pomodoro")}`;

  return h(
    "div",
    {
      className: "t-root",
      style: {
        position: "fixed",
        top: 14,
        right: 18,
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8,
      },
    },
    h(
      "div",
      {
        className: "t-card",
        style: {
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "7px 12px 7px 8px",
          borderRadius: 24,
          backdropFilter: "blur(10px)",
          background: "color-mix(in srgb, var(--tomato-surface) 88%, transparent)",
        },
      },
      h(
        "button",
        {
          type: "button",
          onClick: () => (view.running ? openImmersive() : setExpanded((v) => !v)),
          title: view.running ? t("hud.openImmersive") : t("hud.hint"),
          style: { display: "flex", alignItems: "center", gap: 9, background: "none", border: "none", cursor: "pointer", padding: 0 },
        },
        h(
          Ring,
          {
            value: goal > 0 ? Math.min(1, done / goal) : 0,
            size: 30,
            stroke: 3.5,
            color: view.running ? "var(--tomato-brand)" : "var(--tomato-leaf)",
            pulse: view.running,
          },
          h(Icon, { name: "tomato", size: 15, stroke: 1.6, style: { color: "var(--tomato-brand)" } }),
        ),
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.25 } },
          h(
            "span",
            {
              className: view.running ? "t-mono" : undefined,
              style: { fontSize: 12.5, fontWeight: 600, color: "var(--tomato-ink)" },
            },
            label,
          ),
          h(
            "span",
            {
              style: {
                fontSize: 10.5,
                color: "var(--tomato-ink-3)",
                maxWidth: 168,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              },
            },
            task ? task.title : protection.active ? t("hud.protected") : t("hud.noTask"),
          ),
        ),
      ),
      h(IconBtn, {
        name: expanded ? "chevronUp" : "chevronDown",
        size: 15,
        box: 26,
        title: expanded ? t("common.close") : t("hud.hint"),
        onClick: () => setExpanded((v) => !v),
      }),
    ),
    expanded
      ? h(
          "div",
          {
            className: "t-card",
            style: { width: 244, padding: 12, display: "flex", flexDirection: "column", gap: 10, animation: "t-pop .2s ease" },
          },
          h(
            "div",
            { style: { display: "flex", gap: 7 } },
            view.running
              ? h(Btn, {
                  size: "sm",
                  icon: "pause",
                  onClick: () => act({ type: "pauseTimer" }, t("hud.notifyPaused")),
                  disabled: busy,
                  style: { flex: 1 },
                }, t("hud.pause"))
              : h(Btn, {
                  size: "sm",
                  variant: "primary",
                  icon: "play",
                  onClick: async () => {
                    await act({ type: "startTimer" });
                    openImmersive();
                  },
                  disabled: busy,
                  style: { flex: 1 },
                }, t("hud.start")),
            h(Btn, {
              size: "sm",
              icon: "stop",
              onClick: () => act({ type: "resetTimer" }),
              disabled: busy,
              title: t("hud.reset"),
            }),
          ),
          h(
            "button",
            {
              type: "button",
              className: "t-navitem",
              onClick: () => {
                setExpanded(false);
                openPanel?.();
              },
              style: { padding: "7px 8px" },
            },
            h(Icon, { name: "focus", size: 16 }),
            t("hud.openApp"),
            h(Icon, { name: "chevronRight", size: 14, style: { marginLeft: "auto", opacity: 0.6 } }),
          ),
        )
      : null,
  );
}
