// HTTP API（127.0.0.1:43987）：
// - 只读端点 GET /health /api/snapshot /api/today /api/stats：允许
//   Origin http://127.0.0.1:3080 的 CORS，供 DSH 插件 UI 直连。
// - 写端点 POST/PATCH /api/tasks*、/api/focus*、/api/tasks/move：同 Origin 白名单
//   （无 Origin 的非浏览器客户端放行；有 Origin 且不在白名单 → 403）。
// - /mcp：Streamable HTTP 桩（POST JSON-RPC），Bearer token 认证（数据目录
//   agent/connection.json），拒绝任何带 Origin 的请求；GET/SSE 未实现。
import { createServer } from "node:http";
import { mcpMethod, safeEqual } from "./mcp.mjs";
import { GuardClient } from "./guard-client.ts";

export const UI_ORIGIN = "http://127.0.0.1:3080";
export const DEFAULT_PORT = 43987;

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const MAX_BODY = 1024 * 1024;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(res, status, body, extraHeaders = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { ...JSON_HEADERS, ...extraHeaders });
  res.end(text);
}

function sendApi(res, status, body) {
  send(res, status, body, {
    "Access-Control-Allow-Origin": UI_ORIGIN,
    Vary: "Origin",
  });
}

function readBody(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, "请求体过大"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function parseJson(req) {
  const raw = await readBody(req);
  try {
    return JSON.parse(raw || "{}");
  } catch {
    throw new HttpError(400, "请求体不是合法 JSON");
  }
}

/** 写端点 Origin 白名单：浏览器必须有 UI origin；无 Origin（工具/宿主）放行。 */
function ensureWriteOrigin(req) {
  const origin = req.headers.origin;
  if (origin !== undefined && origin !== UI_ORIGIN) {
    throw new HttpError(403, "Origin 不在白名单");
  }
}

function handlePreflight(req, res) {
  ensureWriteOrigin(req);
  res.writeHead(204, {
    "Access-Control-Allow-Origin": UI_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  });
  res.end();
}

async function handleMcp(req, res, { engine, token }) {
  if (req.method === "GET" || req.method === "DELETE") {
    send(res, 405, { error: "Streamable HTTP 桩仅支持 POST；SSE 未实现" }, { Allow: "POST" });
    return;
  }
  if (req.method !== "POST") {
    send(res, 405, { error: "Method not allowed" }, { Allow: "POST" });
    return;
  }
  if (req.headers.origin !== undefined) {
    send(res, 403, { error: "MCP 端点拒绝浏览器请求（不允许 Origin）" });
    return;
  }
  const auth = req.headers.authorization ?? "";
  const match = /^Bearer\s+(\S+)$/.exec(auth);
  if (!match || !safeEqual(match[1], token)) {
    send(res, 401, { error: "未授权：缺少或错误的 Bearer token" });
    return;
  }

  let message;
  try {
    message = JSON.parse(await readBody(req));
  } catch {
    send(res, 200, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
    return;
  }

  const handleOne = (msg) => {
    if (msg == null || typeof msg !== "object" || Array.isArray(msg)) {
      return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } };
    }
    if (msg.jsonrpc !== "2.0") {
      return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32600, message: "Invalid Request" } };
    }
    if (msg.id === undefined) return null; // 通知：不回复
    const outcome = mcpMethod(engine, msg.method, msg.params ?? {});
    if (outcome.ok) return { jsonrpc: "2.0", id: msg.id, result: outcome.result };
    return {
      jsonrpc: "2.0",
      id: msg.id,
      error: { code: outcome.code, message: outcome.message },
    };
  };

  if (Array.isArray(message)) {
    const responses = message.map(handleOne).filter((r) => r !== null);
    if (responses.length === 0) {
      res.writeHead(202);
      res.end();
    } else {
      send(res, 200, responses);
    }
    return;
  }
  const response = handleOne(message);
  if (response === null) {
    res.writeHead(202);
    res.end();
  } else {
    send(res, 200, response);
  }
}

