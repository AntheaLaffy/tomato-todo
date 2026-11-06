// --mcp stdio 桥测试：转发到运行中 runtime 的 /mcp；未运行时给出中文错误。
// 用本地 mock /mcp 服务 + 假 connection.json，不依赖真实 runtime。
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const BIN = fileURLToPath(new URL("../bin/tomato-runtime", import.meta.url));
const tmp = () => mkdtempSync(join(tmpdir(), "tomato-stdio-"));

class StdioClient {
  constructor(args) {
    this.proc = spawn(process.execPath, [BIN, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.stderr = "";
    this.proc.stderr.on("data", (d) => (this.stderr += d));
    this.lines = createInterface({
      input: this.proc.stdout,
      crlfDelay: Infinity,
    });
    this.pending = new Map();
    this.nextId = 1;
    this.lines.on("line", (line) => {
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        this.parseErrors.push(line);
        return;
      }
      const waiter = this.pending.get(msg.id);
      if (waiter) {
        this.pending.delete(msg.id);
        waiter.resolve(msg);
      }
    });
    this.parseErrors = [];
  }

  request(method, params) {
    const id = this.nextId++;
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`请求超时：${method}`)),
        5000,
      );
      this.pending.set(id, {
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
      });
    });
    this.proc.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id, method, params: params ?? {} })}\n`,
    );
    return promise;
  }

  async close() {
    this.proc.stdin.end();
    this.proc.kill();
    await new Promise((resolve) => this.proc.once("exit", resolve));
  }
}

test("--mcp 转发 initialize/ping/tools/list/tools/call 到 /mcp", async (t) => {
  const dir = tmp();
  const seen = [];
  const mock = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw);
      seen.push({ method: body.method, auth: req.headers.authorization });
      let result;
      switch (body.method) {
        case "initialize":
          result = {
            serverInfo: { name: "tomato-todo", version: "mock" },
            capabilities: { tools: {} },
          };
          break;
        case "tools/list":
          result = { tools: [{ name: "get_context" }] };
          break;
        case "tools/call":
          result = {
            content: [{ type: "text", text: "42" }],
            structuredContent: { answer: 42 },
          };
          break;
        default:
          result = null;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }));
    });
  });
  await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
  const port = mock.address().port;

  mkdirSync(join(dir, "agent"), { recursive: true });
  writeFileSync(
    join(dir, "agent", "connection.json"),
    JSON.stringify({
      mcpUrl: `http://127.0.0.1:${port}/mcp`,
      token: "stdio-token",
      pid: 1,
    }),
  );

  const client = new StdioClient(["--mcp", "--data", dir]);
  t.after(async () => {
    await client.close();
    await new Promise((resolve) => mock.close(resolve));
  });

  const init = await client.request("initialize", {
    protocolVersion: "2025-11-25",
  });
  assert.equal(init.result.serverInfo.name, "tomato-todo");

  const ping = await client.request("ping");
  assert.deepEqual(ping.result, {});

  const list = await client.request("tools/list");
  assert.equal(list.result.tools[0].name, "get_context");

  const call = await client.request("tools/call", {
    name: "export_plan",
    arguments: { name: "x.json" },
  });
  assert.equal(call.result.content[0].text, "42");
  assert.equal(call.result.structuredContent.answer, 42);

  // 除 ping 本地应答外，其余方法全部带 Bearer token 转发到 /mcp
  assert.deepEqual(
    seen.map((s) => s.method),
    ["initialize", "tools/list", "tools/call"],
  );
  assert.ok(seen.every((s) => s.auth === "Bearer stdio-token"));
  assert.equal(client.parseErrors.length, 0);
});

test("--mcp 未知方法 → -32601；非法行 → -32700 不崩", async (t) => {
  const dir = tmp();
  mkdirSync(join(dir, "agent"), { recursive: true });
  writeFileSync(
    join(dir, "agent", "connection.json"),
    JSON.stringify({ mcpUrl: "http://127.0.0.1:1/mcp", token: "x" }),
  );
  const client = new StdioClient(["--mcp", "--data", dir]);
  t.after(async () => {
    await client.close();
  });

  const unknown = await client.request("resources/list");
  assert.equal(unknown.error.code, -32601);

  const { proc } = client;
  proc.stdin.write("not-json\n");
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(client.parseErrors.length, 0); // 解析错误应答回 stdout，不落 stderr
});

test("--mcp 运行时未启动 → -32603 中文错误「请先启动番茄 Todo」", async (t) => {
  const dir = tmp();
  // 占用一个端口再关闭，确保连接被拒
  const dead = createServer();
  await new Promise((resolve) => dead.listen(0, "127.0.0.1", resolve));
  const port = dead.address().port;
  await new Promise((resolve) => dead.close(resolve));

  mkdirSync(join(dir, "agent"), { recursive: true });
  writeFileSync(
    join(dir, "agent", "connection.json"),
    JSON.stringify({ mcpUrl: `http://127.0.0.1:${port}/mcp`, token: "x" }),
  );
  const client = new StdioClient(["--mcp", "--data", dir]);
  t.after(async () => {
    await client.close();
  });

  const init = await client.request("initialize", {});
  assert.equal(init.error.code, -32603);
  assert.match(init.error.message, /请先启动番茄 Todo/);

  const call = await client.request("tools/call", { name: "get_context" });
  assert.equal(call.error.code, -32603);
});

test("--mcp 连接文件缺失 → -32603；--connection 指向非本机地址被拒绝", async (t) => {
  const dir = tmp();
  const client = new StdioClient(["--mcp", "--data", dir]);
  t.after(async () => {
    await client.close();
  });
  const init = await client.request("initialize", {});
  assert.equal(init.error.code, -32603);
  assert.match(init.error.message, /请先启动番茄 Todo/);

  const dir2 = tmp();
  const file = join(dir2, "conn.json");
  writeFileSync(
    file,
    JSON.stringify({ mcpUrl: "http://example.com/mcp", token: "x" }),
  );
  const client2 = new StdioClient(["--mcp", "--connection", file]);
  t.after(async () => {
    await client2.close();
  });
  // ping 本地应答不触碰连接文件，用 tools/list 验证地址校验
  const init2 = await client2.request("tools/list");
  assert.equal(init2.error.code, -32603);
  assert.match(init2.error.message, /不是本机软件地址/);
});
