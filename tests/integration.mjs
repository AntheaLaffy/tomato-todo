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
      await page.addInitScript(() => {
        window.audioNotes = 0;
        const create = AudioContext.prototype.createOscillator;
        AudioContext.prototype.createOscillator = function (...args) {
          window.audioNotes++;
          return create.apply(this, args);
        };
      });
      await page.goto(url);
      await expect(
        page.getByRole("heading", { name: "今天，也要慢慢向前。" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "新建任务 N", exact: true })
        .click();
      await expect(page.locator("[name=creationMode]")).toHaveValue("instance");
      await expect(page.locator("#template-printing-options")).toBeHidden();
      await page.locator("[name=creationMode]").selectOption("manual");
      await page
        .locator("summary")
        .filter({ hasText: "备注、标签与步骤" })
        .click();
      await page
        .locator("summary")
        .filter({ hasText: "项目、目标与优先级" })
        .click();
      await page.locator("summary").filter({ hasText: "印刷安排" }).click();
      await page.locator("[name=printNow]").check();
      await page.locator("[name=title]").fill("学习 Rust 的所有权");
      await page
        .locator("[name=notes]")
        .fill("读完章节，并写一个可运行的例子。");
      await page.locator("[name=priority]").selectOption("3");
      await page.locator("[name=printing]").selectOption("weekly");
      await page.locator("[name=creationMode]").selectOption("automatic");
      await expect(page.locator("[name=printing]")).toHaveValue("weekly");
      await page.locator("[name=creationMode]").selectOption("manual");
      await expect(page.locator("[name=printing]")).toHaveValue("weekly");
      await expect(page.locator("#template-once")).toBeHidden();
      const initial = await (await fetch(`${url}/api/snapshot`)).json();
      await page.locator("[name=printUntil]").fill(initial.today);
      await page.locator("[name=tags]").fill("Rust, 学习");
      await page.locator("[name=subtasks]").fill("解释借用与移动");
      await page
        .getByRole("button", { name: "保存并印刷", exact: true })
        .click();
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
      // Completion changes only this instance. A manual template prints a finite
      // batch explicitly; automatic templates extend their rolling horizon.
      const afterCompletion = await (await fetch(`${url}/api/snapshot`)).json();
      await expect.poll(() => page.evaluate(() => window.audioNotes)).toBe(2);
      assert.equal(afterCompletion.data.tasks.length, 1);
      const tomorrow = new Date(`${afterCompletion.today}T12:00:00Z`);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 7);
      const printed = await fetch(`${url}/api/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "printTemplate",
          id: afterCompletion.data.templates[0].id,
          dates: [tomorrow.toISOString().slice(0, 10)],
        }),
      });
      assert.equal(printed.status, 200);
      await page.reload();
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
      await expect(page.locator("#goal-form [name=target]")).toHaveCount(0);
      await expect(page.locator("#goal-form [name=unit]")).toHaveCount(0);
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
      await expect(page.locator("[name=soundVolume]")).toHaveValue("40");
      await page.locator("[name=soundVolume]").fill("23");
      await expect(page.locator("#sound-preview option")).toHaveCount(11);
      await page.locator("#sound-preview").selectOption("reminder");
      const notesBeforePreview = await page.evaluate(() => window.audioNotes);
      await page.getByRole("button", { name: "试听音效", exact: true }).click();
      await expect
        .poll(() => page.evaluate(() => window.audioNotes))
        .toBe(notesBeforePreview + 2);
      await page.locator("[name=sound]").uncheck();
      await page.getByRole("button", { name: "保存设置", exact: true }).click();
      await expect(page.locator("#settings-status")).toHaveText(
        "更改后记得保存",
      );
      await page.reload();
      await expect(page.locator(".clock")).toHaveText("30:00");
      assert.equal(await page.evaluate(() => window.audioNotes), 0);
      await page.getByRole("button", { name: "开始专注", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "暂停专注", exact: true }),
      ).toBeVisible();
      assert.equal(await page.evaluate(() => window.audioNotes), 0);
      await page.waitForTimeout(1100);
      await page.getByRole("button", { name: "暂停专注", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "继续计时", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "重置计时", exact: true }).click();
      await page.locator("#confirm-button").click();
      await expect(page.locator(".clock")).toHaveText("30:00");
      await page
        .getByRole("button", { name: "切换明暗主题", exact: true })
        .click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await page
        .getByRole("button", { name: "切换明暗主题", exact: true })
        .click();
      await page.getByRole("button", { name: "数据统计", exact: true }).click();
      await expect(page.locator(".history-row")).toHaveCount(2);
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
      assert.equal(backup.settings.soundVolume, 23);
      assert.equal(backup.settings.sound, false);
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
      await expect(page.locator("[name=creationMode]")).toHaveValue("instance");
      await page
        .locator("summary")
        .filter({ hasText: "专注时段与补做" })
        .click();
      await page.locator("[name=title]").fill("时间明确的测试任务");
      await page.locator("[name=focusMinutes]").fill("40");
      await page.locator("[name=durationMinutes]").fill("40");
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
      await page.locator("#template-form [name=title]").fill("午饭");
      const slot = page.locator("[data-slot]").first();
      for (const day of [1, 2, 3, 4, 5, 6, 7])
        await slot.locator(`input[value="${day}"]`).check();
      await slot.locator("input[type=time]").fill(reminderAt);
      await page.locator("[name=printAheadDays]").fill("0");
      await page.getByRole("button", { name: "保存模板", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const habitSection = page
        .locator(".goal-section")
        .filter({ hasText: "午饭" });
      await expect(habitSection).toBeVisible();
      const habitSnapshot = await (await fetch(`${url}/api/snapshot`)).json();
      const habitWeekday =
        new Date(`${habitSnapshot.today}T12:00:00Z`).getUTCDay() || 7;
      await expect(habitSection.locator("[data-task-id]")).toHaveCount(
        8 - habitWeekday,
      );
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
      // The weekly schedule shows seven days and can move between weeks.
      await page.locator("[data-page=schedule]").first().click();
      await expect(page.locator(".calendar-day")).toHaveCount(7);
      await page.locator("[data-week-next]").click();
      await expect(page.locator("[data-week-now]")).toHaveCount(1);
      await page.locator("[data-week-now]").click();
      await page.screenshot({
        path: join(dir, "schedule.png"),
        fullPage: true,
      });
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      server.kill("SIGTERM");
    }
  },
);

test(
  "templates: reusable manual batches, explicit sync, rolling preprint and repair window",
  { timeout: 60_000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "tomato-templates-"));
    const url = "http://127.0.0.1:4322";
    const server = spawn("target/debug/tomato-preview", [], {
      env: {
        ...process.env,
        TOMATO_PORT: "4322",
        TOMATO_DATA_PATH: join(dir, "state.sqlite3"),
      },
      stdio: "pipe",
    });
    let browser;
    try {
      for (let i = 0; i < 100; i++) {
        try {
          if ((await fetch(`${url}/api/snapshot`)).ok) break;
        } catch {}
        await new Promise((r) => setTimeout(r, 100));
      }
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
      await page.locator("[data-action=new-task]").first().click();
      await expect(page.locator("#template-weekly")).toBeHidden();
      await page.locator("[name=creationMode]").selectOption("manual");
      await expect(page.locator("#automatic-printing-options")).toBeHidden();
      await page.locator("summary").filter({ hasText: "印刷安排" }).click();
      await page.locator("[name=reminderTime]").fill("23:59");
      await page
        .locator("summary")
        .filter({ hasText: "专注时段与补做" })
        .click();
      await page.locator("#template-form [name=title]").fill("静态模板");
      await page.locator("[name=scrapMinutes]").fill("45");
      await page.getByRole("button", { name: "保存模板", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      let snapshot = await (await fetch(`${url}/api/snapshot`)).json();
      assert.equal(snapshot.data.tasks.length, 0);
      assert.equal(snapshot.data.templates[0].automatic, false);
      const templateId = snapshot.data.templates[0].id;
      await page.locator("[data-page=tasks]").first().click();
      const catalog = page.locator(`[data-template-id="${templateId}"]`);
      await catalog.locator("[data-print-template]").click();
      const last = new Date(`${snapshot.today}T12:00:00Z`);
      last.setUTCDate(last.getUTCDate() + 2);
      await page
        .locator("#print-form [name=end]")
        .fill(last.toISOString().slice(0, 10));
      await page
        .getByRole("button", { name: "印刷全部实例", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.locator("#tasks-results [data-task-id]")).toHaveCount(
        3,
      );
      // Reprinting this same finite range creates no duplicate instances.
      await catalog.locator("[data-print-template]").click();
      await page
        .locator("#print-form [name=end]")
        .fill(last.toISOString().slice(0, 10));
      await page
        .getByRole("button", { name: "印刷全部实例", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.locator("#tasks-results [data-task-id]")).toHaveCount(
        3,
      );
      snapshot = await (await fetch(`${url}/api/snapshot`)).json();
      const firstId = snapshot.data.tasks[0].id;
      await page
        .locator(`[data-task-id="${firstId}"] [data-edit-task]`)
        .first()
        .click();
      await expect(page.locator("#task-form [name=scrapMinutes]")).toHaveValue(
        "45",
      );
      await page.getByRole("button", { name: "保存修改", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await catalog.locator("[data-edit-template]").click();
      await page.locator("#template-form [name=title]").fill("新版模板");
      await page.getByRole("button", { name: "保存模板", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      assert.equal(
        (await (await fetch(`${url}/api/snapshot`)).json()).data.tasks[0].title,
        "静态模板",
      );
      await catalog.locator("[data-sync-template]").click();
      await page.locator("#confirm-button").click();
      await expect
        .poll(
          async () =>
            (await (await fetch(`${url}/api/snapshot`)).json()).data.tasks[0]
              .title,
        )
        .toBe("新版模板");
      await catalog.locator("[data-delete-template]").click();
      await page.locator("#confirm-button").click();
      await expect(catalog).toHaveCount(0);
      snapshot = await (await fetch(`${url}/api/snapshot`)).json();
      assert.equal(snapshot.data.tasks.length, 3);
      assert.ok(snapshot.data.tasks.every((t) => t.templateId === null));
      // Repeated templates preprint before their occurrence and do not depend on
      // completing the previous task; a weekday can have multiple precise times.
      await page.locator("[data-page=goals]").first().click();
      await page.locator("[data-goals-tab=habits]").click();
      await page.getByRole("button", { name: "新建习惯", exact: true }).click();
      await page.locator("#template-form [name=title]").fill("分时习惯");
      for (const day of [1, 2, 3, 4, 5, 6, 7])
        await page
          .locator("[data-slot]")
          .first()
          .locator(`input[value="${day}"]`)
          .check();
      await page
        .locator("[data-slot]")
        .first()
        .locator("input[type=time]")
        .fill("23:59");
      await page.locator("#template-add-slot").click();
      for (const day of [1, 2, 3, 4, 5, 6, 7])
        await page
          .locator("[data-slot]")
          .last()
          .locator(`input[value="${day}"]`)
          .check();
      await page
        .locator("[data-slot]")
        .last()
        .locator("input[type=time]")
        .fill("23:58");
      await page.screenshot({
        path: join(dir, "template-editor.png"),
        fullPage: true,
      });
      await page.getByRole("button", { name: "保存模板", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      snapshot = await (await fetch(`${url}/api/snapshot`)).json();
      const automatic = snapshot.data.templates.find(
        (t) => t.shape.title === "分时习惯",
      );
      assert.equal(automatic.automatic, true);
      assert.equal(automatic.printAheadDays, 7);
      const upcoming = snapshot.data.tasks.filter(
        (t) => t.templateId === automatic.id && t.dueDate > snapshot.today,
      );
      const weekday = new Date(`${snapshot.today}T12:00:00Z`).getUTCDay() || 7;
      assert.equal(upcoming.length, (14 - weekday) * 2);
      const habitInstanceIds = new Set(
        snapshot.data.tasks
          .filter((t) => t.templateId === automatic.id)
          .map((t) => t.id),
      );
      await page.locator("[data-page=tasks]").first().click();
      await page.screenshot({
        path: join(dir, "templates-list.png"),
        fullPage: true,
      });
      await page
        .locator(`[data-template-id="${automatic.id}"] [data-delete-template]`)
        .click();
      await page.locator("#confirm-button").click();
      await expect(
        page.locator(`[data-template-id="${automatic.id}"]`),
      ).toHaveCount(0);
      await page.locator("[data-page=goals]").first().click();
      await page.locator("[data-goals-tab=habits]").click();
      await page
        .locator(
          `[data-habit-id="${automatic.shape.habitId}"] [data-delete-habit]`,
        )
        .click();
      await page.locator("#confirm-button").click();
      await expect
        .poll(
          async () =>
            (await (await fetch(`${url}/api/snapshot`)).json()).data.habits
              .length,
        )
        .toBe(0);
      snapshot = await (await fetch(`${url}/api/snapshot`)).json();
      assert.ok(snapshot.data.tasks.length >= 17);
      assert.ok(snapshot.data.tasks.every((t) => t.habitId === null));
      // Deleting the group only detaches it; the printed occurrences keep the
      // origin they were printed with so statistics do not lose the habit history.
      const detachedHabits = snapshot.data.tasks.filter((t) =>
        habitInstanceIds.has(t.id),
      );
      assert.ok(detachedHabits.length > 0);
      assert.ok(
        detachedHabits.every(
          (t) => t.recurring === true && snapshot.taskKinds[t.id] === "habit",
        ),
      );
      await page.locator("[data-page=focus]").first().click();
      await page.locator("[data-action=new-task]").first().click();
      await expect(page.locator("[name=creationMode]")).toHaveValue("instance");
      await expect(page.locator("#template-printing-options")).toBeHidden();
      await expect(page.locator("#manual-printing-options")).toBeHidden();
      await expect(page.locator("[name=estimate]")).toHaveCount(0);
      await page.locator("[name=title]").fill("临时短任务");
      await page.locator("[name=durationMinutes]").fill("15");
      await page.locator("[name=creationMode]").selectOption("manual");
      await expect(page.locator("#automatic-printing-options")).toBeHidden();
      await expect(page.locator("[name=title]")).toHaveValue("临时短任务");
      await page.locator("[name=creationMode]").selectOption("automatic");
      await expect(page.locator("[name=printAheadDays]")).toBeVisible();
      await page.locator("[name=creationMode]").selectOption("instance");
      await expect(page.locator("[name=durationMinutes]")).toHaveValue("15");
      await page.screenshot({
        path: join(dir, "temporary-editor.png"),
        fullPage: true,
      });
      await page.getByRole("button", { name: "创建任务", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      snapshot = await (await fetch(`${url}/api/snapshot`)).json();
      const short = snapshot.data.tasks.find((t) => t.title === "临时短任务");
      assert.equal(short.templateId, null);
      assert.equal(short.focusMinutes, 15);
      assert.equal(short.estimate, 1);
      assert.equal(snapshot.data.templates.length, 0);
      // A precise start time owns many dates; another time can reuse the shape.
      const dateAfter = (days) => {
        const d = new Date(`${snapshot.today}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() + days);
        return d.toISOString().slice(0, 10);
      };
      await page.locator("[data-action=new-task]").first().click();
      await page.locator("[name=title]").fill("分时日程");
      await page.locator("[name=creationMode]").selectOption("manual");
      await page.locator("summary").filter({ hasText: "印刷安排" }).click();
      await page.locator("[name=printing]").selectOption("calendar");
      let schedule = page.locator("[data-calendar-entry]").first();
      await schedule.locator("input[type=time]").fill("23:59");
      await schedule.locator("input[type=date]").fill(dateAfter(2));
      await schedule.locator("[data-add-date]").click();
      await schedule.locator("input[type=date]").last().fill(dateAfter(4));
      await page.locator("#calendar-add").click();
      schedule = page.locator("[data-calendar-entry]").last();
      await schedule.locator("input[type=time]").fill("23:58");
      await schedule.locator("input[type=date]").fill(dateAfter(2));
      await schedule.locator("[data-add-date]").click();
      await schedule.locator("input[type=date]").last().fill(dateAfter(4));
      await page.setViewportSize({ width: 360, height: 900 });
      await page.screenshot({
        path: join(dir, "calendar-editor-mobile.png"),
        fullPage: true,
      });
      assert.ok(
        await page
          .locator("[data-calendar-entry]")
          .first()
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      );
      await page.setViewportSize({ width: 1440, height: 1050 });
      await page.getByRole("button", { name: "保存模板", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      snapshot = await (await fetch(`${url}/api/snapshot`)).json();
      const calendar = snapshot.data.templates.find(
        (t) => t.shape.title === "分时日程",
      );
      assert.equal(calendar.printing.kind, "calendar");
      assert.equal(calendar.printing.slots.length, 2);
      assert.deepEqual(calendar.printing.slots[0].dates, [
        dateAfter(2),
        dateAfter(4),
      ]);
      assert.equal(
        snapshot.data.tasks.filter((t) => t.title === "分时日程").length,
        0,
      );
      await page.locator("[data-page=tasks]").first().click();
      const calendarCard = page.locator(`[data-template-id="${calendar.id}"]`);
      await calendarCard.locator("[data-print-template]").click();
      await page
        .getByRole("button", { name: "印刷全部实例", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      snapshot = await (await fetch(`${url}/api/snapshot`)).json();
      assert.equal(
        snapshot.data.tasks.filter((t) => t.title === "分时日程").length,
        4,
      );
      await calendarCard.locator("[data-edit-template]").click();
      await page.locator("[name=creationMode]").selectOption("automatic");
      await expect(page.locator("[name=printing]")).toHaveValue("calendar");
      await page.getByRole("button", { name: "保存模板", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      snapshot = await (await fetch(`${url}/api/snapshot`)).json();
      assert.equal(
        snapshot.data.tasks.filter((t) => t.title === "分时日程").length,
        4,
      );
      await page.locator("[data-action=new-task]").first().click();
      await page.locator("[name=title]").fill("临时批量");
      await page.locator("#instance-more-dates").click();
      schedule = page.locator("[data-calendar-entry]").first();
      await schedule.locator("input[type=date]").fill(dateAfter(2));
      await schedule.locator("[data-add-date]").click();
      await schedule.locator("input[type=date]").last().fill(dateAfter(4));
      await expect(page.locator("#template-printing-options")).toBeHidden();
      await page.getByRole("button", { name: "创建任务", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      snapshot = await (await fetch(`${url}/api/snapshot`)).json();
      assert.equal(
        snapshot.data.tasks.filter((t) => t.title === "临时批量").length,
        2,
      );
      assert.ok(
        snapshot.data.tasks
          .filter((t) => t.title === "临时批量")
          .every((t) => t.templateId === null),
      );
      assert.equal(snapshot.data.templates.length, 1);
      // Disabled rules exercise strict-mode editing without arming desktop protection.
      const ruleId = "strict-setting-test";
      const saved = await fetch(`${url}/api/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "saveLockSchedule",
          schedule: {
            id: ruleId,
            name: "晚间休息",
            start: "23:00",
            end: "07:00",
            days: [1, 2, 3, 4, 5, 6, 7],
            enabled: false,
            strict: true,
          },
        }),
      });
      assert.equal(saved.status, 200);
      await page.reload();
      await page.locator("[data-page=lock]").first().click();
      const strictSwitch = page.locator(`[data-strict-lock="${ruleId}"]`);
      await expect(strictSwitch).toBeChecked();
      await strictSwitch.click();
      await expect
        .poll(
          async () =>
            (await (await fetch(`${url}/api/snapshot`)).json()).data.lock
              .schedules[0].strict,
        )
        .toBe(false);
      await page.locator(`[data-edit-lock="${ruleId}"]`).click();
      await page.locator("#lock-schedule-form [name=strict]").check();
      await page.getByRole("button", { name: "保存时段", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(strictSwitch).toBeChecked();
      for (const width of [360, 700, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        for (const route of ["lock", "guard"]) {
          await page.locator(`[data-page=${route}]`).first().click();
          const row = page.locator(
            route === "guard"
              ? ".guard-strict-card .setting-row"
              : ".lock-strict-setting",
          );
          const contained = await row.evaluate((el) => {
            const text = el.querySelector("span");
            const input = el.querySelector("input");
            const card = el.closest(".card").getBoundingClientRect();
            const t = text.getBoundingClientRect(),
              i = input.getBoundingClientRect();
            return (
              text.scrollWidth <= text.clientWidth + 1 &&
              t.left >= card.left &&
              i.right <= card.right &&
              t.right < i.left
            );
          });
          assert.ok(contained, `${route} strict mode must fit at ${width}px`);
          if (width === 360)
            await page.screenshot({
              path: join(dir, `${route}-strict-mobile.png`),
              fullPage: true,
            });
        }
      }
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      server.kill("SIGTERM");
    }
  },
);

test(
  "mainline nodes: pairing, completion, semantic blocking, immutable verdicts and editor layout",
  { timeout: 90_000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "tomato-nodes-"));
    const url = "http://127.0.0.1:4323";
    const server = spawn("target/debug/tomato-preview", [], {
      env: {
        ...process.env,
        TOMATO_PORT: "4323",
        TOMATO_DATA_PATH: join(dir, "nodes.sqlite3"),
      },
      stdio: "pipe",
    });
    let browser;
    try {
      for (let i = 0; i < 100; i++) {
        try {
          if ((await fetch(`${url}/api/snapshot`)).ok) break;
        } catch {}
        await new Promise((r) => setTimeout(r, 100));
      }
      browser = await chromium.launch({
        executablePath: process.env.CHROMIUM_PATH || "/usr/sbin/chromium",
        headless: true,
        args: ["--no-sandbox"],
      });
      const page = await browser.newPage({
        viewport: { width: 1280, height: 1000 },
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(url);
      let snapshot = await (await fetch(`${url}/api/snapshot`)).json();
      const date = (days) => {
        const d = new Date(`${snapshot.today}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() + days);
        return d.toISOString().slice(0, 10);
      };
      const field = (row, key) => row.locator(`[data-node-field="${key}"]`);
      await page.locator("[data-page=goals]").first().click();
      await page.getByRole("button", { name: "新建目标", exact: true }).click();
      await page.locator("#goal-form [name=name]").fill("节点验证组");
      await page.locator("#add-mainline-node").click();
      let row = page.locator("[data-node-row]").last();
      await field(row, "name").fill("独立前置");
      await field(row, "start").fill(`${date(0)}T00:00`);
      await field(row, "end").fill(`${date(0)}T08:00`);
      await field(row, "signalKind").selectOption("none");
      await page.locator("#add-mainline-node").click();
      row = page.locator("[data-node-row]").last();
      await field(row, "name").fill("导学");
      await field(row, "end").fill(`${date(1)}T00:00`);
      await field(row, "signalKind").selectOption("success");
      await field(row, "signalAt").fill(`${date(3)}T00:00`);
      await row.locator("summary").filter({ hasText: "阻断外来" }).click();
      await field(row, "blockFailure").selectOption("completed");
      await field(row, "blockSuccess").selectOption("unpaired");
      await page.locator("#add-mainline-node").click();
      row = page.locator("[data-node-row]").last();
      await field(row, "name").fill("验收结束");
      await field(row, "end").fill(`${date(2)}T00:00`);
      await field(row, "signalKind").selectOption("failure");
      await field(row, "direction").selectOption("head");
      await field(row, "condition").selectOption("completed");
      await field(row, "signalAt").fill(`${date(-1)}T00:00`);
      await row.locator("summary").filter({ hasText: "阶段完成要求" }).click();
      await field(row, "confirmationRequired").check();
      await page.setViewportSize({ width: 360, height: 900 });
      await page.screenshot({
        path: join(dir, "node-editor-mobile.png"),
        fullPage: true,
      });
      assert.ok(await row.evaluate((el) => el.scrollWidth <= el.clientWidth));
      await page.setViewportSize({ width: 1280, height: 1000 });
      await page.getByRole("button", { name: "保存目标", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      snapshot = await (await fetch(`${url}/api/snapshot`)).json();
      const group = snapshot.data.goals[0];
      const ids = group.nodes.map((n) => n.spec.id);
      assert.equal(new Set(ids).size, 3);
      assert.equal(snapshot.data.signalEvents.length, 0);
      const create = async (title, day, time) => {
        await page.locator("[data-page=focus]").first().click();
        await page.locator("[data-action=new-task]").first().click();
        await page.locator("[name=title]").fill(title);
        await page.locator("[name=dueDate]").fill(day);
        await page.locator("[name=reminderTime]").fill(time);
        await page.locator("summary").filter({ hasText: "项目、目标" }).click();
        await page.locator("[name=goalId]").selectOption(group.id);
        await page
          .getByRole("button", { name: "创建任务", exact: true })
          .click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
      };
      await create("导学练习", date(0), "09:00");
      await create("验收任务", date(1), "12:00");
      await page.locator("[data-page=goals]").first().click();
      const card = page.locator(`[data-goal-id="${group.id}"]`);
      snapshot = await (await fetch(`${url}/api/snapshot`)).json();
      const originalTask = snapshot.data.tasks.find(
        (t) => t.title === "导学练习",
      );
      const deletion = await fetch(`${url}/api/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "deleteTask", id: originalTask.id }),
      });
      assert.equal(deletion.status, 200);
      await page.reload();
      await page.locator("[data-page=goals]").first().click();
      await card.locator(`[data-restore-paired="${originalTask.id}"]`).click();
      await expect(
        card.getByRole("button", { name: "完成任务 导学练习", exact: true }),
      ).toBeVisible();
      snapshot = await (await fetch(`${url}/api/snapshot`)).json();
      assert.equal(
        snapshot.data.tasks.find((t) => t.title === "导学练习").id,
        originalTask.id,
      );
      assert.equal(
        snapshot.data.nodeBindings.filter((b) => b.taskId === originalTask.id)
          .length,
        1,
      );
      await card
        .getByRole("button", { name: "完成任务 导学练习", exact: true })
        .click();
      await card
        .getByRole("button", { name: "完成任务 验收任务", exact: true })
        .click();
      snapshot = await (await fetch(`${url}/api/snapshot`)).json();
      assert.equal(snapshot.data.signalEvents.length, 0);
      await card.locator(`[data-confirm-node="${ids[2]}"]`).click();
      await expect(
        card.locator(`[data-mainline-node="${ids[2]}"] .badge`),
      ).toHaveText("失败");
      await expect(
        card.locator(`[data-mainline-node="${ids[1]}"] .badge`),
      ).toHaveText("已完成，等待裁定");
      snapshot = await (await fetch(`${url}/api/snapshot`)).json();
      const event = snapshot.data.signalEvents[0];
      assert.equal(event.deliveries.length, 2);
      assert.equal(event.deliveries[1].blocked, true);
      assert.equal(event.deliveries[1].blockRule, "completed");
      assert.equal(snapshot.data.goals[0].nodes[0].result, null);
      await card.locator(".signal-history summary").click();
      await page.screenshot({
        path: join(dir, "node-signal-history.png"),
        fullPage: true,
      });
      const settled = card.locator(`[data-mainline-node="${ids[2]}"]`);
      await expect(settled.locator("[data-toggle-task]")).toBeDisabled();
      await settled.locator(".task-more").click();
      await expect(
        page.getByRole("heading", { name: "实例记录", exact: true }),
      ).toBeVisible();
      await expect(page.locator("#task-form")).toHaveCount(0);
      await page.getByRole("button", { name: "关闭", exact: true }).click();
      await card.locator("[data-edit-goal]").click();
      await page.locator("#goal-form [name=name]").fill("组改名");
      await expect(
        page.locator(`[data-node-row="${ids[2]}"] [data-node-field=start]`),
      ).toBeDisabled();
      await field(page.locator(`[data-node-row="${ids[2]}"]`), "name").fill(
        "节点改名",
      );
      await page.getByRole("button", { name: "保存目标", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      snapshot = await (await fetch(`${url}/api/snapshot`)).json();
      assert.equal(snapshot.data.goals[0].id, group.id);
      assert.deepEqual(
        snapshot.data.goals[0].nodes.map((n) => n.spec.id),
        ids,
      );
      assert.equal(snapshot.data.goals[0].nodes[2].result.verdict, "failure");
      await page.reload();
      snapshot = await (await fetch(`${url}/api/snapshot`)).json();
      assert.equal(snapshot.data.signalEvents.length, 1);
      // A separate terminal check remains non-blocking and can observe completion after its time.
      await page.locator("[data-page=goals]").first().click();
      await page.getByRole("button", { name: "新建目标", exact: true }).click();
      await page.locator("#goal-form [name=name]").fill("末检查组");
      await page.locator("#add-mainline-node").click();
      row = page.locator("[data-node-row]");
      await field(row, "name").fill("末节点");
      await field(row, "signalAt").fill(`${date(-1)}T00:00`);
      await page.getByRole("button", { name: "保存目标", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      snapshot = await (await fetch(`${url}/api/snapshot`)).json();
      const checkGroup = snapshot.data.goals[1];
      assert.equal(checkGroup.nodes[0].result, null);
      const response = await fetch(`${url}/api/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "printInstances",
          shape: { title: "检查任务", goalId: checkGroup.id, estimate: 1 },
          printing: { kind: "once", date: date(0), time: "12:00" },
        }),
      });
      assert.equal(response.status, 200);
      await page.reload();
      await page.locator("[data-page=goals]").first().click();
      await page
        .getByRole("button", { name: "完成任务 检查任务", exact: true })
        .click();
      snapshot = await (await fetch(`${url}/api/snapshot`)).json();
      assert.equal(snapshot.data.goals[1].nodes[0].result.verdict, "success");
      assert.equal(
        snapshot.data.tasks.find((t) => t.title === "检查任务").completed,
        true,
      );
      // The statistics judge the whole line and align it with other tasks by day.
      snapshot = await (await fetch(`${url}/api/snapshot`)).json();
      assert.equal(
        snapshot.stats.goals.find((g) => g.id === group.id).outcome,
        "failure",
      );
      assert.equal(
        snapshot.stats.goals.find((g) => g.id === checkGroup.id).outcome,
        "success",
      );
      assert.ok(snapshot.stats.days.some((d) => d.goalFailure > 0));
      await page.locator("[data-page=stats]").first().click();
      const mainline = page.locator(".mainline-card");
      await expect(mainline).toContainText("主线失败");
      await expect(mainline).toContainText("全线成功");
      await expect(page.locator(".cross-row.has-failure")).not.toHaveCount(0);
      assert.deepEqual(errors, []);
      console.log(`node artifacts: ${dir}`);
    } finally {
      await browser?.close();
      server.kill("SIGTERM");
    }
  },
);
