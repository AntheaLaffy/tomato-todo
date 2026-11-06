// 共享 UI 原语（lead 维护，页面不得复制样式）。
//
// 约定：布局用 inline style（页面可以按需覆盖），状态样式（hover/focus/选中/
// 动画）走 ui.css.js 的 `t-` 类；颜色只用 var(--tomato-*) 与 var(--dsw-alias-*)。
// 组件不写死中文，文案通过 props 或 copy 传入。
import { h, useState, useEffect, useRef, Fragment } from "../runtime.js";
import { t } from "./copy.js";
import { Icon } from "./icons.js";

const SIZES = {
  sm: { height: 28, pad: "0 10px", font: 12.5, gap: 6, radius: 9, icon: 15 },
  md: { height: 34, pad: "0 14px", font: 13.5, gap: 7, radius: 11, icon: 16 },
  lg: { height: 42, pad: "0 20px", font: 14.5, gap: 8, radius: 13, icon: 18 },
};

/** 卡片：纸面 + 细线 + 轻阴影。 */
export function Card({ children, pad = 20, style, flat = false, onClick, className = "", ...rest }) {
  return h(
    "div",
    {
      className: `t-root ${flat ? "t-card-flat" : "t-card"} ${className}`,
      style: { padding: pad, ...style },
      onClick,
      ...rest,
    },
    children,
  );
}

export function SectionTitle({ icon, title, hint, action, style }) {
  return h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 9,
        marginBottom: 12,
        ...style,
      },
    },
    icon ? h(Icon, { name: icon, size: 17, style: { color: "var(--tomato-ink-3)" } }) : null,
    h(
      "div",
      { style: { fontSize: 14, fontWeight: 620, color: "var(--tomato-ink)", flex: 1, minWidth: 0 } },
      title,
    ),
    hint
      ? h("div", { style: { fontSize: 12, color: "var(--tomato-ink-3)" } }, hint)
      : null,
    action ?? null,
  );
}

/** 按钮。variant: primary | soft | ghost | plain | danger */
export function Btn({
  variant = "ghost",
  size = "md",
  icon,
  iconRight,
  children,
  onClick,
  disabled = false,
  title,
  block = false,
  type = "button",
  style,
  className = "",
}) {
  const s = SIZES[size] || SIZES.md;
  return h(
    "button",
    {
      type,
      title,
      disabled,
      onClick,
      className: `t-root t-btn t-btn-${variant} ${block ? "t-btn-block" : ""} ${className}`,
      style: {
        height: s.height,
        padding: children ? s.pad : 0,
        width: children ? undefined : s.height,
        fontSize: s.font,
        gap: s.gap,
        borderRadius: s.radius,
        ...style,
      },
    },
    icon ? h(Icon, { name: icon, size: s.icon }) : null,
    children ?? null,
    iconRight ? h(Icon, { name: iconRight, size: s.icon }) : null,
  );
}

/** 方形图标按钮（工具栏、行内操作）。 */
export function IconBtn({
  name,
  size = 17,
  box = 32,
  onClick,
  title,
  disabled = false,
  active = false,
  style,
}) {
  return h(
    "button",
    {
      type: "button",
      title,
      "aria-label": title || name,
      disabled,
      onClick,
      className: "t-iconbtn",
      style: {
        width: box,
        height: box,
        color: active ? "var(--tomato-brand-deep)" : undefined,
        background: active ? "var(--tomato-brand-soft)" : undefined,
        ...style,
      },
    },
    h(Icon, { name, size }),
  );
}

const CHIP_TONES = {
  neutral: { bg: "var(--tomato-surface-2)", fg: "var(--tomato-ink-2)", bd: "transparent" },
  brand: { bg: "var(--tomato-brand-soft)", fg: "var(--tomato-brand-deep)", bd: "transparent" },
  leaf: { bg: "#7e9a6e20", fg: "#5f7b50", bd: "transparent" },
  sun: { bg: "#d5a55326", fg: "#a87b2d", bd: "transparent" },
  danger: { bg: "#b8503f18", fg: "#b8503f", bd: "transparent" },
};

