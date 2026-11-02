import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { chromium, expect } from "@playwright/test";
import {
  McpClient,
  StdioTransport,
  StreamableHttpTransport,
} from "../agent/node_modules/@earendil-works/pi-mcp/dist/index.js";

test(
  "external MCP transports discover skills, share state, and today's focus executes teaching work",
  { timeout: 120000 },
  async () => {
    const root = await mkdtemp(join(tmpdir(), "tomato-external-control-"));
    const executable = join(root, "tomato-preview");
    await copyFile("target/debug/tomato-preview", executable);
    const reservation = createServer();
    await new Promise((r) => reservation.listen(0, "127.0.0.1", r));
    const port = reservation.address().port;
    await new Promise((r) => reservation.close(r));
    const base = `http://127.0.0.1:${port}`;
    const server = spawn(executable, [], {
      env: {
        ...process.env,
        TOMATO_PORT: String(port),
        TOMATO_DATA_PATH: join(root, "data.sqlite3"),
      },
      stdio: "ignore",
    });
    const clients = [];
    let browser;
    try {
      let snapshot;
      for (let n = 0; n < 100; n++) {
        try {
          const response = await fetch(`${base}/api/snapshot`);
          if (response.ok) {
            snapshot = await response.json();
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.ok(snapshot, "isolated preview failed to start");
      const connectionFile = join(root, "agent/connection.json");
      const connection = JSON.parse(await readFile(connectionFile, "utf8"));
      const headers = {
        Authorization: `Bearer ${connection.token}`,
        "Content-Type": "application/json",
      };
      assert.equal(
        (
          await fetch(connection.mcpUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "initialize",
              params: {},
            }),
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await fetch(connection.mcpUrl, {
            method: "POST",
            headers: { ...headers, Origin: "https://example.com" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "initialize",
              params: {},
            }),
          })
        ).status,
        403,
      );
      for (const transport of [
        new StreamableHttpTransport({
          url: connection.mcpUrl,
          headers: { Authorization: `Bearer ${connection.token}` },
        }),
        new StdioTransport({
          command: executable,
          args: ["--mcp", "--connection", connectionFile],
          inheritEnv: true,
        }),
      ]) {
        const client = new McpClient({ name: "local-test", version: "1" });
        clients.push(client);
        await client.connect(transport);
        const tools = await client.listTools();
        for (const name of [
          "education",
          "list_skills",
          "get_education",
          "get_control_status",
          "set_external_control",
        ])
          assert.ok(
            tools.some((t) => t.name === name),
            name,
          );
        assert.ok(
          (await client.listResources()).some(
            (r) => r.uri === "tomato://skills/exam-authoring/SKILL.md",
          ),
        );
        assert.match(
          (
            await client.readResource(
              "tomato://skills/exam-authoring/references/material-roles.md",
            )
          ).contents[0].text,
          /真题/,
        );
        assert.ok(
          (await client.listResourceTemplates()).some((r) =>
            r.uriTemplate.includes("reference"),
          ),
        );
        assert.equal(
          (await client.request("prompts/list")).prompts[0].name,
          "take-over",
        );
        assert.match(
          (
            await client.request("prompts/get", {
              name: "take-over",
              arguments: { task: "本机测试" },
            })
          ).messages[0].content.text,
          /本机测试/,
        );
      }
      const value = async (name, args = {}) => {
        const result = await clients[0].callTool(name, args);
        assert.ok(!result.isError, JSON.stringify(result.content));
        return JSON.parse(result.content[0].text);
      };
      await value("set_external_control", { controller: "local-test" });
      assert.equal(
        (await value("get_control_status")).automaticExecutionPaused,
        true,
      );
      await value("set_external_control", { controller: null });
      assert.equal(
        (await value("get_control_status")).automaticExecutionPaused,
        false,
      );

      const data = snapshot.data,
        today = snapshot.today,
        projectId = data.projects[0].id;
      const at = (hour, minute = 0) =>
        Math.floor(
          new Date(
            `${today}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`,
          ).getTime() / 1000,
        );
      await mkdir(join(root, "materials"));
      data.visions = [
        { id: "test-vision", name: "测试目标", notes: "", projectId: null },
      ];
      data.education = {
        projects: [
          {
            projectId,
            directory: join(root, "materials"),
            examMode: true,
            visionId: "test-vision",
            target: "独立测试目标",
            examDate: null,
            syllabusId: "syllabus",
            pastPaperIds: ["past"],
            mockPaperIds: ["mock"],
          },
        ],
        resources: ["syllabus", "past", "mock"].map((id) => ({
          id,
          projectId,
          title: id,
          kind: { syllabus: "syllabus", past: "pastPaper", mock: "mockPaper" }[
            id
          ],
          path: `${id}.txt`,
          source: "测试材料",
          edition: "1",
          topics: ["测试主题"],
        })),
        semesters: [
          {
            id: "test-term",
            projectId,
            title: "测试周安排",
            startDate: today,
            endDate: today,
            revision: 1,
            baseline: "测试起点",
            evidence: ["测试资料"],
            rationale: "验证入口",
            milestones: [
              {
                week: 1,
                topics: ["测试主题"],
                resourceIds: ["mock"],
                objective: "测试目标",
                lessonCount: 1,
              },
            ],
          },
        ],
        semesterHistory: [],
        lessons: [
          {
            id: "test-lesson",
            projectId,
            semesterId: "test-term",
            semesterRevision: 1,
            title: "周安排课程入口",
            topics: ["测试主题"],
            resourceIds: ["mock"],
            startsAt: at(8),
            endsAt: at(8, 45),
            aiEnabled: true,
            attended: false,
            progress: "",
            state: "planned",
          },
        ],
        assessments: [
          {
            id: "test-homework",
            projectId,
            semesterId: "test-term",
            semesterRevision: 1,
            lessonId: null,
            taskId: "completed-source",
            retestOfGradeId: null,
            title: "周安排作业入口",
            kind: "homework",
            revision: 1,
            startsAt: at(0),
            endsAt: at(23, 59),
            instructions: "测试提交",
            reviewEvidence: "独立测试记录",
            questions: [
              {
                id: "test-q",
                prompt: "测试题面",
                topics: ["测试主题"],
                sourceIds: ["mock"],
                extension: true,
                estimatedMinutes: 5,
                answer: "测试答案",
                acceptableAlternatives: "等价表达",
                scoring: [
                  { id: "test-point", description: "测试评分点", points: 1 },
                ],
              },
            ],
            publishedAt: at(0),
            printedAt: null,
            startedAt: null,
            stoppedAt: null,
          },
        ],
        completedTasks: [
          {
            id: "completed-source",
            projectId,
            title: "已完成测试任务",
            notes: "",
            topics: ["测试主题"],
            completedAt: at(0),
          },
        ],
        submissions: [],
        grades: [],
        reviews: [],
        events: [],
        progress: [],
        corrections: [],
        focusTasks: [],
      };
      const imported = await fetch(`${base}/api/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "import", data }),
      });
      assert.ok(imported.ok, await imported.text());
      const lessons = await value("get_education", {
        collection: "lessons",
        projectId,
      });
      assert.equal(lessons.total, 1);
      const focus = await value("get_education", {
        collection: "focusTasks",
        projectId,
      });
      assert.equal(focus.total, 2);
      const homeworkTaskId = focus.records.find(
        (l) => l.kind === "homework",
      ).taskId;
      browser = await chromium.launch({
        headless: true,
        executablePath: process.env.CHROMIUM_PATH || "/usr/sbin/chromium",
      });
      const page = await browser.newPage({
        viewport: { width: 1280, height: 1000 },
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(base);
      await expect(page.locator(".today-list")).toContainText("周安排课程入口");
      await expect(page.locator(".today-list")).toContainText("周安排作业入口");
      const task = page.locator(`[data-task-id="${homeworkTaskId}"]`);
      await task.locator(".task-body").click();
      await expect(page.getByRole("dialog")).toContainText("测试题面");
      await page.locator("[data-study-submit]").click();
      await page
        .locator('#study-submit-form [name="answers"]')
        .fill("完成测试作业");
      await page.locator('#study-submit-form button[type="submit"]').click();
      await expect(page.locator(".today-list")).not.toContainText(
        "周安排作业入口",
      );
      await expect(page.locator(".today-list")).toContainText("周安排课程入口");
      assert.equal(errors.length, 0, errors.join("\n"));
      const after = await value("get_tasks", { projectId });
      assert.equal(
        after.tasks.filter((t) => t.id === homeworkTaskId).length,
        1,
      );
      assert.equal(
        after.tasks.find((t) => t.id === homeworkTaskId).completed,
        true,
      );
    } finally {
      await browser?.close();
      for (const client of clients) await client.close();
      server.kill("SIGTERM");
      await new Promise((r) =>
        server.exitCode !== null ? r() : server.once("exit", r),
      );
      await rm(root, { recursive: true, force: true });
    }
  },
);
