// 轻量 Markdown：把纯文本资料渲染成 React 元素，不引第三方解析器。
//
// 为什么要自己写：预览里最常见的资料是 .md（课程目录、讲义提纲），旧实现
// 直接把文件塞进 iframe，浏览器按纯文本显示——表格挤成一行、标题没有层级。
// 引一个完整 CommonMark 实现（markdown-it 等）会给插件包加几十 KiB，并且要
// 处理它的 HTML 开关；这里只覆盖资料里真实会出现的语法，并且**不解析内联
// HTML**（原始 HTML 一律当文本转义），避免把用户文件里的标签当代码执行。
//
// 解析与渲染分开：`parseMarkdown()` 是纯函数（可单测），`Markdown` 只负责把
// 块映射成元素。

import { h } from "../runtime.js";

const SAFE_LINK = /^(https?:\/\/|mailto:|#|\/)/i;

/** 行内语法：**粗体**、*斜体*、`代码`、[文字](链接)。 */
export function parseInline(text) {
  const out = [];
  let rest = String(text ?? "");
  const pattern =
    /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))/;
  while (rest !== "") {
    const match = pattern.exec(rest);
    if (!match) {
      out.push({ type: "text", text: rest });
      break;
    }
    if (match.index > 0) {
      out.push({ type: "text", text: rest.slice(0, match.index) });
    }
    if (match[1]) out.push({ type: "strong", text: match[2] });
    else if (match[3]) out.push({ type: "em", text: match[4] });
    else if (match[5]) out.push({ type: "code", text: match[6] });
    else if (match[7]) {
      out.push({
        type: "link",
        text: match[8],
        href: SAFE_LINK.test(match[9]) ? match[9] : null,
      });
    }
    rest = rest.slice(match.index + match[0].length);
  }
  return out;
}

const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/;

function splitRow(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

/**
 * 把 Markdown 解析成块列表。
 *
 * 支持：标题、围栏代码、GFM 表格、无序/有序列表、引用、分隔线、段落；
 * 段落内单个换行保留为换行（资料里的「课程目录」经常一句一行）。
 */
export function parseMarkdown(text) {
  const lines = String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  const blocks = [];
  let index = 0;

  const pushParagraph = (buffer) => {
    if (buffer.length === 0) return;
    blocks.push({ type: "paragraph", lines: buffer.slice() });
    buffer.length = 0;
  };

  const paragraph = [];
  while (index < lines.length) {
    const line = lines[index];

    if (/^\s*```/.test(line)) {
      pushParagraph(paragraph);
      const lang = line.replace(/^\s*```/, "").trim();
      const body = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", lang, text: body.join("\n") });
      continue;
    }

    if (line.trim() === "") {
      pushParagraph(paragraph);
      index += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      pushParagraph(paragraph);
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2].trim(),
      });
      index += 1;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      pushParagraph(paragraph);
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }

    // 表格：表头行 + 分隔行 + 若干数据行
    if (
      line.includes("|") &&
      index + 1 < lines.length &&
      TABLE_DIVIDER.test(lines[index + 1])
    ) {
      pushParagraph(paragraph);
      const header = splitRow(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].includes("|")) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      pushParagraph(paragraph);
      const quoted = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quoted.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", lines: quoted });
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ordered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (bullet || ordered) {
      pushParagraph(paragraph);
      const start = ordered ? Number(ordered[1]) : null;
      const items = [];
      while (index < lines.length) {
        const b = /^\s*[-*+]\s+(.*)$/.exec(lines[index]);
        const o = /^\s*(\d+)[.)]\s+(.*)$/.exec(lines[index]);
        if (b) items.push(b[1]);
        else if (o) items.push(o[2]);
        else break;
        index += 1;
      }
      blocks.push({ type: "list", ordered: start !== null, start, items });
      continue;
    }

    paragraph.push(line);
    index += 1;
  }
  pushParagraph(paragraph);
  return blocks;
}

