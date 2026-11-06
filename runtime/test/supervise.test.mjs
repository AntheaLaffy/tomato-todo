// 监督器测试：用假 guard 二进制验证「不可达拉起、退出带退避重启、已有
// guard 在跑时只旁观」。假 guard 是 node 脚本，监听 43988 并返回 status。
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { startGuardSupervisor } from "../src/supervise.mjs";
import { GuardClient } from "../src/guard-client.ts";

const PORT = 44998;
const FAKE_GUARD = `
import { createServer } from "node:http";
const server = createServer((req, res) => {
  if (req.url === "/guard/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ locked: false, whitelist: [], pid: process.pid, backend: "test" }));
    return;
  }
  res.writeHead(404).end();
});
server.listen(${PORT}, "127.0.0.1", () => console.error("fake-guard up"));
`;

function setup({ mode = "up" } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "tomato-supervise-"));
  const bin = join(dir, "fake-guard.mjs");
  writeFileSync(
    bin,
    `#!/usr/bin/env node\n${mode === "flaky" ? "process.exit(3);\n" : FAKE_GUARD}`,
    { mode: 0o755 },
  );
  mkdirSync(join(dir, "guard"), { recursive: true });
  writeFileSync(join(dir, "guard", "token"), "t\n");
  return { dir, bin };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) return;
    if (Date.now() > deadline) {
      assert.fail(`超时等待：${label}`);
    }
    await sleep(100);
  }
}

test("guard 不可达时拉起，退出后重启", async () => {
  const { dir, bin } = setup();
  const logger = { error: () => {} };
  const sup = startGuardSupervisor({
    dataDir: dir,
    token: "t",
    logger,
    backoffMs: 100,
    client: new GuardClient({ baseUrl: `http://127.0.0.1:${PORT}`, token: "t", timeoutMs: 500 }),
  });
  process.env.TOMATO_GUARD_BIN = bin;
  try {
    await waitFor(async () => (await sup.status()) !== null, 5000, "首次拉起");
    let status = await sup.status();
    assert.equal(status.backend, "test");

    // 杀掉当前 guard 进程，监督器应重启一个。
    const pidBefore = status.pid;
    process.kill(pidBefore, "SIGKILL");
    await waitFor(async () => {
      const s = await sup.status();
      return s !== null && s.pid !== pidBefore;
    }, 8000, "退出后重启");
    status = await sup.status();
    assert.notEqual(status.pid, pidBefore);
  } finally {
    sup.stop();
    delete process.env.TOMATO_GUARD_BIN;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("候选二进制都拉不起来也不影响 runtime（持续退避重试）", async () => {
  const { dir, bin } = setup({ mode: "flaky" });
  const logger = { error: () => {} };
  process.env.TOMATO_GUARD_BIN = bin;
  const sup = startGuardSupervisor({
    dataDir: dir,
    token: "t",
    logger,
    backoffMs: 50,
    client: new GuardClient({ baseUrl: `http://127.0.0.1:${PORT}`, token: "t", timeoutMs: 500 }),
  });
  try {
    await sleep(400);
    assert.equal(await sup.status(), null);
    assert.doesNotThrow(() => sup.status());
  } finally {
    sup.stop();
    delete process.env.TOMATO_GUARD_BIN;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("已有 guard 在跑时只旁观，不抢端口", async () => {
  const { dir, bin } = setup();
  process.env.TOMATO_GUARD_BIN = bin;
  const { spawn } = await import("node:child_process");
  const existing = spawn(process.execPath, [bin], { stdio: "ignore" });
  await sleep(500);
  const sup = startGuardSupervisor({
    dataDir: dir,
    token: "t",
    logger: { error: () => {} },
    backoffMs: 100,
    client: new GuardClient({ baseUrl: `http://127.0.0.1:${PORT}`, token: "t", timeoutMs: 500 }),
  });
  try {
    await waitFor(async () => (await sup.status()) !== null, 3000, "旁观确认");
    const status = await sup.status();
    assert.equal(status.pid, existing.pid);
  } finally {
    sup.stop();
    existing.kill("SIGTERM");
    delete process.env.TOMATO_GUARD_BIN;
    rmSync(dir, { recursive: true, force: true });
  }
});
