// HTTP API 测试：只读 CORS、写端点 Origin 白名单、/mcp 认证与 JSON-RPC 方法。
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Engine } from "../src/engine.ts";
import { startServer, UI_ORIGIN } from "../src/server.mjs";

const tmp = () => mkdtempSync(join(tmpdir(), "tomato-http-"));
const TOKEN = "test-token-123";
const TODAY = "2026-11-06";

let server;
let base;
let engine;
let dataDir;

test.before(async () => {
  dataDir = tmp();
  engine = Engine.open(dataDir);
  const started = await startServer({
    engine,
    dataDir,
    host: "127.0.0.1",
    port: 0,
    token: TOKEN,
    version: "0.0.0-test",
  });
  server = started.server;
  base = `http://127.0.0.1:${started.port}`;
});

test.after(async () => {
  await server?.close?.();
  engine?.flushNow();
});

const api = (path, init = {}) => fetch(`${base}${path}`, init);
const json = async (path, init = {}) => {
  const res = await api(path, init);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, headers: res.headers, body };
};

test("/health 返回存活信息", async () => {
  const { status, body } = await json("/health");
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.name, "tomato-todo");
  assert.equal(body.pid, process.pid);
  assert.equal(typeof body.uptimeSecs, "number");
});

test("只读端点：/api/snapshot /api/today /api/stats 带 UI origin CORS 头", async () => {
  const snap = await json("/api/snapshot");
  assert.equal(snap.status, 200);
  assert.equal(snap.headers.get("access-control-allow-origin"), UI_ORIGIN);
  assert.equal(typeof snap.body.today, "string");
  assert.equal(typeof snap.body.serverTime, "number");
  assert.ok(snap.body.stats.days.length > 0);
  assert.ok(Array.isArray(snap.body.data.tasks));

  const today = await json("/api/today");
  assert.equal(today.status, 200);
  assert.equal(typeof today.body.remainingSecs, "number");
  assert.ok(Array.isArray(today.body.tasks));

  const stats = await json("/api/stats");
  assert.equal(stats.status, 200);
  assert.equal(typeof stats.body.streak, "number");
});

test("写端点 Origin 白名单：UI origin 与无 Origin 放行，陌生 Origin 拒绝", async () => {
  const body = JSON.stringify({ title: "任务", dueDate: TODAY });
  const headers = { "Content-Type": "application/json" };

  const evil = await json("/api/tasks", {
    method: "POST",
    headers: { ...headers, Origin: "http://evil.example.com" },
    body,
  });
  assert.equal(evil.status, 403);

  const ui = await json("/api/tasks", {
    method: "POST",
    headers: { ...headers, Origin: UI_ORIGIN },
    body,
  });
  assert.equal(ui.status, 201);
  assert.equal(ui.body.title, "任务");

  const bare = await json("/api/tasks", { method: "POST", headers, body });
  assert.equal(bare.status, 201);
});

test("OPTIONS 预检：白名单 Origin 204，陌生 Origin 403", async () => {
  const good = await json("/api/tasks", {
    method: "OPTIONS",
    headers: { Origin: UI_ORIGIN, "Access-Control-Request-Method": "POST" },
  });
  assert.equal(good.status, 204);
  assert.equal(good.headers.get("access-control-allow-origin"), UI_ORIGIN);
  assert.match(good.headers.get("access-control-allow-methods"), /POST/);

  const bad = await json("/api/tasks", {
    method: "OPTIONS",
    headers: { Origin: "http://evil.example.com" },
  });
  assert.equal(bad.status, 403);
});

