// 对话框的 SSR 退化：拿不到 react-dom（无浏览器冒烟 / 服务端渲染）时，
// Modal 必须退回内联节点而不是抛错——冒烟靠这条路径把九个页面渲染成字符串。
//
// 浏览器里走的是 createPortal(…, document.body)：DSH 的内容列在可滚动容器里，
// 祖先的 animation（fill-mode:both 的 transform 关键帧）会把 position:fixed 的
// 包含块变成内容列，于是遮罩只盖内容、对话框在页面中段偏下。挂到 body 后
// 遮罩覆盖整屏、对话框在视口居中（几何对照见运行记录）。
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(join(root, "package.json"));
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const runtime = await import("../plugin/src/client/runtime.js");
runtime.installRuntime((name) => {
  if (name === "react") return React;
  throw new Error("无 " + name + "（模拟 SSR/冒烟环境）");
});

const { Modal } = await import("../plugin/src/client/shared/ui.js");

test("没有 react-dom 时对话框退回内联渲染，不抛错", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      Modal,
      { open: true, title: "直接创建实例", subtitle: "写下想完成的一件事", onClose() {} },
      React.createElement("div", null, "表单内容"),
    ),
  );
  assert.ok(html.includes('class="t-mask t-root"'), "缺少遮罩");
  assert.ok(html.includes('role="dialog"'));
  assert.ok(html.includes("直接创建实例"));
  assert.ok(html.includes("表单内容"));
});

test("open 为 false 时不渲染任何东西", () => {
  const html = renderToStaticMarkup(React.createElement(Modal, { open: false, title: "x" }, "y"));
  assert.equal(html, "");
});
