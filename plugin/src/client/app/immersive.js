// 沉浸式专注：开始专注后的全屏界面（Legacy 2a/2b）。
//
// 打开/关闭是模块级信号（同一时刻只可能有一个沉浸层），组件订阅它；
// overlay 宿主只负责渲染 <Immersive/>。视觉按 SKIN.md 4.4 节：巨型等宽计时、
// 当前任务、白名单状态、提前结束与结束确认。
import { h, useState, useEffect } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import { Icon } from "../shared/icons.js";
import { Ring, Btn, IconBtn, notify } from "../shared/ui.js";
import { useSnapshot, tryDispatch } from "../shared/store.js";
import { timerView, fmtClock, taskById, protectionView } from "../shared/derive.js";

registerCopy("imm", {
  zh: {
    title: "要结束这一轮专注吗？",
    detail:
      "本轮已做完，就提前完成这颗番茄并进入休息，专注时长按实际用时记录；任务仍需手动勾选完成。临时中断请选择「结束并解锁」，本轮不计为完整番茄。",
    typeHint: "输入「结束专注」确认中断",
    confirmPhrase: "结束专注",
    back: "再坚持一下",
    earlyComplete: "提前完成",
    interrupt: "结束并解锁",
    locked: "界面锁定中",
    lockBadge: "界面锁定中",
    freeBadge: "自由专注",
    whitelistBadge: "应用白名单保护中",
    onlyThis: "此刻，只做这一件事。",
    allowHint: "允许使用 {n} 个应用，其他应用会被切回",
    schedule: "查看今天日程",
    sound: "选择背景音",
    endEarly: "有急事，提前结束",
    exit: "退出沉浸模式",
    scheduleHint: "今天的日程在「本周日程」与「今日专注」里",
    soundHint: "背景音选择将在偏好设置中提供",
    notifyCompleted: "这一颗番茄完成了，去休息一下",
    notifyInterrupted: "本轮已中断，时长按实际记录",
  },
  en: {
    title: "End this focus round?",
    detail:
      "If the round is done, complete the pomodoro early and take the break; focus time is recorded as actually spent. The task still needs a manual check. For a temporary interruption choose “End and unlock” — the round won't count as a full pomodoro.",
    typeHint: "Type “结束专注” to confirm the interruption",
    confirmPhrase: "结束专注",
    back: "Keep going",
    earlyComplete: "Complete early",
    interrupt: "End and unlock",
    locked: "Screen locked",
    lockBadge: "Screen locked",
    freeBadge: "Free focus",
    whitelistBadge: "App whitelist active",
    onlyThis: "Just this one thing, right now.",
    allowHint: "{n} apps allowed; others are switched away",
    schedule: "Today's schedule",
    sound: "Ambient sound",
    endEarly: "Something urgent — end early",
    exit: "Leave focus mode",
    scheduleHint: "Today's plan lives in This week and Today",
    soundHint: "Ambient sound choices arrive with Preferences",
    notifyCompleted: "Pomodoro complete — take a breather",
    notifyInterrupted: "Round interrupted; actual time recorded",
  },
});

let openState = false;
const listeners = new Set();

function emit() {
  for (const fn of Array.from(listeners)) fn(openState);
}

export function openImmersive() {
  openState = true;
  emit();
}

export function closeImmersive() {
  openState = false;
  emit();
}

