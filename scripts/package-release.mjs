#!/usr/bin/env node
// 打「DSH 插件形态」的 Linux 发行包：一份 tarball，装完之后既是 runtime+guard
// 两个进程，也是可以直接挂进 DSH profile 的插件目录。
//
// 为什么需要一个脚本而不是在 workflow 里堆 cp：安装脚本 scripts/install.mjs
// 按**相对位置**解析 src/vendor/package.json（`dirname(dirname(runtime))`），
// AUR 模板 packaging/aur/PKGBUILD.in 又同时接受平铺与 runtime/ 子树两种布局。
// 这两处约束一旦在 YAML 里各写一遍就会漂移；把布局写在一个可本地执行、可被 CI
// 直接调用的脚本里，出包和安装才共用同一份事实。
//
// 用法：
//   node scripts/package-release.mjs                    # 当前版本、当前架构
//   node scripts/package-release.mjs --arch aarch64
//   node scripts/package-release.mjs --guard /path/to/tomato-guard --out /tmp/out
//
// 产物：<out>/tomato-todo-<version>-<arch>-linux.tar.gz 与同名 .sha256。
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
const stageRoot = join(stage, `tomato-todo-${version}`);
rmSync(stage, { recursive: true, force: true });
mkdirSync(stageRoot, { recursive: true });

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

// runtime/ 整棵树：install.mjs 会按相对位置复制 bin/、src/、vendor/、
// package.json，少一项装出来的 runtime 就起不来。
copyTree(
  join(ROOT, "runtime"),
  join(stageRoot, "runtime"),
  (source, name) =>
    name === "node_modules" ||
    relative(ROOT, source).startsWith("runtime/test"),
);
copyTree(guardBinary, join(stageRoot, "guard/tomato-guard"));

// 插件目录：DSH profile 用 link: 指向它，client.js 必须已经在包里。
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
copyTree(
  join(ROOT, "desktop-integrations"),
  join(stageRoot, "desktop-integrations"),
);
copyTree(join(ROOT, "packaging"), join(stageRoot, "packaging"));

for (const file of ["LICENSE", "README.md", "MIGRATION.md"]) {
  if (existsSync(join(ROOT, file)))
    copyTree(join(ROOT, file), join(stageRoot, file));
}

writeFileSync(
  join(stageRoot, "INSTALL.txt"),
  `番茄 Todo ${version}（${arch}）

1. 装 runtime 与 guard（用户目录，不需要 root）：
     node scripts/install.mjs --runtime runtime/bin/tomato-runtime --guard guard/tomato-guard

2. 挂进 DSH：在 DSH profile 的 package.json 里加
     "@local/tomato-dsh": "link:<解包目录>/plugin"
   再在 profile 的 dsh.bundle 列表里加入 "@local/tomato-dsh"。

3. 重启 DSH 桌面窗口（或 dsh web），番茄面板与 tomato_* 工具随之出现。

注意：脚本只写 ~/.local/{lib,bin} 与 ~/.config/systemd/user，
      并记在 install-manifest.json 里；--uninstall 只删它自己装的文件。
`,
);

// 包体与校验：tar 用系统 tar（零依赖），解包后保持可执行位。
const tarball = join(outDir, `tomato-todo-${version}-${arch}-linux.tar.gz`);
execFileSync("tar", ["-czf", tarball, "-C", stage, basename(stageRoot)], {
  stdio: "inherit",
});
const bytes = statSync(tarball).size;
const hash = createHash("sha256").update(readFileSync(tarball)).digest("hex");
writeFileSync(`${tarball}.sha256`, `${hash}  ${basename(tarball)}\n`);

console.log(
  `已打出 ${relative(homedir(), tarball)}（${(bytes / 1024 / 1024).toFixed(1)} MiB）\n` +
    `sha256 ${hash}\n` +
    `安装：node scripts/install.mjs --runtime runtime/bin/tomato-runtime --guard guard/tomato-guard`,
);
