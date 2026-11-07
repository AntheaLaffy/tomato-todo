// Host half of @local/tomato-dsh (v2).
//
// Why subprocess instead of fetch: the host plugin context has no HTTP client,
// and the runtime exposes itself only on 127.0.0.1. Every probe therefore runs
// the bundled binary as a one-shot child process and reads stdout. `--mcp` is
// the stdio JSON-RPC entry (defined by the runtime workflow, see API.md), and
// `--guard-status` is a one-shot flag this half defines: the runtime workflow
// implements it to print ONE JSON object to stdout and exit.
//
//   tomato-runtime --guard-status
//     → {"ok":true,"guard":{"available":true,"backend":"x11","locked":false,
//        "whitelist":[],"pid":1234}}
//     → {"ok":false,"error":"..."} (still exit 0 when it produced a reply)
//   non-zero exit / no output means the runtime itself is not reachable.
export const inject = ["tools", "subprocess"];

const DEFAULT_BIN = "/home/fuurin/.local/bin/tomato-runtime";

// Why a pinned HOME: the runtime resolves its data directory
// (~/.local/share/studio.tomato.todo) and MCP token from $HOME. The host
// process environment may differ from the user's login environment, so we pin
// the real home instead of inheriting whatever the launcher had.
const RUNTIME_HOME = "/home/fuurin";
const GRACE_MS = 30000;
const MAX_OUTPUT = 4 * 1024 * 1024;

// Every user-visible failure shares one prefix so the model (and the user)
// recognise "tomato runtime unavailable" as one class of problem.
function fail(message) {
  throw new Error(`番茄 Todo：${message}`);
}

// The stdio MCP transport is newline-delimited JSON-RPC; the meaningful reply
// is the last line written before the process exits.
function parseReply(raw) {
  const lines = String(raw ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const last = lines[lines.length - 1];
  if (!last) return null;
  try {
    return JSON.parse(last);
  } catch {
    return null;
  }
}

// One-shot child process. stdinData is either a full request line or null for
// "no stdin" (used by --guard-status). The process ends the call when stdin
// closes, which keeps every probe self-cleaning.
async function runBinary(ctx, bin, args, stdinData) {
  const handle = ctx.subprocess.spawn({
    argv: [bin, ...args],
    cwd: "/",
    env: { HOME: RUNTIME_HOME },
    stdio: {
      stdin: stdinData == null ? "ignore" : { data: stdinData },
      stdout: { maxBytes: MAX_OUTPUT },
      stderr: "ignore",
    },
    graceMs: GRACE_MS,
  });
  const outcome = await handle.done;
  const raw = handle.collected.stdout
    ? handle.collected.stdout.readFrom(0).text
    : "";
  return { outcome, raw };
}

// One-shot JSON-RPC tools/call through `tomato-runtime --mcp`. Reply shape
// follows MCP: result.isError marks a rejected call; structuredContent is
// preferred over a joined text payload.
async function callRuntimeTool(ctx, bin, name, args) {
  const request = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name, arguments: args },
  });
  const { outcome, raw } = await runBinary(ctx, bin, ["--mcp"], `${request}\n`);
  if (!raw.trim()) {
    fail(
      `tomato-runtime --mcp 没有输出（退出码 ${outcome.exitCode}）；` +
        "请确认番茄 Todo 运行时在后台运行。",
    );
  }
  const reply = parseReply(raw);
  if (!reply) fail("MCP 响应不是合法 JSON");
  if (reply.error) fail(reply.error.message || String(reply.error));
  const result = reply.result;
  if (result && result.isError) {
    const text = (result.content || [])
      .map((block) => block.text || "")
      .join("\n");
    fail(text || "番茄 Todo 拒绝了这次调用");
  }
  let value = result;
  if (
    result &&
    typeof result === "object" &&
    !Array.isArray(result) &&
    result.content
  ) {
    if (result.structuredContent !== undefined)
      value = result.structuredContent;
    else
      value = (result.content || [])
        .map((block) => block.text || "")
        .join("\n");
  }
  return value;
}

