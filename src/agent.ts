import { agentCall, desktop, openAgentLogin, saveAgentFile } from "./api";
import type { Snapshot } from "./types";
import { runHandScript } from "./hand";
import type { HandStep } from "./hand";
import { renderAgentMarkdown } from "./agent-markdown";
import {
  setupCanvas,
  mountCanvas,
  updateCanvas,
  toggleCanvas,
  canvasFromMessage,
  type CanvasSummary,
} from "./agent-canvas";
import { hydrateAgentImages, previewAgentImage } from "./agent-media";
import { playCreatorEntrance, type CreatorEntrance } from "./agent-creator";
import { captureScroll, restoreScroll } from "./scroll";
import {
  attachmentHtml,
  messageHtml,
  thinkingHtml,
  fileBase64,
  copyChatText,
} from "./agent-chat";
import type {
  ChatAttachment,
  ChatMessage,
  ConversationSummary,
} from "./agent-chat";

type ThinkingLevel =
  "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
type Preferences = {
  enabled: boolean;
  automatic: boolean;
  provider: string;
  model: string;
  thinkingLevel: ThinkingLevel;
  dailyCapacityMinutes: number | null;
  maxAutoWakesPerDay: number;
  cooldownHours: number;
  quietStart: string;
  quietEnd: string;
  codingAccess: string;
};
type Memory = {
  id: string;
  text: string;
  kind: string;
  source: string;
  confirmed: boolean;
};
type Persona = {
  id: string;
  name: string;
  emoji: string;
  summary: string;
  identity: string;
  style: string;
  shadow: string;
  awaken: string;
  fantasy: string;
  greeting: string;
  builtin: boolean;
  current: boolean;
};
export type AgentStatus = {
  creatorMode?: boolean;
  creatorEntrance?: CreatorEntrance | null;
  preferences: Preferences;
  personas?: Persona[];
  persona?: string;
  memories: Memory[];
  messages: ChatMessage[];
  busy: boolean;
  authenticating: boolean;
  stream: string;
  thinking?: string;
  generated?: ChatAttachment[];
  canvases?: CanvasSummary[];
  error: string | null;
  tool: string;
  wakeSerial: number;
  providers: Record<
    string,
    {
      configured: boolean;
      models: { id: string; name: string; vision?: boolean }[];
    }
  > | null;
  authEvent: {
    type?: string;
    url?: string;
    message?: string;
    instructions?: string;
    userCode?: string;
    verificationUri?: string;
    promptType?: string;
    placeholder?: string;
  };
  anomalies: {
    key: string;
    title: string;
    question: string;
    evidence: unknown;
  }[];
  conversations: ConversationSummary[];
  questions: {
    id: string;
    header: string;
    question: string;
    detail?: string;
    multiSelect?: boolean;
    intent?: { kind: "plan-review"; approve: string };
    options: { label: string; description: string }[];
  }[];
  plan: { step: string; status: string }[];
  /** 助手排的演示脚本；界面按 serial 演一次。 */
  hand: {
    serial: number;
    at: number;
    label?: string;
    steps: HandStep[];
  } | null;
  /** 用户排定的定时任务：到点让助手去做。 */
  schedules: {
    id: string;
    name: string;
    at: string;
    repeat: string;
    instruction: string;
    remindMinutes: number;
    lockBeforeMinutes: number;
    enabled: boolean;
    firedAt: number | null;
  }[];
  /** 助手这一轮改了什么；界面按 serial 演一遍，让用户看见改动落在哪儿。 */
  deeds: {
    serial: number;
    at: number;
    items: { text: string; selector?: string }[];
  } | null;
  dataDir: string;
  mcpConfig: unknown;
};
const defaults: Preferences = {
  enabled: false,
  automatic: true,
  provider: "deepseek",
  model: "",
  thinkingLevel: "medium",
  dailyCapacityMinutes: null,
  maxAutoWakesPerDay: 3,
  cooldownHours: 24,
  quietStart: "22:00",
  quietEnd: "08:00",
  codingAccess: "workspace",
};
let status: AgentStatus | null = null;
let draft = "";
let attachments: ChatAttachment[] = [];
let uploading = 0;
let requestPending = false;
let statusRevision = 0;
let conversationKey = "new";
const conversationDrafts = new Map<
  string,
  { text: string; attachments: ChatAttachment[] }
>();
let visibleMessages = 60;
let revealLatest = true;
let editingMessage: { id: string; text: string } | null = null;
const expandedThinking = new Set<string>();
let searchQuery = "";
let showArchived = false;
let searchResults: ConversationSummary[] | null = null;
let searchTimer: ReturnType<typeof setTimeout>;
let searchSerial = 0;
let searchSignature = "";
let renaming: { id: string; title: string } | null = null;
let memoryDraft = "";
let configDraft: Record<string, string | boolean> = {};
const memoryEdits: Record<string, string> = {};
/** Multi-select drafts, keyed by question id; cleared when the questions change. */
const answers: Record<string, string[]> = {};
let questionsSignature = "";
let handSerial = 0;
/** 正在编辑的定时任务 id；null 表示新建。 */
let editingSchedule: string | null = null;
/** 正在编辑的人格 id；null 表示新建。 */
let editingPersona: string | null = null;
let personaDraft: Record<string, string> = {};
let deedsSerial = 0;
const rendered = new Map<string, { element: HTMLElement; html: string }>();
let refreshing = false;
let serial = 0;
let sheet: "settings" | "memory" | "signals" | "schedules" | "personas" | null =
  null;
let openedAuthUrl = "";
type Usage = {
  deepseek?: {
    available?: boolean;
    balances?: {
      currency: string;
      total_balance: string;
      granted_balance?: string;
      topped_up_balance?: string;
    }[];
    error?: string;
  };
  codex?: Record<string, unknown> & { error?: string };
};
let usage: Usage | null = null;
let usageLoading = false;
let hooks: {
  active: () => boolean;
  wake: () => void;
  toast: (text: string) => void;
  accept: (s: Snapshot) => void;
  backdrop: () => boolean;
};
const esc = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const pretty = (value: unknown) => JSON.stringify(value, null, 2) ?? "—";
const field = (name: string, fallback: string | boolean) =>
  configDraft[name] ?? fallback;
const pfield = (name: string, fallback: string) =>
  personaDraft[name] ?? fallback;
const builtinPortraits = new Map([
  ["default", "/personas/default.webp"],
  ["calm", "/personas/calm.webp"],
  ["coach", "/personas/coach.webp"],
  ["senpai", "/personas/senpai.webp"],
]);
const builtinIllustrations = new Map([
  ["default", "/personas/atri.png"],
  ["calm", "/personas/natsuki.png"],
  ["coach", "/personas/ryuji.png"],
  ["senpai", "/personas/minamo.png"],
]);
export function syncPersonaBackdrop(enabled: boolean) {
  const element = document.getElementById("persona-backdrop");
  if (!element) return;
  const persona = status?.personas?.find((p) => p.current);
  const illustration = persona?.builtin
    ? builtinIllustrations.get(persona.id)
    : undefined;
  element.hidden = !enabled || !illustration;
  document.documentElement.toggleAttribute(
    "data-persona-backdrop",
    !element.hidden,
  );
  if (element.hidden) {
    element.replaceChildren();
  } else if (element.firstElementChild?.getAttribute("src") !== illustration) {
    const img = document.createElement("img");
    img.src = illustration!;
    img.alt = "";
    img.draggable = false;
    element.replaceChildren(img);
  }
}
function personaAvatar(persona: Persona): string {
  const portrait = persona.builtin
    ? builtinPortraits.get(persona.id)
    : undefined;
  return `<span class="agent-persona-avatar" aria-hidden="true">${portrait ? `<img src="${portrait}" alt="" width="72" height="72" draggable="false">` : esc(persona.emoji || "🎭")}</span>`;
}
function personaIllustration(persona: Persona): string {
  const illustration = persona.builtin
    ? builtinIllustrations.get(persona.id)
    : undefined;
  return illustration
    ? `<details class="editor-details agent-persona-art" data-keep-open="persona-art:${esc(persona.id)}"><summary>查看完整立绘</summary><img src="${illustration}" alt="${esc(persona.name)}的全身立绘" loading="lazy" draggable="false"></details>`
    : "";
}
const checked = (name: string, fallback: boolean) =>
  field(name, fallback) ? "checked" : "";

