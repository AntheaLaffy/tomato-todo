// 资料预览的 Markdown 解析：块级结构与行内语法都是纯函数，直接测。
// 渲染层（Markdown 组件）由 smoke-client 的页面渲染覆盖，不在这里重复。
import test from "node:test";
import assert from "node:assert/strict";

const md = await import("../plugin/src/client/shared/markdown.js");

test("块级：标题 / 表格 / 列表 / 代码围栏 / 引用 / 分隔线", () => {
  const blocks = md.parseMarkdown(
    [
      "# 大标题",
      "",
      "| 序号 | 课程 | 时长 |",
      "| --- | --- | --- |",
      "| 1 | 词汇串讲 U8-1 | 0:55:06 |",
      "",
      "- 第一项",
      "- 第二项",
      "",
      "1. 有序一",
      "2. 有序二",
      "",
      "```sh",
      "echo hi",
      "```",
      "",
      "> 引用一句",
      "",
      "---",
    ].join("\n"),
  );
  assert.deepEqual(
    blocks.map((b) => b.type),
    ["heading", "table", "list", "list", "code", "quote", "hr"],
  );
  assert.deepEqual(blocks[1].header, ["序号", "课程", "时长"]);
  assert.deepEqual(blocks[1].rows, [["1", "词汇串讲 U8-1", "0:55:06"]]);
  assert.equal(blocks[2].ordered, false);
  assert.deepEqual(blocks[2].items, ["第一项", "第二项"]);
  assert.equal(blocks[3].ordered, true);
  assert.equal(blocks[4].text, "echo hi");
});

test("段落里的换行保留（课程目录常常一句一行）", () => {
  const blocks = md.parseMarkdown("老师：董仲鑫\n模块：词汇加强\n合计 1:52:08");
  assert.equal(blocks.length, 1);
  assert.deepEqual(blocks[0].lines, [
    "老师：董仲鑫",
    "模块：词汇加强",
    "合计 1:52:08",
  ]);
});

test("行内：粗体 / 斜体 / 代码 / 链接；不安全链接只保留文字", () => {
  assert.deepEqual(md.parseInline("**粗** *斜* `code`"), [
    { type: "strong", text: "粗" },
    { type: "text", text: " " },
    { type: "em", text: "斜" },
    { type: "text", text: " " },
    { type: "code", text: "code" },
  ]);
  const [link] = md.parseInline("[文档](https://example.com/a)");
  assert.equal(link.href, "https://example.com/a");
  const [bad] = md.parseInline("[点我](javascript:alert(1))");
  assert.equal(bad.href, null);
});

test("不解析原始 HTML：标签按文本处理", () => {
  const blocks = md.parseMarkdown("<script>alert(1)</script>");
  assert.equal(blocks[0].type, "paragraph");
  const [first] = md.parseInline(blocks[0].lines[0]);
  assert.equal(first.text, "<script>alert(1)</script>");
  assert.equal(first.type, "text");
});
