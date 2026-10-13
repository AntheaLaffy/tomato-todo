import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { _android as android, expect as baseExpect } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 15_000 });

// This entry is for a fresh emulator, never a phone containing personal data.
if (
  process.env.GITHUB_ACTIONS !== "true" &&
  process.env.TOMATO_ANDROID_TEST_ISOLATED !== "1"
)
  throw new Error("Android tests require the isolated CI or test emulator");
const exec = promisify(execFile);
await mkdir("artifacts", { recursive: true });
const adb = process.env.ANDROID_HOME
  ? join(process.env.ANDROID_HOME, "platform-tools", "adb")
  : "adb";
const devices = (await exec(adb, ["devices"])).stdout;
const emulators = [...devices.matchAll(/^(emulator-\d+)\s+device$/gm)].map(
  (match) => match[1],
);
const serial = process.env.ANDROID_SERIAL || emulators[0];
assert.ok(
  emulators.includes(serial) &&
    (process.env.ANDROID_SERIAL || emulators.length === 1),
  "Select exactly one isolated emulator, using ANDROID_SERIAL when needed",
);
const device = async (...args) =>
  (await exec(adb, ["-s", serial, ...args])).stdout;
async function apkFiles(dir) {
  const files = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) files.push(...(await apkFiles(path)));
    else if (item.name.endsWith(".apk")) files.push(path);
  }
  return files;
}
const apks = await apkFiles("src-tauri/gen/android/app/build/outputs/apk");
const apk = apks.find((path) => /universal.*debug/.test(path));
assert.ok(apk, "Missing universal debug APK");
console.log(
  (await exec("python3", ["scripts/check-android-apk.py", apk])).stdout.trim(),
);
// A fresh installation avoids racing clearApplicationUserData's asynchronous
// window removal against the next Activity launch.
if (
  (await device("shell", "pm", "list", "packages", "studio.tomato.todo")).trim()
)
  await device("uninstall", "studio.tomato.todo");
await device("install", "-r", apk);
await device(
  "shell",
  "am",
  "start",
  "-W",
  "-n",
  "studio.tomato.todo/.MainActivity",
);

