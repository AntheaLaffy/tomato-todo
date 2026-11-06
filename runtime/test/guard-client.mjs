// guard 客户端测试：用 node:http 起假 guard，覆盖命令形状、鉴权、错误路径与
// runGuardStatus / argv 解析的全部路径。运行：node --test runtime/test/guard-client.mjs
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  GUARD_BASE_URL,
  GuardClient,
  ensureGuardToken,
  parseGuardStatusArgs,
  readGuardToken,
  runGuardStatus,
} from "../src/guard-client.ts";

const TOKEN = "test-token-abc";

/** 起一个假 guard：把每个请求收进记录，交给 handler 应答。 */
async function withServer(handler, fn) {
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    let body = null;
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = raw;
      }
    }
    const ctx = {
      method: req.method,
      url: req.url,
      authorization: req.headers.authorization ?? "",
      contentType: req.headers["content-type"] ?? "",
      body,
      send(status, payload) {
        const text =
          typeof payload === "string" ? payload : JSON.stringify(payload);
        res.writeHead(status, {
          "Content-Type": "application/json; charset=utf-8",
        });
        res.end(text);
      },
    };
    try {
      await handler(ctx);
    } catch (error) {
      ctx.send(500, { error: String(error?.message ?? error) });
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    return await fn(baseUrl);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
}

/** 一个肯定没人监听的端口（先占后放）。 */
async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function tempDir() {
  return mkdtempSync(join(tmpdir(), "tomato-guard-client-"));
}

// ---- GuardClient 命令形状与响应透传 ----

test("lock 发 POST /guard：command=lock、白名单、Bearer token", async () => {
  await withServer(
    async (ctx) => {
      assert.equal(ctx.method, "POST");
      assert.equal(ctx.url, "/guard");
      assert.equal(ctx.authorization, `Bearer ${TOKEN}`);
      assert.equal(ctx.contentType, "application/json");
      assert.deepEqual(ctx.body, {
        command: "lock",
        whitelist: ["code", "obsidian"],
      });
      ctx.send(200, { ok: true });
    },
    async (baseUrl) => {
      const client = new GuardClient({ baseUrl, token: TOKEN });
      const result = await client.lock({ whitelist: ["code", "obsidian"] });
      assert.deepEqual(result, { ok: true, status: 200, data: { ok: true } });
    },
  );
});

test("lock 省略 whitelist 时发空数组", async () => {
  await withServer(
    async (ctx) => {
      assert.deepEqual(ctx.body, { command: "lock", whitelist: [] });
      ctx.send(200, { ok: true });
    },
    async (baseUrl) => {
      const client = new GuardClient({ baseUrl, token: TOKEN });
      assert.equal((await client.lock()).ok, true);
    },
  );
});

test('unlock 发 { command: "unlock" }', async () => {
  await withServer(
    async (ctx) => {
      assert.equal(ctx.method, "POST");
      assert.equal(ctx.url, "/guard");
      assert.deepEqual(ctx.body, { command: "unlock" });
      ctx.send(200, { ok: true });
    },
    async (baseUrl) => {
      const client = new GuardClient({ baseUrl, token: TOKEN });
      const result = await client.unlock();
      assert.deepEqual(result, { ok: true, status: 200, data: { ok: true } });
    },
  );
});

test("notify 携带 title 与 body", async () => {
  await withServer(
    async (ctx) => {
      assert.deepEqual(ctx.body, {
        command: "notify",
        title: "番茄完成",
        body: "休息一下",
      });
      ctx.send(200, { ok: true });
    },
    async (baseUrl) => {
      const client = new GuardClient({ baseUrl, token: TOKEN });
      assert.equal(
        (await client.notify({ title: "番茄完成", body: "休息一下" })).ok,
        true,
      );
    },
  );
});

test("status 用 GET /guard/status 无 body、无 Content-Type", async () => {
  await withServer(
    async (ctx) => {
      assert.equal(ctx.method, "GET");
      assert.equal(ctx.url, "/guard/status");
      assert.equal(ctx.authorization, `Bearer ${TOKEN}`);
      assert.equal(ctx.contentType, "");
      assert.equal(ctx.body, null);
      ctx.send(200, { locked: true, whitelist: ["code"], pid: 1234 });
    },
    async (baseUrl) => {
      const client = new GuardClient({ baseUrl, token: TOKEN });
      const result = await client.status();
      assert.deepEqual(result, {
        ok: true,
        status: 200,
        data: { locked: true, whitelist: ["code"], pid: 1234 },
      });
    },
  );
});

