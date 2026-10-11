// The host owns software mutations; this worker gets only the review tool set.
import { createInterface } from "node:readline";
import { readFile, writeFile, rename, mkdir, chmod } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { closeStudySession, createStudySession, mcpStatus } from "./session.mjs";
import { mcpCommand } from "./mcp-config.mjs";
import { networkTool } from "./web.mjs";
import { codexAuthDocument, codexAuthPath, codexProviderConfigs, normalizeCodexCredential, readCodexConfig } from "./codex-config.mjs";

process.umask(0o077);
const dir = resolve(process.argv[2]);
const root = import.meta.dirname;
const emit = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
let session, authAbort, loginReply;
const pending = new Map();
let job = false;
let cancelRequested = false;
let credentialsQueue = Promise.resolve();
async function credentialData() {
  try {
    return JSON.parse(await readFile(join(dir, "auth.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw new Error("认证文件损坏或无法读取，原文件已保留");
  }
}
async function codexCredential() {
  try { return normalizeCodexCredential(JSON.parse(await readFile(codexAuthPath, "utf8"))); }
  catch (error) { if (error.code === "ENOENT") return undefined; throw new Error("Codex CLI 认证文件损坏或无法读取"); }
}
async function syncCodexCredential(value, prior) {
  if (!value) return;
  let previous;
  try { previous = JSON.parse(await readFile(codexAuthPath, "utf8")); } catch (error) { if (error.code === "ENOENT") return; throw error; }
  // Pi's login does not return the id_token required by Codex CLI. Only update
  // a pre-existing CLI login so its complete authentication document survives.
  if (!previous?.tokens?.id_token || previous.tokens.refresh_token !== prior?.refresh || previous.tokens.account_id !== value.accountId) return;
  const temp = `${codexAuthPath}.${randomUUID()}.tmp`;
  await mkdir(dirname(codexAuthPath), { recursive: true, mode: 0o700 });
  await writeFile(temp, JSON.stringify(codexAuthDocument(value, previous), null, 2), { mode: 0o600 });
  await rename(temp, codexAuthPath);
}
function mutateCredential(fn) {
  const operation = credentialsQueue.then(async () => {
    const data = await credentialData();
    const result = await fn(data);
    const temp = join(dir, `.${randomUUID()}.auth.tmp`);
    await writeFile(temp, JSON.stringify(data), { mode: 0o600 });
    await rename(temp, join(dir, "auth.json"));
    return result;
  });
  credentialsQueue = operation.catch(() => {});
  return operation;
}
const credentials = {
  read: async (provider) => provider === "openai-codex"
    ? ((await codexCredential()) ?? (await credentialData())[provider])
    : (await credentialData())[provider],
  list: async () => {
    const data = await credentialData();
    const cli = await codexCredential();
    if (cli) data["openai-codex"] = cli;
    return Object.entries(data).map(([providerId, value]) => ({
      providerId,
      type: value.type,
    }));
  },
  modify: (provider, fn) =>
    mutateCredential(async (data) => {
      const prior = provider === "openai-codex" ? ((await codexCredential()) ?? data[provider]) : data[provider];
      const value = await fn(prior);
      if (value) data[provider] = value;
      if (provider === "openai-codex" && value) await syncCodexCredential(value, prior);
      return data[provider];
    }),
  delete: (provider) =>
    mutateCredential(async (data) => {
      delete data[provider];
      if (provider === "openai-codex") {
        try {
          const document = JSON.parse(await readFile(codexAuthPath, "utf8"));
          if (document?.tokens) {
            delete document.tokens;
            delete document.auth_mode;
            delete document.last_refresh;
            const temp = `${codexAuthPath}.${randomUUID()}.tmp`;
            await writeFile(temp, JSON.stringify(document, null, 2), { mode: 0o600 });
            await rename(temp, codexAuthPath);
          }
        } catch (error) { if (error.code !== "ENOENT") throw error; }
      }
    }),
};
async function usageJson(url, headers) {
  const response = await fetch(url, {
    headers: { accept: "application/json", ...headers },
    signal: AbortSignal.timeout(12000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return text ? JSON.parse(text) : {};
}
// Provider-side quota is not part of the Pi SDK: DeepSeek exposes a balance
// endpoint, and the ChatGPT subscription exposes rate-limit windows through the
// same backend Codex CLI reads. Both are best-effort; an error is reported as-is.
async function usageReport(provider) {
  const report = {};
  // Only the backend the user selected: querying the other one wastes a request
  // and shows numbers for a model that is not in use.
  if (provider === "deepseek") {
    const deepseek = await credentials.read("deepseek");
    if (deepseek?.key) {
      try {
        const data = await usageJson("https://api.deepseek.com/user/balance", {
          authorization: `Bearer ${deepseek.key}`,
        });
        report.deepseek = {
          available: data.is_available === true,
          balances: data.balance_infos ?? [],
        };
      } catch (error) {
        report.deepseek = { error: String(error.message) };
      }
    }
  } else if (provider === "openai-codex") {
    const codex = await credentials.read("openai-codex");
    if (codex?.access) {
      try {
        report.codex = await usageJson(
          "https://chatgpt.com/backend-api/wham/usage",
          {
            authorization: `Bearer ${codex.access}`,
            "chatgpt-account-id": codex.accountId ?? "",
          },
        );
      } catch (error) {
        report.codex = { error: String(error.message) };
      }
    }
  }
  return report;
}
const initialized = (async () => {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700);
  const runtime = await ModelRuntime.create({
    credentials,
    modelsPath: null,
    modelsStorePath: join(dir, "models-cache.json"),
    allowModelNetwork: false,
    refreshOnCreate: false,
  });
  // Codex CLI's provider table is the source of truth for third-party endpoints.
  // Refreshing this on process start makes edits made by `codex` visible without
  // copying secrets into the todo data directory.
  const config = await readCodexConfig();
  for (const provider of codexProviderConfigs(config)) {
    if (provider.id === "openai-codex" || !provider.baseUrl) continue;
    runtime.registerProvider(provider.id, provider);
  }
  return runtime;
})();
async function authStatus() {
  const runtime = await initialized;
  const stored = await credentialData();
  const configured = async (provider) => Boolean((await credentials.read(provider)) || runtime.hasConfiguredAuth(provider));
  const providers = Object.fromEntries(await Promise.all(
    ["deepseek", "openai-codex", ...runtime.getRegisteredProviderIds()].filter((provider, index, all) => all.indexOf(provider) === index).map(async (provider) => [
      provider,
      {
        configured: await configured(provider),
        models: runtime
          .getModels(provider)
          .map((m) => ({ id: m.id, name: m.name, vision:m.input.includes("image") })),
      },
    ])),
  );
  providers["exa"]={configured:Boolean(stored["exa"]),models:[]};
  emit({ type: "auth", providers });
}
function toolRequest(name, args, signal, jobId) {
  return new Promise((resolve, reject) => {
    const id = randomUUID();
    const abort = () => {
      pending.delete(id);
      reject(new Error("请求已停止"));
    };
    if (signal?.aborted) return abort();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("软件工具响应超时"));
    }, 30000);
    pending.set(id, {
      resolve: (v) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        resolve(v);
      },
      reject: (e) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        reject(e);
      },
    });
    signal?.addEventListener("abort", abort, { once: true });
    emit({ type: "tool_call", id, name, arguments: args, jobId });
  });
}
async function runPrompt(command) {
  // Replacing the session must shut it down: that is what stops the MCP servers it
  // started, so the next request does not stack another copy.
  await closeStudySession(session);
  const managerAndSession = await createStudySession({
    runtime: await initialized,
    dir,
    root,
    command,
    toolRequest:(name,args,signal)=>toolRequest(name,args,signal,command.jobId),
    credentials,
  });
  session = managerAndSession.session;
  const manager = managerAndSession.manager;
  emit({ type: "session", path: manager.getSessionFile() });
  cancelRequested = false;
  const unsubscribe = session.subscribe((event) => {
    if (
      event.type === "message_update" &&
      event.assistantMessageEvent?.type === "text_delta"
    )
      emit({ type: "text", text: event.assistantMessageEvent.delta });
    if (event.type === "tool_execution_start")
      emit({ type: "tool_start", name: event.toolName });
  });
  try {
    await session.prompt(command.text,{images:command.images||[]});
    emit({ type: "session", path: manager.getSessionFile() });
    const last = [...session.messages]
      .reverse()
      .find((m) => m.role === "assistant");
    // The SDK reports a cancel that lands during a tool call as stopReason "error"
    // plus an abort message, so count the user's own stop as a stop, not a fault.
    const interrupted = cancelRequested || last?.stopReason === "aborted";
    if (last?.stopReason === "error" && !interrupted)
      throw new Error(last.errorMessage || "模型请求失败");
    emit({
      type: "done",
      text:
        session.getLastAssistantText() ||
        (interrupted
          ? "分析已停止；已生成的文件仍可审阅。"
          : ""),
    });
  } finally {
    emit({ type: "session", path: manager.getSessionFile() });
    unsubscribe();
  }
}
async function authentication(command) {
  const runtime = await initialized;
  authAbort = new AbortController();
  if (command.op === "logout") await runtime.logout(command.provider);
  else if (command.op === "login" && await codexCredential()) {
    await authStatus();
    emit({ type: "done", text: "已使用 Codex CLI 登录" });
    authAbort = undefined;
    return;
  }
  else if (command.op!=="api_key" || command.key)
    await runtime.login(
      command.op === "api_key" ? "deepseek" : "openai-codex",
      command.op === "api_key" ? "api_key" : "oauth",
      {
        signal: authAbort.signal,
        notify: (event) => emit({ type: "auth_event", event }),
        prompt: (prompt) => {
          if (command.op === "api_key") return Promise.resolve(command.key);
          // The app runs on a desktop with a browser, so default the Codex login
          // method to browser instead of making the user answer a bare select.
          if (prompt.type === "select") {
            const browser =
              prompt.options?.find((option) => option.id === "browser") ??
              prompt.options?.[0];
            return Promise.resolve(browser?.id ?? "browser");
          }
          emit({
            type: "auth_event",
            event: {
              type: "prompt",
              message: prompt.message,
              promptType: prompt.type,
              placeholder: prompt.placeholder,
            },
          });
          return new Promise((resolve, reject) => {
            const abort = () => {
              loginReply = undefined;
              reject(new Error("登录已取消或由浏览器回调完成"));
            };
            const signal = prompt.signal ?? authAbort.signal;
            signal.addEventListener("abort", abort, { once: true });
            loginReply = (text) => {
              signal.removeEventListener("abort", abort);
              loginReply = undefined;
              resolve(text);
            };
          });
        },
      },
    );
  if(command.op==="api_key"&&command.exaKey)await credentials.modify("exa",async()=>({type:"api_key",key:command.exaKey}));
  await authStatus();
  emit({ type: "done", text: "" });
  authAbort = undefined;
}
async function handle(command) {
  if(command.op==="usage") {try{emit({type:"network_result",id:command.id,result:await usageReport(command.provider)});}catch(error){emit({type:"network_result",id:command.id,error:String(error.message)});}return;}
  if(command.op==="network") {try{const result=await networkTool(command.name,command.arguments,{runtime:await initialized,credentials,preferences:command.preferences},AbortSignal.timeout(20000));emit({type:"network_result",id:command.id,result});}catch(error){emit({type:"network_result",id:command.id,error:String(error.message)});}return;}
  // Codex-style MCP server management, over the app's own mcp.json.
  if(command.op==="mcp") {try{
    const result=await mcpCommand({agentDir:dir,cwd:join(dir,"workspace/coding"),action:command.action,server:command.server});
    // Connection failures never reach a file, so they ride along with the list.
    if(command.action==="list")result.runtimeErrors=[...mcpStatus.errors];
    emit({type:"network_result",id:command.id,result});
  }catch(error){emit({type:"network_result",id:command.id,error:String(error.message)});}return;}
  if (command.op === "tool_result") {
    const request = pending.get(command.id);
    pending.delete(command.id);
    if (command.error) request?.reject(new Error(command.error));
    else request?.resolve(command.result);
    return;
  }
  if (command.op === "cancel") {
    cancelRequested = true;
    authAbort?.abort();
    await session?.abort();
    return;
  }
  if (command.op === "login_answer") {
    loginReply?.(command.text);
    return;
  }
  if (job) throw new Error("Agent 正忙");
  job = true;
  try {
    if (command.op === "prompt") await runPrompt(command);
    else if (["login", "api_key", "logout"].includes(command.op))
      await authentication(command);
    else throw new Error("未知运行时操作");
  } catch (error) {
    // Provider errors may contain secrets; mask the current app-owned credentials.
    let message = String(error.message || error).slice(0, 4000);
    try {
      for (const credential of Object.values(await credentialData()))
        for (const field of ["key", "access", "refresh"])
          if (credential[field])
            message = message.split(credential[field]).join("[redacted]");
    } catch {}
    emit({ type: "error", message });
  } finally {
    job = false;
  }
}
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", (line) => {
  if (line.length > 20 * 1024 * 1024)
    return emit({ type: "error", message: "请求超过限制" });
  try {
    void handle(JSON.parse(line)).catch((error) =>
      emit({ type: "error", message: String(error.message) }),
    );
  } catch {
    emit({ type: "error", message: "Agent 请求不是有效 JSON" });
  }
});
input.on("close", () => {
  authAbort?.abort();
  // Quitting must take the MCP servers with it, so they are not orphaned.
  void closeStudySession(session, "quit").finally(() =>
    setTimeout(() => process.exit(0), 200).unref(),
  );
});
await authStatus().catch((error) =>
  emit({ type: "error", message: String(error.message) }),
);
emit({ type: "ready" });
