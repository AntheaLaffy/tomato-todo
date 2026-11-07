// 提醒条：到点时在当前页面里的一条细行（不是浮层弹窗）。
//
// 设计取舍（来自用户反馈）：
// - 浮层卡片像广告，一定被关掉；提醒只在页面内以一行细条出现，与内容同层。
// - 只提醒「当前时间段」的任务：计划块（提醒时刻 + 计划时长）还没结束才算当前；
//   超过预设结尾的是待补/逾期，属于「全部任务」的事，不再打扰。
// - 「稍后」要跨刷新持久：按 任务+日期+时刻 记到 localStorage，下次刷新不再冒出来；
//   过期条目自动清理。开始专注走 core 的 startReminder（清 pending 并直接开始）。
import { h, useState, useEffect } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import { Icon } from "../shared/icons.js";
import { Btn } from "../shared/ui.js";
import { useSnapshot, tryDispatch } from "../shared/store.js";
import { parseHHMM, todayKey, windowMinutes } from "../shared/derive.js";
import { openImmersive } from "./immersive.js";

registerCopy("reminder", {
  zh: {
    prefix: "现在",
    start: "开始专注",
    later: "稍后",
    more: "另有 {n} 条到点",
    minutes: "{n} 分钟 · 第 {round} 轮",
    title: "该做这件事了",
  },
  en: {
    prefix: "Now",
    start: "Start focus",
    later: "Later",
    more: "{n} more due",
    minutes: "{n} min · round {round}",
    title: "Time for this one",
  },
});

const DISMISS_KEY = "tomato-dsh.reminders-dismissed";
const DISMISS_TTL_MS = 48 * 3600 * 1000;

function reminderKey(task) {
  return `${task.id}|${task.dueDate}|${task.reminderTime}`;
}

function loadDismissed() {
  const now = Date.now();
  const out = {};
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return out;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return out;
    for (const [key, at] of Object.entries(parsed)) {
      if (typeof at === "number" && now - at < DISMISS_TTL_MS) out[key] = at;
    }
  } catch {
    return out;
  }
  return out;
}

function persistDismissed(map) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify(map));
  } catch {
    /* 隐私模式：本次会话内仍生效 */
  }
}

let dismissed = loadDismissed();

// 与 core reminders.reminderIdle 等价：只有真正空闲时才提醒。
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

function secondsOfNow() {
  const now = new Date();
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
}

/**
 * 当前时间段的提醒：计划块还没结束才提醒。
 * 返回 { primary, extra }；extra 为同一时段内其它到点任务数。
 */
export function currentReminders(state) {
  if (!isIdle(state)) return { primary: null, extra: 0 };
  const data = (state && state.data) || {};
  const settings = data.settings || {};
  const today = (state && state.today) || todayKey(state && state.serverTime);
  const nowSecs = secondsOfNow();
  const due = [];
  for (const task of data.tasks || []) {
    if (task.completed || !task.reminderPending || task.reminderExpired) continue;
    if (task.dueDate !== today || !task.reminderTime) continue;
    const start = parseHHMM(task.reminderTime);
    if (start === null) continue;
    const end = start + windowMinutes(task, settings) * 60;
    // 只保留「当前时间段」：计划块尚未结束；超过结尾的交给待补/逾期视图。
    if (nowSecs < start || nowSecs >= end) continue;
    if (dismissed[reminderKey(task)]) continue;
    due.push({ task, start });
  }
  due.sort((a, b) => a.start - b.start || String(a.task.id).localeCompare(String(b.task.id)));
  const primary = due.length > 0 ? due[0].task : null;
  return { primary, extra: Math.max(0, due.length - 1) };
}

/**
 * ReminderStrip({ variant })
 * variant = "page"（番茄主视图内）| "dock"（对话输入框上方）。
 * 只在有当前时段提醒时渲染，否则返回 null。
 */
