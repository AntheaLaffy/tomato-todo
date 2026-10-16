import { agentCall, saveAgentFile } from "./api";
import { chatEscape as esc } from "./agent-chat";
import { renderAgentMarkdown } from "./agent-markdown";

export type CanvasSummary = {
  id: string;
  title: string;
  language: string;
  revision: number;
};
type Document = CanvasSummary & {
  content: string;
  currentRevision: number;
  versions: { revision: number; title: string; at: number; source: string }[];
};
type Draft = {
  id: string;
  title: string;
  language: string;
  content: string;
  base: number;
  dirty: boolean;
};
type Hooks = {
  call: (request: Record<string, unknown>) => Promise<unknown>;
  prefill: (text: string) => void;
  toast: (message: string) => void;
  onOpen: () => void;
};
let hooks: Hooks;
let opened = false,
  key = "new",
  summaries: CanvasSummary[] = [],
  busy = false,
  pending = false;
let draft: Draft | null = null,
  document: Document | null = null,
  preview = false,
  serial = 0;
const copies = new Map<string, Draft>();
const selected = new Map<string, string>();
const languages = [
  "markdown",
  "text",
  "html",
  "css",
  "javascript",
  "typescript",
  "python",
  "rust",
  "json",
];
const root = () => window.document.getElementById("agent-canvas");
const draftKey = (id: string) => `${key}/${id}`;
const remember = () => {
  if (draft) {
    copies.set(draftKey(draft.id), { ...draft });
    selected.set(key, draft.id);
  }
};