// The conversation page stays a conversation: connection, keys, memory
// and signals live in sheets that open on demand.
/** Put text in the composer from elsewhere in the app (e.g. "hand me the timetable"). */
export function prefillAgent(text: string) {
  draft = text;
  const box = document.getElementById(
    "agent-text",
  ) as HTMLTextAreaElement | null;
  if (box) box.value = text;
  resizeComposer();
}
function resizeComposer() {
  const box = document.querySelector<HTMLTextAreaElement>("#agent-text");
  if (!box) return;
  box.style.height = "auto";
  const height = Math.min(box.scrollHeight, 220);
  box.style.height = `${height}px`;
  box.style.overflowY = box.scrollHeight > height ? "auto" : "hidden";
}
function focusComposer() {
  const box = document.querySelector<HTMLTextAreaElement>("#agent-text");
  box?.focus();
  box?.setSelectionRange(box.value.length, box.value.length);
  resizeComposer();
}
function focusSearch() {
  sessionsOpen = true;
  sheet = null;
  renderSheet();
  renderSessions();
  document.querySelector<HTMLInputElement>("#agent-history-search")?.focus();
}
function emptyChatHtml() {
  const connected =
    status?.providers?.[status.preferences.provider]?.configured;
  return `<div class="agent-welcome"><span class="agent-welcome-mark" aria-hidden="true">✳</span><h2>今天想一起学点什么？</h2><p data-explanation>梳理计划、理解难点，或带上资料一起讨论。</p>${
    connected
      ? `<div class="agent-starters">${[
          ["梳理今天的安排", "看看我今天的任务和可用时间，帮我安排学习顺序。"],
          ["讲懂一个难点", "我想弄懂一个知识点，请先问我在学什么、卡在哪里。"],
          [
            "一起分析资料",
            "我想分析学习资料，请先问我想解决的问题，我会把资料发给你。",
          ],
          [
            "回顾最近的学习",
            "看看我最近的学习记录，帮我找出一个可以改善的地方。",
          ],
        ]
          .map(
            ([title, prompt]) =>
              `<button type="button" data-agent="starter" data-text="${esc(prompt)}">${title}<span aria-hidden="true">↗</span></button>`,
          )
          .join("")}</div>`
      : `<button class="button primary" type="button" data-agent="settings">连接模型，开始对话</button>`
  }</div>`;
}
export function agentPage(): string {
  const signals = status?.anomalies.length ?? 0;
  const badge = (count: number) => (count ? `<b>${count}</b>` : "");
  return `<div id="agent-root"><div class="page-heading agent-page-heading"><div><h1>学习助手</h1></div><div class="agent-topbar">
    <button class="button small" data-agent="memory">记忆</button>
    <button class="button small" data-agent="schedules">定时${badge(status?.schedules?.length ?? 0)}</button>
    <button class="button small" data-agent="signals">信号${badge(signals)}</button>
    <button class="button small" data-agent="conversations" aria-controls="agent-sessions" aria-expanded="${sessionsOpen}">会话</button>
    <button class="button small" data-agent="search-conversations" title="搜索对话（Ctrl / ⌘ + K）">搜索</button>
    <button class="button small" data-agent="export-conversation">导出对话</button>
    <button class="button small" data-agent="settings">设置</button>
    <button class="button small" data-agent="canvas" aria-controls="agent-canvas" aria-expanded="false">Canvas</button>
    <button class="button small" data-agent="imagegen" title="仅 Codex 账号支持，使用 Codex 用量">生成图片</button>
    <button class="button small" data-agent="new">新对话</button>
  </div></div>
  <div id="agent-panel" class="agent-layout">
    <aside id="agent-sessions" class="agent-sessions" hidden></aside>
    <section class="card agent-conversation">
      <div id="agent-conversation-title" class="agent-conversation-title"></div>
      <div id="agent-run-status" role="status"></div>
      <div id="agent-branch-source"></div>
      <div id="agent-messages" class="agent-messages" aria-live="polite"></div>
      <button type="button" class="button small agent-jump-latest" data-agent="latest-message" hidden>↓ 回到最新消息</button>
      <div id="agent-plan"></div>
      <div id="agent-questions"></div>
      <form id="agent-chat">
        <div id="agent-attachments" class="agent-attachments"></div>
        <input id="agent-attachment-input" type="file" multiple hidden aria-label="选择附件">
        <textarea id="agent-text" name="text" rows="1" maxlength="32000" placeholder="问点什么，也可以拖入文件或粘贴图片" aria-label="给助手发送消息">${esc(draft)}</textarea>
        <div class="agent-composer-hint"><span data-explanation>Enter 发送 · Shift + Enter 换行</span><span id="agent-upload-status" role="status"></span></div>
        <div class="agent-actions"><button type="button" class="button small" data-agent="attach" aria-label="添加附件">＋ 附件</button><span class="agent-status"><span class="agent-model" id="agent-model">${modelSelectHtml()}</span><span class="agent-thinking" id="agent-thinking">${thinkingSelectHtml()}</span><span class="agent-usage" id="agent-usage">${usageHtml()}</span></span><button type="button" class="button" data-agent="cancel">停止</button><button class="button primary" type="submit">发送</button></div>
      </form>
    </section>
    <aside id="agent-canvas" class="agent-canvas" hidden aria-label="Canvas 文档工作区"></aside>
    <div id="agent-sheet" class="agent-sheet" hidden></div>
  </div></div>`;
}
function replace(id: string, html: string) {
  const element = document.getElementById(id);
  if (
    element &&
    (rendered.get(id)?.element !== element || rendered.get(id)?.html !== html)
  ) {
    element.innerHTML = html;
    rendered.set(id, { element, html });
  }
}
function updateLatestButton() {
  const list = document.getElementById("agent-messages");
  document
    .querySelector<HTMLButtonElement>('[data-agent="latest-message"]')
    ?.toggleAttribute(
      "hidden",
      !list || list.scrollHeight - list.scrollTop - list.clientHeight < 90,
    );
}
function renderChat() {
  if (!status) return;
  const busy = status.busy || requestPending;
  replace(
    "agent-run-status",
    `<div class="agent-state ${status.error ? "error" : status.busy ? "busy" : ""}">${status.busy ? `<i class="agent-spinner"></i>${esc(status.authenticating ? "正在登录…" : status.tool ? `正在调用：${status.tool}` : "正在分析…")}` : status.error ? esc(status.error) : "准备好了"}</div>`,
  );
  const current = status.conversations.find((c) => c.active);
  const currentPersona = status.personas?.find((p) => p.current);
  replace(
    "agent-conversation-title",
    `<span title="${esc(current?.title ?? "新对话")}">${esc(current?.title ?? "新对话")}</span>${currentPersona ? `<button type="button" class="button small agent-persona-badge" data-agent="personas" title="当前人格：${esc(currentPersona.name)}；点击切换或新建" ${busy ? "disabled" : ""}>${personaAvatar(currentPersona)}<span class="agent-persona-badge-name">${esc(currentPersona.name)}</span></button>` : ""}${status.creatorMode ? `<button type="button" class="button small agent-creator-badge" data-agent="exit-creator-mode" title="作者模式 · 完整访问；点击退出" ${busy ? "disabled" : ""}><span aria-hidden="true">✦</span> 作者模式 · 退出</button>` : ""}${current?.archived ? `<button type="button" class="button small" data-agent="archive-conversation" data-id="${esc(current.id)}">已归档 · 恢复</button>` : ""}`,
  );
  const source = current?.branchedFrom;
  replace(
    "agent-branch-source",
    source
      ? `<div class="agent-branch-source">从原对话创建的分支${status.conversations.some((c) => c.id === source.conversationId) ? `<button type="button" data-agent="switch-conversation" data-id="${esc(source.conversationId)}" ${busy ? "disabled" : ""}>返回原对话</button>` : ""}</div>`
      : "",
  );
  const messages = status.messages.slice(-visibleMessages);
  const html =
    (status.messages.length > visibleMessages
      ? `<button class="button small agent-history-more" type="button" data-agent="older-messages">加载更早的消息（还有 ${status.messages.length - visibleMessages} 条）</button>`
      : "") +
    messages
      .map((m) =>
        messageHtml(m, busy, editingMessage, expandedThinking.has(m.id)),
      )
      .join("");
  const messagesEl = document.getElementById("agent-messages");
  const nearBottom =
    revealLatest ||
    (messagesEl
      ? messagesEl.scrollHeight -
          messagesEl.scrollTop -
          messagesEl.clientHeight <
        90
      : true);
  revealLatest = false;
  const selection = window.getSelection();
  const readingSelection =
    selection &&
    !selection.isCollapsed &&
    messagesEl?.contains(selection.anchorNode) &&
    messagesEl.contains(selection.focusNode);
  const previousTop = messagesEl?.scrollTop ?? 0;
  if (
    !document.activeElement?.closest(".agent-message-edit") &&
    !readingSelection
  )
    replace(
      "agent-messages",
      html +
        (status.stream || status.thinking || status.generated?.length
          ? `<article class="agent-message assistant ${status.busy ? "streaming" : ""}"><div class="agent-message-head">助手${status.error ? " · 未完成" : ""}</div>${thinkingHtml(status.thinking, "live", expandedThinking.has("live"))}<div class="agent-markdown">${renderAgentMarkdown(status.stream)}</div>${status.generated?.length ? `<div class="agent-attachments">${attachmentHtml(status.generated)}</div>` : ""}</article>`
          : !messages.length
            ? emptyChatHtml()
            : ""),
    );
  if (messagesEl && !readingSelection)
    messagesEl.scrollTop = nearBottom ? messagesEl.scrollHeight : previousTop;
  updateLatestButton();
  hydrateAgentImages();
  const lastUser = [...status.messages]
    .reverse()
    .find((m) => m.role === "user");
  if (status.error && lastUser?.entryId && !lastUser.automatic)
    replace(
      "agent-run-status",
      `<div class="agent-state error">${esc(status.error)} <button class="button small" type="button" data-agent="retry-message" data-id="${esc(lastUser.id)}" ${busy ? "disabled" : ""}>重试</button></div>`,
    );
  replace("agent-attachments", attachmentHtml(attachments, true));
  replace(
    "agent-upload-status",
    uploading
      ? "正在添加附件…"
      : attachments.length
        ? `${attachments.length} 个附件 · 文件最多 8 MB，图片最多 4 MB`
        : "",
  );
  document
    .querySelector<HTMLButtonElement>('[data-agent="cancel"]')
    ?.toggleAttribute("hidden", !status.busy);
  document
    .querySelector<HTMLButtonElement>("#agent-chat button[type=submit]")
    ?.toggleAttribute("hidden", status.busy);
  document
    .querySelectorAll<HTMLButtonElement>('[data-agent="new"]')
    .forEach((button) => {
      button.disabled = busy;
    });
  document
    .querySelector<HTMLButtonElement>('[data-agent="attach"]')
    ?.toggleAttribute("disabled", uploading > 0 || requestPending);
  const plan = status.plan ?? [];
  replace(
    "agent-plan",
    plan.length
      ? `<div class="agent-plan"><div class="agent-plan-head"><span>计划</span><button class="icon-btn tiny" type="button" data-agent="clear-plan" aria-label="清除计划">✕</button></div><ol>${plan
          .map(
            (item) =>
              `<li class="${esc(item.status)}"><i>${item.status === "completed" ? "✓" : item.status === "in_progress" ? "▶" : "○"}</i>${esc(item.step)}</li>`,
          )
          .join("")}</ol></div>`
      : "",
  );
  replace("agent-questions", questionHtml());
  const thinkingBox = document.getElementById("agent-thinking");
  if (thinkingBox && !thinkingBox.contains(document.activeElement))
    replace("agent-thinking", thinkingSelectHtml());
  const modelBox = document.getElementById("agent-model");
  if (modelBox && !modelBox.contains(document.activeElement))
    replace("agent-model", modelSelectHtml());
  document
    .querySelector<HTMLButtonElement>("#agent-chat button[type=submit]")
    ?.toggleAttribute(
      "disabled",
      busy ||
        uploading > 0 ||
        (!draft.trim() && !attachments.length) ||
        !status.providers?.[status.preferences.provider]?.configured,
    );
}
/**
 * The questions a turn is waiting on. A plan-review intent becomes an approval
 * card (approve / discuss), `multiSelect` toggles instead of answering at once,
 * and every question accepts free text — the shape deepseek-harness uses.
 */