export function ReminderStrip({ variant = "page", onOpen }) {
  const state = useSnapshot();
  const [, force] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // 每分钟重算：时段结束/新的到点提醒自动出现或消失。
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const { primary: task, extra } = currentReminders(state);
  if (!task) return null;

  const data = (state && state.data) || {};
  const settings = data.settings || {};
  const project = (data.projects || []).find((p) => p.id === task.projectId) || null;
  const minutes = Number(task.focusMinutes ?? settings.focusMinutes) || 0;
  const rounds = Number(task.estimate) || 1;

  const start = async (event) => {
    event?.stopPropagation?.();
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

  const later = (event) => {
    event?.stopPropagation?.();
    dismissed = { ...dismissed, [reminderKey(task)]: Date.now() };
    persistDismissed(dismissed);
    force((n) => n + 1);
  };

  const inline = variant === "inline";
  const compact = variant === "dock" || inline;

  return h(
    "div",
    {
      className: "t-root",
      onClick: onOpen
        ? (e) => {
            e.stopPropagation();
            onOpen();
          }
        : undefined,
      role: onOpen ? "button" : undefined,
      title: onOpen ? t("side.open") : undefined,
      style: inline
        ? {
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            height: 28,
            padding: "0 6px 0 9px",
            borderRadius: 9,
            border: "1px solid var(--tomato-line)",
            background: "color-mix(in srgb, var(--tomato-brand-soft) 70%, var(--tomato-surface))",
            maxWidth: 430,
            minWidth: 0,
            flex: "none",
            cursor: onOpen ? "pointer" : undefined,
          }
        : {
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: compact ? "7px 10px" : "9px 12px",
            marginBottom: compact ? 6 : 18,
            borderRadius: 12,
            border: "1px solid var(--tomato-line)",
            background: "color-mix(in srgb, var(--tomato-brand-soft) 62%, var(--tomato-surface))",
            flexWrap: "wrap",
            minWidth: 0,
          },
    },
    h(Icon, { name: "bell", size: 14, style: { color: "var(--tomato-accent-fg)" } }),
    h(
      "span",
      {
        style: {
          fontSize: 11.5,
          fontWeight: 600,
          color: "var(--tomato-accent-fg)",
          letterSpacing: ".02em",
          flex: "none",
        },
      },
      t("reminder.prefix"),
      task.reminderTime ? h("span", { className: "t-mono", style: { marginLeft: 5 } }, task.reminderTime) : null,
    ),
    project
      ? h(
          "span",
          {
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11.5,
              color: "var(--tomato-ink-3)",
              flex: "none",
            },
          },
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
    h(
      "span",
      {
        title: task.title,
        style: {
          flex: 1,
          minWidth: inline ? 40 : 120,
          maxWidth: inline ? 156 : undefined,
          fontSize: 12.5,
          fontWeight: 550,
          color: "var(--tomato-ink)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        },
      },
      task.title,
    ),
    inline
      ? extra > 0
        ? h(
            "span",
            { style: { fontSize: 11, color: "var(--tomato-ink-3)", flex: "none" } },
            t("reminder.more", { n: extra }),
          )
        : null
      : h(
          "span",
          { style: { fontSize: 11, color: "var(--tomato-ink-3)", flex: "none" } },
          t("reminder.minutes", { n: minutes, round: rounds }),
          extra > 0 ? ` · ${t("reminder.more", { n: extra })}` : "",
        ),
    error
      ? h(
          "span",
          { style: { fontSize: 11, color: "var(--dsw-alias-state-error-primary, #b8503f)", flex: "none" } },
          error,
        )
      : null,
    h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 6, flex: "none", marginLeft: "auto" } },
      h(
        Btn,
        { size: "sm", variant: "plain", disabled: busy, onClick: later, style: { height: 24, fontSize: 11.5 } },
        t("reminder.later"),
      ),
      h(
        Btn,
        {
          size: "sm",
          variant: "soft",
          icon: "play",
          disabled: busy,
          onClick: start,
          style: { height: 24, fontSize: 11.5 },
        },
        t("reminder.start"),
      ),
    ),
  );
}
