// HTTP API（127.0.0.1:43987）：
// - 只读端点 GET /health /api/snapshot /api/today /api/stats /api/state
//   /api/apps /api/export/{plan,backup}：允许 Origin http://127.0.0.1:3080 的 CORS，
//   供 DSH 插件 UI 直连。UI 数据面只认 /api/state（全量快照 + guard 摘要）。
// - 写端点 POST /api/dispatch（UI 数据面，body {action}）与旧写端点
//   POST/PATCH /api/tasks*、/api/focus*、/api/tasks/move：同 Origin 白名单
//   （无 Origin 的非浏览器客户端放行；有 Origin 且不在白名单 → 403）。
// - 资料目录授权：GET /api/library/grant、POST /api/library/authorize、
//   DELETE /api/library/grant，仅供界面用户操作；不暴露 MCP/助手入口
//   （目录授权只能由用户设置）。
// - /mcp：Streamable HTTP 桩（POST JSON-RPC），Bearer token 认证（数据目录
//   agent/connection.json），拒绝任何带 Origin 的请求；GET/SSE 未实现。
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { createReadStream, fstatSync, openSync, closeSync, constants } from "node:fs";
import { gzipSync } from "node:zlib";
import { mcpMethod, safeEqual } from "./mcp.mjs";
import { listApps } from "./apps.mjs";
import { GuardClient } from "./guard-client.ts";
import { ProjectLibrary, LibraryError } from "./project-library.mjs";

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

function sendApi(res, status, body, extraHeaders = {}) {
  send(res, status, body, {
    "Access-Control-Allow-Origin": UI_ORIGIN,
    Vary: "Origin",
    ...extraHeaders,
  });
}

/** 大 JSON 响应按需 gzip：全量 state 导入教学记录后可到数 MB，轮询值得压缩。 */
function sendApiJson(req, res, status, body) {
  const text = JSON.stringify(body);
  if (
    text.length > 64 * 1024 &&
    /\bgzip\b/.test(req.headers["accept-encoding"] ?? "")
  ) {
    const gzip = gzipSync(text);
    res.writeHead(status, {
      ...JSON_HEADERS,
      "Content-Encoding": "gzip",
      "Content-Length": gzip.length,
      "Access-Control-Allow-Origin": UI_ORIGIN,
      Vary: "Origin, Accept-Encoding",
    });
    res.end(gzip);
    return;
  }
  sendApi(res, status, body);
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
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  });
  res.end();
}

function decodeId(value) {
  try { return decodeURIComponent(value); }
  catch { throw new HttpError(400, "无效的资源 ID"); }
}

function sendResourceFile(req, res, url, library, id, fileToken) {
  if (!safeEqual(url.searchParams.get("access") ?? "", fileToken)) {
    throw new HttpError(403, "资源文件访问令牌无效");
  }
  const file = library.metadata(id);
  const download = url.searchParams.get("download") === "1";
  if (!download && !file.canPreview) {
    throw new HttpError(413, "此文件不能预览；可下载原件（预览上限 20 MiB）");
  }
  // 文件读取直接流式传输，不把百 MiB 教材塞进 JSON 或前端内存。
  const fd = openSync(file.path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  let stat;
  try { stat = fstatSync(fd); }
  catch (error) { closeSync(fd); throw error; }
  if (!stat.isFile()) { closeSync(fd); throw new HttpError(400, "资源不是普通文件"); }
  const size = stat.size;
  const range = req.headers.range;
  let start = 0;
  let end = size - 1;
  if (range !== undefined) {
    const parts = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!parts || (!parts[1] && !parts[2])) {
      closeSync(fd);
      return sendApi(res, 416, { error: "仅支持单段 bytes Range" }, { "Content-Range": "bytes */" + size });
    }
    if (!parts[1]) {
      const count = Number(parts[2]);
      start = Math.max(0, size - count);
    } else {
      start = Number(parts[1]);
      if (parts[2]) end = Math.min(end, Number(parts[2]));
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) {
      closeSync(fd);
      return sendApi(res, 416, { error: "Range 超出文件长度" }, { "Content-Range": "bytes */" + size });
    }
  }
  const filename = encodeURIComponent(file.name.replace(/[\r\n]/g, "_"));
  const headers = {
    "Content-Type": file.mimeType,
    "Content-Length": end - start + 1,
    "Content-Disposition": (download ? "attachment" : "inline") + "; filename*=UTF-8''" + filename,
    "Accept-Ranges": "bytes",
    "Access-Control-Allow-Origin": UI_ORIGIN,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
  };
  // 只有 Range 请求才写 Content-Range：Node 的 writeHead 会把 undefined
  // 当成非法头值整体报错，普通读取不能带这个键。
  if (range !== undefined) headers["Content-Range"] = "bytes " + start + "-" + end + "/" + size;
  res.writeHead(range === undefined ? 200 : 206, headers);
  const stream = createReadStream(null, { fd, autoClose: true, start, end });
  stream.on("error", () => res.destroy());
  stream.pipe(res);
}

