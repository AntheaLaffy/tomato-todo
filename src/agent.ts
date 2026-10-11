import { agentCall, desktop, openAgentLogin, downloadJson } from "./api";
import type { Snapshot } from "./types";
import { runHandScript } from "./hand";
import type { HandStep } from "./hand";

type Preferences = {
  enabled: boolean;
  automatic: boolean;
  provider: string;
  model: string;
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
type Review = {
  name: string;
  fileHash: string;
  kind: string;
  valid: boolean;
  effects: string;
  changes: { path: string; before?: unknown; after?: unknown }[];
  truncated: boolean;
};
export type AgentStatus = {
  preferences: Preferences;
  memories: Memory[];
  messages: {
    id: string;
    role: string;
    text: string;
    automatic: boolean;
    at: number;
  }[];
  busy: boolean;
  authenticating: boolean;
  stream: string;
  error: string | null;
  tool: string;
  wakeSerial: number;
  providers: Record<
    string,
    { configured: boolean; models: { id: string; name: string }[] }
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
  files: { name: string; bytes: number; reviewable: boolean }[];
  /** Files already validated and waiting for the user's approval. */
  reviewed: string[];
  conversations: {
    id: string;
    title: string;
    updatedAt: number;
    messageCount: number;
    active: boolean;
  }[];
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
  dailyCapacityMinutes: null,
  maxAutoWakesPerDay: 3,
  cooldownHours: 24,
  quietStart: "22:00",
  quietEnd: "08:00",
  codingAccess: "workspace",
};
let status: AgentStatus | null = null;
let review: Review | null = null;
let reviewing = "";
let draft = "";
let memoryDraft = "";
let configDraft: Record<string, string | boolean> = {};
const memoryEdits: Record<string, string> = {};
/** Multi-select drafts, keyed by question id; cleared when the questions change. */
const answers: Record<string, string[]> = {};
let questionsSignature = "";
let handSerial = 0;
let deedsSerial = 0;
const rendered = new Map<string, { element: HTMLElement; html: string }>();
let refreshing = false;
let serial = 0;
let sheet:
  "settings" | "memory" | "plans" | "signals" | "conversations" | null = null;
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
const checked = (name: string, fallback: boolean) =>
  field(name, fallback) ? "checked" : "";

// The conversation page stays a conversation: connection, keys, memory, files
// and signals live in sheets that open on demand.
/** Put text in the composer from elsewhere in the app (e.g. "hand me the timetable"). */
export function prefillAgent(text: string) {
  draft = text;
  const box = document.getElementById(
    "agent-text",
  ) as HTMLTextAreaElement | null;
  if (box) box.value = text;
}
export function agentPage(): string {
  const files = status?.files.length ?? 0;
  const signals = status?.anomalies.length ?? 0;
  const badge = (count: number) => (count ? `<b>${count}</b>` : "");
  return `<div id="agent-root"><div class="page-heading"><div><h1>学习助手</h1></div><div class="agent-topbar">
    <button class="button small" data-agent="plans">方案${badge(files)}</button>
    <button class="button small" data-agent="memory">记忆</button>
    <button class="button small" data-agent="signals">信号${badge(signals)}</button>
    <button class="button small" data-agent="conversations">会话</button>
    <button class="button small" data-agent="settings">设置</button>
    <button class="button small" data-agent="new">新对话</button>
  </div></div>
  <div id="agent-panel" class="agent-layout">
    <section class="card agent-conversation">
      <div id="agent-run-status" role="status"></div>
      <div id="agent-messages" class="agent-messages" aria-live="polite"></div>
      <div id="agent-plan"></div>
      <div id="agent-questions"></div>
      <form id="agent-chat">
        <textarea id="agent-text" name="text" rows="3" maxlength="32000" placeholder="问点什么，或贴一段最近的安排">${esc(draft)}</textarea>
        <div class="agent-actions"><span class="agent-status"><span class="agent-model" id="agent-model">${modelSelectHtml()}</span><span class="agent-usage" id="agent-usage">${usageHtml()}</span></span><button type="button" class="button" data-agent="cancel">停止</button><button class="button primary" type="submit">发送</button></div>
      </form>
    </section>
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
function renderChat() {
  if (!status) return;
  replace(
    "agent-run-status",
    `<div class="agent-state ${status.error ? "error" : status.busy ? "busy" : ""}">${status.busy ? `<i class="agent-spinner"></i>${esc(status.authenticating ? "正在登录…" : status.tool ? `正在调用：${status.tool}` : "正在分析…")}` : status.error ? esc(status.error) : "准备好了"}</div>`,
  );
  const messages = status.messages.slice(-60);
  const html = messages
    .map(
      (m) =>
        `<article class="agent-message ${m.role}"><div>${m.role === "user" ? (m.automatic ? "自动" : "我") : "助手"}<time>${new Date(m.at * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time></div><p>${esc(m.automatic && m.role === "user" ? "本地发现学习安排信号，已请助手核实。" : m.text)}</p></article>`,
    )
    .join("");
  const messagesEl = document.getElementById("agent-messages");
  const nearBottom = messagesEl
    ? messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight <
      90
    : true;
  replace(
    "agent-messages",
    html +
      (status.stream
        ? `<article class="agent-message assistant streaming"><div>助手</div><p>${esc(status.stream)}</p></article>`
        : !messages.length
          ? `<div class="agent-empty">问点什么，或先让我看看最近的安排。</div>`
          : ""),
  );
  if (messagesEl && nearBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
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
  const modelBox = document.getElementById("agent-model");
  if (modelBox && !modelBox.contains(document.activeElement))
    replace("agent-model", modelSelectHtml());
  document
    .querySelector<HTMLButtonElement>("#agent-chat button[type=submit]")
    ?.toggleAttribute(
      "disabled",
      status.busy ||
        !status.providers?.[status.preferences.provider]?.configured,
    );
}
/**
 * The questions a turn is waiting on. A plan-review intent becomes an approval
 * card (approve / discuss), `multiSelect` toggles instead of answering at once,
 * and every question accepts free text — the shape deepseek-harness uses.
 */
function questionHtml(): string {
  const questions = status?.questions ?? [];
  const signature = JSON.stringify(questions);
  if (signature !== questionsSignature) {
    questionsSignature = signature;
    for (const key of Object.keys(answers)) delete answers[key];
  }
  const other = (question: (typeof questions)[number]) =>
    `<form class="agent-other" data-question="${esc(question.id)}"><input name="text" maxlength="2000" placeholder="其他想法（回车发送）" aria-label="${esc(question.question)}的自定义回答"><button class="button small" type="submit">发送</button></form>`;
  return questions
    .map((question) => {
      const picked = answers[question.id] ?? [];
      const review = question.intent?.kind === "plan-review";
      const options = question.options
        .map((option) => {
          const chosen = picked.includes(option.label);
          const approve = review && option.label === question.intent?.approve;
          const classes = [
            "agent-option",
            question.multiSelect ? "toggle" : "",
            chosen ? "picked" : "",
            approve ? "approve" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const action = question.multiSelect
            ? "toggle-question"
            : approve
              ? "approve"
              : "answer";
          return `<button class="${classes}" type="button" data-agent="${action}" data-question="${esc(question.id)}" data-label="${esc(option.label)}" data-text="${esc(`${question.header}：${option.label}`)}"${option.description ? ` title="${esc(option.description)}"` : ""}><b>${esc(option.label)}</b><small>${esc(option.description)}</small></button>`;
        })
        .join("");
      if (review)
        return `<section class="agent-proposal" data-plan-review="${esc(question.id)}"><div class="agent-proposal-strip"><i></i>待批准</div><div class="agent-proposal-body"><h3>${esc(question.header)}</h3><p>${esc(question.question)}</p>${question.detail ? `<pre>${esc(question.detail)}</pre>` : ""}</div><div class="agent-proposal-actions"><button class="button" type="button" data-agent="discuss">讨论</button>${options}</div></section>`;
      const submit =
        question.multiSelect && picked.length
          ? `<button class="button small primary" type="button" data-agent="answer-multi" data-question="${esc(question.id)}">提交选择（${picked.length}）</button>`
          : "";
      return `<div class="agent-question"><div class="agent-question-head">${esc(question.header)}</div><p>${esc(question.question)}</p>${question.detail ? `<p class="agent-question-detail">${esc(question.detail)}</p>` : ""}<div class="agent-question-options">${options}</div><div class="agent-question-foot">${submit}${other(question)}</div></div>`;
    })
    .join("");
}
function authHtml() {
  const s = status;
  if (!s) return "";
  const event = s.authEvent;
  const provider = (name: string, label: string, ready: string) =>
    `<span class="agent-dot ${s.providers?.[name]?.configured ? "on" : ""}"></span>${label} ${s.providers?.[name]?.configured ? ready : "未连接"}`;
  return `<div class="agent-auth">${provider("deepseek", "DeepSeek", "已配置")} · ${provider("openai-codex", "Codex", "已登录")} · <span class="agent-dot ${s.providers?.exa?.configured ? "on" : ""}"></span>Exa ${s.providers?.exa?.configured ? "已配置 Key" : "免 Key"}</div>
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
      return `<optgroup label="${label}">${options.join("")}</optgroup>`;
    })
    .join("");
  return `<select id="agent-model-select" aria-label="后端与模型">${groups}</select>`;
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
  const title: Record<string, string> = {
    settings: "设置",
    memory: "记忆",
    plans: "方案与文件",
    signals: "学情信号",
    conversations: "会话",
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
      <details class="agent-more"><summary>MCP 与私有目录</summary><pre id="agent-mcp">${esc(pretty(s.mcpConfig))}</pre><p class="muted" id="agent-directory">${esc(s.dataDir)}</p></details>`;
    if (currentSheet === "conversations")
      return `<div class="agent-actions"><button class="button small" data-agent="new">新对话</button></div><div id="agent-conversations">${
        (s.conversations ?? [])
          .map(
            (c) =>
              `<div class="agent-conversation-row ${c.active ? "active" : ""}"><button class="agent-conversation-open" type="button" data-agent="switch-conversation" data-id="${esc(c.id)}"><b>${esc(c.title)}</b><small>${new Date(c.updatedAt * 1000).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} · ${c.messageCount} 条</small></button><button class="icon-btn tiny" type="button" data-agent="delete-conversation" data-id="${esc(c.id)}" aria-label="删除会话">✕</button></div>`,
          )
          .join("") || `<p class="agent-empty">还没有会话。</p>`
      }</div>`;
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
    if (currentSheet === "plans") {
      const reviewed = new Set(s.reviewed ?? []);
      return `<div class="agent-actions"><button class="button small" data-agent="export-plan">导出计划</button><button class="button small" data-agent="export-backup">导出备份</button></div><div id="agent-files">${
        s.files
          .map(
            (f) =>
              `<div class="agent-file ${reviewed.has(f.name) ? "pending" : ""}"><div><b>${esc(f.name)}</b><small>${(f.bytes / 1024).toFixed(1)} KB${reviewed.has(f.name) ? " · 已审阅，待批准" : ""}</small></div><button class="button small" data-agent="review" data-name="${esc(f.name)}">审阅</button>${
                reviewed.has(f.name)
                  ? `<button class="button small primary" data-agent="approve-file" data-name="${esc(f.name)}">批准并应用</button><button class="button small" data-agent="reject" data-name="${esc(f.name)}">暂不批准</button>`
                  : ""
              }<button class="button small" data-agent="download" data-name="${esc(f.name)}">导出</button></div>`,
          )
          .join("") ||
        `<p class="agent-empty">还没有方案文件。让助手改安排，或先导出一份。</p>`
      }</div><div id="agent-review">${reviewHtml()}</div>`;
    }
    return `<div id="agent-evidence">${
      s.anomalies
        .map(
          (a) =>
            `<details class="agent-signal"><summary>${esc(a.title)}</summary><p>${esc(a.question)}</p><pre>${esc(pretty(a.evidence))}</pre></details>`,
        )
        .join("") || `<p class="agent-empty">暂无异常。</p>`
    }</div>`;
  };
  return `<section class="agent-sheet-card" role="dialog" aria-label="${esc(title[currentSheet])}"><header><h2>${esc(title[currentSheet])}</h2><button class="icon-btn" data-agent="close-sheet" aria-label="关闭">✕</button></header><div class="agent-sheet-body">${body()}</div></section>`;
}
function reviewHtml() {
  if (!review) return reviewing ? `<p>${esc(reviewing)}</p>` : "";
  // Approving is the consent: the diff sits right above the button, so no extra
  // checkbox stands between the user's decision and the change.
  return `<div class="agent-review"><h3>${esc(review.name)}</h3><p>${esc(review.effects)}</p><div class="agent-diff-list">${review.changes.length ? review.changes.map((c) => `<details><summary>${esc(c.path)}</summary><div class="agent-diff"><pre>原值\n${esc(pretty(c.before))}</pre><pre>新值\n${esc(pretty(c.after))}</pre></div></details>`).join("") : "<p>没有数据变化。</p>"}</div>${review.truncated ? '<p class="muted">变化较多，只显示前100项。</p>' : ""}<div class="agent-actions"><button class="button" type="button" data-agent="discuss">讨论后再定</button><button class="button" type="button" data-agent="reject" data-name="${esc(review.name)}">暂不批准</button><button class="button primary" data-agent="apply" ${review.changes.length ? "" : "disabled"}>批准并应用</button></div></div>`;
}
function renderSheet() {
  const element = document.getElementById("agent-sheet");
  if (!element) return;
  element.hidden = !sheet;
  if (!sheet) {
    element.innerHTML = "";
    return;
  }
  const html = sheetHtml();
  if (element.innerHTML !== html) element.innerHTML = html;
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
  if (!hooks?.active() || !status) return;
  renderChat();
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
async function call(request: Record<string, unknown>) {
  const result = await agentCall<AgentStatus>(request);
  status = result;
  update();
  return result;
}
export async function refreshAgent() {
  if (refreshing) return;
  refreshing = true;
  try {
    status = await agentCall<AgentStatus>({ op: "status" });
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
  void refreshAgent();
  setInterval(() => void refreshAgent(), 2500);
}
function openSheet(name: NonNullable<typeof sheet>) {
  sheet = name;
  renderSheet();
}
export function mountAgent() {
  const panel = document.getElementById("agent-root");
  if (!panel) return;
  panel.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;
    if (input.closest("#agent-chat")) draft = input.value;
    if (input.closest("#agent-memory-add")) memoryDraft = input.value;
    const memoryForm = input.closest<HTMLFormElement>("[data-memory]");
    if (memoryForm?.dataset.memory)
      memoryEdits[memoryForm.dataset.memory] = input.value;
    if (input.closest("#agent-config-form")) {
      configDraft[input.name] =
        input.type === "checkbox" ? input.checked : input.value;
    }
  });
  panel.addEventListener("change", (event) => {
    const select = event.target as HTMLSelectElement;
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
    const button = target.closest<HTMLButtonElement>("[data-agent]");
    if (!button) return;
    void action(button).catch((error) => hooks.toast(String(error)));
  });
  update();
  void refreshAgent();
  void loadUsage();
}
async function submit(form: HTMLFormElement) {
  const data = new FormData(form),
    text = String(data.get("text") ?? "").trim();
  if (form.id === "agent-chat") {
    await call({ op: "send", text });
    draft = "";
    form.reset();
  } else if (form.id === "agent-config-form") {
    const preferences: Preferences = {
      enabled: data.has("enabled"),
      automatic: data.has("automatic"),
      provider: status?.preferences.provider ?? "deepseek",
      model: status?.preferences.model ?? "",
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
async function action(button: HTMLButtonElement) {
  const name = button.dataset.name;
  switch (button.dataset.agent) {
    case "settings":
    case "memory":
    case "plans":
    case "signals":
    case "conversations":
      openSheet(button.dataset.agent as NonNullable<typeof sheet>);
      break;
    case "switch-conversation":
      await call({ op: "switch_conversation", id: button.dataset.id });
      break;
    case "delete-conversation":
      await call({ op: "delete_conversation", id: button.dataset.id });
      break;
    case "close-sheet":
      sheet = null;
      renderSheet();
      break;
    case "cancel":
      await call({ op: "cancel" });
      break;
    case "new":
      await call({ op: "new_conversation" });
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
    // Multi-select: toggle here, submit once — never answer mid-selection.
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
    case "reject":
      await agentCall({ op: "reject_file", name });
      hooks.toast("已暂缓这份提案，文件还在方案里");
      await refreshAgent();
      break;
    case "approve-file": {
      const file = await tool<{ fileHash: string }>("read_file", {
        name,
        pointer: "/version",
      });
      const checked = await tool<Review>("review_file", {
        name,
        fileHash: file.fileHash,
      });
      const snapshot = await tool<Snapshot>("apply_file", {
        name,
        fileHash: checked.fileHash,
      });
      hooks.accept(snapshot);
      hooks.toast("已批准并应用");
      review = null;
      sheet = null;
      renderSheet();
      await refreshAgent();
      break;
    }
    case "clear-plan":
      await call({ op: "clear_plan" });
      break;
    case "delete-memory":
      await call({ op: "memory_delete", id: button.dataset.id });
      delete memoryEdits[button.dataset.id!];
      break;
    case "export-plan":
    case "export-backup": {
      await tool(
        button.dataset.agent === "export-plan"
          ? "export_plan"
          : "export_backup",
        {
          name: `${button.dataset.agent === "export-plan" ? "plan" : "backup"}-${Date.now()}.json`,
        },
      );
      await refreshAgent();
      break;
    }
    case "review": {
      review = null;
      reviewing = "正在校验…";
      renderSheet();
      try {
        const file = await tool<{ fileHash: string }>("read_file", {
          name,
          pointer: "/version",
        });
        review = await tool<Review>("review_file", {
          name,
          fileHash: file.fileHash,
        });
      } finally {
        reviewing = "";
      }
      // Refresh first: the sheet marks this file as reviewed-then-pending, and the
      // status carries which files are waiting for approval.
      await refreshAgent();
      renderSheet();
      break;
    }
    case "download": {
      const file = await agentCall<{ content: unknown }>({
        op: "download_file",
        name,
      });
      downloadJson(file.content, name!);
      break;
    }
    case "apply": {
      if (!review) throw new Error("请先审阅这份文件");
      const snapshot = await tool<Snapshot>("apply_file", {
        name: review.name,
        fileHash: review.fileHash,
      });
      review = null;
      hooks.accept(snapshot);
      hooks.toast("已应用");
      sheet = null;
      renderSheet();
      await refreshAgent();
      break;
    }
  }
  update();
}
