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
export function agentPage(): string {
  const p = status?.preferences ?? defaults;
  return `<div class="page-heading"><div><div class="eyebrow">LEARN WITH YOUR GOALS IN MIND</div><h1>学习助手 <small class="agent-tag">Agent</small></h1><p>从学情与愿景出发，帮你找到下一步。</p></div></div>
  <div id="agent-panel" class="agent-layout">
    <section class="card agent-conversation"><div class="card-heading"><div><h2>一起理清学习安排</h2><p>自动唤醒只分析、追问和生成待审阅文件，应用前由你确认。</p></div><button class="button small" data-agent="new">新对话</button></div>
    <div id="agent-run-status" role="status"></div><div id="agent-messages" class="agent-messages" aria-live="polite"></div>
    <form id="agent-chat"><label for="agent-text">告诉助手你的问题或最近的变化</label><textarea id="agent-text" name="text" rows="4" maxlength="32000" placeholder="例如：明天的安排有些满，先看看证据，问清楚我的可用时间，再给一个待审阅方案。">${esc(draft)}</textarea><div class="agent-actions"><span>记忆与历史保存在本机，分析所需内容会发送给所选后端。</span><button type="button" class="button" data-agent="cancel">停止</button><button class="button primary" type="submit">发送</button></div></form>
    <details class="agent-config" ${!status?.providers?.[p.provider]?.configured ? "open" : ""}><summary>连接与自动唤醒配置</summary><form id="agent-config-form"><div class="agent-form-grid">
      <label class="agent-check"><input type="checkbox" name="enabled" ${checked("enabled", p.enabled)}>启用学习助手</label><label class="agent-check"><input type="checkbox" name="automatic" ${checked("automatic", p.automatic)}>允许异常自动唤醒并切页</label>
      <label>后端<select name="provider"><option value="deepseek" ${field("provider", p.provider) === "deepseek" ? "selected" : ""}>DeepSeek · API</option><option value="openai-codex" ${field("provider", p.provider) === "openai-codex" ? "selected" : ""}>Codex · 账号</option></select></label>
      <label>模型<input name="model" list="agent-models" value="${esc(field("model", p.model))}" placeholder="留空使用后端默认模型"><datalist id="agent-models"></datalist></label>
      <label class="agent-key">DeepSeek API Key<input name="apiKey" type="password" autocomplete="off" placeholder="留空保留已保存的密钥" value="${esc(field("apiKey", ""))}"></label>
      <label class="agent-key">Exa API Key（可选）<input name="exaKey" type="password" autocomplete="off" placeholder="留空使用免 Key 的 Exa 搜索额度" value="${esc(field("exaKey", ""))}"></label>
      <label>每日可用学习时间（分钟）<input type="number" name="dailyCapacityMinutes" min="15" max="1440" placeholder="留空按历史/目标预算提示" value="${esc(field("dailyCapacityMinutes", p.dailyCapacityMinutes?.toString() ?? ""))}"></label>
      <label>每日最多自动唤醒次数<input type="number" name="maxAutoWakesPerDay" min="0" max="12" value="${esc(field("maxAutoWakesPerDay", String(p.maxAutoWakesPerDay)))}"></label>
      <label>同一异常冷却（小时）<input type="number" name="cooldownHours" min="1" max="168" value="${esc(field("cooldownHours", String(p.cooldownHours)))}"></label>
      <label>安静时段开始<input type="time" name="quietStart" value="${esc(field("quietStart", p.quietStart))}"></label><label>安静时段结束<input type="time" name="quietEnd" value="${esc(field("quietEnd", p.quietEnd))}"></label>
    </div><p class="muted">正在计时、暂停计时或锁机时先排队，结束后再唤醒。相同起止时间表示不设安静时段；未启用或未连接时不调用模型。</p><div class="agent-actions"><button class="button primary" type="submit">保存连接配置</button><button class="button" type="button" data-agent="login">登录 Codex 账号</button><button class="button" type="button" data-agent="logout">退出当前后端</button></div></form><div id="agent-auth"></div></details></section>
    <aside class="agent-support"><section class="card"><div class="card-heading"><div><h2>学情信号</h2><p>本地检测，每项都保留证据。</p></div></div><div id="agent-evidence"></div></section>
    <section class="card"><div class="card-heading"><div><h2>待审阅方案</h2><p>先校验并查看变化，再应用。</p></div></div><div class="agent-actions"><button class="button small" data-agent="export-plan">导出计划</button><button class="button small" data-agent="export-backup">导出备份</button></div><div id="agent-files"></div><div id="agent-review"></div></section>
    <section class="card"><div class="card-heading"><div><h2>学情与愿景记忆</h2><p>模型记忆待你确认，可以修改和删除。</p></div></div><div id="agent-memories"></div><form id="agent-memory-add"><label for="agent-memory-text">补充你的背景或长期愿景</label><textarea id="agent-memory-text" name="text" rows="3" maxlength="8000" placeholder="可用时间、当前阶段、愿景或稳定偏好">${esc(memoryDraft)}</textarea><button class="button small" type="submit">保存为已确认记忆</button></form></section>
    <section class="card"><div class="card-heading"><h2>内置学习技能</h2></div><div class="agent-skills"><span>证据诊断</span><span>学习规划</span><span>长期记忆</span><span>文件批量修改</span></div><p class="muted">助手按当前问题选取技能，先核实背景，再生成可执行方案。</p><details><summary>MCP 与私有工作区</summary><p>外部 MCP 客户端连接当前运行的软件，可读取与直接操作数据。保护规则仍然生效。</p><pre id="agent-mcp"></pre><p class="muted" id="agent-directory"></p></details></section></aside>
  </div>`;
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
function update() {
  if (!hooks?.active() || !status) return;
  replace(
    "agent-run-status",
    `<div class="agent-state ${status.error ? "error" : ""}">${status.busy ? esc(status.authenticating ? "正在登录…" : status.tool ? `正在检查：${status.tool}` : "正在分析…") : status.error ? esc(status.error) : "准备好了 · 修改由你确认"}</div>`,
  );
  const messages = status.messages.slice(-60);
  const history = messages
    .map(
      (m) =>
        `<article class="agent-message ${m.role}"><div>${m.role === "user" ? (m.automatic ? "异常自动唤醒" : "我") : "学习助手"}<time>${new Date(m.at * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time></div><p>${esc(m.automatic && m.role === "user" ? "本地发现学习安排信号，已请助手核实证据并提出必要追问。" : m.text)}</p></article>`,
    )
    .join("");
  const messagesEl = document.getElementById("agent-messages");
  const nearBottom = messagesEl
    ? messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight <
      90
    : true;
  replace(
    "agent-messages",
    history +
      (status.stream
        ? `<article class="agent-message assistant streaming"><div>学习助手 · 分析中</div><p>${esc(status.stream)}</p></article>`
        : !messages.length
          ? `<div class="agent-empty">先补充你的愿景与学情，或直接提出问题。助手会读取当前任务，遇到不确定的信息先问你。</div>`
          : ""),
  );
  if (messagesEl && nearBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
  replace(
    "agent-evidence",
    status.anomalies.length
      ? status.anomalies
          .map(
            (a) =>
              `<details class="agent-signal"><summary>${esc(a.title)}</summary><p>${esc(a.question)}</p><pre>${esc(pretty(a.evidence))}</pre></details>`,
          )
          .join("")
      : `<p class="agent-empty">暂无需要提醒的异常。没有记录时不会推断你没有学习。</p>`,
  );
  replace(
    "agent-files",
    status.files
      .map(
        (f) =>
          `<div class="agent-file"><div><b>${esc(f.name)}</b><small>${(f.bytes / 1024).toFixed(1)} KB</small></div><button class="button small" data-agent="review" data-name="${esc(f.name)}">审阅</button><button class="button small" data-agent="download" data-name="${esc(f.name)}">导出文件</button></div>`,
      )
      .join("") ||
      `<p class="agent-empty">助手生成的修改文件会出现在这里，也可以先手动导出供外部编辑。</p>`,
  );
  replace(
    "agent-review",
    review
      ? `<div class="agent-review"><h3>${esc(review.name)}</h3><p>${esc(review.effects)}</p>${review.changes.length ? review.changes.map((c) => `<details><summary>${esc(c.path)}</summary><div class="agent-diff"><pre>原值\n${esc(pretty(c.before))}</pre><pre>新值\n${esc(pretty(c.after))}</pre></div></details>`).join("") : "<p>没有数据变化。</p>"}${review.truncated ? "<p>变化较多，只显示前100项。请完整检查导出文件后再应用。</p>" : ""}<label class="agent-check"><input type="checkbox" id="agent-apply-confirm">我已审阅变化与导入影响</label><button class="button primary" data-agent="apply" ${review.changes.length ? "" : "disabled"}>应用修改</button><p class="muted">应用时会再次检查文件和软件数据，变化后需要重新导出。</p></div>`
      : reviewing
        ? `<p>${esc(reviewing)}</p>`
        : "",
  );
  const memories = document.getElementById("agent-memories");
  if (!memories?.contains(document.activeElement))
    replace(
      "agent-memories",
      status.memories
        .map(
          (m) =>
            `<form class="agent-memory" data-memory="${esc(m.id)}"><div><span class="agent-tag ${m.confirmed ? "confirmed" : ""}">${m.confirmed ? "已确认" : "待确认"}</span><small>${esc(m.kind)}</small></div><textarea name="text" rows="3" maxlength="8000">${esc(memoryEdits[m.id] ?? m.text)}</textarea><p class="muted">来源：${esc(m.source)}</p><div class="agent-actions"><button class="button small" type="submit">${m.confirmed ? "保存修改" : "确认并保存"}</button><button class="button small" type="button" data-agent="delete-memory" data-id="${esc(m.id)}">删除</button></div></form>`,
        )
        .join("") || `<p class="agent-empty">还没有长期记忆。</p>`,
    );
  replace("agent-mcp", esc(pretty(status.mcpConfig)));
  const dir = document.getElementById("agent-directory");
  if (dir)
    dir.textContent = `本地私有目录：${status.dataDir}。工作文件在 workspace；认证独立保存，不写入任务备份。`;
  const provider = String(field("provider", status.preferences.provider));
  replace(
    "agent-models",
    (status.providers?.[provider]?.models ?? [])
      .map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`)
      .join(""),
  );
  const event = status.authEvent;
  replace(
    "agent-auth",
    `<p class="muted">DeepSeek：${status.providers?.deepseek?.configured ? "已配置" : "未配置"} · Codex：${status.providers?.["openai-codex"]?.configured ? "已登录" : "未登录"} · Exa：${status.providers?.exa?.configured ? "已配置 Key" : "免 Key"}</p>${event?.url ? `<p>${esc(event.instructions)}</p><button class="button" data-agent="open-login">在浏览器中登录</button><p class="agent-auth-url">${esc(event.url)}</p>` : ""}${event?.message ? `<p>${esc(event.message)}</p>` : ""}${event?.type === "prompt" ? `<form id="agent-login-answer"><label>如果浏览器没有自动完成，可粘贴回调链接/代码<input name="text" autocomplete="off"></label><button class="button small" type="submit">继续登录</button></form>` : ""}`,
  );
  document
    .querySelector<HTMLButtonElement>("#agent-chat button[type=submit]")
    ?.toggleAttribute(
      "disabled",
      status.busy ||
        !status.preferences.enabled ||
        !status.providers?.[status.preferences.provider]?.configured,
    );
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
export function mountAgent() {
  const panel = document.getElementById("agent-panel");
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
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "[data-agent]",
    );
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
    const key = form.elements.namedItem("apiKey") as HTMLInputElement;
    key.value = "";
    (form.elements.namedItem("exaKey") as HTMLInputElement).value = "";
    hooks.toast("连接配置已保存到本机");
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
}
async function tool<T>(name: string, args: Record<string, unknown> = {}) {
  return agentCall<T>({ op: "tool", name, arguments: args });
}
async function action(button: HTMLButtonElement) {
  const name = button.dataset.name;
  switch (button.dataset.agent) {
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
      reviewing = "正在校验文件与数据版本…";
      update();
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
        update();
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
        throw new Error("请先确认已审阅变化与导入影响");
      const snapshot = await tool<Snapshot>("apply_file", {
        name: review.name,
        fileHash: review.fileHash,
      });
      review = null;
      hooks.accept(snapshot);
      hooks.toast("方案已应用");
      await refreshAgent();
      break;
    }
  }
}
