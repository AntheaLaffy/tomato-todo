//! JSON 严格解码助手：模拟 serde 的 `deny_unknown_fields`、`#[serde(default)]`
//! 与 camelCase 命名。序列化由各模块手写（键序固定、与 Rust 声明序一致），
//! 保证导出 JSON 形状与旧引擎逐字节可比。

import { AppError } from "./errors";

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** deny_unknown_fields：未知键直接拒绝（Rust 会报 unknown field）。 */
export function rejectUnknown(obj: Record<string, unknown>, allowed: string[], what: string): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      throw new AppError(`未知字段：${what} 不接受 "${key}"`);
    }
  }
}

export function asStr(value: unknown, what: string): string {
  if (typeof value !== "string") throw new AppError(`${what}必须是字符串`);
  return value;
}

export function asBool(value: unknown, what: string): boolean {
  if (typeof value !== "boolean") throw new AppError(`${what}必须是布尔值`);
  return value;
}

export function asInt(value: unknown, what: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new AppError(`${what}必须是整数`);
  }
  return value;
}

export function asArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) throw new AppError(`${what}必须是数组`);
  return value;
}

/** parse 统一带 what（供 asStr/asInt 等直接传入），单参数 lambda 同样兼容。 */
export type Parser<T> = (v: unknown, what: string) => T;

export function asOpt<T>(value: unknown, what: string, parse: Parser<T>): T | null {
  if (value === null) return null;
  return parse(value, what);
}

/** 读取字段：缺省时应用 default；存在（含 null）时按 parse 解析。 */
export function field<T>(
  obj: Record<string, unknown>,
  key: string,
  what: string,
  parse: Parser<T>,
  def: T,
): T {
  const value = obj[key];
  if (value === undefined) return def;
  return parse(value, what);
}

export function requiredField<T>(
  obj: Record<string, unknown>,
  key: string,
  what: string,
  parse: Parser<T>,
): T {
  const value = obj[key];
  if (value === undefined) throw new AppError(`${what}缺少必填字段 ${key}`);
  return parse(value, what);
}

/** 枚举字符串解析（serde rename_all = "camelCase" 的取值）；泛型保留字面量联合以便分支收窄。 */
export function oneOf<T extends string>(value: unknown, what: string, allowed: readonly T[]): T {
  const s = asStr(value, what);
  if (!(allowed as readonly string[]).includes(s)) throw new AppError(`${what}取值无效：${s}`);
  return s as T;
}

/** 字符串数组（按元素解析）。 */
export function asStrArray(value: unknown, what: string, parse: Parser<string>): string[] {
  return asArray(value, what).map((v) => parse(v, what));
}
