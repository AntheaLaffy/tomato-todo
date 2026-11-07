// DSH 侧栏的原生 panel 图标；按钮、选中态和导航由 sidebar.panellist 管理。
import { h } from "../runtime.js";
import { registerCopy } from "../shared/copy.js";
import { Icon } from "../shared/icons.js";

registerCopy("side", {
  zh: { label: "番茄 Todo", open: "打开番茄 Todo 主视图" },
  en: { label: "Tomato Todo", open: "Open the Tomato Todo view" },
});

export function SidebarTomatoIcon({ size = 18, active = false }) {
  return h(Icon, {
    name: "tomato",
    size,
    stroke: 1.5,
    style: {
      color: active ? "var(--tomato-brand-deep)" : "var(--tomato-brand)",
    },
  });
}