function inlineNodes(text) {
  return parseInline(text).map((node, i) => {
    switch (node.type) {
      case "strong":
        return h("strong", { key: i }, node.text);
      case "em":
        return h("em", { key: i }, node.text);
      case "code":
        return h(
          "code",
          {
            key: i,
            style: {
              padding: "1px 5px",
              borderRadius: 5,
              background: "var(--tomato-surface-2)",
              fontSize: "0.92em",
            },
          },
          node.text,
        );
      case "link":
        return node.href
          ? h(
              "a",
              {
                key: i,
                href: node.href,
                target: "_blank",
                rel: "noreferrer",
                style: { color: "var(--tomato-brand-deep)" },
              },
              node.text,
            )
          : h("span", { key: i }, node.text);
      default:
        return node.text;
    }
  });
}

const HEADING_SIZE = { 1: 19, 2: 16.5, 3: 15, 4: 13.5, 5: 13, 6: 12.5 };

function tableCellStyle(header) {
  return {
    padding: "6px 10px",
    borderBottom: "1px solid var(--tomato-line)",
    textAlign: "left",
    fontSize: 12.5,
    fontWeight: header ? 600 : 400,
    color: header ? "var(--tomato-ink)" : "var(--tomato-ink-2)",
    verticalAlign: "top",
  };
}

/** 渲染解析好的块。资料预览与 README 展示共用同一套排版。 */
export function Markdown({ text, style }) {
  const blocks = parseMarkdown(text);
  return h(
    "div",
    {
      style: {
        fontSize: 13,
        lineHeight: 1.75,
        color: "var(--tomato-ink)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        ...style,
      },
    },
    blocks.map((block, i) => {
      switch (block.type) {
        case "heading":
          return h(
            "div",
            {
              key: i,
              style: {
                fontSize: HEADING_SIZE[block.level] ?? 13,
                fontWeight: 650,
                marginTop: block.level <= 2 ? 8 : 4,
              },
            },
            inlineNodes(block.text),
          );
        case "code":
          return h(
            "pre",
            {
              key: i,
              style: {
                margin: 0,
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--tomato-surface-2)",
                overflow: "auto",
                fontSize: 12,
                lineHeight: 1.6,
              },
            },
            h("code", null, block.text),
          );
        case "table":
          return h(
            "div",
            { key: i, style: { overflowX: "auto" } },
            h(
              "table",
              {
                style: {
                  borderCollapse: "collapse",
                  width: "100%",
                  background: "var(--tomato-surface)",
                },
              },
              h(
                "thead",
                null,
                h(
                  "tr",
                  null,
                  block.header.map((cell, c) =>
                    h(
                      "th",
                      { key: c, style: tableCellStyle(true) },
                      inlineNodes(cell),
                    ),
                  ),
                ),
              ),
              h(
                "tbody",
                null,
                block.rows.map((row, r) =>
                  h(
                    "tr",
                    { key: r },
                    row.map((cell, c) =>
                      h(
                        "td",
                        { key: c, style: tableCellStyle(false) },
                        inlineNodes(cell),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        case "quote":
          return h(
            "div",
            {
              key: i,
              style: {
                padding: "6px 12px",
                borderLeft: "3px solid var(--tomato-line)",
                color: "var(--tomato-ink-2)",
              },
            },
            inlineNodes(block.lines.join(" ")),
          );
        case "list":
          return h(
            block.ordered ? "ol" : "ul",
            {
              key: i,
              style: {
                margin: 0,
                paddingLeft: 22,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              },
            },
            block.items.map((item, li) =>
              h("li", { key: li }, inlineNodes(item)),
            ),
          );
        case "hr":
          return h("hr", {
            key: i,
            style: {
              border: "none",
              borderTop: "1px solid var(--tomato-line)",
              margin: "4px 0",
            },
          });
        default:
          return h(
            "div",
            { key: i, style: { whiteSpace: "pre-wrap" } },
            block.lines.map((line, li) =>
              h("div", { key: li }, inlineNodes(line)),
            ),
          );
      }
    }),
  );
}
