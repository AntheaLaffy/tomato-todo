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
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    throw new ApiError(
      e && e.name === "AbortError"
        ? "runtime 响应超时"
        : "无法连接番茄 runtime（127.0.0.1:43987）",
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
  return request("/api/dispatch", {
    ...opts,
    method: "POST",
    body: { action },
  });
}

// 共享资料库：只在应试教育页给用户点选；不存在助手/MCP 入口（目录授权
// 只能由用户设置）。GET / POST 返回同一形状：{authorized, directory,
// projects, sharedProjects}；DELETE 只取消共享授权，保留项目单独授权。
export function getLibraryGrant(opts) {
  return request("/api/library/grant", opts);
}

export function authorizeLibrary(directory, opts) {
  return request("/api/library/authorize", {
    ...opts,
    method: "POST",
    body: { directory },
  });
}

export function revokeLibraryGrant(opts) {
  return request("/api/library/grant", { ...opts, method: "DELETE" });
}

// 共享库索引：扫描只把文件清单写进 dataDir/library-index.json，不写计划、
// 不写备份，也不等于 education.resources；浏览/搜索都走这组端点。
export function scanLibrary(opts) {
  return request("/api/library/scan", {
    method: "POST",
    timeoutMs: 120000,
    ...opts,
  });
}

export function getLibraryStats(opts) {
  return request("/api/library/stats", { timeoutMs: 8000, ...opts });
}

export function getLibraryItems(
  { projectId, q = "", kind = "", offset = 0, limit = 40 } = {},
  opts,
) {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  if (projectId) params.set("projectId", projectId);
  if (q) params.set("q", q);
  if (kind) params.set("kind", kind);
  return request("/api/library/items?" + params.toString(), {
    timeoutMs: 15000,
    ...opts,
  });
}

/** 文件读取令牌（进程内生成，只用于本机 ?access= 查询参数）。 */
export function getFileToken(opts) {
  return request("/api/file-token", opts);
}

/** 索引文件的直链；预览与下载共用，令牌随 URL 过期于 runtime 退出。 */
export function libraryFileUrl(path, access, download = false) {
  const params = new URLSearchParams({ path, access });
  if (download) params.set("download", "1");
  return API_BASE + "/api/library/file?" + params.toString();
}

/** 把索引条目登记成教学资源（可选动作；目录与路径仍由 runtime 校验）。 */
export function registerResource(projectId, resource, opts) {
  return request(
    "/api/projects/" + encodeURIComponent(projectId) + "/resources",
    {
      ...opts,
      method: "POST",
      body: { resource },
    },
  );
}

/** 检查一个项目资料是否仍在授权目录里（GET /api/projects/:id/resources/scan）。 */
export function scanProjectLibrary(id, opts) {
  return request(
    "/api/projects/" + encodeURIComponent(id) + "/resources/scan",
    {
      timeoutMs: 30000,
      ...opts,
    },
  );
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

/** 当前有窗口的应用（GET /api/apps）→ {apps: [{id, name}], count}。 */
export function getApps(opts) {
  return request("/api/apps", opts);
}

let fullscreenQueue = Promise.resolve();
export function setDesktopFullscreen(enabled) {
  const run = () =>
    request("/api/desktop/fullscreen", { method: "POST", body: { enabled } });
  fullscreenQueue = fullscreenQueue.then(run, run);
  return fullscreenQueue;
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
