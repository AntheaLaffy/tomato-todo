import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createInterface } from "node:readline";
import { mkdtemp, readFile, stat, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { chromium, expect } from "@playwright/test";
import { ModelRuntime } from "../agent/node_modules/@earendil-works/pi-coding-agent/dist/index.js";
import { createStudySession } from "../agent/session.mjs";
import { parseExa, publicAddress } from "../agent/web.mjs";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, tries = 100) {
  for (let i = 0; i < tries; i++) {
    const value = await fn();
    if (value) return value;
    await delay(100);
  }
  throw new Error("timed out");
}

test("Exa search results parse and transparent-proxy ranges stay reachable", () => {
  // Transparent proxies (Clash fake-ip) answer public hostnames with 198.18.0.0/15;
  // blocking that range would silently disable every network tool on those hosts.
  assert.equal(publicAddress("198.18.0.4"), true);
  assert.equal(publicAddress("198.19.255.1"), true);
  assert.equal(publicAddress("10.0.0.1"), false);
  assert.equal(publicAddress("192.168.1.1"), false);
  assert.equal(publicAddress("127.0.0.1"), false);
  const text = `Title: 中国研究生招生信息网
URL: https://yz.chsi.com.cn/
Published: 2025-01-01T00:00:00.000Z
Author: N/A
Highlights:
全国硕士研究生招生考试公告

---

Title: Example
URL: https://example.com/a
Published: N/A
Author: N/A
Highlights:
Plain snippet`;
  const results = parseExa(text, 5);
  assert.equal(results.length, 2);
  assert.equal(results[0].title, "中国研究生招生信息网");
  assert.equal(results[0].url, "https://yz.chsi.com.cn/");
  assert.equal(results[0].publishedAt, "2025-01-01T00:00:00.000Z");
  assert.ok(results[0].description.includes("全国硕士研究生招生考试公告"));
  assert.equal(results[1].url, "https://example.com/a");
  assert.equal(results[1].publishedAt, null);
  assert.equal(parseExa(text, 1).length, 1);
});

test(
  "actual Pi SDK streams, calls only approved tools and resumes app-owned history",
  { timeout: 30000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "tomato-pi-"));
    const requests = [],
      calls = [];
    let turn = 0;
    const server = createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      const parsed = JSON.parse(body);
      requests.push(parsed);
      assert.equal(req.url, "/chat/completions");
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      const tool = turn++ === 0;
      const delta = tool
        ? {
            role: "assistant",
            tool_calls: [
              {
                index: 0,
                id: "call_context",
                type: "function",
                function: { name: "get_context", arguments: "{}" },
              },
            ],
          }
        : { role: "assistant", content: "先核实可用时间，再生成待审阅方案。" };
      const chunk = (delta, finish_reason = null) => ({
        id: "chatcmpl-test",
        object: "chat.completion.chunk",
        created: 1,
        model: "fake",
        choices: [{ index: 0, delta, finish_reason }],
      });
      res.write(`data: ${JSON.stringify(chunk(delta))}\n\n`);
      res.write(
        `data: ${JSON.stringify(chunk({}, tool ? "tool_calls" : "stop"))}\n\n`,
      );
      res.end("data: [DONE]\n\n");
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const runtime = await ModelRuntime.create({
      credentials: {
        read: async () => undefined,
        list: async () => [],
        modify: async () => undefined,
        delete: async () => {},
      },
      modelsPath: null,
      refreshOnCreate: false,
      allowModelNetwork: false,
    });
    runtime.registerProvider("deepseek", {
      baseUrl: `http://127.0.0.1:${server.address().port}`,
      apiKey: "synthetic-test-key",
      api: "openai-completions",
      models: [
        {
          id: "fake",
          name: "Fake local model",
          reasoning: false,
          input: ["text"],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 65536,
          maxTokens: 4096,
        },
      ],
    });
    const command = {
      provider: "deepseek",
      model: "fake",
      automatic: true,
      tools: [
        {
          name: "get_context",
          description: "Read learning context",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "dispatch",
          description: "Must never become available",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "bash",
          description: "Must never become available",
          inputSchema: { type: "object", properties: {} },
        },
      ],
    };
    let session;
    try {
      const created = await createStudySession({
        runtime,
        dir,
        root: resolve("agent"),
        command,
        toolRequest: async (name) => {
          calls.push(name);
          return { today: "2026-10-12", memories: [], taskCount: 0 };
        },
      });
      session = created.session;
      // Pi's coding tools plus codemode/tool_search stay available in the sandboxed
      // workspace; the Rust-side dispatch/bash entries must never reach the model.
      const studyTools = [
        "get_context",
        "read",
        "write",
        "edit",
        "bash",
        "ls",
        "find",
        "grep",
        "codemode",
        "tool_search",
      ];
      let text = "";
      session.subscribe((event) => {
        if (
          event.type === "message_update" &&
          event.assistantMessageEvent?.type === "text_delta"
        )
          text += event.assistantMessageEvent.delta;
      });
      await session.prompt("请先读学情摘要");
      assert.deepEqual(calls, ["get_context"]);
      assert.ok(text.includes("先核实可用时间"));
      assert.deepEqual(
        requests[0].tools.map((t) => t.function.name),
        studyTools,
      );
      const file = created.manager.getSessionFile();
      assert.ok(file.startsWith(join(dir, "sessions")));
      const history = await readFile(file, "utf8");
      assert.ok(history.includes("请先读学情摘要"));
      session.dispose();
      const resumed = await createStudySession({
        runtime,
        dir,
        root: resolve("agent"),
        command: { ...command, sessionFile: file },
        toolRequest: async () => ({}),
      });
      session = resumed.session;
      await session.prompt("接着刚才的讨论");
      assert.ok(
        requests
          .at(-1)
          .messages.some((m) =>
            JSON.stringify(m.content).includes("请先读学情摘要"),
          ),
      );
      assert.deepEqual(
        requests.at(-1).tools.map((t) => t.function.name),
        studyTools,
      );
    } finally {
      session?.dispose();
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    }
  },
);

