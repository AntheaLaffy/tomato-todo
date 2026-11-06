// 皮肤装配：主题令牌 + 样式表 + 氛围层 + 品牌位替换（整个 DSH 的番茄皮肤）。
//
// 这里不注册 main panel / HUD——那是 app/main.js 的事；皮肤只改「长相」。
import { h } from "../runtime.js";
import { Icon } from "../shared/icons.js";
import { injectStyles } from "./styles.js";
import { injectAmbient } from "./ambient.js";
import { SKIN_TOKENS, SKIN_SOURCE } from "./theme.js";

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

function safeInject(ctx, key, options, Component) {
  try {
    ctx.slots.inject(key, () => ctx.slots.register(options, Component));
  } catch {
    /* 槽位不存在（DSH 版本差异）时静默跳过，不影响其余皮肤 */
  }
}

export function registerSkin(ctx) {
  const removeStyles = injectStyles();
  const removeAmbient = injectAmbient();

  const theme = ctx.get ? ctx.get("theme") : null;
  const removeTokens =
    theme && typeof theme.overrideTokens === "function"
      ? theme.overrideTokens(SKIN_SOURCE, SKIN_TOKENS)
      : null;

  safeInject(ctx, "sidebar.brand.mark", { name: "sidebar.brand.mark" }, TomatoMark);
  safeInject(ctx, "sidebar.brand.name", { name: "sidebar.brand.name" }, TomatoWordmark);
  safeInject(ctx, "conversation.hero.brand.mark", { name: "conversation.hero.brand.mark" }, HeroMark);

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
