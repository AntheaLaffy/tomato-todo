import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

if (!process.argv.includes("--private")) {
  const result = spawnSync(
    "dbus-run-session",
    ["--", process.execPath, "tests/linux-desktops.mjs", "--private"],
    {
      env: { ...process.env, TOMATO_SHELL_TEST_ISOLATED: "1" },
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

// Load the extension implementation with Shell's globals supplied by the harness.
let focused;
let switched = false;
let exported = false;
const workspace = {
  activate_with_focus(w) {
    switched = true;
    focused = w;
  },
};
const windows = [1, 2, 3].map((id) => ({
  get_stable_sequence: () => id,
  get_wm_class: () => `app${id}`,
  get_title: () => `窗口${id}`,
  get_pid: () => id * 100,
  get_workspace: () => workspace,
  unminimize() {},
  activate() {
    focused = this;
  },
}));
const context = vm.createContext({
  Extension: class {},
  Gio: {
    DBus: { session: {} },
    DBusExportedObject: {
      wrapJSObject: () => ({
        export() {
          exported = true;
        },
        unexport() {
          exported = false;
        },
      }),
    },
  },
  Shell: {
    WindowTracker: { get_default: () => ({ get_window_app: () => null }) },
  },
  global: {
    get_window_actors: () => windows.map((meta_window) => ({ meta_window })),
    display: {
      get focus_window() {
        return focused;
      },
    },
    get_current_time: () => 100,
    workspace_manager: { get_active_workspace: () => ({}) },
  },
});
const extension = (
  await readFile("desktop-integrations/gnome/extension.js", "utf8")
)
  .replace(/^import .*;\n/gm, "")
  .replace("export default class", "class");
vm.runInContext(
  `${extension}\nglobalThis.extension = new TomatoGuard();`,
  context,
);
context.extension.enable();
assert.equal(exported, true);
assert.equal(JSON.parse(context.extension.ListWindows()).length, 3);
assert.equal(context.extension.FocusWindow(1), true);
assert.equal(switched, true);
assert.equal(JSON.parse(context.extension.ListWindows())[0].is_focused, true);
assert.throws(() => context.extension.FocusWindow(99), /closed/);
context.extension.disable();
assert.equal(exported, false);

const fixture = spawn("python3", ["tests/fixtures/desktop_shell.py"], {
  stdio: ["ignore", "pipe", "inherit"],
});
try {
  await new Promise((resolve, reject) => {
    fixture.stdout.on("data", (data) => {
      if (data.toString().includes("READY")) resolve();
    });
    fixture.once("error", reject);
    fixture.once("exit", (code) =>
      reject(new Error(`Shell fixture exited: ${code}`)),
    );
  });
  const test = spawn(
    "cargo",
    [
      "test",
      "--locked",
      "-p",
      "tomato-core",
      "--test",
      "guard_linux",
      "private_gnome_and_kwin_bus",
      "--",
      "--ignored",
      "--exact",
      "--nocapture",
    ],
    { stdio: "inherit" },
  );
  const [code, signal] = await once(test, "exit");
  assert.equal(signal, null);
  assert.equal(code, 0);
  console.log(
    "PASS: GNOME extension lifecycle and private GNOME/KWin D-Bus, generated KWin scripts, whitelist and confirmed focus.",
  );
} finally {
  fixture.kill();
}
