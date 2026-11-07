import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectionPath, ensureConnection, writeConnection } from "../src/connection.mjs";

test("second runtime cannot replace the live MCP connection", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "tomato-connection-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const live = { mcpUrl: "http://127.0.0.1:43987/mcp", token: "same-token", pid: process.pid };
  assert.equal(writeConnection(dir, live), true);
  const other = { ...live, mcpUrl: "http://127.0.0.1:35349/mcp", pid: process.pid + 1000 };
  assert.equal(writeConnection(dir, other), false);
  assert.deepEqual(JSON.parse(readFileSync(connectionPath(dir), "utf8")), live);
  assert.equal(statSync(connectionPath(dir)).mode & 0o777, 0o600);
});

test("dead runtime connection can be replaced on restart", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "tomato-connection-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeConnection(dir, { mcpUrl: "http://127.0.0.1:1/mcp", token: "same-token", pid: process.pid });
  const file = connectionPath(dir);
  writeFileSync(file, JSON.stringify({ mcpUrl: "http://127.0.0.1:1/mcp", token: "same-token", pid: 2147483647 }));
  const next = { mcpUrl: "http://127.0.0.1:43987/mcp", token: "same-token", pid: process.pid };
  assert.equal(writeConnection(dir, next), true);
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), next);
  assert.equal(ensureConnection(dir, next), true);
  writeFileSync(file, JSON.stringify({ ...next, mcpUrl: "http://127.0.0.1:1/mcp", pid: 2147483647 }));
  assert.equal(ensureConnection(dir, next), true);
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), next);
});
