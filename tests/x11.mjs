import { spawn } from "node:child_process";
import { once } from "node:events";

// Allocate a fresh X server. Never exercise protection on the user's DISPLAY.
const server = spawn(
  "Xvfb",
  ["-displayfd", "1", "-screen", "0", "1280x800x24", "-nolisten", "tcp"],
  { stdio: ["ignore", "pipe", "inherit"] },
);
let wm;
let test;
const terminate = () => {
  test?.kill();
  wm?.kill();
  server.kill();
};
process.on("SIGINT", terminate);
process.on("SIGTERM", terminate);
try {
  const display = await new Promise((resolve, reject) => {
    let output = "";
    server.stdout.on("data", (chunk) => {
      output += chunk;
      if (output.includes("\n")) resolve(`:${output.trim()}`);
    });
    server.once("error", reject);
    server.once("exit", (code) =>
      reject(new Error(`Xvfb exited before startup: ${code}`)),
    );
  });
  const env = {
    ...process.env,
    DISPLAY: display,
    XDG_SESSION_TYPE: "x11",
    XDG_CURRENT_DESKTOP: "",
    TOMATO_X11_TEST_ISOLATED: "1",
  };
  delete env.NIRI_SOCKET;
  delete env.SWAYSOCK;
  delete env.HYPRLAND_INSTANCE_SIGNATURE;
  delete env.WAYLAND_DISPLAY;
  wm = spawn("openbox", [], { env, stdio: "inherit" });
  wm.on("error", (error) => {
    console.error(error);
    terminate();
  });
  async function run(name, environment) {
    test = spawn(
      "cargo",
      [
        "test",
        "--locked",
        "-p",
        "tomato-core",
        "--test",
        "guard_x11",
        "--",
        "--ignored",
        "--exact",
        name,
        "--nocapture",
      ],
      { env: environment, stdio: "inherit" },
    );
    const [code, signal] = await once(test, "exit");
    if (code !== 0 || signal)
      throw new Error(`X11 native test failed: ${code ?? signal}`);
  }
  await run("real_ewmh_windows_focus_whitelist_and_failure", env);
  await run("xwayland_does_not_report_complete_desktop_protection", {
    ...env,
    XDG_SESSION_TYPE: "wayland",
  });
  await run("xwayland_does_not_report_complete_desktop_protection", {
    ...env,
    WAYLAND_DISPLAY: "tomato-isolated-wayland",
  });
  if (process.argv.includes("--app")) {
    test = spawn(process.execPath, ["tests/x11-app.mjs"], {
      env: { ...env, TOMATO_X11_WM_PID: String(wm.pid) },
      stdio: "inherit",
    });
    const [code, signal] = await once(test, "exit");
    if (code !== 0 || signal)
      throw new Error(`X11 application test failed: ${code ?? signal}`);
  }
} finally {
  terminate();
}
