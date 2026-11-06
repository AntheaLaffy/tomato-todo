// runtime HTTP 数据面客户端（形状见 API.md「UI 数据面」）。
//
// 只依赖 fetch：UI 与 runtime 是进程分离的，浏览器直连 127.0.0.1:43987。
// 所有失败都抛 ApiError（带 status / userMessage），由页面决定显示成行内
// 错误还是重试；这里的函数不做乐观更新，交给 store。

export const API_BASE = "http://127.0.0.1:43987";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.userMessage = message;
  }
}

async function request(path, { method = "GET", body, timeoutMs = 5000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    throw new ApiError(
      e && e.name === "AbortError" ? "runtime 响应超时" : "无法连接番茄 runtime（127.0.0.1:43987）",
      0,
    );
  } finally {
    clearTimeout(timer);
  }
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (!res.ok) {
    const message =
      payload && typeof payload.error === "string" && payload.error !== ""
        ? payload.error
        : `请求失败（HTTP ${res.status}）`;
    throw new ApiError(message, res.status);
  }
  return payload;
}

/** 全量状态快照（GET /api/state）。 */
export function getState(opts) {
  return request("/api/state", opts);
}

/** 提交一个 @tomato/core Action（POST /api/dispatch）→ {changed, snapshot}。 */
export function postDispatch(action, opts) {
  return request("/api/dispatch", { ...opts, method: "POST", body: { action } });
}

/**
 * 导出计划 v6 / 备份 v4（JSON，浏览器端由页面负责 Blob 下载）。
 * 端点在 data-runtime 落地前会 404，页面用 typeof fn === "function" + 错误行降级。
 */
export function getExportPlan(opts) {
  return request("/api/export/plan", { timeoutMs: 15000, ...opts });
}

export function getExportBackup(opts) {
  return request("/api/export/backup", { timeoutMs: 30000, ...opts });
}

/** guard 与 runtime 健康摘要（GET /health）。 */
export function getHealth(opts) {
  return request("/health", opts);
}

/** 轻量探活：任何异常都当作离线。 */
export async function ping(opts) {
  try {
    const health = await getHealth({ timeoutMs: 2000, ...opts });
    return health && health.ok === true;
  } catch {
    return false;
  }
}
