import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createInterface } from "node:readline";
import { mkdtemp, readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { chromium, expect } from "@playwright/test";
import { ModelRuntime } from "../agent/node_modules/@earendil-works/pi-coding-agent/dist/index.js";
import { closeStudySession, createStudySession } from "../agent/session.mjs";
import { mcpCommand } from "../agent/mcp-config.mjs";
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

test("MCP servers from the app's mcp.json reach user turns, never a wake", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tomato-mcp-"));
  await writeFile(
    join(dir, "mcp.json"),
    JSON.stringify({
      mcpServers: {
        mock: {
          command: process.execPath,
          args: [resolve("tests/fixtures/mcp-echo.mjs")],
        },
      },
    }),
  );
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
    baseUrl: "http://127.0.0.1:1",
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
    automatic: false,
    tools: [],
  };
  const session = async (overrides) => {
    const created = await createStudySession({
      runtime,
      dir,
      root: resolve("agent"),
      command: { ...command, ...overrides },
      toolRequest: async () => ({}),
    });
    return created.session;
  };
  // Servers connect in the background, so the declared tools arrive shortly after.
  const asked = await session({});
  // The app keeps a curated tool list, so MCP tools are reached through codemode
  // (the SDK default exposure) rather than declared to the model one by one.
  let callable = [];
  let registered = [];
  for (let i = 0; i < 100; i++) {
    callable = asked.getCallableToolNames();
    registered = asked.getAllTools().map((tool) => tool.name);
    if (callable.includes("mcp__mock__echo")) break;
    await delay(100);
  }
  assert.ok(
    registered.includes("mcp__mock__echo"),
    `registered: ${registered.join(",")}`,
  );
  assert.ok(
    callable.includes("mcp__mock__echo"),
    `callable: ${callable.join(",")}`,
  );
  await closeStudySession(asked);

  // An automatic wake must not hold a server that can order or cancel things.
  const wake = await session({ automatic: true });
  await delay(800);
  assert.equal(
    wake.getAllTools().filter((tool) => tool.name.startsWith("mcp__")).length,
    0,
  );
  await closeStudySession(wake);
});

