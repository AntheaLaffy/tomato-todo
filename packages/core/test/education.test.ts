//! 教育域测试：crates/core/src/education_tests.rs 的 18 条测试逐条移植。
//! 语义基准：docs/EDUCATION.md；被测实现：packages/core/src/{education,learning,teaching_tasks}.ts。
//!
//! ## 移植约定
//! - `at(day, h, m)` 用本机时区构造 2026-11 的时间戳（对应 Rust `Local.with_ymd_and_hms`）。
//! - `command()` 复刻 Rust 测试助手：clone → `AppData.apply(Education 命令)` → `validateEducationTransition` → 提交；
//!   失败时原 data 不动（对应 Rust 的 next 提交模式）。
//! - 普通 Action（toggleTask/deleteTask/importPlan 等）与 Rust 测试一样直接 `AppData.apply(...)`，错误即抛。
//! - 断言抛错不匹配文案（对应 Rust `is_err()`）；跨项目课程引用等场景 TS 在全量 `validate()` 阶段报错，
//!   与 Rust 的失败时机与回滚行为一致。
//!
//! ## 分歧清单（移植时逐条比对 crates/core/src/education.rs 的 apply/tick/validate_transition、
//! ## teaching_tasks.rs 的 materialize/complete/start、learning.rs 的 summaries/validate_transition）
//! 1. [适配，非语义分歧] Rust 用 SQLite Engine 验证「重启存活」；TS Engine 按 MIGRATION.md 以单 JSON 文件原子写持久化。
//!    本文件第 12、16 条测试改用临时 JSON 文件验证等价语义（事件与评分标准/订正记录在重开引擎后存活）。
//! 2. [实现缺陷，未改源码（超出本片范围），已上报 root] src/lock.ts 往返失败：serializeLockState 在 active 为
//!    null 时输出 "active": null，parseLockState 却把 null 直接交给 parseActiveLock 抛「锁机状态必须是对象」
//!    （Rust 对应 skip_serializing_if：active 为 None 时省略键）。教育域自身的解析/序列化（education/learning/
//!    teaching_tasks）逐字段核对无此问题。本文件第 5 条的 JSON 往返与第 12、16 条的引擎重启，
//!    在测试内按 Rust 语义抹掉 "active" 键（roundTrip / stripNullActiveLock）绕行，不修改源码。
//! 3. 教育域覆盖范围内未发现其它 TS 实现与 Rust 语义不符之处。

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  AppData,
  atLocal,
  checkUserAction,
  clone,
  Engine,
  examDeadline,
  parseAppData,
  parseCommand,
  parseEducation,
  parseTaskDraft,
  serializeAppData,
  summaries,
  validateEducationTransition,
} from "../src/index";

type Json = Record<string, any>;

/** 对应 Rust 测试的 `at(day, h, m)`：本机时区 2026-11。 */
function at(day: number, h: number, m: number): number {
  return atLocal(2026, 11, day, h, m);
}

/** 复刻 Rust 测试助手 `command()`：预检 + 执行 + 迁移校验，全部成功才提交。 */
function command(data: AppData, value: unknown, time: number): void {
  const next = clone(data);
  next.apply({ type: "education", command: parseCommand(value) }, time);
  validateEducationTransition(data.education, next.education);
  Object.assign(data, next);
}

/** 复刻 Rust `fixture()`：启用应试模式的默认项目 + 愿景/考纲/真题/模拟题 + 基础学期。 */
function fixture(): AppData {
  const data = new AppData();
  const p = data.projects[0]!.id;
  data.visions.push({
    id: "vision",
    name: "目标院校",
    notes: "2027年目标专业",
    projectId: null,
  });
  data.education = parseEducation({
    projects: [
      {
        projectId: p,
        directory: join(tmpdir(), "teaching-fixture"),
        examMode: true,
        visionId: "vision",
        target: "2027年目标院校计算机专业 数学一 120分",
        examDate: "2027-12-25",
        syllabusId: "syllabus",
        pastPaperIds: ["past"],
        mockPaperIds: ["mock"],
      },
    ],
    resources: [
      {
        id: "syllabus",
        projectId: p,
        title: "考纲",
        kind: "syllabus",
        path: "syllabus.pdf",
        source: "官方",
        edition: "2027",
        topics: ["极限"],
      },
      {
        id: "past",
        projectId: p,
        title: "真题",
        kind: "pastPaper",
        path: "past.pdf",
        source: "历年真题",
        edition: "2026",
        topics: ["极限"],
      },
      {
        id: "mock",
        projectId: p,
        title: "模拟题",
        kind: "mockPaper",
        path: "mock.pdf",
        source: "模拟卷",
        edition: "2027",
        topics: ["极限"],
      },
    ],
    semesters: [
      {
        id: "term",
        projectId: p,
        title: "基础学期",
        startDate: "2026-11-01",
        endDate: "2026-12-31",
        revision: 1,
        baseline: "极限基础薄弱",
        evidence: ["课程目录与官方考纲；同科目经验尚缺，待补"],
        rationale: "先补基础再限时训练",
        milestones: [
          {
            week: 1,
            topics: ["极限"],
            resourceIds: ["mock"],
            objective: "能独立处理基本极限",
            lessonCount: 4,
          },
        ],
      },
    ],
    lessons: [],
    assessments: [],
    submissions: [],
    grades: [],
    reviews: [],
    events: [],
  });
  data.validate();
  return data;
}

