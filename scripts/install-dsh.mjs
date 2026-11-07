#!/usr/bin/env node
// 把随包的番茄 Todo 插件装进一个 DSH profile（只写 DSH_HOME，不碰别的路径）。
//
// 为什么需要它：完整版发行包内嵌了 DSH，但 DSH 的插件必须挂在某个 profile
// 的依赖与 dsh.profile.bundles 里，光解压不会出现番茄面板。这里复用 DSH 自己
// 的 `--from-default-profile` 与 `plugin add`，不手写 profile 的 package.json：
// profile 的字段、pnpm 链接与 bundle 列表都归 DSH 管，手写一份就会随版本漂移。
//
// 用法（在解包目录里）：
//   node scripts/install-dsh.mjs                       # 默认 profile=tomato
//   node scripts/install-dsh.mjs --profile tomato
//   node scripts/install-dsh.mjs --dsh-home /tmp/dsh --dry-run
//
// 约定：
// - 默认使用包内 vendor/dsh 与 plugin/；--dsh 可指向别的 DSH 安装根
//   （其下需有 node_modules/@deepseek-ai/dsh/lib/bin.js）。
// - DSH_HOME 默认 $DSH_HOME 或 ~/.dsh；数据、凭据与会话仍留在用户目录。
// - 只在 profile 不存在时用 web 模板创建；已存在就只 add 插件，不覆盖用户配置。
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const has = (name) => args.includes(name);

const fail = (message) => {
  console.error(`error: ${message}`);
  process.exit(1);
};

if (has("--help") || has("-h")) {
  console.log(`用法: node scripts/install-dsh.mjs [选项]

  --profile <name>   DSH profile 名称（默认 tomato）
  --dsh <dir>        DSH 安装根（默认 <解包目录>/vendor/dsh）
  --plugin <dir>     插件目录（默认 <解包目录>/plugin）
  --dsh-home <dir>   DSH_HOME（默认 $DSH_HOME 或 ~/.dsh）
  --dry-run          只打印将执行的命令
`);
  process.exit(0);
}

const profile = option("--profile") || "tomato";
if (!/^[a-z0-9][a-z0-9._-]*$/i.test(profile))
  fail(`profile 名称无效：${profile}`);

const dshRoot = resolve(option("--dsh") || join(ROOT, "vendor/dsh"));
const pluginDir = resolve(option("--plugin") || join(ROOT, "plugin"));
const dshHome =
  option("--dsh-home") || process.env.DSH_HOME || join(homedir(), ".dsh");
const dryRun = has("--dry-run");

const bin = join(dshRoot, "node_modules/@deepseek-ai/dsh/lib/bin.js");
if (!existsSync(bin))
  fail(
    `找不到随包 DSH：${bin}\n` +
      "完整版解包后应带 vendor/dsh；若用系统 DSH，请用 --dsh <安装根> 指定。",
  );
if (!existsSync(join(pluginDir, "package.json")))
  fail(`找不到插件目录：${pluginDir}`);

const env = { ...process.env, DSH_HOME: dshHome };
const profileDir = join(dshHome, "profiles", profile);

function run(label, command, commandArgs, stdio) {
  console.log(`\n$ ${[command, ...commandArgs].join(" ")}`);
  if (dryRun) return;
  const result = spawnSync(command, commandArgs, {
    env,
    stdio: stdio || "inherit",
  });
  if (result.error) fail(`${label}失败：${result.error.message}`);
  if (result.status !== 0) fail(`${label}失败（退出码 ${result.status}）`);
}

console.log(`DSH_HOME: ${dshHome}`);
console.log(`profile:  ${profile}`);
console.log(`插件:     ${pluginDir}`);

// 已存在的 profile 不重建：用户可能已经装了别的插件或改了 cordis 配置。
if (!existsSync(profileDir)) {
  console.log(`\nprofile ${profile} 不存在，用 web 模板创建。`);
  run(
    "创建 profile",
    process.execPath,
    [
      bin,
      "--profile",
      profile,
      "--from-default-profile",
      "web",
      "--dump-config",
    ],
    ["ignore", "ignore", "inherit"],
  );
} else {
  console.log(`\nprofile ${profile} 已存在，保留现有配置。`);
}

run("安装插件", process.execPath, [
  bin,
  "plugin",
  "--profile",
  profile,
  "add",
  `link:${pluginDir}`,
]);

console.log(
  `\n完成。启动完整版：\n` +
    `  ${join(ROOT, "dsh")} --profile ${profile} web\n` +
    `或（手动）：\n` +
    `  node ${bin} --profile ${profile} web\n` +
    `数据目录仍是 DSH_HOME（默认 ~/.dsh），与系统安装的 DSH 共用。`,
);
