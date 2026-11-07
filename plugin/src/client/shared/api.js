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

/**
 * 教学资源目录（`?education=lite` 只给 id/projectId/title/kind/path）。
 * 作业工作台按需取一次：默认 /api/state 省略资源明细，是为了轮询体积。
 */
export function getStateWithResources(opts) {
  return request("/api/state?education=lite", opts);
}

/** 单条项目资源的文件信息：正文路径不返回，只给大小/预览能力。 */
export function getResourceInfo(id, opts) {
  return request("/api/resources/" + encodeURIComponent(id) + "/info", opts);
}

/** 项目资源原件地址：download=1 取附件，否则 inline（预览上限 20 MiB）。 */
export function resourceFileUrl(id, access, download = false) {
  const params = new URLSearchParams({ access });
  if (download) params.set("download", "1");
  return (
    API_BASE +
    "/api/resources/" +
    encodeURIComponent(id) +
    "/file?" +
    params.toString()
  );
}

/** 索引文件的直链；预览与下载共用，令牌随 URL 过期于 runtime 退出。 */
export function libraryFileUrl(path, access, download = false) {
  const params = new URLSearchParams({ path, access });
  if (download) params.set("download", "1");
  return API_BASE + "/api/library/file?" + params.toString();
}

// 项目资料目录授权与已登记资源的维护。授权/取消都只改 grant 文件，不移动、
// 不复制用户磁盘上的文件；路径解析与越界校验在 runtime 的 project-library 里。
export function getProjectGrant(id, opts) {
  return request("/api/projects/" + encodeURIComponent(id) + "/grant", opts);
}

export function authorizeProjectDirectory(id, directory, opts) {
  return request("/api/projects/" + encodeURIComponent(id) + "/authorize", {
    method: "POST",
    body: { directory },
    ...opts,
  });
}

export function getProjectResources(
  id,
  { q = "", kind = "", status = "", offset = 0, limit = 40 } = {},
  opts,
) {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  if (q) params.set("q", q);
  if (kind) params.set("kind", kind);
  if (status) params.set("status", status);
  return request(
    "/api/projects/" + encodeURIComponent(id) + "/resources?" + params,
    opts,
  );
}

/** 登记一条已存在于授权目录内的资料（POST /api/projects/:id/resources）。 */
export function registerProjectResource(id, resource, opts) {
  return request("/api/projects/" + encodeURIComponent(id) + "/resources", {
    method: "POST",
    body: { resource },
    ...opts,
  });
}

/**
 * 按资料库索引整批登记；`paths` 省略时由 runtime 取该项目目录内全部。
 * 返回 {registered, skipped, considered}：skipped 是按 path 已登记过的条目。
 */
export function importProjectResources(id, { paths } = {}, opts) {
  return request(
    "/api/projects/" + encodeURIComponent(id) + "/resources/import",
    {
      method: "POST",
      body: Array.isArray(paths) ? { paths } : {},
      timeoutMs: 60000,
      ...opts,
    },
  );
}

/** 清理失效登记；省略 ids 时清理所有「仍缺失且无教学引用」的条目。 */
export function cleanupProjectResources(id, ids, opts) {
  return request(
    "/api/projects/" + encodeURIComponent(id) + "/resources/cleanup",
    {
      method: "POST",
      body: ids === undefined ? {} : { ids },
      ...opts,
    },
  );
}

/** 保留资源 ID，把路径改到移动/改名后的新位置。 */
export function repairProjectResource(id, resourceId, path, opts) {
  return request(
    "/api/projects/" +
      encodeURIComponent(id) +
      "/resources/" +
      encodeURIComponent(resourceId) +
      "/repair",
    {
      method: "POST",
      body: { path },
      ...opts,
    },
  );
}

/**
 * 导出计划 v6 / 备份 v4（JSON，浏览器端由页面负责 Blob 下载）。
 * 端点在 data-runtime 落地前会 404，页面用 typeof fn === "function" + 错误行降级。
 */
export function scanProjectLibrary(id, opts) {
  return request(
    "/api/projects/" + encodeURIComponent(id) + "/resources/scan",
    {
      timeoutMs: 30000,
      ...opts,
    },
  );
}

/** 登记一份项目资料（POST /api/projects/:id/resources）。 */
export function registerResource(id, resource, opts) {
  return registerProjectResource(id, resource, opts);
}

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
