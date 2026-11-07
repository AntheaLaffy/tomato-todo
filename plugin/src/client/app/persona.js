// 角色背景板（看板娘）：立绘来自旧版内置素材（ATRI 官方立绘，权利归原权利方，
// 见 plugin/assets/personas/README.md）。显示在 DSH 页面右下角，不拦截点击。
//
// 与旧版一致：受 settings.personaBackdrop 开关控制（默认关闭；本机数据里是打开的）。
// 沉浸专注层（z70）盖住它；番茄页接管时仍然显示。
//
// 切换：鼠标移到立绘附近，左侧浮出一列 Q 版头像（default/calm/coach/senpai.webp），
// 点一下就换人——不用进设置。触摸设备没有 hover，直接点立绘开合同一列。
// 选择存在 localStorage；DSH 设置-通用「番茄氛围」里的下拉框改的是同一个值。
import { h, useState, useEffect, useRef } from "../runtime.js";
import { t, registerCopy, useLocale } from "../shared/copy.js";
import { useSnapshot } from "../shared/store.js";

registerCopy("persona", {
  zh: {
    atri: "小迷妹",
    natsuki: "冷静学伴",
    ryuji: "严格教练",
    minamo: "温柔学姐",
    label: "看板娘",
    switch: "换一位",
    hint: "选择陪你学习的角色（显示在页面右下角）",
  },
  en: {
    atri: "Little fangirl",
    natsuki: "Calm study buddy",
    ryuji: "Strict coach",
    minamo: "Gentle senior",
    label: "Backdrop character",
    switch: "Switch",
    hint: "The character standing at the lower right while you study",
  },
});

export const PERSONAS = [
  {
    id: "atri",
    file: "atri.png",
    avatar: "default.webp",
    nameKey: "persona.atri",
  },
  {
    id: "natsuki",
    file: "natsuki.png",
    avatar: "calm.webp",
    nameKey: "persona.natsuki",
  },
  {
    id: "ryuji",
    file: "ryuji.png",
    avatar: "coach.webp",
    nameKey: "persona.ryuji",
  },
  {
    id: "minamo",
    file: "minamo.png",
    avatar: "senpai.webp",
    nameKey: "persona.minamo",
  },
];

const KEY = "tomato-dsh.persona";
const DEFAULT_ID = "atri";
const ASSET_BASE = "/plugins/@local/tomato-dsh/assets/personas/";

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw && PERSONAS.some((p) => p.id === raw)) return raw;
  } catch {
    /* 隐私模式 */
  }
  return DEFAULT_ID;
}

let current = load();
const listeners = new Set();

export function getPersonaId() {
  return current;
}

export function setPersonaId(id) {
  if (!PERSONAS.some((p) => p.id === id)) return;
  if (id === current) return;
  current = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* 忽略 */
  }
  for (const fn of Array.from(listeners)) fn(current);
}

export function subscribePersona(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function personaFile(id = current) {
  const found = PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];
  return found.file;
}

export function personaAvatar(id = current) {
  const found = PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];
  return found.avatar;
}

/**
 * 切换列的落脚点默认与立绘底部齐平，那里在对话界面正好压着 DSH 输入框的右端
 * （发送按钮所在）。DSH 把整块输入区放在 `[data-composer-seat]` 里，把列抬到它的
 * 上缘再往上 12px，输入框长高（多行草稿、入口卡占位）时列跟着上移。
 *
 * 不抬的两种情况：没有输入区的界面（番茄页、设置页）；输入区整个在立绘上方
 * （新会话把输入框居中），这时立绘那一带本来就没有可挡的东西。上限再按立绘
 * 高度收一收，最差也只是升到立绘头顶，不会飞到页面中间。
 */
export function composerLift(anchor) {
  if (!anchor) return 0;
  const box = composerSeatRect();
  const base = anchor.getBoundingClientRect();
  if (!box || !box.height || !base.height) return 0;
  if (box.top <= base.top) return 0;
  const lift = Math.round(base.bottom - box.top + 12);
  return Math.min(Math.max(0, lift), Math.max(0, Math.round(base.height - 40)));
}

/** 当前可见会话的输入区（多会话保留在 DOM 里时，只有贴在底部的那个有高度）。 */
function composerSeatRect() {
  if (
    typeof document === "undefined" ||
    typeof document.querySelectorAll !== "function"
  )
    return null;
  let best = null;
  for (const node of document.querySelectorAll("[data-composer-seat]")) {
    const rect = node.getBoundingClientRect();
    if (!rect.height) continue;
    if (!best || rect.bottom > best.bottom) best = rect;
  }
  return best;
}

/** 在矩形内、外扩 pad 像素（看板娘没有可点区域，用几何命中代替 hover 命不中的问题）。 */
function hit(el, x, y, pad) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return false;
  return (
    x >= r.left - pad &&
    x <= r.right + pad &&
    y >= r.top - pad &&
    y <= r.bottom + pad
  );
}