// ---- 错误路径（结构化，不抛异常） ----

test("token 错 → 401 结构化错误，error 取响应体字段", async () => {
  await withServer(
    async (ctx) => {
      if (ctx.authorization !== `Bearer ${TOKEN}`) {
        ctx.send(401, { error: "unauthorized" });
        return;
      }
      ctx.send(200, { ok: true });
    },
    async (baseUrl) => {
      const client = new GuardClient({ baseUrl, token: "wrong-token" });
      const result = await client.lock();
      assert.deepEqual(result, {
        ok: false,
        status: 401,
        data: { error: "unauthorized" },
        error: "unauthorized",
      });
    },
  );
});

test("guard 500 且 JSON error 字段透传", async () => {
  await withServer(
    async (ctx) => {
      ctx.send(500, { error: "后端不支持" });
    },
    async (baseUrl) => {
      const client = new GuardClient({ baseUrl, token: TOKEN });
      const result = await client.status();
      assert.equal(result.ok, false);
      assert.equal(result.status, 500);
      assert.equal(result.error, "后端不支持");
    },
  );
});

test("guard 非 JSON 错误体作为 error 原文", async () => {
  await withServer(
    async (ctx) => {
      ctx.send(502, "boom");
    },
    async (baseUrl) => {
      const client = new GuardClient({ baseUrl, token: TOKEN });
      const result = await client.status();
      assert.equal(result.ok, false);
      assert.equal(result.status, 502);
      assert.equal(result.error, "boom");
    },
  );
});

test("guard 未启动（连接拒绝）→ ok:false status:0，不抛异常", async () => {
  const port = await freePort();
  const client = new GuardClient({
    baseUrl: `http://127.0.0.1:${port}`,
    token: TOKEN,
  });
  const result = await client.status();
  assert.equal(result.ok, false);
  assert.equal(result.status, 0);
  assert.match(result.error, /^guard 不可达（/);
});

test("guard 不回包 → 超时结构化错误", async () => {
  await withServer(
    async () => {
      // 永远不回应，让客户端超时。
      await new Promise(() => {});
    },
    async (baseUrl) => {
      const client = new GuardClient({ baseUrl, token: TOKEN, timeoutMs: 80 });
      const result = await client.status();
      assert.equal(result.ok, false);
      assert.equal(result.status, 0);
      assert.match(result.error, /超时（80ms）/);
    },
  );
});

// ---- token 文件 ----

