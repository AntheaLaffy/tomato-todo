// guard 客户端：按 API.md「guard 命令协议」向 tomato-guard（127.0.0.1:43988）发命令。
// guard 没跑 / token 错 / 超时都返回结构化结果，绝不抛异常炸掉 runtime。
// token：runtime 生成后写入 <dataDir>/guard/token（0600），guard 侧校验；
// guard 自行生成 token 时也写同一路径（见 crates/guard/src/token.rs）。
//
// 本文件自包含：不 import runtime 的 types.ts；类型形状以 API.md 为准。
// 语法只含可擦除 TS（erasableSyntaxOnly），可直接被 Node 24 的 type stripping 运行。

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const GUARD_PORT = 43988;
export const GUARD_BASE_URL = `http://127.0.0.1:${GUARD_PORT}`;

// ---- 自包含类型 ----

/** GET /guard/status 的响应体（API.md：{ locked, whitelist, pid }）。
 *  guard 侧协议当前不带 backend；如后续补充则原样透传。 */
export interface GuardStatusPayload {
  locked?: boolean;
  whitelist?: string[];
  pid?: number;
  backend?: string;
}

/** runGuardStatus 成功输出里的 guard 摘要。 */
export interface GuardSummary {
  available: true;
  backend: string;
  locked: boolean;
  whitelist: string[];
  pid: number;
}

export interface GuardClientOptions {
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
}

/** GuardClient 每个请求的统一结果：业务失败与网络失败都体现在字段里，不用异常。 */
export interface GuardResult {
  /** 是否收到 2xx。 */
  ok: boolean;
  /** HTTP 状态码；0 表示网络层失败（没收到响应）。 */
  status: number;
  /** 响应体：2xx 的 JSON（非 JSON 时是原文）；非 2xx 时保留便于排查。 */
  data?: unknown;
  /** ok=false 时的说明：网络失败 / 非 2xx 的 error 字段或回退文案。 */
  error?: string;
}

// ---- token ----

/** 确保 guard token 存在并返回（runtime 启动时调用；幂等）。
 *  已存在且非空则原样返回；缺失或为空时生成 UUID 写入（0600）。 */
export function ensureGuardToken(dataDir: string): string {
  const dir = join(dataDir, "guard");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "token");
  if (existsSync(file)) {
    const existing = readFileSync(file, "utf8").trim();
    if (existing) return existing;
  }
  const token = randomUUID();
  writeFileSync(file, `${token}\n`, { mode: 0o600 });
  return token;
}

/** 从 runtime 数据目录读取 guard token。文件缺失/不可读时返回空串：
 *  请求将不带 Authorization，guard 会以 401 的结构化结果拒绝，而不是抛异常。 */
export function readGuardToken(dataDir: string): string {
  try {
    const file = join(dataDir, "guard", "token");
    if (!existsSync(file)) return "";
    return readFileSync(file, "utf8").trim();
  } catch {
    return "";
  }
}

// ---- 客户端 ----

export class GuardClient {
  readonly baseUrl: string;
  readonly token: string;
  readonly timeoutMs: number;

  constructor(options: GuardClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? GUARD_BASE_URL;
    this.token = options.token ?? "";
    this.timeoutMs = options.timeoutMs ?? 2000;
  }

  /** 从 runtime 数据目录构造（token 取自 <dataDir>/guard/token）。 */
  static fromDataDir(
    dataDir: string,
    options: GuardClientOptions = {},
  ): GuardClient {
    return new GuardClient({ token: readGuardToken(dataDir), ...options });
  }

