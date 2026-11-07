// scripts/install-dsh.mjs 的自测：用假 DSH 记录参数，验证
// 「profile 不存在才创建、每次都 add 插件、只写 DSH_HOME」三条契约。
// 不联网、不碰真实 ~/.dsh。
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

const SCRIPT = resolve(import.meta.dirname, "install-dsh.mjs");
const fixtures = [];
after(async () => {
  for (const root of fixtures) await rm(root, { recursive: true, force: true });
});

const FAKE_DSH = `#!/usr/bin/env node
const { appendFileSync, mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const argv = process.argv.slice(2);
appendFileSync(process.env.FAKE_DSH_LOG, JSON.stringify(argv) + "\\n");
const profile = argv[argv.indexOf("--profile") + 1];
if (argv.includes("--from-default-profile")) {
  const dir = join(process.env.DSH_HOME, "profiles", profile);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ dsh: { profile: { bundles: ["@deepseek-ai/dsh-base"] } } }),
  );
}
`;

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "tomato-install-dsh-"));
  fixtures.push(root);
  const dshRoot = join(root, "vendor/dsh");
  const bin = join(dshRoot, "node_modules/@deepseek-ai/dsh/lib/bin.js");
  await mkdir(join(bin, ".."), { recursive: true });
  await writeFile(bin, FAKE_DSH);
  await chmod(bin, 0o755);
  const plugin = join(root, "plugin");
  await mkdir(plugin, { recursive: true });
  await writeFile(
    join(plugin, "package.json"),
    JSON.stringify({ name: "dsh-plugin-tomato-todo" }),
  );
  return { root, dshRoot, plugin, home: join(root, "dsh-home") };
}

const run = (f, args) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    env: {
      ...process.env,
      FAKE_DSH_LOG: join(f.root, "calls.log"),
      DSH_HOME: f.home,
    },
    encoding: "utf8",
  });

const calls = async (f) =>
  (await readFile(join(f.root, "calls.log"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

test("profile 不存在时用 web 模板创建，再 link 插件", async () => {
  const f = await fixture();
  const result = run(f, [
    "--dsh",
    f.dshRoot,
    "--plugin",
    f.plugin,
    "--dsh-home",
    f.home,
    "--profile",
    "tomato",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const log = await calls(f);
  assert.equal(log.length, 2);
  assert.ok(log[0].includes("--from-default-profile"));
  assert.deepEqual(log[1], [
    "plugin",
    "--profile",
    "tomato",
    "add",
    `link:${f.plugin}`,
  ]);
  const manifest = JSON.parse(
    await readFile(join(f.home, "profiles/tomato/package.json"), "utf8"),
  );
  assert.deepEqual(manifest.dsh.profile.bundles, ["@deepseek-ai/dsh-base"]);
});

test("profile 已存在时只 add 插件，不覆盖配置", async () => {
  const f = await fixture();
  await mkdir(join(f.home, "profiles/tomato"), { recursive: true });
  await writeFile(
    join(f.home, "profiles/tomato/package.json"),
    JSON.stringify({ dsh: { profile: { bundles: ["custom"] } } }),
  );
  const result = run(f, [
    "--dsh",
    f.dshRoot,
    "--plugin",
    f.plugin,
    "--dsh-home",
    f.home,
  ]);
  assert.equal(result.status, 0, result.stderr);
  const log = await calls(f);
  assert.equal(log.length, 1);
  assert.deepEqual(log[0], [
    "plugin",
    "--profile",
    "tomato",
    "add",
    `link:${f.plugin}`,
  ]);
  const manifest = JSON.parse(
    await readFile(join(f.home, "profiles/tomato/package.json"), "utf8"),
  );
  assert.deepEqual(manifest.dsh.profile.bundles, ["custom"]);
});

test("--dry-run 不执行任何命令", async () => {
  const f = await fixture();
  const result = run(f, [
    "--dsh",
    f.dshRoot,
    "--plugin",
    f.plugin,
    "--dsh-home",
    f.home,
    "--dry-run",
  ]);
  assert.equal(result.status, 0, result.stderr);
  await assert.rejects(readFile(join(f.root, "calls.log"), "utf8"));
});

test("缺 DSH 或插件时给出可读错误", async () => {
  const f = await fixture();
  const missing = run(f, [
    "--dsh",
    join(f.root, "nope"),
    "--plugin",
    f.plugin,
    "--dsh-home",
    f.home,
  ]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /找不到随包 DSH/);
  const noPlugin = run(f, [
    "--dsh",
    f.dshRoot,
    "--plugin",
    join(f.root, "nope"),
    "--dsh-home",
    f.home,
  ]);
  assert.equal(noPlugin.status, 1);
  assert.match(noPlugin.stderr, /找不到插件目录/);
});
