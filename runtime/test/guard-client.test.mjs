// guard 客户端测试：命令协议与「guard 没跑时优雅报错不崩」。
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GuardClient, ensureGuardToken } from "../src/guard-client.ts";

const tmp = () => mkdtempSync(join(tmpdir(), "tomato-guard-"));

test("lock/unlock/notify/status/apps 按 API.md 协议发请求", async (t) => {
  const received = [];
  const mock = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      received.push({
        path: req.url,
        auth: req.headers.authorization,
        body: raw ? JSON.parse(raw) : null,
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      if (req.url === "/guard/status") {
        res.end(JSON.stringify({ locked: false, whitelist: [], pid: 42 }));
      } else if (req.url === "/guard/apps") {
        res.end(JSON.stringify({ apps: ["code", "kitty"] }));
      } else {
        res.end(JSON.stringify({ ok: true }));
      }
    });
  });
  await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
  const port = mock.address().port;
  t.after(() => new Promise((resolve) => mock.close(resolve)));

  const client = new GuardClient({
    baseUrl: `http://127.0.0.1:${port}`,
    token: "guard-token",
  });
  const locked = await client.lock({ whitelist: ["firefox.desktop"] });
  assert.equal(locked.ok, true);
  const unlocked = await client.unlock();
  assert.equal(unlocked.ok, true);
  const notified = await client.notify({ title: "休息一下", body: "5 分钟" });
  assert.equal(notified.ok, true);
  assert.equal((await client.fullscreen(true)).ok, true);
  assert.deepEqual(received.at(-1).body, { command: "fullscreen", enabled: true });
  const status = await client.status();
  assert.equal(status.ok, true);
  assert.deepEqual(status.data, { locked: false, whitelist: [], pid: 42 });
  const apps = await client.runningApps();
  assert.deepEqual(apps.data, { apps: ["code", "kitty"] });

  assert.deepEqual(
    received.slice(0, 3).map((r) => r.body.command),
    ["lock", "unlock", "notify"],
  );
  assert.deepEqual(received[0].body.whitelist, ["firefox.desktop"]);
  assert.equal(received[2].body.title, "休息一下");
  assert.equal(received[2].body.body, "5 分钟");
  assert.ok(received.every((r) => r.auth === "Bearer guard-token"));
  assert.equal(received.at(-1).path, "/guard/apps");
});

test("guard 进程没跑：返回 { ok:false, error }，不抛异常", async (t) => {
  // 起一个端口再关掉，确保 ECONNREFUSED
  const dead = createServer();
  await new Promise((resolve) => dead.listen(0, "127.0.0.1", resolve));
  const port = dead.address().port;
  await new Promise((resolve) => dead.close(resolve));

  const client = new GuardClient({
    baseUrl: `http://127.0.0.1:${port}`,
    token: "x",
    timeoutMs: 500,
  });
  for (const call of [
    () => client.lock({}),
    () => client.unlock(),
    () => client.notify({ title: "t", body: "b" }),
    () => client.status(),
    () => client.runningApps(),
  ]) {
    const result = await call();
    assert.equal(result.ok, false);
    assert.match(result.error, /guard 不可达/);
  }
});

test("超时同样优雅失败（挂起不响应的 guard）", async (t) => {
  const mock = createServer(() => {
    /* 不响应 */
  });
  await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
  const port = mock.address().port;
  t.after(() => new Promise((resolve) => mock.close(resolve)));

  const client = new GuardClient({
    baseUrl: `http://127.0.0.1:${port}`,
    timeoutMs: 200,
  });
  const result = await client.status();
  assert.equal(result.ok, false);
  assert.match(result.error, /guard 不可达/);
});

test("ensureGuardToken：幂等生成 token 文件，fromDataDir 读取", () => {
  const dir = tmp();
  const token = ensureGuardToken(dir);
  assert.match(token, /^[0-9a-f-]{36}$/);
  assert.ok(existsSync(join(dir, "guard", "token")));
  assert.equal(ensureGuardToken(dir), token);
  assert.equal(readFileSync(join(dir, "guard", "token"), "utf8").trim(), token);

  const client = GuardClient.fromDataDir(dir);
  assert.equal(client.token, token);
  assert.match(client.baseUrl, /43988$/); // 默认指向契约端口
});
