// The host owns software mutations; this worker gets only the review tool set.
import { createInterface } from "node:readline";
import { readFile, writeFile, rename, mkdir, chmod } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { createStudySession } from "./session.mjs";
import { networkTool } from "./web.mjs";

process.umask(0o077);
const dir = resolve(process.argv[2]);
const root = import.meta.dirname;
const emit = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
let session, authAbort, loginReply;
const pending = new Map();
let job = false;
let credentialsQueue = Promise.resolve();
async function credentialData() {
  try {
    return JSON.parse(await readFile(join(dir, "auth.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw new Error("认证文件损坏或无法读取，原文件已保留");
  }
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
  read: async (provider) => (await credentialData())[provider],
  list: async () =>
    Object.entries(await credentialData()).map(([providerId, value]) => ({
      providerId,
      type: value.type,
    })),
  modify: (provider, fn) =>
    mutateCredential(async (data) => {
      const value = await fn(data[provider]);
      if (value) data[provider] = value;
      return data[provider];
    }),
  delete: (provider) =>
    mutateCredential(async (data) => {
      delete data[provider];
    }),
};
const initialized = (async () => {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700);
  return ModelRuntime.create({
    credentials,
    modelsPath: null,
    modelsStorePath: join(dir, "models-cache.json"),
    allowModelNetwork: false,
    refreshOnCreate: false,
  });
})();
async function authStatus() {
  const runtime = await initialized;
  const stored = await credentialData();
  const providers = Object.fromEntries(
    ["deepseek", "openai-codex"].map((provider) => [
      provider,
      {
        configured: Boolean(stored[provider]),
        models: runtime
          .getModels(provider)
          .map((m) => ({ id: m.id, name: m.name, vision:m.input.includes("image") })),
      },
    ]),
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
  if (session) session.dispose();
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
  let turns = 0;
  const unsubscribe = session.subscribe((event) => {
    if (
      event.type === "message_update" &&
      event.assistantMessageEvent?.type === "text_delta"
    )
      emit({ type: "text", text: event.assistantMessageEvent.delta });
    if (event.type === "tool_execution_start")
      emit({ type: "tool_start", name: event.toolName });
    if (event.type === "turn_end" && ++turns > 20) void session.abort();
  });
  const deadline = setTimeout(() => void session?.abort(), 240000);
  try {
    await session.prompt(command.text,{images:command.images||[]});
    emit({ type: "session", path: manager.getSessionFile() });
    const last = [...session.messages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (last?.stopReason === "error")
      throw new Error(last.errorMessage || "模型请求失败");
    emit({
      type: "done",
      text:
        session.getLastAssistantText() ||
        (last?.stopReason === "aborted"
          ? "分析已停止；已生成的文件仍可审阅。"
          : ""),
    });
  } finally {
    emit({ type: "session", path: manager.getSessionFile() });
    clearTimeout(deadline);
    unsubscribe();
  }
}
async function authentication(command) {
  const runtime = await initialized;
  authAbort = new AbortController();
  if (command.op === "logout") await runtime.logout(command.provider);
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
  if(command.op==="network") {try{const result=await networkTool(command.name,command.arguments,{runtime:await initialized,credentials,preferences:command.preferences},AbortSignal.timeout(20000));emit({type:"network_result",id:command.id,result});}catch(error){emit({type:"network_result",id:command.id,error:String(error.message)});}return;}
  if (command.op === "tool_result") {
    const request = pending.get(command.id);
    pending.delete(command.id);
    if (command.error) request?.reject(new Error(command.error));
    else request?.resolve(command.result);
    return;
  }
  if (command.op === "cancel") {
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
  void session?.abort();
  setTimeout(() => process.exit(0), 200).unref();
});
await authStatus().catch((error) =>
  emit({ type: "error", message: String(error.message) }),
);
emit({ type: "ready" });
