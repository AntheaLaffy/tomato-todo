// 专注 HUD：常驻在对话右上角的番茄状态胶囊（不打开面板也能感知专注）。
//
// 为什么常驻：用户的核心诉求是「打开 DSH 就在慢慢学习氛围里」，而不是打开一个
// 面板才开始专注。HUD 是那句氛围的最小载体——一眼看到今天几颗番茄、当前在专注
// 什么、还剩多久，并且不打断对话就能开始/暂停一轮。
//
// 结构（SKIN.md 4.2）：46px 圆角胶囊 = 进度环 + 状态文字 + 任务名 + 迷你控制；
// 点环区专注中回到沉浸层、空闲时展开迷你控制；窄屏收缩成 46px 小圆。
// 位置避开 DSH 顶部栏：top 与 `--dsh-frame-overlay-top` 联动（DSH 自己给浮层
// 留的安全区），取不到时回退到 48px 顶部栏高度之下。沉浸模式时整颗隐藏。
//
// 副作用集中在这里而不是各页面：HUD 是唯一「永远挂载」的番茄组件，所以
// 关键节点音效的播放、背景音引擎的生命周期都挂在它上面（见 app/sound.js）。
import { h, useState, useEffect, useRef } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import { Icon } from "../shared/icons.js";
import { Ring, Btn, IconBtn, Bar, notify } from "../shared/ui.js";
import { useSnapshot, tryDispatch } from "../shared/store.js";
import {
  timerView,
  fmtClock,
  taskById,
  protectionView,
} from "../shared/derive.js";
import { useImmersiveOpen, openImmersive, openEndDialog } from "./immersive.js";
import { attentionCue } from "./attention.js";
import { navigate } from "./navigation.js";
import { useSound, ensureAudio } from "./sound.js";

registerCopy("hud", {
  zh: {
    focusing: "专注中",
    paused: "已暂停",
    pomodoro: "个番茄",
    hint: "今日专注",
    progress: "今日进度",
    noTask: "准备开始今天的第一轮",
    protected: "保护中",
    start: "开始专注",
    pause: "暂停",
    resume: "继续",
    endRound: "结束本轮",
    openImmersive: "回到沉浸专注",
    openApp: "打开番茄 Todo",
    modeFocus: "专注",
    modeShort: "短休息",
    modeLong: "长休息",
    resting: "休息中",
    startRest: "开始休息",
    restNext: "接下来：{mode}",
    notifyPaused: "已暂停，休息一下",
    notifyResumed: "继续专注中",
    notifyEnded: "本轮已结束",
  },
  en: {
    focusing: "Focusing",
    paused: "Paused",
    pomodoro: "pomodoros",
    hint: "Today's focus",
    progress: "Today's progress",
    noTask: "Ready for today's first round",
    protected: "Protected",
    start: "Start focus",
    pause: "Pause",
    resume: "Resume",
    endRound: "End round",
    openImmersive: "Back to focus mode",
    openApp: "Open Tomato Todo",
    modeFocus: "Focus",
    modeShort: "Short break",
    modeLong: "Long break",
    resting: "Resting",
    startRest: "Start break",
    restNext: "Next: {mode}",
    notifyPaused: "Paused — take a breath",
    notifyResumed: "Back to focus",
    notifyEnded: "Round ended",
  },
});

/** HUD 顶部位置：DSH 顶部栏（chrome）之下；取不到 DSH 变量时按 48px 顶部栏回退。 */
const HUD_TOP = "calc(var(--dsh-frame-overlay-top, 48px) + 8px)";
const NARROW_QUERY = 720;

function useNarrow() {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.innerWidth < NARROW_QUERY,
  );
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => setNarrow(window.innerWidth < NARROW_QUERY);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return narrow;
}

/** 专注中每秒刷新一次，让倒计时在两次轮询之间也保持走字。 */
function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function modeLabel(mode) {
  if (mode === "shortBreak") return t("hud.modeShort");
  if (mode === "longBreak") return t("hud.modeLong");
  return t("hud.modeFocus");
}

/**
 * Hud({ openPanel })
 * openPanel：切换到主视图（由 app/main.js 注入 ctx.layout.selectPanel）。
 */
