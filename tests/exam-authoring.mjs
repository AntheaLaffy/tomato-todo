import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const checker = resolve("agent/skills/exam-authoring/scripts/check_paper.py");
const basePaper = () => ({
  title: "局部技能测试",
  instructions: "30分钟，10分；此数据仅验证结构检查器。",
  reviewEvidence: "测试输入不构成真实试卷的审校结论。",
  startsAt: 1000,
  endsAt: 2800,
  questions: [
    {
      id: "q1",
      prompt: "计算2与4的算术平均数。",
      topics: ["算术平均数"],
      sourceIds: ["resource-1"],
      extension: false,
      estimatedMinutes: 3,
      answer: "3",
      acceptableAlternatives: "等值数值表达均可。",
      scoring: [
        { id: "p1", description: "正确列出(2+4)/2", points: 4 },
        { id: "p2", description: "正确计算结果", points: 6 },
      ],
    },
  ],
});

test("paper checker catches blueprint drift, broken references and scoring errors", async () => {
  const root = await mkdtemp(join(tmpdir(), "tomato-paper-check-"));
  const paperPath = join(root, "paper.json");
  const sourcesPath = join(root, "sources.json");
  const run = async (paper, sources = ["resource-1"]) => {
    await writeFile(paperPath, JSON.stringify(paper));
    await writeFile(sourcesPath, JSON.stringify(sources));
    const result = spawnSync(
      "python3",
      [
        checker,
        paperPath,
        "--points",
        "10",
        "--questions",
        "1",
        "--minutes",
        "30",
        "--sources",
        sourcesPath,
      ],
      { encoding: "utf8" },
    );
    assert.ifError(result.error);
    return { status: result.status, output: JSON.parse(result.stdout) };
  };
  try {
    const valid = await run(basePaper());
    assert.equal(valid.status, 0);
    assert.deepEqual(valid.output.summary, {
      questionCount: 1,
      points: 10,
      estimatedMinutes: 3,
      windowMinutes: 30,
    });
    const cases = [
      [
        (p) => p.questions.push(structuredClone(p.questions[0])),
        /题数|重复题目ID|重复题面/,
      ],
      [(p) => p.questions[0].scoring[0].points++, /总分/],
      [(p) => p.questions[0].sourceIds.push("invented-id"), /未登记来源/],
      [(p) => (p.questions[0].estimatedMinutes = 31), /估时合计/],
      [(p) => p.endsAt++, /窗口/],
      [(p) => (p.questions[0].scoring[1].id = "p1"), /重复评分点/],
      [(p) => (p.questions[0].scoring[0].points = true), /正整数/],
      [
        (p) => (p.questions[0].acceptableAlternatives = ""),
        /acceptableAlternatives/,
      ],
      [(p) => (p.questions[0].sourceIds = []), /sourceIds/],
      [(p) => (p.reviewEvidence = ""), /reviewEvidence/],
    ];
    for (const [mutate, expected] of cases) {
      const paper = basePaper();
      mutate(paper);
      const result = await run(paper);
      assert.equal(result.status, 1);
      assert.equal(result.output.ok, false);
      assert.match(result.output.errors.join("\n"), expected);
    }
    const badSources = await run(basePaper(), { id: "resource-1" });
    assert.equal(badSources.status, 2);
    assert.match(badSources.output.inputError, /来源文件/);
    await writeFile(paperPath, "{invalid json");
    const malformed = spawnSync(
      "python3",
      [
        checker,
        paperPath,
        "--points",
        "10",
        "--questions",
        "1",
        "--minutes",
        "30",
        "--sources",
        sourcesPath,
      ],
      { encoding: "utf8" },
    );
    assert.equal(malformed.status, 2);
    assert.equal(JSON.parse(malformed.stdout).ok, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
