import assert from "node:assert/strict";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { mkdtemp, writeFile, readFile, readdir, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createConnection } from "node:net";

// A second compositor is essential: never exercise app blocking on the user's desktop.
const dir =
  process.env.TOMATO_NATIVE_TEST_DIR ||
  (await mkdtemp(join(tmpdir(), "tomato-native-")));
if (!process.env.TOMATO_NATIVE_PRIVATE_BUS) {
  const result = spawnSync(
    "dbus-run-session",
    ["--", process.execPath, resolve("tests/native.mjs")],
    {
      env: {
        ...process.env,
        TOMATO_NATIVE_PRIVATE_BUS: "1",
        TOMATO_NATIVE_TEST_DIR: dir,
        XDG_RUNTIME_DIR: dir,
        XDG_CONFIG_HOME: join(dir, "config"),
        XDG_DATA_HOME: join(dir, "data"),
        XDG_STATE_HOME: join(dir, "state"),
        GTK_USE_PORTAL: "0",
        GIO_USE_VFS: "local",
        NO_AT_BRIDGE: "1",
      },
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
const display = `:${180 + Math.floor(Math.random() * 500)}`;
const driverPort = 4446;
const processes = [];
let session;
let socket;
let appEnv;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
function start(command, args, env) {
  const child = spawn(command, args, {
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stdout.on("data", (data) => (logs += data));
  child.stderr.on("data", (data) => (logs += data));
  child.logs = () => logs;
  processes.push(child);
  return child;
}
async function until(fn, message, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await pause(100);
  }
  throw new Error(message);
}
async function wd(path, body, method = "POST") {
  if (process.env.TOMATO_TEST_VERBOSE)
    console.log(method, path, body?.script?.slice(0, 140) || "");
  const response = await fetch(
    `http://127.0.0.1:${driverPort}${session ? `/session/${session}` : ""}${path}`,
    {
      method,
      signal: AbortSignal.timeout(path === "/session" ? 60000 : 10000),
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(result.value));
  return result.value;
}
const js = (script) => wd("/execute/sync", { script, args: [] });
function trayLayout() {
  return JSON.parse(
    execFileSync("python3", ["tests/fixtures/tray_bus.py", "layout"], {
      env: appEnv,
      timeout: 6000,
      encoding: "utf8",
    }),
  );
}
function findTrayItem(tree, label) {
  if (tree[1]?.label?.includes(label)) return tree;
  for (const child of tree[2] ?? []) {
    const found = findTrayItem(child, label);
    if (found) return found;
  }
}
function trayClick(label) {
  const item = findTrayItem(trayLayout()[1], label);
  assert.ok(item, `Missing real tray menu item: ${label}`);
  execFileSync(
    "python3",
    ["tests/fixtures/tray_bus.py", "event", String(item[0])],
    { env: appEnv, timeout: 6000 },
  );
}
const click = (selector) =>
  js(`document.querySelector(${JSON.stringify(selector)}).click()`);
async function trustedClick(selector) {
  const element = await wd("/element", {
    using: "css selector",
    value: selector,
  });
  const id = element["element-6066-11e4-a52e-4f735466cecf"];
  await wd(`/element/${id}/click`, {});
}
const waitSelector = (selector) =>
  until(
    () => js(`return !!document.querySelector(${JSON.stringify(selector)})`),
    `Missing UI: ${selector}`,
  );
async function invoke(command, args = {}) {
  return wd("/execute/async", {
    script: `const done=arguments[arguments.length-1];window.__TAURI_INTERNALS__.invoke(${JSON.stringify(command)},${JSON.stringify(args)}).then(value=>done({value}),error=>done({error:String(error)}));`,
    args: [],
  });
}
function niri(request) {
  return new Promise((resolve, reject) => {
    const conn = createConnection(socket);
    let raw = "";
    conn.setTimeout(1500, () => conn.destroy(new Error("niri timed out")));
    conn.on("connect", () => conn.write(`${JSON.stringify(request)}\n`));
    conn.on("data", (data) => {
      raw += data;
      if (raw.includes("\n")) {
        conn.end();
        const reply = JSON.parse(raw.split("\n")[0]);
        if (reply.Err) reject(new Error(reply.Err));
        else resolve(reply.Ok);
      }
    });
    conn.on("error", reject);
  });
}
async function endProtection() {
  await click("[data-action=emergency]");
  await js(
    `const input=document.querySelector('#emergency-text');input.value='结束专注';input.dispatchEvent(new Event('input',{bubbles:true}));`,
  );
  await click("#emergency-confirm");
  await waitSelector(".sidebar");
}
try {
  const xenv = {
    ...process.env,
    DISPLAY: display,
    XDG_RUNTIME_DIR: dir,
    XDG_CONFIG_HOME: join(dir, "config"),
    XDG_DATA_HOME: join(dir, "data"),
    XDG_STATE_HOME: join(dir, "state"),
  };
  delete xenv.WAYLAND_DISPLAY;
  delete xenv.NIRI_SOCKET;
  start(
    "Xvfb",
    [display, "-screen", "0", "1440x1080x24", "-nolisten", "tcp"],
    xenv,
  );
  await pause(600);
  const config = join(dir, "niri.kdl");
  await writeFile(config, "animations { off; }\nprefer-no-csd\n");
  const compositor = start(
    "dbus-run-session",
    ["--", "niri", "-c", config],
    xenv,
  );
  socket = await until(
    async () =>
      (await readdir(dir)).find(
        (name) => name.startsWith("niri.") && name.endsWith(".sock"),
      ),
    "Nested niri did not start: " + compositor.logs(),
  );
  socket = join(dir, socket);
  const wayland = (await readdir(dir)).find((name) =>
    /^wayland-\d+$/.test(name),
  );
  const env = {
    ...xenv,
    WAYLAND_DISPLAY: wayland,
    NIRI_SOCKET: socket,
    GDK_BACKEND: "wayland",
    TOMATO_DATA_PATH: join(dir, "native.sqlite3"),
  };
  appEnv = env;
  const watcher = start(
    "python3",
    ["tests/fixtures/tray_bus.py", "watch"],
    env,
  );
  await pause(500);
  start(
    "python3",
    ["tests/fixtures/guard_window.py", "org.tomato.Allowed"],
    env,
  );
  start(
    "python3",
    ["tests/fixtures/guard_window.py", "org.tomato.Blocked"],
    env,
  );
  start(
    process.env.TAURI_DRIVER || "tauri-driver",
    ["--port", String(driverPort), "--native-port", "4447"],
    { ...env, GDK_BACKEND: "x11" },
  );
  await until(async () => {
    try {
      return (await fetch(`http://127.0.0.1:${driverPort}/status`)).ok;
    } catch {
      return false;
    }
  }, "WebDriver did not start");
  const created = await wd("/session", {
    capabilities: {
      alwaysMatch: {
        "tauri:options": {
          args: ["--background"],
          application: resolve(
            process.env.TOMATO_TEST_BINARY || "target/debug/tomato-todo",
          ),
        },
      },
    },
  });
  session = created.sessionId;
  await until(() => {
    try {
      return trayLayout();
    } catch {
      return false;
    }
  }, "Tray was not registered with the private host");
  assert.ok(
    !(await niri("Windows")).Windows.some((w) => w.app_id === "tomato-todo"),
    "Autostart should keep the window hidden when a tray is available",
  );
  trayClick("打开番茄 Todo");
  await waitSelector("[data-action=example]");
  await click("[data-action=example]");
  await until(
    () => js('return document.querySelectorAll(".task-row").length===3'),
    "Native create tasks failed",
  );
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/native-focus.png",
    Buffer.from(await wd("/screenshot", null, "GET"), "base64"),
  );
  await click("[data-page=guard]");
  await until(
    () =>
      js(
        'return !document.querySelector("[data-guard-mode=whitelist]").disabled',
      ),
    "Native niri capability missing",
  );
  const info = await invoke("guard_info");
  assert.equal(info.value.available, true);
  const windows = (await niri("Windows")).Windows;
  const own = windows.find((w) => w.title?.includes("番茄"));
  const allowed = windows.find((w) => w.app_id === "org.tomato.Allowed");
  const blocked = windows.find((w) => w.app_id === "org.tomato.Blocked");
  assert.ok(own && allowed && blocked, JSON.stringify(windows));
  assert.equal(
    own.app_id,
    "tomato-todo",
    "Window app ID must match the installed launcher",
  );
  await click('[data-add-app="org.tomato.Allowed"]');
  await until(
    () =>
      js(
        'return !!document.querySelector("[data-remove-app=\\"org.tomato.Allowed\\"]")',
      ),
    "Whitelist save failed",
  );
  await click("[data-guard-mode=whitelist]");
  await until(
    () =>
      js(
        'return document.querySelector("[data-guard-mode=whitelist]").classList.contains("selected")',
      ),
    "Whitelist not selected",
  );
  await click("[data-page=focus]");
  await js(`
    window.audioNotes = 0;
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (...args) {
      window.audioNotes++;
      window.audioState = this.state;
      return create.apply(this, args);
    };
  `);
  await trustedClick("[data-action=toggle-timer]");
  await waitSelector(".protected-clock");
  await until(
    () => js("return window.audioNotes === 2"),
    "WebKit must play one focus-start cue",
  );
  assert.equal(await js("return window.audioState"), "running");
  await pause(1100);
  assert.equal(
    await js("return window.audioNotes"),
    2,
    "Polling must not replay the start cue",
  );
  await niri({ Action: { FocusWindow: { id: allowed.id } } });
  await pause(1400);
  assert.equal(
    (await niri("FocusedWindow")).FocusedWindow.id,
    allowed.id,
    "Whitelisted app must remain usable",
  );
  await niri({ Action: { FocusWindow: { id: blocked.id } } });
  await until(
    async () => (await niri("FocusedWindow")).FocusedWindow?.id === own.id,
    "Blocked app was not redirected",
    5000,
  );
  const rejected = await invoke("dispatch", { action: { type: "pauseTimer" } });
  assert.match(rejected.error, /专注保护/);
  assert.match((await invoke("quit_app")).error, /专注保护/);
  assert.match((await invoke("hide_to_tray")).error, /专注保护/);
  assert.match(
    (
      await invoke("save_desktop_settings", {
        autostart: true,
        closeToTray: true,
      })
    ).error,
    /专注保护/,
  );
  await niri({ Action: { CloseWindow: { id: own.id } } });
  await pause(500);
  assert.ok(
    (await niri("Windows")).Windows.some((w) => w.id === own.id),
    "Protected window must refuse close",
  );
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/native-whitelist.png",
    Buffer.from(await wd("/screenshot", null, "GET"), "base64"),
  );
  await endProtection();
  await click("[data-page=guard]");
  await click("[data-guard-mode=lock]");
  await until(
    () =>
      js(
        'return document.querySelector("[data-guard-mode=lock]").classList.contains("selected")',
      ),
    "Lock not selected",
  );
  await click("[data-page=focus]");
  await click("[data-action=toggle-timer]");
  await waitSelector(".protected-clock");
  await niri({ Action: { FocusWindow: { id: allowed.id } } });
  await until(
    async () => (await niri("FocusedWindow")).FocusedWindow?.id === own.id,
    "Lock mode must also block whitelisted apps",
  );
  await until(
    async () =>
      (await invoke("plugin:window|is_fullscreen", { label: "main" })).value ===
      true,
    "Lock mode must enter fullscreen",
  );
  await writeFile(
    "artifacts/native-locked.png",
    Buffer.from(await wd("/screenshot", null, "GET"), "base64"),
  );
  await endProtection();
  await until(
    async () =>
      (await invoke("plugin:window|is_fullscreen", { label: "main" })).value ===
      false,
    "Fullscreen not released",
  );
  const final = await invoke("snapshot");
  assert.equal(final.value.data.timer.running, false);
  assert.ok(final.value.data.sessions.every((s) => !s.completed));
  await click("[data-page=guard]");
  await click("[data-guard-mode=off]");
  await until(
    () =>
      js(
        'return document.querySelector("[data-guard-mode=off]").classList.contains("selected")',
      ),
    "Protection must be off before testing ordinary close-to-tray",
  );
  await click("[data-page=settings]");
  await waitSelector("input[name=autostart]");
  await waitSelector("[data-action=export-plan]");
  await waitSelector("[data-action=import-plan]");
  // Exercise reminder focus only in this private nested desktop.
  assert.equal((await invoke("hide_to_tray")).error, undefined);
  const reminderToday = (await invoke("snapshot")).value.today;
  const reminderNow = new Date();
  const reminderTime = `${String(reminderNow.getHours()).padStart(2, "0")}:${String(reminderNow.getMinutes()).padStart(2, "0")}`;
  const reminderResult = await invoke("dispatch", {
    action: {
      type: "saveTask",
      task: {
        id: null,
        title: "隔离桌面时间提醒",
        projectId: null,
        dueDate: reminderToday,
        reminderTime,
        focusMinutes: 40,
      },
    },
  });
  assert.equal(reminderResult.error, undefined);
  const reminderTask = reminderResult.value.data.tasks.find(
    (t) => t.title === "隔离桌面时间提醒",
  );
  await until(
    async () =>
      (await invoke("plugin:window|is_visible", { label: "main" })).value ===
      true,
    "Reminder should reveal tray window",
  );
  await until(
    async () =>
      (await niri("FocusedWindow")).FocusedWindow?.app_id === "tomato-todo",
    "Reminder should focus its window",
  );
  await waitSelector("[data-start-reminder]");
  await writeFile(
    "artifacts/native-reminder.png",
    Buffer.from(await wd("/screenshot", null, "GET"), "base64"),
  );
  await click("[data-start-reminder]");
  await until(
    async () => (await invoke("snapshot")).value.data.timer.running,
    "Reminder should start with one click",
  );
  assert.equal((await invoke("snapshot")).value.data.timer.durationSecs, 2400);
  await invoke("dispatch", { action: { type: "resetTimer" } });
  await invoke("dispatch", {
    action: { type: "deleteTask", id: reminderTask.id },
  });
  await click("[data-page=settings]");
  const plan = JSON.parse(await readFile("docs/plan.example.json", "utf8"));
  const beforePlan = (await invoke("snapshot")).value.data;
  const importedPlan = await invoke("dispatch", {
    action: { type: "importPlan", plan },
  });
  assert.equal(
    importedPlan.value.data.tasks.length,
    beforePlan.tasks.length + 1,
  );
  assert.deepEqual(importedPlan.value.data.sessions, beforePlan.sessions);
  assert.deepEqual(importedPlan.value.data.settings, beforePlan.settings);
  const repeatedPlan = await invoke("dispatch", {
    action: { type: "importPlan", plan },
  });
  assert.equal(
    repeatedPlan.value.data.tasks.length,
    importedPlan.value.data.tasks.length,
  );
  await js(
    'document.querySelector("[data-action=export-plan]").scrollIntoView({block:"center"})',
  );
  await writeFile(
    "artifacts/native-plan-settings.png",
    Buffer.from(await wd("/screenshot", null, "GET"), "base64"),
  );
  // Short persisted timers exercise real strict-mode expiry without changing production limits.
  const normalSettings = structuredClone(
    (await invoke("snapshot")).value.data.settings,
  );
  for (const mode of ["lock", "whitelist"]) {
    const data = structuredClone((await invoke("snapshot")).value.data);
    data.settings.protection = {
      mode,
      strict: true,
      whitelist: ["org.tomato.Allowed"],
    };
    data.timer = {
      ...data.timer,
      mode: "focus",
      running: false,
      durationSecs: 1500,
      remainingSecs: 6,
      deadline: null,
      startedAt: null,
    };
    assert.ok(
      (await invoke("dispatch", { action: { type: "import", data } })).value,
    );
    assert.ok(
      (await invoke("dispatch", { action: { type: "startTimer" } })).value,
    );
    await waitSelector(".protected-clock");
    assert.equal(
      await js(
        'return document.querySelectorAll("[data-action=emergency]").length',
      ),
      0,
    );
    assert.match(
      (await invoke("dispatch", { action: { type: "emergencyUnlock" } })).error,
      /严格模式/,
    );
    assert.match(
      (await invoke("dispatch", { action: { type: "pauseTimer" } })).error,
      /严格模式/,
    );
    assert.match((await invoke("quit_app")).error, /保护/);
    if (mode === "whitelist") {
      await niri({ Action: { FocusWindow: { id: allowed.id } } });
      await pause(700);
      assert.equal((await niri("FocusedWindow")).FocusedWindow.id, allowed.id);
    }
    await until(
      async () => !(await invoke("snapshot")).value.data.timer.running,
      "Strict focus did not expire",
      10000,
    );
    await until(
      () => js('return !document.querySelector(".protected-clock")'),
      "Strict UI did not release",
      5000,
    );
    trayClick("打开番茄 Todo");
  }
  assert.ok(
    (
      await invoke("dispatch", {
        action: { type: "saveSettings", settings: normalSettings },
      })
    ).value,
  );
  await invoke("dispatch", { action: { type: "setMode", mode: "focus" } });
  await click("[data-page=lock]");
  await waitSelector("#quick-lock-form");
  await writeFile(
    "artifacts/native-lock-settings.png",
    Buffer.from(await wd("/screenshot", null, "GET"), "base64"),
  );
  await js(
    'document.querySelector("#quick-lock-form [name=minutes]").value="1";document.querySelector("#quick-lock-form").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));',
  );
  await waitSelector("#confirm-button");
  await click("#confirm-button");
  await waitSelector(".sleep-space");
  const sleepSnapshot = (await invoke("snapshot")).value;
  assert.equal(sleepSnapshot.data.timer.running, false);
  await writeFile(
    "artifacts/native-sleep-lock.png",
    Buffer.from(await wd("/screenshot", null, "GET"), "base64"),
  );
  await endProtection();
  assert.equal(
    (await invoke("snapshot")).value.data.sessions.length,
    sleepSnapshot.data.sessions.length,
  );
  await click("[data-page=lock]");
  await click("[data-action=new-lock]");
  await waitSelector("#lock-schedule-form");
  await js(
    'document.querySelector("#lock-schedule-form [name=enabled]").checked=false;document.querySelector("#lock-schedule-form [name=strict]").checked=true;document.querySelector("#lock-schedule-form").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));',
  );
  await until(
    async () =>
      (await invoke("snapshot")).value.data.lock.schedules.length === 1,
    "Schedule did not save",
  );
  assert.equal(
    (await invoke("snapshot")).value.data.lock.schedules[0].strict,
    true,
  );
  assert.equal(
    (await invoke("snapshot")).value.data.lock.schedules[0].enabled,
    false,
  );
  await until(
    () => js('return !!document.querySelector(".lock-schedule")'),
    "Saved schedule missing from UI",
  );
  await writeFile(
    "artifacts/native-lock-schedule.png",
    Buffer.from(await wd("/screenshot", null, "GET"), "base64"),
  );
  const scheduledStart = new Date();
  scheduledStart.setSeconds(0, 0);
  scheduledStart.setMinutes(scheduledStart.getMinutes() + 1);
  const scheduledEnd = new Date(scheduledStart.getTime() + 60000);
  const hhmm = (d) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const automatic = {
    id: "native-auto-lock",
    name: "隔离桌面定时验证",
    start: hhmm(scheduledStart),
    end: hhmm(scheduledEnd),
    days: [scheduledStart.getDay() || 7],
    enabled: true,
    strict: false,
  };
  assert.ok(
    (
      await invoke("dispatch", {
        action: { type: "saveLockSchedule", schedule: automatic },
      })
    ).value,
  );
  assert.ok((await invoke("hide_to_tray")).value === null);
  await until(
    async () => (await invoke("snapshot")).value.data.lock.active,
    "Hidden scheduled lock did not start",
    70000,
  );
  await until(
    async () =>
      (await niri("Windows")).Windows.some((w) => w.app_id === "tomato-todo"),
    "Scheduled lock did not restore tray window",
    5000,
  );
  await waitSelector(".sleep-space");
  await endProtection();
  await invoke("dispatch", {
    action: { type: "deleteLockSchedule", id: automatic.id },
  });
  await click("[data-page=settings]");
  await waitSelector("input[name=autostart]");
  await js(
    'document.querySelector("input[name=autostart]").checked=true;document.querySelector("input[name=closeToTray]").checked=true;document.querySelector("#settings-form").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));',
  );
  await until(
    async () => (await invoke("desktop_status")).value.autostart,
    "Autostart toggle did not create the entry",
  );
  const entry = join(dir, "config/autostart/studio.tomato.todo.desktop");
  assert.match(await readFile(entry, "utf8"), /--background/);
  execFileSync("desktop-file-validate", [entry]);
  await invoke("save_desktop_settings", {
    autostart: false,
    closeToTray: true,
  });
  assert.ok(
    !(await readdir(join(dir, "config/autostart"))).includes(
      "studio.tomato.todo.desktop",
    ),
  );
  assert.equal((await invoke("desktop_status")).value.trayAvailable, true);
  trayClick("开始计时");
  await until(
    async () => (await invoke("snapshot")).value.data.timer.running,
    "Real tray menu failed to start the timer",
  );
  const currentWindow = (await niri("Windows")).Windows.find(
    (w) => w.app_id === "tomato-todo",
  );
  assert.ok(
    currentWindow,
    "Main window must be visible before closing to tray",
  );
  await niri({ Action: { CloseWindow: { id: currentWindow.id } } });
  await until(
    async () =>
      !(await niri("Windows")).Windows.some((w) => w.app_id === "tomato-todo"),
    "Close should hide the window in the tray",
  );
  await pause(2100);
  const hidden = await invoke("snapshot");
  assert.equal(hidden.value.data.timer.running, true);
  assert.ok(
    hidden.value.remainingSecs < hidden.value.data.timer.durationSecs,
    "Hidden timer must continue ticking",
  );
  trayClick("打开番茄 Todo");
  await until(
    async () =>
      (await niri("Windows")).Windows.some((w) => w.app_id === "tomato-todo"),
    "Tray menu failed to restore the main window",
  );
  trayClick("暂停计时");
  await until(
    async () => !(await invoke("snapshot")).value.data.timer.running,
    "Real tray menu failed to pause the timer",
  );
  await js(
    'document.querySelector("input[name=autostart]").closest("section").scrollIntoView({block:"center"})',
  );
  await writeFile(
    "artifacts/native-desktop-settings.png",
    Buffer.from(await wd("/screenshot", null, "GET"), "base64"),
  );
  await invoke("hide_to_tray");
  const second = start(
    resolve(process.env.TOMATO_TEST_BINARY || "target/debug/tomato-todo"),
    [],
    env,
  );
  await until(
    async () =>
      (await niri("Windows")).Windows.some((w) => w.app_id === "tomato-todo"),
    "Launcher should restore the existing instance",
  );
  await until(() => second.exitCode === 0, "Secondary instance did not exit");
  const pid = (await niri("Windows")).Windows.find(
    (w) => w.app_id === "tomato-todo",
  ).pid;
  trayClick("退出番茄 Todo");
  await until(() => {
    try {
      process.kill(pid, 0);
      return false;
    } catch {
      return true;
    }
  }, "Real tray quit did not exit the application");
  try {
    await wd("", null, "DELETE");
  } catch {}
  session = undefined;
  process.kill(-watcher.pid, "SIGTERM");
  const fallback = await wd("/session", {
    capabilities: {
      alwaysMatch: {
        "tauri:options": {
          application: resolve(
            process.env.TOMATO_TEST_BINARY || "target/debug/tomato-todo",
          ),
          args: ["--background"],
        },
      },
    },
  });
  session = fallback.sessionId;
  await until(
    async () =>
      (await niri("Windows")).Windows.some((w) => w.app_id === "tomato-todo"),
    "Background launch without a tray must restore a visible window",
    20000,
  );
  assert.equal((await invoke("desktop_status")).value.trayAvailable, false);
  assert.match((await invoke("hide_to_tray")).error, /没有可用托盘/);
  console.log(
    "PASS: native WebKit, private real tray/menu, background launch, autostart toggles, close-to-tray timer, single instance, exit/fallback, whitelist, fullscreen lock and emergency recovery.",
  );
} catch (error) {
  for (const child of processes)
    console.error(child.spawnfile, child.logs().slice(-1800));
  throw error;
} finally {
  if (session) {
    try {
      await wd("", null, "DELETE");
    } catch {}
  }
  for (const child of processes.reverse()) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
    child.stdout.destroy();
    child.stderr.destroy();
    child.unref();
  }
}
