import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (!process.argv.includes("--private")) {
  const result = spawnSync(
    "dbus-run-session",
    [
      "--",
      process.execPath,
      "tests/wayland.mjs",
      "--private",
      ...process.argv.slice(2),
    ],
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
const sway = !process.argv.includes("--hyprland");
const dir = await mkdtemp(join(tmpdir(), "tomato-wayland-"));
const children = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, message) {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    const result = await check();
    if (result) return result;
    await pause(100);
  }
  throw new Error(message);
}
function start(command, args, env) {
  const child = spawn(command, args, {
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  let stdout = "";
  child.stdout.on("data", (data) => {
    logs += data;
    stdout += data;
  });
  child.stderr.on("data", (data) => (logs += data));
  child.logs = () => logs;
  child.stdoutText = () => stdout;
  child.on("error", (error) => (logs += String(error)));
  children.push(child);
  return child;
}
const env = {
  ...process.env,
  XDG_RUNTIME_DIR: dir,
  XDG_CONFIG_HOME: join(dir, "config"),
  XDG_DATA_HOME: join(dir, "data"),
  XDG_STATE_HOME: join(dir, "state"),
  XDG_CACHE_HOME: join(dir, "cache"),
  TOMATO_WAYLAND_TEST_ISOLATED: "1",
  LIBGL_ALWAYS_SOFTWARE:
    process.env.LIBGL_ALWAYS_SOFTWARE || (sway ? "1" : "0"),
  HYPRLAND_NO_CRASHREPORTER: "1",
  GTK_USE_PORTAL: "0",
  GIO_USE_VFS: "local",
  NO_AT_BRIDGE: "1",
  AQ_DRM_DEVICES: "/dev/tomato-no-drm-device",
};
for (const key of [
  "NIRI_SOCKET",
  "SWAYSOCK",
  "HYPRLAND_INSTANCE_SIGNATURE",
  "WAYLAND_DISPLAY",
  "DISPLAY",
])
  delete env[key];
try {
  if (sway) {
    const config = join(dir, "sway.conf");
    await writeFile(
      config,
      "output HEADLESS-1 resolution 1280x800\nseat seat0 fallback true\n",
    );
    start(process.env.TOMATO_SWAY_BINARY || "sway", ["-c", config], {
      ...env,
      WLR_BACKENDS: "headless",
      WLR_RENDERER: "pixman",
      WLR_LIBINPUT_NO_DEVICES: "1",
    });
    const socket = await until(
      async () =>
        (await readdir(dir)).find(
          (n) => n.startsWith("sway-ipc.") && n.endsWith(".sock"),
        ),
      "Sway IPC missing",
    );
    env.SWAYSOCK = join(dir, socket);
    env.WAYLAND_DISPLAY = await until(
      async () => (await readdir(dir)).find((n) => /^wayland-\d+$/.test(n)),
      "Sway display missing",
    );
  } else {
    const x = start(
      "Xvfb",
      ["-displayfd", "1", "-screen", "0", "1280x800x24", "-nolisten", "tcp"],
      env,
    );
    env.DISPLAY = await until(
      () => /^\d+/.exec(x.stdoutText())?.[0],
      "Xvfb failed",
    ).then((n) => `:${n}`);
    const config = join(dir, "niri.kdl");
    await writeFile(config, "animations { off; }\nprefer-no-csd\n");
    start("niri", ["-c", config], env);
    env.WAYLAND_DISPLAY = await until(
      async () => (await readdir(dir)).find((n) => /^wayland-\d+$/.test(n)),
      "Parent niri Wayland socket missing",
    );
    const hypr = join(dir, "hyprland.conf");
    await writeFile(
      hypr,
      "monitor = ,1280x800@60,auto,1\nmisc {\n disable_hyprland_logo = true\n disable_splash_rendering = true\n}\n",
    );
    start("Hyprland", ["-c", hypr], env);
    const signature = await until(async () => {
      try {
        return (await readdir(join(dir, "hypr"))).find(
          (n) => n !== ".socket.sock",
        );
      } catch {
        return false;
      }
    }, "Nested Hyprland IPC missing");
    env.HYPRLAND_INSTANCE_SIGNATURE = signature;
    // Only use a socket created by this compositor, not the parent niri socket.
    const before = await readdir(dir);
    env.WAYLAND_DISPLAY = await until(async () => {
      const sockets = (await readdir(dir)).filter((n) =>
        /^wayland-\d+$/.test(n),
      );
      return sockets.find((n) => n !== env.WAYLAND_DISPLAY);
    }, `Nested Hyprland display missing (${before})`);
  }
  env.GDK_BACKEND = "wayland";
  env.XDG_SESSION_TYPE = "wayland";
  env.XDG_CURRENT_DESKTOP = sway ? "sway" : "Hyprland";
  for (const app of ["Own", "Allowed", "Blocked"])
    start(
      "python3",
      ["tests/fixtures/guard_window.py", `org.tomato.${app}`],
      env,
    );
  await pause(2000);
  const test = start(
    "cargo",
    [
      "test",
      "--locked",
      "-p",
      "tomato-core",
      "--test",
      "guard_linux",
      "real_wayland_compositor",
      "--",
      "--ignored",
      "--exact",
      "--nocapture",
    ],
    env,
  );
  const [code, signal] = await once(test, "exit");
  console.log(test.logs());
  assert.equal(signal, null);
  assert.equal(code, 0);
  console.log(
    `PASS: isolated ${sway ? "Sway" : "Hyprland"} real native windows, PID, whitelist and confirmed focus.`,
  );
} catch (error) {
  for (const child of children)
    console.error(child.spawnfile, child.logs().slice(-5000));
  throw error;
} finally {
  for (const child of children.reverse()) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
    child.stdout.destroy();
    child.stderr.destroy();
  }
}
