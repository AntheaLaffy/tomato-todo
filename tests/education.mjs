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
  { timeout: 120000 },
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
      await page
        .getByRole("button", { name: "更新学习进度", exact: true })
        .click();
      await page.locator('#study-progress-form [name="topic"]').fill("极限");
      await page
        .locator('#study-progress-form [name="position"]')
        .fill("基础第2讲，视频23:10");
      await page
        .locator('#study-progress-form [name="evidence"]')
        .fill("本人登记，基础题还未验证");
      await page
        .locator('#study-progress-form [name="nextAction"]')
        .fill("完成基础题并检查法则条件");
      await page.getByRole("button", { name: "保存进度", exact: true }).click();
      await expect(page.locator(".study-progress")).toContainText(
        "基础第2讲，视频23:10",
      );
      await expect(page.locator(".study-progress")).toContainText("本人登记");
      const savedProgress = (await (await fetch(base + "/api/snapshot")).json())
        .data.education.progress[0];
      assert.equal(savedProgress.source, "user");
      assert.equal(savedProgress.confirmed, true);
      assert.ok(savedProgress.recordedAt > 0);
      await page.reload();
      await page.getByRole("button", { name: /应试测试项目/ }).click();
      await expect(page.locator(".study-progress")).toContainText(
        "基础第2讲，视频23:10",
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
      await page.locator(".resource-library > summary").click();
      await page.locator("[data-resource-query]").fill("极限");
      await expect(page.locator(".resource-row")).toHaveCount(0);
      await page.locator("[data-resource-query]").fill("syllabus");
      await expect(page.locator(".resource-row")).toHaveCount(1);
      await page.locator("[data-resource-open]").first().click();
      await expect(page.locator("#resource-preview pre")).toHaveText(
        "极限、连续",
      );
      const textDownload = page.waitForEvent("download");
      await page.locator("#resource-download").click();
      assert.equal(
        await readFile(await (await textDownload).path(), "utf8"),
        "极限、连续",
      );
      await page.locator('.modal [data-action="close-modal"]').click();
      const { open, stat, unlink, rename } = await import("node:fs/promises");
      const large = join(root, "materials", "大教材.pdf"),
        length = 100 * 1024 * 1024;
      const file = await open(large, "w");
      await file.truncate(length);
      await file.write(Buffer.from("tail"), 0, 4, length - 4);
      await file.close();
      const post = async (request) => {
        const response = await fetch(base + "/api/agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request),
        });
        assert.ok(response.ok, await response.clone().text());
        return response.json();
      };
      await post({
        op: "tool",
        name: "education",
        arguments: {
          command: {
            op: "saveResource",
            resource: {
              ...resource,
              id: "large",
              title: "大教材",
              kind: "book",
              path: "大教材.pdf",
            },
          },
        },
      });
      const partial = await fetch(base + "/api/project-resource?id=large", {
        headers: { Range: `bytes=${length - 4}-${length - 1}` },
      });
      assert.equal(partial.status, 206);
      assert.equal(await partial.text(), "tail");
      const cross = await fetch(base + "/api/project-resource?id=large", {
        headers: { Origin: "https://outside.example" },
      });
      assert.equal(cross.status, 403);
      await page.reload();
      await page.getByRole("button", { name: /应试测试项目/ }).click();
      const library = page.locator(".resource-library");
      await library.locator(":scope > summary").click();
      await library.locator("[data-resource-query]").fill("大教材");
      await library.locator("[data-resource-open]").click();
      await expect(page.locator("#resource-preview")).toContainText(
        "此文件较大",
      );
      const bigDownload = page.waitForEvent("download");
      await page.locator("#resource-download").click();
      const saved = await (await bigDownload).path();
      assert.equal((await stat(saved)).size, length);
      const copy = await open(saved, "r"),
        tail = Buffer.alloc(4);
      await copy.read(tail, 0, 4, length - 4);
      await copy.close();
      assert.equal(tail.toString(), "tail");
      await page.locator('.modal [data-action="close-modal"]').click();
      await rename(large, join(root, "materials", "moved.pdf"));
      await library.locator("[data-resource-scan]").click();
      await expect(library.locator(".resource-row")).toContainText("文件缺失");
      page.once("dialog", (dialog) => dialog.accept("moved.pdf"));
      await library.locator("[data-resource-repair]").click();
      await expect(page.locator("#toast")).toContainText("路径已修复");
      await expect(library).toHaveJSProperty("open", true);
      await page.waitForTimeout(1200);
      await expect(library).toHaveJSProperty("open", true);
      await library.locator("[data-resource-scan]").click();
      await expect(library.locator(".resource-row")).toContainText("文件可用");
      await unlink(join(root, "materials", "moved.pdf"));
      await library.locator("[data-resource-scan]").click();
      await expect(library.locator(".resource-row")).toContainText("文件缺失");
      page.once("dialog", (dialog) => dialog.accept());
      await library.locator("[data-resource-clean]").click();
      await expect(page.locator("#toast")).toContainText("已移除 1 条");
      const bulk = (await (await fetch(base + "/api/snapshot")).json()).data;
      bulk.education.resources.push(
        ...Array.from({ length: 5000 }, (_, i) => ({
          ...resource,
          id: `perf-${i}`,
          kind: "book",
          title: `教材 ${i}`,
          path: `missing-${i}.pdf`,
          topics: ["性能检查"],
        })),
      );
      const bulkResponse = await fetch(base + "/api/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "import", data: bulk }),
      });
      assert.ok(bulkResponse.ok, await bulkResponse.text());
      await page.reload();
      await page.getByRole("button", { name: /应试测试项目/ }).click();
      await library.locator(":scope > summary").click();
      await expect(library.locator(".resource-row")).toHaveCount(40);
      const timings = [];
      for (let i = 0; i < 5; i++) {
        timings.push(
          await library.locator("[data-resource-query]").evaluate((input) => {
            const start = performance.now();
            input.value = "教材 4999";
            input.dispatchEvent(new Event("input", { bubbles: true }));
            return performance.now() - start;
          }),
        );
      }
      await expect(library.locator(".resource-row")).toHaveCount(1);
      console.log(
        "5001-resource search (ms):",
        JSON.stringify(timings.map((n) => Math.round(n * 100) / 100)),
      );
      await library.locator("[data-resource-query]").fill("");
      await library
        .getByRole("button", { name: "下一页", exact: true })
        .click();
      await expect(library.locator("[data-resource-results]")).toContainText(
        "第 2 / 126 页",
      );
      const scanStart = performance.now();
      await library.locator("[data-resource-scan]").click();
      await expect(library.locator(".resource-row").first()).toContainText(
        "文件缺失",
      );
      console.log(
        "5001-resource scan end-to-end (ms):",
        Math.round(performance.now() - scanStart),
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

test(
  "learning workflow: homework versions, evidence, corrections, exam stop and retest",
  { timeout: 60000 },
  async () => {
    const { spawn } = await import("node:child_process");
    const { copyFile } = await import("node:fs/promises");
    const { chromium, expect } = await import("@playwright/test");
    const root = await mkdtemp(join(tmpdir(), "tomato-teaching-flow-"));
    const materials = join(root, "materials");
    await mkdir(materials);
    await copyFile("target/debug/tomato-preview", join(root, "tomato-preview"));
    const base = "http://127.0.0.1:4351";
    let server = spawn(join(root, "tomato-preview"), [], {
      env: {
        ...process.env,
        TOMATO_PORT: "4351",
        TOMATO_DATA_PATH: join(root, "data.sqlite3"),
      },
      stdio: "pipe",
    });
    let logs = "",
      browser;
    server.stderr.on("data", (b) => (logs += b));
    const post = async (path, value) => {
      const r = await fetch(base + path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(value),
      });
      const text = await r.text();
      assert.ok(r.ok, text);
      return JSON.parse(text);
    };
    const action = (a) => post("/api/action", a);
    try {
      for (let n = 0; n < 100; n++) {
        try {
          if ((await fetch(base + "/api/snapshot")).ok) break;
        } catch {}
        await new Promise((r) => setTimeout(r, 100));
      }
      let snapshot = await action({
        type: "saveProject",
        id: null,
        name: "教学流程",
        color: "#849b7d",
        directory: materials,
      });
      const p = snapshot.data.projects.at(-1).id;
      await post("/api/agent", {
        op: "authorize_project_directory",
        projectId: p,
        directory: materials,
      });
      snapshot = await action({
        type: "saveVision",
        id: null,
        name: "掌握基础并通过测试",
        projectId: p,
      });
      const vision = snapshot.data.visions.at(-1).id;
      const now = Math.floor(Date.now() / 1000),
        date = snapshot.today;
      const resource = (id, kind) => ({
        id,
        projectId: p,
        title: id,
        kind,
        path: id + ".txt",
        source: "临时测试材料",
        edition: "2026",
        topics: ["极限"],
      });
      const resources = [
        resource("syllabus", "syllabus"),
        resource("past", "pastPaper"),
        resource("mock", "mockPaper"),
        resource("sheet", "answerSheet"),
      ];
      for (const r of resources)
        await writeFile(join(materials, r.path), r.title);
      const lessonDay = new Date(`${date}T12:00:00`);
      lessonDay.setDate(lessonDay.getDate() - 1);
      const lessonDate = lessonDay.toLocaleDateString("sv-SE");
      const lessonStart = Math.floor(
        new Date(`${lessonDate}T08:30:00`).getTime() / 1000,
      );
      const completedLesson = {
        id: "lesson-prefill",
        projectId: p,
        semesterId: "term",
        semesterRevision: 1,
        title: "极限基础课程",
        topics: ["极限法则"],
        resourceIds: ["mock"],
        startsAt: lessonStart,
        endsAt: lessonStart + 2700,
        aiEnabled: true,
        attended: true,
        progress: "讲完基础第2讲，例题未独立做完",
        state: "ended",
      };
      const semester = {
        id: "term",
        projectId: p,
        title: "测试学期",
        startDate: lessonDate,
        endDate: date,
        revision: 1,
        baseline: "基础待验证",
        evidence: ["临时测试资料"],
        rationale: "先学后测",
        milestones: [
          {
            week: 1,
            topics: ["极限"],
            resourceIds: ["mock"],
            objective: "检查基础法则",
            lessonCount: 2,
          },
        ],
      };
      const question = {
        id: "q1",
        prompt: "求基础极限",
        topics: ["极限"],
        sourceIds: ["mock"],
        extension: false,
        estimatedMinutes: 10,
        answer: "标准答案标记：1",
        acceptableAlternatives: "等价推导",
        scoring: [{ id: "p1", description: "法则和计算正确", points: 5 }],
      };
      const packet = (id, kind, start, end) => ({
        id,
        projectId: p,
        semesterId: "term",
        semesterRevision: 1,
        lessonId: null,
        taskId: kind === "homework" ? "study-task" : null,
        retestOfGradeId: null,
        title:
          id === "hw" ? "基础作业" : id === "exam" ? "阶段考试" : "截止考试",
        kind,
        revision: 1,
        startsAt: start,
        endsAt: end,
        instructions: "独立完成，到点停笔",
        reviewEvidence: "临时fixture的固定答案和评分标准",
        questions: [question],
        publishedAt: now - 10,
        printedAt: null,
        startedAt: null,
        stoppedAt: null,
      });
      const hw = packet("hw", "homework", now - 60, now + 3600),
        exam = packet("exam", "mockExam", now - 30, now + 1800);
      let data = structuredClone(snapshot.data);
      data.education = {
        projects: [
          {
            projectId: p,
            directory: materials,
            examMode: true,
            visionId: vision,
            target: "2027年数学基础测试",
            examDate: null,
            syllabusId: "syllabus",
            pastPaperIds: ["past"],
            mockPaperIds: ["mock"],
          },
        ],
        resources,
        semesters: [semester],
        semesterHistory: [],
        lessons: [completedLesson],
        assessments: [hw, exam],
        submissions: [],
        grades: [],
        reviews: [],
        events: [
          {
            id: "homework:lesson-prefill",
            projectId: p,
            kind: "homework",
            sourceId: completedLesson.id,
            state: "pending",
            createdAt: completedLesson.endsAt,
          },
        ],
        completedTasks: [
          {
            id: "study-task",
            projectId: p,
            title: "极限第1讲",
            notes: "本人说已学",
            topics: ["极限"],
            completedAt: now - 100,
          },
        ],
        progress: [],
        corrections: [],
      };
      await action({ type: "import", data });
      const savedTask = await action({
        type: "saveTask",
        task: {
          title: "等待布置作业的学习任务",
          projectId: p,
          dueDate: date,
          notes: "基础第2讲，视频23:10；法则条件待验证",
          tags: ["极限"],
        },
      });
      const studyTaskId = savedTask.data.tasks.find(
        (task) => task.title === "等待布置作业的学习任务",
      ).id;
      const ordinaryTask = await action({
        type: "saveTask",
        task: { title: "普通任务不跳转", dueDate: date },
      });
      const ordinaryTaskId = ordinaryTask.data.tasks.find(
        (task) => task.title === "普通任务不跳转",
      ).id;
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
      await page.locator('[data-page="agent"]').first().click();
      await page.locator("#agent-text").fill("原草稿请保留");
      await page.locator('[data-page="tasks"]').first().click();
      await page.locator(`[data-toggle-task="${ordinaryTaskId}"]`).click();
      await expect(page.locator("h1")).toContainText("把想做的事，慢慢完成。");
      await page.locator(`[data-toggle-task="${studyTaskId}"]`).click();
      await expect(page.locator("h1")).toContainText("学习助手", {
        timeout: 2000,
      });
      await expect(page.locator("#agent-text")).toHaveValue(/原草稿请保留/);
      await expect(page.locator("#agent-text")).toBeFocused();
      await expect(page.locator("#agent-text")).toHaveValue(
        /等待布置作业的学习任务/,
      );
      await expect(page.locator("#agent-text")).toHaveValue(
        /基础第2讲，视频23:10；法则条件待验证/,
      );
      await expect(page.locator("#agent-text")).toHaveValue(/极限/);
      await expect(page.locator("#agent-text")).toHaveValue(
        new RegExp(`taskHomework:${studyTaskId}`),
      );
      await expect(page.locator("#agent-text")).toHaveValue(
        /get_study_progress/,
      );
      await expect(page.locator("#agent-text")).toHaveValue(/不要重复发布/);
      snapshot = await (await fetch(base + "/api/snapshot")).json();
      assert.ok(
        snapshot.data.education.events.some(
          (event) => event.id === `taskHomework:${studyTaskId}`,
        ),
      );
      // A claimed course-homework wake also carries the original lesson context.
      // Simulate the status signal without starting a paid model.
      await page.locator('[data-page="tasks"]').first().click();
      const wakeStatus = await post("/api/agent", { op: "status" });
      await page.route("**/api/agent", async (route) => {
        if (route.request().postDataJSON()?.op === "status")
          await route.fulfill({
            json: {
              ...wakeStatus,
              wakeSerial: wakeStatus.wakeSerial + 1,
              homeworkWakeEventId: "homework:lesson-prefill",
              conversations: [
                ...wakeStatus.conversations.map((item) => ({
                  ...item,
                  active: false,
                })),
                {
                  id: "scheduled-lesson-conversation",
                  title: "课程作业",
                  updatedAt: now,
                  messageCount: 1,
                  active: true,
                },
              ],
            },
          });
        else await route.continue();
      });
      await expect(page.locator("h1")).toContainText("学习助手", {
        timeout: 8000,
      });
      await expect(page.locator("#agent-text")).toHaveValue(/极限基础课程/);
      await expect(page.locator("#agent-text")).toHaveValue(
        /讲完基础第2讲，例题未独立做完/,
      );
      await expect(page.locator("#agent-text")).toHaveValue(/指定资料：mock/);
      await expect(page.locator("#agent-text")).toHaveValue(
        /homework:lesson-prefill/,
      );
      await page.waitForTimeout(3000);
      const finalDraft = await page.locator("#agent-text").inputValue();
      assert.ok(finalDraft.includes("原草稿请保留"));
      assert.equal(
        finalDraft.split(`taskHomework:${studyTaskId}`).length - 1,
        1,
      );
      assert.equal(finalDraft.split("homework:lesson-prefill").length - 1, 1);
      await page.unroute("**/api/agent");
      await page.locator('[data-page="education"]').first().click();
      await expect(page.locator(".education-dashboard")).toContainText(
        "学生端",
      );
      await expect(page.locator(".education-dashboard-project")).toContainText(
        "教学流程",
      );
      await expect(page.locator(".education-dashboard-project")).toContainText(
        "基础作业",
      );
      await page.getByRole("button", { name: "教师端" }).click();
      await expect(page.locator(".education-dashboard")).toContainText(
        "教师视图",
      );
      await expect(page.locator(".education-dashboard-project")).toContainText(
        "第 1 周 · 测试学期",
      );
      await expect(page.locator(".education-dashboard-project")).toContainText(
        "检查基础法则",
      );
      await expect(page.locator(".education-dashboard-project")).toContainText(
        "计划 2 节",
      );
      await expect(page.locator(".education-dashboard-project")).toContainText(
        "待处理作业 / 测评",
      );
      await page.setViewportSize({ width: 360, height: 1000 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "education dashboard should fit a narrow screen",
      );
      await page.setViewportSize({ width: 1280, height: 1000 });
      await page.getByRole("button", { name: /教学流程/ }).click();
      const row = (id) => page.locator(`[data-assessment-id="${id}"]`);
      await row("hw")
        .locator("summary")
        .filter({ hasText: "查看题目" })
        .click();
      await row("hw").locator('[data-resource-open="mock"]').click();
      await expect(page.locator("#resource-preview pre")).toHaveText("mock");
      await page.locator('.modal [data-action="close-modal"]').click();
      const paperDownload = page.waitForEvent("download");
      await row("hw")
        .getByRole("button", { name: "下载可打印试卷和答题卡" })
        .click();
      const paper = await readFile(await (await paperDownload).path(), "utf8");
      assert.match(paper, /求基础极限/);
      assert.match(paper, /答题卡/);
      assert.ok(!paper.includes(question.answer));
      assert.ok(!paper.includes(question.acceptableAlternatives));
      assert.ok(!paper.includes(question.scoring[0].description));
      assert.ok(!paper.includes(hw.reviewEvidence));
      await row("hw")
        .getByRole("button", { name: "交作业", exact: true })
        .click();
      await page
        .locator('#study-submit-form [name="answers"]')
        .fill("用极限法则算得2，待检查");
      let submissions = 0;
      await page.route("**/api/action", async (route) => {
        if (route.request().postDataJSON()?.command?.op === "submit") {
          submissions++;
          await new Promise((r) => setTimeout(r, 250));
        }
        await route.continue();
      });
      await page
        .getByRole("button", { name: "提交并等待批改", exact: true })
        .click();
      await expect(row("hw")).toContainText("已交，待批改");
      assert.equal(submissions, 1);
      await page.unroute("**/api/action");
      snapshot = await (await fetch(base + "/api/snapshot")).json();
      const sub = snapshot.data.education.submissions[0];
      const grade = {
        id: "grade",
        submissionId: sub.id,
        assessmentRevision: 1,
        gradedAt: now,
        awards: [
          {
            questionId: "q1",
            pointId: "p1",
            awarded: 2,
            evidence: "法则写对，计算结果错误",
          },
        ],
        errors: [
          {
            questionId: "q1",
            cause: "符号处理待核实",
            evidence: "算式结果与前一步不一致",
            correction: "重新计算并解释符号",
            nextCheck: "独立计算同类题",
            retestDate: date,
            confirmed: false,
          },
        ],
        needsReview: false,
        feedback: "请订正计算",
      };
      data = structuredClone(snapshot.data);
      data.education.grades.push(grade);
      await action({ type: "import", data });
      await page.reload();
      await page.getByRole("button", { name: /教学流程/ }).click();
      await expect(row("hw")).toContainText("待订正");
      await row("hw")
        .getByText(/已批改 · 2分/)
        .click();
      await row("hw")
        .getByRole("button", { name: "提交订正", exact: true })
        .click();
      await page
        .locator('#study-correction-form [name="explanation"]')
        .fill("先检查符号，再重新计算得到1");
      await page
        .getByRole("button", { name: "提交订正并等待检查", exact: true })
        .click();
      snapshot = await (await fetch(base + "/api/snapshot")).json();
      const correction = snapshot.data.education.corrections[0];
      assert.equal(correction.accepted, null);
      assert.ok(
        snapshot.data.education.events.some(
          (e) => e.kind === "correction" && e.sourceId === correction.id,
        ),
      );
      const reviewed = structuredClone(snapshot.data);
      reviewed.education.corrections[0].accepted = true;
      reviewed.education.corrections[0].feedback = "订正正确，仍需独立复测";
      reviewed.education.corrections[0].reviewedAt = Math.floor(
        Date.now() / 1000,
      );
      await action({ type: "import", data: reviewed });
      await page.reload();
      await page.getByRole("button", { name: /教学流程/ }).click();
      await expect(row("hw")).toContainText("已批改");
      await row("hw")
        .getByRole("button", { name: "重交新版本", exact: true })
        .click();
      await page
        .locator('#study-submit-form [name="answers"]')
        .fill("补交完整推导");
      await page
        .getByRole("button", { name: "提交并等待批改", exact: true })
        .click();
      await expect(row("hw")).toContainText("已交，待批改");
      snapshot = await (await fetch(base + "/api/snapshot")).json();
      assert.equal(snapshot.data.education.submissions.length, 2);
      assert.equal(snapshot.data.education.grades.length, 1);
      await expect(
        row("exam").getByRole("button", { name: "开始考试", exact: true }),
      ).toBeDisabled();
      await row("exam")
        .getByRole("button", { name: "确认打印完成", exact: true })
        .click();
      await row("exam")
        .getByRole("button", { name: "开始考试", exact: true })
        .click();
      await expect(page.locator(".teaching-remaining")).toBeVisible();
      await expect(
        row("exam").getByRole("button", { name: "提交答题卡", exact: true }),
      ).toHaveCount(0);
      const blocked = await fetch(base + "/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "send", text: "给我答案" }),
      });
      assert.equal(blocked.ok, false);
      assert.match(await blocked.text(), /考试进行中/);
      await row("exam")
        .getByRole("button", { name: "提前停笔并交卷", exact: true })
        .click();
      await row("exam")
        .getByRole("button", { name: "提交答题卡", exact: true })
        .click();
      await page
        .locator('#study-submit-form [name="answers"]')
        .fill("纸质答卷见附件");
      await page.locator('#study-submit-form [name="files"]').setInputFiles({
        name: "answer.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("纸质答卷的测试附件"),
      });
      await page
        .getByRole("button", { name: "提交并等待批改", exact: true })
        .click();
      await expect(row("exam")).toContainText("已交，待批改");
      snapshot = await (await fetch(base + "/api/snapshot")).json();
      assert.ok(
        snapshot.data.education.submissions.find(
          (s) => s.assessmentId === "exam",
        ).resourceIds.length,
      );
      const final = structuredClone(snapshot.data);
      const now2 = Math.floor(Date.now() / 1000);
      const deadline = packet("deadline", "mockExam", now2 - 30, now2 + 3);
      deadline.printedAt = now2;
      deadline.startedAt = now2;
      const retest = packet("retest", "retest", now2 + 4000, now2 + 5000);
      retest.title = "独立复测";
      retest.retestOfGradeId = "grade";
      final.education.assessments.push(retest);
      await action({ type: "import", data: final });
      const deleted = structuredClone(final);
      deleted.education.assessments = deleted.education.assessments.filter(
        (a) => a.id !== "exam",
      );
      deleted.education.submissions = deleted.education.submissions.filter(
        (s) => s.assessmentId !== "exam",
      );
      const rejected = await fetch(base + "/api/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "import", data: deleted }),
      });
      assert.equal(rejected.status, 400);
      assert.match(await rejected.text(), /已发布试卷不能删除/);
      // Isolate the clock fixture so it does not erase or overlap the completed exam.
      await new Promise((resolve) => {
        server.once("exit", resolve);
        server.kill("SIGTERM");
      });
      server = spawn(join(root, "tomato-preview"), [], {
        env: {
          ...process.env,
          TOMATO_PORT: "4351",
          TOMATO_DATA_PATH: join(root, "deadline.sqlite3"),
        },
        stdio: "pipe",
      });
      server.stderr.on("data", (b) => (logs += b));
      for (let n = 0; n < 100; n++) {
        try {
          if ((await fetch(base + "/api/snapshot")).ok) break;
        } catch {}
        await new Promise((r) => setTimeout(r, 100));
      }
      const clockData = structuredClone(final);
      clockData.tasks = clockData.tasks.filter(
        (task) =>
          !clockData.education.focusTasks.some(
            (link) => link.taskId === task.id,
          ),
      );
      clockData.education.focusTasks = [];
      clockData.education.assessments = [deadline];
      clockData.education.submissions = [];
      clockData.education.grades = [];
      clockData.education.corrections = [];
      clockData.education.events = [];
      await action({ type: "import", data: clockData });
      await page.reload();
      await page.getByRole("button", { name: /教学流程/ }).click();
      await expect(row("deadline")).toContainText("已停笔，请交卷", {
        timeout: 10000,
      });
      await page.setViewportSize({ width: 360, height: 1000 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await mkdir("artifacts", { recursive: true });
      await page.screenshot({
        path: "artifacts/teaching-workflow-mobile.png",
        fullPage: true,
      });
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
