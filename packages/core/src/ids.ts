//! 实体 ID：UUID v4（对应 Rust `Uuid::new_v4().to_string()`）。
//! 优先用平台 `crypto.randomUUID`，退化时用 Math.random 实现 RFC 4122 v4。

export function id(): string {
  const crypto = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 退化实现（仅用于无 crypto 的环境）。
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
