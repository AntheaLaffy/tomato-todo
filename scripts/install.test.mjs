// scripts/install.mjs 的自测（node --test scripts/install.test.mjs）。
//
// 原则：绝不触碰真实 ~/.local/lib/tomato、真实 ~/.config/systemd 与真实
// systemd。全部用例在 os.tmpdir() 的临时 --home 里跑；systemd 交互用 PATH
// 前置的假 systemctl（把每次调用的 argv 记进日志的 shell 脚本）拦截。安装
// 脚本通过 process.execPath 直接拉起，测试只断言：
// - --dry-run 的 JSON plan 与零副作用；
// - 真实安装的布局、0755/0644 权限、manifest 全量路径与 unit 内容；
// - systemctl 调用序列（daemon-reload + enable --now runtime，不 enable
//   guard；--enable-guard 时追加）；
// - --uninstall 的清理与 disable --now + daemon-reload 顺序；
// - 拒绝覆盖非 manifest 管理的文件 / 无关 launcher；
// - 没有 systemctl 时只装文件并警告。
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { after, test } from "node:test";

const SCRIPT = resolve(import.meta.dirname, "install.mjs");
const RUNTIME_STUB = "#!/bin/sh\necho runtime-stub\n";
const GUARD_STUB = "#!/bin/sh\necho guard-stub\n";
const CORE_STUB = "export const core = 1;\n";
const DEEP_STUB = "export const deep = true;\n";

const fixtures = [];
after(async () => {
  for (const root of fixtures) await rm(root, { recursive: true, force: true });
});

async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

// 隔离安装现场：临时 --home、假 runtime/bin + vendor 树与 guard 二进制、
// PATH 前置的假 systemctl（argv 逐行记入 $TOMATO_SYSTEMCTL_LOG）。
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "tomato-install-"));
  fixtures.push(root);
  const home = join(root, "home");
  await mkdir(home, { recursive: true });
  const src = join(root, "src");
  const runtimeBin = join(src, "runtime/bin/tomato-runtime");
  await mkdir(join(src, "runtime/bin"), { recursive: true });
  await writeFile(runtimeBin, RUNTIME_STUB);
  await chmod(runtimeBin, 0o755);
  await mkdir(join(src, "runtime/vendor/nested"), { recursive: true });
  await writeFile(join(src, "runtime/vendor/core.mjs"), CORE_STUB);
  await writeFile(join(src, "runtime/vendor/nested/deep.mjs"), DEEP_STUB);
  const guardBin = join(src, "target/release/tomato-guard");
  await mkdir(join(src, "target/release"), { recursive: true });
  await writeFile(guardBin, GUARD_STUB);
  await chmod(guardBin, 0o755);
  const fakeBin = join(root, "fakebin");
  await mkdir(fakeBin);
  const systemctl = join(fakeBin, "systemctl");
  await writeFile(
    systemctl,
    '#!/bin/sh\nprintf \'%s\\n\' "$*" >> "$TOMATO_SYSTEMCTL_LOG"\n',
  );
  await chmod(systemctl, 0o755);
  const log = join(root, "systemctl.log");
  return { root, home, runtimeBin, guardBin, fakeBin, log };
}

function run(f, args, { withoutSystemctl = false } = {}) {
  const { XDG_DATA_HOME, XDG_CONFIG_HOME, XDG_STATE_HOME, HOME, ...clean } =
    process.env;
  const path = [clean.PATH].filter(Boolean).join(delimiter);
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: "utf8",
    env: {
      ...clean,
      HOME: f.home,
      // 假 systemctl 优先；withoutSystemctl 时 PATH 里干脆没有 systemctl。
      PATH: withoutSystemctl ? f.root : `${f.fakeBin}${delimiter}${path}`,
      TOMATO_SYSTEMCTL_LOG: f.log,
    },
  });
}

const installArgs = (f) => [
  "--runtime",
  f.runtimeBin,
  "--guard",
  f.guardBin,
  "--home",
  f.home,
];

const calls = async (f) => (await readFile(f.log, "utf8")).trim().split("\n");

