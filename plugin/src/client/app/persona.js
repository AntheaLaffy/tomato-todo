// 角色背景板（看板娘）：立绘来自旧版内置素材（ATRI 官方立绘，权利归原权利方，
// 见 plugin/assets/personas/README.md）。显示在 DSH 页面右下角，不拦截点击。
//
// 与旧版一致：受 settings.personaBackdrop 开关控制（默认关闭；本机数据里是打开的）。
// 番茄 Todo 全屏接管页与沉浸专注页不显示（那边是线描书桌氛围，避免两套画风打架）。
import { h, useState, useEffect } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import { useSnapshot } from "../shared/store.js";

registerCopy("persona", {
  zh: {
    atri: "小迷妹",
    natsuki: "冷静学伴",
    ryuji: "严格教练",
    minamo: "温柔学姐",
    label: "看板娘",
    hint: "选择陪你学习的角色（显示在页面右下角）",
  },
  en: {
    atri: "Little fangirl",
    natsuki: "Calm study buddy",
    ryuji: "Strict coach",
    minamo: "Gentle senior",
    label: "Backdrop character",
    hint: "The character standing at the lower right while you study",
  },
});

export const PERSONAS = [
  { id: "atri", file: "atri.png", nameKey: "persona.atri" },
  { id: "natsuki", file: "natsuki.png", nameKey: "persona.natsuki" },
  { id: "ryuji", file: "ryuji.png", nameKey: "persona.ryuji" },
  { id: "minamo", file: "minamo.png", nameKey: "persona.minamo" },
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

/** 立绘样式：不做整体透明——不压卡片时必须实心（用户要求）。 */
function personaStyle(position) {
  return {
    position,
    right: "max(10px, 1.6vw)",
    bottom: "5vh",
    height: "min(42vh, 380px)",
    width: "auto",
    maxWidth: "22vw",
    objectFit: "contain",
    objectPosition: "bottom right",
    pointerEvents: "none",
    userSelect: "none",
    zIndex: 1,
    filter: "drop-shadow(0 16px 26px #3a241524)",
    // 只在最左缘做很短的过渡，避免边界生硬；主体完全实心。
    WebkitMaskImage:
      "linear-gradient(to right, transparent 0%, #000d 6%, #000 13%), linear-gradient(to top, transparent 0%, #000 3%)",
    WebkitMaskComposite: "source-in",
    maskImage:
      "linear-gradient(to right, transparent 0%, #000d 6%, #000 13%), linear-gradient(to top, transparent 0%, #000 3%)",
    maskComposite: "intersect",
  };
}

/**
 * DSH 页面（对话/插件页等）的看板娘：挂在 shell.overlay 上，右下方、不拦点击。
 * 番茄页接管时由 CSS 隐藏——那边用页面内的 PersonaBoard（在卡片后面）。
 */
export function PersonaBackdrop() {
  const id = usePersonaEnabled();
  if (id === null) return null;
  return h("img", {
    id: "tomato-persona",
    src: ASSET_BASE + personaFile(id),
    alt: "",
    "aria-hidden": "true",
    draggable: false,
    style: personaStyle("fixed"),
  });
}

/**
 * 番茄主视图内的看板娘：作为页面最底层（z-index 0）的 img 绝对定位在右下角，
 * 卡片（z-index 1，纸色不透明）自然把它盖住——于是「碰到卡片」的地方看不见，
 * 没被盖住的部分完全实心。这就是旧版背景板的真实行为。
 */
export function PersonaBoard() {
  const id = usePersonaEnabled();
  if (id === null) return null;
  return h("img", {
    id: "tomato-persona-board",
    src: ASSET_BASE + personaFile(id),
    alt: "",
    "aria-hidden": "true",
    draggable: false,
    style: { ...personaStyle("absolute"), zIndex: 0 },
  });
}