export function useImmersiveOpen() {
  const [open, setOpen] = useState(openState);
  useEffect(() => {
    const fn = (next) => setOpen(next);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return open;
}

/** 确认结束对话框（Legacy 2b）：输入「结束专注」才允许中断。 */
function EndDialog({ onCancel, onEarlyComplete, onInterrupt, busy, copy }) {
  const [phrase, setPhrase] = useState("");
  const [inputRef, setInputRef] = useState(null);
  useEffect(() => {
    if (inputRef) inputRef.focus();
  }, [inputRef]);
  const confirmed = phrase.trim() === copy.confirmPhrase;
  return h(
    "div",
    {
      className: "t-mask t-root",
      style: { background: "#100b0880", zIndex: 80 },
      onMouseDown: (e) => {
        if (e.target === e.currentTarget) onCancel();
      },
    },
    h(
      "div",
      { className: "t-modal", style: { width: "min(460px, 100%)", padding: "26px 26px 22px" } },
      h("div", { style: { fontSize: 18, fontWeight: 650, color: "var(--tomato-ink)" } }, copy.title),
      h(
        "div",
        { style: { fontSize: 12.5, lineHeight: 1.75, color: "var(--tomato-ink-2)", marginTop: 10 } },
        copy.detail,
      ),
      h(
        "div",
        { style: { marginTop: 16 } },
        h("div", { style: { fontSize: 11.5, color: "var(--tomato-ink-3)", marginBottom: 6 } }, copy.typeHint),
        h("input", {
          ref: setInputRef,
          value: phrase,
          onChange: (e) => setPhrase(e.target.value),
          placeholder: copy.confirmPhrase,
          className: "t-root t-input",
          style: { height: 36, fontSize: 13 },
        }),
      ),
      h(
        "div",
        { style: { display: "flex", gap: 9, marginTop: 20, justifyContent: "flex-end" } },
        h(Btn, { size: "md", onClick: onCancel }, copy.back),
        h(
          Btn,
          {
            size: "md",
            variant: "soft",
            icon: "check",
            disabled: busy,
            onClick: onEarlyComplete,
          },
          copy.earlyComplete,
        ),
        h(
          Btn,
          {
            size: "md",
            variant: "danger",
            icon: "unlock",
            disabled: busy || !confirmed,
            onClick: onInterrupt,
          },
          copy.interrupt,
        ),
      ),
    ),
  );
}

export function Immersive() {
  const open = useImmersiveOpen();
  const state = useSnapshot();
  const [ending, setEnding] = useState(false);
  const [busy, setBusy] = useState(false);
  const view = timerView(state);
  const data = (state && state.data) || {};
  const task = taskById(data, view.taskId);
  const protection = protectionView(state);

  // 计时结束/被外部停止时自动退出沉浸层
  useEffect(() => {
    if (open && !view.running && view.mode !== "shortBreak" && view.mode !== "longBreak") {
      const remaining = Number(view.timer.remainingSecs) || 0;
      const total = Number(view.timer.durationSecs) || 0;
      if (remaining <= 0 || total === 0) closeImmersive();
    }
  }, [open, view.running, view.mode, view.timer.remainingSecs]);

  if (!open) return null;

  const copy = {
    title: t("imm.title"),
    detail: t("imm.detail"),
    typeHint: t("imm.typeHint"),
    confirmPhrase: t("imm.confirmPhrase"),
    back: t("imm.back"),
    earlyComplete: t("imm.earlyComplete"),
    interrupt: t("imm.interrupt"),
  };

  const act = async (action, then) => {
    setBusy(true);
    const res = await tryDispatch(action);
    setBusy(false);
    if (!res.ok) {
      notify(res.error || t("common.writeFailed"), "danger");
      return;
    }
    then?.();
  };

  const badge = protection.locked
    ? t("imm.locked")
    : protection.active && protection.mode === "whitelist"
      ? t("imm.whitelistBadge", { n: protection.effectiveWhitelist.length })
      : protection.active
        ? t("imm.lockBadge")
        : t("imm.freeBadge");

  return h(
    "div",
    {
      className: "t-root t-fadein",
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(120% 100% at 50% -10%, #3a2a20 0%, #241a14 46%, #16100d 100%)",
        color: "#f4ead9",
        padding: "28px 24px",
      },
    },
    h(
      "div",
      {
        style: {
          position: "absolute",
          top: 26,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 15px",
          borderRadius: 22,
          border: "1px solid #ffffff1f",
          background: "#ffffff0d",
          fontSize: 12,
          letterSpacing: ".02em",
          color: "#e8d8c2",
        },
      },
      h(Icon, { name: protection.locked ? "lock" : "shield", size: 14 }),
      badge,
    ),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 18, marginTop: 8 } },
      h(
        Ring,
        {
          value: view.progress,
          size: 300,
          stroke: 8,
          color: "#e8886c",
          track: "#ffffff14",
          pulse: view.running,
        },
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 } },
          h(
            "div",
            {
              className: "t-mono",
              style: {
                fontSize: 58,
                fontWeight: 300,
                letterSpacing: "-.02em",
                color: "#fbf3e6",
                lineHeight: 1,
              },
            },
            fmtClock(view.remainingSecs),
          ),
          h(
            "div",
            { style: { fontSize: 12.5, color: "#c9b7a1", letterSpacing: ".04em" } },
            t("imm.onlyThis"),
          ),
        ),
      ),
      task
        ? h("div", { style: { fontSize: 18, fontWeight: 600, color: "#f0d9c6", textAlign: "center" } }, task.title)
        : null,
      protection.active && protection.mode === "whitelist"
        ? h(
            "div",
            { style: { fontSize: 12, color: "#b9a793" } },
            t("imm.allowHint", { n: protection.effectiveWhitelist.length }),
          )
        : null,
    ),
    h(
      "div",
      {
        style: {
          position: "absolute",
          bottom: 30,
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          justifyContent: "center",
        },
      },
      h(
        Btn,
        {
          size: "sm",
          variant: "plain",
          icon: "calendar",
          style: { color: "#c9b7a1" },
          onClick: () => notify(t("imm.scheduleHint"), "neutral"),
        },
        t("imm.schedule"),
      ),
      h(
        Btn,
        {
          size: "sm",
          variant: "plain",
          icon: "sound",
          style: { color: "#c9b7a1" },
          onClick: () => notify(t("imm.soundHint"), "neutral"),
        },
        t("imm.sound"),
      ),
      h(
        Btn,
        {
          size: "sm",
          variant: "plain",
          style: { color: "#d8b7a2" },
          onClick: () => setEnding(true),
        },
        t("imm.endEarly"),
      ),
    ),
    h(
      "div",
      { style: { position: "absolute", top: 22, right: 22 } },
      h(IconBtn, {
        name: "minimize",
        size: 18,
        box: 34,
        title: t("imm.exit"),
        style: { color: "#c9b7a1" },
        onClick: closeImmersive,
      }),
    ),
    ending
      ? h(EndDialog, {
          copy,
          busy,
          onCancel: () => setEnding(false),
          onEarlyComplete: () =>
            act({ type: "completeFocus" }, () => {
              setEnding(false);
              closeImmersive();
              notify(t("imm.notifyCompleted"), "brand");
            }),
          onInterrupt: () =>
            act({ type: "resetTimer" }, () => {
              setEnding(false);
              closeImmersive();
              notify(t("imm.notifyInterrupted"), "neutral");
            }),
        })
      : null,
  );
}