/** 复刻 Rust `lesson()`：45 分钟 AI 课程。 */
function lesson(data: AppData, id: string, start: number): Json {
  return {
    op: "saveLesson",
    lesson: {
      id,
      projectId: data.projects[0]!.id,
      semesterId: "term",
      title: "极限基础",
      topics: ["极限"],
      resourceIds: ["mock"],
      startsAt: start,
      endsAt: start + 2700,
      aiEnabled: true,
      attended: false,
      progress: "",
      state: "planned",
    },
  };
}

/** 复刻 Rust `finish_lesson()`：排课 → 上课确认参与 → 到点下课。 */
function finishLesson(data: AppData): void {
  command(data, lesson(data, "lesson", at(2, 8, 30)), at(1, 8, 0));
  command(
    data,
    { op: "attendLesson", id: "lesson", progress: "完成课程，概念待复测" },
    at(2, 8, 35),
  );
  data.tick(at(2, 9, 15));
  data.validate();
}

/** 复刻 Rust `assessment()`：单题（估时 180 分钟）发布包。 */
function assessment(data: AppData, kind: string): Json {
  return {
    op: "publishAssessment",
    assessment: {
      id: "assessment",
      projectId: data.projects[0]!.id,
      semesterId: "term",
      lessonId: "lesson",
      title: "极限练习",
      kind,
      revision: 1,
      startsAt: at(7, 19, 0),
      endsAt: at(7, 22, 0),
      instructions: "到点停笔，记录本机HH:MM",
      reviewEvidence: "独立复解并代入验证所有答案",
      questions: [
        {
          id: "q1",
          prompt: "求极限",
          topics: ["极限"],
          sourceIds: ["mock"],
          extension: false,
          estimatedMinutes: 180,
          answer: "1",
          acceptableAlternatives: "等价推导",
          scoring: [{ id: "p1", description: "正确使用极限法则", points: 5 }],
        },
      ],
      publishedAt: 0,
      printedAt: null,
      startedAt: null,
      stoppedAt: null,
    },
  };
}

/** 复刻 Rust `submit()` 助手（作业提交，含推导文本）。 */
function submit(
  data: AppData,
  id: string,
  assessmentId: string,
  time: number,
): void {
  command(
    data,
    {
      op: "submit",
      submission: {
        id,
        assessmentId,
        submittedAt: 0,
        resourceIds: [],
        answers: "我的推导",
        unfinished: false,
        questionTimes: [],
      },
    },
    time,
  );
}

/** 复刻 Rust `grade()` 助手（批改：2 分 + 一条待确认错因 + 复测日期）。 */
function grade(
  data: AppData,
  id: string,
  submissionId: string,
  time: number,
): void {
  command(
    data,
    {
      op: "grade",
      grade: {
        id,
        submissionId,
        assessmentRevision: 1,
        gradedAt: 0,
        awards: [
          {
            questionId: "q1",
            pointId: "p1",
            awarded: 2,
            evidence: "写出法则但计算有误",
          },
        ],
        errors: [
          {
            questionId: "q1",
            cause: "计算环节待核实",
            evidence: "答卷计算不一致",
            correction: "重新推导并检查",
            nextCheck: "独立做一道同类题",
            retestDate: "2026-11-08",
            confirmed: false,
          },
        ],
        needsReview: false,
        feedback: "需订正计算",
      },
    },
    time,
  );
}

/** 学情摘要第一条 assessment 的 status 快捷读取。 */
function firstStatus(data: AppData, time: number): string {
  const list = summaries(data, time)[0]!["assessments"] as Array<
    Record<string, unknown>
  >;
  return String(list[0]!["status"]);
}

/**
 * JSON 往返（分歧清单 #2 的测试内绕行）：serializeAppData 输出 "active": null，
 * 而 parseLockState 不接受 null；按 Rust skip_serializing_if 语义抹掉该键后再解析。
 */
function roundTrip(data: AppData): AppData {
  const raw = serializeAppData(data);
  delete (raw["lock"] as Record<string, unknown>)["active"];
  return parseAppData(raw);
}

