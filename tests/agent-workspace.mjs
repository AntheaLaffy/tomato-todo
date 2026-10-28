import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { zstdDecompressSync } from "node:zlib";
import { chromium, expect } from "@playwright/test";
import { ModelRuntime } from "../agent/node_modules/@earendil-works/pi-coding-agent/dist/index.js";
import { generateImage } from "../agent/imagegen.mjs";

const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=";
test(
  "ImageGen uses the real Pi Codex SSE transport, persists one result and rejects other providers",
  { timeout: 30000 },
  async () => {
    const requests = [],
      saved = [];
    let mode = "image";
    const server = createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      let body = Buffer.concat(chunks);
      if (req.headers["content-encoding"] === "zstd")
        body = zstdDecompressSync(body);
      requests.push(JSON.parse(body));
      if (mode === "unauthorized") {
        res.writeHead(401);
        res.end('{"error":{"message":"Authentication failed"}}');
        return;
      }
      if (mode === "unsupported") {
        res.writeHead(400);
        res.end(
          '{"error":{"message":"Unsupported tool type: image_generation"}}',
        );
        return;
      }
      if (mode === "quota") {
        res.writeHead(429);
        res.end('{"error":{"message":"Image generation quota exceeded"}}');
        return;
      }
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      if (mode === "wait") {
        res.write(
          'data: {"type":"response.created","response":{"id":"waiting"}}\n\n',
        );
        return;
      }
      const item = {
        id: "image-one",
        type: "image_generation_call",
        result: png,
        output_format: "png",
        status: "completed",
      };
      const events = [
        { type: "response.created", response: { id: "image-response" } },
        { type: "response.output_item.done", output_index: 0, item },
        {
          type: "response.completed",
          response: {
            id: "image-response",
            status: "completed",
            output: [item],
            usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
          },
        },
      ];
      // Deliberately split UTF-8/SSE frames across writes, as a real transport does.
      const text = events
        .map((event) => `data: ${JSON.stringify(event)}\n\n`)
        .join("");
      for (let at = 0; at < text.length; at += 17)
        res.write(text.slice(at, at + 17));
      res.end();
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const token = `e30.${Buffer.from(JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: "synthetic-account" }, exp: 9999999999 })).toString("base64url")}.signature`;
    const credentials = {
      read: async () => ({
        type: "oauth",
        access: token,
        refresh: "synthetic",
        expires: 9999999999999,
      }),
      list: async () => [],
      modify: async () => {},
      delete: async () => {},
    };
    const runtime = await ModelRuntime.create({
      credentials,
      modelsPath: null,
      modelsStorePath: null,
      refreshOnCreate: false,
      allowModelNetwork: false,
    });
    runtime.registerProvider("openai-codex", {
      baseUrl: `http://127.0.0.1:${server.address().port}`,
      api: "openai-codex-responses",
      apiKey: token,
      models: [
        {
          id: "image-test",
          name: "Local image fixture",
          reasoning: false,
          input: ["text", "image"],
          contextWindow: 65536,
          maxTokens: 4096,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        },
      ],
    });
    const context = {
      runtime,
      credentials,
      preferences: { provider: "openai-codex", model: "image-test" },
      toolRequest: async (name, args) => {
        if (name === "image_reference")
          return { attachment: { mimeType: "image/png" }, data: png };
        assert.equal(name, "store_generated_image");
        saved.push(args);
        return {
          id: "saved-image",
          name: args.name,
          mimeType: args.mimeType,
          bytes: 68,
        };
      },
    };
    try {
      const result = await generateImage(
        { prompt: "画一张复习卡片", referenceIds: ["reference"] },
        context,
      );
      assert.equal(result.images.length, 1);
      assert.equal(saved.length, 1);
      assert.equal(saved[0].data, png);
      assert.equal(requests[0].tools[0].type, "image_generation");
      assert.equal(requests[0].tool_choice.type, "image_generation");
      assert.ok(
        JSON.stringify(requests[0].input).includes("data:image/png;base64,"),
      );
      for (const provider of ["deepseek", "third-party"])
        await assert.rejects(
          generateImage(
            { prompt: "画图" },
            { ...context, preferences: { provider } },
          ),
          /当前模型连接不支持/,
        );
      assert.equal(
        requests.length,
        1,
        "unsupported providers must not consume Codex quota",
      );
      await assert.rejects(
        generateImage(
          { prompt: "画图" },
          { ...context, credentials: { read: async () => undefined } },
        ),
        /请先登录/,
      );
      mode = "quota";
      await assert.rejects(
        generateImage({ prompt: "画图" }, context),
        /额度已用尽/,
      );
      mode = "unauthorized";
      await assert.rejects(
        generateImage({ prompt: "画图" }, context),
        /登录已失效/,
      );
      mode = "unsupported";
      await assert.rejects(
        generateImage({ prompt: "画图" }, context),
        /不支持 ImageGen/,
      );
      mode = "wait";
      const expectedRequests = requests.length + 1;
      const controller = new AbortController();
      const waiting = generateImage(
        { prompt: "长请求" },
        context,
        controller.signal,
      );
      while (requests.length < expectedRequests)
        await new Promise((resolve) => setTimeout(resolve, 10));
      controller.abort();
      await assert.rejects(waiting, /abort|stop|停止/i);
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  },
);

test(
  "Canvas edits, history, conflicts, HTML sandbox and image previews work against Rust",
  { timeout: 90000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "tomato-canvas-"));
    await copyFile("target/debug/tomato-preview", join(dir, "tomato-preview"));
    const port = 4353,
      url = `http://127.0.0.1:${port}`;
    const server = spawn(join(dir, "tomato-preview"), [], {
      env: {
        ...process.env,
        TOMATO_PORT: String(port),
        TOMATO_DATA_PATH: join(dir, "data.sqlite3"),
        CODEX_HOME: join(dir, "codex"),
      },
      stdio: "pipe",
    });
    let browser,
      output = "";
    server.stderr.on("data", (chunk) => {
      output += chunk;
    });
    const api = async (args) => {
      const r = await fetch(`${url}/api/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    };
    try {
      let ready = false;
      for (let i = 0; i < 150; i++) {
        try {
          await api({ op: "status" });
          ready = true;
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
      assert.ok(ready, output);
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
      await page.locator('[data-agent="imagegen"]').click();
      await expect(page.locator("#toast")).toContainText("不支持图像生成");
      await page.locator('[data-agent="canvas"]').click();
      await page.locator('[data-canvas="new"]').click();
      await page.locator("#canvas-title").fill("微积分笔记");
      await page
        .locator("#canvas-content")
        .fill("# 导数\n\n第一段需要解释。\n\n保留结尾。");
      let releaseRead, readStarted;
      const readGate = new Promise((resolve) => {
        releaseRead = resolve;
      });
      const reading = new Promise((resolve) => {
        readStarted = resolve;
      });
      let hold = true;
      const delayDocumentRead = async (route) => {
        if (hold && route.request().postDataJSON()?.op === "canvas_get") {
          hold = false;
          readStarted();
          await readGate;
        }
        await route.continue();
      };
      await page.route("**/api/agent", delayDocumentRead);
      await page.locator('[data-canvas="save"]').click();
      await reading;
      await page.locator("#canvas-content").fill("读取响应期间继续输入的草稿");
      releaseRead();
      await expect(page.locator("#canvas-versions")).toBeVisible();
      await expect(page.locator("#canvas-content")).toHaveValue(
        "读取响应期间继续输入的草稿",
      );
      await page.unroute("**/api/agent", delayDocumentRead);
      await page
        .locator("#canvas-content")
        .fill("# 导数\n\n第一段需要解释。\n\n保留结尾。");
      await page.locator('[data-canvas="save"]').click();
      await expect(page.locator("#canvas-save-status")).toContainText("版本 1");
      const first = await api({ op: "status" }),
        id = first.canvases[0].id,
        original = first.conversations.find((c) => c.active).id;
      await page.locator("#canvas-content").evaluate((el) => {
        const start = el.value.indexOf("第一段");
        el.focus();
        el.setSelectionRange(start, start + 8);
      });
      await page.locator('[data-canvas="explain"]').click();
      await expect(page.locator("#agent-text")).toHaveValue(/第一段需要解释/);
      assert.equal(
        (await api({ op: "status" })).busy,
        false,
        "selection actions prepare a draft instead of sending",
      );
      await page.locator("#canvas-content").fill("本地未保存的修改");
      await api({
        op: "canvas_save",
        id,
        baseRevision: 1,
        title: "微积分笔记",
        content: "外部新版本",
        language: "markdown",
      });
      await page.locator('[data-canvas="save"]').click();
      await expect(page.locator("#toast")).toContainText("新版本");
      await expect(page.locator("#canvas-content")).toHaveValue(
        "本地未保存的修改",
      );
      await page.locator('[data-canvas="save-copy"]').click();
      await expect(page.locator("#canvas-save-status")).toContainText("已保存");
      await page.locator("#canvas-documents").selectOption(id);
      await expect(page.locator("#canvas-content")).toHaveValue("外部新版本");
      await page.locator("#canvas-versions").selectOption("1");
      await expect(page.locator("#canvas-content")).toHaveAttribute(
        "readonly",
        "",
      );
      await page.locator('[data-canvas="restore"]').click();
      await expect(page.locator("#canvas-save-status")).toContainText("版本 3");
      await expect(page.locator("#canvas-content")).toHaveValue(/保留结尾/);
      const download = page.waitForEvent("download");
      await page.locator('[data-canvas="export"]').click();
      assert.equal((await download).suggestedFilename(), "微积分笔记.md");
      await page.locator("#canvas-content").fill("切换会话时保留的草稿");
      await page.locator('[data-agent="new"]').first().click();
      await api({ op: "switch_conversation", id: original });
      await expect(page.locator("#canvas-content")).toHaveValue(
        "切换会话时保留的草稿",
      );
      await page.locator('[data-canvas="reload"]').click();
      await expect(page.locator("#canvas-content")).toHaveValue(/保留结尾/);
      await page.locator("#canvas-language").selectOption("html");
      await page
        .locator("#canvas-content")
        .fill(
          '<h1>交互预览</h1><script>try{parent.document.body.dataset.canvasEscaped="yes"}catch{};fetch("/api/state").catch(()=>{});</script>',
        );
      await page.locator('[data-canvas="save"]').click();
      await page.locator('[data-canvas="preview"]').click();
      await expect(
        page.frameLocator(".canvas-preview iframe").locator("h1"),
      ).toContainText("交互预览");
      assert.equal(
        await page.evaluate(() => document.body.dataset.canvasEscaped),
        undefined,
      );
      await mkdir("artifacts", { recursive: true });
      await page.screenshot({
        path: "artifacts/agent-canvas.png",
        fullPage: true,
      });
      for (const width of [700, 360]) {
        await page.setViewportSize({ width, height: 1100 });
        await expect(page.locator("#agent-canvas")).toBeVisible();
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `Canvas overflow at ${width}`,
        );
      }
      const projectDirectory = join(dir, "project-materials");
      await mkdir(projectDirectory, { recursive: true });
      await api({
        op: "authorize_project_directory",
        name: "未分类",
        color: "#849b7d",
        directory: projectDirectory,
      });
      const file = await api({
        op: "upload_attachment",
        name: "preview.png",
        mimeType: "image/png",
        data: png,
      });
      await page.locator('[data-canvas="close"]').click();
      await page.locator("#agent-attachment-input").setInputFiles({
        name: "preview.png",
        mimeType: "image/png",
        buffer: Buffer.from(png, "base64"),
      });
      await page
        .locator('#agent-attachments [data-agent="view-image"]')
        .click();
      await expect(page.locator(".agent-image-viewer img")).toBeVisible();
      await page.locator('[data-image-action="edit"]').click();
      await expect(page.locator("#toast")).toContainText("不支持图像生成");
      await expect(
        page.locator('.agent-image-viewer [role="alert"]'),
      ).toBeVisible();
      await expect(
        page.locator('.agent-image-viewer [role="alert"]'),
      ).toContainText("不支持图像生成");
      await page.locator('[data-image-action="close"]').click();
      assert.ok(file.id);
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      server.kill("SIGTERM");
    }
  },
);