export function Hud({ openPanel }) {
  const state = useSnapshot();
  const immersive = useImmersiveOpen();
  const narrow = useNarrow();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef(null);
  const sound = useSound();

  const view = timerView(state);
  const data = (state && state.data) || {};
  const stats = (state && state.stats) || {};
  const settings = data.settings || {};
  const task = taskById(data, view.taskId);
  const protection = protectionView(state);
  const now = useNow(view.running);

  // 倒计时以 timer.deadline 为准做本地插值：轮询 1.2s 之间数字也不卡住。
  const liveRemaining =
    view.running && typeof view.timer.deadline === "number"
      ? Math.max(0, Math.round(view.timer.deadline - now / 1000))
      : view.remainingSecs;

  const goal = Number(settings.dailyGoal) || 8;
  const done = Number(stats.todayPomodoros) || 0;
  const alive = view.running || view.paused; // 有未结算的专注/休息轮次
  const focusMode = view.mode === "focus";
  const idleBreak = !alive && !focusMode; // 专注结束、尚未开始休息

  // 关键节点音效：开始 / 暂停 / 完成 / 提醒。只看状态跃迁，轮询重复渲染不重复响。
  // 只有「一轮结束」会把界面切到今日专注；提醒只亮 HUD / 顶栏提醒条并播放提示音，
  // 不打断正在输入的对话（窗口置前由 runtime → guard 的原生 focus 负责）。
  const prevRef = useRef(null);
  useEffect(() => {
    const next = {
      // store 在首次请求返回前是 null；只有拿到真实快照才允许比较跃迁。
      hydrated: !!(state && state.data),
      running: view.running,
      paused: view.paused,
      mode: view.mode,
      serial: Number(view.timer.completionSerial) || 0,
      reminders: ((data && data.tasks) || []).filter(
        (item) => item.reminderPending,
      ).length,
    };
    const prev = prevRef.current;
    prevRef.current = next;
    if (prev === null) return;
    const cue = attentionCue(prev, next);
    if (cue) sound.playCue(cue);
    if (cue === "complete")
      navigate({ reason: "complete", serial: next.serial });
    // 音效只在状态跃迁时触发；sound 的引用稳定，不参与依赖以免重复播放。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.running, view.paused, view.mode, view.timer.completionSerial, data]);

  // 展开面板点击空白处收起（沉浸层打开时一并收起）。
  useEffect(() => {
    if (!expanded) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target))
        setExpanded(false);
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [expanded]);

  useEffect(() => {
    if (immersive && expanded) setExpanded(false);
  }, [immersive, expanded]);

  const act = async (action, message, after) => {
    setBusy(true);
    const res = await tryDispatch(action);
    setBusy(false);
    if (!res.ok) {
      notify(res.error || t("common.writeFailed"), "danger");
      return false;
    }
    if (message) notify(message, "brand");
    after?.();
    return true;
  };

  const startRound = async () => {
    ensureAudio();
    // 节点音效由下面的状态跃迁 effect 统一播放，这里不重复发声。
    const ok = await act(
      { type: "startTimer" },
      view.paused ? t("hud.notifyResumed") : null,
    );
    if (ok) openImmersive();
  };

  const pauseRound = () => act({ type: "pauseTimer" }, t("hud.notifyPaused"));

  // 空闲时不出现在右上角：番茄预计/实际在左下角入口面板里，HUD 只在专注/暂停/
  // 保护生效时出现，显示倒计时与当前任务。
  if (immersive) return null;
  if (!view.running && !view.paused && !protection.active) return null;

  const label = view.running
    ? `${focusMode ? t("hud.focusing") : t("hud.resting")} ${fmtClock(liveRemaining)}`
    : view.paused
      ? `${t("hud.paused")} ${fmtClock(liveRemaining)}`
      : idleBreak
        ? modeLabel(view.mode)
        : `${done} / ${goal} ${t("hud.pomodoro")}`;
  const subline =
    task && (focusMode || view.running)
      ? task.title
      : idleBreak
        ? t("hud.restNext", { mode: modeLabel(view.mode) })
        : protection.active
          ? t("hud.protected")
          : t("hud.noTask");
  const primaryTitle = view.running
    ? t("hud.pause")
    : view.paused
      ? t("hud.resume")
      : idleBreak
        ? t("hud.startRest")
        : t("hud.start");
  const primaryLabel = view.paused
    ? t("hud.resume")
    : idleBreak
      ? t("hud.startRest")
      : t("hud.start");
  const ringValue = goal > 0 ? Math.min(1, done / goal) : 0;
  const ringColor = view.running
    ? "var(--tomato-brand)"
    : view.paused
      ? "var(--tomato-sun)"
      : "var(--tomato-leaf)";

  const capsuleBody = h(
    "button",
    {
      type: "button",
      // 所有番茄相关条目点击都进番茄面板；沉浸专注从展开菜单里进。
      onClick: () => {
        setExpanded(false);
        openPanel?.();
      },
      title: t("hud.openApp"),
      "aria-label": t("hud.openApp"),
      style: {
        display: "flex",
        alignItems: "center",
        gap: narrow ? 0 : 9,
        height: 46,
        minWidth: 46,
        padding: narrow ? 0 : "0 4px",
        background: "none",
        border: "none",
        borderRadius: 22,
        cursor: "pointer",
        justifyContent: "center",
        flex: "none",
      },
    },
    h(
      "span",
      {
        className: view.running ? "t-pulse" : undefined,
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
        },
      },
      h(
        Ring,
        {
          value: ringValue,
          size: 32,
          stroke: 3,
          color: ringColor,
          track: "var(--tomato-surface-3)",
        },
        h(Icon, {
          name: "tomato",
          size: 14,
          stroke: 1.7,
          style: { color: ringColor },
        }),
      ),
    ),
    narrow
      ? null
      : h(
          "span",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              lineHeight: 1.25,
              minWidth: 0,
            },
          },
          h(
            "span",
            {
              className: view.running ? "t-mono" : undefined,
              style: {
                fontSize: 12.5,
                fontWeight: 620,
                color: "var(--tomato-ink)",
                whiteSpace: "nowrap",
              },
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
            subline,
          ),
        ),
  );

  return h(
    "div",
    {
      ref: rootRef,
      className: "t-root",
      style: {
        position: "fixed",
        top: HUD_TOP,
        right: 18,
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8,
        pointerEvents: "none",
      },
    },
    h(
      "div",
      {
        className: "t-card",
        style: {
          display: "flex",
          alignItems: "center",
          gap: 2,
          height: 46,
          padding: narrow ? 0 : "0 7px 0 5px",
          borderRadius: 23,
          width: narrow ? 46 : undefined,
          pointerEvents: "auto",
          background:
            "color-mix(in srgb, var(--tomato-surface) 88%, transparent)",
          backdropFilter: "blur(12px)",
          boxShadow: view.running
            ? "0 8px 22px -12px #b9573f73, 0 0 0 1px var(--tomato-line)"
            : "var(--tomato-shadow)",
          transition: "box-shadow .4s ease",
        },
      },
      capsuleBody,
      narrow
        ? null
        : h(IconBtn, {
            name: view.running ? "pause" : "play",
            size: 15,
            box: 30,
            disabled: busy,
            title: primaryTitle,
            style: {
              color: view.running
                ? "var(--tomato-brand-deep)"
                : "var(--tomato-ink)",
            },
            onClick: (e) => {
              e.stopPropagation();
              if (view.running) pauseRound();
              else startRound();
            },
          }),
      narrow
        ? null
        : h(IconBtn, {
            name: expanded ? "chevronUp" : "chevronDown",
            size: 14,
            box: 22,
            title: expanded ? t("common.close") : t("hud.hint"),
            onClick: () => setExpanded((v) => !v),
          }),
    ),
    expanded
      ? h(
          "div",
          {
            className: "t-card",
            style: {
              width: narrow ? "min(280px, calc(100vw - 36px))" : 262,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              pointerEvents: "auto",
              animation: "t-pop .2s ease",
            },
          },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 8 } },
            h(Icon, {
              name: "tomato",
              size: 15,
              style: { color: "var(--tomato-brand)" },
            }),
            h(
              "span",
              {
                style: {
                  fontSize: 12.5,
                  fontWeight: 620,
                  color: "var(--tomato-ink)",
                  flex: 1,
                },
              },
              t("hud.hint"),
            ),
            h(
              "span",
              {
                className: "t-mono",
                style: { fontSize: 11.5, color: "var(--tomato-ink-2)" },
              },
              `${done} / ${goal}`,
            ),
          ),
          h(Bar, { value: done, max: goal, height: 6 }),
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                minWidth: 0,
              },
            },
            h(
              "span",
              {
                className: view.running ? "t-mono" : undefined,
                style: { fontSize: 12.5, color: "var(--tomato-ink)" },
              },
              label,
            ),
            h(
              "span",
              {
                style: {
                  fontSize: 11,
                  color: "var(--tomato-ink-3)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                },
              },
              `${modeLabel(view.mode)}${task ? ` · ${task.title}` : ""}`,
            ),
          ),
          h(
            "div",
            { style: { display: "flex", gap: 7 } },
            view.running
              ? h(
                  Btn,
                  {
                    size: "sm",
                    icon: "pause",
                    disabled: busy,
                    style: { flex: 1 },
                    onClick: pauseRound,
                  },
                  t("hud.pause"),
                )
              : h(
                  Btn,
                  {
                    size: "sm",
                    variant: "primary",
                    icon: idleBreak ? "coffee" : "play",
                    disabled: busy,
                    style: { flex: 1 },
                    onClick: startRound,
                  },
                  primaryLabel,
                ),
            alive
              ? h(Btn, {
                  size: "sm",
                  icon: "stop",
                  disabled: busy,
                  title: t("hud.endRound"),
                  onClick: () => {
                    setExpanded(false);
                    openEndDialog();
                  },
                })
              : null,
          ),
          alive
            ? h(
                "button",
                {
                  type: "button",
                  className: "t-navitem",
                  onClick: () => {
                    setExpanded(false);
                    openImmersive();
                  },
                  style: { padding: "7px 8px" },
                },
                h(Icon, { name: "focus", size: 16 }),
                t("hud.openImmersive"),
                h(Icon, {
                  name: "chevronRight",
                  size: 14,
                  style: { marginLeft: "auto", opacity: 0.6 },
                }),
              )
            : null,
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
            h(Icon, {
              name: "chevronRight",
              size: 14,
              style: { marginLeft: "auto", opacity: 0.6 },
            }),
          ),
        )
      : null,
  );
}