test("ensureGuardToken 创建 token、幂等、0600", () => {
  const dir = tempDir();
  try {
    const token = ensureGuardToken(dir);
    assert.equal(typeof token, "string");
    assert.ok(token.length >= 32);
    assert.equal(ensureGuardToken(dir), token);
    const file = join(dir, "guard", "token");
    assert.equal(readFileSync(file, "utf8").trim(), token);
    if (process.platform !== "win32") {
      assert.equal(statSync(file).mode & 0o777, 0o600);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fromDataDir 读 <dataDir>/guard/token；缺失时为空串", () => {
  const dir = tempDir();
  try {
    const token = ensureGuardToken(dir);
    assert.equal(GuardClient.fromDataDir(dir).token, token);
    assert.equal(readGuardToken(dir), token);

    const empty = tempDir();
    try {
      assert.equal(GuardClient.fromDataDir(empty).token, "");
      assert.equal(readGuardToken(empty), "");
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fromDataDir 空白 token 文件按缺失处理", () => {
  const dir = tempDir();
  try {
    mkdirSync(join(dir, "guard"), { recursive: true });
    writeFileSync(join(dir, "guard", "token"), "  \n");
    assert.equal(GuardClient.fromDataDir(dir).token, "");
    assert.equal(readGuardToken(dir), "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---- runGuardStatus ----

test("runGuardStatus 成功：stdout 单行 JSON，返回 { ok:true, guard:{...} }", async () => {
  const dir = tempDir();
  const logs = [];
  const original = console.log;
  console.log = (...args) => logs.push(args.join(" "));
  try {
    await withServer(
      async (ctx) => {
        ctx.send(200, { locked: false, whitelist: [], pid: 1234 });
      },
      async (baseUrl) => {
        const result = await runGuardStatus(dir, { baseUrl, token: TOKEN });
        assert.deepEqual(result, {
          ok: true,
          guard: {
            available: true,
            backend: "x11",
            locked: false,
            whitelist: [],
            pid: 1234,
          },
        });
        assert.equal(logs.length, 1);
        assert.deepEqual(JSON.parse(logs[0]), result);
      },
    );
  } finally {
    console.log = original;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runGuardStatus 透传 guard 上报的 backend 与白名单", async () => {
  await withServer(
    async (ctx) => {
      ctx.send(200, {
        locked: true,
        whitelist: ["code", 7],
        pid: 99,
        backend: "EWMH / X11",
      });
    },
    async (baseUrl) => {
      const result = await runGuardStatus(tempDir(), { baseUrl, token: TOKEN });
      assert.deepEqual(result, {
        ok: true,
        guard: {
          available: true,
          backend: "EWMH / X11",
          locked: true,
          whitelist: ["code"],
          pid: 99,
        },
      });
    },
  );
});

test("runGuardStatus 对畸形 status 响应给安全默认值", async () => {
  await withServer(
    async (ctx) => {
      ctx.send(200, { nope: true });
    },
    async (baseUrl) => {
      const result = await runGuardStatus(tempDir(), { baseUrl, token: TOKEN });
      assert.deepEqual(result, {
        ok: true,
        guard: {
          available: true,
          backend: "x11",
          locked: false,
          whitelist: [],
          pid: 0,
        },
      });
    },
  );
});

test("runGuardStatus guard 不可达 → { ok:false, error } 且同样打印 JSON", async () => {
  const port = await freePort();
  const logs = [];
  const original = console.log;
  console.log = (...args) => logs.push(args.join(" "));
  try {
    const result = await runGuardStatus(tempDir(), {
      baseUrl: `http://127.0.0.1:${port}`,
      token: TOKEN,
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /^guard 不可达（/);
    assert.equal(logs.length, 1);
    assert.deepEqual(JSON.parse(logs[0]), result);
  } finally {
    console.log = original;
  }
});

test("runGuardStatus token 错 → { ok:false, error }", async () => {
  await withServer(
    async (ctx) => {
      ctx.send(401, { error: "unauthorized" });
    },
    async (baseUrl) => {
      const result = await runGuardStatus(tempDir(), {
        baseUrl,
        token: "wrong",
      });
      assert.deepEqual(result, { ok: false, error: "unauthorized" });
    },
  );
});

test("runGuardStatus 从数据目录读 token（fromDataDir 接线）", async () => {
  const dir = tempDir();
  try {
    const token = ensureGuardToken(dir);
    await withServer(
      async (ctx) => {
        assert.equal(ctx.authorization, `Bearer ${token}`);
        ctx.send(200, { locked: false, whitelist: [], pid: 7 });
      },
      async (baseUrl) => {
        const result = await runGuardStatus(dir, { baseUrl });
        assert.equal(result.ok, true);
        assert.equal(result.guard.pid, 7);
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---- argv 解析辅助 ----

test("parseGuardStatusArgs 接受 --guard-status 与 --data", () => {
  assert.deepEqual(parseGuardStatusArgs(["--guard-status"]), { dataDir: null });
  assert.deepEqual(
    parseGuardStatusArgs(["--guard-status", "--data", "/tmp/x"]),
    {
      dataDir: "/tmp/x",
    },
  );
  assert.deepEqual(
    parseGuardStatusArgs(["--data", "/tmp/y", "--guard-status"]),
    {
      dataDir: "/tmp/y",
    },
  );
});

test("parseGuardStatusArgs 对缺值与未知参数抛 Error（退出码由 bin 层决定）", () => {
  assert.throws(() => parseGuardStatusArgs(["--data"]), /--data 缺少参数/);
  assert.throws(() => parseGuardStatusArgs(["--wat"]), /未知参数：--wat/);
});

// ---- 常量 ----

test("默认端口与地址契约：127.0.0.1:43988", () => {
  assert.equal(GUARD_BASE_URL, "http://127.0.0.1:43988");
  assert.equal(new GuardClient().baseUrl, GUARD_BASE_URL);
  assert.equal(new GuardClient().timeoutMs, 2000);
});
