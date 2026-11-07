#!/usr/bin/env node
// 打「DSH 插件形态」的 Linux 发行包。
//
// 三种产物，解决两种用户：
// - 轻量版 tomato-todo-<v>-<arch>-linux.tar.gz：runtime + guard + 插件，
//   给已经装好 DSH 的人（AUR 也消费它）。
// - 完整版 tomato-todo-<v>-<arch>-linux-full.tar.gz：再内嵌一份 DSH（含
//   node_modules）与 `dsh` 启动器，解包后不需要另装 DSH；插件由
//   scripts/install-dsh.mjs 挂进 profile。
// - 插件包 tomato-todo-plugin-<v>.tar.gz：只有 plugin/，给已有 DSH 与
//   runtime、只想更新界面/工具的人。
//
// 为什么布局由脚本而不是 workflow 拼：安装脚本 scripts/install.mjs 按相对
// 位置解析 runtime/src/vendor，AUR 模板同时接受平铺与 runtime/ 子树布局；
// 出包与安装必须以同一份布局为准。DSH 版本固定在 packaging/dsh-version，
// 完整版在 CI 里按 runner 架构 npm install（原生依赖随架构）。
//
// 用法：
//   node scripts/package-release.mjs                 # 轻量版 + 插件包
//   node scripts/package-release.mjs --full          # 再加完整版（需要网络装 DSH）
//   node scripts/package-release.mjs --full --dsh-dir /usr/lib/node_modules/@deepseek-ai/dsh
//   node scripts/package-release.mjs --arch aarch64
//   node scripts/package-release.mjs --guard /path/to/tomato-guard --out /tmp/out
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const has = (name) => args.includes(name);

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const version = option("--version") || pkg.version;
const arch =
  option("--arch") || (process.arch === "arm64" ? "aarch64" : "x86_64");
const outDir = resolve(option("--out") || join(ROOT, "dist/release"));
const guardBinary = resolve(
  option("--guard") || join(ROOT, "crates/guard/target/release/tomato-guard"),
);
const runtimeBinary = join(ROOT, "runtime/bin/tomato-runtime");
const vendorDir = join(ROOT, "runtime/vendor");
const clientBundle = join(ROOT, "plugin/client.js");
const withFull = has("--full");
const withPluginOnly = !has("--no-plugin-only");
const dshDir = option("--dsh-dir") ? resolve(option("--dsh-dir")) : null;
const dshVersion =
  option("--dsh-version") ||
  (existsSync(join(ROOT, "packaging/dsh-version"))
    ? readFileSync(join(ROOT, "packaging/dsh-version"), "utf8").trim()
    : "");

const fail = (message) => {
  console.error(`error: ${message}`);
  process.exit(1);
};

// 缺产物时直接说清该跑哪条构建，而不是让 tar 打出一个残缺包。
for (const [label, path, hint] of [
  ["runtime 入口", runtimeBinary, "pnpm build:runtime"],
  ["runtime vendor 树", vendorDir, "pnpm build:runtime"],
  ["guard 二进制", guardBinary, "cd crates/guard && cargo build --release"],
  ["插件客户端产物", clientBundle, "pnpm build:client"],
]) {
  if (!existsSync(path)) fail(`${label}不存在：${path}\n先跑：${hint}`);
}

const stage = join(outDir, `stage-${arch}`);
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

function copyTree(from, to, skip = () => false) {
  const info = lstatSync(from);
  if (info.isSymbolicLink()) return; // node_modules 里的链接不属于发行包
  if (info.isDirectory()) {
    mkdirSync(to, { recursive: true });
    for (const entry of readdirSync(from)) {
      const source = join(from, entry);
      if (skip(source, entry)) continue;
      copyTree(source, join(to, entry), skip);
    }
    return;
  }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  if (info.mode & 0o111) chmodSync(to, 0o755);
}

const write = (path, content, mode) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  if (mode !== undefined) chmodSync(path, mode);
};

