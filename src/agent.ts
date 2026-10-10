import { agentCall, desktop, openAgentLogin, downloadJson } from "./api";
import type { Snapshot } from "./types";

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
};
let status: AgentStatus | null = null;
let review: Review | null = null;
let reviewing = "";
let draft = "";
let memoryDraft = "";
let configDraft: Record<string, string | boolean> = {};
const memoryEdits: Record<string, string> = {};
const rendered = new Map<string, { element: HTMLElement; html: string }>();
let refreshing = false;
let serial = 0;
let sheet: "settings" | "memory" | "plans" | "signals" | null = null;
let openedAuthUrl = "";
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
export function agentPage(): string {
  const files = status?.files.length ?? 0;
  const signals = status?.anomalies.length ?? 0;
  const badge = (count: number) => (count ? `<b>${count}</b>` : "");
  return `<div id="agent-root"><div class="page-heading"><div><h1>学习助手</h1></div><div class="agent-topbar">
    <button class="button small" data-agent="plans">方案${badge(files)}</button>
    <button class="button small" data-agent="memory">记忆</button>
    <button class="button small" data-agent="signals">信号${badge(signals)}</button>
    <button class="button small" data-agent="settings">设置</button>
    <button class="button small" data-agent="new">新对话</button>
  </div></div>
  <div id="agent-panel" class="agent-layout">
    <section class="card agent-conversation">
      <div id="agent-run-status" role="status"></div>
      <div id="agent-messages" class="agent-messages" aria-live="polite"></div>
      <form id="agent-chat">
        <textarea id="agent-text" name="text" rows="3" maxlength="32000" placeholder="问点什么，或贴一段最近的安排">${esc(draft)}</textarea>
        <div class="agent-actions"><span>对话与记忆保存在本机</span><button type="button" class="button" data-agent="cancel">停止</button><button class="button primary" type="submit">发送</button></div>
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
    `<div class="agent-state ${status.error ? "error" : ""}">${status.busy ? esc(status.authenticating ? "正在登录…" : status.tool ? `正在检查：${status.tool}` : "正在分析…") : status.error ? esc(status.error) : "准备好了"}</div>`,
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
  document
    .querySelector<HTMLButtonElement>("#agent-chat button[type=submit]")
    ?.toggleAttribute(
      "disabled",
      status.busy ||
        !status.preferences.enabled ||
        !status.providers?.[status.preferences.provider]?.configured,
    );
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
  };
  const body = () => {
    if (currentSheet === "settings")
      return `<form id="agent-config-form"><div class="agent-form-grid">
        <label>后端<select name="provider"><option value="deepseek" ${field("provider", p.provider) === "deepseek" ? "selected" : ""}>DeepSeek · API</option><option value="openai-codex" ${field("provider", p.provider) === "openai-codex" ? "selected" : ""}>Codex · 账号</option></select></label>
        <label>模型<input name="model" list="agent-models" value="${esc(field("model", p.model))}" placeholder="留空用默认"><datalist id="agent-models"></datalist></label>
        <label>DeepSeek API Key<input name="apiKey" type="password" autocomplete="off" placeholder="留空保留" value="${esc(field("apiKey", ""))}"></label>
        <label>Exa API Key（可选）<input name="exaKey" type="password" autocomplete="off" placeholder="留空用免费额度" value="${esc(field("exaKey", ""))}"></label>
        <label>每日可用分钟<input name="dailyCapacityMinutes" type="number" min="15" max="1440" value="${esc(field("dailyCapacityMinutes", p.dailyCapacityMinutes?.toString() ?? ""))}"></label>
        <label>自动唤醒上限（次/日）<input name="maxAutoWakesPerDay" type="number" min="0" max="12" value="${esc(field("maxAutoWakesPerDay", String(p.maxAutoWakesPerDay)))}"></label>
        <label>冷却（小时）<input name="cooldownHours" type="number" min="1" max="168" value="${esc(field("cooldownHours", String(p.cooldownHours)))}"></label>
        <label>安静时段<input type="time" name="quietStart" value="${esc(field("quietStart", p.quietStart))}"> – <input type="time" name="quietEnd" value="${esc(field("quietEnd", p.quietEnd))}"></label>
      </div><div class="agent-checks"><label class="agent-check"><input type="checkbox" name="enabled" ${checked("enabled", p.enabled)}>启用</label><label class="agent-check"><input type="checkbox" name="automatic" ${checked("automatic", p.automatic)}>异常时自动唤醒</label></div>
      <div class="agent-actions"><button class="button primary" type="submit">保存</button><button class="button" type="button" data-agent="login">登录 Codex</button><button class="button" type="button" data-agent="logout">退出</button></div></form>
      <div id="agent-auth">${authHtml()}</div>
      <details class="agent-more"><summary>MCP 与私有目录</summary><pre id="agent-mcp">${esc(pretty(s.mcpConfig))}</pre><p class="muted" id="agent-directory">${esc(s.dataDir)}</p></details>`;
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
    if (currentSheet === "plans")
      return `<div class="agent-actions"><button class="button small" data-agent="export-plan">导出计划</button><button class="button small" data-agent="export-backup">导出备份</button></div><div id="agent-files">${
        s.files
          .map(
            (f) =>
              `<div class="agent-file"><div><b>${esc(f.name)}</b><small>${(f.bytes / 1024).toFixed(1)} KB</small></div><button class="button small" data-agent="review" data-name="${esc(f.name)}">审阅</button><button class="button small" data-agent="download" data-name="${esc(f.name)}">导出</button></div>`,
          )
          .join("") ||
        `<p class="agent-empty">还没有方案文件。让助手改安排，或先导出一份。</p>`
      }</div><div id="agent-review">${reviewHtml()}</div>`;
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
  return `<div class="agent-review"><h3>${esc(review.name)}</h3><p>${esc(review.effects)}</p><div class="agent-diff-list">${review.changes.length ? review.changes.map((c) => `<details><summary>${esc(c.path)}</summary><div class="agent-diff"><pre>原值\n${esc(pretty(c.before))}</pre><pre>新值\n${esc(pretty(c.after))}</pre></div></details>`).join("") : "<p>没有数据变化。</p>"}</div>${review.truncated ? '<p class="muted">变化较多，只显示前100项。</p>' : ""}<label class="agent-check"><input type="checkbox" id="agent-apply-confirm">我已审阅</label><button class="button primary" data-agent="apply" ${review.changes.length ? "" : "disabled"}>应用修改</button></div>`;
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
function update() {
  if (!hooks?.active() || !status) return;
  renderChat();
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
      provider: String(data.get("provider")),
      model: String(data.get("model")).trim(),
      dailyCapacityMinutes: data.get("dailyCapacityMinutes")
        ? Number(data.get("dailyCapacityMinutes"))
        : null,
      maxAutoWakesPerDay: Number(data.get("maxAutoWakesPerDay")),
      cooldownHours: Number(data.get("cooldownHours")),
      quietStart: String(data.get("quietStart")),
      quietEnd: String(data.get("quietEnd")),
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
  else if (form.id === "agent-memory-add") {
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
      openSheet(button.dataset.agent as NonNullable<typeof sheet>);
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
        renderSheet();
      }
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
      if (
        !review ||
        !document.querySelector<HTMLInputElement>("#agent-apply-confirm")
          ?.checked
      )
        throw new Error("请先确认已审阅");
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
