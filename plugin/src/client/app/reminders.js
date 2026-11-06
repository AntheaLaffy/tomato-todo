// 提醒横幅：定时任务到点时，在任意页面顶部出现的一张纸色便签。
//
// 语义对齐 @tomato/core 的 reminders.pendingReminder：只在计时器空闲
// （未运行、未开始、剩余满额、无锁机）时提醒；「开始专注」走 core 的
// startReminder（它会清 pending 并直接开始这一轮），「稍后再说」只在本次
// 会话里收起，不改数据（core 没有 snooze 语义，作废由重修窗口/提醒到期决定）。
import { h, useState, useEffect } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import { Icon } from "../shared/icons.js";
import { Btn, IconBtn } from "../shared/ui.js";
import { useSnapshot, tryDispatch } from "../shared/store.js";
import { fmtClock, taskById } from "../shared/derive.js";
import { openImmersive } from "./immersive.js";

registerCopy("reminder", {
  zh: {
    now: "该做这件事了",
    start: "开始专注",
    later: "稍后再说",
    more: "还有 {n} 条提醒",
    minutes: "{n} 分钟 · 第 {round} 轮",
    skipped: "已收起，提醒仍在待办里",
  },
  en: {
    now: "Time for this one",
    start: "Start focus",
    later: "Later",
    more: "{n} more reminders",
    minutes: "{n} min · round {round}",
    skipped: "Dismissed — it stays in your tasks",
  },
});

// 与 HUD 同一套顶部偏移：横幅落在 DSH 顶部栏之下，不压住窗口按钮。
const BANNER_TOP = "calc(var(--dsh-frame-overlay-top, 48px) + 8px)";

const dismissed = new Set();

function reminderKey(task) {
  return `${task.id}|${task.dueDate}|${task.reminderTime}`;
}

// 与 core reminders.reminderIdle 等价：只有真正空闲时才提醒，避免打扰正在专注的人。
function isIdle(state) {
  const data = (state && state.data) || {};
  const timer = data.timer || {};
  const lock = data.lock || {};
  return (
    !timer.running &&
    (timer.startedAt ?? null) === null &&
    Number(timer.remainingSecs) === Number(timer.durationSecs) &&
    (lock.active ?? null) === null
  );
}

/** 当前应提醒的任务（按 日期|时间|id 取最早）。 */
export function pendingReminderTask(state, ignored = dismissed) {
  if (!isIdle(state)) return null;
  const tasks = (state && state.data && state.data.tasks) || [];
  let best = null;
  for (const task of tasks) {
    if (task.completed || !task.reminderPending) continue;
    if (ignored.has(reminderKey(task))) continue;
    const key = `${task.dueDate}|${task.reminderTime}|${task.id}`;
    if (best === null || key < `${best.dueDate}|${best.reminderTime}|${best.id}`) best = task;
  }
  return best;
}

export function ReminderBanner() {
  const state = useSnapshot();
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // 计时结束/数据变化后重新评估（dismissed 是模块级集合，变更时强制刷新）。
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);
  void tick;

  const task = pendingReminderTask(state);
  if (!task) return null;
  const pendingCount = ((state && state.data && state.data.tasks) || []).filter(
    (item) => !item.completed && item.reminderPending && !dismissed.has(reminderKey(item)),
  ).length;

  const data = (state && state.data) || {};
  const settings = data.settings || {};
  const project = (data.projects || []).find((p) => p.id === task.projectId) || null;
  const minutes = Number(task.focusMinutes ?? settings.focusMinutes) || 0;
  const rounds = Number(task.estimate) || 1;

  const start = async () => {
    setBusy(true);
    setError(null);
    const res = await tryDispatch({ type: "startReminder", id: task.id });
    setBusy(false);
    if (!res.ok) {
      setError(res.error || t("common.writeFailed"));
      return;
    }
    openImmersive();
  };

  const later = () => {
    dismissed.add(reminderKey(task));
    setTick((n) => n + 1);
  };

  return h(
    "div",
    {
      className: "t-root",
      style: {
        position: "fixed",
        top: BANNER_TOP,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 45,
        width: "min(560px, calc(100vw - 32px))",
        pointerEvents: "auto",
      },
    },
    h(
      "div",
      {
        className: "t-card",
        style: {
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "9px 10px 9px 14px",
          borderRadius: 15,
          background: "color-mix(in srgb, var(--tomato-surface) 92%, transparent)",
          backdropFilter: "blur(12px)",
        },
      },
      h(
        "div",
        {
          style: {
            width: 30,
            height: 30,
            borderRadius: 10,
            background: "var(--tomato-brand-soft)",
            color: "var(--tomato-accent-fg)",
            display: "grid",
            placeItems: "center",
            flex: "none",
          },
        },
        h(Icon, { name: "bell", size: 16 }),
      ),
      h(
        "div",
        { style: { flex: 1, minWidth: 0 } },
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              fontSize: 12,
              color: "var(--tomato-ink-3)",
            },
          },
          t("reminder.now"),
          project
            ? h(
                "span",
                { style: { display: "inline-flex", alignItems: "center", gap: 4 } },
                h("span", {
                  style: {
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: project.color || "var(--tomato-ink-3)",
                    display: "inline-block",
                  },
                }),
                project.name,
              )
            : null,
          task.reminderTime ? h("span", { className: "t-mono" }, task.reminderTime) : null,
        ),
        h(
          "div",
          {
            style: {
              fontSize: 13.5,
              fontWeight: 600,
              color: "var(--tomato-ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            },
          },
          task.title,
        ),
        h(
          "div",
          { style: { fontSize: 11, color: "var(--tomato-ink-3)", marginTop: 1 } },
          t("reminder.minutes", { n: minutes, round: rounds }),
          pendingCount > 1
            ? h(
                "span",
                { style: { marginLeft: 8, color: "var(--tomato-accent-fg)" } },
                t("reminder.more", { n: pendingCount - 1 }),
              )
            : null,
        ),
        error
          ? h(
              "div",
              { style: { fontSize: 11, color: "var(--dsw-alias-state-error-primary, #b8503f)", marginTop: 2 } },
              error,
            )
          : null,
      ),
      h(
        Btn,
        { size: "sm", variant: "primary", icon: "play", disabled: busy, onClick: start },
        t("reminder.start"),
      ),
      h(
        Btn,
        { size: "sm", variant: "plain", disabled: busy, onClick: later },
        t("reminder.later"),
      ),
    ),
  );
}
