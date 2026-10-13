import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const testArgs = [
  "--ignored",
  "--exact",
  "real_win32_windows_focus_whitelist_and_failure",
  "--nocapture",
];
async function run(command, args, env, artifacts = false) {
  const child = spawn(command, args, {
    env,
    stdio: ["ignore", artifacts ? "pipe" : "inherit", "inherit"],
  });
  let executable;
  if (artifacts) {
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.on("exit", () => {
      for (const line of output.trim().split("\n")) {
        const artifact = JSON.parse(line);
        if (artifact.reason === "compiler-message")
          process.stderr.write(artifact.message.rendered || "");
        if (
          artifact.reason === "compiler-artifact" &&
          artifact.target.name === "guard_windows" &&
          artifact.executable
        )
          executable = artifact.executable;
      }
    });
  }
  const [code, signal] = await once(child, "exit");
  if (code !== 0 || signal)
    throw new Error(`${command} failed: ${code ?? signal}`);
  return executable;
}
if (process.platform === "win32") {
  // Hosted Windows runners are disposable desktops. Local desktop testing must
  // use a separate VM instead of enabling protection on the user's workstation.
  if (process.env.GITHUB_ACTIONS !== "true")
    throw new Error(
      "Run Windows native guard tests in the isolated CI runner or a dedicated VM",
    );
  await run(
    "cargo",
    [
      "test",
      "--locked",
      "-p",
      "tomato-core",
      "--test",
      "guard_windows",
      "--",
      ...testArgs,
    ],
    { ...process.env, TOMATO_WINDOWS_TEST_ISOLATED: "1" },
  );
} else if (process.platform === "linux") {
  const root = await mkdtemp(join(tmpdir(), "tomato-windows-"));
  const executable = await run(
    "cargo",
    [
      "test",
      "--locked",
      "-p",
      "tomato-core",
      "--target",
      "x86_64-pc-windows-gnu",
      "--test",
      "guard_windows",
      "--no-run",
      "--message-format=json",
    ],
    {
      ...process.env,
      CC_x86_64_pc_windows_gnu: "x86_64-w64-mingw32-gcc",
      AR_x86_64_pc_windows_gnu: "x86_64-w64-mingw32-ar",
      CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER: "x86_64-w64-mingw32-gcc",
    },
    true,
  );
  if (!executable) throw new Error("Missing Windows test executable");
  const server = spawn(
    "Xvfb",
    ["-displayfd", "1", "-screen", "0", "1280x800x24", "-nolisten", "tcp"],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  let wm;
  let wineEnv;
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
      HOME: root,
      XDG_CONFIG_HOME: join(root, "config"),
      XDG_DATA_HOME: join(root, "data"),
      XDG_STATE_HOME: join(root, "state"),
      DISPLAY: display,
      WINEPREFIX: join(root, "prefix"),
      WINEARCH: "win64",
      WINEDEBUG: "-all",
      WINEDLLOVERRIDES: "winemenubuilder.exe=d",
      TOMATO_WINDOWS_TEST_ISOLATED: "1",
    };
    wineEnv = env;
    delete env.WAYLAND_DISPLAY;
    delete env.NIRI_SOCKET;
    wm = spawn("openbox", [], { env, stdio: "inherit" });
    await run("wine", [executable, ...testArgs], env);
  } finally {
    if (wineEnv) await run("wineserver", ["-k"], wineEnv);
    wm?.kill();
    server.kill();
    await rm(root, { recursive: true, force: true });
  }
} else {
  throw new Error(
    "Windows guard testing requires a Windows CI runner or isolated Wine/Xvfb on Linux",
  );
}