function tarball(name, stageRoot) {
  const output = join(outDir, name);
  execFileSync("tar", ["-czf", output, "-C", stage, basename(stageRoot)], {
    stdio: "inherit",
  });
  const bytes = statSync(output).size;
  const hash = createHash("sha256").update(readFileSync(output)).digest("hex");
  writeFileSync(`${output}.sha256`, `${hash}  ${basename(output)}\n`);
  console.log(
    `已打出 ${relative(homedir(), output)}（${(bytes / 1024 / 1024).toFixed(1)} MiB）\n` +
      `sha256 ${hash}`,
  );
}

/** runtime / guard / 插件 / 安装与打包脚本：轻量版与完整版共用。 */
function stageCommon(stageRoot, { full }) {
  copyTree(
    join(ROOT, "runtime"),
    join(stageRoot, "runtime"),
    (source, name) =>
      name === "node_modules" ||
      relative(ROOT, source).startsWith("runtime/test"),
  );
  copyTree(guardBinary, join(stageRoot, "guard/tomato-guard"));
  copyTree(
    join(ROOT, "plugin"),
    join(stageRoot, "plugin"),
    (source, name) => name === "node_modules",
  );
  copyTree(
    join(ROOT, "scripts/install.mjs"),
    join(stageRoot, "scripts/install.mjs"),
  );
  copyTree(
    join(ROOT, "scripts/install-desktop-integration.py"),
    join(stageRoot, "scripts/install-desktop-integration.py"),
  );
  if (full) {
    copyTree(
      join(ROOT, "scripts/install-dsh.mjs"),
      join(stageRoot, "scripts/install-dsh.mjs"),
      () => false,
    );
    chmodSync(join(stageRoot, "scripts/install-dsh.mjs"), 0o755);
  }
  copyTree(
    join(ROOT, "desktop-integrations"),
    join(stageRoot, "desktop-integrations"),
  );
  copyTree(join(ROOT, "packaging"), join(stageRoot, "packaging"));
  for (const file of ["LICENSE", "README.md", "MIGRATION.md"]) {
    if (existsSync(join(ROOT, file)))
      copyTree(join(ROOT, file), join(stageRoot, file));
  }
}

function writeInstallText(stageRoot, { full }) {
  const light = `番茄 Todo ${version}（${arch}，轻量版）

1. 装 runtime 与 guard（用户目录，不需要 root）：
     node scripts/install.mjs --runtime runtime/bin/tomato-runtime --guard guard/tomato-guard

2. 挂进已安装的 DSH：在 DSH profile 的 package.json 里加
     "dsh-plugin-tomato-todo": "link:<解包目录>/plugin"
   再在 profile 的 dsh.profile.bundles 列表里加入 "dsh-plugin-tomato-todo"；
   或直接用 DSH 的 plugin_manager 安装本目录的 plugin/。

3. 重启 DSH 桌面窗口（或 dsh web），番茄面板与 tomato_* 工具随之出现。

注意：脚本只写 ~/.local/{lib,bin} 与 ~/.config/systemd/user，
      并记在 install-manifest.json 里；--uninstall 只删它自己装的文件。
`;
  const fullText = `番茄 Todo ${version}（${arch}，完整版）

本包已内嵌 DSH ${dshVersion}，不需要另外安装 DSH；数据仍默认存到 ~/.dsh。

1. 装 runtime 与 guard（用户目录，不需要 root）：
     node scripts/install.mjs --runtime runtime/bin/tomato-runtime --guard guard/tomato-guard

2. 把随包插件挂进 DSH profile（profile 不存在时会用 web 模板创建）：
     node scripts/install-dsh.mjs --profile tomato

3. 启动（数据与系统安装的 DSH 共用 DSH_HOME，默认 ~/.dsh）：
     ./dsh --profile tomato web

   也可以把 ./dsh 软链到 ~/.local/bin/tomato-dsh 方便启动。

注意：完整版内嵌的是 npm 上最新的 DSH 发行版（版本见 packaging/dsh-version）；
      升级 DSH 时重新下载新版完整包即可，profile 与数据不动。
`;
  write(join(stageRoot, "INSTALL.txt"), full ? fullText : light);
}

