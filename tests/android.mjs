import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";

const sdk = process.env.ANDROID_HOME;
if (!sdk) throw new Error("Set ANDROID_HOME to the Android SDK directory");
// AVD system/userdata images need several GB. /tmp is often a small tmpfs;
// use the project's ignored artifact directory and still delete each run.
await mkdir("artifacts", { recursive: true });
const root = await mkdtemp(join(process.cwd(), "artifacts", "android-"));
const env = {
  ...process.env,
  ANDROID_AVD_HOME: join(root, ".android", "avd"),
  ANDROID_USER_HOME: join(root, ".android"),
  // Older SDK command-line tools use SDK_HOME for user metadata; the emulator
  // and current tools use AVD_HOME / USER_HOME. Keep all three inside the test.
  ANDROID_SDK_HOME: root,
};
async function run(command, args, input, quiet = false) {
  const child = spawn(command, args, {
    env,
    stdio: ["pipe", "pipe", quiet ? "ignore" : "inherit"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stdin.end(input);
  const [code, signal] = await once(child, "exit");
  if (code !== 0 || signal)
    throw new Error(`${command} failed: ${code ?? signal}`);
  return output;
}
async function freePort(port) {
  const server = createServer();
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", resolve);
    });
    return true;
  } catch {
    return false;
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
  }
}
let emulator;
let emulatorLog;
try {
  await run(
    join(sdk, "cmdline-tools", "latest", "bin", "avdmanager"),
    [
      "create",
      "avd",
      "--name",
      "TomatoTest",
      "--package",
      "system-images;android-33;google_apis;x86_64",
      "--device",
      "pixel_5",
      "--path",
      join(root, "device.avd"),
    ],
    "no\n",
  );
  // A standard 360 CSS-pixel phone viewport avoids rendering a 1080p device
  // through the software GPU while exercising the narrow mobile layout.
  const configPath = join(root, "device.avd", "config.ini");
  let config = await readFile(configPath, "utf8");
  for (const [key, value] of Object.entries({
    "hw.lcd.width": "720",
    "hw.lcd.height": "1440",
    "hw.lcd.density": "320",
  })) {
    const pattern = new RegExp(`^${key.replaceAll(".", "\\.")}=.*$`, "m");
    config = pattern.test(config)
      ? config.replace(pattern, `${key}=${value}`)
      : `${config}\n${key}=${value}\n`;
  }
  await writeFile(configPath, config);
  let port;
  for (let candidate = 5584; candidate >= 5554; candidate -= 2) {
    if ((await freePort(candidate)) && (await freePort(candidate + 1))) {
      port = candidate;
      break;
    }
  }
  if (!port) throw new Error("No free Android emulator console/ADB ports");
  const serial = `emulator-${port}`;
  emulatorLog = createWriteStream(join(root, "emulator.log"));
  emulator = spawn(
    join(sdk, "emulator", "emulator"),
    [
      "-avd",
      "TomatoTest",
      "-port",
      String(port),
      "-no-window",
      "-no-metrics",
      "-no-audio",
      "-no-boot-anim",
      "-no-snapshot",
      "-gpu",
      process.env.ANDROID_TEST_GPU || "swiftshader",
      "-feature",
      "-Vulkan",
      "-memory",
      "3072",
    ],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  emulator.stdout.pipe(emulatorLog, { end: false });
  emulator.stderr.pipe(emulatorLog, { end: false });
  let booted = false;
  // This bounds a test emulator's boot, not an assistant/user task.
  for (let attempt = 0; attempt < 180; attempt++) {
    if (emulator.exitCode !== null || emulator.signalCode !== null)
      throw new Error("Isolated Android emulator exited before boot");
    try {
      booted =
        (
          await run(
            join(sdk, "platform-tools", "adb"),
            ["-s", serial, "shell", "getprop", "sys.boot_completed"],
            undefined,
            true,
          )
        ).trim() === "1";
    } catch {}
    if (booted) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!booted) throw new Error("Isolated Android emulator did not finish boot");
  // Match CI's animation setting so native picker bounds stay stable.
  for (const setting of [
    "window_animation_scale",
    "transition_animation_scale",
    "animator_duration_scale",
  ]) {
    await run(join(sdk, "platform-tools", "adb"), [
      "-s",
      serial,
      "shell",
      "settings",
      "put",
      "global",
      setting,
      "0",
    ]);
  }
  const test = spawn(process.execPath, ["tests/android-app.mjs"], {
    env: { ...env, ANDROID_SERIAL: serial, TOMATO_ANDROID_TEST_ISOLATED: "1" },
    stdio: "inherit",
  });
  const [code, signal] = await once(test, "exit");
  if (code !== 0 || signal)
    throw new Error(`Android app test failed: ${code ?? signal}`);
} finally {
  if (emulator && emulator.exitCode === null && emulator.signalCode === null) {
    emulator.kill();
    await once(emulator, "exit");
  }
  emulatorLog?.end();
  await rm(root, { recursive: true, force: true });
}