test("任务写链路：PATCH / move / complete", async () => {
  const headers = { "Content-Type": "application/json" };
  const created = await json("/api/tasks", {
    method: "POST",
    headers,
    body: JSON.stringify({ title: "链路", dueDate: TODAY }),
  });
  const id = created.body.id;

  const patched = await json(`/api/tasks/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ changes: { title: "链路改", priority: 3 } }),
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.title, "链路改");
  assert.equal(patched.body.priority, 3);

  // move 只接受未完成任务，因此先移动后完成
  const moved = await json("/api/tasks/move", {
    method: "POST",
    headers,
    body: JSON.stringify({ ids: [id], dueDate: "2026-11-09" }),
  });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.tasks[0].dueDate, "2026-11-09");

  const done = await json(`/api/tasks/${id}/complete`, {
    method: "POST",
    headers,
  });
  assert.equal(done.status, 200);
  assert.equal(done.body.completed, true);
  assert.ok(done.body.completedAt > 0);
});

test("focus 端点：start → pause → stop 全链路", async () => {
  const headers = { "Content-Type": "application/json" };
  const started = await json("/api/focus/start", {
    method: "POST",
    headers,
    body: JSON.stringify({ minutes: 25 }),
  });
  assert.equal(started.status, 200);
  assert.equal(started.body.timer.running, true);
  assert.equal(started.body.timer.durationSecs, 1500);

  const paused = await json("/api/focus/pause", { method: "POST", headers });
  assert.equal(paused.status, 200);
  assert.equal(paused.body.timer.running, false);

  const stopped = await json("/api/focus/stop", { method: "POST", headers });
  assert.equal(stopped.status, 200);
  assert.equal(stopped.body.timer.running, false);
  // 零用时不留专注记录（core：durationSecs 至少 1 秒）；有实际用时才结账。
  assert.equal(stopped.body.session, null);
});

test("/mcp 认证：无 token 401、错 token 401、带 Origin 403、GET 405", async () => {
  const payload = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" });

  const none = await json("/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });
  assert.equal(none.status, 401);

  const wrong = await json("/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer nope",
    },
    body: payload,
  });
  assert.equal(wrong.status, 401);

  const browser = await json("/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      Origin: UI_ORIGIN,
    },
    body: payload,
  });
  assert.equal(browser.status, 403);

  const get = await json("/mcp");
  assert.equal(get.status, 405);
});

test("/mcp initialize / tools/list：serverInfo 与中文 instructions", async () => {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
  };
  const init = await json("/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-11-25" },
    }),
  });
  assert.equal(init.status, 200);
  assert.equal(init.body.result.serverInfo.name, "tomato-todo");
  assert.equal(init.body.result.protocolVersion, "2025-11-25");
  assert.match(init.body.result.instructions, /接管/);
  assert.deepEqual(init.body.result.capabilities, { tools: {} });

  const list = await json("/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
  });
  const names = list.body.result.tools.map((t) => t.name).sort();
  assert.deepEqual(
    names,
    [
      "apply_file",
      "complete_task",
      "create_task",
      "dispatch",
      "education",
      "export_backup",
      "export_plan",
      "get_context",
      "get_education",
      "get_study_progress",
      "get_tasks",
      "move_tasks",
      "update_task",
    ].sort(),
  );
  const create = list.body.result.tools.find((t) => t.name === "create_task");
  assert.deepEqual(create.inputSchema.required, ["title", "dueDate"]);
});

test("/mcp tools/call 落到引擎：create_task 与 structuredContent", async () => {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
  };
  const call = await json("/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "create_task",
        arguments: { title: "MCP 任务", dueDate: TODAY, priority: 1 },
      },
    }),
  });
  assert.equal(call.status, 200);
  const result = call.body.result;
  assert.ok(!result.isError);
  const task = JSON.parse(result.content[0].text);
  assert.equal(task.title, "MCP 任务");
  assert.equal(task.priority, 1);
  assert.equal(result.structuredContent.id, task.id);

  const snap = await json("/api/snapshot");
  assert.ok(snap.body.data.tasks.some((t) => t.title === "MCP 任务"));
});

test("/mcp tools/call：get_context / complete_task / 错误工具 isError", async () => {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
  };
  const created = await json("/api/tasks", {
    method: "POST",
    headers,
    body: JSON.stringify({ title: "要完成", dueDate: TODAY }),
  });

  const ctx = await json("/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "get_context", arguments: {} },
    }),
  });
  assert.ok(!ctx.body.result.isError);
  const context = ctx.body.result.structuredContent;
  assert.equal(typeof context.today, "string");
  assert.ok(Array.isArray(context.todayTasks));

  const done = await json("/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "complete_task", arguments: { id: created.body.id } },
    }),
  });
  assert.equal(JSON.parse(done.body.result.content[0].text).completed, true);

  const bad = await json("/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "no_such_tool", arguments: {} },
    }),
  });
  assert.equal(bad.body.result.isError, true);
  assert.match(bad.body.result.content[0].text, /未知 MCP 工具/);

  // 引擎错误 → isError 而非 HTTP 错误
  const err = await json("/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "complete_task", arguments: { id: "missing" } },
    }),
  });
  assert.equal(err.status, 200);
  assert.equal(err.body.result.isError, true);
  assert.match(err.body.result.content[0].text, /任务不存在/);
});

test("/mcp：非法 JSON → -32700；通知（无 id）→ 202 空响应；未知方法 → -32601", async () => {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
  };
  const parse = await json("/mcp", { method: "POST", headers, body: "{" });
  assert.equal(parse.status, 200);
  assert.equal(parse.body.error.code, -32700);

  const notify = await fetch(`${base}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
  });
  assert.equal(notify.status, 202);
  assert.equal(await notify.text(), "");

  const unknown = await json("/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 8, method: "resources/list" }),
  });
  assert.equal(unknown.body.error.code, -32601);
});

test("/mcp dispatch：focusDiscard 与 export_plan 文件名校验", async () => {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
  };
  const discard = await json("/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: {
        name: "dispatch",
        arguments: { action: { type: "focusDiscard" } },
      },
    }),
  });
  assert.ok(!discard.body.result.isError);
  assert.equal(discard.body.result.structuredContent.running, false);

  const badName = await json("/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: { name: "export_plan", arguments: { name: "../x.json" } },
    }),
  });
  assert.equal(badName.body.result.isError, true);
  assert.match(badName.body.result.content[0].text, /工作区内/);
});
