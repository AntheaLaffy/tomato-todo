// guard 客户端：按 API.md 向 tomato-guard（127.0.0.1:43988）发命令。
// guard 进程没跑时优雅报错（返回 { ok:false, error }），绝不抛出或让 runtime 崩溃。
// token 由 runtime 生成写入 <dataDir>/guard/token，guard 侧验证。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

export const GUARD_PORT = 43988;
export const GUARD_BASE = `http://127.0.0.1:${GUARD_PORT}`;

/** 确保 guard token 存在并返回（runtime 启动时调用；幂等）。 */
export function ensureGuardToken(dataDir) {
  const dir = join(dataDir, "guard");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "token");
  if (existsSync(file)) {
    const token = readFileSync(file, "utf8").trim();
    if (token) return token;
  }
  const token = randomUUID();
  writeFileSync(file, `${token}\n`, { mode: 0o600 });
  return token;
}

export class GuardClient {
  constructor({ baseUrl = GUARD_BASE, token = "", timeoutMs = 2000 } = {}) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.timeoutMs = timeoutMs;
  }

  /** 从 runtime 数据目录读取 guard token。 */
  static fromDataDir(dataDir, options = {}) {
    let token = "";
    const file = join(dataDir, "guard", "token");
    if (existsSync(file)) token = readFileSync(file, "utf8").trim();
    return new GuardClient({ token, ...options });
  }

  async #request(path, { method = "GET", body } = {}) {
    try {
      const headers = {};
      if (this.token) headers.Authorization = `Bearer ${this.token}`;
      if (body !== undefined) headers["Content-Type"] = "application/json";
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        signal: AbortSignal.timeout(this.timeoutMs),
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      return { ok: response.ok, status: response.status, data };
    } catch (error) {
      const cause = error?.cause?.code ?? error?.code;
      return {
        ok: false,
        status: 0,
        error: `guard 进程不可达（${cause ?? error?.message ?? error}）`,
      };
    }
  }

  /** 全屏锁定 + 白名单（focus 开始时按保护设置重发）。 */
  lock({ whitelist = [] } = {}) {
    return this.#request("/guard", {
      method: "POST",
      body: { command: "lock", whitelist },
    });
  }

  unlock() {
    return this.#request("/guard", { method: "POST", body: { command: "unlock" } });
  }

  notify({ title = "", body = "" }) {
    return this.#request("/guard", {
      method: "POST",
      body: { command: "notify", title, body },
    });
  }

  status() {
    return this.#request("/guard/status");
  }
}