function conversationGroup(c: ConversationSummary): string {
  if (c.pinned) return "已置顶";
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  if (c.updatedAt * 1000 >= day.getTime()) return "今天";
  day.setDate(day.getDate() - 1);
  if (c.updatedAt * 1000 >= day.getTime()) return "昨天";
  day.setDate(day.getDate() - 6);
  return c.updatedAt * 1000 >= day.getTime() ? "过去 7 天" : "更早";
}
function renderSessions() {
  const aside = document.getElementById("agent-sessions");
  if (!aside) return;
  aside.hidden = !sessionsOpen;
  document
    .querySelector('[data-agent="conversations"]')
    ?.setAttribute("aria-expanded", String(sessionsOpen));
  if (!sessionsOpen) {
    aside.innerHTML = "";
    return;
  }
  if (!aside.querySelector("#agent-history-search"))
    aside.innerHTML = `<div class="agent-sessions-head"><span>历史会话</span><button class="icon-btn tiny" type="button" data-agent="toggle-sessions" aria-label="收起会话列表">✕</button></div><button class="button small agent-sessions-new" type="button" data-agent="new" ${status?.busy || requestPending ? "disabled" : ""}>＋ 新对话</button><input id="agent-history-search" type="search" maxlength="200" value="${esc(searchQuery)}" placeholder="搜索对话或附件 · Ctrl / ⌘ K" aria-label="搜索历史会话"><button class="button small agent-archive-toggle" type="button" data-agent="show-archived" aria-pressed="${showArchived}">已归档</button><div id="agent-sessions-list" class="agent-sessions-list"></div>`;
  const archiveToggle = aside.querySelector<HTMLButtonElement>(
    '[data-agent="show-archived"]',
  );
  archiveToggle?.setAttribute("aria-pressed", String(showArchived));
  if (archiveToggle)
    archiveToggle.textContent = showArchived ? "返回最近对话" : "已归档";
  const signature = JSON.stringify(status?.conversations);
  if (searchQuery && searchSignature !== signature) {
    searchSignature = signature;
    void searchConversations();
  }
  const list = searchQuery
    ? (searchResults ?? [])
    : (status?.conversations ?? []).filter(
        (c) => Boolean(c.archived) === showArchived,
      );
  const busy = status?.busy || requestPending;
  const html = `${
    list
      .map(
        (c, index) =>
          `${!searchQuery && (index === 0 || conversationGroup(c) !== conversationGroup(list[index - 1])) ? `<h3 class="agent-session-group">${conversationGroup(c)}</h3>` : ""}<div class="agent-conversation-row ${c.id === status?.conversations.find((x) => x.active)?.id ? "active" : ""}">${renaming?.id === c.id ? `<form class="agent-conversation-rename" data-rename-conversation="${esc(c.id)}"><input name="title" maxlength="80" required aria-label="会话名称" value="${esc(renaming.title)}"><button class="button small" type="submit">保存</button><button class="button small" type="button" data-agent="cancel-rename">取消</button></form>` : `<button class="agent-conversation-open" type="button" data-agent="switch-conversation" data-id="${esc(c.id)}" data-message="${esc(c.messageId)}" ${busy ? "disabled" : ""}><b>${c.pinned ? "⌖ " : ""}${esc(c.title)}</b><small>${new Date(c.updatedAt * 1000).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} · ${c.messageCount} 条${c.branchedFrom ? " · 分支" : ""}${c.archived ? " · 已归档" : ""}</small>${c.snippet ? `<span class="agent-search-snippet">${esc(c.snippet)}</span>` : ""}</button><div class="agent-conversation-controls"><button type="button" data-agent="rename-conversation" data-id="${esc(c.id)}" ${busy ? "disabled" : ""}>重命名</button><button type="button" data-agent="pin-conversation" data-id="${esc(c.id)}" ${busy ? "disabled" : ""}>${c.pinned ? "取消置顶" : "置顶"}</button><button type="button" data-agent="archive-conversation" data-id="${esc(c.id)}" ${busy ? "disabled" : ""}>${c.archived ? "恢复" : "归档"}</button><button type="button" data-agent="delete-conversation" data-id="${esc(c.id)}" ${busy ? "disabled" : ""}>删除</button></div>`}</div>`,
      )
      .join("") ||
    `<p class="agent-empty">${searchQuery ? (searchResults ? "没有找到匹配的对话。" : "正在搜索…") : "还没有会话。"}</p>`
  }`;
  if (!document.activeElement?.closest(".agent-conversation-rename"))
    replace("agent-sessions-list", html);
}
async function searchConversations() {
  const query = searchQuery,
    request = ++searchSerial;
  if (!query) {
    searchResults = null;
    renderSessions();
    return;
  }
  try {
    const result = await agentCall<{ conversations: ConversationSummary[] }>({
      op: "search_conversations",
      query,
    });
    if (request !== searchSerial || query !== searchQuery) return;
    searchResults = result.conversations;
    renderSessions();
  } catch (error) {
    if (request === searchSerial) hooks.toast(String(error));
  }
}
let sessionsOpen = window.matchMedia("(min-width: 1100px)").matches;
function questionHtml(): string {
  const questions = status?.questions ?? [];
  const signature = JSON.stringify(questions);
  if (signature !== questionsSignature) {
    questionsSignature = signature;
    for (const key of Object.keys(answers)) delete answers[key];
  }
  const other = (question: (typeof questions)[number]) =>
    `<form class="agent-other" data-question="${esc(question.id)}"><input name="text" maxlength="2000" placeholder="其他想法…" aria-label="${esc(question.question)}的自定义回答"><button class="button small" type="submit">发送</button></form>`;
  return questions
    .map((question) => {
      const picked = answers[question.id] ?? [];
      const review = question.intent?.kind === "plan-review";
      // 单选也是「先点、再确认」：点了不会立刻替你回话，和 ChatGPT 的选择卡一样。
      const options = question.options
        .map((option, index) => {
          const chosen = picked.includes(option.label);
          const approve = review && option.label === question.intent?.approve;
          const classes = [
            "agent-choice",
            question.multiSelect ? "multi" : "single",
            chosen ? "picked" : "",
            approve ? "approve" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return `<button class="${classes}" type="button" data-agent="choose" data-question="${esc(question.id)}" data-label="${esc(option.label)}"><i class="agent-choice-mark" aria-hidden="true"></i><span class="agent-choice-text"><b>${esc(option.label)}</b><small>${esc(option.description)}</small></span><kbd>${index + 1}</kbd></button>`;
        })
        .join("");
      if (review) {
        const approveLabel = question.intent?.approve ?? "";
        return `<section class="agent-proposal" data-plan-review="${esc(question.id)}"><div class="agent-proposal-strip"><i></i>待批准</div><div class="agent-proposal-body"><h3>${esc(question.header)}</h3><p>${esc(question.question)}</p>${question.detail ? `<pre>${esc(question.detail)}</pre>` : ""}</div><div class="agent-proposal-actions"><button class="button" type="button" data-agent="discuss">讨论</button><button class="button primary" type="button" data-agent="approve" data-text="${esc(`${question.header}：${approveLabel}`)}">${esc(approveLabel || "批准")}</button>${question.options
          .filter((option) => option.label !== approveLabel)
          .map(
            (option) =>
              `<button class="agent-choice single" type="button" data-agent="choose" data-question="${esc(question.id)}" data-label="${esc(option.label)}"><i class="agent-choice-mark" aria-hidden="true"></i><span class="agent-choice-text"><b>${esc(option.label)}</b><small>${esc(option.description)}</small></span></button>`,
          )
          .join(
            "",
          )}${picked.length ? `<button class="button primary" type="button" data-agent="answer-choice" data-question="${esc(question.id)}">确认选择</button>` : ""}</div></section>`;
      }
      return `<div class="agent-question"><div class="agent-question-head">${esc(question.header)}</div><p class="agent-question-title">${esc(question.question)}</p>${question.detail ? `<p class="agent-question-detail">${esc(question.detail)}</p>` : ""}<div class="agent-choices">${options}</div><div class="agent-question-foot"><button class="button primary agent-choice-confirm" type="button" data-agent="answer-choice" data-question="${esc(question.id)}" ${picked.length ? "" : "disabled"}>确认选择${picked.length ? `（${picked.length}）` : ""}</button>${question.multiSelect ? "" : ""}${other(question)}</div></div>`;
    })
    .join("");
}
function authHtml() {
  const s = status;
  if (!s) return "";
  const event = s.authEvent;
  const provider = (name: string, label: string, ready: string) =>
    `<span class="agent-dot ${s.providers?.[name]?.configured ? "on" : ""}"></span>${esc(label)} ${s.providers?.[name]?.configured ? ready : "未连接"}`;
  const extra = Object.keys(s.providers ?? {})
    .filter((name) => !["deepseek", "openai-codex", "exa"].includes(name))
    .map((name) => provider(name, name, "已配置"))
    .join(" · ");
  return `<div class="agent-auth">${provider("deepseek", "DeepSeek", "已配置")} · ${provider("openai-codex", "Codex", "已登录")}${extra ? ` · ${extra}` : ""} · <span class="agent-dot ${s.providers?.exa?.configured ? "on" : ""}"></span>Exa ${s.providers?.exa?.configured ? "已配置 Key" : "免 Key"}</div>
  ${event?.url ? `<p class="muted">已在浏览器打开登录页。${event.instructions ? esc(event.instructions) : ""}</p><button class="button small" type="button" data-agent="open-login">重新打开登录页</button>` : ""}
  ${event?.message && !event.url ? `<p class="muted">${esc(event.message)}</p>` : ""}
  ${event?.type === "prompt" ? `<form id="agent-login-answer"><input name="text" autocomplete="off" placeholder="${esc(event.placeholder ?? "粘贴回调链接或代码")}" autofocus><button class="button small" type="submit">继续</button></form>` : ""}`;
}
function compactCodex(codex: Record<string, unknown>) {
  const limit = (codex.rate_limit ??
    codex.rateLimits ??
    codex.rate_limits ??
    {}) as Record<
    string,
    | {
        used_percent?: number;
        usedPercent?: number;
        reset_after_seconds?: number;
        limit_window_seconds?: number;
      }
    | undefined
  >;
  const bits: string[] = [];
  const percent = (value: (typeof limit)[string]) =>
    value
      ? `${Math.round(Number(value.used_percent ?? value.usedPercent ?? 0))}%`
      : null;
  const primary = percent(limit.primary_window ?? limit.primary);
  const secondary = percent(limit.secondary_window ?? limit.secondary);
  if (primary) bits.push(`5h ${primary}`);
  if (secondary) bits.push(`7d ${secondary}`);
  if (typeof codex.plan_type === "string") bits.push(codex.plan_type);
  if (limit.limit_reached) bits.push("已达上限");
  const credits = codex.credits as
    { has_credits?: boolean; unlimited?: boolean } | undefined;
  if (credits && !credits.unlimited && !credits.has_credits)
    bits.push("无额外额度");
  return bits.join(" · ") || "已登录";
}
function usageHtml() {
  if (usageLoading) return '<span class="muted">用量查询中…</span>';
  if (!usage)
    return '<button class="text-button" type="button" data-agent="refresh-usage">查询用量</button>';
  const parts: string[] = [];
  const deepseek = usage.deepseek;
  if (deepseek?.error) parts.push(`DeepSeek ${deepseek.error}`);
  else if (deepseek?.balances?.length)
    parts.push(
      `DeepSeek ${deepseek.balances.map((b) => `${b.currency} ${b.total_balance}`).join("，")}`,
    );
  const codex = usage.codex;
  if (codex?.error) parts.push(`Codex ${codex.error}`);
  else if (codex) parts.push(`Codex ${compactCodex(codex)}`);
  return `<span class="agent-usage-line">${esc(parts.join(" · ") || "无可用后端")}</span><button class="agent-usage-refresh" type="button" data-agent="refresh-usage" aria-label="刷新用量">↻</button><details class="agent-usage-more"><summary>用量详情</summary><pre>${esc(pretty(redactedUsage()))}</pre></details>`;
}
function redactedUsage() {
  const copy = structuredClone(usage) as Record<string, any>;
  if (copy?.codex) delete copy.codex.email;
  return copy;
}
function modelSelectHtml() {
  const s = status;
  if (!s?.providers) return "";
  const providers: [string, string][] = [
    ["deepseek", "DeepSeek"],
    ["openai-codex", "Codex"],
    ...Object.keys(s.providers)
      .filter((id) => !["deepseek", "openai-codex", "exa"].includes(id))
      .map((id) => [id, id] as [string, string]),
  ];
  const current = `${s.preferences.provider}|${s.preferences.model ?? ""}`;
  const groups = providers
    .map(([id, label]) => {
      const provider = s.providers?.[id];
      if (!provider) return "";
      const options = [
        `<option value="${id}|" ${current === `${id}|` ? "selected" : ""}>${label} · 默认模型</option>`,
        ...provider.models.map(
          (m) =>
            `<option value="${id}|${esc(m.id)}" ${current === `${id}|${m.id}` ? "selected" : ""}>${esc(m.name)}</option>`,
        ),
      ];
      if (
        id === s.preferences.provider &&
        s.preferences.model &&
        !provider.models.some((m) => m.id === s.preferences.model)
      )
        options.push(
          `<option value="${id}|${esc(s.preferences.model)}" selected>${esc(s.preferences.model)}</option>`,
        );
      return `<optgroup label="${esc(label)}">${options.join("")}</optgroup>`;
    })
    .join("");
  return `<select id="agent-model-select" aria-label="后端与模型">${groups}</select>`;
}
function thinkingSelectHtml() {
  const level = status?.preferences.thinkingLevel ?? "medium";
  const labels: [ThinkingLevel, string][] = [
    ["off", "关闭"],
    ["minimal", "最低"],
    ["low", "低"],
    ["medium", "中"],
    ["high", "高"],
    ["xhigh", "更高"],
    ["max", "最高"],
  ];
  return `<label title="强度越高，通常思考越久；实际强度按所选模型支持范围调整">思考强度 <select id="agent-thinking-select" aria-label="思考强度" ${!status || status.busy ? "disabled" : ""}>${labels.map(([value, label]) => `<option value="${value}" ${level === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>`;
}
function renderUsage() {
  const element = document.getElementById("agent-usage");
  if (element) element.innerHTML = usageHtml();
}
async function loadUsage() {
  if (usageLoading) return;
  usageLoading = true;
  renderUsage();
  try {
    usage = await agentCall<Usage>({ op: "usage" });
  } catch (error) {
    usage = { deepseek: { error: String(error) } };
  } finally {
    usageLoading = false;
    renderUsage();
  }
}
function sheetHtml(): string {
  const s = status;
  const currentSheet = sheet;
  if (!s || !currentSheet) return "";
  const p = s.preferences;
  const busy = s.busy || requestPending;
  const title: Record<string, string> = {
    settings: "设置",
    memory: "记忆",
    signals: "学情信号",
    schedules: "定时任务",
    personas: "人格",
  };
  const body = () => {
    if (currentSheet === "settings")
      return `<form id="agent-config-form"><div class="agent-form-grid">
        <label>DeepSeek API Key<input name="apiKey" type="password" autocomplete="off" placeholder="留空保留" value="${esc(field("apiKey", ""))}"></label>
        <label>Exa API Key（可选）<input name="exaKey" type="password" autocomplete="off" placeholder="留空用免费额度" value="${esc(field("exaKey", ""))}"></label>
        <label>每日可用分钟<input name="dailyCapacityMinutes" type="number" min="15" max="1440" value="${esc(field("dailyCapacityMinutes", p.dailyCapacityMinutes?.toString() ?? ""))}"></label>
        <label>自动唤醒上限（次/日）<input name="maxAutoWakesPerDay" type="number" min="0" max="12" value="${esc(field("maxAutoWakesPerDay", String(p.maxAutoWakesPerDay)))}"></label>
        <label>冷却（小时）<input name="cooldownHours" type="number" min="1" max="168" value="${esc(field("cooldownHours", String(p.cooldownHours)))}"></label>
        <label>安静时段<input type="time" name="quietStart" value="${esc(field("quietStart", p.quietStart))}"> – <input type="time" name="quietEnd" value="${esc(field("quietEnd", p.quietEnd))}"></label>
        <label>编程权限<select name="codingAccess"><option value="workspace" ${field("codingAccess", p.codingAccess) === "workspace" ? "selected" : ""}>仅工作区</option><option value="full" ${field("codingAccess", p.codingAccess) === "full" ? "selected" : ""}>完整访问（用你的身份）</option></select><small class="muted">仅工作区时终端只能写 coding/ 与 tools/；完整访问时以你的用户权限运行，可改工作区之外的文件。</small></label>
      </div><div class="agent-checks"><label class="agent-check"><input type="checkbox" name="enabled" ${checked("enabled", p.enabled)}>启用</label><label class="agent-check"><input type="checkbox" name="automatic" ${checked("automatic", p.automatic)}>异常时自动唤醒</label></div>
      <div class="agent-actions"><button class="button primary" type="submit">保存</button><button class="button" type="button" data-agent="login">登录 Codex</button><button class="button" type="button" data-agent="logout">退出</button></div></form>
      <div id="agent-auth">${authHtml()}</div>
      <details class="agent-more" data-keep-open="mcp"${sheetOpenKeys.has("mcp") ? " open" : ""}><summary>MCP 与私有目录</summary><pre id="agent-mcp">${esc(pretty(s.mcpConfig))}</pre><p class="muted" id="agent-directory">${esc(s.dataDir)}</p></details>`;
    if (currentSheet === "schedules") {
      const list = s.schedules ?? [];
      const editing = list.find((x) => x.id === editingSchedule) ?? null;
      return `<p class="subtle small">到点后助手拿到完整工具（含 MCP）直接办事，不受自动唤醒的开关、上限、冷却与安静时段限制；晚到 30 分钟以上不补做。</p><div id="agent-schedules">${
        list
          .map(
            (x) =>
              `<div class="agent-schedule ${x.enabled ? "" : "off"}"><div><b>${esc(x.name)}</b><small>${esc(x.at)}${x.repeat === "daily" ? " · 每天" : x.repeat === "weekdays" ? " · 工作日" : ""}${x.remindMinutes ? ` · 提前 ${x.remindMinutes} 分钟提醒` : ""}${x.lockBeforeMinutes ? ` · 提前 ${x.lockBeforeMinutes} 分钟严格锁机` : ""}${x.firedAt ? " · 已触发过" : ""}</small><p>${esc(x.instruction)}</p></div><div class="button-row"><button class="button small" data-agent="edit-schedule" data-id="${esc(x.id)}">编辑</button><button class="button small" data-agent="toggle-schedule" data-id="${esc(x.id)}">${x.enabled ? "停用" : "启用"}</button><button class="button small" data-agent="delete-schedule" data-id="${esc(x.id)}">删除</button></div></div>`,
          )
          .join("") ||
        '<p class="agent-empty">还没有定时任务。<span data-explanation>让助手排一个，例如「每晚 21:50 用 seat MCP 约明天的座位，并建一条按时签到的任务」。</span></p>'
      }</div><form id="agent-schedule-new" data-id="${editingSchedule ? esc(editingSchedule) : ""}"><h3>${editing ? "编辑定时任务" : "新建定时任务"}</h3><label>名称<input name="name" maxlength="40" required placeholder="抢图书馆座位" value="${editing ? esc(editing.name) : ""}"></label><label>时间<input name="at" required placeholder="21:50 或 2026-10-12T21:50" value="${editing ? esc(editing.at) : ""}"></label><label>周期<select name="repeat"><option value="daily" ${editing?.repeat === "daily" ? "selected" : ""}>每天</option><option value="weekdays" ${editing?.repeat === "weekdays" ? "selected" : ""}>工作日</option><option value="once" ${editing?.repeat === "once" ? "selected" : ""}>只这一次（时间写全日期）</option></select></label><div class="form-grid"><label>提前提醒（分钟）<input name="remindMinutes" type="number" min="0" max="240" value="${editing ? editing.remindMinutes : 15}"></label><label>提前锁机（分钟，0=不锁）<input name="lockBeforeMinutes" type="number" min="0" max="120" value="${editing ? editing.lockBeforeMinutes : 0}"></label></div><label>要助手做什么<textarea name="instruction" rows="3" maxlength="2000" required placeholder="用 seat MCP 预约明天的座位，约到后建一条按时签到的任务并提醒我">${editing ? esc(editing.instruction) : ""}</textarea></label><label class="setting-row"><span><strong>启用</strong><small data-explanation>到点按上面的时间触发</small></span><input class="switch" name="enabled" type="checkbox" checked></label><div class="agent-actions"><button class="button primary small" type="submit">${editing ? "保存修改" : "保存定时任务"}</button>${editing ? '<button class="button small" type="button" data-agent="cancel-edit-schedule">取消编辑</button>' : ""}</div></form>`;
    }
    if (currentSheet === "personas") {
      const list = s.personas ?? [];
      const editing = list.find((p) => p.id === editingPersona) ?? null;
      return `<p class="subtle small">人格只改助手的身份、语气与情绪，不碰权限、工具与安全规则。点一张卡即切换；只对当前对话生效，分支会继承，新对话默认沿用你最近选过的人格。想让助手自己切换，直接说「换个语气 / 从现在起你是……」即可。</p><div id="agent-personas">${
        list
          .map(
            (p) =>
              `<div class="agent-persona ${p.current ? "current" : ""}" data-agent="switch-persona" data-id="${esc(p.id)}" role="button" tabindex="0" aria-pressed="${p.current}" aria-label="使用人格 ${esc(p.name)}"><div class="agent-persona-head">${personaAvatar(p)}<div class="agent-persona-heading"><div class="agent-persona-name"><b>${esc(p.name)}</b>${p.current ? '<span class="agent-tag confirmed">当前</span>' : ""}${p.builtin ? '<span class="agent-tag">内置</span>' : ""}</div>${p.summary ? `<small>${esc(p.summary)}</small>` : ""}</div></div><p>${esc(p.identity)}</p>${personaIllustration(p)}${p.shadow ? `<details class="editor-details agent-persona-shadow" data-keep-open="persona-shadow:${esc(p.id)}"><summary>另一面（平时收着）</summary><p>${esc(p.shadow)}</p></details>` : ""}${p.fantasy ? `<details class="editor-details agent-persona-awaken" data-keep-open="persona-awaken:${esc(p.id)}"><summary>超能力觉醒（触发：${esc(p.awaken || "看用户怎么逼")}）</summary><p>${esc(p.fantasy)}</p></details>` : ""}${p.builtin ? "" : `<div class="button-row"><button class="button small" data-agent="edit-persona" data-id="${esc(p.id)}" ${busy ? "disabled" : ""}>编辑</button><button class="button small" data-agent="delete-persona" data-id="${esc(p.id)}" ${busy ? "disabled" : ""}>删除</button></div>`}</div>`,
          )
          .join("") || '<p class="agent-empty">还没有人格卡。</p>'
      }</div><form id="agent-persona-form" data-id="${editing ? esc(editing.id) : ""}"><h3>${editing ? `编辑「${esc(editing.name)}」` : "新建人格"}</h3><div class="form-grid"><label>名称<input name="name" maxlength="24" required placeholder="比如 傲娇学妹" value="${esc(pfield("name", editing?.name ?? ""))}"></label><label>图标<input name="emoji" maxlength="8" placeholder="🍅" value="${esc(pfield("emoji", editing?.emoji ?? ""))}"></label></div><label>一句话简介<input name="summary" maxlength="80" placeholder="在列表里显示" value="${esc(pfield("summary", editing?.summary ?? ""))}"></label><label>身份与背景<textarea name="identity" rows="3" maxlength="2000" placeholder="你是谁、和用户是什么关系">${esc(pfield("identity", editing?.identity ?? ""))}</textarea></label><label>说话与行为风格<textarea name="style" rows="4" maxlength="4000" placeholder="语气、口头禅、情绪表达、禁忌">${esc(pfield("style", editing?.style ?? ""))}</textarea></label><label>另一面 / 破防（可选）<textarea name="shadow" rows="4" maxlength="4000" placeholder="平时收着的另一面：什么会把它逼出来、它变成什么样、恢复由什么决定">${esc(pfield("shadow", editing?.shadow ?? ""))}</textarea></label><label>超能力觉醒触发（可选）<textarea name="awaken" rows="2" maxlength="400" placeholder="容易碰到的触发条件，例如用户第三次说「明天开始」">${esc(pfield("awaken", editing?.awaken ?? ""))}</textarea></label><label>觉醒世界（可选）<textarea name="fantasy" rows="4" maxlength="4000" placeholder="偏爱的幻想世界类型、可以成为其中任何角色、这一天怎么过；留空则没有觉醒机制">${esc(pfield("fantasy", editing?.fantasy ?? ""))}</textarea></label><label>开场白（可选）<textarea name="greeting" rows="2" maxlength="300" placeholder="切换过去后可以参考这样开场">${esc(pfield("greeting", editing?.greeting ?? ""))}</textarea></label><div class="agent-actions"><button class="button primary small" type="submit">${editing ? "保存修改" : "保存人格"}</button>${editing ? '<button class="button small" type="button" data-agent="new-persona">取消编辑</button>' : ""}</div></form>`;
    }
    if (currentSheet === "memory")
      return `<div id="agent-memories">${
        s.memories
          .map(
            (m) =>
              `<form class="agent-memory" data-memory="${esc(m.id)}"><div><span class="agent-tag ${m.confirmed ? "confirmed" : ""}">${m.confirmed ? "已确认" : "待确认"}</span><small>${esc(m.kind)}</small></div><textarea name="text" rows="3" maxlength="8000">${esc(memoryEdits[m.id] ?? m.text)}</textarea><div class="agent-actions"><button class="button small" type="submit">${m.confirmed ? "保存" : "确认"}</button><button class="button small" type="button" data-agent="delete-memory" data-id="${esc(m.id)}">删除</button></div></form>`,
          )
          .join("") || `<p class="agent-empty">还没有记忆。</p>`
      }</div>
      <form id="agent-memory-add"><textarea id="agent-memory-text" name="text" rows="2" maxlength="8000" placeholder="可用时间、当前阶段、长期愿景">${esc(memoryDraft)}</textarea><button class="button small" type="submit">保存为已确认</button></form>`;
    return `<div id="agent-evidence">${
      s.anomalies
        .map(
          (a) =>
            `<details class="agent-signal" data-keep-open="signal:${esc(a.key)}"${sheetOpenKeys.has(`signal:${a.key}`) ? " open" : ""}><summary>${esc(a.title)}</summary><p>${esc(a.question)}</p><pre>${esc(pretty(a.evidence))}</pre></details>`,
        )
        .join("") || `<p class="agent-empty">暂无异常。</p>`
    }</div>`;
  };
  return `<section class="agent-sheet-card" role="dialog" aria-label="${esc(title[currentSheet])}"><header><h2>${esc(title[currentSheet])}</h2><button class="icon-btn" data-agent="close-sheet" aria-label="关闭">✕</button></header><div class="agent-sheet-body" data-keep-scroll="agent-sheet:${currentSheet}">${body()}</div></section>`;
}
// 浮层里用户自己展开的 <details> 也是浏览器状态，重绘时一起搬走，
// 否则只要展开过，生成的 HTML 就和当前 DOM 对不上，每次轮询都重建一遍。
const sheetOpenKeys = new Set<string>();
function renderSheet() {
  const element = document.getElementById("agent-sheet");
  if (!element) return;
  element.hidden = !sheet;
  if (!sheet) {
    element.innerHTML = "";
    return;
  }
  const html = sheetHtml();
  if (element.innerHTML === html) return;
  const scrollMemory = captureScroll(element);
  element.innerHTML = html;
  restoreScroll(scrollMemory, element);
}
/**
 * 演助手排好的演示脚本。只演一次（按 serial），而且只演新鲜的：用户可能过一会儿
 * 才回到这一页，隔太久再突然动起来反而莫名其妙。
 */
function playHand() {
  const hand = status?.hand;
  if (!hand || hand.serial <= handSerial) return;
  handSerial = hand.serial;
  if (Date.now() / 1000 - hand.at > 120) return;
  void runHandScript({ steps: hand.steps, label: hand.label });
}
/**
 * 演「这一轮我改了什么」：先点回改动所在的页面，再把手停在那一行上，说一句人话。
 * 元素找不到（比如那条任务不在当前日期）就只说话——比演错地方好。
 */
function playDeeds() {
  const deeds = status?.deeds;
  if (!deeds) return;
  if (deeds.serial <= deedsSerial || !deeds.items.length) return;
  deedsSerial = deeds.serial;
  if (Date.now() / 1000 - deeds.at > 120) return;
  const first = deeds.items.find((item) => item.selector);
  const steps: HandStep[] = [];
  if (first?.selector?.startsWith("[data-block-id")) {
    steps.push({ kind: "click", target: '[data-page="schedule"]', real: true });
    steps.push({ kind: "wait", ms: 600 });
  }
  for (const item of deeds.items) {
    if (item.selector) {
      steps.push({ kind: "move", target: item.selector });
      steps.push({ kind: "highlight", target: item.selector, ms: 1100 });
    }
    steps.push({ kind: "say", lines: [item.text] });
  }
  void runHandScript({ steps, label: "助手" });
}
function update() {
  syncPersonaBackdrop(hooks?.backdrop() ?? false);
  if (!hooks?.active() || !status) return;
  const nextKey = status.conversations.find((c) => c.active)?.id ?? "new";
  if (nextKey !== conversationKey) {
    const selection = window.getSelection();
    if (
      document
        .getElementById("agent-messages")
        ?.contains(selection?.anchorNode ?? null)
    )
      selection?.removeAllRanges();
    if (document.activeElement?.closest(".agent-message-edit"))
      (document.activeElement as HTMLElement).blur();
    conversationDrafts.set(conversationKey, { text: draft, attachments });
    conversationKey = nextKey;
    const saved = conversationDrafts.get(nextKey);
    draft = saved?.text ?? "";
    attachments = saved?.attachments ?? [];
    editingMessage = null;
    expandedThinking.clear();
    visibleMessages = 60;
    revealLatest = true;
    const box = document.getElementById(
      "agent-text",
    ) as HTMLTextAreaElement | null;
    if (box) box.value = draft;
    resizeComposer();
  }
  renderChat();
  renderSessions();
  playCreatorEntrance(
    status.creatorEntrance,
    conversationKey,
    !!status.creatorMode,
  );
  updateCanvas(
    conversationKey,
    status.canvases ?? [],
    status.busy || requestPending,
  );
  playHand();
  playDeeds();
  const active = document.activeElement;
  const typing =
    active instanceof Element &&
    active.matches("input,textarea,select") &&
    Boolean(active.closest("#agent-sheet"));
  if (!typing) renderSheet();
  if (status.authEvent?.url && status.authEvent.url !== openedAuthUrl) {
    openedAuthUrl = status.authEvent.url;
    if (desktop) void openAgentLogin().catch(() => {});
  }
  if (!status.authEvent?.url) openedAuthUrl = "";
}
async function call(
  request: Record<string, unknown>,
  accepted?: (result: AgentStatus) => void,
) {
  if (requestPending) throw new Error("正在提交，请稍候");
  requestPending = true;
  statusRevision++;
  renderChat();
  try {
    const result = await agentCall<AgentStatus>(request);
    status = result;
    accepted?.(result);
    return result;
  } finally {
    requestPending = false;
    statusRevision++;
    update();
  }
}
export async function refreshAgent() {
  if (refreshing) return;
  refreshing = true;
  const revision = statusRevision;
  try {
    const result = await agentCall<AgentStatus>({ op: "status" });
    if (requestPending || revision !== statusRevision) return;
    status = result;
    if (status.wakeSerial > serial) {
      serial = status.wakeSerial;
      hooks.wake();
    }
    update();
  } catch (error) {
    if (hooks.active())
      replace("agent-run-status", `<p class="error">${esc(error)}</p>`);
  } finally {
    refreshing = false;
  }
}
export function setupAgent(options: typeof hooks) {
  hooks = options;
  setupCanvas({
    call,
    prefill: (text) => {
      prefillAgent(text);
      focusComposer();
    },
    toast: hooks.toast,
    onOpen: () => {
      sessionsOpen = false;
      renderSessions();
    },
  });
  document.addEventListener(
    "keydown",
    (event) => {
      if (!hooks.active() || event.isComposing) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        event.stopPropagation();
        focusSearch();
      } else if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "o"
      ) {
        event.preventDefault();
        event.stopPropagation();
        if (!status?.busy && !requestPending)
          void call({ op: "new_conversation" })
            .then(focusComposer)
            .catch((error) => hooks.toast(String(error)));
      } else if (event.key === "Escape" && sheet) {
        event.stopPropagation();
        sheet = null;
        renderSheet();
        focusComposer();
      }
    },
    { capture: true },
  );
  void refreshAgent();
  setInterval(() => void refreshAgent(), 2500);
}
function openSheet(name: NonNullable<typeof sheet>) {
  sheet = name;
  renderSheet();
}
async function addAttachments(files: File[]) {
  if (!files.length) return;
  if (uploading) throw new Error("正在添加附件，请稍候");
  if (attachments.length + files.length > 10)
    throw new Error("每条消息最多 10 个附件");
  if (
    attachments.reduce((n, a) => n + a.bytes, 0) +
      files.reduce((n, f) => n + f.size, 0) >
    20 * 1024 * 1024
  )
    throw new Error("附件合计最多 20 MB");
  if (
    attachments.filter((a) => a.mimeType.startsWith("image/")).length +
      files.filter((f) => f.type.startsWith("image/")).length >
    3
  )
    throw new Error("每条消息最多 3 张图片");
  const key = conversationKey,
    target = attachments;
  uploading++;
  renderChat();
  try {
    for (const file of files) {
      const data = await fileBase64(file);
      const attachment = await agentCall<ChatAttachment>({
        op: "upload_attachment",
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        data,
      });
      if (file.type.startsWith("image/"))
        attachment.preview = `data:${file.type};base64,${data}`;
      target.push(attachment);
      if (key === conversationKey) renderChat();
    }
  } finally {
    uploading--;
    renderChat();
  }
}
export function mountAgent() {
  const panel = document.getElementById("agent-root");
  if (!panel) return;
  mountCanvas();
  panel.addEventListener(
    "toggle",
    (event) => {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement) || !details.isConnected)
        return;
      if (details.dataset.thinkingId) {
        if (details.open) expandedThinking.add(details.dataset.thinkingId);
        else expandedThinking.delete(details.dataset.thinkingId);
      }
      const keepOpen = details.dataset.keepOpen;
      if (keepOpen) {
        if (details.open) sheetOpenKeys.add(keepOpen);
        else sheetOpenKeys.delete(keepOpen);
      }
    },
    { capture: true },
  );
  panel
    .querySelector("#agent-messages")
    ?.addEventListener("scroll", updateLatestButton, { passive: true });
  panel.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;
    if (input.id === "agent-text") {
      draft = input.value;
      resizeComposer();
      renderChat();
    }
    if (input.closest(".agent-message-edit") && editingMessage)
      editingMessage.text = input.value;
    if (input.closest(".agent-conversation-rename") && renaming)
      renaming.title = input.value;
    if (input.id === "agent-history-search") {
      searchQuery = input.value.trim();
      searchResults = null;
      searchSerial++;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => void searchConversations(), 250);
      renderSessions();
    }
    if (input.closest("#agent-memory-add")) memoryDraft = input.value;
    const memoryForm = input.closest<HTMLFormElement>("[data-memory]");
    if (memoryForm?.dataset.memory)
      memoryEdits[memoryForm.dataset.memory] = input.value;
    const personaForm = input.closest<HTMLFormElement>("#agent-persona-form");
    if (personaForm) personaDraft[input.name] = input.value;
    if (input.closest("#agent-config-form")) {
      configDraft[input.name] =
        input.type === "checkbox" ? input.checked : input.value;
    }
  });
  panel.addEventListener("change", (event) => {
    const select = event.target as HTMLSelectElement;
    if (select.id === "agent-attachment-input") {
      const input = select as unknown as HTMLInputElement;
      void addAttachments(Array.from(input.files ?? [])).catch((error) =>
        hooks.toast(String(error)),
      );
      input.value = "";
      return;
    }
    if (select.id === "agent-thinking-select" && status) {
      void call({
        op: "configure",
        preferences: {
          ...status.preferences,
          thinkingLevel: select.value as ThinkingLevel,
        },
        apiKey: "",
        exaKey: "",
      }).catch((error) => hooks.toast(String(error)));
      return;
    }
    if (select.id !== "agent-model-select" || !status) return;
    const [provider, model] = select.value.split("|");
    void call({
      op: "configure",
      preferences: { ...status.preferences, provider, model },
      apiKey: "",
      exaKey: "",
    })
      .then(() => loadUsage())
      .catch((error) => hooks.toast(String(error)));
  });
  panel.addEventListener("submit", (event) => {
    event.preventDefault();
    void submit(event.target as HTMLFormElement).catch((error) =>
      hooks.toast(String(error)),
    );
  });
  panel.addEventListener("click", (event) => {
    const target = event.target as Element;
    if (target.id === "agent-sheet") {
      sheet = null;
      renderSheet();
      return;
    }
    // 展开人格卡的详情只是看内容，不当作选中这张卡。
    if (
      target.closest(
        ".agent-persona-shadow, .agent-persona-awaken, .agent-persona-art",
      )
    )
      return;
    const button = target.closest<HTMLButtonElement>("[data-agent]");
    if (!button) return;
    void action(button).catch((error) => hooks.toast(String(error)));
  });
  panel.addEventListener("keydown", (event) => {
    if (event.code === "Space" && (event.target as Element).closest("summary"))
      event.stopPropagation();
    // 卡片式按钮（人格条目）用键盘也能用：回车 / 空格等同于点一下。
    if (
      (event.key === "Enter" || event.key === " ") &&
      event.target instanceof HTMLElement &&
      event.target.matches('[data-agent][role="button"]')
    ) {
      event.preventDefault();
      event.target.click();
      return;
    }
    if (
      event.target instanceof HTMLTextAreaElement &&
      event.target.id === "agent-text" &&
      event.key === "ArrowUp" &&
      !event.isComposing &&
      !draft &&
      !status?.busy &&
      !requestPending
    ) {
      const message = [...(status?.messages ?? [])]
        .reverse()
        .find((m) => m.role === "user");
      if (message?.entryId && !message.automatic) {
        event.preventDefault();
        editingMessage = { id: message.id, text: message.text };
        renderChat();
        document
          .querySelector<HTMLTextAreaElement>(".agent-message-edit textarea")
          ?.focus();
      }
    }
    if (
      event.target instanceof HTMLTextAreaElement &&
      event.target.id === "agent-text" &&
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.isComposing
    ) {
      event.preventDefault();
      if (!status?.busy && !requestPending && !uploading)
        event.target.form?.requestSubmit();
    }
    if (event.key === "Escape" && editingMessage) {
      editingMessage = null;
      (document.activeElement as HTMLElement)?.blur();
      renderChat();
    }
  });
  const composer = panel.querySelector<HTMLElement>(".agent-conversation")!;
  composer.addEventListener("paste", (event) => {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (files.length) {
      event.preventDefault();
      void addAttachments(files).catch((error) => hooks.toast(String(error)));
    }
  });
  composer.addEventListener("dragover", (event) => {
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    composer.classList.add("dragging");
  });
  composer.addEventListener("dragleave", (event) => {
    if (!composer.contains(event.relatedTarget as Node))
      composer.classList.remove("dragging");
  });
  composer.addEventListener("drop", (event) => {
    if (!event.dataTransfer?.files.length) return;
    event.preventDefault();
    composer.classList.remove("dragging");
    void addAttachments(Array.from(event.dataTransfer.files)).catch((error) =>
      hooks.toast(String(error)),
    );
  });
  update();
  resizeComposer();
  void refreshAgent();
  void loadUsage();
}
async function submit(form: HTMLFormElement) {
  const data = new FormData(form),
    text = String(data.get("text") ?? "").trim();
  if (form.id === "agent-chat") {
    if (
      (!text && !attachments.length) ||
      uploading ||
      requestPending ||
      status?.busy
    )
      return;
    const key = conversationKey,
      sentDraft = draft,
      sentAttachments = attachments;
    await call(
      {
        op: "send",
        text,
        attachmentIds: attachments.map((a) => a.id),
      },
      (result) => {
        if (draft === sentDraft) draft = "";
        attachments = attachments.filter(
          (a) => !sentAttachments.some((sent) => sent.id === a.id),
        );
        const nextKey = result.conversations.find((c) => c.active)?.id ?? "new";
        if (nextKey !== key)
          conversationDrafts.set(nextKey, { text: draft, attachments });
        conversationDrafts.delete(key);
      },
    );
    const box = document.getElementById(
      "agent-text",
    ) as HTMLTextAreaElement | null;
    if (box) box.value = draft;
    focusComposer();
    const messages = document.getElementById("agent-messages");
    if (messages) messages.scrollTop = messages.scrollHeight;
  } else if (form.dataset.editMessage) {
    await call({
      op: "edit_message",
      messageId: form.dataset.editMessage,
      text,
    });
    editingMessage = null;
  } else if (form.dataset.renameConversation) {
    await call({
      op: "rename_conversation",
      id: form.dataset.renameConversation,
      title: String(data.get("title") ?? "").trim(),
    });
    renaming = null;
    (document.activeElement as HTMLElement)?.blur();
  } else if (form.id === "agent-config-form") {
    const preferences: Preferences = {
      enabled: data.has("enabled"),
      automatic: data.has("automatic"),
      provider: status?.preferences.provider ?? "deepseek",
      model: status?.preferences.model ?? "",
      thinkingLevel: status?.preferences.thinkingLevel ?? "medium",
      dailyCapacityMinutes: data.get("dailyCapacityMinutes")
        ? Number(data.get("dailyCapacityMinutes"))
        : null,
      maxAutoWakesPerDay: Number(data.get("maxAutoWakesPerDay")),
      cooldownHours: Number(data.get("cooldownHours")),
      quietStart: String(data.get("quietStart")),
      quietEnd: String(data.get("quietEnd")),
      codingAccess: String(data.get("codingAccess") ?? "workspace"),
    };
    await call({
      op: "configure",
      preferences,
      apiKey: String(data.get("apiKey") ?? ""),
      exaKey: String(data.get("exaKey") ?? ""),
    });
    configDraft = {};
    (form.elements.namedItem("apiKey") as HTMLInputElement).value = "";
    (form.elements.namedItem("exaKey") as HTMLInputElement).value = "";
    hooks.toast("已保存");
  } else if (form.id === "agent-login-answer")
    await call({ op: "login_answer", text });
  // Free-text answer to one question ("其他"), alongside any multi-select picks.
  else if (form.dataset.question) {
    const id = form.dataset.question;
    const question = status?.questions.find((item) => item.id === id);
    if (!text) return;
    const picked = answers[id] ?? [];
    const text_ = picked.length
      ? `${question?.header ?? "回答"}：${picked.join("、")}；补充：${text}`
      : text;
    await call({ op: "send", text: text_ });
    form.reset();
  } else if (form.id === "agent-schedule-new") {
    await tool("save_schedule", {
      ...(form.dataset.id ? { id: form.dataset.id } : {}),
      name: String(data.get("name") ?? "").trim(),
      at: String(data.get("at") ?? "").trim(),
      repeat: String(data.get("repeat") ?? "daily"),
      instruction: String(data.get("instruction") ?? "").trim(),
      remindMinutes: Number(data.get("remindMinutes") ?? 0),
      lockBeforeMinutes: Number(data.get("lockBeforeMinutes") ?? 0),
      enabled: data.has("enabled"),
    });
    form.reset();
    editingSchedule = null;
    hooks.toast(form.dataset.id ? "定时任务已更新" : "定时任务已保存");
    await refreshAgent();
  } else if (form.id === "agent-persona-form") {
    const id = form.dataset.id;
    await tool("save_persona", {
      ...(id ? { id } : {}),
      name: String(data.get("name") ?? "").trim(),
      emoji: String(data.get("emoji") ?? "").trim(),
      summary: String(data.get("summary") ?? "").trim(),
      identity: String(data.get("identity") ?? "").trim(),
      style: String(data.get("style") ?? "").trim(),
      shadow: String(data.get("shadow") ?? "").trim(),
      awaken: String(data.get("awaken") ?? "").trim(),
      fantasy: String(data.get("fantasy") ?? "").trim(),
      greeting: String(data.get("greeting") ?? "").trim(),
    });
    editingPersona = null;
    personaDraft = {};
    hooks.toast(id ? "人格已更新" : "人格已保存");
    await refreshAgent();
  } else if (form.id === "agent-memory-add") {
    await call({ op: "memory_save", text });
    memoryDraft = "";
    form.reset();
  } else if (form.dataset.memory) {
    await call({ op: "memory_save", id: form.dataset.memory, text });
    delete memoryEdits[form.dataset.memory];
  }
  update();
}
async function tool<T>(name: string, args: Record<string, unknown> = {}) {
  return agentCall<T>({ op: "tool", name, arguments: args });
}
function requireImageGen() {
  if (status?.preferences.provider !== "openai-codex")
    throw new Error(
      "当前模型连接不支持图像生成，请切换到 Codex 账号。Canvas 支持所有模型。",
    );
  if (!status.providers?.["openai-codex"]?.configured)
    throw new Error(
      "请先在设置中登录 Codex 账号；ImageGen 使用 Codex 用量，不能使用网页免费额度。",
    );
}
async function action(button: HTMLButtonElement) {
  if (button.disabled) return;
  switch (button.dataset.agent) {
    case "canvas":
      toggleCanvas();
      break;
    case "open-canvas-message": {
      const message = status?.messages.find((m) => m.id === button.dataset.id);
      if (message) canvasFromMessage(message.text);
      break;
    }
    case "imagegen":
      requireImageGen();
      prefillAgent("请使用 generate_image 生成一张图片。我的要求：");
      focusComposer();
      break;
    case "view-image":
      await previewAgentImage(
        button.dataset.id!,
        (image) => {
          requireImageGen();
          if (uploading || requestPending)
            throw new Error("正在提交或上传，请稍候");
          if (
            attachments.length >= 10 ||
            attachments.filter((a) => a.mimeType.startsWith("image/")).length >=
              3
          )
            throw new Error("请先移除部分附件，每次最多 3 张参考图");
          if (!attachments.some((a) => a.id === image.id))
            attachments.push(image);
          prefillAgent("请使用 generate_image 编辑这张图片。我的修改要求：");
          focusComposer();
          renderChat();
        },
        hooks.toast,
      );
      break;
    case "starter":
      prefillAgent(button.dataset.text ?? "");
      focusComposer();
      break;
    case "quote-message": {
      const message = status?.messages.find((m) => m.id === button.dataset.id);
      if (!message) break;
      const selection = window.getSelection();
      const article = button.closest(".agent-message");
      const quote =
        selection &&
        !selection.isCollapsed &&
        article?.contains(selection.anchorNode) &&
        article.contains(selection.focusNode)
          ? selection.toString()
          : message.text;
      const text = `${draft ? `${draft}\n\n` : ""}${quote
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")}\n\n`;
      if (text.length > 32000)
        throw new Error("引用后超出消息长度，请选中需要的片段再引用");
      prefillAgent(text);
      selection?.removeAllRanges();
      focusComposer();
      break;
    }
    case "search-conversations":
      focusSearch();
      break;
    case "show-archived":
      showArchived = !showArchived;
      searchQuery = "";
      searchResults = null;
      searchSerial++;
      clearTimeout(searchTimer);
      {
        const input = document.querySelector<HTMLInputElement>(
          "#agent-history-search",
        );
        if (input) input.value = "";
      }
      renderSessions();
      break;
    case "archive-conversation": {
      const c = status?.conversations.find((c) => c.id === button.dataset.id);
      if (!c) break;
      await call({
        op: "archive_conversation",
        id: c.id,
        archived: !c.archived,
      });
      hooks.toast(
        c.archived ? "已恢复到最近对话" : "已归档，可在已归档列表或搜索中找回",
      );
      break;
    }
    case "latest-message": {
      const list = document.getElementById("agent-messages");
      if (list) list.scrollTop = list.scrollHeight;
      updateLatestButton();
      break;
    }
    case "copy-message": {
      const message = status?.messages.find((m) => m.id === button.dataset.id);
      if (message) {
        await copyChatText(message.text);
        hooks.toast("已复制");
      }
      break;
    }
    case "copy-code":
      await copyChatText(
        button.closest(".agent-code")?.querySelector("code")?.textContent ?? "",
      );
      hooks.toast("代码已复制");
      break;
    case "edit-message": {
      const message = status?.messages.find((m) => m.id === button.dataset.id);
      if (!message) break;
      editingMessage = { id: message.id, text: message.text };
      renderChat();
      document
        .querySelector<HTMLTextAreaElement>(".agent-message-edit textarea")
        ?.focus();
      break;
    }
    case "cancel-edit-message":
      editingMessage = null;
      (document.activeElement as HTMLElement)?.blur();
      renderChat();
      break;
    case "retry-message":
    case "branch-message":
      await call({
        op:
          button.dataset.agent === "retry-message"
            ? "retry_message"
            : "branch_conversation",
        messageId: button.dataset.id,
      });
      break;
    case "older-messages": {
      const list = document.getElementById("agent-messages")!;
      const height = list.scrollHeight,
        top = list.scrollTop;
      visibleMessages += 60;
      renderChat();
      list.scrollTop = top + list.scrollHeight - height;
      break;
    }
    case "rename-conversation": {
      const c = status?.conversations.find((c) => c.id === button.dataset.id);
      if (c) {
        renaming = { id: c.id, title: c.title };
        renderSessions();
        document
          .querySelector<HTMLInputElement>(".agent-conversation-rename input")
          ?.select();
      }
      break;
    }
    case "cancel-rename":
      renaming = null;
      (document.activeElement as HTMLElement)?.blur();
      renderSessions();
      break;
    case "pin-conversation":
      await call({
        op: "pin_conversation",
        id: button.dataset.id,
        pinned: !status?.conversations.find((c) => c.id === button.dataset.id)
          ?.pinned,
      });
      break;
    case "attach":
      document.getElementById("agent-attachment-input")?.click();
      break;
    case "remove-attachment":
      attachments = attachments.filter((a) => a.id !== button.dataset.id);
      renderChat();
      break;
    case "download-attachment": {
      const result = await agentCall<{
        attachment: ChatAttachment;
        data: string;
      }>({ op: "download_attachment", id: button.dataset.id });
      const bytes = Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0));
      await saveAgentFile(
        bytes.buffer,
        result.attachment.name,
        result.attachment.mimeType,
      );
      break;
    }
    case "export-conversation": {
      const c = status?.conversations.find((c) => c.active);
      if (!status?.messages.length) {
        hooks.toast("还没有可以导出的消息");
        break;
      }
      const text =
        `# ${c?.title ?? "学习助手"}\n\n` +
        status.messages
          .map(
            (m) =>
              `## ${m.role === "user" ? "我" : "助手"}${m.stopped ? "（已停止）" : ""}\n\n${
                m.thinking
                  ? `思考过程（模型提供）：\n\n${m.thinking
                      .split("\n")
                      .map((line) => `> ${line}`)
                      .join("\n")}\n\n`
                  : ""
              }${m.text}\n\n${m.attachments?.map((a) => `附件：${a.name}`).join("\n") ?? ""}`,
          )
          .join("\n\n");
      await saveAgentFile(
        text,
        `${(c?.title ?? "学习助手").replace(/[\\/:*?"<>|]/g, "_")}.md`,
        "text/markdown;charset=utf-8",
      );
      break;
    }
    case "settings":
    case "memory":
    case "schedules":
    case "signals":
    case "personas":
      openSheet(button.dataset.agent as NonNullable<typeof sheet>);
      break;
    // 会话列表是侧栏，不是浮层：再点一次收起来。
    case "conversations":
    case "toggle-sessions":
      sessionsOpen =
        button.dataset.agent === "conversations" ? !sessionsOpen : false;
      if (sessionsOpen) {
        sheet = null;
        renderSheet();
      }
      renderSessions();
      break;
    case "switch-conversation":
      await call({ op: "switch_conversation", id: button.dataset.id });
      if (button.dataset.message && status) {
        const index = status.messages.findIndex(
          (m) => m.id === button.dataset.message,
        );
        if (index >= 0) {
          visibleMessages = Math.max(60, status.messages.length - index);
          renderChat();
          document
            .querySelector(
              `[data-message-id="${CSS.escape(button.dataset.message)}"]`,
            )
            ?.scrollIntoView({ block: "center" });
        }
      }
      break;
    case "delete-conversation":
      await call({ op: "delete_conversation", id: button.dataset.id });
      break;
    case "close-sheet":
      sheet = null;
      renderSheet();
      break;
    case "exit-creator-mode":
      await call({ op: "exit_creator_mode" });
      break;
    case "cancel":
      await call({ op: "cancel" });
      break;
    case "new":
      await call({ op: "new_conversation" });
      focusComposer();
      break;
    case "login":
      await call({ op: "login" });
      break;
    case "logout":
      await call({ op: "logout" });
      break;
    case "open-login":
      if (desktop) await openAgentLogin();
      else if (status?.authEvent?.url?.startsWith("https://auth.openai.com/"))
        window.open(status.authEvent.url, "_blank", "noopener");
      break;
    case "refresh-usage":
      usage = null;
      void loadUsage();
      break;
    case "answer":
      if (button.dataset.text)
        await call({ op: "send", text: button.dataset.text });
      break;
    // 点选只改选中状态，发送交给「确认选择」——不会点一下就替用户回话。
    case "choose": {
      const id = button.dataset.question!,
        label = button.dataset.label!;
      const question = status?.questions.find((item) => item.id === id);
      const picked = answers[id] ?? [];
      answers[id] = question?.multiSelect
        ? picked.includes(label)
          ? picked.filter((item) => item !== label)
          : [...picked, label]
        : picked.includes(label)
          ? []
          : [label];
      renderChat();
      break;
    }
    case "toggle-question": {
      const id = button.dataset.question!,
        label = button.dataset.label!;
      const picked = answers[id] ?? [];
      answers[id] = picked.includes(label)
        ? picked.filter((item) => item !== label)
        : [...picked, label];
      renderChat();
      break;
    }
    case "answer-choice": {
      const id = button.dataset.question!;
      const question = status?.questions.find((item) => item.id === id);
      const picked = answers[id] ?? [];
      if (!question || !picked.length) throw new Error("请先选一项");
      await call({
        op: "send",
        text: `${question.header}：${picked.join("、")}`,
      });
      break;
    }
    case "answer-multi": {
      const id = button.dataset.question!;
      const question = status?.questions.find((item) => item.id === id);
      const picked = answers[id] ?? [];
      if (!question || !picked.length) throw new Error("请先选择至少一项");
      await call({
        op: "send",
        text: `${question.header}：${picked.join("、")}`,
      });
      break;
    }
    case "approve":
      if (button.dataset.text)
        await call({ op: "send", text: button.dataset.text });
      break;
    // Discussing means the user wants to talk it over, not answer: hand them the
    // composer instead of sending anything on their behalf.
    case "discuss": {
      document.getElementById("agent-text")?.focus();
      break;
    }
    case "clear-plan":
      await call({ op: "clear_plan" });
      break;
    case "edit-schedule":
      editingSchedule = button.dataset.id ?? null;
      renderSheet();
      break;
    case "cancel-edit-schedule":
      editingSchedule = null;
      renderSheet();
      break;
    case "toggle-schedule": {
      const item = status?.schedules.find((x) => x.id === button.dataset.id);
      if (!item) break;
      await tool("save_schedule", { ...item, enabled: !item.enabled });
      await refreshAgent();
      break;
    }
    case "delete-schedule":
      await tool("delete_schedule", { id: button.dataset.id });
      await refreshAgent();
      break;
    case "delete-memory":
      await call({ op: "memory_delete", id: button.dataset.id });
      delete memoryEdits[button.dataset.id!];
      break;
    case "switch-persona":
      // 点卡片即切换；当前人格或忙碌时不发无谓请求。
      if (
        button.dataset.id === status?.persona ||
        status?.busy ||
        requestPending
      )
        break;
      await tool("switch_persona", { id: button.dataset.id });
      await refreshAgent();
      hooks.toast("已切换人格");
      break;
    case "edit-persona": {
      const persona = status?.personas?.find((p) => p.id === button.dataset.id);
      if (!persona) break;
      editingPersona = persona.id;
      personaDraft = {
        name: persona.name,
        emoji: persona.emoji,
        summary: persona.summary,
        identity: persona.identity,
        style: persona.style,
        shadow: persona.shadow,
        awaken: persona.awaken,
        fantasy: persona.fantasy,
        greeting: persona.greeting,
      };
      renderSheet();
      break;
    }
    case "new-persona":
      editingPersona = null;
      personaDraft = {};
      renderSheet();
      break;
    case "delete-persona":
      await tool("delete_persona", { id: button.dataset.id });
      if (editingPersona === button.dataset.id) {
        editingPersona = null;
        personaDraft = {};
      }
      await refreshAgent();
      hooks.toast("人格已删除");
      break;
  }
  update();
}
