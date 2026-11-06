// agent/connection.json：/mcp 的地址与 Bearer token（同旧桥接形状 mcpUrl+token）。
// token 跨重启保持稳定，已保存的 MCP 配置（DSH cordis.patch.yml）不会失效。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";

export function connectionPath(dataDir) {
  return join(dataDir, "agent", "connection.json");
}

export function readConnection(dataDir) {
  try {
    return JSON.parse(readFileSync(connectionPath(dataDir), "utf8"));
  } catch {
    return null;
  }
}

export function writeConnection(dataDir, connection) {
  const file = connectionPath(dataDir);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(connection, null, 2)}\n`);
}

/** 读取或生成连接信息（token 复用已有值），并回写当前 pid/地址。 */
export function loadOrCreateConnection(dataDir, host, port) {
  const existing = readConnection(dataDir);
  return {
    mcpUrl: `http://${host}:${port}/mcp`,
    token: existing?.token ?? randomUUID(),
    pid: process.pid,
  };
}