export function Chip({ children, tone = "neutral", color, icon, style, onClick, active = false }) {
  const palette = CHIP_TONES[tone] || CHIP_TONES.neutral;
  return h(
    onClick ? "button" : "span",
    {
      ...(onClick ? { type: "button", onClick, className: "t-chip t-btn" } : {}),
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 22,
        padding: "0 8px",
        borderRadius: 7,
        fontSize: 11.5,
        lineHeight: 1,
        whiteSpace: "nowrap",
        color: color || palette.fg,
        background: active ? "var(--tomato-brand-soft)" : palette.bg,
        border: `1px solid ${palette.bd}`,
        fontFamily: "inherit",
        cursor: onClick ? "pointer" : undefined,
        flex: "none",
        ...style,
      },
    },
    icon ? h(Icon, { name: icon, size: 12 }) : null,
    children,
  );
}

export function Dot({ color = "var(--tomato-ink-3)", size = 7, style }) {
  return h("span", {
    style: {
      display: "inline-block",
      width: size,
      height: size,
      borderRadius: "50%",
      background: color,
      flex: "none",
      ...style,
    },
  });
}

const BADGE_TONES = {
  neutral: ["var(--tomato-surface-3)", "var(--tomato-ink-2)"],
  brand: ["var(--tomato-brand)", "var(--tomato-on-brand)"],
  leaf: ["var(--tomato-leaf)", "#fff"],
  sun: ["var(--tomato-sun)", "#fff"],
};

export function Badge({ children, tone = "neutral", style }) {
  const [bg, fg] = BADGE_TONES[tone] || BADGE_TONES.neutral;
  return h(
    "span",
    {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 20,
        padding: "0 8px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        background: bg,
        color: fg,
        flex: "none",
        ...style,
      },
    },
    children,
  );
}

/**
 * 环形进度（番茄计时、每日目标）。
 * children 渲染在圆环中央；value ∈ [0,1]。
 */
export function Ring({
  value = 0,
  size = 260,
  stroke = 12,
  color = "var(--tomato-brand)",
  track = "var(--tomato-surface-3)",
  children,
  pulse = false,
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, Number(value) || 0));
  return h(
    "div",
    {
      style: {
        position: "relative",
        width: size,
        height: size,
        flex: "none",
        display: "grid",
        placeItems: "center",
      },
    },
    h(
      "svg",
      {
        width: size,
        height: size,
        viewBox: `0 0 ${size} ${size}`,
        style: { position: "absolute", inset: 0, transform: "rotate(-90deg)" },
      },
      h("circle", { cx: size / 2, cy: size / 2, r, fill: "none", stroke: track, strokeWidth: stroke }),
      h("circle", {
        className: "t-ring-progress",
        cx: size / 2,
        cy: size / 2,
        r,
        fill: "none",
        stroke: color,
        strokeWidth: stroke,
        strokeLinecap: "round",
        strokeDasharray: c,
        strokeDashoffset: c * (1 - v),
      }),
    ),
    children
      ? h("div", { className: pulse ? "t-pulse" : undefined, style: { position: "relative", zIndex: 1 } }, children)
      : null,
  );
}

export function Bar({ value = 0, max = 1, color = "var(--tomato-brand)", height = 8, style, radius = 8 }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, Number(value) / max)) * 100 : 0;
  return h(
    "div",
    {
      style: {
        height,
        borderRadius: radius,
        background: "var(--tomato-surface-3)",
        overflow: "hidden",
        ...style,
      },
    },
    h("div", {
      style: {
        width: `${pct}%`,
        height: "100%",
        borderRadius: radius,
        background: color,
        transition: "width .5s cubic-bezier(.3,.7,.3,1)",
      },
    }),
  );
}

/** 分段控件：items = [{value, label, icon?}] */
export function Segmented({ items, value, onChange, size = "md", style }) {
  const s = SIZES[size] || SIZES.md;
  return h(
    "div",
    { className: "t-seg t-root", style },
    items.map((item) =>
      h(
        "button",
        {
          key: String(item.value),
          type: "button",
          className: "t-tab",
          "data-active": item.value === value,
          onClick: () => onChange?.(item.value),
          style: { height: s.height - 6, fontSize: s.font, display: "flex", alignItems: "center", gap: 5 },
        },
        item.icon ? h(Icon, { name: item.icon, size: 14 }) : null,
        item.label,
      ),
    ),
  );
}

export function Input({
  value,
  onChange,
  onKeyDown,
  placeholder,
  autoFocus = false,
  size = "md",
  mono = false,
  style,
  type = "text",
  disabled = false,
  maxLength,
  onBlur,
  inputRef,
}) {
  const s = SIZES[size] || SIZES.md;
  return h("input", {
    ref: inputRef,
    type,
    value: value ?? "",
    placeholder,
    autoFocus,
    disabled,
    maxLength,
    onBlur,
    onChange: (e) => onChange?.(e.target.value, e),
    onKeyDown,
    className: `t-root t-input ${mono ? "t-mono" : ""}`,
    style: { height: s.height, fontSize: s.font, ...style },
  });
}

