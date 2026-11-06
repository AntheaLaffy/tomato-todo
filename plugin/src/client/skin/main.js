// 皮肤装配：主题令牌 + 样式表 + 氛围层 + 品牌位替换（整个 DSH 的番茄皮肤）。
//
// 这里不注册 main panel / HUD——那是 app/main.js 的事；皮肤只改「长相」。
import { h, useEffect } from "../runtime.js";
import { Icon } from "../shared/icons.js";
import { useSnapshot } from "../shared/store.js";
import { injectStyles } from "./styles.js";
import { injectAmbient, SKY_INNER } from "./ambient.js";
import { SKIN_SOURCE, SKIN_TOKENS } from "./theme.js";
import { applySkinPrefs } from "./prefs.js";
import { TomatoSkinSettingsRow } from "./settings-row.js";

/** 侧栏品牌标记（折叠态也显示）：番茄徽记。 */
function TomatoMark({ size }) {
  return h(Icon, {
    name: "tomato",
    size: size || 22,
    stroke: 1.5,
    style: { color: "var(--tomato-brand)" },
  });
}

/** 侧栏品牌名：字标「番茄 Todo」。 */
function TomatoWordmark() {
  return h(
    "span",
    {
      style: {
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
        fontFamily: "'Noto Serif SC','Songti SC',Georgia,serif",
        fontSize: 14.5,
        fontWeight: 600,
        letterSpacing: ".02em",
        color: "var(--tomato-ink)",
        whiteSpace: "nowrap",
      },
    },
    "番茄 Todo",
    h("span", {
      style: {
        width: 5,
        height: 5,
        borderRadius: "50%",
        background: "var(--tomato-brand)",
        display: "inline-block",
        marginBottom: 2,
      },
    }),
  );
}

/** 新会话页的品牌标记：同一枚番茄，稍大。 */
function HeroMark() {
  return h(Icon, {
    name: "tomato",
    size: 30,
    stroke: 1.4,
    style: { color: "var(--tomato-brand)" },
  });
}

/**
 * 天空层：壳层可见的窗光 + 远景线描（shell.overlay，order -1000）。
 * pointer-events 由 inline style 与样式表双重保证，绝不拦截交互；
 * 内容全部是静态 DOM + CSS 动画，没有逐帧 JS。
 */
function SkinSky() {
  return h("div", {
    id: "tomato-sky",
    "data-tomato-ambient": "sky",
    "aria-hidden": "true",
    style: { pointerEvents: "none" },
    dangerouslySetInnerHTML: { __html: SKY_INNER },
  });
}

/**
 * 把 core Settings 的品牌背景板开关同步成 html 属性：
 * 偏好页与设置行都写同一个字段，插画显示始终跟随数据。
 */
function SkinSync() {
  const state = useSnapshot();
  const backdrop = state && state.data && state.data.settings ? state.data.settings.personaBackdrop : undefined;
  useEffect(() => {
    const root = document.documentElement;
    if (backdrop === false) root.setAttribute("data-tomato-backdrop", "off");
    else root.removeAttribute("data-tomato-backdrop");
  }, [backdrop]);
  return null;
}

function safeInject(ctx, key, options, Component) {
  try {
    ctx.slots.inject(key, () => ctx.slots.register(options, Component));
  } catch {
    /* 槽位不存在（DSH 版本差异）时静默跳过，不影响其余皮肤 */
  }
}

export function registerSkin(ctx) {
  applySkinPrefs();
  const removeStyles = injectStyles();
  const removeAmbient = injectAmbient();

  const theme = ctx.get ? ctx.get("theme") : null;
  const removeTokens =
    theme && typeof theme.overrideTokens === "function"
      ? theme.overrideTokens(SKIN_SOURCE, SKIN_TOKENS)
      : null;

  // 天空层先于 HUD（order 900）与沉浸层（order 900）绘制，沉浸模式会盖住它。
  safeInject(
    ctx,
    "shell.overlay",
    { name: "shell.overlay", id: "tomato-sky", order: -1000 },
    SkinSky,
  );
  safeInject(
    ctx,
    "sidebar.brand.mark",
    { name: "sidebar.brand.mark" },
    TomatoMark,
  );
  safeInject(
    ctx,
    "sidebar.brand.name",
    { name: "sidebar.brand.name" },
    TomatoWordmark,
  );
  safeInject(
    ctx,
    "conversation.hero.brand.mark",
    { name: "conversation.hero.brand.mark" },
    HeroMark,
  );
  safeInject(
    ctx,
    "shell.overlay",
    { name: "shell.overlay", id: "tomato-sky-sync", order: -998 },
    SkinSync,
  );
  safeInject(
    ctx,
    "settings.general.item",
    { name: "settings.general.item", id: "tomato-skin", order: 13 },
    TomatoSkinSettingsRow,
  );

  const dispose = () => {
    try {
      removeStyles();
    } catch {
      /* already removed */
    }
    try {
      removeAmbient();
    } catch {
      /* already removed */
    }
    try {
      removeTokens?.();
    } catch {
      /* theme already disposed */
    }
  };
  if (typeof ctx.effect === "function") {
    ctx.effect(() => dispose);
  }
  return dispose;
}
