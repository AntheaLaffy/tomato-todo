// Standard newline-delimited MCP stdio transport. Never write logs to stdout.
import { createInterface } from "node:readline";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
const index = process.argv.indexOf("--connection");
const file =
  index >= 0
    ? process.argv[index + 1]
    : join(
        process.env.XDG_DATA_HOME || join(process.env.HOME, ".local/share"),
        "studio.tomato.todo/agent/connection.json",
      );
const emit = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
async function bridge(body) {
  const connection = JSON.parse(await readFile(file, "utf8"));
  const url = new URL(connection.url);
  if (url.hostname !== "127.0.0.1" || url.protocol !== "http:")
    throw new Error("连接文件不是本机软件地址");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
async function handle(message) {
  if (message.id === undefined) return;
  let result;
  try {
    switch (message.method) {
      case "initialize":
        result = {
          protocolVersion: "2025-11-25",
          capabilities: { tools: {} },
          serverInfo: { name: "tomato-study", version: "0.1.0" },
          instructions:
            "操作当前正在运行的软件实例。批量编辑优先导出文件、JSON Patch、审阅、应用；保护规则仍然生效。",
        };
        break;
      case "ping":
        result = {};
        break;
      case "tools/list":
        result = await bridge({ method: "tools/list" });
        break;
      case "tools/call": {
        try {
          const value = await bridge({
            method: "tools/call",
            ...message.params,
          });
          result = { content: [{ type: "text", text: JSON.stringify(value) }] };
        } catch (error) {
          result = {
            isError: true,
            content: [{ type: "text", text: String(error.message || error) }],
          };
        }
        break;
      }
      default:
        return emit({
          jsonrpc: "2.0",
          id: message.id,
          error: { code: -32601, message: "Method not found" },
        });
    }
    emit({ jsonrpc: "2.0", id: message.id, result });
  } catch (error) {
    emit({
      jsonrpc: "2.0",
      id: message.id,
      error: {
        code: -32603,
        message: `请先启动番茄 Todo，或检查 --connection 路径：${error.message}`,
      },
    });
  }
}
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
let queue = Promise.resolve();
lines.on("line", (line) => {
  if (line.length > 1024 * 1024)
    return emit({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Request too large" },
    });
  try {
    const message = JSON.parse(line);
    queue = queue.then(() => handle(message));
  } catch {
    emit({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
  }
});