test("MCP servers can be listed, added and removed like codex mcp does", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tomato-mcp-cfg-"));
  const args = { agentDir: dir, cwd: dir, action: "list" };
  assert.deepEqual(await mcpCommand(args), { servers: [], errors: [] });
  const added = await mcpCommand({
    ...args,
    action: "add",
    server: {
      name: "seat",
      command: "/usr/bin/node",
      args: ["server.mjs"],
      exposure: "codemode",
    },
  });
  assert.equal(added.added, "seat");
  assert.equal(added.servers[0].transport, "stdio");
  assert.equal(added.servers[0].exposure, "codemode");
  // The SDK's validator is the gate: a bad entry fails here, with its reason.
  await assert.rejects(
    mcpCommand({
      ...args,
      action: "add",
      server: { name: "bad name", command: "x" },
    }),
    /invalid server name/,
  );
  await assert.rejects(
    mcpCommand({ ...args, action: "add", server: { name: "empty" } }),
    /needs either/,
  );
  const http = await mcpCommand({
    ...args,
    action: "add",
    server: {
      name: "docs",
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer x" },
    },
  });
  assert.equal(
    http.servers.find((server) => server.name === "docs").transport,
    "http",
  );
  assert.equal(http.servers.length, 2);
  const removed = await mcpCommand({
    ...args,
    action: "remove",
    server: { name: "seat" },
  });
  assert.equal(removed.removed, "seat");
  assert.deepEqual(
    removed.servers.map((server) => server.name),
    ["docs"],
  );
  await assert.rejects(
    mcpCommand({ ...args, action: "remove", server: { name: "seat" } }),
    /没有名为 seat 的服务器/,
  );
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
      // 首次打开会先看到引导卡；等首屏稳定再点侧栏（否则可能点在重绘中的节点上）。
      await expect(page.locator(".welcome-card")).toBeVisible();
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
      // Reviewing lists the file as pending; approving IS the consent now.
      await expect(page.locator(".agent-file.pending")).toContainText(
        "已审阅，待批准",
      );
      await expect(
        page.locator('#agent-files [data-agent="reject"]'),
      ).toBeVisible();
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
      // Questions and proposals, driven from a canned status on a second page:
      // multi-select toggles before answering, a plan review approves with one
      // button, and free text rides along with the picks.
      const asked = await browser.newPage();
      const sent = [];
      let cannedHand = null;
      let cannedDeeds = null;
      let pending = [
        {
          id: "subjects",
          header: "选科目",
          question: "这周先补哪几科？",
          multiSelect: true,
          options: [
            { label: "英语（推荐）", description: "进度最紧" },
            { label: "数学", description: "高数还没开始" },
          ],
        },
      ];
      const canned = () => ({
        ...currentStatus,
        busy: false,
        error: null,
        messages: [],
        files: [],
        reviewed: [],
        questions: pending,
        hand: cannedHand,
        deeds: cannedDeeds,
      });
      await asked.route("**/api/agent", async (route) => {
        const body = route.request().postDataJSON();
        if (body?.op === "send") sent.push(body.text);
        if (body?.op === "send") pending = [];
        await route.fulfill({ json: canned() });
      });
      await asked.goto(url);
      await asked.locator('[data-page="agent"]').click();
      await asked.locator('[data-label="英语（推荐）"]').click();
      await asked.locator('[data-label="数学"]').click();
      await expect(asked.locator(".agent-option.picked")).toHaveCount(2);
      await asked.locator('[data-agent="answer-multi"]').click();
      assert.deepEqual(sent, ["选科目：英语（推荐）、数学"]);
      pending = [
        {
          id: "apply",
          header: "确认应用",
          question: "把这份计划写进软件？",
          detail: "新增 12 个任务，保留全部进度。",
          options: [
            { label: "批准", description: "按方案写入" },
            { label: "先说说", description: "我想改几处" },
          ],
          intent: { kind: "plan-review", approve: "批准" },
        },
      ];
      sent.length = 0;
      await asked.reload();
      await asked.locator('[data-page="agent"]').click();
      await expect(asked.locator(".agent-proposal")).toContainText("待批准");
      await expect(
        asked.locator('.agent-proposal [data-agent="discuss"]'),
      ).toBeVisible();
      await asked.locator('.agent-proposal [data-agent="approve"]').click();
      assert.deepEqual(sent, ["确认应用：批准"]);
      // A script the assistant queued plays on the page: caption, then typing.
      pending = [];
      cannedHand = {
        serial: 1,
        at: Math.floor(Date.now() / 1000),
        label: "助手",
        steps: [
          { kind: "say", lines: ["看得见的手"], hold: true },
          { kind: "move", target: "#agent-text" },
        ],
      };
      await asked.reload();
      await asked.locator('[data-page="agent"]').click();
      await expect(asked.locator(".hand-actor.on")).toBeVisible();
      await expect(asked.locator(".hand-caption")).toContainText("看得见的手");
      // 助手这一轮改过的东西会在界面上被指出来（deeds 批次）。
      cannedHand = null;
      cannedDeeds = {
        serial: 1,
        at: Math.floor(Date.now() / 1000),
        items: [{ text: "课表里记下了「英语」", selector: ".blocks-card" }],
      };
      await asked.reload();
      await asked.locator('[data-page="agent"]').click();
      await expect(asked.locator(".hand-caption")).toContainText(
        "课表里记下了「英语」",
        { timeout: 8000 },
      );
      // 定时任务：列表 + 新建表单（含提前锁机字段）都在「定时」浮层里。
      await asked.locator('[data-agent="schedules"]').click();
      await expect(asked.locator("#agent-schedule-new")).toBeVisible();
      await expect(asked.locator("#agent-schedules")).toContainText(
        "还没有定时任务",
      );
      await expect(
        asked.locator('#agent-schedule-new [name="lockBeforeMinutes"]'),
      ).toBeVisible();
      await asked.locator('[data-agent="close-sheet"]').click();
      await asked.evaluate(() => window.tomatoHand.hide());
      // 会话列表是侧栏（照 dsh 的形状），点顶栏拉开、再点收起；长对话里状态栏
      // 和输入框都留在原处（卡片自己滚动）。
      await asked.locator('[data-agent="conversations"]').click();
      await expect(asked.locator("#agent-sessions")).toBeVisible();
      await expect(
        asked.locator("#agent-sessions .agent-sessions-new"),
      ).toBeVisible();
      await asked.locator('[data-agent="toggle-sessions"]').click();
      await expect(asked.locator("#agent-sessions")).toBeHidden();
      await expect(asked.locator("#agent-run-status")).toBeInViewport();
      await asked.close();
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