let androidDevice;
let page;
async function connect() {
  androidDevice ||= (await android.devices()).find(
    (item) => item.serial() === serial,
  );
  assert.ok(androidDevice, "Playwright could not find the isolated emulator");
  await expect
    .poll(
      async () => {
        try {
          return (await device("shell", "pidof", "studio.tomato.todo")).trim();
        } catch {
          return "";
        }
      },
      { timeout: 30_000 },
    )
    .toBeTruthy();
  const pid = (await device("shell", "pidof", "studio.tomato.todo")).trim();
  // Target the app's actual process across restarts; package extraction differs
  // between Android ps implementations and legacy ADB shell transports.
  const webview = await androidDevice.webView({
    socketName: `webview_devtools_remote_${pid}`,
  });
  return webview.page();
}
async function back() {
  await device("shell", "input", "keyevent", "4");
}
async function openNavigation(page) {
  await page.getByRole("button", { name: "打开导航", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/mobile-nav-open/);
  const bounds = await page.locator(".sidebar").evaluate((sidebar) => {
    const rect = sidebar.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      viewportWidth: visualViewport?.width ?? innerWidth,
      viewportHeight: visualViewport?.height ?? innerHeight,
    };
  });
  assert.ok(
    bounds.x >= 0 &&
      bounds.y >= 0 &&
      bounds.width <= bounds.viewportWidth &&
      bounds.height <= bounds.viewportHeight,
    JSON.stringify(bounds),
  );
}
async function systemTap(selector) {
  // Playwright 1.64 removes timeout from the protocol parameters but its
  // Android driver still defaults the native wait to zero. Poll the actual
  // control, then touch its native bounds once; a stale lookup never taps.
  let control;
  await expect
    .poll(
      async () => {
        try {
          control = await androidDevice.info(selector);
          return (
            control.enabled &&
            control.bounds.width > 0 &&
            control.bounds.height > 0
          );
        } catch (error) {
          if (
            /NullPointerException|StaleObjectException|Timed out waiting for selector/.test(
              String(error),
            )
          )
            return false;
          throw error;
        }
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  const { x, y, width, height } = control.bounds;
  console.log("Android native touch:", JSON.stringify({ selector, control }));
  await device(
    "shell",
    "input",
    "tap",
    String(Math.round(x + width / 2)),
    String(Math.round(y + height / 2)),
  );
}
async function saveDocument() {
  // Use the real DocumentsUI picker: only it grants the app a writable URI.
  await systemTap({ res: "android:id/button1" });
}
async function pickDocument(filename) {
  await systemTap({ desc: "Show roots" });
  await systemTap({ text: "Downloads", res: "android:id/title" });
  // UiAutomator can report file nodes behind the still-closing drawer. Wait
  // for its visible heading to disappear before using those file bounds.
  await expect
    .poll(
      async () => {
        try {
          const heading = await androidDevice.info({ text: "Open from" });
          return heading.bounds.width === 0 || heading.bounds.height === 0;
        } catch (error) {
          if (String(error).includes("NullPointerException")) return true;
          if (String(error).includes("StaleObjectException")) return false;
          throw error;
        }
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  await systemTap({ text: filename });
}
async function pushJson(data, filename) {
  const local = join("artifacts", filename);
  const raw = JSON.stringify(data);
  await writeFile(local, raw);
  // Create fixtures through MediaStore. ADB overwrites bypass its bookkeeping
  // and can crash Android 13's DownloadProvider while an exported URI closes.
  const collection = "content://media/external_primary/downloads";
  await device(
    "shell",
    "content",
    "insert",
    "--uri",
    collection,
    "--bind",
    `relative_path:s:Download/`,
    "--bind",
    `_display_name:s:${filename}`,
    "--bind",
    "mime_type:s:application/json",
    "--bind",
    "is_pending:i:0",
  );
  // Android 13's content insert command does not print the returned URI.
  const rows = await device(
    "shell",
    "content",
    "query",
    "--uri",
    collection,
    "--projection",
    "_id:_display_name",
  );
  const row = rows
    .split("\n")
    .find((line) => line.includes(`_display_name=${filename}`));
  const id = row?.match(/_id=(\d+)/)?.[1];
  assert.ok(id, rows);
  const uri = `${collection}/${id}`;
  const writing = exec(adb, [
    "-s",
    serial,
    "shell",
    "content",
    "write",
    "--uri",
    uri,
  ]);
  writing.child.stdin.end(raw);
  await writing;
  await device(
    "shell",
    "content",
    "update",
    "--uri",
    uri,
    "--bind",
    "is_pending:i:0",
  );
  console.log(
    "Android import document:",
    await device(
      "shell",
      "content",
      "query",
      "--uri",
      uri,
      "--projection",
      "_display_name:_size:is_pending:_data:mime_type",
    ),
  );
  assert.deepEqual(await exportedJson(filename), data);
}
async function exportedJson(filename) {
  let data;
  await expect
    .poll(
      async () => {
        try {
          data = JSON.parse(
            await device("shell", "cat", `/sdcard/Download/${filename}`),
          );
          return true;
        } catch {
          return false;
        }
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  return data;
}
async function tapFileAction(page, action) {
  await page.locator(`[data-action="${action}"]`).click();
}
try {
  page = await connect();
  // Native actions lazily install/start the instrumentation driver. Warm it
  // before timing individual picker controls on a fresh emulator.
  await expect
    .poll(
      async () => {
        try {
          return (await androidDevice.info({ pkg: "studio.tomato.todo" })).pkg;
        } catch {
          return "";
        }
      },
      { timeout: 60_000 },
    )
    .toBe("studio.tomato.todo");
  await expect(page.locator("html")).toHaveAttribute(
    "data-platform",
    "android",
    { timeout: 60_000 },
  );
  await expect(
    page.getByRole("heading", { name: "今天，也要慢慢向前。" }),
  ).toBeVisible();
  await page.locator('[data-action="welcome-done"]').click();
  // The native WebView size must be usable without horizontally scrolling the app.
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await openNavigation(page);
  await page.getByRole("button", { name: "新建项目", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator('#project-form [name="name"]').fill("手机项目");
  await page.getByRole("button", { name: "保存项目", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await openNavigation(page);
  await page
    .locator('.projects [data-page^="project:"]')
    .filter({ hasText: "手机项目" })
    .click();
  await expect(page.locator(".breadcrumb")).toContainText("手机项目");
  await expect(page.locator(".workspace")).not.toHaveAttribute("inert", "");
  await page.locator('[data-action="new-task"]').first().click();
  await page.locator('[name="title"]').fill("手机端实际保存的任务");
  await page.getByRole("button", { name: "创建任务", exact: true }).click();
  await expect(
    page.locator(".task-row").filter({ hasText: "手机端实际保存的任务" }),
  ).toBeVisible();
  // Android Back closes a dialog and then navigation before changing pages.
  await page.locator('[data-action="new-task"]').first().click();
  await back();
  // The IME consumes the first Back when the editor's autofocus opened it.
  if (await page.getByRole("dialog").count()) await back();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await openNavigation(page);
  await back();
  await expect(page.locator("html")).not.toHaveClass(/mobile-nav-open/);
  await back();
  await expect(
    page.getByRole("heading", { name: "今天，也要慢慢向前。" }),
  ).toBeVisible();
  await page.locator('[data-action="toggle-timer"]').click();
  await expect(page.locator('[data-action="toggle-timer"]')).toContainText(
    "暂停",
  );
  const before = await page.locator(".clock").first().textContent();
  // A process restart must recover the actual persisted deadline.
  await device("shell", "am", "force-stop", "studio.tomato.todo");
  await device(
    "shell",
    "am",
    "start",
    "-W",
    "-n",
    "studio.tomato.todo/.MainActivity",
  );
  page = await connect();
  await expect(page.locator('[data-action="toggle-timer"]')).toContainText(
    "暂停",
  );
  await expect
    .poll(() => page.locator(".clock").first().textContent())
    .not.toBe(before);
  await page.locator('[data-action="toggle-timer"]').click();
  await openNavigation(page);
  await page.locator('.sidebar [data-page="tasks"]').click();
  await expect(
    page.locator(".task-row").filter({ hasText: "手机端实际保存的任务" }),
  ).toBeVisible();
  await openNavigation(page);
  await page.locator('.sidebar [data-page="settings"]').click();
  await expect(page.locator('[name="alwaysOnTop"]')).toHaveCount(0);
  await expect(page.locator('[name="autostart"]')).toHaveCount(0);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  console.log("Android: validating system document URI export/import");
  await page.evaluate(() => {
    window.fileCalls = [];
    window.fileClicks = [];
    document.addEventListener("click", (event) =>
      window.fileClicks.push({
        action: event.target.closest?.("[data-action]")?.dataset.action,
        x: event.clientX,
        y: event.clientY,
      }),
    );
    // Tauri's invoke property is immutable. Observe its real callback map;
    // forward every callback unchanged rather than replacing the IPC bridge.
    const callbacks = window.__TAURI_INTERNALS__.callbacks;
    const set = callbacks.set.bind(callbacks);
    callbacks.set = (id, callback) => {
      const call = { id, completed: false };
      window.fileCalls.push(call);
      return set(id, (value) => {
        call.completed = true;
        call.value = typeof value === "object" ? "document" : value;
        return callback(value);
      });
    };
  });
  await tapFileAction(page, "export", "导出备份");
  await saveDocument();
  const backup = await exportedJson("tomato-todo-backup.json");
  assert.ok(backup.tasks.some((task) => task.title === "手机端实际保存的任务"));
  assert.ok(backup.projects.some((project) => project.name === "手机项目"));
  const importedTask = backup.tasks.find(
    (task) => task.title === "手机端实际保存的任务",
  );
  importedTask.title = "从系统文件导入的备份任务";
  await pushJson(backup, "android-backup-import.json");
  await tapFileAction(page, "import", "导入备份");
  await pickDocument("android-backup-import.json");
  await expect(page.getByRole("dialog")).toContainText("用备份替换当前数据");
  await page.getByRole("button", { name: "导入并替换", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await tapFileAction(page, "export-plan", "导出计划");
  await saveDocument();
  const plan = await exportedJson("tomato-todo-plan.json");
  assert.equal(plan.format, "tomato-todo-plan");
  assert.equal(plan.version, 5);
  assert.ok(plan.tasks.some((task) => task.title === importedTask.title));
  plan.tasks.find((task) => task.id === importedTask.id).title =
    "从系统文件合并的计划任务";
  await pushJson(plan, "android-plan-import.json");
  await tapFileAction(page, "import-plan", "导入计划");
  await pickDocument("android-plan-import.json");
  await expect(page.getByRole("dialog")).toContainText("合并学习计划");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "导入计划", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await openNavigation(page);
  await page.locator('.sidebar [data-page="tasks"]').click();
  await expect(
    page.locator(".task-row").filter({ hasText: "从系统文件合并的计划任务" }),
  ).toBeVisible();
  console.log(
    "PASS: Android WebView, persistence, timer recovery, native Back, and real document URI backup/plan round trips",
  );
} catch (error) {
  if (page && !page.isClosed()) {
    const trace = await page.evaluate(() => ({
      calls: window.fileCalls,
      clicks: window.fileClicks,
      toasts: [...document.querySelectorAll('[role="status"], .toast')].map(
        (el) => el.textContent,
      ),
    }));
    console.error("File IPC:", trace);
    await writeFile(
      "artifacts/android-file-ipc.json",
      JSON.stringify(trace, null, 2),
    );
  }
  await Promise.allSettled([
    device("shell", "uiautomator", "dump", "/sdcard/android-ui.xml")
      .then(() => device("shell", "cat", "/sdcard/android-ui.xml"))
      .then((xml) => writeFile("artifacts/android-ui.xml", xml)),
    device(
      "logcat",
      "-d",
      "-v",
      "time",
      "-s",
      "ActivityManager",
      "AndroidRuntime",
      "SystemUI",
      "OpenGLRenderer",
      "WindowManager",
      "chromium",
      "libc",
      "DEBUG",
      "Tauri",
      "Tauri/Plugin",
      "ActivityTaskManager",
    ).then((log) => writeFile("artifacts/android-logcat.log", log)),
    device("shell", "dumpsys", "activity", "lastanr").then((log) =>
      writeFile("artifacts/android-anr.log", log),
    ),
  ]);
  if (androidDevice) {
    await writeFile(
      "artifacts/android-failure.png",
      await androidDevice.screenshot(),
    );
    console.error("Android screenshot: artifacts/android-failure.png");
  }
  throw error;
} finally {
  await androidDevice?.close();
  await device("shell", "am", "force-stop", "studio.tomato.todo");
}