export function PersonaSwitch({ currentId, onPick, panelRef, lift = 0 }) {
  return h(
    "div",
    {
      id: "tomato-persona-switch",
      ref: panelRef,
      role: "group",
      "aria-label": t("persona.label"),
      style: lift > 0 ? { marginBottom: `${lift}px` } : undefined,
      onPointerDown: (e) => e.stopPropagation(),
      onClick: (e) => e.stopPropagation(),
    },
    h("div", { className: "t-persona-cap" }, t("persona.switch")),
    PERSONAS.map((p) =>
      h(
        "button",
        {
          key: p.id,
          type: "button",
          className: "t-persona-pick",
          "data-active": p.id === currentId ? "true" : "false",
          title: t(p.nameKey),
          "aria-label": t(p.nameKey),
          "aria-pressed": p.id === currentId,
          onClick: () => onPick(p.id),
        },
        h("img", {
          src: ASSET_BASE + p.avatar,
          alt: "",
          "aria-hidden": "true",
          draggable: false,
        }),
      ),
    ),
  );
}

function usePersonaEnabled() {
  const state = useSnapshot();
  const [id, setId] = useState(getPersonaId());
  useEffect(() => subscribePersona(setId), []);
  const enabled = !!(
    state &&
    state.data &&
    state.data.settings &&
    state.data.settings.personaBackdrop
  );
  useEffect(() => {
    const root = document.documentElement;
    if (enabled) root.setAttribute("data-tomato-persona", "on");
    else root.removeAttribute("data-tomato-persona");
    return () => root.removeAttribute("data-tomato-persona");
  }, [enabled]);
  return enabled ? id : null;
}

/** 立绘样式（位置由外层 #tomato-persona-wrap 决定，方便在它左边挂切换列）。 */
function personaStyle() {
  return {
    display: "block",
    height: "min(42vh, 380px)",
    width: "auto",
    maxWidth: "22vw",
    objectFit: "contain",
    objectPosition: "bottom right",
    pointerEvents: "none",
    userSelect: "none",
    filter: "drop-shadow(0 16px 26px #3a241524)",
    // 只有左缘（压到卡片的那一段）渐隐，主体完全实心：
    // 0-18% 从透明升到 ~35%，34% 到 85%，44% 之后完全不透明。
    WebkitMaskImage:
      "linear-gradient(to right, transparent 0%, #00000059 18%, #000000d9 34%, #000 44%), linear-gradient(to top, transparent 0%, #000 3%)",
    WebkitMaskComposite: "source-in",
    maskImage:
      "linear-gradient(to right, transparent 0%, #00000059 18%, #000000d9 34%, #000 44%), linear-gradient(to top, transparent 0%, #000 3%)",
    maskComposite: "intersect",
  };
}

/**
 * DSH 所有界面（含番茄接管页）右下角的看板娘 + 角色切换。
 *
 * 交互：
 * - 桌面：指针靠近立绘（外扩 16px）或切换列时，列淡入；离开约 420ms 后收起，
 *   中途路过那 12px 缝隙不会闪断。
 * - 触摸：立绘可点（CSS 在 hover:none 时才放开 pointer-events），点开/点收。
 * - Esc 收起。
 */
export function PersonaBackdrop() {
  useLocale();
  const id = usePersonaEnabled();
  const [open, setOpen] = useState(false);
  const [lift, setLift] = useState(0);
  const imgRef = useRef(null);
  const panelRef = useRef(null);
  const timer = useRef(0);

  useEffect(() => {
    if (id === null) {
      setOpen(false);
      return undefined;
    }
    const onMove = (e) => {
      if (e.pointerType === "touch") return;
      const hot =
        hit(imgRef.current, e.clientX, e.clientY, 16) ||
        hit(panelRef.current, e.clientX, e.clientY, 10);
      if (hot) {
        if (timer.current) {
          window.clearTimeout(timer.current);
          timer.current = 0;
        }
        setLift(composerLift(imgRef.current));
        setOpen(true);
      } else if (!timer.current) {
        timer.current = window.setTimeout(() => {
          timer.current = 0;
          setOpen(false);
        }, 420);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKey);
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = 0;
      }
    };
  }, [id]);

  // 列展开期间跟着输入区走：多行草稿把输入框撑高、入口卡出现/消失都会改变上缘。
  useEffect(() => {
    if (!open) return undefined;
    const measure = () => setLift(composerLift(imgRef.current));
    measure();
    const seat =
      typeof document === "undefined"
        ? null
        : document.querySelector("[data-composer-seat]");
    const observer =
      seat && typeof ResizeObserver === "function"
        ? new ResizeObserver(measure)
        : null;
    if (observer) observer.observe(seat);
    window.addEventListener("resize", measure);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  if (id === null) return null;

  return h(
    "div",
    { id: "tomato-persona-wrap" },
    open
      ? h(PersonaSwitch, {
          currentId: id,
          panelRef,
          lift,
          onPick: (next) => setPersonaId(next),
        })
      : null,
    h("img", {
      id: "tomato-persona",
      key: id,
      ref: imgRef,
      src: ASSET_BASE + personaFile(id),
      alt: "",
      "aria-hidden": "true",
      draggable: false,
      onClick: () => setOpen((v) => !v),
      style: personaStyle(),
    }),
  );
}