export function setupCanvas(options: Hooks) {
  hooks = options;
}
export function updateCanvas(
  conversation: string,
  next: CanvasSummary[],
  running: boolean,
) {
  const changed = key !== conversation;
  if (changed) {
    remember();
    serial++;
    key = conversation;
    document = null;
    const id = selected.get(key) ?? next[0]?.id;
    draft = id ? (copies.get(draftKey(id)) ?? null) : null;
  }
  const signature = JSON.stringify(summaries);
  summaries = next;
  busy = running;
  if (
    !pending &&
    draft?.base &&
    !draft.dirty &&
    !next.some((d) => d.id === draft?.id)
  ) {
    copies.delete(draftKey(draft.id));
    selected.delete(key);
    draft = null;
    document = null;
    serial++;
  }
  if (opened && !pending) {
    const id = draft?.id ?? selected.get(key) ?? next[0]?.id;
    const current = next.find((d) => d.id === id);
    if (
      current &&
      (!document ||
        (!draft?.dirty && document.currentRevision !== current.revision))
    )
      void load(current.id, undefined, !!draft?.dirty);
    else if (changed || signature !== JSON.stringify(next)) render();
  }
  root()
    ?.querySelectorAll<HTMLButtonElement>("[data-can-write]")
    .forEach((b) => {
      b.disabled = busy || pending;
    });
}
export function toggleCanvas() {
  opened = !opened;
  if (opened) {
    hooks.onOpen();
    const id = draft?.id ?? selected.get(key) ?? summaries[0]?.id;
    if (id && !draft?.dirty) void load(id);
  }
  render();
}
export function canvasFromMessage(text: string) {
  remember();
  draft = {
    id: crypto.randomUUID(),
    title: "学习笔记",
    language: "markdown",
    content: text,
    base: 0,
    dirty: true,
  };
  document = null;
  preview = false;
  opened = true;
  serial++;
  remember();
  hooks.onOpen();
  render();
}
async function load(id: string, revision?: number, keepDraft = false) {
  const request = ++serial,
    conversation = key;
  const before = draft?.id === id ? { ...draft } : null;
  try {
    const value = await agentCall<Document>({
      op: "canvas_get",
      id,
      ...(revision ? { revision } : {}),
    });
    if (request !== serial || key !== conversation) return;
    document = value;
    const editedWhileLoading =
      before &&
      draft?.id === id &&
      (draft.content !== before.content ||
        draft.title !== before.title ||
        draft.language !== before.language);
    if (!keepDraft && !editedWhileLoading)
      draft = {
        id,
        title: value.title,
        language: value.language,
        content: value.content,
        base: value.currentRevision,
        dirty: false,
      };
    selected.set(key, id);
    render();
  } catch (error) {
    if (request === serial) hooks.toast(String(error));
  }
}
function statusText() {
  if (document && document.revision !== document.currentRevision)
    return `正在查看版本 ${document.revision}`;
  const latest = summaries.find((d) => d.id === draft?.id)?.revision;
  if (draft?.dirty && latest && latest !== draft.base)
    return "文档已有新版本，当前草稿已保留；可另存为新文档";
  return draft?.dirty
    ? "草稿未保存"
    : draft
      ? `已保存 · 版本 ${draft.base}`
      : "";
}
function previewHtml() {
  if (!draft) return "";
  if (draft.language === "markdown")
    return `<div class="agent-markdown">${renderAgentMarkdown(draft.content)}</div>`;
  if (draft.language === "html") {
    // Opaque sandbox origin and a CSP keep a document preview from reading the
    // app, making authenticated requests, or navigating its parent.
    const policy =
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'";
    return `<iframe title="HTML 文档预览" sandbox="allow-scripts" referrerpolicy="no-referrer" srcdoc="${esc(`<!doctype html><meta http-equiv="Content-Security-Policy" content="${policy}">${draft.content}`)}"></iframe>`;
  }
  return `<pre><code>${esc(draft.content)}</code></pre>`;
}
function render() {
  const element = root();
  if (!element) return;
  element.hidden = !opened;
  window.document
    .getElementById("agent-panel")
    ?.classList.toggle("with-canvas", opened);
  window.document
    .querySelector('[data-agent="canvas"]')
    ?.setAttribute("aria-expanded", String(opened));
  if (!opened) return;
  const historical =
    !!document && document.revision !== document.currentRevision;
  const disabled = busy || pending ? "disabled" : "";
  element.innerHTML = `<header><strong>Canvas</strong><button type="button" class="button small" data-canvas="new">新文档</button><button type="button" class="button small" data-canvas="close">回到对话</button></header>
    <select id="canvas-documents" aria-label="选择文档"><option value="">${draft?.base === 0 ? "新文档草稿" : "选择文档"}</option>${summaries.map((d) => `<option value="${esc(d.id)}" ${d.id === draft?.id ? "selected" : ""}>${esc(d.title)}</option>`).join("")}</select>
    ${
      draft
        ? `<input id="canvas-title" maxlength="100" aria-label="文档标题" value="${esc(draft.title)}" ${historical ? "readonly" : ""}>
    <div class="canvas-toolbar"><select id="canvas-language" aria-label="文档格式" ${historical ? "disabled" : ""}>${languages.map((l) => `<option ${l === draft?.language ? "selected" : ""}>${l}</option>`).join("")}</select>
    ${
      document
        ? `<select id="canvas-versions" aria-label="文档版本">${[
            ...document.versions,
          ]
            .reverse()
            .map(
              (v) =>
                `<option value="${v.revision}" ${document?.revision === v.revision ? "selected" : ""}>版本 ${v.revision} · ${v.source === "assistant" ? "助手" : "我"}${v.revision === document?.currentRevision ? " · 最新" : ""}</option>`,
            )
            .join("")}</select>`
        : ""
    }<button type="button" class="button small" data-canvas="preview">${preview ? "编辑" : "预览"}</button></div>
    <div id="canvas-save-status" role="status">${esc(statusText())}</div>
    ${preview ? `<div class="canvas-preview">${previewHtml()}</div>` : `<textarea id="canvas-content" aria-label="文档正文" spellcheck="false" ${historical ? "readonly" : ""}>${esc(draft.content)}</textarea>`}
    <div class="canvas-selection-actions"><button type="button" class="button small" data-canvas="explain">解释选段</button><button type="button" class="button small" data-canvas="rewrite">修改选段</button></div>
    <footer>${historical ? `<button class="button primary small" type="button" data-can-write data-canvas="restore" ${disabled}>恢复为新版本</button>` : `<button class="button primary small" type="button" data-can-write data-canvas="save" ${disabled}>保存</button><button class="button small" type="button" data-can-write data-canvas="save-copy" ${disabled}>另存为新文档</button>`}<button class="button small" type="button" data-canvas="reload">载入最新版本</button><button class="button small" type="button" data-canvas="export">导出</button>${document ? `<button class="button small" type="button" data-can-write data-canvas="delete" ${disabled}>删除文档</button>` : ""}</footer>`
        : `<div class="agent-empty">还没有打开文档。<span data-explanation>在这里编辑笔记、作文或代码。可从助手回答的「打开 Canvas」开始，也可以新建文档。</span></div>`
    }`;
}
async function save(copy = false) {
  if (!draft || pending || busy) return;
  const sent = { ...draft },
    conversation = key;
  const id = copy ? crypto.randomUUID() : sent.id;
  pending = true;
  try {
    const result = await hooks.call({
      op: "canvas_save",
      id,
      baseRevision: copy ? 0 : sent.base,
      title: sent.title,
      language: sent.language,
      content: sent.content,
    });
    if (key === conversation && draft && draft.id === sent.id) {
      const unchanged =
        draft.content === sent.content &&
        draft.title === sent.title &&
        draft.language === sent.language;
      copies.delete(draftKey(sent.id));
      if (unchanged) {
        draft.id = id;
        draft.base =
          (result as { canvases: CanvasSummary[] }).canvases.find(
            (d) => d.id === id,
          )?.revision ?? sent.base;
        draft.dirty = false;
        await load(id);
      } else {
        draft.id = id;
        draft.base =
          (result as { canvases: CanvasSummary[] }).canvases.find(
            (d) => d.id === id,
          )?.revision ?? sent.base;
        remember();
      }
    }
  } finally {
    pending = false;
    render();
  }
}
async function action(name: string) {
  if (name === "close") {
    opened = false;
    remember();
    render();
    return;
  }
  if (name === "new") {
    canvasFromMessage("");
    return;
  }
  if (!draft) return;
  if (name === "save" || name === "save-copy")
    return save(name === "save-copy");
  if (name === "preview") {
    preview = !preview;
    render();
    return;
  }
  if (name === "reload") {
    copies.delete(draftKey(draft.id));
    return load(draft.id);
  }
  if (name === "restore" && document) {
    await hooks.call({
      op: "canvas_restore",
      id: draft.id,
      baseRevision: document.currentRevision,
      revision: document.revision,
    });
    return load(draft.id);
  }
  if (name === "delete") {
    const removed = draft.id;
    await hooks.call({
      op: "canvas_delete",
      id: removed,
      baseRevision: draft.base,
    });
    copies.delete(draftKey(removed));
    if (selected.get(key) === removed) selected.delete(key);
    if (draft?.id === removed) {
      draft = null;
      document = null;
      serial++;
    }
    render();
    return;
  }
  if (name === "export") {
    const extension =
      (
        {
          markdown: "md",
          text: "txt",
          javascript: "js",
          typescript: "ts",
          python: "py",
          rust: "rs",
        } as Record<string, string>
      )[draft.language] ?? draft.language;
    return saveAgentFile(
      draft.content,
      `${draft.title.replace(/[\\/:*?"<>|]/g, "_") || "canvas"}.${extension}`,
      "text/plain;charset=utf-8",
    );
  }
  if (name === "explain" || name === "rewrite") {
    const box =
      window.document.querySelector<HTMLTextAreaElement>("#canvas-content");
    const text = box?.value.slice(box.selectionStart, box.selectionEnd);
    if (!text) throw new Error("请先在编辑区选中一段内容");
    if (draft.dirty || !draft.base)
      throw new Error("请先保存文档，让助手读取同一版本");
    const prompt = `Canvas 文档「${draft.title}」（版本 ${document?.revision ?? draft.base}）的选段：\n\n${text}\n\n${name === "explain" ? "请解释这段内容，不修改文档。" : "请只修改这段内容，保留文档其他部分。先用 get_canvas 列出并读取这份文档的最新内容；若有同名文档，按选段核对，无法确定时先问我。再用 save_canvas 保存。我的具体要求："}`;
    if (prompt.length > 32000) throw new Error("选段太长，请缩小范围");
    hooks.prefill(prompt);
    if (matchMedia("(max-width: 900px)").matches) {
      opened = false;
      render();
    }
  }
}
export function mountCanvas() {
  const element = root();
  if (!element) return;
  element.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;
    if (!draft) return;
    if (input.id === "canvas-title") draft.title = input.value;
    else if (input.id === "canvas-content") draft.content = input.value;
    else return;
    draft.dirty = true;
    remember();
    const status = window.document.getElementById("canvas-save-status");
    if (status) status.textContent = statusText();
  });
  element.addEventListener("change", (event) => {
    const input = event.target as HTMLSelectElement;
    if (input.id === "canvas-language" && draft) {
      draft.language = input.value;
      draft.dirty = true;
      remember();
      return;
    }
    if (input.id === "canvas-documents") {
      remember();
      if (input.value) {
        const saved = copies.get(draftKey(input.value));
        if (saved?.dirty) {
          draft = { ...saved };
          document = null;
          void load(input.value, undefined, true);
        } else void load(input.value);
      }
    }
    if (input.id === "canvas-versions" && document) {
      if (draft?.dirty) {
        input.value = String(document.revision);
        hooks.toast("请先保存草稿或另存为新文档，再查看版本");
        return;
      }
      void load(document.id, Number(input.value));
    }
  });
  element.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "[data-canvas]",
    );
    if (button && !button.disabled)
      void action(button.dataset.canvas!).catch((error) =>
        hooks.toast(String(error)),
      );
  });
  element.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      event.stopPropagation();
      void save().catch((error) => hooks.toast(String(error)));
    }
  });
  render();
}
