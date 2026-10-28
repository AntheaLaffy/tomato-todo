import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createConnection } from "node:net";
import { createInterface } from "node:readline";
import {
  mkdtemp,
  readFile,
  stat,
  mkdir,
  writeFile,
  copyFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { chromium, expect } from "@playwright/test";
import { ModelRuntime } from "../agent/node_modules/@earendil-works/pi-coding-agent/dist/index.js";
import {
  closeStudySession,
  createStudySession,
  forkStudySession,
} from "../agent/session.mjs";
import { mcpCommand } from "../agent/mcp-config.mjs";
import { parseExa, publicAddress } from "../agent/web.mjs";
import {
  codexAuthDocument,
  codexProviderConfigs,
  normalizeCodexCredential,
  parseCodexConfig,
} from "../agent/codex-config.mjs";
import { sandboxEnv } from "../agent/coding.mjs";

test("sandboxed shell keeps the app's local timezone", () => {
  // bwrap 的 --clearenv 会清掉 TZ，必须在它之后显式补回本机时区，否则沙箱里的
  // date 退回 UTC，模型据此排出的相对日期会错一天。
  const env = sandboxEnv();
  const tz = env.indexOf("TZ");
  assert.notEqual(tz, -1, "sandbox env should set TZ");
  assert.ok(env.indexOf("--clearenv") < tz, "TZ must come after --clearenv");
  assert.equal(env[tz + 1], Intl.DateTimeFormat().resolvedOptions().timeZone);
});

test(
  "Rust worker starts packaged Node with HTTP proxy support",
  { timeout: 20000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "tomato-proxy-"));
    const requests = [];
    const proxy = createServer((request, response) => {
      requests.push(request.url);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ codex: { route: "local-proxy" } }));
    });
    const target = createServer((request, response) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ codex: { route: "local-proxy" } }));
    });
    await new Promise((resolve) => target.listen(0, "127.0.0.1", resolve));
    const tunnels = new Set();
    proxy.on("connect", (request, socket, head) => {
      requests.push(request.url);
      const upstream = createConnection(
        target.address().port,
        "127.0.0.1",
        () => {
          socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
          if (head.length) upstream.write(head);
          socket.pipe(upstream).pipe(socket);
        },
      );
      tunnels.add(socket);
      tunnels.add(upstream);
      socket.on("error", () => upstream.destroy());
      upstream.on("error", () => socket.destroy());
    });
    await new Promise((resolve) => proxy.listen(0, "127.0.0.1", resolve));
    await mkdir(join(dir, "agent/bin"), { recursive: true });
    await copyFile("target/debug/tomato-preview", join(dir, "tomato-preview"));
    await copyFile("agent/bundle/bin/node", join(dir, "agent/bin/node"));
    await copyFile(
      "tests/fixtures/proxy_agent_worker.mjs",
      join(dir, "agent/worker.mjs"),
    );
    const endpoint = "http://127.0.0.1:4343";
    const server = spawn(join(dir, "tomato-preview"), [], {
      env: {
        ...process.env,
        TOMATO_PORT: "4343",
        TOMATO_DATA_PATH: join(dir, "data.sqlite3"),
        HTTP_PROXY: `http://127.0.0.1:${proxy.address().port}`,
        http_proxy: `http://127.0.0.1:${proxy.address().port}`,
        NO_PROXY: "localhost,127.0.0.1,::1",
        no_proxy: "localhost,127.0.0.1,::1",
      },
      stdio: "pipe",
    });
    let logs = "";
    server.stderr.on("data", (chunk) => (logs += chunk));
    try {
      await waitFor(async () => {
        try {
          return (await fetch(`${endpoint}/api/snapshot`)).ok;
        } catch {
          return false;
        }
      });
      const response = await fetch(`${endpoint}/api/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "usage" }),
      });
      assert.equal(response.status, 200, await response.clone().text());
      assert.deepEqual(await response.json(), {
        codex: { route: "local-proxy" },
      });
      assert.ok(
        requests.includes("proxy-target.invalid:80") ||
          requests.includes("http://proxy-target.invalid/usage"),
        JSON.stringify(requests),
      );
    } catch (error) {
      throw new Error(`${error.message}\n${logs}`, { cause: error });
    } finally {
      server.kill("SIGTERM");
      for (const socket of tunnels) socket.destroy();
      proxy.closeAllConnections();
      target.closeAllConnections();
      await Promise.all([
        new Promise((resolve) => proxy.close(resolve)),
        new Promise((resolve) => target.close(resolve)),
      ]);
    }
  },
);

test("Codex CLI provider and OAuth files map to Pi without network access", async () => {
  const config = parseCodexConfig(`model = "gpt-6-sol"
model_provider = "custom"
[model_providers.custom]
name = "Custom"
base_url = "https://example.test/v1"
wire_api = "responses"
requires_openai_auth = false
experimental_bearer_token = "test-token"`);
  config.providers.unselected = {
    base_url: "https://unused.test/v1",
    wire_api: "responses",
  };
  assert.equal(codexProviderConfigs(config).length, 1);
  const [provider] = codexProviderConfigs(config);
  assert.equal(provider.id, "custom");
  assert.equal(provider.api, "openai-responses");
  assert.equal(provider.models[0].id, "gpt-6-sol");
  const runtime = await ModelRuntime.create({
    modelsPath: null,
    refreshOnCreate: false,
    allowModelNetwork: false,
  });
  runtime.registerProvider(provider.id, provider);
  assert.equal(
    runtime.getModel("custom", "gpt-6-sol")?.baseUrl,
    "https://example.test/v1",
  );
  const credential = normalizeCodexCredential({
    tokens: {
      access_token: "access",
      refresh_token: "refresh",
      account_id: "account",
      expires: 123456,
    },
  });
  assert.deepEqual(credential, {
    type: "oauth",
    access: "access",
    refresh: "refresh",
    accountId: "account",
    expires: 123456,
  });
  const shared = codexAuthDocument(credential, {
    auth_mode: "chatgpt",
    tokens: { id_token: "id" },
  });
  assert.equal(shared.tokens.id_token, "id");
  assert.equal(shared.tokens.access_token, "access");
  assert.ok(Number.isFinite(Date.parse(shared.last_refresh)));
});

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
          reasoning: true,
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
      preferences: { thinkingLevel: "high" },
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
      assert.equal(session.thinkingLevel, "high");
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
        command: {
          ...command,
          preferences: { thinkingLevel: "low" },
          sessionFile: file,
        },
        toolRequest: async () => ({}),
      });
      session = resumed.session;
      assert.equal(
        session.thinkingLevel,
        "low",
        "current preference overrides restored thinking level",
      );
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
      const original = await readFile(file, "utf8");
      const entries = resumed.manager.getBranch();
      const users = entries.filter(
        (e) => e.type === "message" && e.message.role === "user",
      );
      const firstReply = entries.find(
        (e) =>
          e.type === "message" &&
          e.message.role === "assistant" &&
          e.message.stopReason === "stop",
      );
      await closeStudySession(session);
      session = null;
      const branch = await forkStudySession(dir, {
        sessionFile: file,
        entryId: firstReply.id,
      });
      assert.notEqual(branch.sessionFile, file);
      const branchHistory = await readFile(branch.sessionFile, "utf8");
      assert.ok(
        branchHistory.includes("call_context"),
        "tool history is kept in a branch",
      );
      assert.ok(
        !branchHistory.includes("接着刚才的讨论"),
        "later turns are excluded",
      );
      const edited = await forkStudySession(dir, {
        sessionFile: file,
        entryId: users[0].id,
        before: true,
      });
      const fresh = await createStudySession({
        runtime,
        dir,
        root: resolve("agent"),
        command: { ...command, sessionFile: edited.sessionFile },
        toolRequest: async () => ({}),
      });
      session = fresh.session;
      await session.prompt("改成讨论线性代数");
      const request = JSON.stringify(requests.at(-1).messages);
      assert.ok(request.includes("改成讨论线性代数"));
      assert.ok(!request.includes("请先读学情摘要"));
      assert.ok(!request.includes("接着刚才的讨论"));
      assert.equal(
        await readFile(file, "utf8"),
        original,
        "the original SDK session stays byte-for-byte intact",
      );
      await closeStudySession(session);
      session = null;
      const internalsTool = {
        name: "get_agent_internals",
        description: "Read exact app internals",
        inputSchema: { type: "object", properties: {} },
      };
      for (const creatorMode of [false, true]) {
        const author = await createStudySession({
          runtime,
          dir,
          root: resolve("agent"),
          command: {
            ...command,
            automatic: false,
            creatorMode,
            preferences: { ...command.preferences, codingAccess: "full" },
            tools: [...command.tools, internalsTool],
          },
          toolRequest: async () => {
            throw new Error("internals must be local");
          },
        });
        session = author.session;
        const tool = session.getToolDefinition("get_agent_internals");
        assert.equal(!!tool, creatorMode);
        if (creatorMode) {
          const result = await tool.execute(
            "inspect",
            {},
            new AbortController().signal,
          );
          const value = JSON.parse(result.content[0].text);
          assert.equal(value.systemPrompt, session.systemPrompt);
          assert.ok(
            value.systemPrompt.includes(
              await readFile(resolve("agent/system-prompt.md"), "utf8"),
            ),
          );
          assert.ok(value.systemPrompt.includes("作者模式：已开启"));
          assert.ok(value.tools.some((t) => t.name === "get_agent_internals"));
          assert.equal(value.preferences.codingAccess, "full");
          assert.ok(!JSON.stringify(value).includes("synthetic-test-key"));
          const outside = join(dir, "author-note.txt");
          await session
            .getToolDefinition("write")
            .execute(
              "author-write",
              { path: outside, content: "作者可修改 agent 文件" },
              new AbortController().signal,
            );
          assert.equal(
            await readFile(outside, "utf8"),
            "作者可修改 agent 文件",
          );
          const readBack = await session
            .getToolDefinition("read")
            .execute(
              "author-read",
              { path: outside },
              new AbortController().signal,
            );
          assert.ok(
            readBack.content.some((c) =>
              c.text?.includes("作者可修改 agent 文件"),
            ),
          );
        }
        await closeStudySession(session);
        session = null;
      }
      const exitListeners = process.listenerCount("exit");
      const activated = await createStudySession({
        runtime,
        dir,
        root: resolve("agent"),
        command: {
          ...command,
          automatic: false,
          scheduled: false,
          creatorMode: false,
          preferences: { ...command.preferences, codingAccess: "workspace" },
          tools: [
            ...command.tools,
            internalsTool,
            {
              name: "enable_creator_mode",
              description: "Author entrance",
              inputSchema: { type: "object", properties: {} },
            },
          ],
        },
        toolRequest: async (name) => {
          assert.equal(name, "enable_creator_mode");
          return { creatorMode: true, codingAccess: "full" };
        },
      });
      session = activated.session;
      const outside = join(dir, "dynamic-author-note.txt");
      await assert.rejects(
        session
          .getToolDefinition("write")
          .execute(
            "before",
            { path: outside, content: "before" },
            new AbortController().signal,
          ),
      );
      assert.equal(session.getToolDefinition("get_agent_internals"), undefined);
      await session
        .getToolDefinition("enable_creator_mode")
        .execute("enter", {}, new AbortController().signal);
      assert.ok(session.getActiveToolNames().includes("get_agent_internals"));
      assert.equal(process.listenerCount("exit"), exitListeners + 1);
      await session
        .getToolDefinition("write")
        .execute(
          "after",
          { path: outside, content: "本轮启用完整访问" },
          new AbortController().signal,
        );
      assert.equal(await readFile(outside, "utf8"), "本轮启用完整访问");
      const internals = await session
        .getToolDefinition("get_agent_internals")
        .execute("inspect", {}, new AbortController().signal);
      assert.equal(
        JSON.parse(internals.content[0].text).preferences.codingAccess,
        "full",
      );
      await closeStudySession(session);
      session = null;
      assert.equal(process.listenerCount("exit"), exitListeners);
      await assert.rejects(
        forkStudySession(dir, { sessionFile: file, entryId: "missing" }),
        /节点不存在/,
      );
      await assert.rejects(
        forkStudySession(dir, {
          sessionFile: join(dir, "outside.jsonl"),
          entryId: users[0].id,
        }),
        /路径无效/,
      );
    } finally {
      session?.dispose();
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    }
  },
);

test(
  "local model drives attachment analysis, message edits, retries and conversation branches in the browser",
  { timeout: 90000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "tomato-chat-"));
    const requests = [];
    const answer =
      '## 复习路径\n\n**先看例题**，再做练习。\n\n| 科目 | 小时 |\n| --- | --- |\n| 数学 | 3 |\n\n公式 $x^2 + y^2$。\n\n$$\\int_0^1 x\\,dx = \\frac{1}{2}$$\n\n```python\nprint(\'<example>\')\n```\n\n[参考](https://example.com) [无效链接](javascript:alert(1))\n\n<button data-agent="new" onclick="window.injected=true">伪造操作</button>';
    const model = createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      const parsed = JSON.parse(body);
      requests.push(parsed);
      const user = [...parsed.messages]
        .reverse()
        .find((m) => m.role === "user");
      const text =
        typeof user.content === "string"
          ? user.content
          : user.content
              .filter((c) => c.type === "text")
              .map((c) => c.text)
              .join("\n");
      const path = text.match(/"(\/workspace\/attachments\/[^"\n]+)"/)?.[1];
      const read = path && parsed.messages.at(-1).role === "user";
      const chunk = (delta, finish_reason = null) => ({
        id: "local",
        object: "chat.completion.chunk",
        created: 1,
        model: "local-chat",
        choices: [{ index: 0, delta, finish_reason }],
      });
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      if (text.includes("停止用例")) {
        res.write(
          `data: ${JSON.stringify(chunk({ role: "assistant", content: "正在处理，可随时停止。" }))}\n\n`,
        );
        return;
      }
      const canvas =
        text.includes("Canvas用例") && parsed.messages.at(-1).role === "user";
      const creator =
        text.includes("把你做出来的如月风铃来看看你啦") &&
        parsed.messages.at(-1).role === "user";
      const delta = creator
        ? {
            role: "assistant",
            tool_calls: [
              {
                index: 0,
                id: "creator_entrance",
                type: "function",
                function: { name: "enable_creator_mode", arguments: "{}" },
              },
            ],
          }
        : canvas
          ? {
              role: "assistant",
              tool_calls: [
                {
                  index: 0,
                  id: "save_note",
                  type: "function",
                  function: {
                    name: "save_canvas",
                    arguments: JSON.stringify({
                      baseRevision: 0,
                      title: "助手创建的笔记",
                      language: "markdown",
                      content: "# 导数\n\n先理解变化率。",
                    }),
                  },
                },
              ],
            }
          : read
            ? {
                role: "assistant",
                tool_calls: [
                  {
                    index: 0,
                    id: "read_attachment",
                    type: "function",
                    function: {
                      name: "read",
                      arguments: JSON.stringify({ path }),
                    },
                  },
                ],
              }
            : {
                role: "assistant",
                reasoning_content: "先核对资料，再解释复习路径。",
                content: answer,
              };
      res.write(`data: ${JSON.stringify(chunk(delta))}\n\n`);
      res.write(
        `data: ${JSON.stringify(chunk({}, read || canvas || creator ? "tool_calls" : "stop"))}\n\n`,
      );
      res.end("data: [DONE]\n\n");
    });
    await new Promise((r) => model.listen(0, "127.0.0.1", r));
    const codexDir = join(dir, "codex");
    await mkdir(codexDir);
    await writeFile(
      join(codexDir, "config.toml"),
      `model_provider = "deepseek"\nmodel = "local-chat"\n[model_providers.deepseek]\nbase_url = "http://127.0.0.1:${model.address().port}"\nwire_api = "chat"\nexperimental_bearer_token = "synthetic-local-token"\n`,
    );
    const url = "http://127.0.0.1:4342";
    // An installed runtime next to target/debug outranks the source bundle. Use
    // a private executable so this regression exercises the package just built.
    await copyFile("target/debug/tomato-preview", join(dir, "tomato-preview"));
    const server = spawn(join(dir, "tomato-preview"), [], {
      env: {
        ...process.env,
        CODEX_HOME: codexDir,
        NO_PROXY: "127.0.0.1,localhost",
        TOMATO_PORT: "4342",
        TOMATO_DATA_PATH: join(dir, "data.sqlite3"),
      },
      stdio: "pipe",
    });
    let browser,
      output = "";
    server.stderr.on("data", (bytes) => (output += bytes));
    const api = async (body) => {
      const response = await fetch(`${url}/api/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    };
    const idle = (expectedText) =>
      waitFor(async () => {
        const s = await api({ op: "status" });
        assert.equal(s.error, null, JSON.stringify(s.error));
        const user = [...s.messages].reverse().find((m) => m.role === "user");
        return !s.busy &&
          s.messages.at(-1)?.role === "assistant" &&
          (!expectedText || user?.text === expectedText)
          ? s
          : false;
      });
    try {
      const initial = await waitFor(async () => {
        try {
          const s = await api({ op: "status" });
          return s.providers?.deepseek?.configured ? s : false;
        } catch {
          return false;
        }
      }, 150).catch(() => {
        throw new Error(output);
      });
      await api({
        op: "configure",
        preferences: {
          ...initial.preferences,
          enabled: true,
          automatic: false,
          model: "local-chat",
        },
      });
      browser = await chromium.launch({
        executablePath: process.env.CHROMIUM_PATH || "/usr/sbin/chromium",
        headless: true,
        args: ["--no-sandbox"],
      });
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1100 },
      });
      await page
        .context()
        .grantPermissions(["clipboard-read", "clipboard-write"]);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(url);
      await expect(page.locator(".welcome-card")).toBeVisible();
      await page.locator('[data-page="agent"]').click();
      await expect(page.locator(".agent-welcome")).toBeVisible();
      await mkdir("artifacts", { recursive: true });
      await page.screenshot({
        path: "artifacts/agent-welcome.png",
        fullPage: true,
      });
      await page.locator('[data-agent="starter"]').first().click();
      await expect(page.locator("#agent-text")).toBeFocused();
      await expect(page.locator("#agent-text")).toHaveValue(/今天的任务/);
      assert.equal(requests.length, 0, "starter cards only prepare a draft");
      const shortHeight = await page
        .locator("#agent-text")
        .evaluate((el) => el.clientHeight);
      await page.locator("#agent-text").fill("多行草稿\n".repeat(15));
      assert.ok(
        (await page.locator("#agent-text").evaluate((el) => el.clientHeight)) >
          shortHeight,
      );
      const projectDirectory = join(dir, "project-materials");
      await mkdir(projectDirectory, { recursive: true });
      await api({
        op: "authorize_project_directory",
        name: "未分类",
        color: "#849b7d",
        directory: projectDirectory,
      });
      await page.locator("#agent-attachment-input").setInputFiles({
        name: "学习资料.csv",
        mimeType: "text/csv",
        buffer: Buffer.from("科目,小时\n数学,3\n"),
      });
      await expect(page.locator("#agent-attachments")).toContainText(
        "学习资料.csv",
      );
      await page.locator("#agent-text").fill("读取附件，说明如何复习微积分");
      let releaseSend, sending;
      const sendGate = new Promise((resolve) => {
        releaseSend = resolve;
      });
      const sendStarted = new Promise((resolve) => {
        sending = resolve;
      });
      const holdSend = async (route) => {
        if (route.request().postDataJSON()?.op === "send") {
          sending();
          await sendGate;
        }
        await route.continue();
      };
      await page.route("**/api/agent", holdSend);
      await page.locator("#agent-text").press("Enter");
      await sendStarted;
      await page.locator("#agent-text").fill("发送期间写的下一条草稿");
      releaseSend();
      const first = await idle();
      await page.unroute("**/api/agent", holdSend);
      await expect(page.locator("#agent-text")).toHaveValue(
        "发送期间写的下一条草稿",
      );
      await page.locator("#agent-text").fill("");
      const originalId = first.conversations.find((c) => c.active).id;
      assert.ok(first.messages.every((m) => m.entryId));
      assert.equal(
        first.messages.at(-1).thinking,
        "先核对资料，再解释复习路径。",
      );
      await expect(page.locator(".agent-reasoning-text")).toBeHidden();
      await page.locator(".agent-reasoning summary").press("Space");
      await expect(page.locator(".agent-reasoning-text")).toContainText(
        "先核对资料",
      );
      await page.waitForTimeout(2800);
      await expect(page.locator(".agent-reasoning-text")).toBeVisible();
      assert.ok(
        JSON.stringify(requests.at(-1).messages).includes("数学,3"),
        "the model actually read the uploaded file",
      );
      await expect(page.locator(".agent-markdown h2")).toContainText(
        "复习路径",
      );
      await expect(page.locator(".agent-markdown table")).toContainText("数学");
      await expect(page.locator(".agent-markdown .katex")).toHaveCount(2);
      await expect(
        page.locator(".agent-markdown [data-agent=new]"),
      ).toHaveCount(0);
      await expect(
        page.locator('.agent-markdown a[href^="javascript:"]'),
      ).toHaveCount(0);
      assert.equal(await page.evaluate(() => window.injected), undefined);
      await page.locator('[data-agent="copy-code"]').click();
      assert.equal(
        await page.evaluate(() => navigator.clipboard.readText()),
        "print('<example>')",
      );
      const downloaded = page.waitForEvent("download");
      await page
        .locator('.agent-message [data-agent="download-attachment"]')
        .click();
      assert.equal((await downloaded).suggestedFilename(), "学习资料.csv");
      await page
        .locator("#agent-text")
        .fill("这条后续消息应排除在早期分支之外");
      await page.locator("#agent-text").press("Enter");
      const complete = await idle("这条后续消息应排除在早期分支之外");
      const state = JSON.parse(
        await readFile(join(dir, "agent/state.json"), "utf8"),
      );
      const original = state.conversations.find((c) => c.id === originalId);
      const originalFile = await readFile(original.sessionFile, "utf8");
      await expect(page.locator(".agent-message")).toHaveCount(4);
      await page.locator("#agent-text").fill("原对话草稿");
      await page.locator("#agent-text").press("Control+k");
      await expect(page.locator("#agent-history-search")).toBeFocused();
      await page.locator("#agent-history-search").fill("复习路径");
      await expect(page.locator(".agent-search-snippet")).toContainText(
        "复习路径",
      );
      await page.locator("#agent-history-search").fill("");
      await page.locator('[data-agent="rename-conversation"]').click();
      await page
        .locator(".agent-conversation-rename input")
        .fill("微积分资料分析");
      await page
        .locator('.agent-conversation-rename button[type="submit"]')
        .click();
      await expect(page.locator(".agent-conversation-open b")).toContainText(
        "微积分资料分析",
      );
      await page.locator('[data-agent="pin-conversation"]').click();
      await expect(
        page.locator('[data-agent="pin-conversation"]'),
      ).toContainText("取消置顶");
      await page
        .locator('#agent-sessions [data-agent="archive-conversation"]')
        .click();
      await expect(page.locator(".agent-conversation-row")).toHaveCount(0);
      await expect(page.locator("#agent-conversation-title")).toContainText(
        "已归档",
      );
      await page.locator("#agent-history-search").fill("微积分资料");
      await expect(page.locator(".agent-conversation-open")).toContainText(
        "已归档",
      );
      await page.locator('[data-agent="show-archived"]').click();
      await expect(page.locator("#agent-history-search")).toHaveValue("");
      await expect(page.locator(".agent-conversation-open b")).toContainText(
        "微积分资料分析",
      );
      await page
        .locator('#agent-sessions [data-agent="archive-conversation"]')
        .click();
      await expect(page.locator(".agent-conversation-row")).toHaveCount(0);
      await page.locator('[data-agent="show-archived"]').click();
      await expect(page.locator(".agent-conversation-open b")).toContainText(
        "微积分资料分析",
      );
      await expect(page.locator("#agent-text")).toHaveValue("原对话草稿");
      const firstReply = page.locator(
        `[data-message-id="${complete.messages[1].id}"]`,
      );
      await firstReply.locator('[data-agent="quote-message"]').click();
      await expect(page.locator("#agent-text")).toHaveValue(
        /原对话草稿\n\n> ## 复习路径/,
      );
      await expect(page.locator("#agent-text")).toBeFocused();
      await page.locator("#agent-text").fill("原对话草稿");
      await page.locator("#agent-text").fill("");
      await page.locator("#agent-text").press("ArrowUp");
      await expect(page.locator(".agent-message-edit textarea")).toHaveValue(
        "这条后续消息应排除在早期分支之外",
      );
      await page.locator(".agent-message-edit textarea").press("Escape");
      await expect(page.locator(".agent-message-edit")).toHaveCount(0);
      await page.locator("#agent-text").fill("原对话草稿");
      await firstReply.locator('[data-agent="branch-message"]').click();
      await expect(page.locator(".agent-message")).toHaveCount(2);
      await expect(page.locator("#agent-text")).toHaveValue("");
      await page
        .locator('#agent-branch-source [data-agent="switch-conversation"]')
        .click();
      await expect(page.locator("#agent-text")).toHaveValue("原对话草稿");
      await firstReply.locator('[data-agent="retry-message"]').click();
      await idle();
      await expect(page.locator(".agent-message")).toHaveCount(2);
      assert.ok(
        !JSON.stringify(requests.at(-1).messages).includes(
          "这条后续消息应排除",
        ),
      );
      await page
        .locator('#agent-branch-source [data-agent="switch-conversation"]')
        .click();
      await page
        .locator('.agent-message.user [data-agent="edit-message"]')
        .first()
        .click();
      await page
        .locator(".agent-message-edit textarea")
        .fill("读取附件，改为解释线性代数");
      await page.waitForTimeout(2800);
      await expect(page.locator(".agent-message-edit textarea")).toHaveValue(
        "读取附件，改为解释线性代数",
      );
      await page.locator('.agent-message-edit button[type="submit"]').click();
      const edited = await idle("读取附件，改为解释线性代数");
      assert.equal(edited.messages[0].text, "读取附件，改为解释线性代数");
      assert.equal(
        edited.messages[0].attachments[0].id,
        first.messages[0].attachments[0].id,
      );
      assert.equal(await readFile(original.sessionFile, "utf8"), originalFile);
      const originalStatus = await api({
        op: "switch_conversation",
        id: originalId,
      });
      assert.deepEqual(originalStatus.messages, complete.messages);
      await expect(page.locator(".agent-message")).toHaveCount(4);
      await page.locator("#agent-text").evaluate((el) => {
        const data = new DataTransfer();
        data.items.add(
          new File(["粘贴的资料"], "pasted.txt", { type: "text/plain" }),
        );
        el.dispatchEvent(
          new ClipboardEvent("paste", {
            clipboardData: data,
            bubbles: true,
            cancelable: true,
          }),
        );
      });
      await expect(page.locator("#agent-attachments")).toContainText(
        "pasted.txt",
      );
      await page.locator("#agent-chat").evaluate((el) => {
        const data = new DataTransfer();
        data.items.add(
          new File(["拖入的资料"], "dropped.md", { type: "text/markdown" }),
        );
        el.dispatchEvent(
          new DragEvent("drop", {
            dataTransfer: data,
            bubbles: true,
            cancelable: true,
          }),
        );
      });
      await expect(page.locator("#agent-attachments")).toContainText(
        "dropped.md",
      );
      await page.locator("#agent-attachment-input").setInputFiles({
        name: "photo.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=",
          "base64",
        ),
      });
      await expect(page.locator("#agent-attachments")).toContainText(
        "photo.png",
      );
      await page.locator("#agent-text").fill("图片草稿保留");
      await expect(page.locator(".agent-attachment-preview")).toHaveCount(1);
      await page.locator("#agent-text").press("Enter");
      await expect(page.locator("#toast")).toContainText("所选模型不支持图片");
      await expect(page.locator("#agent-text")).toHaveValue("图片草稿保留");
      await expect(page.locator("#agent-attachments")).toContainText(
        "photo.png",
      );
      while (await page.locator('[data-agent="remove-attachment"]').count())
        await page.locator('[data-agent="remove-attachment"]').first().click();
      await expect(
        page.locator('#agent-chat button[type="submit"]'),
      ).toBeEnabled();
      await page.locator("#agent-text").fill("停止用例");
      await expect(page.locator("#agent-text")).toHaveValue("停止用例");
      await page.locator("#agent-text").press("Shift+Enter");
      await expect(page.locator("#agent-text")).toHaveValue("停止用例\n");
      assert.equal((await api({ op: "status" })).busy, false);
      await page.locator("#agent-text").evaluate((el) =>
        el.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            bubbles: true,
            isComposing: true,
          }),
        ),
      );
      assert.equal((await api({ op: "status" })).busy, false);
      await expect(
        page.locator('#agent-chat button[type="submit"]'),
      ).toBeEnabled();
      await expect(page.locator("#agent-text")).toHaveValue("停止用例\n");
      await page.locator("#agent-text").press("Enter");
      await expect(page.locator(".streaming")).toContainText("正在处理");
      await page.locator('[data-agent="cancel"]').click();
      const stopped = await idle("停止用例");
      assert.equal(stopped.messages.at(-1).stopped, true);
      await expect(page.locator(".agent-stopped")).toContainText("已停止");
      await page.locator("#agent-text").fill("Canvas用例：整理一份导数笔记");
      await page.locator("#agent-text").press("Enter");
      const canvasResult = await idle("Canvas用例：整理一份导数笔记");
      assert.equal(canvasResult.canvases[0].title, "助手创建的笔记");
      assert.equal(
        (await api({ op: "canvas_get", id: canvasResult.canvases[0].id }))
          .content,
        "# 导数\n\n先理解变化率。",
      );
      await page.locator("#agent-text").fill("把你做出来的如月风铃来看看你啦");
      await expect(
        page.locator('#agent-chat button[type="submit"]'),
      ).toBeEnabled();
      await page.locator("#agent-text").press("Enter");
      const creator = await idle("把你做出来的如月风铃来看看你啦");
      assert.equal(creator.creatorMode, true);
      assert.equal(creator.preferences.codingAccess, "workspace");
      await expect(
        page.locator('[data-agent="exit-creator-mode"]'),
      ).toBeVisible();
      await expect(page.locator(".creator-entrance")).toBeVisible();
      await expect(page.locator(".creator-entrance")).toContainText("如月风铃");
      await page.waitForTimeout(1300);
      await page.screenshot({ path: "artifacts/agent-creator-entrance.png" });
      await page.keyboard.press("Escape");
      await expect(page.locator(".creator-entrance")).toHaveCount(0);
      await page.waitForTimeout(2700);
      await expect(page.locator(".creator-entrance")).toHaveCount(0);
      await page.locator('[data-agent="exit-creator-mode"]').click();
      await expect(
        page.locator('[data-agent="exit-creator-mode"]'),
      ).toHaveCount(0);
      assert.equal((await api({ op: "status" })).creatorMode, false);
      await page.setViewportSize({ width: 360, height: 820 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page
        .locator("#agent-text")
        .fill("把你做出来的如月风铃来看看你啦，再来一次");
      await page.locator("#agent-text").press("Enter");
      const reentry = await idle("把你做出来的如月风铃来看看你啦，再来一次");
      assert.notEqual(reentry.creatorEntrance.id, creator.creatorEntrance.id);
      await expect(page.locator(".creator-entrance")).toBeVisible();
      assert.equal(
        await page
          .locator(".creator-entrance")
          .evaluate((el) => getComputedStyle(el).animationName),
        "none",
      );
      await page.screenshot({ path: "artifacts/agent-creator-mobile.png" });
      await expect(page.locator(".creator-entrance")).toHaveCount(0, {
        timeout: 4000,
      });
      await page.locator('[data-agent="toggle-sessions"]').click();
      await expect(page.locator("#agent-sessions")).toBeHidden();
      await page.locator('[data-agent="exit-creator-mode"]').click();
      await page.locator('[data-agent="conversations"]').click();
      await page.emulateMedia({ reducedMotion: null });
      for (const width of [1920, 1440, 700, 360]) {
        await page.setViewportSize({ width, height: 1100 });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `chat overflow at ${width}`,
        );
        await expect(
          page.locator('#agent-chat button[type="submit"]'),
        ).toBeInViewport();
        assert.ok(
          await page
            .locator("#agent-messages")
            .evaluate((el) => el.scrollHeight > el.clientHeight),
          `history must scroll inside the conversation at ${width}`,
        );
        const layout = await page.evaluate(() => {
          const panel = document.querySelector(".agent-conversation");
          const composer = document.querySelector("#agent-chat");
          const messages = document.querySelector("#agent-messages");
          const style = getComputedStyle(panel);
          return {
            available:
              panel.clientWidth -
              parseFloat(style.paddingLeft) -
              parseFloat(style.paddingRight),
            composer: composer.getBoundingClientRect().width,
            messagePadding: parseFloat(getComputedStyle(messages).paddingLeft),
          };
        });
        assert.ok(
          Math.abs(layout.composer - layout.available) <= 2,
          `composer fills panel at ${width}`,
        );
        assert.ok(
          layout.messagePadding <= 2,
          `messages use panel width at ${width}`,
        );
        if (width === 360) {
          await page.locator('[data-agent="toggle-sessions"]').click();
          await expect(page.locator("#agent-sessions")).toBeHidden();
          await page.screenshot({
            path: "artifacts/agent-chat-mobile.png",
            fullPage: true,
          });
        }
      }
      await page.setViewportSize({ width: 1440, height: 1100 });
      await mkdir("artifacts", { recursive: true });
      await page.screenshot({
        path: "artifacts/agent-chat.png",
        fullPage: true,
      });
      // 运行时人格：切换只改当前对话，徽标与系统提示词注入一起跟随。
      await page.locator('[data-agent="personas"]').click();
      await expect(page.locator("#agent-persona-form")).toBeVisible();
      await expect(page.locator(".agent-persona.current")).toContainText(
        "小迷妹",
      );
      // 人格卡的「另一面」可以展开阅读，展开动作不会顺手选中这张卡。
      const coach = page.locator('.agent-persona:has-text("严格教练")');
      await coach.locator(".agent-persona-shadow summary").click();
      await expect(coach.locator(".agent-persona-shadow")).toHaveAttribute(
        "open",
        "",
      );
      await coach.locator(".agent-persona-awaken summary").click();
      await expect(coach.locator(".agent-persona-awaken")).toHaveAttribute(
        "open",
        "",
      );
      assert.equal((await api({ op: "status" })).persona, "default");
      // 点人格卡片本身就切换，不再需要找「使用」按钮。
      await coach.locator(".agent-persona-head").click();
      await expect(page.locator(".agent-persona-badge")).toContainText(
        "严格教练",
      );
      assert.equal((await api({ op: "status" })).persona, "coach");
      await page.locator("#agent-text").fill("人格注入检查");
      await page.locator("#agent-text").press("Enter");
      await idle("人格注入检查");
      const system = requests.at(-1).messages.find((m) => m.role === "system");
      const injected =
        typeof system?.content === "string"
          ? system.content
          : JSON.stringify(system?.content ?? "");
      assert.match(injected, /当前人格/);
      assert.match(injected, /严格教练/);
      // 系统提示带上本轮本地时间，排日期不用模型猜「今天」。
      assert.match(
        injected,
        /本轮开始时间：\d{4}-\d{2}-\d{2} 周[日一二三四五六] \d{2}:\d{2}（本地时间 UTC[+-]\d{2}:\d{2}）/,
      );
      await page.screenshot({
        path: "artifacts/agent-personas.png",
        fullPage: true,
      });
      // 新对话默认沿用最近选择的人格，而不是回到内置预设。
      await page.locator('[data-agent="close-sheet"]').click();
      await page.locator('[data-agent="new"]').first().click();
      await expect(page.locator(".agent-persona-badge")).toContainText(
        "严格教练",
      );
      assert.equal((await api({ op: "status" })).persona, "coach");
      // 新建并删除一张自定义人格；当前人格不受影响。
      await page.locator('[data-agent="personas"]').click();
      await page
        .locator('#agent-persona-form input[name="name"]')
        .fill("测试人格");
      await page
        .locator('#agent-persona-form textarea[name="identity"]')
        .fill("你是测试用的临时人格。");
      await page.locator('#agent-persona-form button[type="submit"]').click();
      await expect(page.locator("#agent-personas")).toContainText("测试人格");
      await page
        .locator(
          '.agent-persona:has-text("测试人格") [data-agent="delete-persona"]',
        )
        .click();
      await expect(page.locator("#agent-personas")).not.toContainText(
        "测试人格",
      );
      await page.locator('[data-agent="close-sheet"]').click();
      await expect(page.locator('[data-agent="cancel"]')).toBeHidden();
      const longHistory = {
        ...stopped,
        messages: Array.from({ length: 75 }, (_, i) => ({
          id: `history-${i}`,
          role: "user",
          text: `早期历史 ${i}`,
          at: 1,
          automatic: false,
        })),
      };
      await page.route("**/api/agent", async (route) => {
        if (route.request().postDataJSON()?.op === "status")
          await route.fulfill({ json: longHistory });
        else await route.continue();
      });
      await expect(page.locator('[data-agent="older-messages"]')).toBeVisible();
      await page.locator('[data-agent="older-messages"]').click();
      await expect(page.locator(".agent-message")).toHaveCount(75);
      await expect(page.locator(".agent-message").first()).toContainText(
        "早期历史 0",
      );
      await page.locator("#agent-messages").evaluate((list) => {
        list.scrollTop = 0;
        list.dispatchEvent(new Event("scroll"));
      });
      await expect(page.locator('[data-agent="latest-message"]')).toBeVisible();
      await page.waitForTimeout(2800);
      assert.equal(
        await page
          .locator("#agent-messages")
          .evaluate((list) => list.scrollTop),
        0,
      );
      await page.locator("#agent-messages").evaluate((list) => {
        const text = list.querySelector(".agent-user-text").firstChild;
        const range = document.createRange();
        range.selectNodeContents(text);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
      });
      await page.waitForTimeout(2800);
      assert.equal(
        await page.evaluate(() => window.getSelection().toString()),
        "早期历史 0",
      );
      await page.evaluate(() => window.getSelection().removeAllRanges());
      await page.locator('[data-agent="latest-message"]').click();
      await expect(page.locator('[data-agent="latest-message"]')).toBeHidden();
      const exported = page.waitForEvent("download");
      await page.locator('[data-agent="export-conversation"]').click();
      assert.ok((await exported).suggestedFilename().endsWith(".md"));
      await page.unroute("**/api/agent");
      await page.locator("#agent-text").press("Control+Shift+O");
      await expect(page.locator(".agent-welcome")).toBeVisible();
      await expect(page.locator("#agent-text")).toBeFocused();
      await expect(page.locator("#agent-text")).toHaveValue("");
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      server.kill("SIGTERM");
      model.closeAllConnections();
      await new Promise((r) => model.close(r));
    }
  },
);

test(
  "Rust service, authenticated MCP stdio, file review/import and learning assistant UI",
  { timeout: 90000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "tomato-agent-ui-"));
    const url = "http://127.0.0.1:4341";
    await copyFile("target/debug/tomato-preview", join(dir, "tomato-preview"));
    const server = spawn(join(dir, "tomato-preview"), [], {
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
      await tool("apply_file", {
        name: "review.json",
        fileHash: review.fileHash,
      });
      assert.equal(
        (await (await fetch(`${url}/api/snapshot`)).json()).data.tasks[0].title,
        "Reviewed task",
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
      await expect(page.locator("#agent-thinking-select")).toHaveValue(
        "medium",
      );
      await page.locator("#agent-thinking-select").selectOption("high");
      await expect
        .poll(
          async () => (await api({ op: "status" })).preferences.thinkingLevel,
        )
        .toBe("high");
      await page.reload();
      await page.locator('[data-page="agent"]').click();
      await expect(page.locator("#agent-thinking-select")).toHaveValue("high");
      // Memory lives in an on-demand sheet.
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
      let cannedSchedules = [];
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
        schedules: cannedSchedules,
      });
      await asked.route("**/api/agent", async (route) => {
        const body = route.request().postDataJSON();
        if (body?.op === "send") sent.push(body.text);
        if (body?.op === "send") pending = [];
        await route.fulfill({ json: canned() });
      });
      await asked.goto(url);
      await asked.locator('[data-page="agent"]').click();
      await asked
        .locator('[data-agent="choose"][data-label="英语（推荐）"]')
        .click();
      await asked.locator('[data-agent="choose"][data-label="数学"]').click();
      await expect(asked.locator(".agent-choice.picked")).toHaveCount(2);
      await asked.locator('[data-agent="answer-choice"]').click();
      assert.deepEqual(sent, ["选科目：英语（推荐）、数学"]);
      // 多个问题时确认收拢到页脚一个按钮：一次提交把整组答案当作一条消息发出去。
      pending = [
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
        {
          id: "slot",
          header: "选时段",
          question: "哪天补？",
          options: [
            { label: "周三晚", description: "没课" },
            { label: "周末", description: "整块时间" },
          ],
        },
      ];
      sent.length = 0;
      await asked.reload();
      await asked.locator('[data-page="agent"]').click();
      await asked
        .locator('[data-agent="choose"][data-label="英语（推荐）"]')
        .click();
      await asked.locator('[data-agent="choose"][data-label="周三晚"]').click();
      await expect(
        asked.locator('.agent-question [data-agent="answer-choice"]'),
      ).toHaveCount(0);
      await asked
        .locator('.agent-answer-submit [data-agent="answer-choice"]')
        .click();
      assert.deepEqual(sent, ["选科目：英语（推荐）；选时段：周三晚"]);
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
      // 已有安排可以就地编辑：点「编辑」表单预填，保存时带上同一个 id。
      cannedSchedules = [
        {
          id: "s1",
          name: "抢图书馆座位",
          at: "21:50",
          repeat: "weekdays",
          instruction: "用 seat MCP 约明天的座位",
          remindMinutes: 15,
          lockBeforeMinutes: 10,
          enabled: true,
          firedAt: null,
        },
      ];
      await asked.reload();
      await asked.locator('[data-page="agent"]').click();
      await asked.locator('[data-agent="schedules"]').click();
      await expect(asked.locator("#agent-schedules")).toContainText(
        "抢图书馆座位",
      );
      await asked
        .locator('#agent-schedules [data-agent="edit-schedule"]')
        .first()
        .click();
      await expect(
        asked.locator('#agent-schedule-new [name="name"]'),
      ).toHaveValue("抢图书馆座位");
      await expect(
        asked.locator('#agent-schedule-new [name="lockBeforeMinutes"]'),
      ).toHaveValue("10");
      await expect(asked.locator("#agent-schedule-new")).toContainText(
        "编辑定时任务",
      );
      await expect(
        asked.locator('#agent-schedule-new [name="lockBeforeMinutes"]'),
      ).toBeVisible();
      await asked.locator('[data-agent="close-sheet"]').click();
      await asked.evaluate(() => window.tomatoHand.hide());
      // 会话列表是侧栏（照 dsh 的形状），点顶栏拉开、再点收起；长对话里状态栏
      // 和输入框都留在原处（卡片自己滚动）。
      await asked.locator('[data-agent="search-conversations"]').click();
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