/** 引擎重启前修整持久化文件（同上：抹掉 "active": null）。 */
function stripNullActiveLock(path: string): void {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  delete (raw["lock"] as Record<string, unknown>)["active"];
  writeFileSync(path, JSON.stringify(raw, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// 1. exam_configuration_requires_vision_syllabus_and_both_paper_types
// ---------------------------------------------------------------------------
test("exam_configuration_requires_vision_syllabus_and_both_paper_types", () => {
  const data = fixture();
  for (const field of ["visionId", "syllabusId"] as const) {
    const candidate = clone(data);
    candidate.education.projects[0]![field] = null;
    expect(() => candidate.validate()).toThrow();
  }
  const withoutMocks = clone(data);
  withoutMocks.education.projects[0]!.mockPaperIds = [];
  expect(() => withoutMocks.validate()).toThrow();
  const outsidePath = clone(data);
  outsidePath.education.resources[0]!.path = "../outside";
  expect(() => outsidePath.validate()).toThrow();
});

// ---------------------------------------------------------------------------
// 2. wall_clock_lessons_do_not_fabricate_attendance_or_mastery
// ---------------------------------------------------------------------------
test("wall_clock_lessons_do_not_fabricate_attendance_or_mastery", () => {
  let data = fixture();
  // 跨项目引用必须失败（lesson() 取自另一个 fixture 的项目 ID）。
  expect(() =>
    command(data, lesson(fixture(), "absent", at(2, 8, 30)), at(1, 8, 0)),
  ).toThrow();
  command(data, lesson(data, "absent", at(2, 8, 30)), at(1, 8, 0));
  data.tick(at(2, 9, 15));
  expect(data.education.lessons[0]!.state).toBe("missed");
  expect(data.education.events.some((e) => e.kind === "homework")).toBe(false);

  data = fixture();
  finishLesson(data);
  expect(data.education.lessons[0]!.state).toBe("ended");
  expect(
    data.education.events.filter((e) => e.kind === "homework").length,
  ).toBe(1);
  // 下课事件只产生一次；重复 tick 不重发。
  expect(data.tick(at(2, 9, 16))).toBe(false);
  expect(
    data.education.events.filter((e) => e.kind === "homework").length,
  ).toBe(1);
  expect(data.sessions.length).toBe(0);
});

// ---------------------------------------------------------------------------
// 3. scheduled_lessons_materialize_once_and_updates_keep_the_same_focus_task
// ---------------------------------------------------------------------------
test("scheduled_lessons_materialize_once_and_updates_keep_the_same_focus_task", () => {
  const data = fixture();
  expect(() =>
    command(data, lesson(fixture(), "bad", at(2, 8, 30)), at(1, 8, 0)),
  ).toThrow();
  const request = lesson(data, "focus-lesson", at(2, 8, 30));
  command(data, request, at(1, 8, 0));
  const task = data.tasks[0]!;
  expect(task.dueDate).toBe("2026-11-02");
  expect(task.reminderTime).toBe("08:30");
  expect(task.focusMinutes).toBe(45);
  expect(data.education.focusTasks.length).toBe(1);
  // 轮询不重复创建，也不制造变化。
  expect(data.tick(at(1, 8, 1))).toBe(false);

  // 改期更新同一任务，而不是新建。
  const revised = clone(request);
  revised["lesson"]["startsAt"] = at(3, 10, 0);
  revised["lesson"]["endsAt"] = at(3, 10, 45);
  command(data, revised, at(1, 8, 2));
  expect(data.tasks.length).toBe(1);
  expect(data.tasks[0]!.id).toBe(task.id);
  expect(data.tasks[0]!.dueDate).toBe("2026-11-03");

  // 计划导出排除教学待办；replace 导入保留它们；不能单独删除。
  const plan = data.exportPlan();
  expect(plan.tasks.length).toBe(0);
  plan.replace = true;
  data.apply({ type: "importPlan", plan }, at(1, 8, 3));
  expect(data.tasks[0]!.id).toBe(task.id);
  expect(() =>
    data.apply({ type: "deleteTask", id: task.id }, at(1, 8, 4)),
  ).toThrow();

  // 课程窗口内从今日专注开始 → 参与；勾选完成 → 快照；到点 → 下课作业事件。
  data.apply({ type: "selectTask", id: task.id }, at(3, 10, 0));
  data.apply({ type: "startTimer" }, at(3, 10, 0));
  expect(data.education.lessons[0]!.attended).toBe(true);
  data.apply({ type: "toggleTask", id: task.id }, at(3, 10, 10));
  data.tick(at(3, 10, 45));
  expect(
    data.education.events.filter((e) => e.kind === "homework").length,
  ).toBe(1);
  expect(data.education.events.some((e) => e.kind === "taskHomework")).toBe(
    false,
  );
  expect(data.education.completedTasks[0]!.topics).toEqual(["极限"]);
  expect(data.education.progress.length).toBe(0);
  data.validate();
});

// ---------------------------------------------------------------------------
// 4. course_resources_can_be_assigned_only_before_class_from_same_project
// ---------------------------------------------------------------------------
test("course_resources_can_be_assigned_only_before_class_from_same_project", () => {
  const data = fixture();
  command(data, lesson(data, "resources-lesson", at(2, 8, 30)), at(1, 8, 0));
  const taskId = data.education.focusTasks[0]!.taskId;
  const set = (ids: string[]): Json => ({
    op: "setLessonResources",
    id: "resources-lesson",
    resourceIds: ids,
  });
  command(data, set(["past", "syllabus"]), at(1, 8, 1));
  expect(data.education.lessons[0]!.resourceIds).toEqual(["past", "syllabus"]);
  // 换资料不换任务实例。
  expect(data.education.focusTasks[0]!.taskId).toBe(taskId);
  expect(data.tasks.length).toBe(1);

  const before = [...data.education.lessons[0]!.resourceIds];
  expect(() => command(data, set(["missing"]), at(1, 8, 2))).toThrow();
  expect(() => command(data, set(["past", "past"]), at(1, 8, 2))).toThrow();

  // 跨项目资料在命令层被拒，且不改动原数据。
  const another = clone(data);
  another.education.resources.push({
    ...clone(another.education.resources[0]!),
    id: "other-project-resource",
    projectId: "another-project",
  });
  expect(() =>
    another.education.apply(
      parseCommand(set(["other-project-resource"])),
      at(1, 8, 3),
    ),
  ).toThrow();
  expect(data.education.lessons[0]!.resourceIds).toEqual(before);

  // 开课后（含到点瞬间）与已参与课程都不能再改资料。
  expect(() => command(data, set(["mock"]), at(2, 8, 30))).toThrow();
  expect(data.education.lessons[0]!.resourceIds).toEqual(before);
  const attended = fixture();
  command(
    attended,
    lesson(attended, "resources-lesson", at(2, 8, 30)),
    at(1, 8, 0),
  );
  command(
    attended,
    { op: "attendLesson", id: "resources-lesson", progress: "已学" },
    at(2, 8, 31),
  );
  expect(() => command(attended, set(["mock"]), at(2, 8, 32))).toThrow();
  data.validate();
});

// ---------------------------------------------------------------------------
// 5. homework_focus_tasks_complete_only_with_a_finished_submission
// ---------------------------------------------------------------------------
test("homework_focus_tasks_complete_only_with_a_finished_submission", () => {
  const data = fixture();
  finishLesson(data);
  command(data, assessment(data, "homework"), at(7, 18, 0));
  const link = data.education.focusTasks.find((l) => l.kind === "homework")!;
  // 作业待办不能直接勾选完成。
  expect(() =>
    data.apply({ type: "toggleTask", id: link.taskId }, at(7, 19, 0)),
  ).toThrow();
  const cases: Array<[string, boolean]> = [
    ["part", true],
    ["finished", false],
  ];
  for (const [id, unfinished] of cases) {
    command(
      data,
      {
        op: "submit",
        submission: {
          id,
          assessmentId: "assessment",
          submittedAt: 0,
          resourceIds: [],
          answers: "已完成部分",
          unfinished,
          questionTimes: [],
        },
      },
      at(7, 19, unfinished ? 10 : 20),
    );
    expect(data.tasks.find((t) => t.id === link.taskId)!.completed).toBe(
      !unfinished,
    );
  }
  expect(data.sessions.some((s) => s.taskId === link.taskId)).toBe(false);
  expect(data.education.events.some((e) => e.kind === "taskHomework")).toBe(
    false,
  );
  // 关联与证据在 JSON 往返后原样存活（roundTrip 见分歧清单 #2）。
  const restored = roundTrip(data);
  expect(restored.education.focusTasks).toEqual(data.education.focusTasks);
  restored.validate();
});

// ---------------------------------------------------------------------------
// 6. an_automatic_course_timer_does_not_confirm_attendance
// ---------------------------------------------------------------------------
test("an_automatic_course_timer_does_not_confirm_attendance", () => {
  const data = fixture();
  data.settings.autoStartTasks = true;
  command(data, lesson(data, "automatic-lesson", at(2, 8, 30)), at(1, 8, 0));
  data.tick(at(2, 8, 30));
  expect(data.timer.running).toBe(true);
  expect(data.education.lessons[0]!.attended).toBe(false);
  expect(data.education.progress.length).toBe(0);
  expect(data.education.events.every((e) => e.kind !== "homework")).toBe(true);
});

// ---------------------------------------------------------------------------
// 7. cross_project_schedule_and_fixed_commitments_are_checked
// ---------------------------------------------------------------------------
test("cross_project_schedule_and_fixed_commitments_are_checked", () => {
  const data = fixture();
  command(data, lesson(data, "first", at(2, 8, 30)), at(1, 8, 0));
  // 课程时间重叠被拒。
  expect(() =>
    command(data, lesson(data, "second", at(2, 8, 45)), at(1, 8, 0)),
  ).toThrow();
  // 时长不是 45 分钟被拒。
  const wrong = lesson(data, "wrong", at(2, 10, 0));
  wrong["lesson"]["endsAt"] = at(2, 10, 30);
  expect(() => command(data, wrong, at(1, 8, 0))).toThrow();
  // 与需专心的固定占用冲突被拒（2026-11-02 是周一，10:00–11:00）。
  data.blocks.push({
    id: "fixed",
    title: "正式课",
    days: [1],
    start: "10:00",
    end: "11:00",
    attention: "required",
    notes: "",
  });
  expect(() =>
    command(data, lesson(data, "conflict", at(2, 10, 0)), at(1, 8, 0)),
  ).toThrow();
});

// ---------------------------------------------------------------------------
// 8. released_answers_and_rubrics_are_immutable_and_grades_use_evidence
// ---------------------------------------------------------------------------
test("released_answers_and_rubrics_are_immutable_and_grades_use_evidence", () => {
  const data = fixture();
  finishLesson(data);
  // 基础练习不能覆盖尚未授课的知识点。
  const packet = assessment(data, "homework");
  packet["assessment"]["questions"][0]["topics"] = ["尚未学过的积分"];
  expect(() => command(data, packet, at(2, 10, 0))).toThrow();

  // 发布包只能由助手生成，手动 Action 被拒。
  const packet2 = assessment(data, "homework");
  expect(() =>
    checkUserAction({ type: "education", command: parseCommand(packet2) }),
  ).toThrow();
  command(data, packet2, at(2, 10, 0));
  // 同 ID 重发被拒；已发布答案与评分标准不可改写。
  expect(() => command(data, packet2, at(2, 10, 1))).toThrow();
  const edited = clone(data.education);
  edited.assessments[0]!.questions[0]!.answer = "2";
  expect(() => validateEducationTransition(data.education, edited)).toThrow();

  command(
    data,
    {
      op: "submit",
      submission: {
        id: "sub",
        assessmentId: "assessment",
        submittedAt: 0,
        resourceIds: [],
        answers: "1",
        unfinished: false,
        questionTimes: [{ questionId: "q1", localTime: "21:35" }],
      },
    },
    at(7, 22, 0),
  );
  const gradeCmd: Json = {
    op: "grade",
    grade: {
      id: "grade",
      submissionId: "sub",
      assessmentRevision: 1,
      gradedAt: 0,
      awards: [
        {
          questionId: "q1",
          pointId: "p1",
          awarded: 5,
          evidence: "答卷写明极限法则并得到1",
        },
      ],
      errors: [],
      needsReview: false,
      feedback: "推导与答案均正确",
    },
  };
  // 超分（6 > 5）被拒；证据齐全的批改通过。
  const wrongGrade = clone(gradeCmd);
  wrongGrade["grade"]["awards"][0]["awarded"] = 6;
  expect(() => command(data, wrongGrade, at(7, 22, 1))).toThrow();
  command(data, gradeCmd, at(7, 22, 1));
  // 次日 08:30 后 tick 补每日复盘事件。
  data.tick(at(8, 8, 30));
  expect(data.education.events.some((e) => e.kind === "review")).toBe(true);
});

// ---------------------------------------------------------------------------
// 9. assistant_adds_only_missing_paper_times_before_grading
// ---------------------------------------------------------------------------
test("assistant_adds_only_missing_paper_times_before_grading", () => {
  const data = fixture();
  finishLesson(data);
  const packet = assessment(data, "homework");
  const second = clone(packet["assessment"]["questions"][0]);
  second["id"] = "q2";
  second["scoring"][0]["id"] = "p2";
  packet["assessment"]["questions"].push(second);
  command(data, packet, at(2, 10, 0));
  command(
    data,
    {
      op: "submit",
      submission: {
        id: "paper",
        assessmentId: "assessment",
        submittedAt: 0,
        resourceIds: [],
        answers: "答题卡已写完成时刻",
        unfinished: false,
        questionTimes: [{ questionId: "q1", localTime: "18:42" }],
      },
    },
    at(7, 19, 1),
  );

  const supplement: Json = {
    op: "recordQuestionTimes",
    id: "paper",
    questionTimes: [{ questionId: "q2", localTime: "18:51" }],
  };
  // 补录是助手专属命令。
  expect(() =>
    checkUserAction({ type: "education", command: parseCommand(supplement) }),
  ).toThrow();
  // 时刻必须是不依赖地区设置的 HH:MM 文本。
  const invalid = clone(supplement);
  invalid["questionTimes"][0]["localTime"] = "06:51 PM";
  expect(() => command(data, invalid, at(7, 19, 2))).toThrow();
  expect(data.education.submissions[0]!.questionTimes.length).toBe(1);
  expect(data.education.submissions[0]!.questionTimes[0]!.localTime).toBe(
    "18:42",
  );

  command(data, supplement, at(7, 19, 2));
  expect(data.education.submissions[0]!.questionTimes[0]!.localTime).toBe(
    "18:42",
  );
  expect(data.education.submissions[0]!.questionTimes[1]!.localTime).toBe(
    "18:51",
  );
  // 已有时刻不能覆盖；提交的其他内容与已有时刻不可改写。
  expect(() => command(data, supplement, at(7, 19, 3))).toThrow();
  const modified = clone(data.education);
  modified.submissions[0]!.questionTimes[1]!.localTime = "18:52";
  expect(() => validateEducationTransition(data.education, modified)).toThrow();
  const tampered = clone(data.education);
  tampered.submissions[0]!.answers = "篡改答卷";
  expect(() => validateEducationTransition(data.education, tampered)).toThrow();

  command(
    data,
    {
      op: "grade",
      grade: {
        id: "grade",
        submissionId: "paper",
        assessmentRevision: 1,
        gradedAt: 0,
        awards: [
          {
            questionId: "q1",
            pointId: "p1",
            awarded: 5,
            evidence: "答题卡写明极限法则",
          },
          {
            questionId: "q2",
            pointId: "p2",
            awarded: 5,
            evidence: "答题卡写明极限法则",
          },
        ],
        errors: [],
        needsReview: false,
        feedback: "正确",
      },
    },
    at(7, 19, 4),
  );
  // 批改后禁止补录完成时刻。
  expect(() =>
    command(
      data,
      {
        op: "recordQuestionTimes",
        id: "paper",
        questionTimes: [{ questionId: "q2", localTime: "18:52" }],
      },
      at(7, 19, 5),
    ),
  ).toThrow();
});

// ---------------------------------------------------------------------------
// 10. exam_requires_printing_stops_at_deadline_and_collects_paper
// ---------------------------------------------------------------------------
test("exam_requires_printing_stops_at_deadline_and_collects_paper", () => {
  const data = fixture();
  finishLesson(data);
  command(data, assessment(data, "weeklyExam"), at(6, 10, 0));
  // 未确认打印不能开考。
  expect(() =>
    command(data, { op: "startExam", id: "assessment" }, at(7, 19, 0)),
  ).toThrow();
  command(data, { op: "confirmPrinted", id: "assessment" }, at(7, 18, 0));
  command(data, { op: "startExam", id: "assessment" }, at(7, 19, 0));
  // 到点自动停笔（截止 22:00）。
  data.tick(at(7, 22, 5));
  expect(data.education.assessments[0]!.stoppedAt).toBe(at(7, 22, 0));
  // 纸质答题卡必须包含项目资源附件。
  expect(() =>
    command(
      data,
      {
        op: "submit",
        submission: {
          id: "sub",
          assessmentId: "assessment",
          submittedAt: 0,
          resourceIds: [],
          answers: "1",
          unfinished: false,
          questionTimes: [],
        },
      },
      at(7, 22, 5),
    ),
  ).toThrow();
});

// ---------------------------------------------------------------------------
// 11. exam_start_is_flexible_within_day_but_duration_and_submission_are_separate
// ---------------------------------------------------------------------------
test("exam_start_is_flexible_within_day_but_duration_and_submission_are_separate", () => {
  const data = fixture();
  finishLesson(data);
  command(data, assessment(data, "mockExam"), at(6, 10, 0));
  command(data, { op: "confirmPrinted", id: "assessment" }, at(6, 18, 0));
  // 只能在安排当天开考。
  expect(() =>
    command(data, { op: "startExam", id: "assessment" }, at(6, 23, 0)),
  ).toThrow();

  const evening = clone(data);
  // 考试日当天任意时刻开考，时长固定 3 小时。
  command(data, { op: "startExam", id: "assessment" }, at(7, 9, 0));
  expect(examDeadline(data.education.assessments[0]!)).toBe(at(7, 12, 0));
  data.tick(at(7, 11, 59));
  expect(data.education.assessments[0]!.stoppedAt).toBeNull();
  data.tick(at(7, 12, 1));
  expect(data.education.assessments[0]!.stoppedAt).toBe(at(7, 12, 0));
  expect(firstStatus(data, at(7, 12, 1))).toBe("awaitingSubmission");
  // 停笔后自行决定交卷时间；晚交不算逾期作答。
  command(
    data,
    {
      op: "submit",
      submission: {
        id: "later-paper",
        assessmentId: "assessment",
        submittedAt: 0,
        resourceIds: ["mock"],
        answers: "停笔时的答卷",
        unfinished: false,
        questionTimes: [],
      },
    },
    at(9, 11, 0),
  );
  const summary = summaries(data, at(9, 11, 0));
  const submitted = (
    summary[0]!["assessments"] as Array<Record<string, unknown>>
  )[0]!;
  expect(submitted["status"]).toBe("submitted");
  expect(submitted["late"]).toBe(false);

  // 晚间开考跨午夜按固定时长停笔。
  command(evening, { op: "startExam", id: "assessment" }, at(7, 23, 30));
  expect(examDeadline(evening.education.assessments[0]!)).toBe(at(8, 2, 30));
  evening.tick(at(8, 2, 29));
  expect(evening.education.assessments[0]!.stoppedAt).toBeNull();
  evening.tick(at(8, 2, 31));
  expect(evening.education.assessments[0]!.stoppedAt).toBe(at(8, 2, 30));
  expect(firstStatus(evening, at(8, 2, 31))).toBe("awaitingSubmission");

  // 未开考且安排日期已过 → 缺考；当天结束前仍是 upcoming。
  const missed = fixture();
  finishLesson(missed);
  command(missed, assessment(missed, "mockExam"), at(6, 10, 0));
  expect(firstStatus(missed, at(7, 23, 59))).toBe("upcoming");
  expect(firstStatus(missed, at(8, 0, 0))).toBe("missed");
  expect(() =>
    command(missed, { op: "startExam", id: "assessment" }, at(8, 0, 0)),
  ).toThrow();

  // 安排当天晚间发布也能开考，时长仍固定。
  const latePublish = fixture();
  finishLesson(latePublish);
  command(latePublish, assessment(latePublish, "mockExam"), at(7, 22, 30));
  command(
    latePublish,
    { op: "confirmPrinted", id: "assessment" },
    at(7, 22, 31),
  );
  command(latePublish, { op: "startExam", id: "assessment" }, at(7, 23, 0));
  expect(examDeadline(latePublish.education.assessments[0]!)).toBe(at(8, 2, 0));
});

// ---------------------------------------------------------------------------
// 12. teaching_events_and_rubrics_survive_sqlite_restart
//     （TS 引擎按 MIGRATION.md 用单 JSON 文件原子写持久化，见文件头分歧清单）
// ---------------------------------------------------------------------------
test("teaching_events_and_rubrics_survive_sqlite_restart", () => {
  const dir = mkdtempSync(join(tmpdir(), "education-restart-"));
  try {
    const path = join(dir, "education.json");
    const data = fixture();
    finishLesson(data);
    command(data, assessment(data, "homework"), at(2, 10, 0));
    {
      const engine = Engine.open(path);
      engine.dispatch({ type: "import", data }, at(2, 10, 0));
    }
    stripNullActiveLock(path); // 分歧清单 #2 的绕行，见文件头。
    const engine = Engine.open(path);
    const snapshot = engine.snapshot(at(2, 10, 0));
    expect(snapshot.data.education.assessments[0]!.questions[0]!.answer).toBe(
      "1",
    );
    expect(
      snapshot.data.education.events.some((e) => e.kind === "homework"),
    ).toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 13. new_projects_require_directory_and_lessons_keep_their_plan_revision
// ---------------------------------------------------------------------------
test("new_projects_require_directory_and_lessons_keep_their_plan_revision", () => {
  const engine = Engine.open(":memory:");
  // 新项目必须绑定资料目录。
  expect(() =>
    engine.dispatch(
      {
        type: "saveProject",
        id: null,
        name: "新项目",
        color: "#849b7d",
        directory: null,
      },
      at(1, 8, 0),
    ),
  ).toThrow();

  const data = fixture();
  command(data, lesson(data, "lesson", at(2, 8, 30)), at(1, 8, 0));
  // 学期计划升级版本：旧版进历史，既有课程保留原修订号。
  const revision = clone(data.education.semesters[0]!);
  revision.revision = 2;
  revision.rationale = "根据诊断调整后续课时，保留原授课依据";
  command(data, { op: "saveSemester", semester: revision }, at(1, 9, 0));
  expect(data.education.lessons[0]!.semesterRevision).toBe(1);
  expect(data.education.semesterHistory[0]!.revision).toBe(1);
  expect(data.education.semesters[0]!.revision).toBe(2);
});

// ---------------------------------------------------------------------------
// 14. completed_learning_task_creates_one_durable_homework_event_and_snapshot
// ---------------------------------------------------------------------------
test("completed_learning_task_creates_one_durable_homework_event_and_snapshot", () => {
  const data = fixture();
  data.apply(
    {
      type: "saveTask",
      task: parseTaskDraft({
        title: "极限第1讲",
        projectId: data.projects[0]!.id,
        dueDate: "2026-11-02",
        tags: ["极限"],
        notes: "视频已听完，习题待做",
      }),
    },
    at(2, 8, 0),
  );
  const id = data.tasks[0]!.id;
  data.apply({ type: "toggleTask", id }, at(2, 9, 0));
  expect(data.education.completedTasks.length).toBe(1);
  expect(
    data.education.events.some(
      (e) => e.kind === "taskHomework" && e.sourceId === id,
    ),
  ).toBe(true);

  // 没有实际产物不能完成事件；撤销/重完成不重复记录快照。
  const eventId = `taskHomework:${id}`;
  expect(() =>
    command(data, { op: "finishEvent", id: eventId }, at(2, 9, 1)),
  ).toThrow();
  data.apply({ type: "toggleTask", id }, at(2, 9, 2));
  data.apply({ type: "toggleTask", id }, at(2, 9, 3));
  expect(data.education.completedTasks.length).toBe(1);
  // 删除任务不影响来源追溯。
  data.apply({ type: "deleteTask", id }, at(2, 9, 4));
  expect(data.education.completedTasks[0]!.title).toBe("极限第1讲");

  // 作业以 taskId 关联原任务、lessonId 为空；完成后事件可关闭。
  const packet = assessment(data, "homework");
  packet["assessment"]["lessonId"] = null;
  packet["assessment"]["taskId"] = id;
  command(data, packet, at(2, 10, 0));
  command(data, { op: "finishEvent", id: eventId }, at(2, 10, 1));
  expect(data.education.events.find((e) => e.id === eventId)!.state).toBe(
    "done",
  );

  // 快照内容不可改写。
  const before = clone(data.education);
  data.education.completedTasks[0]!.title = "篡改";
  expect(() => validateEducationTransition(before, data.education)).toThrow();
});

// ---------------------------------------------------------------------------
// 15. progress_is_timestamped_versioned_and_never_infers_mastery_from_time
// ---------------------------------------------------------------------------
test("progress_is_timestamped_versioned_and_never_infers_mastery_from_time", () => {
  const data = fixture();
  const projectId = data.projects[0]!.id;
  const records: Array<[string, string, number]> = [
    ["old", "第1讲", at(2, 8, 0)],
    ["new", "第2讲", at(2, 9, 0)],
  ];
  for (const [id, position, time] of records) {
    command(
      data,
      {
        op: "recordProgress",
        record: {
          id,
          projectId,
          topic: "极限",
          position,
          state: "practicing",
          evidence: "本人记录，习题尚未验证",
          nextAction: "完成基础题",
          source: "assistant",
          confirmed: true,
          recordedAt: 0,
        },
      },
      time,
    );
  }
  // 助手记录的进度须由本人确认；时间戳以保存时刻为准。
  expect(data.education.progress[1]!.confirmed).toBe(false);
  expect(data.education.progress[1]!.recordedAt).toBe(at(2, 9, 0));
  const summary = summaries(data, at(2, 10, 0));
  expect(summary[0]!["progress"]).toMatchObject([{ position: "第2讲" }]);
  expect(summary[0]!["progressCount"]).toBe(2);
  expect(summary[0]!["assessments"]).toEqual([]);

  command(data, { op: "confirmProgress", id: "new" }, at(2, 10, 0));
  expect(data.education.progress[1]!.confirmed).toBe(true);
  // 历史不可原地改写，只能新增更正记录。
  const before = clone(data.education);
  data.education.progress[1]!.position = "已掌握";
  expect(() => validateEducationTransition(before, data.education)).toThrow();
});

// ---------------------------------------------------------------------------
// 16. submission_revision_grading_correction_and_retest_keep_original_evidence
// ---------------------------------------------------------------------------
test("submission_revision_grading_correction_and_retest_keep_original_evidence", () => {
  const data = fixture();
  finishLesson(data);
  command(data, assessment(data, "homework"), at(7, 18, 0));
  submit(data, "sub", "assessment", at(7, 20, 0));
  grade(data, "grade", "sub", at(7, 20, 1));
  expect(firstStatus(data, at(7, 20, 1))).toBe("correctionDue");

  // 订正提交清空检查结果；检查前事件不能完成。
  command(
    data,
    {
      op: "submitCorrection",
      correction: {
        id: "fix",
        gradeId: "grade",
        questionId: "q1",
        explanation: "重新计算并检查符号",
        resourceIds: [],
        submittedAt: 0,
        accepted: true,
        feedback: "伪造检查",
        reviewedAt: 1,
      },
    },
    at(7, 20, 2),
  );
  expect(data.education.corrections[0]!.accepted).toBeNull();
  expect(() =>
    command(data, { op: "finishEvent", id: "correction:fix" }, at(7, 20, 3)),
  ).toThrow();
  command(
    data,
    {
      op: "reviewCorrection",
      id: "fix",
      accepted: true,
      feedback: "推导已修正，安排独立复测",
    },
    at(7, 20, 3),
  );
  command(data, { op: "finishEvent", id: "correction:fix" }, at(7, 20, 4));
  // 检查结果单向推进，不能改写。
  expect(() =>
    command(
      data,
      {
        op: "reviewCorrection",
        id: "fix",
        accepted: false,
        feedback: "改写旧记录",
      },
      at(7, 20, 5),
    ),
  ).toThrow();

  // 复测必须关联原始批改；通过后进入复测列表。
  const retest = assessment(data, "retest");
  retest["assessment"]["id"] = "retest";
  retest["assessment"]["lessonId"] = null;
  retest["assessment"]["startsAt"] = at(8, 19, 0);
  retest["assessment"]["endsAt"] = at(8, 20, 0);
  expect(() => command(data, retest, at(7, 20, 5))).toThrow();
  retest["assessment"]["retestOfGradeId"] = "grade";
  command(data, retest, at(7, 20, 5));
  const summary = summaries(data, at(7, 20, 6));
  expect(summary[0]!["retests"]).toMatchObject([
    { correctionAccepted: true, attempts: [{ status: "upcoming" }] },
  ]);

  // 同秒重交创建新版本，需要新的批改。
  submit(data, "sub2", "assessment", at(7, 20, 0));
  const summary2 = summaries(data, at(7, 20, 7));
  const homework = (
    summary2[0]!["assessments"] as Array<Record<string, unknown>>
  ).find((a) => a["id"] === "assessment")!;
  expect(homework["status"]).toBe("submitted");
  expect(homework["score"]).toBeNull();
  expect(data.education.grades.length).toBe(1);
  expect(data.education.submissions.length).toBe(2);

  // 订正检查结果与复测关系在重启后存活（TS 引擎以 JSON 文件持久化）。
  const dir = mkdtempSync(join(tmpdir(), "learning-restart-"));
  try {
    const path = join(dir, "learning.json");
    {
      const engine = Engine.open(path);
      engine.dispatch({ type: "import", data }, at(7, 20, 7));
    }
    stripNullActiveLock(path); // 分歧清单 #2 的绕行，见文件头。
    const engine = Engine.open(path);
    const snapshot = engine.snapshot(at(7, 20, 7));
    expect(snapshot.data.education.corrections[0]!.accepted).toBe(true);
    expect(
      (snapshot.studyProgress[0] as Record<string, unknown>)[
        "retests"
      ] as unknown[],
    ).toHaveLength(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 17. exam_can_end_early_but_cannot_submit_before_stopping
// ---------------------------------------------------------------------------
test("exam_can_end_early_but_cannot_submit_before_stopping", () => {
  const data = fixture();
  finishLesson(data);
  command(data, assessment(data, "weeklyExam"), at(6, 18, 0));
  command(data, { op: "confirmPrinted", id: "assessment" }, at(7, 18, 0));
  command(data, { op: "startExam", id: "assessment" }, at(7, 19, 0));
  const sub = {
    op: "submit",
    submission: {
      id: "sub",
      assessmentId: "assessment",
      resourceIds: [],
      answers: "文本",
      unfinished: false,
      submittedAt: 0,
      questionTimes: [],
    },
  };
  // 开考中未停笔不能提交；提前结束停笔后才能交卷。
  expect(() => command(data, sub, at(7, 19, 10))).toThrow();
  command(data, { op: "endExam", id: "assessment" }, at(7, 19, 30));
  expect(data.education.assessments[0]!.stoppedAt).toBe(at(7, 19, 30));
  // 考试答卷仍必须含项目资源附件。
  expect(() => command(data, sub, at(7, 19, 31))).toThrow();
});

// ---------------------------------------------------------------------------
// 18. resource_cleanup_retains_archived_plan_references_and_is_atomic
// ---------------------------------------------------------------------------
test("resource_cleanup_retains_archived_plan_references_and_is_atomic", () => {
  const data = fixture();
  const extra = clone(data.education.resources[0]!);
  extra.id = "unused";
  data.education.resources.push(extra);
  // 任一引用使整批清理失败，原子回滚。
  expect(() =>
    command(
      data,
      { op: "removeResources", ids: ["unused", "mock"] },
      at(1, 8, 0),
    ),
  ).toThrow();
  expect(data.education.resources.some((r) => r.id === "unused")).toBe(true);

  // 升级学期计划后，「mock」只被归档 v1 计划引用。
  const revised = clone(data.education.semesters[0]!);
  revised.revision += 1;
  revised.milestones[0]!.resourceIds = ["past"];
  command(data, { op: "saveSemester", semester: revised }, at(1, 8, 0));
  data.education.projects[0]!.examMode = false;
  data.education.projects[0]!.mockPaperIds = [];
  expect(
    data.education.resourceReferences("mock").some((r) => r.includes("v1")),
  ).toBe(true);
  expect(() =>
    command(data, { op: "removeResources", ids: ["mock"] }, at(1, 8, 0)),
  ).toThrow();

  // 无引用的登记可以清理；被历史引用的登记导入/补丁也不能删除。
  command(data, { op: "removeResources", ids: ["unused"] }, at(1, 8, 0));
  expect(data.education.resources.some((r) => r.id === "unused")).toBe(false);
  const removed = clone(data.education);
  removed.resources = removed.resources.filter((r) => r.id !== "mock");
  expect(() => validateEducationTransition(data.education, removed)).toThrow();
});
