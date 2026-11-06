#!/usr/bin/env node
// 番茄 Todo（DSH 插件版）Linux 单用户安装脚本：安装 tomato-runtime 与
// tomato-guard 两个后台进程，写 systemd user unit 并启用 runtime 自启。
// 需要 Node ≥ 20.11（用到 import.meta.dirname，与 scripts/publish-aur.mjs
// 一致），零依赖。
//
// 这是旧 scripts/install.py（Tauri 桌面时代）的重写。桌面 UI 已删除，不再
// 安装 .desktop 入口、图标、autostart 文件或 agent 资源；剩下的安装物就是
// 两个进程 + systemd unit。沿用旧版的惯例：
//
// - 原子写（atomicWrite）：同目录唯一临时文件 → 写入 → fsync → chmod →
//   rename。rename 是原子替换，读者只会看到旧内容或新内容，不会看到写一半
//   的二进制/unit。零依赖实现（node:fs/promises），与 publish-aur.mjs 同为
//   发布工具，不进 workspace 依赖。
// - XDG 感知：xdg() 按 XDG_DATA_HOME/XDG_CONFIG_HOME/XDG_STATE_HOME 解析
//   数据/配置/状态目录；--home 覆盖全部并忽略环境变量（隔离测试用，与旧版
//   行为一致）。
// - 拒绝覆盖「非本脚本管理」的既有文件：旧版用 .desktop 里的
//   X-Tomato-Todo-Managed=true 标记，新版没有桌面入口，改用 manifest
//   （~/.local/lib/tomato/install-manifest.json）记录全部已装路径；目标文件
//   已存在且不在旧 manifest 里 → 拒绝并报错。launcher 符号链接沿用旧惯例：
//   只接受「不存在」或「恰好指向本脚本要装的目标」，拒绝替换无关文件/链接。
//
// 安装布局（固定并文档化，与 packaging/aur/PKGBUILD.in 的 /usr/lib/tomato
// 布局镜像）：
//   ~/.local/lib/tomato/runtime/bin/tomato-runtime   + 兄弟 vendor/ 树
//   ~/.local/lib/tomato/guard/tomato-guard
//   ~/.local/bin/tomato-runtime、tomato-guard         两个符号链接
//   ~/.config/systemd/user/tomato-runtime.service、tomato-guard.service
//   ~/.local/lib/tomato/install-manifest.json
// bin/ 与 vendor/ 必须保持兄弟关系：runtime 按相对位置解析 vendor/core.mjs
// （scripts/build-runtime.mjs 的产物布局）。
//
// 设计取舍（why）：
// - systemd user unit 而不是旧版 autostart .desktop：runtime 与 guard 是
//   无界面的后台进程，autostart .desktop 是 GUI 时代的产物；systemd 提供
//   daemon-reload / enable / disable 的完整生命周期。
// - tomato-guard.service 默认不 enable：API.md 规定 guard 由 runtime 监督并
//   在崩溃时重启（runtime 每次专注会话重发锁屏命令），系统级自启会与
//   runtime 的监督职责冲突（双重启动、端口占用）。unit 仅为手动/应急使用
//   保留，--enable-guard 才显式 enable。
// - tomato-runtime.service 不加 Restart=：runtime 同时由 DSH 插件 host 经
//   subprocess 保活（MIGRATION.md），两边都重启会在 127.0.0.1:43987 上
//   冲突。systemd 只管登录自启。
// - systemctl 调用 best-effort：容器/最小环境没有 systemd user 会话时只装
//   文件并警告，不把安装判失败（沿用旧版对 update-desktop-database 等命令
//   check=False 的态度）；自启可稍后手动 enable。
// - uninstall 只删 manifest 内的路径，并只删随之变空的目录；manifest 之外
//   的东西一律不碰。崩溃可能遗留的 .vendor.installing/.previous 暂存目录
//   不在 manifest 里，下一次安装会先清理。
//
// 假设（跨工作流待定项，落地后需对齐）：
// - guard 数据目录 = XDG_STATE_HOME/studio.tomato.todo/guard（runtime 在此
//   写 guard 的 token，guard 读取）。API.md 只写了「token 由 runtime 生成
//   写入 guard 数据目录」，未指定该目录具体路径；runtime 工作流落地后需
//   对齐本脚本与 unit 注释。
// - runtime 数据目录沿用 ~/.local/share/studio.tomato.todo/（API.md 明确，
//   不是假设）；XDG_DATA_HOME 被自定义时，unit 里写解析后的绝对路径而非
//   %h/.local/share/…（%h 不会跟随自定义 XDG_DATA_HOME）。
//
// 用法：
//   node scripts/install.mjs                        # 用仓库默认产物安装
//   node scripts/install.mjs --runtime <path> --guard <path>
//   node scripts/install.mjs --enable-guard         # 一并 enable guard unit
//   node scripts/install.mjs --home <dir> --dry-run # 隔离环境预览 plan
//   node scripts/install.mjs --home <dir> --uninstall
import { constants } from "node:fs";
import {
  access,
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  readlink,
  rename,
  rm,
  rmdir,
  stat,
  symlink,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import {
  basename,
  delimiter,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const APP_ID = "studio.tomato.todo";
const RUNTIME_SERVICE = "tomato-runtime.service";
const GUARD_SERVICE = "tomato-guard.service";
const DEFAULT_RUNTIME = join(ROOT, "runtime/bin/tomato-runtime");
const DEFAULT_GUARD = join(ROOT, "target/release/tomato-guard");

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function warn(message) {
  console.error(`warning: ${message}`);
}

// ---------- 参数解析（零依赖，支持 --flag 与 --option value / --option=value） ----------
const options = new Map();
for (let i = 0; i < process.argv.length - 2; i++) {
  const arg = process.argv[i + 2];
  if (
    arg === "--dry-run" ||
    arg === "--uninstall" ||
    arg === "--enable-guard"
  ) {
    options.set(arg, true);
  } else if (arg === "--runtime" || arg === "--guard" || arg === "--home") {
    let value = null;
    const at = arg.indexOf("=");
    if (at >= 0) {
      value = arg.slice(at + 1);
    } else {
      const next = process.argv[i + 3];
      if (!next) fail(`Missing value for ${arg}`);
      value = next;
      i += 1;
    }
    options.set(arg, value);
  } else {
    fail(`Unknown argument: ${arg}`);
  }
}
if (options.get("--enable-guard") && options.get("--uninstall")) {
  fail("--enable-guard 只能与安装一起使用");
}

// ---------- 路径解析（XDG 感知，--home 覆盖全部，与旧 install.py 同语义） ----------
const home = options.get("--home") ? resolve(options.get("--home")) : homedir();
const xdg = (name, fallback) => {
  const configured = options.get("--home") ? undefined : process.env[name];
  return configured && isAbsolute(configured)
    ? configured
    : join(home, fallback);
};
const data = xdg("XDG_DATA_HOME", ".local/share");
const config = xdg("XDG_CONFIG_HOME", ".config");
const state = xdg("XDG_STATE_HOME", ".local/state");

const libRoot = join(home, ".local/lib/tomato");
const runtimeDir = join(libRoot, "runtime");
const runtimeBinary = join(runtimeDir, "bin/tomato-runtime");
const vendorDir = join(runtimeDir, "vendor");
const guardBinary = join(libRoot, "guard/tomato-guard");
const runtimeLauncher = join(home, ".local/bin/tomato-runtime");
const guardLauncher = join(home, ".local/bin/tomato-guard");
const unitDir = join(config, "systemd/user");
const runtimeUnit = join(unitDir, RUNTIME_SERVICE);
const guardUnit = join(unitDir, GUARD_SERVICE);
const manifestPath = join(libRoot, "install-manifest.json");
const runtimeDataDir = join(data, APP_ID);
const guardDataDir = join(state, "studio.tomato.todo/guard");

// ---------- 基础工具 ----------
async function lexists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function atomicWrite(path, content, mode = 0o644) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(
    dirname(path),
    `.tomato-${process.pid}-${Math.random().toString(36).slice(2)}`,
  );
  const handle = await open(temporary, "wx");
  try {
    await handle.writeFile(content);
    await handle.sync();
    await handle.close();
    await chmod(temporary, mode);
    await rename(temporary, path);
  } catch (error) {
    await handle.close().catch(() => {});
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

// 递归列出树内所有文件与符号链接（符号链接目录不跟随）。
async function walkFiles(dir) {
  const output = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) output.push(...(await walkFiles(path)));
    else if (entry.isFile() || entry.isSymbolicLink()) output.push(path);
  }
  return output;
}

async function copyTree(source, target) {
  await mkdir(target, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(target, entry.name);
    if (entry.isDirectory()) {
      await copyTree(from, to);
    } else if (entry.isSymbolicLink()) {
      await symlink(await readlink(from), to);
    } else if (entry.isFile()) {
      const info = await stat(from);
      await atomicWrite(to, await readFile(from), info.mode & 0o777);
    }
  }
}

// 整树替换而不是合并：退场的 vendor 文件不会残留（沿用旧 install.py 对
// agent 树的 staging → previous → rename 惯例）。
async function replaceTree(source, target) {
  const parent = dirname(target);
  const staging = join(parent, `.${basename(target)}.installing`);
  const previous = join(parent, `.${basename(target)}.previous`);
  await rm(staging, { recursive: true, force: true });
  await rm(previous, { recursive: true, force: true });
  await copyTree(source, staging);
  if (await lexists(target)) await rename(target, previous);
  await rename(staging, target);
  await rm(previous, { recursive: true, force: true });
}

async function which(name) {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir) continue;
    try {
      const candidate = join(dir, name);
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      /* 继续找下一个 PATH 目录 */
    }
  }
  return null;
}

