// 页面桩：占位页（各页面工作流落地后整个文件被替换）。
//
// 桩页也走真实框架：页头 + 说明 + 一个「功能清单」提示，方便逐步验收，而
// 不是空白页。每个页面的真实实现导出自己的 Page 并 registerPage。
import { h } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import { PageHeader, Empty } from "../shared/ui.js";

/** 生成一个占位页面定义。 */
export function makeStub({
  id,
  order,
  icon,
  titleKey,
  hintKey,
  ns,
  zhTitle,
  enTitle,
}) {
  registerCopy(ns ?? id, {
    zh: {
      title: zhTitle,
      placeholder: "这个页面正在按旧版功能清单补全，稍后就绪。",
      hint: "功能面见 docs/LEGACY_FEATURES.md",
    },
    en: {
      title: enTitle,
      placeholder:
        "This page is being completed against the legacy feature inventory.",
      hint: "See docs/LEGACY_FEATURES.md",
    },
  });
  function Stub() {
    return h(
      "div",
      { className: "t-root" },
      h(PageHeader, {
        eyebrow: "番茄 Todo",
        title: t((ns ?? id) + ".title"),
        subtitle: t("common.loading"),
      }),
      h(
        "div",
        { className: "t-card", style: { padding: 6 } },
        h(Empty, {
          icon,
          title: t((ns ?? id) + ".placeholder"),
          hint: t((ns ?? id) + ".hint"),
        }),
      ),
    );
  }
  return {
    id,
    order,
    icon,
    titleKey: titleKey ?? id + ".title",
    Component: Stub,
  };
}
