import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, mkdir, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

assert.equal(
  process.env.TOMATO_X11_TEST_ISOLATED,
  "1",
  "Run through tests/x11.mjs --app on an isolated display",
);
if (!process.env.TOMATO_X11_PRIVATE_BUS) {
  const root = await mkdtemp(join(tmpdir(), "tomato-x11-app-"));
  for (const name of ["config", "data", "state", "runtime"])
    await mkdir(join(root, name), { mode: 0o700 });
  const child = spawn(
    "dbus-run-session",
    ["--", process.execPath, resolve("tests/x11-app.mjs")],
    {
      env: {
        ...process.env,
        TOMATO_X11_PRIVATE_BUS: "1",
        TOMATO_X11_TEST_DIR: root,
        HOME: root,
        XDG_CONFIG_HOME: join(root, "config"),
        XDG_DATA_HOME: join(root, "data"),
        XDG_STATE_HOME: join(root, "state"),
        XDG_RUNTIME_DIR: join(root, "runtime"),
        TOMATO_DATA_PATH: join(root, "data.sqlite3"),
        GDK_BACKEND: "x11",
        GTK_USE_PORTAL: "0",
        GIO_USE_VFS: "local",
        NO_AT_BRIDGE: "1",
      },
      stdio: "inherit",
    },
  );
  const [code] = await once(child, "exit");
  process.exit(code ?? 1);
}