test("--dry-run 打印 plan JSON 且零副作用", async () => {
  const f = await fixture();
  const result = run(f, [...installArgs(f), "--dry-run"]);
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.action, "install");
  assert.equal(plan.home, f.home);
  assert.equal(
    plan.runtimeBinary,
    join(f.home, ".local/lib/tomato/runtime/bin/tomato-runtime"),
  );
  assert.equal(
    plan.guardBinary,
    join(f.home, ".local/lib/tomato/guard/tomato-guard"),
  );
  assert.equal(plan.vendorFiles, 2);
  assert.deepEqual(plan.systemd.commands, [
    "systemctl --user daemon-reload",
    "systemctl --user enable --now tomato-runtime.service",
  ]);
  assert.equal(plan.systemd.available, true);
  assert.equal(plan.enableGuard, false);
  // 零副作用：home 里什么都没写，假 systemctl 一次都没被调用（日志不存在）。
  assert.equal(await exists(join(f.home, ".local")), false);
  assert.equal(await exists(f.log), false);
});

test("安装：布局、权限、manifest 全量路径、unit 内容与 systemctl 序列", async () => {
  const f = await fixture();
  const result = run(f, installArgs(f));
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.action, "install");

  const runtimeBinary = join(
    f.home,
    ".local/lib/tomato/runtime/bin/tomato-runtime",
  );
  const guardBinary = join(f.home, ".local/lib/tomato/guard/tomato-guard");
  const runtimeUnit = join(
    f.home,
    ".config/systemd/user/tomato-runtime.service",
  );
  const guardUnit = join(f.home, ".config/systemd/user/tomato-guard.service");
  const manifestPath = join(f.home, ".local/lib/tomato/install-manifest.json");

  // 二进制内容与 0755 权限
  assert.equal((await stat(runtimeBinary)).mode & 0o777, 0o755);
  assert.equal(await readFile(runtimeBinary, "utf8"), RUNTIME_STUB);
  assert.equal((await stat(guardBinary)).mode & 0o777, 0o755);
  assert.equal(await readFile(guardBinary, "utf8"), GUARD_STUB);
  // vendor 树保持相对结构（bin 的兄弟目录）
  assert.equal(
    await readFile(
      join(f.home, ".local/lib/tomato/runtime/vendor/core.mjs"),
      "utf8",
    ),
    CORE_STUB,
  );
  assert.equal(
    await readFile(
      join(f.home, ".local/lib/tomato/runtime/vendor/nested/deep.mjs"),
      "utf8",
    ),
    DEEP_STUB,
  );
  // launcher 符号链接指向已装目标
  for (const [name, target] of [
    ["tomato-runtime", runtimeBinary],
    ["tomato-guard", guardBinary],
  ]) {
    const launcher = join(f.home, ".local/bin", name);
    assert.equal((await lstat(launcher)).isSymbolicLink(), true);
    assert.equal(await readlink(launcher), target);
  }
  // unit 内容与 0644 权限
  assert.equal((await stat(runtimeUnit)).mode & 0o777, 0o644);
  const runtimeText = await readFile(runtimeUnit, "utf8");
  assert.ok(
    runtimeText.includes(
      `ExecStart=${runtimeBinary} --serve --data %h/.local/share/studio.tomato.todo`,
    ),
    runtimeText,
  );
  assert.ok(runtimeText.includes("WantedBy=default.target"));
  const guardText = await readFile(guardUnit, "utf8");
  assert.ok(guardText.includes(`ExecStart=${guardBinary} --serve`), guardText);
  // manifest 记录全部已装路径
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(manifest.appId, "studio.tomato.todo");
  const paths = manifest.files.map((entry) => entry.path);
  for (const expected of [
    runtimeBinary,
    join(f.home, ".local/lib/tomato/runtime/vendor/core.mjs"),
    join(f.home, ".local/lib/tomato/runtime/vendor/nested/deep.mjs"),
    guardBinary,
    join(f.home, ".local/bin/tomato-runtime"),
    join(f.home, ".local/bin/tomato-guard"),
    runtimeUnit,
    guardUnit,
  ]) {
    assert.ok(paths.includes(expected), `manifest 缺少 ${expected}`);
  }
  assert.equal(
    manifest.files.filter((entry) => entry.kind === "launcher").length,
    2,
  );
  assert.equal(manifest.systemd.guardEnabled, false);
  // systemctl 序列：daemon-reload + enable --now runtime，不碰 guard
  assert.deepEqual(await calls(f), [
    "--user daemon-reload",
    "--user enable --now tomato-runtime.service",
  ]);
});

