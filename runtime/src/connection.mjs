// agent/connection.json：/mcp 的地址与 Bearer token（同旧桥接形状 mcpUrl+token）。
// token 跨重启保持稳定，已保存的 MCP 配置（DSH cordis.patch.yml）不会失效。
import {
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
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
  const existing = readConnection(dataDir);
  if (existing?.pid !== connection.pid && processAlive(existing?.pid)) {
    // A short-lived second runtime must not redirect the installed MCP client
    // away from the still-running desktop service.
    return false;
  }
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(connection, null, 2)}\n`, {
      mode: 0o600,
    });
    renameSync(temporary, file);
  } finally {
    try {
      unlinkSync(temporary);
    } catch {
      /* renamed or already removed */
    }
  }
  return true;
}

export function ensureConnection(dataDir, connection) {
  const existing = readConnection(dataDir);
  if (
    existing?.pid === connection.pid &&
    existing?.mcpUrl === connection.mcpUrl &&
    existing?.token === connection.token
  )
    return true;
  return writeConnection(dataDir, connection);
}

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
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
