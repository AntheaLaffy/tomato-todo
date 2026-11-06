// --mcp stdio 入口：新进程转发到运行中 runtime 的 /mcp，语义同旧 agent/mcp.mjs。
// newline-delimited JSON-RPC；永不向 stdout 写日志。
// 未运行时给出「请先启动番茄 Todo」类中文错误。
import { createInterface } from "node:readline";
import { readFile } from "node:fs/promises";

export async function runMcpStdio({ connectionFile }) {
  const emit = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);

  async function bridge(envelope) {
    const connection = JSON.parse(await readFile(connectionFile, "utf8"));
    const mcpUrl = connection.mcpUrl;
    if (!mcpUrl) throw new Error("连接文件缺少 mcpUrl");
    const url = new URL(mcpUrl);
    if (url.hostname !== "127.0.0.1" || url.protocol !== "http:") {
      throw new Error("连接文件不是本机软件地址");
    }
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.token ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(envelope),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }

  async function handle(message) {
    if (message.id === undefined) return;
    const envelope = (method) => ({
      jsonrpc: "2.0",
      id: message.id,
      method,
      params: message.params ?? {},
    });
    let result;
    try {
      switch (message.method) {
        case "initialize": {
          const response = await bridge(envelope("initialize"));
          result = response.result ?? response;
          break;
        }
        case "ping":
          result = {};
          break;
        case "tools/list": {
          const response = await bridge(envelope("tools/list"));
          result = response.result ?? response;
          break;
        }
        case "tools/call": {
          const response = await bridge(envelope("tools/call"));
          result = response.result ?? {
            isError: true,
            content: [{ type: "text", text: "runtime 未返回结果" }],
          };
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
          message: `请先启动番茄 Todo，或检查 --connection 路径：${error?.message ?? error}`,
        },
      });
    }
  }

  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let queue = Promise.resolve();
  lines.on("line", (line) => {
    if (line.length > 1024 * 1024) {
      return emit({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Request too large" },
      });
    }
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
}