export function apply(ctx, config) {
  const bin = (config && config.tomatoBin) || DEFAULT_BIN;

  ctx.tools.register({
    name: "tomato_today",
    description:
      "读取正在运行的番茄 Todo：今日待办、本周投入、完成番茄与本地诊断。" +
      "回答用户关于任务、计划、统计的问题前先调用它确认现状；" +
      "运行时需要保持运行，失败时按返回的错误提示引导用户。",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    output: {
      schema: { type: "object", additionalProperties: true },
      render(args, value) {
        if (value && typeof value === "string") {
          return [{ type: "text", text: value }];
        }
        const v = value || {};
        const tasks = Array.isArray(v.tasks) ? v.tasks : [];
        const lines = [
          `番茄 Todo 已连接（${v.serverTime ?? ""}）。`,
          `今日待办 ${v.taskCount ?? 0} 件、逾期 ${v.overdueCount ?? 0} 件：`,
          ...tasks.map(
            (t) =>
              `- ${t.title}${t.reminderTime ? `（${t.reminderTime}）` : ""}`,
          ),
          `今日投入 ${Math.round((v.todaySeconds ?? 0) / 60)} 分钟、` +
            `完成番茄 ${v.todayPomodoros ?? 0} 个、完成 ${v.todayCompleted ?? 0} 件任务。`,
        ];
        if (Array.isArray(v.anomalies) && v.anomalies.length > 0) {
          lines.push(
            `本地诊断 ${v.anomalies.length} 条：${JSON.stringify(v.anomalies)}`,
          );
        }
        return [{ type: "text", text: lines.join("\n") }];
      },
    },
    async execute() {
      const context = await callRuntimeTool(ctx, bin, "get_context", {});
      // get_context 允许两种返回：结构化对象或一段已组织好的文本。
      if (typeof context === "string") return { summary: context };
      if (!context || typeof context !== "object") {
        fail("get_context 返回了无法识别的数据");
      }
      const tasks = Array.isArray(context.todayTasks)
        ? context.todayTasks.filter((t) => !t.completed)
        : [];
      const stats = context.stats || {};
      return {
        today: context.today,
        serverTime: context.serverTime ?? null,
        taskCount: tasks.length,
        overdueCount: Array.isArray(context.overdueTasks)
          ? context.overdueTasks.length
          : 0,
        tasks: tasks.slice(0, 8).map((t) => ({
          title: t.title,
          reminderTime: t.reminderTime ?? null,
        })),
        todaySeconds: stats.todaySeconds ?? 0,
        todayPomodoros: stats.todayPomodoros ?? 0,
        todayCompleted: stats.todayCompleted ?? 0,
        anomalies: Array.isArray(context.anomalies) ? context.anomalies : [],
      };
    },
  });

  ctx.tools.register({
    name: "tomato_guard_status",
    description:
      "查询番茄 Todo 专注保护（guard）状态：是否可用、是否锁定、白名单与进程 PID。" +
      "回答用户关于专注保护、锁屏或白名单的问题前先调用它确认现状。",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    output: {
      schema: { type: "object", additionalProperties: true },
      render(args, value) {
        const v = value || {};
        const lines = ["番茄 Todo 专注保护（guard）："];
        if (v.available) {
          lines.push(
            `- 可用：是${v.backend ? `（${v.backend}）` : ""}`,
            `- 锁定：${v.locked ? "是" : "否"}`,
            `- 白名单 ${Array.isArray(v.whitelist) ? v.whitelist.length : 0} 个` +
              (Array.isArray(v.whitelist) && v.whitelist.length > 0
                ? `：${v.whitelist.join("、")}`
                : ""),
            `- 进程 PID：${v.pid == null ? "未运行" : v.pid}`,
          );
        } else {
          lines.push(`- 可用：否${v.message ? `（${v.message}）` : ""}`);
        }
        return [{ type: "text", text: lines.join("\n") }];
      },
    },
    async execute() {
      const { outcome, raw } = await runBinary(
        ctx,
        bin,
        ["--guard-status"],
        null,
      );
      if (!raw.trim()) {
        fail(
          `tomato-runtime --guard-status 没有输出（退出码 ${outcome.exitCode}）；` +
            "请确认番茄 Todo 运行时在后台运行。",
        );
      }
      const reply = parseReply(raw);
      if (!reply) fail("guard 状态响应不是合法 JSON");
      if (reply.ok === false) fail(reply.error || "guard 状态查询失败");
      const guard = reply.guard;
      if (!guard || typeof guard !== "object")
        fail("guard 状态响应缺少 guard 字段");
      return guard;
    },
  });
}