async function handleMcp(req, res, { engine, token }) {
  if (req.method === "GET" || req.method === "DELETE") {
    send(
      res,
      405,
      { error: "Streamable HTTP 桩仅支持 POST；SSE 未实现" },
      { Allow: "POST" },
    );
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
      return {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Invalid Request" },
      };
    }
    if (msg.jsonrpc !== "2.0") {
      return {
        jsonrpc: "2.0",
        id: msg.id ?? null,
        error: { code: -32600, message: "Invalid Request" },
      };
    }
    if (msg.id === undefined) return null; // 通知：不回复
    const outcome = mcpMethod(engine, msg.method, msg.params ?? {});
    if (outcome.ok)
      return { jsonrpc: "2.0", id: msg.id, result: outcome.result };
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

const RESOURCE_LITE_KEYS = ["id", "projectId", "title", "kind", "path"];

/**
 * UI 数据面投影：默认省略 data.identities（永久 ID 登记，UI 不读，导入后约 1MB）
 * 与教学资源明细（完整导入后约 1.4MB）；`?full=1` 返回完整 identities，
 * `?education=lite` 给目录字段（id/projectId/title/kind/path），
 * `?education=full` 给完整教学资源。只做浅拷贝投影，不改 engine 内部状态。
 */
export function projectUiState(
  state,
  { full = false, education = "none" } = {},
) {
  const data = { ...state.data };
  if (!full) delete data.identities;
  if (education !== "full") {
    const resources =
      education === "lite"
        ? data.education.resources.map((resource) => {
            const out = {};
            for (const key of RESOURCE_LITE_KEYS) out[key] = resource[key];
            return out;
          })
        : [];
    data.education = { ...data.education, resources };
  }
  return { ...state, data };
}

/** guard 摘要（API.md：不可达时只给 {available:false}，不影响整体响应）。 */
export async function guardSummary(guard) {
  const probe = await guard.status();
  return probe.ok && probe.status === 200
    ? { available: true, ...(probe.data ?? {}) }
    : { available: false };
}

/**
 * 由已校验的 AppData 推导 guard 应该处于的状态。
 * 锁机时段优先（界面锁定忽略白名单）；其次进行中的专注段按保护设置锁定。
 */
export function desiredGuard(engine) {
  const data = engine.data;
  const protection = data.settings.protection;
  if (data.lock.active !== null) {
    return { command: "lock", whitelist: [], strict: data.lock.active.strict };
  }
  if (
    data.timer.running &&
    data.timer.mode === "focus" &&
    protection.mode !== "off"
  ) {
    return {
      command: "lock",
      whitelist:
        protection.mode === "whitelist" ? data.effectiveWhitelist() : [],
      strict: protection.strict,
    };
  }
  return { command: "unlock", whitelist: [], strict: false };
}

/**
 * 同步驱动 guard，状态没变就不重复发命令。
 * guard 不可达时保留「待重试」状态（下次 tick 再试），但同一错误只记一行日志。
 */
export function createGuardSync(engine, guard) {
  let appliedKey = null;
  let lastError = null;
  let queue = Promise.resolve();
  const run = async () => {
    const desired = desiredGuard(engine);
    const key = JSON.stringify(desired);
    if (key === appliedKey) {
      const probe = await guard.status();
      if (probe.ok && probe.data?.locked === (desired.command === "lock") &&
          JSON.stringify(probe.data?.whitelist ?? []) === JSON.stringify(desired.whitelist)) return;
      appliedKey = null;
    }
    const result =
      desired.command === "lock"
        ? await guard.lock({ whitelist: desired.whitelist })
        : await guard.unlock();
    if (result.ok) {
      appliedKey = key;
      lastError = null;
      return;
    }
    if (lastError !== (result.error ?? result.status)) {
      lastError = result.error ?? result.status;
      console.error(
        `guard ${desired.command} 失败：${lastError}（下一 tick 重试）`,
      );
    }
  };
  const sync = () => {
    queue = queue.then(run, run);
    return queue;
  };
  /** 状态变化（计时/设置/锁机）：不等 guard，请求先返回。 */
  sync.fire = () => {
    void sync();
  };
  return sync;
}

/**
 * UI 数据面的查询开关：
 * - `?full=1` 返回完整 data.identities（默认略去）；
 * - 教学资源默认不返回明细，`?education=lite` 给目录字段，`?education=full` 给完整记录。
 */
function uiStateOptions(url) {
  const education = url.searchParams.get("education");
  return {
    full: url.searchParams.get("full") === "1",
    education:
      education === "full" ? "full" : education === "lite" ? "lite" : "none",
  };
}

async function handleApi(req, res, url, ctx) {
  const { engine, guard, syncGuard, library, fileToken } = ctx;
  const path = url.pathname;
  const now = () => Math.floor(Date.now() / 1000);
  const method = req.method;

  // 只读端点：允许 DSH UI origin 跨域
  if (method === "GET") {
    if (path === "/api/file-token") {
      if (req.headers.origin !== undefined && req.headers.origin !== UI_ORIGIN) throw new HttpError(403, "Origin 不在白名单");
      return sendApi(res, 200, { access: fileToken });
    }
    let match = /^\/api\/resources\/([^/]+)\/file$/.exec(path);
    if (match) return sendResourceFile(req, res, url, library, decodeId(match[1]), fileToken);
    match = /^\/api\/resources\/([^/]+)\/info$/.exec(path);
    if (match) {
      const { path: _path, resource: _resource, ...info } = library.metadata(decodeId(match[1]));
      return sendApi(res, 200, info);
    }
    match = /^\/api\/projects\/([^/]+)\/grant$/.exec(path);
    if (match) return sendApi(res, 200, library.grantStatus(decodeId(match[1])));
    if (path === "/api/library/grant") return sendApi(res, 200, library.libraryStatus());
    match = /^\/api\/projects\/([^/]+)\/resources\/scan$/.exec(path);
    if (match) return sendApi(res, 200, library.scan(decodeId(match[1])));
    match = /^\/api\/projects\/([^/]+)\/resources$/.exec(path);
    if (match) return sendApi(res, 200, library.list(decodeId(match[1]), {
      q: url.searchParams.get("q") ?? "",
      kind: url.searchParams.get("kind") ?? "",
      status: url.searchParams.get("status") ?? "",
      offset: Number(url.searchParams.get("offset") ?? 0),
      limit: Number(url.searchParams.get("limit") ?? 40),
    }));
    if (path === "/api/snapshot") {
      const guardView = await guardSummary(guard);
      return sendApi(res, 200, { ...engine.snapshot(now()), guard: guardView });
    }
    if (path === "/api/state") {
      // UI 唯一数据入口：全量快照 + 学情摘要 + guard 摘要。
      // 默认省略 identities，需要时 ?full=1；教学资源可 ?education=lite。
      const state = projectUiState(engine.state(now()), uiStateOptions(url));
      return sendApiJson(req, res, 200, {
        ...state,
        guard: await guardSummary(guard),
      });
    }
    if (path === "/api/export/plan" || path === "/api/export/backup") {
      const kind = path.endsWith("plan") ? "plan" : "backup";
      const body =
        kind === "plan" ? engine.exportPlan(now()) : engine.exportBackup(now());
      const date = engine.snapshot(now()).today;
      const filename =
        kind === "plan"
          ? `tomato-plan-${date}.json`
          : `tomato-backup-${date}.json`;
      return sendApi(res, 200, body, {
        "Content-Disposition": `attachment; filename="${filename}"`,
      });
    }
    if (path === "/api/today") {
      const view = engine.today(now());
      // 插件契约的便捷字段：dueCount=今日未完成件数，focusMinutes=今日已投入分钟。
      const dueCount = view.tasks.filter((t) => !t.completed).length;
      const focusMinutes = Math.round((view.stats?.todaySeconds ?? 0) / 60);
      return sendApi(res, 200, { ...view, dueCount, focusMinutes });
    }
    if (path === "/api/stats") return sendApi(res, 200, engine.stats(now()));
    if (path === "/api/apps") {
      const running = await guard.runningApps();
      if (!running.ok) return sendApi(res, 503, { error: running.error ?? "无法读取运行中的应用" });
      const ids = Array.isArray(running.data?.apps) ? running.data.apps : [];
      const { apps: installed, cached } = listApps(now());
      const names = new Map(installed.map((app) => [app.id, app]));
      const apps = [...new Set(ids.filter((id) => typeof id === "string" && id !== ""))]
        .map((id) => ({ id, name: names.get(id)?.name ?? id }));
      return sendApi(res, 200, { apps, count: apps.length, cached, asOf: now() });
    }
    sendApi(res, 404, { error: "Not found" });
    return;
  }

  ensureWriteOrigin(req);
  if (method === "POST" && path === "/api/library/authorize") {
    const body = await parseJson(req);
    return sendApi(res, 200, library.authorizeLibrary(body.directory, Date.now()));
  }
  if (method === "DELETE" && path === "/api/library/grant") {
    return sendApi(res, 200, library.revokeLibrary());
  }
  if (method === "POST" && path === "/api/projects") {
    const result = library.create(await parseJson(req));
    return sendApi(res, 201, result);
  }
  let projectMatch = /^\/api\/projects\/([^/]+)\/(authorize|rename|resources(?:\/cleanup)?|resources\/[^/]+\/repair)$/.exec(path);
  if (method === "POST" && projectMatch) {
    const projectId = decodeId(projectMatch[1]);
    const op = projectMatch[2];
    const body = await parseJson(req);
    if (op === "authorize") return sendApi(res, 200, library.bind(projectId, body.directory));
    if (op === "rename") return sendApi(res, 200, library.rename(projectId, body));
    if (op === "resources") return sendApi(res, 201, library.register(projectId, body.resource));
    if (op === "resources/cleanup") return sendApi(res, 200, library.cleanup(projectId, body.ids ?? null));
    const resourceId = decodeId(op.slice("resources/".length, -"/repair".length));
    return sendApi(res, 200, library.repair(projectId, resourceId, body.path));
  }
  if (method === "POST" && path === "/api/desktop/fullscreen") {
    const body = await parseJson(req);
    if (typeof body.enabled !== "boolean") {
      return sendApi(res, 400, { error: "enabled 必须是布尔值" });
    }
    const result = await guard.fullscreen(body.enabled);
    return sendApi(res, result.ok ? 200 : 503,
      result.ok ? result.data : { error: result.error ?? "DSH 全屏控制失败" });
  }
  if (method === "POST" && path === "/api/dispatch") {
    const body = await parseJson(req);
    let outcome;
    try {
      // 严格 core Action：校验/保护规则/身份登记全部在 @tomato/core。
      outcome = engine.applyAction(body.action, now());
    } catch (error) {
      return sendApi(res, 400, {
        error: String(error?.message ?? error),
      });
    }
    syncGuard.fire();
    const snapshot = projectUiState(outcome.snapshot, uiStateOptions(url));
    return sendApiJson(req, res, 200, {
      changed: outcome.changed,
      snapshot: { ...snapshot, guard: await guardSummary(guard) },
    });
  }
  if (method === "POST" && path === "/api/tasks") {
    const body = await parseJson(req);
    return sendApi(res, 201, engine.createTask(body, now()));
  }
  if (method === "POST" && path === "/api/tasks/move") {
    const body = await parseJson(req);
    return sendApi(res, 200, {
      tasks: engine.moveTasks(body.ids, body.dueDate, body.reminderTime),
    });
  }
  let match = /^\/api\/tasks\/([^/]+)\/complete$/.exec(path);
  if (method === "POST" && match) {
    return sendApi(
      res,
      200,
      engine.completeTask(decodeURIComponent(match[1]), now()),
    );
  }
  match = /^\/api\/tasks\/([^/]+)$/.exec(path);
  if (method === "PATCH" && match) {
    const body = await parseJson(req);
    return sendApi(
      res,
      200,
      engine.updateTask(
        decodeURIComponent(match[1]),
        body.changes ?? body,
        now(),
      ),
    );
  }
  if (method === "POST" && path === "/api/focus/start") {
    const body = await parseJson(req);
    const timer = engine.focusStart(
      { taskId: body.taskId ?? null, minutes: body.minutes ?? null },
      now(),
    );
    syncGuard.fire();
    return sendApi(res, 200, { timer });
  }
  if (method === "POST" && path === "/api/focus/pause") {
    return sendApi(res, 200, { timer: engine.focusPause(now()) });
  }
  if (method === "POST" && path === "/api/focus/stop") {
    const result = engine.focusStop(now());
    syncGuard.fire();
    return sendApi(res, 200, result);
  }
  sendApi(res, 404, { error: "Not found" });
}

/**
 * 启动 HTTP 服务。返回 { server, port, close }；port 传入 0 时取系统分配端口
 * （测试用），调用方需按实际端口回写 connection.json。
 */
export async function startServer({
  engine,
  dataDir,
  host = "127.0.0.1",
  port = DEFAULT_PORT,
  token,
  version,
  guardClient = null,
}) {
  // guardClient 仅测试注入用：避免在真实桌面上误发锁屏命令。
  const guard = guardClient ?? GuardClient.fromDataDir(dataDir);
  const syncGuard = createGuardSync(engine, guard);
  const library = new ProjectLibrary(engine, dataDir);
  const fileToken = randomBytes(24).toString("hex");
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
          const summary = await guardSummary(guard);
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
          return await handleApi(req, res, url, {
            engine,
            guard,
            syncGuard,
            library,
            fileToken,
          });
        }
        send(res, 404, { error: "Not found" });
      } catch (error) {
        if (error instanceof HttpError || error instanceof LibraryError) {
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
    // 每秒 tick 之后由 main 调用：让 guard 跟上计时/锁机状态。
    syncGuard: syncGuard.fire,
    // 提醒/计时结束时 runtime 让 guard 把 DSH 窗口拉到前台（同一份 token/client）。
    guard,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