function writeDshLauncher(stageRoot) {
  write(
    join(stageRoot, "dsh"),
    `#!/bin/sh
# 随包的 DSH 启动器：数据目录沿用 $DSH_HOME（默认 ~/.dsh）。
set -eu
SELF=$(readlink -f "$0" 2>/dev/null || printf '%s' "$0")
ROOT=$(CDPATH= cd -- "$(dirname -- "$SELF")" && pwd)
exec "\${DSH_NODE:-node}" "$ROOT/vendor/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js" "$@"
`,
    0o755,
  );
}

/** 完整版：vendor 一份 DSH（含 node_modules）到 vendor/dsh。 */
function stageDsh(stageRoot) {
  const dshProject = join(stageRoot, "vendor/dsh");
  mkdirSync(dshProject, { recursive: true });
  if (dshDir !== null) {
    const sourceBin = join(dshDir, "package.json");
    if (!existsSync(sourceBin))
      fail(`--dsh-dir 不是 DSH 包目录（缺 package.json）：${dshDir}`);
    console.log(`内嵌本机 DSH：${dshDir}`);
    copyTree(dshDir, join(dshProject, "node_modules/@deepseek-ai/dsh"));
  } else {
    if (dshVersion === "")
      fail("缺少 packaging/dsh-version，无法确定 DSH 版本");
    write(
      join(dshProject, "package.json"),
      JSON.stringify(
        {
          name: "tomato-todo-dsh-bundle",
          private: true,
          dependencies: { "@deepseek-ai/dsh": dshVersion },
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`安装 DSH ${dshVersion}（含 node_modules，需要网络）…`);
    execFileSync(
      "npm",
      [
        "install",
        "--prefix",
        dshProject,
        "--omit=dev",
        "--no-audit",
        "--no-fund",
      ],
      { stdio: "inherit" },
    );
  }
  const bin = join(dshProject, "node_modules/@deepseek-ai/dsh/lib/bin.js");
  if (!existsSync(bin)) fail(`完整版缺少 DSH 入口：${bin}`);
}

// ---------------------------------------------------------------- 轻量版
{
  const stageRoot = join(stage, `tomato-todo-${version}`);
  rmSync(stageRoot, { recursive: true, force: true });
  mkdirSync(stageRoot, { recursive: true });
  stageCommon(stageRoot, { full: false });
  writeInstallText(stageRoot, { full: false });
  tarball(`tomato-todo-${version}-${arch}-linux.tar.gz`, stageRoot);
}

// ---------------------------------------------------------------- 插件包
if (withPluginOnly) {
  const pluginRoot = join(stage, `tomato-todo-plugin-${version}`);
  rmSync(pluginRoot, { recursive: true, force: true });
  mkdirSync(join(pluginRoot, "plugin"), { recursive: true });
  copyTree(
    join(ROOT, "plugin"),
    join(pluginRoot, "plugin"),
    (source, name) => name === "node_modules",
  );
  for (const file of ["LICENSE", "README.md"]) {
    if (existsSync(join(ROOT, file)))
      copyTree(join(ROOT, file), join(pluginRoot, file));
  }
  write(
    join(pluginRoot, "INSTALL.txt"),
    `番茄 Todo ${version} 插件包（只有 plugin/，不含 runtime/guard/DSH）

已有 DSH 与 tomato-runtime 时，用 DSH plugin_manager 安装本目录的 plugin/，
或在 profile 的 package.json 加：
  "dsh-plugin-tomato-todo": "link:<解包目录>/plugin"
并把 "dsh-plugin-tomato-todo" 加入 dsh.profile.bundles。

需要 runtime/guard（以及可选的完整版 DSH）请下载
tomato-todo-${version}-<arch>-linux.tar.gz 或 -full.tar.gz。
`,
  );
  tarball(`tomato-todo-plugin-${version}.tar.gz`, pluginRoot);
}

// ---------------------------------------------------------------- 完整版
if (withFull) {
  const stageRoot = join(stage, `tomato-todo-${version}-full`);
  rmSync(stageRoot, { recursive: true, force: true });
  mkdirSync(stageRoot, { recursive: true });
  stageCommon(stageRoot, { full: true });
  stageDsh(stageRoot);
  writeDshLauncher(stageRoot);
  writeInstallText(stageRoot, { full: true });
  tarball(`tomato-todo-${version}-${arch}-linux-full.tar.gz`, stageRoot);
}

rmSync(stage, { recursive: true, force: true });
