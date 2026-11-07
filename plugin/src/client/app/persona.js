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

/**
 * 背景板立绘。挂在 shell.overlay 上（页面右下角、pointer-events:none），
 * 番茄页接管时由 CSS 隐藏；沉浸层 z70 会盖住它。
 */
export function PersonaBackdrop() {
  const state = useSnapshot();
  const [id, setId] = useState(getPersonaId());
  useEffect(() => subscribePersona(setId), []);

  const enabled = !!(state && state.data && state.data.settings && state.data.settings.personaBackdrop);
  useEffect(() => {
    const root = document.documentElement;
    if (enabled) root.setAttribute("data-tomato-persona", "on");
    else root.removeAttribute("data-tomato-persona");
    return () => root.removeAttribute("data-tomato-persona");
  }, [enabled]);

  if (!enabled) return null;

  return h("img", {
    id: "tomato-persona",
    src: ASSET_BASE + personaFile(id),
    alt: "",
    "aria-hidden": "true",
    draggable: false,
    style: {
      position: "fixed",
      right: "max(10px, 1.4vw)",
      bottom: 0,
      height: "min(64vh, 620px)",
      width: "auto",
      maxWidth: "30vw",
      objectFit: "contain",
      objectPosition: "bottom right",
      pointerEvents: "none",
      userSelect: "none",
      zIndex: 1,
      opacity: 0.96,
      filter: "drop-shadow(0 18px 30px #3a24151f)",
      WebkitMaskImage:
        "linear-gradient(to top, transparent 0%, #000 9%), linear-gradient(to left, #000 55%, transparent 100%)",
      WebkitMaskComposite: "source-in",
      maskImage:
        "linear-gradient(to top, transparent 0%, #000 9%), linear-gradient(to left, #000 55%, transparent 100%)",
      maskComposite: "intersect",
    },
  });
}