async function handleApi(req, res, url, ctx) {
  const { engine, guard } = ctx;
  const path = url.pathname;
  const now = () => Math.floor(Date.now() / 1000);
  const method = req.method;

  // 只读端点：允许 DSH UI origin 跨域
  if (method === "GET") {
    if (path === "/api/snapshot") return sendApi(res, 200, engine.snapshot(now()));
    if (path === "/api/today") {
      const view = engine.today(now());
      // 插件契约的便捷字段：dueCount=今日未完成件数，focusMinutes=今日已投入分钟。
      const dueCount = view.tasks.filter((t) => !t.completed).length;
      const focusMinutes = Math.round((view.stats?.todaySeconds ?? 0) / 60);
      return sendApi(res, 200, { ...view, dueCount, focusMinutes });
    }
    if (path === "/api/stats") return sendApi(res, 200, engine.stats(now()));
    sendApi(res, 404, { error: "Not found" });
    return;
  }

  ensureWriteOrigin(req);
  if (method === "POST" && path === "/api/tasks") {
    const body = await parseJson(req);
    return sendApi(res, 201, engine.createTask(body, now()));
  }
  if (method === "POST" && path === "/api/tasks/move") {
    const body = await parseJson(req);
    return sendApi(res, 200, { tasks: engine.moveTasks(body.ids, body.dueDate, body.reminderTime) });
  }
  let match = /^\/api\/tasks\/([^/]+)\/complete$/.exec(path);
  if (method === "POST" && match) {
    return sendApi(res, 200, engine.completeTask(decodeURIComponent(match[1]), now()));
  }
  match = /^\/api\/tasks\/([^/]+)$/.exec(path);
  if (method === "PATCH" && match) {
    const body = await parseJson(req);
    return sendApi(res, 200, engine.updateTask(decodeURIComponent(match[1]), body.changes ?? body, now()));
  }
  if (method === "POST" && path === "/api/focus/start") {
    const body = await parseJson(req);
    const timer = engine.focusStart(
      { taskId: body.taskId ?? null, minutes: body.minutes ?? null },
      now(),
    );
    // runtime 指挥 guard：按保护设置重发锁屏（guard 未跑时优雅忽略）。
    const protection = engine.settings.protection;
    if (protection.mode !== "off" && timer.running) {
      const whitelist = protection.mode === "whitelist" ? protection.whitelist : [];
      guard.lock({ whitelist }).then((r) => {
        if (!r.ok) console.error(`guard lock 失败：${r.error ?? r.status}`);
      });
    }
    return sendApi(res, 200, { timer });
  }
  if (method === "POST" && path === "/api/focus/pause") {
    return sendApi(res, 200, { timer: engine.focusPause(now()) });
  }
  if (method === "POST" && path === "/api/focus/stop") {
    const result = engine.focusStop(now());
    guard.unlock().then((r) => {
      if (!r.ok) console.error(`guard unlock 失败：${r.error ?? r.status}`);
    });
    return sendApi(res, 200, result);
  }
  sendApi(res, 404, { error: "Not found" });
}

/**
 * 启动 HTTP 服务。返回 { server, port, close }；port 传入 0 时取系统分配端口
 * （测试用），调用方需按实际端口回写 connection.json。
 */
export async function startServer({ engine, dataDir, host = "127.0.0.1", port = DEFAULT_PORT, token, version }) {
  const guard = GuardClient.fromDataDir(dataDir);
  const startedAt = Date.now();
  const server = createServer((req, res) => {
    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host ?? `${host}:${port}`}`);
    } catch {
      send(res, 400, { error: "Bad request" });
      return;
    }
    const path = url.pathname;
    const run = async () => {
      try {
        if (req.method === "OPTIONS" && path.startsWith("/api/")) {
          return handlePreflight(req, res);
        }
        if (path === "/health") {
          // guard 摘要是可选件：不可达时给 {available:false}，绝不能影响健康上报。
          const probe = await guard.status();
          const summary =
            probe.ok && probe.status === 200
              ? { available: true, ...(probe.data ?? {}) }
              : { available: false };
          return send(res, 200, {
            ok: true,
            name: "tomato-todo",
            version,
            pid: process.pid,
            uptimeSecs: Math.floor((Date.now() - startedAt) / 1000),
            guard: summary,
          });
        }
        if (path === "/mcp") {
          return await handleMcp(req, res, { engine, token });
        }
        if (path.startsWith("/api/")) {
          return await handleApi(req, res, url, { engine, guard });
        }
        send(res, 404, { error: "Not found" });
      } catch (error) {
        if (error instanceof HttpError) {
          sendApi(res, error.status, { error: error.message });
        } else {
          console.error("request error:", error);
          sendApi(res, 500, { error: String(error?.message ?? error) });
        }
      }
    };
    void run();
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const actualPort = server.address().port;
  return {
    server,
    port: actualPort,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
