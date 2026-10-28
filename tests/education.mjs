import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { codingTools } from "../agent/coding.mjs";

test("project sandbox grants apply to file tools and the persistent shell", async () => {
  const root = await mkdtemp(join(tmpdir(), "tomato-project-sandbox-"));
  const app = join(root, "app"),
    project = join(root, "project"),
    outside = join(root, "outside");
  await Promise.all([mkdir(app), mkdir(project), mkdir(outside)]);
  await writeFile(join(outside, "secret.txt"), "private");
  await symlink(outside, join(project, "escape"));
  let close = () => {};
  const definitions = await codingTools(
    app,
    resolve("agent"),
    { projectMounts: [{ projectId: "p", directory: project }] },
    (cleanup) => {
      close = cleanup;
    },
  );
  const execute = (name, args) =>
    definitions
      .find((t) => t.name === name)
      .execute("project-test", args, new AbortController().signal);
  try {
    await execute("write", {
      path: join(project, "notes.txt"),
      content: "project notes",
    });
    assert.equal(
      await readFile(join(project, "notes.txt"), "utf8"),
      "project notes",
    );
    await assert.rejects(
      execute("read", { path: join(outside, "secret.txt") }),
    );
    await assert.rejects(
      execute("read", { path: join(project, "escape/secret.txt") }),
    );
    const quote = (s) => "'" + s.replaceAll("'", "'\\''") + "'";
    const shell = await execute("bash", {
      command: `cat ${quote(join(project, "notes.txt"))}; test ! -e ${quote(join(outside, "secret.txt"))}`,
    });
    assert.match(JSON.stringify(shell), /project notes/);
    assert.equal(shell.details?.exitCode ?? 0, 0);
  } finally {
    close();
  }
});

test(
  "project page requires a directory, imports resources and validates exam prerequisites",
  { timeout: 45000 },
  async () => {
    const { spawn } = await import("node:child_process");
    const { copyFile } = await import("node:fs/promises");
    const { chromium, expect } = await import("@playwright/test");
    const root = await mkdtemp(join(tmpdir(), "tomato-education-ui-"));
    await mkdir(join(root, "materials"));
    await copyFile("target/debug/tomato-preview", join(root, "tomato-preview"));
    const port = "4350",
      base = `http://127.0.0.1:${port}`;
    const server = spawn(join(root, "tomato-preview"), [], {
      env: {
        ...process.env,
        TOMATO_PORT: port,
        TOMATO_DATA_PATH: join(root, "data.sqlite3"),
      },
      stdio: "pipe",
    });
    let browser,
      logs = "";
    server.stderr.on("data", (b) => (logs += b));
    try {
      for (let n = 0; n < 100; n++) {
        try {
          if ((await fetch(base + "/api/snapshot")).ok) break;
        } catch {}
        await new Promise((r) => setTimeout(r, 100));
      }
      browser = await chromium.launch({
        headless: true,
        executablePath: process.env.CHROMIUM_PATH || "/usr/sbin/chromium",
      });
      const page = await browser.newPage({
        viewport: { width: 1280, height: 1000 },
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base);
      await page.locator('[data-action="new-project"]').click();
      await expect(page.locator("#project-directory")).toHaveAttribute(
        "required",
        "",
      );
      await page.locator('#project-form [name="name"]').fill("应试测试项目");
      await page.locator("#project-directory").fill(join(root, "materials"));
      await page.locator('#project-form button[type="submit"]').click();
      await page.getByRole("button", { name: "应试测试项目" }).click();
      await expect(page.locator(".education-card")).toContainText(
        join(root, "materials"),
      );
      await page.locator(".study-resource-kind").selectOption("syllabus");
      await page.locator(".study-upload").setInputFiles({
        name: "syllabus.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("极限、连续"),
      });
      await expect(page.locator(".education-card")).toContainText("项目资源 1");
      const snapshot = await (await fetch(base + "/api/snapshot")).json();
      const resource = snapshot.data.education.resources[0];
      assert.equal(resource.kind, "syllabus");
      assert.equal(
        await readFile(join(root, "materials", resource.path), "utf8"),
        "极限、连续",
      );
      await page
        .locator(".education-card summary")
        .filter({ hasText: "配置应试模式" })
        .click();
      await page.locator('.study-config [name="examMode"]').check();
      await page.locator('.study-config button[type="submit"]').click();
      await expect(page.locator("#toast")).toContainText("愿景");
      await mkdir("artifacts", { recursive: true });
      await page.screenshot({
        path: "artifacts/education-project.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 360, height: 1000 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "education page should fit a narrow screen",
      );
      assert.deepEqual(errors, []);
    } catch (error) {
      error.message += `\n${logs}`;
      throw error;
    } finally {
      await browser?.close();
      server.kill("SIGTERM");
    }
  },
);
