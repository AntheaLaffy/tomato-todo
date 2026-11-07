import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, readdir, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";

// Never inherit the user's compositor socket, even when this test is run from niri.
const dir = await mkdtemp(join(tmpdir(), "tomato-niri-"));
await chmod(dir, 0o700);
const env = { ...process.env, XDG_RUNTIME_DIR: dir, GDK_BACKEND: "wayland", GTK_USE_PORTAL: "0" };
for (const key of ["NIRI_SOCKET", "WAYLAND_DISPLAY", "SWAYSOCK", "HYPRLAND_INSTANCE_SIGNATURE"]) delete env[key];
const children = [];
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
function start(bin, args) {
  const child = spawn(bin, args, { env, stdio: ["ignore", "pipe", "pipe"], detached: true });
  child.output = "";
  child.stdout.on("data", (data) => { child.output += data; });
  child.stderr.on("data", (data) => { child.output += data; });
  children.push(child);
  return child;
}
async function until(fn, message) {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await pause(100);
  }
  throw new Error(message);
}
const msg = (...args) => {
  const raw = execFileSync("niri", ["msg", "--json", ...args], { env, encoding: "utf8" });
  return raw.trim() ? JSON.parse(raw) : null;
};
const fixture = `
import gi, sys, json
gi.require_version("Gtk", "3.0")
from gi.repository import Gtk, Gdk, GLib
GLib.set_prgname(sys.argv[1])
w = Gtk.Window(title=sys.argv[2])
w.set_default_size(600, 400)
w.add(Gtk.Label(label=sys.argv[2]))
def changed(w, e):
    print(json.dumps({"fullscreen": bool(e.new_window_state & Gdk.WindowState.FULLSCREEN)}), flush=True)
w.connect("window-state-event", changed)
w.show_all()
Gtk.main()
`;
let base;
async function command(body) {
  const res = await fetch(base + "/guard", {
    method: "POST", headers: { Authorization: "Bearer isolated", "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(5000),
  });
  const result = await res.json();
  assert.equal(res.status, 200, JSON.stringify(result));
  return result;
}
const focused = (id) => until(() => msg("windows").some((w) => w.id === id && w.is_focused), "Expected focus was not confirmed");
const fullscreen = (child) => {
  const states = child.output.split("\n").filter((line) => line.startsWith('{"fullscreen":')).map(JSON.parse);
  return states.at(-1)?.fullscreen;
};
try {
  const x = start("Xvfb", ["-displayfd", "1", "-screen", "0", "1280x800x24", "-nolisten", "tcp"]);
  env.DISPLAY = ":" + await until(() => /^\d+$/m.exec(x.output)?.[0], "Xvfb did not start");
  const config = join(dir, "niri.kdl");
  await writeFile(config, "animations { off; }\nprefer-no-csd\n");
  start("niri", ["-c", config]);
  env.NIRI_SOCKET = join(dir, await until(async () => (await readdir(dir)).find((p) => /^niri.*\.sock$/.test(p)), "Nested niri IPC missing"));
  env.WAYLAND_DISPLAY = await until(async () => (await readdir(dir)).find((p) => /^wayland-\d+$/.test(p)), "Nested Wayland socket missing");
  assert.notEqual(env.NIRI_SOCKET, process.env.NIRI_SOCKET);
  const dsh = start("python3", ["-c", fixture, "dsh-desktop", "DeepSeek Harness"]);
  start("python3", ["-c", fixture, "org.tomato.Allowed", "Allowed"]);
  start("python3", ["-c", fixture, "org.tomato.Blocked", "Blocked"]);
  const windows = await until(() => { const list = msg("windows"); return list.length === 3 && list; }, "Fixture windows missing");
  const own = windows.find((w) => w.app_id === "dsh-desktop");
  const allowed = windows.find((w) => w.app_id === "org.tomato.Allowed");
  const blocked = windows.find((w) => w.app_id === "org.tomato.Blocked");
  assert.ok(own && allowed && blocked);
  await writeFile(join(dir, "token"), "isolated\n", { mode: 0o600 });
  const guard = start(resolve(process.env.TOMATO_GUARD_BIN || "crates/guard/target/debug/tomato-guard"), ["--serve", "--data", dir, "--port", "0"]);
  const port = await until(() => /http:\/\/127\.0\.0\.1:(\d+)/.exec(guard.output)?.[1], "Guard did not start");
  // Use the OS-assigned port from its startup line.
  assert.notEqual(port, "0", "guard must report its actual bound port");
  base = `http://127.0.0.1:${port}`;
  const appsResponse = await fetch(base + "/guard/apps", {
    headers: { Authorization: "Bearer isolated" },
  });
  assert.equal(appsResponse.status, 200);
  assert.deepEqual((await appsResponse.json()).apps,
    ["dsh-desktop", "org.tomato.Allowed", "org.tomato.Blocked"]);
  await command({ command: "fullscreen", enabled: true });
  await until(() => fullscreen(dsh) === true, "DSH did not enter fullscreen");
  await command({ command: "fullscreen", enabled: true });
  await pause(150);
  assert.equal(fullscreen(dsh), true, "Repeated entry must not toggle fullscreen off");
  await command({ command: "fullscreen", enabled: false });
  await until(() => fullscreen(dsh) === false, "DSH did not leave fullscreen");
  await command({ command: "lock", whitelist: [allowed.app_id] });
  await focused(own.id);
  msg("action", "focus-window", "--id", String(allowed.id));
  await focused(allowed.id);
  await pause(1400);
  assert.equal(msg("windows").find((w) => w.id === allowed.id).is_focused, true);
  msg("action", "focus-window", "--id", String(blocked.id));
  await focused(own.id);
  await command({ command: "lock", whitelist: [] });
  msg("action", "focus-window", "--id", String(allowed.id));
  await focused(own.id);
  assert.equal(msg("windows").length, 3, "Protection must use DSH, without creating a blank lock window");
  await command({ command: "fullscreen", enabled: false });
  assert.equal(fullscreen(dsh), true, "Closing immersion cannot bypass lock fullscreen");
  await command({ command: "unlock" });
  await until(() => fullscreen(dsh) === false, "Unlock did not release fullscreen");
  msg("action", "focus-window", "--id", String(blocked.id));
  const result = await command({ command: "focus" });
  assert.equal(result.focused, true);
  await focused(own.id);
  console.log("PASS: isolated niri running apps, fullscreen, whitelist, lock without whitelist, release and DSH focus");
} catch (error) {
  for (const child of children) console.error(child.spawnfile, child.output.slice(-3000));
  throw error;
} finally {
  for (const child of children.reverse()) {
    if (child.exitCode !== null) continue;
    const exited = once(child, "exit");
    try { process.kill(-child.pid, "SIGTERM"); } catch {}
    await exited;
  }
}