  /** 全屏锁定 + 白名单；focus 会话开始 / 保护设置变化时（重）发。 */
  lock({
    whitelist = [],
  }: { whitelist?: string[] } = {}): Promise<GuardResult> {
    return this.#request("/guard", {
      method: "POST",
      body: { command: "lock", whitelist },
    });
  }

  unlock(): Promise<GuardResult> {
    return this.#request("/guard", {
      method: "POST",
      body: { command: "unlock" },
    });
  }

  notify({
    title = "",
    body = "",
  }: { title?: string; body?: string } = {}): Promise<GuardResult> {
    return this.#request("/guard", {
      method: "POST",
      body: { command: "notify", title, body },
    });
  }

  status(): Promise<GuardResult> {
    return this.#request("/guard/status");
  }

  async #request(
    path: string,
    { method = "GET", body }: { method?: string; body?: unknown } = {},
  ): Promise<GuardResult> {
    const headers: Record<string, string> = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      return {
        ok: false,
        status: 0,
        error: `guard 不可达（${describeNetworkError(error, this.timeoutMs)}）`,
      };
    }

    const text = await response.text().catch(() => "");
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (response.ok) return { ok: true, status: response.status, data };
    return {
      ok: false,
      status: response.status,
      data,
      error: describeHttpError(data, response.status),
    };
  }
}

function describeNetworkError(error: unknown, timeoutMs: number): string {
  const e = error as {
    name?: string;
    code?: string;
    cause?: { code?: string };
    message?: string;
  };
  if (e?.name === "TimeoutError" || e?.name === "AbortError")
    return `超时（${timeoutMs}ms）`;
  const code = e?.cause?.code ?? e?.code;
  if (typeof code === "string" && code) return code;
  return e?.message ?? String(error);
}

function describeHttpError(data: unknown, status: number): string {
  if (isRecord(data) && typeof data.error === "string" && data.error)
    return data.error;
  if (typeof data === "string" && data) return data;
  return `guard 返回 HTTP ${status}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---- --guard-status 一次性处理 ----

export interface GuardStatusArgs {
  /** --data 的值；未给时为 null，由 bin 层套用默认数据目录。 */
  dataDir: string | null;
}

/** 供 bin 层调用的 argv 解析辅助：接受 --guard-status（模式标记，忽略）与
 *  --data <dir>；未知参数 / 缺值抛 Error（是否退出、退出码与 usage 文案由 bin 层定）。 */
export function parseGuardStatusArgs(argv: readonly string[]): GuardStatusArgs {
  let dataDir: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--guard-status") continue;
    if (arg === "--data") {
      const next = argv[i + 1];
      if (next === undefined) throw new Error("--data 缺少参数");
      dataDir = next;
      i++;
      continue;
    }
    throw new Error(`未知参数：${arg}`);
  }
  return { dataDir };
}

export interface GuardStatusOk {
  ok: true;
  guard: GuardSummary;
}

export interface GuardStatusFail {
  ok: false;
  error: string;
}

export type GuardStatusReport = GuardStatusOk | GuardStatusFail;

/** 一次性 --guard-status 处理器：查 guard 状态 → stdout 打单行 JSON → 返回同一对象。
 *  成功 { ok:true, guard:{ available:true, backend, locked, whitelist, pid } }；
 *  guard 不可达（连不上/超时/token 错/非 2xx）{ ok:false, error }。
 *  退出码由 bin 层按 ok 决定；本函数不 process.exit、不抛异常。 */
export async function runGuardStatus(
  dataDir: string,
  options: GuardClientOptions = {},
): Promise<GuardStatusReport> {
  const client = GuardClient.fromDataDir(dataDir, options);
  const result = await client.status();
  const report: GuardStatusReport = result.ok
    ? { ok: true, guard: coerceSummary(result.data) }
    : { ok: false, error: result.error ?? `guard 返回 HTTP ${result.status}` };
  console.log(JSON.stringify(report));
  return report;
}

/** 把 /guard/status 的响应体规整成摘要；字段缺失时给安全默认值。
 *  backend：guard 侧协议当前不返回，契约示例以 "x11" 为基线；guard 一旦上报则透传。 */
function coerceSummary(data: unknown): GuardSummary {
  const payload = isRecord(data) ? data : {};
  const backend =
    typeof payload.backend === "string" && payload.backend
      ? payload.backend
      : "x11";
  const locked = payload.locked === true;
  const whitelist = Array.isArray(payload.whitelist)
    ? payload.whitelist.filter(
        (item): item is string => typeof item === "string",
      )
    : [];
  const pid =
    typeof payload.pid === "number" &&
    Number.isInteger(payload.pid) &&
    payload.pid >= 0
      ? payload.pid
      : 0;
  return { available: true, backend, locked, whitelist, pid };
}
