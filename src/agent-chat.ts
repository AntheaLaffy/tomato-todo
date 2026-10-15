import { renderAgentMarkdown } from "./agent-markdown";

export type ChatAttachment = {
  id: string;
  name: string;
  mimeType: string;
  bytes: number;
  preview?: string;
};
export type ChatMessage = {
  id: string;
  role: string;
  text: string;
  automatic: boolean;
  at: number;
  entryId?: string | null;
  attachments?: ChatAttachment[];
  stopped?: boolean;
  thinking?: string;
};
export type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
  active: boolean;
  pinned?: boolean;
  archived?: boolean;
  branchedFrom?: { conversationId: string; messageId: string } | null;
  snippet?: string;
  messageId?: string;
};
export const chatEscape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const fileSize = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${Math.ceil(bytes / 1024)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
export function attachmentHtml(
  files: ChatAttachment[],
  removable = false,
): string {
  return files
    .map(
      (a) =>
        `<div class="agent-attachment"><button type="button" data-agent="${a.mimeType.startsWith("image/") ? "view-image" : "download-attachment"}" data-id="${chatEscape(a.id)}" title="${a.mimeType.startsWith("image/") ? "预览" : "下载"} ${chatEscape(a.name)}">${a.preview ? `<img class="agent-attachment-preview" src="${chatEscape(a.preview)}" alt="${chatEscape(a.name)}">` : a.mimeType.startsWith("image/") ? `<img class="agent-attachment-preview" data-image-id="${chatEscape(a.id)}" alt="${chatEscape(a.name)}">` : `<span aria-hidden="true">▤</span>`}<span><b>${chatEscape(a.name)}</b><small>${fileSize(a.bytes)}</small></span></button>${removable ? `<button type="button" class="icon-btn tiny" data-agent="remove-attachment" data-id="${chatEscape(a.id)}" aria-label="移除 ${chatEscape(a.name)}">✕</button>` : ""}</div>`,
    )
    .join("");
}
export function messageHtml(
  m: ChatMessage,
  busy: boolean,
  editing: { id: string; text: string } | null,
  thinkingOpen = false,
): string {
  const esc = chatEscape;
  const user = m.role === "user";
  const text =
    user && m.automatic ? "本地发现学习安排信号，已请助手核实。" : m.text;
  const editable = user && !m.automatic && m.entryId;
  const body =
    editing?.id === m.id
      ? `<form class="agent-message-edit" data-edit-message="${esc(m.id)}"><textarea name="text" rows="4" maxlength="32000" required aria-label="编辑消息">${esc(editing.text)}</textarea><small>发送后会创建新分支，保留原对话和附件。</small><div><button class="button small" type="button" data-agent="cancel-edit-message">取消</button><button class="button primary small" type="submit" ${busy ? "disabled" : ""}>保存并发送</button></div></form>`
      : user
        ? `<p class="agent-user-text">${esc(text)}</p>`
        : `<div class="agent-markdown">${renderAgentMarkdown(text)}</div>`;
  return `<article class="agent-message ${user ? "user" : "assistant"}" data-message-id="${esc(m.id)}"><div class="agent-message-head">${user ? (m.automatic ? "自动" : "我") : "助手"}<time>${new Date(m.at * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time>${m.stopped ? '<span class="agent-stopped">已停止</span>' : ""}</div>${!user ? thinkingHtml(m.thinking, m.id, thinkingOpen) : ""}${body}${m.attachments?.length ? `<div class="agent-attachments">${attachmentHtml(m.attachments)}</div>` : ""}<div class="agent-message-actions"><button type="button" data-agent="copy-message" data-id="${esc(m.id)}">复制</button>${!user ? `<button type="button" data-agent="open-canvas-message" data-id="${esc(m.id)}">打开 Canvas</button><button type="button" data-agent="quote-message" data-id="${esc(m.id)}">引用</button>` : ""}${editable ? `<button type="button" data-agent="edit-message" data-id="${esc(m.id)}" ${busy ? "disabled" : ""}>编辑</button>` : ""}${!user && !m.automatic && m.entryId ? `<button type="button" data-agent="retry-message" data-id="${esc(m.id)}" ${busy ? "disabled" : ""}>重新生成</button>` : ""}${m.entryId ? `<button type="button" data-agent="branch-message" data-id="${esc(m.id)}" ${busy ? "disabled" : ""}>新分支</button>` : ""}</div></article>`;
}
export function thinkingHtml(
  text: string | undefined,
  id: string,
  open = false,
): string {
  return text
    ? `<details class="agent-reasoning" data-thinking-id="${chatEscape(id)}" ${open ? "open" : ""}><summary>思考过程<span>模型提供</span></summary><div class="agent-reasoning-text">${chatEscape(text)}</div></details>`
    : "";
}
export async function fileBase64(file: File): Promise<string> {
  if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name} 超过 8 MB`);
  if (file.type.startsWith("image/") && file.size > 4 * 1024 * 1024)
    throw new Error("单张图片最多 4 MB");
  if (
    file.type.startsWith("image/") &&
    !["image/png", "image/jpeg", "image/webp"].includes(file.type)
  )
    throw new Error("图片支持 PNG、JPEG 和 WebP");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`无法读取 ${file.name}`));
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.readAsDataURL(file);
  });
}
export async function copyChatText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      /* WebKit may require the legacy gesture path. */
    }
  }
  const previous = document.activeElement as HTMLElement | null;
  const field = document.createElement("textarea");
  field.value = text;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  previous?.focus();
  if (!copied) throw new Error("复制失败，请选中文字复制");
}