function runSystemctl(args) {
  const environment = { ...process.env };
  if (options.get("--home")) {
    // --home 是隔离安装：让子进程看到的 HOME/XDG_* 对齐本次解析出的目录，
    // 保证（真实或测试替身的）systemctl 作用在同一个 home 上。
    environment.HOME = home;
    environment.XDG_CONFIG_HOME = config;
    environment.XDG_DATA_HOME = data;
    environment.XDG_STATE_HOME = state;
  }
  return spawnSync("systemctl", ["--user", ...args], {
    env: environment,
    encoding: "utf8",
  });
}

async function readManifest(path) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error(
      `manifest 无法解析（${path}）：${error.message}；请人工检查后移走再重试`,
    );
  }
  // 存在但不是本脚本写的 manifest → 视为「非本脚本管理」。
  if (parsed?.appId === APP_ID && Array.isArray(parsed.files)) return parsed;
  return null;
}

// systemd unit 里含空格/引号/反斜杠/% 的路径需要引号与转义；普通绝对路径原样。
function systemdQuote(path) {
  if (!/[\s"'\\%]/.test(path)) return path;
  return `"${path
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("%", "%%")}"`;
}

function runtimeUnitText(executable, dataArg) {
  return [
    "[Unit]",
    "Description=Tomato Todo runtime（数据、HTTP API 与 MCP）",
    "# 数据目录：默认（XDG_DATA_HOME 未自定义）写 %h/.local/share/studio.tomato.todo，",
    "# 自定义时写解析后的绝对路径（与 scripts/install.mjs 的 xdg() 一致）。",
    "# 不加 Restart=：runtime 同时由 DSH 插件 host 经 subprocess 保活",
    "# （MIGRATION.md），两边都重启会在 127.0.0.1:43987 上冲突。",
    "",
    "[Service]",
    "Type=simple",
    `ExecStart=${systemdQuote(executable)} --serve --data ${dataArg}`,
    "",
    "[Install]",
    "WantedBy=default.target",
    "",
  ].join("\n");
}

function guardUnitText(executable, guardData) {
  return [
    "[Unit]",
    "Description=Tomato Todo guard（专注保护 / 通知 / 托盘）",
    "# 默认不 enable：API.md 规定 guard 由 runtime 监督并在崩溃时重启，本 unit",
    "# 仅为手动/应急使用保留；安装时只有 --enable-guard 才会 enable（理由见",
    "# scripts/install.mjs 头注释）。",
    "# guard 数据目录假设：runtime 把 guard 的 token 写入下面的目录。",
    `# 假设路径：${guardData}`,
    "# 注意：API.md 未指定该目录具体路径，runtime 工作流落地后需对齐。",
    "",
    "[Service]",
    "Type=simple",
    `ExecStart=${systemdQuote(executable)} --serve`,
    "",
    "[Install]",
    "WantedBy=default.target",
    "",
  ].join("\n");
}

// ---------- 安装 ----------
async function install() {
  const runtimeSource = resolve(options.get("--runtime") || DEFAULT_RUNTIME);
  const guardSource = resolve(options.get("--guard") || DEFAULT_GUARD);
  const runtimeInfo = await stat(runtimeSource).catch(() => null);
  if (!runtimeInfo?.isFile()) {
    fail(
      `Runtime binary not found: ${runtimeSource}\n` +
        "先用 scripts/build-runtime.mjs 构建 runtime 产物，或用 --runtime 指定路径",
    );
  }
  const guardInfo = await stat(guardSource).catch(() => null);
  if (!guardInfo?.isFile()) {
    fail(
      `Guard binary not found: ${guardSource}\n` +
        "在 crates/guard 下 cargo build --release，或用 --guard 指定路径",
    );
  }

  // 容器目录预检：不能被同名普通文件占据（否则后续 mkdir/写文件会莫名失败）。
  for (const dir of [
    libRoot,
    runtimeDir,
    join(libRoot, "guard"),
    join(home, ".local/bin"),
    unitDir,
  ]) {
    if (await lexists(dir)) {
      const info = await lstat(dir);
      if (!info.isDirectory()) {
        fail(`Refusing to install: ${dir} 已存在但不是目录`);
      }
    }
  }

  // vendor 是 runtime/bin 的兄弟目录；没有 vendor 产物时保留已装树（runtime
  // 依赖 engine 桩也能启动），并把现存文件继续记入 manifest。
  const sourceVendor = join(dirname(dirname(runtimeSource)), "vendor");
  const vendorExists = await lexists(sourceVendor);
  let vendorFiles = [];
  if (vendorExists) {
    const info = await lstat(sourceVendor);
    if (!info.isDirectory()) {
      fail(`Refusing to install: ${sourceVendor} 存在但不是目录`);
    }
    for (const file of await walkFiles(sourceVendor)) {
      vendorFiles.push(join(vendorDir, relative(sourceVendor, file)));
    }
  } else if (await lexists(vendorDir)) {
    vendorFiles = await walkFiles(vendorDir);
  }

  // 管理权检查：已存在的目标文件必须出现在旧 manifest 里；launcher 沿用旧
  // 惯例——必须是恰好指向本脚本目标的符号链接。
  const previous = await readManifest(manifestPath);
  if (previous === null && (await lexists(manifestPath))) {
    fail(`Refusing to replace an unmanaged file: ${manifestPath}`);
  }
  const managed = new Set((previous?.files ?? []).map((entry) => entry.path));
  const planned = [];
  for (const path of [
    runtimeBinary,
    guardBinary,
    runtimeUnit,
    guardUnit,
    ...vendorFiles,
  ]) {
    if (await lexists(path)) {
      if (!managed.has(path)) {
        fail(`Refusing to replace an unmanaged file: ${path}`);
      }
      const info = await lstat(path);
      if (!info.isFile() && !info.isSymbolicLink()) {
        fail(`Refusing to replace an unmanaged directory: ${path}`);
      }
    }
    planned.push({ path, kind: "file" });
  }
  const launchers = [
    { path: runtimeLauncher, target: runtimeBinary },
    { path: guardLauncher, target: guardBinary },
  ];
  for (const launcher of launchers) {
    if (await lexists(launcher.path)) {
      const info = await lstat(launcher.path);
      if (
        !info.isSymbolicLink() ||
        (await readlink(launcher.path)) !== launcher.target
      ) {
        fail(`Refusing to replace an unrelated launcher: ${launcher.path}`);
      }
    }
    planned.push({
      path: launcher.path,
      kind: "launcher",
      target: launcher.target,
    });
  }

  const systemctlPath = await which("systemctl");
  const systemctlArgs = [
    ["daemon-reload"],
    ["enable", "--now", RUNTIME_SERVICE],
    ...(options.get("--enable-guard")
      ? [["enable", "--now", GUARD_SERVICE]]
      : []),
  ];
  const dataArg =
    resolve(data) === resolve(join(home, ".local/share"))
      ? "%h/.local/share/studio.tomato.todo"
      : systemdQuote(join(data, "studio.tomato.todo"));
  const plan = {
    action: "install",
    home,
    runtimeSource,
    guardSource,
    runtimeBinary,
    vendorDir: vendorFiles.length ? vendorDir : null,
    vendorFiles: vendorFiles.length,
    guardBinary,
    runtimeLauncher,
    guardLauncher,
    runtimeUnit,
    guardUnit,
    runtimeDataDir,
    guardDataDir,
    enableGuard: Boolean(options.get("--enable-guard")),
    systemd: {
      available: Boolean(systemctlPath),
      commands: systemctlPath
        ? systemctlArgs.map((args) => `systemctl --user ${args.join(" ")}`)
        : [],
    },
    manifest: manifestPath,
  };
  if (options.get("--dry-run")) {
    // dry-run 到此为止：只读检查 + JSON plan，绝不落盘、绝不执行 systemctl。
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  await atomicWrite(runtimeBinary, await readFile(runtimeSource), 0o755);
  if (vendorExists) {
    await replaceTree(sourceVendor, vendorDir);
  } else {
    warn(
      `${sourceVendor} 不存在，跳过 vendor 复制` +
        "（runtime 依赖 engine 桩也能启动；已装的旧 vendor 树原样保留）",
    );
  }
  await atomicWrite(guardBinary, await readFile(guardSource), 0o755);
  await mkdir(join(home, ".local/bin"), { recursive: true });
  for (const launcher of launchers) {
    if (!(await lexists(launcher.path))) {
      await symlink(launcher.target, launcher.path);
    }
  }
  await atomicWrite(runtimeUnit, runtimeUnitText(runtimeBinary, dataArg));
  await atomicWrite(guardUnit, guardUnitText(guardBinary, guardDataDir));
  await atomicWrite(
    manifestPath,
    JSON.stringify(
      {
        format: 1,
        appId: APP_ID,
        installedAt: new Date().toISOString(),
        files: planned,
        systemd: {
          runtimeEnabled: true,
          guardEnabled: Boolean(options.get("--enable-guard")),
        },
      },
      null,
      2,
    ) + "\n",
  );

  if (systemctlPath) {
    for (const args of systemctlArgs) {
      const result = runSystemctl(args);
      if (result.status !== 0) {
        warn(
          `systemctl --user ${args.join(" ")} 失败（exit ${result.status}）：` +
            `${(result.stderr || "").trim() || "无输出"}`,
        );
      }
    }
  } else {
    warn(
      `未找到 systemctl，文件已安装但未启用自启；稍后可手动执行 ` +
        `systemctl --user enable --now ${RUNTIME_SERVICE}`,
    );
  }
  console.log(JSON.stringify(plan, null, 2));
}

// ---------- 卸载 ----------
async function uninstall() {
  const manifest = await readManifest(manifestPath);
  if (manifest === null) {
    fail(
      (await lexists(manifestPath))
        ? `Refusing to uninstall an unmanaged manifest: ${manifestPath}`
        : `Nothing to uninstall: manifest not found at ${manifestPath}`,
    );
  }
  const filePaths = [];
  const launcherEntries = [];
  for (const entry of manifest.files) {
    if (entry.kind === "launcher") launcherEntries.push(entry);
    else filePaths.push(entry.path);
  }
  const removeFiles = [];
  for (const path of filePaths) {
    if (!(await lexists(path))) continue;
    const info = await lstat(path);
    if (info.isDirectory()) warn(`跳过（已变成目录）：${path}`);
    else removeFiles.push(path);
  }
  const removeLaunchers = [];
  const skippedLaunchers = [];
  for (const entry of launcherEntries) {
    if (!(await lexists(entry.path))) continue;
    const info = await lstat(entry.path);
    if (
      info.isSymbolicLink() &&
      (await readlink(entry.path)) === entry.target
    ) {
      removeLaunchers.push(entry.path);
    } else {
      skippedLaunchers.push(entry.path);
      warn(`launcher 已被改动，跳过删除：${entry.path}`);
    }
  }

  const systemctlPath = await which("systemctl");
  const disableArgs = [
    ["disable", "--now", RUNTIME_SERVICE],
    ["disable", "--now", GUARD_SERVICE],
  ];
  const systemctlArgs = systemctlPath
    ? [...disableArgs, ["daemon-reload"]]
    : [];
  const removedPaths = [...removeFiles, ...removeLaunchers, manifestPath];
  const plan = {
    action: "uninstall",
    home,
    manifest: manifestPath,
    systemd: {
      available: Boolean(systemctlPath),
      commands: systemctlArgs.map(
        (args) => `systemctl --user ${args.join(" ")}`,
      ),
    },
    removeFiles,
    removeLaunchers,
    skippedLaunchers,
    removeEmptyDirs: options.get("--dry-run")
      ? await simulateEmptyDirs(removedPaths)
      : [],
  };
  if (options.get("--dry-run")) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  // 顺序：disable --now → 删文件 → 删 launcher → 删 manifest → 清空目录 →
  // daemon-reload（让 systemd 忘掉已删除的 unit）。
  if (systemctlPath) {
    for (const args of disableArgs) {
      const result = runSystemctl(args);
      if (result.status !== 0) {
        warn(
          `systemctl --user ${args.join(" ")} 失败（exit ${result.status}）`,
        );
      }
    }
  } else {
    warn("未找到 systemctl，跳过 disable 与 daemon-reload（文件仍会删除）");
  }
  for (const path of removeFiles) await rm(path, { force: true });
  for (const path of removeLaunchers) await rm(path, { force: true });
  await rm(manifestPath, { force: true });
  plan.removeEmptyDirs = await removeEmptyParents(removedPaths);
  if (systemctlPath) {
    const result = runSystemctl(["daemon-reload"]);
    if (result.status !== 0) {
      warn(`systemctl --user daemon-reload 失败（exit ${result.status}）`);
    }
  }
  console.log(JSON.stringify(plan, null, 2));
}

// 从被删路径向上删除随之变空的目录（止步于 home；rmdir 对非空目录抛错即停）。
async function removeEmptyParents(removedPaths) {
  const result = [];
  for (const path of removedPaths) {
    let current = dirname(path);
    while (current !== home && current !== dirname(current)) {
      try {
        await rmdir(current);
        result.push(current);
        current = dirname(current);
      } catch {
        break;
      }
    }
  }
  return result;
}

// dry-run 专用：不实际删除，推演哪些目录会随之变空（自下而上判定）。
async function simulateEmptyDirs(removedPaths) {
  const removed = new Set(removedPaths);
  const candidates = new Set();
  for (const path of removedPaths) {
    let current = dirname(path);
    while (current !== home && current !== dirname(current)) {
      candidates.add(current);
      current = dirname(current);
    }
  }
  const gone = new Set();
  const result = [];
  const ordered = [...candidates].sort(
    (a, b) => b.split(sep).length - a.split(sep).length,
  );
  for (const dir of ordered) {
    let empty = true;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const child = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!gone.has(child)) {
          empty = false;
          break;
        }
      } else if (!removed.has(child)) {
        empty = false;
        break;
      }
    }
    if (empty) {
      gone.add(dir);
      result.push(dir);
    }
  }
  return result;
}

async function main() {
  if (options.get("--uninstall")) await uninstall();
  else await install();
}

main().catch((error) => {
  console.error(`error: ${error?.message ?? error}`);
  process.exit(1);
});