export function TextArea({ value, onChange, placeholder, rows = 3, style }) {
  return h("textarea", {
    value: value ?? "",
    placeholder,
    rows,
    onChange: (e) => onChange?.(e.target.value, e),
    className: "t-root t-textarea",
    style: { fontSize: 13.5, ...style },
  });
}

export function Field({ label, hint, children, style, inline = false }) {
  return h(
    "label",
    {
      style: {
        display: "flex",
        flexDirection: inline ? "row" : "column",
        alignItems: inline ? "center" : "stretch",
        gap: inline ? 12 : 6,
        minWidth: 0,
        ...style,
      },
    },
    label
      ? h(
          "span",
          {
            style: {
              fontSize: 12,
              fontWeight: 550,
              color: "var(--tomato-ink-2)",
              flex: inline ? 1 : "none",
            },
          },
          label,
        )
      : null,
    children,
    hint ? h("span", { style: { fontSize: 11.5, color: "var(--tomato-ink-3)" } }, hint) : null,
  );
}

export function Toggle({ checked, onChange, label, hint, style }) {
  return h(
    "div",
    { style: { display: "flex", alignItems: "center", gap: 12, ...style } },
    label
      ? h(
          "div",
          { style: { flex: 1, minWidth: 0 } },
          h("div", { style: { fontSize: 13.5, color: "var(--tomato-ink)" } }, label),
          hint
            ? h("div", { style: { fontSize: 11.5, color: "var(--tomato-ink-3)", marginTop: 2 } }, hint)
            : null,
        )
      : null,
    h(
      "button",
      {
        type: "button",
        role: "switch",
        "aria-checked": !!checked,
        onClick: () => onChange?.(!checked),
        style: {
          width: 40,
          height: 23,
          borderRadius: 23,
          border: "none",
          cursor: "pointer",
          padding: 2,
          flex: "none",
          background: checked ? "var(--tomato-brand)" : "var(--tomato-surface-3)",
          transition: "background .2s ease",
          display: "flex",
          justifyContent: checked ? "flex-end" : "flex-start",
          alignItems: "center",
        },
      },
      h("span", {
        style: {
          width: 19,
          height: 19,
          borderRadius: "50%",
          background: "#fffdf7",
          boxShadow: "0 1px 3px #00000026",
          transition: "transform .2s ease",
        },
      }),
    ),
  );
}

export function Select({ value, options, onChange, style, width }) {
  return h(
    "select",
    {
      value: value ?? "",
      onChange: (e) => onChange?.(e.target.value),
      className: "t-root t-select",
      style: { height: 32, fontSize: 13, width, ...style },
    },
    options.map((opt) =>
      h("option", { key: String(opt.value), value: opt.value }, opt.label),
    ),
  );
}

/** 对话框：头部 + 可滚动正文 + 底部按钮区。 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  width = 520,
  bodyStyle,
  closeOnMask = true,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && onClose) {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);
  if (!open) return null;
  return h(
    "div",
    {
      className: "t-mask t-root",
      onMouseDown: (e) => {
        if (closeOnMask && e.target === e.currentTarget) onClose?.();
      },
    },
    h(
      "div",
      {
        className: "t-modal",
        style: { width: `min(${width}px, 100%)` },
        role: "dialog",
        "aria-modal": "true",
      },
      h(
        "div",
        { className: "t-modal-head" },
        icon
          ? h(
              "div",
              {
                style: {
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  background: "var(--tomato-brand-soft)",
                  color: "var(--tomato-brand-deep)",
                  display: "grid",
                  placeItems: "center",
                  flex: "none",
                },
              },
              h(Icon, { name: icon, size: 18 }),
            )
          : null,
        h(
          "div",
          { style: { flex: 1, minWidth: 0 } },
          h("div", { style: { fontSize: 16.5, fontWeight: 650, color: "var(--tomato-ink)" } }, title),
          subtitle
            ? h(
                "div",
                { style: { fontSize: 12.5, color: "var(--tomato-ink-3)", marginTop: 4, lineHeight: 1.5 } },
                subtitle,
              )
            : null,
        ),
        onClose ? h(IconBtn, { name: "x", onClick: onClose, title: t("common.close") }) : null,
      ),
      h("div", { className: "t-modal-body t-scroll", style: bodyStyle }, children),
      footer ? h("div", { className: "t-modal-foot" }, footer) : null,
    ),
  );
}

/** 下拉菜单：放在 position:relative 的父容器里，向右/左展开。 */
export function Dropdown({ open, items, onClose, align = "right", width = 200, style }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose]);
  if (!open) return null;
  return h(
    "div",
    {
      ref,
      className: "t-root",
      style: {
        position: "absolute",
        top: "calc(100% + 6px)",
        [align]: 0,
        minWidth: width,
        background: "var(--tomato-surface)",
        border: "1px solid var(--tomato-line)",
        borderRadius: 13,
        boxShadow: "0 18px 40px -20px #3a241580",
        padding: 5,
        zIndex: 30,
        animation: "t-pop .18s ease",
        ...style,
      },
    },
    items.map((item, i) =>
      item.divider
        ? h("div", { key: `d${i}`, style: { height: 1, background: "var(--tomato-line)", margin: "5px 0" } })
        : h(
            "button",
            {
              key: item.id ?? i,
              type: "button",
              className: "t-navitem",
              onClick: () => {
                onClose?.();
                item.onClick?.();
              },
              style: { fontSize: 13, color: item.danger ? "#b8503f" : undefined, padding: "7px 10px" },
            },
            item.icon ? h(Icon, { name: item.icon, size: 15 }) : null,
            item.label,
          ),
    ),
  );
}

