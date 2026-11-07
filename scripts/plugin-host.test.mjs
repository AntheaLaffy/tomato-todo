import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { TOOLS } from "../runtime/src/tools.mjs";
import { HOST_TOOL_SPECS } from "../plugin/host-tool-specs.js";
import { apply } from "../plugin/index.js";

test("plugin Host tools cover the runtime contract without an MCP client", async () => {
  assert.deepEqual(HOST_TOOL_SPECS, TOOLS.map(({ name, description, inputSchema }) =>
    ({ name, description, inputSchema })));

  const registered = new Map();
  const requests = [];
  const ctx = {
    inject() {},
    tools: { register(tool) { registered.set(tool.name, tool); } },
    subprocess: {
      spawn(options) {
        const request = JSON.parse(options.stdio.stdin.data);
        requests.push(request);
        const payload = request.params.name === "get_education"
          ? { items: [{ id: "assessment-1" }], total: 1 }
          : { today: "2026-11-07" };
        const reply = JSON.stringify({ jsonrpc: "2.0", id: 1, result: {
          content: [{ type: "text", text: JSON.stringify(payload) }],
          structuredContent: payload,
        } });
        return {
          done: Promise.resolve({ exitCode: 0 }),
          collected: { stdout: { readFrom: () => ({ text: reply + "\n" }) } },
        };
      },
    },
  };
  // 测试不落盘：linkSkills 会真的往 ~/.agents/skills 建链接，这里关掉。
  apply(ctx, { tomatoBin: "/fake/tomato-runtime", linkSkills: false });
  for (const spec of TOOLS) {
    assert.ok(registered.has(`tomato_${spec.name}`), spec.name);
  }
  assert.equal(registered.size, TOOLS.length + 2); // today + guard status
  assert.equal(registered.get("tomato_get_education").parameters.required[0], "collection");

  const result = await registered.get("tomato_get_education").execute({
    collection: "assessments", id: "assessment-1",
  });
  assert.equal(result.items[0].id, "assessment-1");
  assert.deepEqual(requests[0].params, { name: "get_education",
    arguments: { collection: "assessments", id: "assessment-1" } });
  assert.deepEqual(await registered.get("tomato_get_context").execute({}),
    { today: "2026-11-07" });
});

test("plugin Host can read the running Todo instance",
  { skip: process.env.LIVE_TOMATO !== "1" }, async () => {
    const registered = new Map();
    const ctx = {
      inject() {},
      tools: { register(tool) { registered.set(tool.name, tool); } },
      subprocess: {
        spawn(options) {
          const child = spawn(options.argv[0], options.argv.slice(1), {
            cwd: options.cwd,
            env: { ...process.env, ...options.env },
            stdio: ["pipe", "pipe", "ignore"],
          });
          let stdout = "";
          child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
          child.stdin.end(options.stdio.stdin.data);
          const done = new Promise((resolve, reject) => {
            child.once("error", reject);
            child.once("close", (exitCode) => resolve({ exitCode }));
          });
          return { done, collected: { stdout: { readFrom: () => ({ text: stdout }) } } };
        },
      },
    };
    apply(ctx, { tomatoBin: "/home/fuurin/.local/bin/tomato-runtime", linkSkills: false });
    const context = await registered.get("tomato_get_context").execute({});
    assert.equal(typeof context, "object");
    const education = await registered.get("tomato_get_education").execute({
      collection: "assessments", limit: 1,
    });
    assert.equal(education.collection, "assessments");
    assert.ok(Array.isArray(education.records));
  });