test(
  "Rust service, authenticated MCP stdio, file review/import and learning assistant UI",
  { timeout: 90000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "tomato-agent-ui-"));
    const url = "http://127.0.0.1:4341";
    const server = spawn("target/debug/tomato-preview", [], {
      env: {
        ...process.env,
        TOMATO_PORT: "4341",
        TOMATO_DATA_PATH: join(dir, "data.sqlite3"),
      },
      stdio: "pipe",
    });
    let output = "",
      browser,
      mcp;
    server.stderr.on("data", (b) => (output += b));
    const api = async (request) => {
      const r = await fetch(`${url}/api/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    };
    const tool = (name, args = {}) =>
      api({ op: "tool", name, arguments: args });
    try {
      await waitFor(async () => {
        try {
          return (await fetch(`${url}/api/snapshot`)).ok;
        } catch {
          return false;
        }
      }, 300).catch(() => {
        throw new Error(output);
      });
      const info = await waitFor(async () => {
        const s = await api({ op: "status" });
        return s.providers?.deepseek ? s : false;
      });
      assert.equal(info.preferences.provider, "deepseek");
      assert.equal(info.preferences.enabled, false);
      const snapshot = await (await fetch(`${url}/api/snapshot`)).json();
      await fetch(`${url}/api/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "saveTask",
          task: { title: "Review test", estimate: 1, dueDate: snapshot.today },
        }),
      });
      const exported = await tool("export_plan", { name: "review.json" });
      const edited = await tool("patch_file", {
        name: "review.json",
        fileHash: exported.fileHash,
        edits: [
          { op: "replace", path: "/tasks/0/title", value: "Reviewed task" },
        ],
      });
      const review = await tool("review_file", {
        name: "review.json",
        fileHash: edited.fileHash,
      });
      assert.ok(
        review.changes.some(
          (c) => c.before === "Review test" && c.after === "Reviewed task",
        ),
      );
      const connectionFile = join(dir, "agent/connection.json");
      const connection = JSON.parse(await readFile(connectionFile));
      assert.equal((await stat(connectionFile)).mode & 0o777, 0o600);
      assert.equal(
        (
          await fetch(connection.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ method: "tools/list" }),
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await fetch(connection.url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${connection.token}`,
              Origin: "https://untrusted.example",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ method: "tools/list" }),
          })
        ).status,
        401,
      );
      mcp = spawn(
        "target/debug/tomato-preview",
        ["--mcp", "--connection", connectionFile],
        { stdio: "pipe" },
      );
      const replies = new Map();
      createInterface({ input: mcp.stdout }).on("line", (line) => {
        const v = JSON.parse(line);
        replies.set(v.id, v);
      });
      const rpc = async (id, method, params) => {
        mcp.stdin.write(
          `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
        );
        return waitFor(() => replies.get(id));
      };
      assert.equal(
        (await rpc(1, "initialize", { protocolVersion: "2025-11-25" })).result
          .serverInfo.name,
        "tomato-study",
      );
      const listed = await rpc(2, "tools/list");
      assert.ok(listed.result.tools.some((t) => t.name === "dispatch"));
      const blocked = await rpc(3, "tools/call", {
        name: "dispatch",
        arguments: { action: { type: "emergencyUnlock" } },
      });
      assert.equal(blocked.result.isError, true);
      browser = await chromium.launch({
        executablePath: process.env.CHROMIUM_PATH || "/usr/sbin/chromium",
        headless: true,
        args: ["--no-sandbox"],
      });
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1100 },
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(url);
      await page.locator('[data-page="agent"]').click();
      await expect(page.locator("h1")).toContainText("学习助手");
      // Memory and files live in on-demand sheets, not on the conversation page.
      await page.locator('[data-agent="memory"]').click();
      await page
        .locator("#agent-memory-text")
        .fill("合成测试：每天可用60分钟，愿景是持续掌握。");
      await page.locator("#agent-memory-add button").click();
      await expect(page.locator("#agent-memories")).toContainText("已确认");
      await page.locator('[data-agent="close-sheet"]').click();
      await page.locator("#agent-text").fill("草稿不会被轮询覆盖");
      await delay(3000);
      await expect(page.locator("#agent-text")).toHaveValue(
        "草稿不会被轮询覆盖",
      );
      await page.locator('[data-agent="plans"]').click();
      await page
        .locator('[data-agent="review"][data-name="review.json"]')
        .click();
      await expect(page.locator("#agent-review")).toContainText("Review test");
      await page.locator("#agent-apply-confirm").check();
      await page.locator('[data-agent="apply"]').click();
      await expect
        .poll(
          async () =>
            (await (await fetch(`${url}/api/snapshot`)).json()).data.tasks[0]
              .title,
        )
        .toBe("Reviewed task");
      // Auto navigation must wait for focus/paused focus. A synthetic status event
      // exercises UI routing without contacting a paid model or enabling protection.
      await page.locator('[data-page="tasks"]').click();
      const currentStatus = await api({ op: "status" });
      await page.route("**/api/agent", async (route) => {
        if (route.request().postDataJSON()?.op === "status")
          await route.fulfill({ json: { ...currentStatus, wakeSerial: 1 } });
        else await route.continue();
      });
      await expect(page.locator("h1")).toContainText("学习助手", {
        timeout: 6000,
      });
      for (const width of [1440, 1024, 700, 360]) {
        await page.setViewportSize({ width, height: 1100 });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `overflow at ${width}`,
        );
      }
      await page.setViewportSize({ width: 1440, height: 1100 });
      await mkdir("artifacts", { recursive: true });
      await page.screenshot({
        path: "artifacts/agent-page.png",
        fullPage: true,
      });
      assert.deepEqual(errors, []);
      // No key is echoed in status or copied to the app backup.
      await api({
        op: "configure",
        preferences: info.preferences,
        apiKey: "synthetic-not-a-real-secret",
      });
      await waitFor(async () => {
        const s = await api({ op: "status" });
        return !s.busy && s.providers?.deepseek?.configured;
      });
      assert.equal(
        JSON.stringify(await api({ op: "status" })).includes(
          "synthetic-not-a-real-secret",
        ),
        false,
      );
      assert.equal(
        (await stat(join(dir, "agent/auth.json"))).mode & 0o777,
        0o600,
      );
      const backup = await tool("export_backup", { name: "privacy.json" });
      assert.ok(backup.fileHash);
      assert.equal(
        (
          await readFile(join(dir, "agent/workspace/privacy.json"), "utf8")
        ).includes("synthetic-not-a-real-secret"),
        false,
      );
    } finally {
      mcp?.stdin.end();
      mcp?.kill("SIGTERM");
      await browser?.close();
      server.kill("SIGTERM");
    }
  },
);
