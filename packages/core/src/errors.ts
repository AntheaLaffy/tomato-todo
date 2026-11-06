//! 错误约定：Rust 侧 `AppResult<T> = Result<T, String>`，这里统一改为抛出
//! `AppError`（message 即 Rust 的中文错误文案，测试逐字断言）。
//! 对应 Rust 的 `ok_or(msg)` 即 `throw new AppError(msg)`。

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

export function ensure(ok: boolean, message: string): void {
  if (!ok) throw new AppError(message);
}

/** 字符数（Unicode 码点），对应 Rust `s.chars().count()`。 */
export function charCount(s: string): number {
  return Array.from(s).length;
}

/** UTF-8 字节数，对应 Rust `s.len()`。 */
export function utf8Len(s: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(s).length;
  }
  // 保守回退：按 3 字节/码点估算（ASCII 以下估高不会放过超长输入）。
  return charCount(s) * 3;
}

/** 深度克隆并保留原型（AppData/Education 等类实例克隆后方法仍可用）。 */
export function clone<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => clone(v)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const out = Object.create(Object.getPrototypeOf(value)) as Record<string, unknown>;
    for (const key of Object.keys(value)) {
      out[key] = clone((value as Record<string, unknown>)[key]);
    }
    return out as T;
  }
  return value;
}

/** 结构化相等：JSON 值级别的深度比较（含字段顺序无关的键比较）。 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (
    typeof a === "object" &&
    a !== null &&
    typeof b === "object" &&
    b !== null &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}
