import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";

test(
  "real Rust API and UI: tasks, recurrence, search, timer, settings, backups and reload",
  { timeout: 100_000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "tomato-e2e-"));
    const url = "http://127.0.0.1:4321";
    const server = spawn("target/debug/tomato-preview", [], {
      env: {
        ...process.env,
        TOMATO_PORT: "4321",
        TOMATO_DATA_PATH: join(dir, "test.sqlite3"),
      },
      stdio: "pipe",
    });
    let browser;
    let output = "";
    server.stderr.on("data", (data) => (output += data));
    try {
      let ready = false;
      for (let i = 0; i < 100; i++) {
        try {
          if ((await fetch(`${url}/api/snapshot`)).ok) {
            ready = true;
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.ok(ready, `Rust server did not start: ${output}`);
      browser = await chromium.launch({
        executablePath: process.env.CHROMIUM_PATH || "/usr/sbin/chromium",
        headless: true,
        args: ["--no-sandbox"],
      });
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1050 },
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(url);
      await expect(
        page.getByRole("heading", { name: "今天，也要慢慢向前。" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "新建任务 N", exact: true })
        .click();
      await page.locator("[name=title]").fill("学习 Rust 的所有权");
      await page
        .locator("[name=notes]")
        .fill("读完章节，并写一个可运行的例子。");
      await page.locator("[name=priority]").selectOption("3");
      await page.locator("[name=repeat]").selectOption("weekdays");
      await page.locator("[name=tags]").fill("Rust, 学习");
      await page.locator("#subtask-input").fill("解释借用与移动");
      await page.locator("#subtask-input").press("Enter");
      await page.getByRole("button", { name: "创建任务", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.getByText("学习 Rust 的所有权", { exact: true }),
      ).toBeVisible();
      await page.reload();
      await expect(
        page.getByText("学习 Rust 的所有权", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: "完成任务 学习 Rust 的所有权",
          exact: true,
        })
        .click();
      await expect
        .poll(
          async () =>
            (await (await fetch(`${url}/api/snapshot`)).json()).data.tasks
              .length,
        )
        .toBe(2);
      const snap = await (await fetch(`${url}/api/snapshot`)).json();
      assert.equal(snap.data.tasks.length, 2);
      assert.equal(snap.data.tasks.filter((t) => t.completed).length, 1);
      assert.ok(snap.data.tasks.find((t) => !t.completed).dueDate > snap.today);
      await expect(
        page
          .locator(".metric")
          .filter({ hasText: "完成任务" })
          .locator(".metric-value"),
      ).toHaveText("1项");
      await page.keyboard.press("Control+k");
      await page.locator("#global-search-input").fill("所有权");
      await expect(page.locator("#global-search-results button")).toHaveCount(
        2,
      );
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "新建项目", exact: true }).click();
      await page.locator("[name=name]").fill("个人成长");
      await page.getByRole("button", { name: "保存项目", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.locator(".project-nav").filter({ hasText: "个人成长" }),
      ).toBeVisible();
      await page.locator("[data-page=goals]").first().click();
      await page.getByRole("button", { name: "新建目标", exact: true }).click();
      await page.locator("#goal-form [name=name]").fill("OpenCamp");
      await page.locator("#goal-form [name=target]").fill("3");
      await page.locator("#goal-form [name=unit]").fill("节");
      await page.getByRole("button", { name: "保存目标", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.locator(".goal-section").filter({ hasText: "OpenCamp" }),
      ).toBeVisible();
      await page.locator("[data-goals-tab=habits]").click();
      await expect(page.locator("[data-goals-tab=habits]")).toHaveClass(
        /active/,
      );
      await expect(
        page.getByRole("button", { name: "新建习惯", exact: true }),
      ).toBeVisible();
      await page.locator("[data-goals-tab=goals]").click();
      await page.locator("[data-page=focus]").first().click();
      await page.getByRole("button", { name: "开始专注", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "暂停专注", exact: true }),
      ).toBeVisible();
      await page.waitForTimeout(2100);
      await page.getByRole("button", { name: "暂停专注", exact: true }).click();
      // Wait for the pause to round-trip before reading the clock; otherwise
      // the countdown can tick once more after the immediate read.
      await expect(
        page.getByRole("button", { name: "继续计时", exact: true }),
      ).toBeVisible();
      const paused = await page.locator(".clock").innerText();
      assert.notEqual(paused, "25:00");
      await page.waitForTimeout(1100);
      assert.equal(await page.locator(".clock").innerText(), paused);
      await page.getByRole("button", { name: "重置计时", exact: true }).click();
      await page.locator("#confirm-button").click();
      await expect(page.locator(".clock")).toHaveText("25:00");
      await page.getByRole("button", { name: "偏好设置", exact: true }).click();
      await page.locator("[name=focusMinutes]").fill("30");
      await page.getByRole("button", { name: "保存设置", exact: true }).click();
      await expect(page.locator("#settings-status")).toHaveText(
        "更改后记得保存",
      );
      await page.reload();
      await expect(page.locator(".clock")).toHaveText("30:00");
      await page
        .getByRole("button", { name: "切换明暗主题", exact: true })
        .click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await page
        .getByRole("button", { name: "切换明暗主题", exact: true })
        .click();
      await page.getByRole("button", { name: "数据统计", exact: true }).click();
      await expect(page.locator(".history-row")).toHaveCount(1);
      await page.getByRole("button", { name: "专注保护", exact: true }).click();
      await expect(page.locator("[data-guard-mode=lock]")).toBeDisabled();
      await expect(page.locator("#guard-strict")).toBeDisabled();
      // The per-project whitelist lives on the project page, not the guard page.
      await page
        .locator(".project-nav")
        .filter({ hasText: "个人成长" })
        .click();
      await page.locator("[data-enable-project-whitelist]").click();
      await page
        .locator("#project-whitelist-form [name=appId]")
        .fill("org.mozilla.firefox");
      await page
        .locator("#project-whitelist-form")
        .getByRole("button", { name: "添加", exact: true })
        .click();
      await expect
        .poll(async () => {
          const snapshot = await (await fetch(`${url}/api/snapshot`)).json();
          return snapshot.data.projects.find(
            (project) => project.name === "个人成长",
          )?.appWhitelist;
        })
        .toContain("org.mozilla.firefox");
      await page.getByRole("button", { name: "定时锁机", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "开始快速锁机" }),
      ).toBeDisabled();
      const lockRejected = await fetch(`${url}/api/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "startQuickLock",
          minutes: 1,
          strict: true,
        }),
      });
      assert.equal(lockRejected.status, 400);
      await page.getByRole("button", { name: "偏好设置", exact: true }).click();
      const downloaded = page.waitForEvent("download");
      await page.getByRole("button", { name: "导出备份", exact: true }).click();
      const download = await downloaded;
      const backupPath = join(dir, "backup.json");
      await download.saveAs(backupPath);
      const backup = JSON.parse(await readFile(backupPath, "utf8"));
      assert.equal(backup.settings.focusMinutes, 30);
      assert.equal(backup.tasks.length, 2);
      const planDownloadEvent = page.waitForEvent("download");
      await page.getByRole("button", { name: "导出计划", exact: true }).click();
      const planDownload = await planDownloadEvent;
      const planPath = join(dir, "plan.json");
      await planDownload.saveAs(planPath);
      const plan = JSON.parse(await readFile(planPath, "utf8"));
      assert.equal(plan.format, "tomato-todo-plan");
      assert.equal(plan.pomodoroMinutes, 30);
      assert.equal(plan.tasks.length, 1);
      assert.equal(plan.settings, undefined);
      assert.equal(plan.tasks[0].completed, undefined);
      const chooserEvent = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: "导入计划", exact: true }).click();
      await (await chooserEvent).setFiles(planPath);
      await expect(page.getByRole("dialog")).toContainText("预计新增 0 个");
      await page.locator("#confirm-button").click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      assert.equal(
        (await (await fetch(`${url}/api/snapshot`)).json()).data.tasks.length,
        2,
      );
      const exampleChooser = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: "导入计划", exact: true }).click();
      await (await exampleChooser).setFiles("docs/plan.example.json");
      await expect(page.getByRole("dialog")).toContainText("预计新增 1 个");
      await page.locator("#confirm-button").click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect
        .poll(
          async () =>
            (await (await fetch(`${url}/api/snapshot`)).json()).data.tasks
              .length,
        )
        .toBe(3);
      const merged = (await (await fetch(`${url}/api/snapshot`)).json()).data;
      assert.equal(merged.tasks.length, 3);
      assert.equal(merged.settings.focusMinutes, 30);
      assert.deepEqual(merged.sessions, backup.sessions);
      await page.screenshot({
        path: join(dir, "plan-settings.png"),
        fullPage: true,
      });
      const invalid = structuredClone(backup);
      invalid.settings.focusMinutes = 0;
      const rejected = await fetch(`${url}/api/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "import", data: invalid }),
      });
      assert.equal(rejected.status, 400);
      assert.equal(
        (await (await fetch(`${url}/api/snapshot`)).json()).data.settings
          .focusMinutes,
        30,
      );
      await page
        .getByRole("button", { name: "全部任务", exact: false })
        .first()
        .click();
      await page.locator("#task-search").fill("所有权");
      await expect(page.locator("#tasks-results .task-row")).toHaveCount(1);
      await page.locator(".task-more").first().click();
      await page.getByRole("button", { name: "删除任务", exact: true }).click();
      await page.locator("#confirm-button").click();
      await page.getByRole("button", { name: "撤销", exact: true }).click();
      await expect(page.locator("#tasks-results .task-row")).toHaveCount(1);
      await page.setViewportSize({ width: 980, height: 760 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.setViewportSize({ width: 1440, height: 1050 });
      await page.locator("[data-page=focus]").first().click();
      await mkdir("artifacts", { recursive: true });
      await page.screenshot({
        path: "artifacts/e2e-focus.png",
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "新建任务 N", exact: true })
        .click();
      await page.locator("[name=title]").fill("时间明确的测试任务");
      await page.locator("[name=focusMinutes]").fill("40");
      // Due now, so it is inside its planned block instead of long expired.
      const now = new Date();
      const reminderAt = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes(),
      ).padStart(2, "0")}`;
      await page.locator("[name=reminderTime]").fill(reminderAt);
      await page.getByRole("button", { name: "创建任务", exact: true }).click();
      const reminder = page.getByRole("region", { name: "任务时间提醒" });
      await expect(reminder).toContainText("时间明确的测试任务");
      await expect(reminder).toContainText("40 分钟专注");
      await expect(page.locator(".task-row.reminded")).toHaveCount(1);
      await page.screenshot({ path: "artifacts/reminder.png", fullPage: true });
      await page.reload();
      await expect(reminder).toBeVisible();
      await page.getByRole("button", { name: "一键开始", exact: true }).click();
      await expect(reminder).toHaveCount(0);
      let reminderState = (await (await fetch(`${url}/api/snapshot`)).json())
        .data;
      assert.equal(reminderState.timer.running, true);
      assert.equal(reminderState.timer.durationSecs, 2400);
      assert.equal(reminderState.settings.focusMinutes, 30);
      await fetch(`${url}/api/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "resetTimer" }),
      });
      await page.reload();
      await expect(reminder).toHaveCount(0);
      // A weekly habit materializes today's occurrence from its schedule.
      await page.locator("[data-page=goals]").first().click();
      await page.locator("[data-goals-tab=habits]").click();
      await page.getByRole("button", { name: "新建习惯", exact: true }).click();
      await page.locator("#habit-form [name=name]").fill("午饭");
      const slot = page.locator("[data-slot]").first();
      for (const day of [1, 2, 3, 4, 5, 6, 7])
        await slot.locator(`input[value="${day}"]`).check();
      await slot.locator("input[type=time]").fill("12:00");
      await page.getByRole("button", { name: "保存习惯", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const habitSection = page
        .locator(".goal-section")
        .filter({ hasText: "午饭" });
      await expect(habitSection).toBeVisible();
      await expect(habitSection.locator("[data-task-id]")).toHaveCount(1);
      // Visions are markers with no jurisdiction.
      await page.locator("[data-goals-tab=visions]").click();
      await page.getByRole("button", { name: "新建愿景", exact: true }).click();
      await page.locator("#vision-form [name=name]").fill("考上北大");
      await page.locator("#vision-form [name=notes]").fill("研究生工资与未来");
      await page.getByRole("button", { name: "保存愿景", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.locator(".vision-card").filter({ hasText: "考上北大" }),
      ).toBeVisible();
      // Batch delete tasks through selection mode.
      await page.locator("[data-page=tasks]").first().click();
      // Right-click a project for its context menu, and confirm batch selection
      // also exists on the flat project page.
      await page
        .locator(".project-nav")
        .filter({ hasText: "个人成长" })
        .click({ button: "right" });
      await expect(page.locator(".context-menu")).toBeVisible();
      await page.locator("[data-page=tasks]").first().click();
      await expect(page.locator(".context-menu")).toHaveCount(0);
      await page
        .locator(".project-nav")
        .filter({ hasText: "个人成长" })
        .click();
      await expect(page.locator("[data-select-mode=on]")).toBeVisible();
      await page.locator("[data-page=tasks]").first().click();
      const beforeDelete = (await (await fetch(`${url}/api/snapshot`)).json())
        .data.tasks.length;
      await page.locator("[data-select-mode=on]").click();
      // Pick a plain task: a habit occurrence would just be materialized again.
      await page
        .locator(".task-row")
        .filter({ hasText: "时间明确的测试任务" })
        .locator(".task-checkbox.pick")
        .click();
      await page.locator("[data-delete-selected]").click();
      await page.locator("#confirm-button").click();
      await expect
        .poll(
          async () =>
            (await (await fetch(`${url}/api/snapshot`)).json()).data.tasks
              .length,
        )
        .toBe(beforeDelete - 1);
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      server.kill("SIGTERM");
    }
  },
);