const root = process.env.TOMATO_X11_TEST_DIR;
const application = join(root, "tomato-todo");
await copyFile(resolve("target/debug/tomato-todo"), application);
const children = [];
let session;
async function freePort() {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}
const port = await freePort();
const nativePort = await freePort();
function start(command, args) {
  const child = spawn(command, args, {
    env: process.env,
    detached: true,
    stdio: "pipe",
  });
  let logs = "";
  child.stdout.on("data", (data) => (logs += data));
  child.stderr.on("data", (data) => (logs += data));
  child.logs = () => logs;
  children.push(child);
  return child;
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(condition, message) {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    if (await condition()) return;
    await pause(100);
  }
  throw new Error(message);
}
async function wd(path, body, method = "POST") {
  const response = await fetch(
    `http://127.0.0.1:${port}${session ? `/session/${session}` : ""}${path}`,
    {
      method,
      signal: AbortSignal.timeout(path === "/session" ? 60000 : 10000),
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  const result = await response.json();
  assert.ok(response.ok, JSON.stringify(result));
  return result.value;
}
async function invoke(command, args = {}) {
  const result = await wd("/execute/async", {
    script: `const done=arguments[arguments.length-1];window.__TAURI_INTERNALS__.invoke(${JSON.stringify(command)},${JSON.stringify(args)}).then(value=>done({value}),error=>done({error:String(error)}));`,
    args: [],
  });
  assert.ok(!result.error, result.error);
  return result.value;
}
function activate(id) {
  execFileSync("xdotool", ["windowactivate", String(id)], { env: process.env });
}
const stop = () => {
  for (const child of children) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
  }
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
try {
  start("python3", ["tests/fixtures/guard_window.py", "org.tomato.X11Allowed"]);
  start("python3", ["tests/fixtures/guard_window.py", "org.tomato.X11Blocked"]);
  const driver = start(process.env.TAURI_DRIVER || "tauri-driver", [
    "--port",
    String(port),
    "--native-port",
    String(nativePort),
  ]);
  await until(async () => {
    try {
      return (await fetch(`http://127.0.0.1:${port}/status`)).ok;
    } catch {
      return false;
    }
  }, "WebDriver did not start");
  assert.equal(driver.exitCode, null, driver.logs());
  const created = await wd("/session", {
    capabilities: { alwaysMatch: { "tauri:options": { application } } },
  });
  session = created.sessionId;
  await until(
    () =>
      wd("/execute/sync", {
        script:
          "return !!window.__TAURI_INTERNALS__ && !!document.querySelector('.sidebar')",
        args: [],
      }),
    "X11 application did not render",
  );
  let windows;
  await until(async () => {
    windows = (await invoke("guard_info")).windows;
    return (
      windows.some((w) => w.title === "org.tomato.X11Allowed") &&
      windows.some((w) => w.title === "org.tomato.X11Blocked")
    );
  }, "Fixture windows missing");
  const info = await invoke("guard_info");
  assert.equal(info.backend, "EWMH / X11");
  assert.equal(info.available, true);
  const own = windows.find((w) => w.title?.includes("番茄"));
  const allowed = windows.find((w) => w.title === "org.tomato.X11Allowed");
  const blocked = windows.find((w) => w.title === "org.tomato.X11Blocked");
  assert.ok(own?.pid && allowed?.app_id && blocked?.app_id);
  assert.notEqual(
    allowed.app_id,
    blocked.app_id,
    JSON.stringify({ own, allowed, blocked }),
  );
  const snapshot = await invoke("snapshot");
  const settings = {
    ...snapshot.data.settings,
    notifications: false,
    sound: false,
    protection: {
      mode: "whitelist",
      whitelist: [allowed.app_id],
      strict: false,
    },
  };
  await invoke("dispatch", { action: { type: "saveSettings", settings } });
  await invoke("dispatch", { action: { type: "startTimer" } });
  await pause(1400);
  activate(allowed.id);
  await until(
    async () =>
      (await invoke("guard_info")).windows.some(
        (w) => w.id === allowed.id && w.is_focused,
      ),
    "Allowed X11 app did not focus",
  );
  await pause(900);
  assert.ok(
    (await invoke("guard_info")).windows.some(
      (w) => w.id === allowed.id && w.is_focused,
    ),
    "Whitelist app was pulled back",
  );
  activate(blocked.id);
  await until(
    async () =>
      (await invoke("guard_info")).windows.some(
        (w) => w.id === own.id && w.is_focused,
      ),
    "Blocked X11 app was not pulled back",
  );
  assert.ok((await invoke("snapshot")).data.timer.running);
  await invoke("dispatch", { action: { type: "emergencyUnlock" } });
  await invoke("dispatch", {
    action: { type: "startQuickLock", minutes: 1, strict: false },
  });
  await until(
    () =>
      wd("/execute/sync", {
        script: "return !!document.querySelector('.sleep-space')",
        args: [],
      }),
    "X11 quick-lock UI missing",
  );
  await until(
    () =>
      execFileSync("xprop", ["-id", String(own.id), "_NET_WM_STATE"], {
        env: process.env,
        encoding: "utf8",
      }).includes("_NET_WM_STATE_FULLSCREEN"),
    "X11 lock did not enter native fullscreen",
  );
  activate(allowed.id);
  await until(
    async () =>
      (await invoke("guard_info")).windows.some(
        (w) => w.id === own.id && w.is_focused,
      ),
    "X11 lock did not ignore whitelist",
  );
  await invoke("dispatch", { action: { type: "emergencyUnlock" } });
  assert.equal((await invoke("snapshot")).data.lock.active, null);
  await invoke("dispatch", {
    action: { type: "startQuickLock", minutes: 1, strict: true },
  });
  await pause(1400);
  process.kill(Number(process.env.TOMATO_X11_WM_PID), "SIGTERM");
  await until(
    async () => (await invoke("snapshot")).data.lock.active === null,
    "Lost X11 window manager did not release strict protection",
  );
  assert.equal((await invoke("guard_info")).available, false);
  console.log(
    "PASS: native X11 Tauri/WebKit, own PID discovery, whitelist, blocked-app refocus, quick lock, emergency recovery and lost-WM strict release",
  );
  assert.equal(driver.exitCode, null);
} catch (error) {
  for (const child of children) console.error(child.logs());
  throw error;
} finally {
  if (session) {
    try {
      await wd("", null, "DELETE");
    } catch {}
  }
  stop();
}