export function Empty({ icon = "sparkle", title, hint, action, style }) {
  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "44px 20px",
        color: "var(--tomato-ink-3)",
        textAlign: "center",
        ...style,
      },
    },
    h(
      "div",
      {
        style: {
          width: 46,
          height: 46,
          borderRadius: 15,
          background: "var(--tomato-surface-2)",
          display: "grid",
          placeItems: "center",
          color: "var(--tomato-ink-3)",
          marginBottom: 2,
        },
      },
      h(Icon, { name: icon, size: 22 }),
    ),
    title ? h("div", { style: { fontSize: 14, fontWeight: 600, color: "var(--tomato-ink-2)" } }, title) : null,
    hint ? h("div", { style: { fontSize: 12.5, lineHeight: 1.6, maxWidth: 320 } }, hint) : null,
    action ?? null,
  );
}

export function Skeleton({ w = 120, h: hh = 14, r = 7, style }) {
  return h("div", {
    style: {
      width: w,
      height: hh,
      borderRadius: r,
      background: "linear-gradient(90deg, var(--tomato-surface-2), var(--tomato-surface-3), var(--tomato-surface-2))",
      backgroundSize: "200% 100%",
      animation: "t-shimmer 1.6s linear infinite",
      ...style,
    },
  });
}

/** 数字卡：图标 + 标签 + 大数字 + 单位/补充。 */
export function Stat({ icon, label, value, unit, hint, tone = "brand", style }) {
  const tones = {
    brand: { bg: "var(--tomato-brand-soft)", fg: "var(--tomato-brand-deep)" },
    leaf: { bg: "#7e9a6e1f", fg: "#5f7b50" },
    sun: { bg: "#d5a55322", fg: "#a87b2d" },
    plum: { bg: "#a97c8f1f", fg: "#8f6577" },
  };
  const palette = tones[tone] || tones.brand;
  return h(
    "div",
    {
      className: "t-root t-card",
      style: {
        padding: "18px 20px",
        display: "flex",
        alignItems: "flex-start",
        gap: 13,
        flex: 1,
        minWidth: 0,
        ...style,
      },
    },
    h(
      "div",
      {
        style: {
          width: 38,
          height: 38,
          borderRadius: 12,
          background: palette.bg,
          color: palette.fg,
          display: "grid",
          placeItems: "center",
          flex: "none",
        },
      },
      h(Icon, { name: icon, size: 19 }),
    ),
    h(
      "div",
      { style: { minWidth: 0, flex: 1 } },
      h("div", { style: { fontSize: 11.5, color: "var(--tomato-ink-3)", marginBottom: 3 } }, label),
      h(
        "div",
        { style: { display: "flex", alignItems: "baseline", gap: 4 } },
        h(
          "div",
          {
            className: "t-mono",
            style: { fontSize: 24, fontWeight: 620, color: "var(--tomato-ink)", lineHeight: 1.15 },
          },
          value,
        ),
        unit
          ? h("div", { style: { fontSize: 12, color: "var(--tomato-ink-3)" } }, unit)
          : null,
      ),
      hint ? h("div", { style: { fontSize: 11.5, color: "var(--tomato-ink-3)", marginTop: 3 } }, hint) : null,
    ),
  );
}