test("--enable-guard 追加 enable guard unit", async () => {
  const f = await fixture();
  const result = run(f, [...installArgs(f), "--enable-guard"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await calls(f), [
    "--user daemon-reload",
    "--user enable --now tomato-runtime.service",
    "--user enable --now tomato-guard.service",
  ]);
  const plan = JSON.parse(result.stdout);
  assert.ok(
    plan.systemd.commands.includes(
      "systemctl --user enable --now tomato-guard.service",
    ),
  );
  const manifest = JSON.parse(
    await readFile(
      join(f.home, ".local/lib/tomato/install-manifest.json"),
      "utf8",
    ),
  );
  assert.equal(manifest.systemd.guardEnabled, true);
});

test("重复安装幂等：manifest 内的文件允许覆盖", async () => {
  const f = await fixture();
  const args = installArgs(f);
  assert.equal(run(f, args).status, 0);
  const second = run(f, args);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(
    (await stat(join(f.home, ".local/lib/tomato/runtime/bin/tomato-runtime")))
      .mode & 0o777,
    0o755,
  );
});

test("--uninstall：disable --now + 删文件/launcher/空目录/manifest + daemon-reload", async () => {
  const f = await fixture();
  assert.equal(run(f, installArgs(f)).status, 0);
  const result = run(f, ["--uninstall", "--home", f.home]);
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.action, "uninstall");
  // 文件全部删除，随之变空的目录一路清到 home（home 本身保留）
  assert.equal(await exists(join(f.home, ".local/lib/tomato")), false);
  assert.equal(await exists(join(f.home, ".local/bin/tomato-runtime")), false);
  assert.equal(await exists(join(f.home, ".local/bin/tomato-guard")), false);
  assert.equal(await exists(join(f.home, ".config/systemd")), false);
  assert.equal(await exists(join(f.home, ".local")), false);
  assert.equal(await exists(f.home), true);
  // systemctl：前两次是安装，后三次是 disable × 2 + daemon-reload 收尾
  const log = await calls(f);
  assert.equal(log.length, 5);
  assert.deepEqual(log.slice(2, 4), [
    "--user disable --now tomato-runtime.service",
    "--user disable --now tomato-guard.service",
  ]);
  assert.equal(log[4], "--user daemon-reload");
  // 再次 uninstall：manifest 缺失必须报错
  const again = run(f, ["--uninstall", "--home", f.home]);
  assert.notEqual(again.status, 0);
  assert.ok(again.stderr.includes("manifest"), again.stderr);
});

test("--uninstall 在 manifest 缺失时报错", async () => {
  const f = await fixture();
  const result = run(f, ["--uninstall", "--home", f.home]);
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes("manifest"), result.stderr);
});

test("拒绝覆盖非 manifest 管理的文件与无关 launcher", async () => {
  // 1) 预置非管理的 runtime 二进制
  const f1 = await fixture();
  const clashBinary = join(
    f1.home,
    ".local/lib/tomato/runtime/bin/tomato-runtime",
  );
  await mkdir(join(f1.home, ".local/lib/tomato/runtime/bin"), {
    recursive: true,
  });
  await writeFile(clashBinary, "user data");
  let result = run(f1, installArgs(f1));
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes("unmanaged"), result.stderr);

  // 2) 预置指向别处的 launcher 符号链接
  const f2 = await fixture();
  await mkdir(join(f2.home, ".local/bin"), { recursive: true });
  await symlink("/etc/hostname", join(f2.home, ".local/bin/tomato-runtime"));
  result = run(f2, installArgs(f2));
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes("launcher"), result.stderr);

  // 3) 预置同名普通文件 launcher
  const f3 = await fixture();
  await mkdir(join(f3.home, ".local/bin"), { recursive: true });
  await writeFile(join(f3.home, ".local/bin/tomato-guard"), "user script");
  result = run(f3, installArgs(f3));
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes("launcher"), result.stderr);

  // 4) 预置非管理的 unit 文件
  const f4 = await fixture();
  await mkdir(join(f4.home, ".config/systemd/user"), { recursive: true });
  await writeFile(
    join(f4.home, ".config/systemd/user/tomato-runtime.service"),
    "[Unit]\n",
  );
  result = run(f4, installArgs(f4));
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes("unmanaged"), result.stderr);
});

test("systemd 不可用时只装文件并警告，不调用 systemctl", async () => {
  const f = await fixture();
  const result = run(f, installArgs(f), { withoutSystemctl: true });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stderr.includes("systemctl"), result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.systemd.available, false);
  assert.deepEqual(plan.systemd.commands, []);
  assert.equal(
    await exists(join(f.home, ".local/lib/tomato/runtime/bin/tomato-runtime")),
    true,
  );
  assert.equal(
    await exists(join(f.home, ".config/systemd/user/tomato-runtime.service")),
    true,
  );
  // 假 systemctl 日志不存在（从未被调用）
  assert.equal(await exists(f.log), false);
});
