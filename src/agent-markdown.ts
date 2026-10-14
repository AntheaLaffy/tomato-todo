import { Marked, type Tokens } from "marked";
import DOMPurify from "dompurify";
import katex from "katex";
import "katex/dist/katex.min.css";

const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const mathHtml = (text: string, displayMode: boolean) =>
  katex.renderToString(text, {
    displayMode,
    throwOnError: false,
    trust: false,
    strict: "ignore",
    maxSize: 20,
    maxExpand: 1000,
  });
const markdown = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    // Raw HTML can impersonate the application's own buttons and fields, even
    // when it contains no script. Treat it as text before sanitizing the result.
    html({ text }) {
      return escape(text);
    },
    code({ text, lang }: Tokens.Code) {
      return `<div class="agent-code"><div class="agent-code-head"><span>${escape(lang?.split(/\s/)[0] || "代码")}</span><button type="button" data-agent="copy-code">复制代码</button></div><pre><code>${escape(text)}</code></pre></div>`;
    },
    link({ href, tokens }) {
      const label = this.parser.parseInline(tokens);
      if (!/^(https?:\/\/|mailto:)/i.test(href)) return label;
      return `<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    },
    image({ text }) {
      return `<span>${escape(text)}</span>`;
    },
  },
  extensions: [
    {
      name: "mathBlock",
      level: "block",
      start: (src) => src.search(/\$\$|\\\[/),
      tokenizer(src) {
        const match = /^(?:\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\])(?:\n|$)/.exec(
          src,
        );
        if (match)
          return {
            type: "mathBlock",
            raw: match[0],
            text: match[1] ?? match[2],
          };
      },
      renderer: (token) => mathHtml(token.text, true),
    },
    {
      name: "mathInline",
      level: "inline",
      start: (src) => src.search(/\$|\\\(/),
      tokenizer(src) {
        const match = /^(?:\$(?!\$)([^$\n]+?)\$(?!\d)|\\\((.+?)\\\))/.exec(src);
        if (match && !/^\d+[.,\d ]*$/.test(match[1] ?? ""))
          return {
            type: "mathInline",
            raw: match[0],
            text: match[1] ?? match[2],
          };
      },
      renderer: (token) => mathHtml(token.text, false),
    },
  ],
});
const cache = new Map<string, string>();
export function renderAgentMarkdown(text: string): string {
  const saved = cache.get(text);
  if (saved !== undefined) return saved;
  const html = DOMPurify.sanitize(markdown.parse(text, { async: false }), {
    ADD_ATTR: ["target"],
    FORBID_TAGS: ["img", "form", "input", "iframe", "object", "embed"],
  });
  if (cache.size >= 150) cache.delete(cache.keys().next().value!);
  cache.set(text, html);
  return html;
}