/** 页头：eyebrow 小字 + 大标题 + 副标题 + 右侧动作。 */
export function PageHeader({ eyebrow, title, subtitle, actions, style }) {
  return h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "flex-end",
        gap: 16,
        marginBottom: 24,
        flexWrap: "wrap",
        ...style,
      },
    },
    h(
      "div",
      { style: { flex: 1, minWidth: 260 } },
      eyebrow
        ? h(
            "div",
            {
              style: {
                fontSize: 11.5,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--tomato-brand-deep)",
                opacity: 0.75,
                marginBottom: 8,
              },
            },
            eyebrow,
          )
        : null,
      h(
        "h1",
        {
          style: {
            margin: 0,
            fontFamily: "'Noto Serif SC','Songti SC',Georgia,serif",
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: "-.015em",
            color: "var(--tomato-ink)",
            lineHeight: 1.2,
          },
        },
        title,
      ),
      subtitle
        ? h(
            "div",
            { style: { marginTop: 8, fontSize: 13, color: "var(--tomato-ink-2)", lineHeight: 1.6 } },
            subtitle,
          )
        : null,
    ),
    actions ? h("div", { style: { display: "flex", gap: 8, alignItems: "center" } }, actions) : null,
  );
}

export function Divider({ style }) {
  return h("div", { style: { height: 1, background: "var(--tomato-line)", ...style } });
}

/** 圆形勾选：任务完成。 */
export function Check({ checked, onChange, label, disabled = false, style }) {
  return h(
    "button",
    {
      type: "button",
      className: "t-check",
      role: "checkbox",
      "aria-checked": !!checked,
      "aria-label": label,
      "data-checked": !!checked,
      disabled,
      onClick: (e) => {
        e.stopPropagation();
        onChange?.(!checked);
      },
      style,
    },
    checked ? h(Icon, { name: "check", size: 13, stroke: 2.4 }) : null,
  );
}

export function Kbd({ children }) {
  return h("span", { className: "t-kbd" }, children);
}

/** 番茄轮次点阵：完成 N 个实心，当前空心。 */
export function ProgressDots({ total = 4, done = 0, color = "var(--tomato-brand)", size = 8, style }) {
  return h(
    "div",
    { style: { display: "flex", gap: 5, alignItems: "center", ...style } },
    Array.from({ length: total }, (_, i) =>
      h("span", {
        key: i,
        style: {
          width: size,
          height: size,
          borderRadius: "50%",
          background: i < done ? color : "transparent",
          border: `1.4px solid ${i < done ? color : "var(--tomato-line-strong)"}`,
          transition: "background .3s ease",
        },
      }),
    ),
  );
}

// ---------------------------------------------------------------- toast

const toastListeners = new Set();
let toastSeq = 0;
const toastQueue = [];

/** 轻提示：底部居中的一条纸色卡（8s 自动消失，同刻最多 1 条）。 */
export function notify(message, tone = "neutral") {
  const item = { id: ++toastSeq, message, tone };
  toastQueue.push(item);
  for (const fn of Array.from(toastListeners)) fn(toastQueue.slice(-1));
  setTimeout(() => {
    const idx = toastQueue.findIndex((x) => x.id === item.id);
    if (idx >= 0) toastQueue.splice(idx, 1);
    for (const fn of Array.from(toastListeners)) fn(toastQueue.slice(-1));
  }, 3200);
}

export function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const fn = (list) => setItems(list);
    toastListeners.add(fn);
    return () => toastListeners.delete(fn);
  }, []);
  if (items.length === 0) return null;
  const tones = {
    neutral: ["var(--tomato-ink)", "var(--tomato-surface)"],
    brand: ["var(--tomato-brand-deep)", "var(--tomato-brand-soft)"],
    danger: ["#b8503f", "#b8503f18"],
  };
  return h(
    "div",
    {
      className: "t-root",
      style: {
        position: "fixed",
        bottom: 26,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 90,
        pointerEvents: "none",
      },
    },
    items.map((item) => {
      const [fg, bg] = tones[item.tone] || tones.neutral;
      return h(
        "div",
        {
          key: item.id,
          style: {
            background: bg,
            color: fg,
            border: "1px solid var(--tomato-line)",
            borderRadius: 12,
            padding: "9px 16px",
            fontSize: 12.5,
            boxShadow: "0 14px 34px -16px #3a241580",
            animation: "t-soft .3s ease both",
          },
        },
        item.message,
      );
    }),
  );
}
