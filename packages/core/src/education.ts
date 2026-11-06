//! 教学实体、持久化事件、资源引用与历史保护。
//! 对应 crates/core/src/education.rs。

import { AppError, ensure } from "./errors";
import {
  asArray,
  asBool,
  asInt,
  asOpt,
  asStr,
  field,
  isObject,
  oneOf,
  rejectUnknown,
  requiredField,
} from "./json";
import type {
  Assessment,
  AssessmentKind,
  Correction,
  ErrorAnalysis,
  Grade,
  Lesson,
  LessonState,
  Milestone,
  PointAward,
  ProgressRecord,
  ProgressSource,
  ProjectStudy,
  Question,
  QuestionTime,
  Resource,
  ResourceKind,
  Review,
  ScoringPoint,
  Semester,
  Submission,
  TeachingEvent,
} from "./model";
import type { AppData } from "./lib";
import type { CompletedStudyTask, Task } from "./model";
import { daysBetween, dateAt, localDateOf, minutesOf, parseDate, validDate, weekdayMonday } from "./time";
import {
  parseCompletedStudyTask,
  serializeCompletedStudyTask,
  validateLearning,
  validateLearningTransition,
} from "./learning";
import { overlapMinutes as overlapMinutesOfBlock } from "./blocks";

// ---------- 命令 ----------

export type Command =
  | { op: "saveProject"; project: ProjectStudy }
  | { op: "saveResource"; resource: Resource }
  | { op: "removeResources"; ids: string[] }
  | { op: "saveSemester"; semester: Semester }
  | { op: "saveLesson"; lesson: Lesson }
  | { op: "setLessonResources"; id: string; resourceIds: string[] }
  | { op: "attendLesson"; id: string; progress: string }
  | { op: "publishAssessment"; assessment: Assessment }
  | { op: "confirmPrinted"; id: string }
  | { op: "startExam"; id: string }
  | { op: "endExam"; id: string }
  | { op: "submit"; submission: Submission }
  | { op: "recordQuestionTimes"; id: string; questionTimes: QuestionTime[] }
  | { op: "grade"; grade: Grade }
  | { op: "saveReview"; review: Review }
  | { op: "claimEvent"; id: string }
  | { op: "finishEvent"; id: string }
  | { op: "retryEvent"; id: string }
  | { op: "recordProgress"; record: ProgressRecord }
  | { op: "confirmProgress"; id: string }
  | { op: "submitCorrection"; correction: Correction }
  | { op: "reviewCorrection"; id: string; accepted: boolean; feedback: string };

const COMMAND_KEYS: Record<string, string[]> = {
  saveProject: ["op", "project"],
  saveResource: ["op", "resource"],
  removeResources: ["op", "ids"],
  saveSemester: ["op", "semester"],
  saveLesson: ["op", "lesson"],
  setLessonResources: ["op", "id", "resourceIds"],
  attendLesson: ["op", "id", "progress"],
  publishAssessment: ["op", "assessment"],
  confirmPrinted: ["op", "id"],
  startExam: ["op", "id"],
  endExam: ["op", "id"],
  submit: ["op", "submission"],
  recordQuestionTimes: ["op", "id", "questionTimes"],
  grade: ["op", "grade"],
  saveReview: ["op", "review"],
  claimEvent: ["op", "id"],
  finishEvent: ["op", "id"],
  retryEvent: ["op", "id"],
  recordProgress: ["op", "record"],
  confirmProgress: ["op", "id"],
  submitCorrection: ["op", "correction"],
  reviewCorrection: ["op", "id", "accepted", "feedback"],
};

export function parseCommand(raw: unknown): Command {
  if (!isObject(raw)) throw new AppError("教学命令必须是对象");
  const op = oneOf(requiredField(raw, "op", "教学命令", (v) => v), "教学命令 op", Object.keys(COMMAND_KEYS));
  rejectUnknown(raw, COMMAND_KEYS[op]!, "教学命令");
  switch (op) {
    case "saveProject":
      return { op, project: parseProjectStudy(requiredField(raw, "project", "教学命令", (v) => v)) };
    case "saveResource":
      return { op, resource: parseResource(requiredField(raw, "resource", "教学命令", (v) => v)) };
    case "removeResources":
      return { op, ids: asArray(requiredField(raw, "ids", "教学命令", (v) => v), "ids").map((x) => asStr(x, "资源 ID")) };
    case "saveSemester":
      return { op, semester: parseSemester(requiredField(raw, "semester", "教学命令", (v) => v)) };
    case "saveLesson":
      return { op, lesson: parseLesson(requiredField(raw, "lesson", "教学命令", (v) => v)) };
    case "setLessonResources":
      return {
        op,
        id: requiredField(raw, "id", "教学命令", asStr),
        resourceIds: asArray(requiredField(raw, "resourceIds", "教学命令", (v) => v), "resourceIds").map((x) => asStr(x, "资源 ID")),
      };
    case "attendLesson":
      return { op, id: requiredField(raw, "id", "教学命令", asStr), progress: requiredField(raw, "progress", "教学命令", asStr) };
    case "publishAssessment":
      return { op, assessment: parseAssessment(requiredField(raw, "assessment", "教学命令", (v) => v)) };
    case "confirmPrinted":
    case "startExam":
    case "endExam":
    case "claimEvent":
    case "finishEvent":
    case "retryEvent":
    case "confirmProgress":
      return { op, id: requiredField(raw, "id", "教学命令", asStr) };
    case "submit":
      return { op, submission: parseSubmission(requiredField(raw, "submission", "教学命令", (v) => v)) };
    case "recordQuestionTimes":
      return {
        op,
        id: requiredField(raw, "id", "教学命令", asStr),
        questionTimes: asArray(requiredField(raw, "questionTimes", "教学命令", (v) => v), "questionTimes").map(parseQuestionTime),
      };
    case "grade":
      return { op, grade: parseGrade(requiredField(raw, "grade", "教学命令", (v) => v)) };
    case "saveReview":
      return { op, review: parseReview(requiredField(raw, "review", "教学命令", (v) => v)) };
    case "recordProgress":
      return { op, record: parseProgressRecord(requiredField(raw, "record", "教学命令", (v) => v)) };
    case "submitCorrection":
      return { op, correction: parseCorrection(requiredField(raw, "correction", "教学命令", (v) => v)) };
    case "reviewCorrection":
      return {
        op,
        id: requiredField(raw, "id", "教学命令", asStr),
        accepted: requiredField(raw, "accepted", "教学命令", asBool),
        feedback: requiredField(raw, "feedback", "教学命令", asStr),
      };
    default:
      throw new AppError(`教学命令取值无效：${op}`);
  }
}

/** 助手专属命令：课程、作业、试卷和批改只能由学习助手生成。 */
export function assistantOnly(command: Command): boolean {
  return [
    "saveSemester",
    "saveLesson",
    "publishAssessment",
    "grade",
    "recordQuestionTimes",
    "saveReview",
    "finishEvent",
    "claimEvent",
    "reviewCorrection",
  ].includes(command.op);
}

// ---------- 实体解析/序列化 ----------

export function parseProjectStudy(raw: unknown): ProjectStudy {
  if (!isObject(raw)) throw new AppError("教学项目必须是对象");
  rejectUnknown(raw, ["projectId", "directory", "examMode", "visionId", "target", "examDate", "syllabusId", "pastPaperIds", "mockPaperIds"], "教学项目");
  return {
    projectId: requiredField(raw, "projectId", "教学项目", asStr),
    directory: requiredField(raw, "directory", "教学项目", asStr),
    examMode: requiredField(raw, "examMode", "教学项目", asBool),
    visionId: field(raw, "visionId", "教学项目", (v) => asOpt(v, "visionId", asStr), null) as string | null,
    target: requiredField(raw, "target", "教学项目", asStr),
    examDate: field(raw, "examDate", "教学项目", (v) => asOpt(v, "examDate", asStr), null) as string | null,
    syllabusId: field(raw, "syllabusId", "教学项目", (v) => asOpt(v, "syllabusId", asStr), null) as string | null,
    pastPaperIds: field(raw, "pastPaperIds", "教学项目", (v) => asArray(v, "pastPaperIds").map((x) => asStr(x, "真题 ID")), []),
    mockPaperIds: field(raw, "mockPaperIds", "教学项目", (v) => asArray(v, "mockPaperIds").map((x) => asStr(x, "模拟题 ID")), []),
  };
}

export function serializeProjectStudy(p: ProjectStudy): Record<string, unknown> {
  return {
    projectId: p.projectId,
    directory: p.directory,
    examMode: p.examMode,
    visionId: p.visionId,
    target: p.target,
    examDate: p.examDate,
    syllabusId: p.syllabusId,
    pastPaperIds: p.pastPaperIds,
    mockPaperIds: p.mockPaperIds,
  };
}

export function parseResource(raw: unknown): Resource {
  if (!isObject(raw)) throw new AppError("资源必须是对象");
  rejectUnknown(raw, ["id", "projectId", "title", "kind", "path", "source", "edition", "topics"], "资源");
  return {
    id: requiredField(raw, "id", "资源", asStr),
    projectId: requiredField(raw, "projectId", "资源", asStr),
    title: requiredField(raw, "title", "资源", asStr),
    kind: oneOf(requiredField(raw, "kind", "资源", (v) => v), "资源 kind", ["syllabus", "course", "book", "pastPaper", "mockPaper", "reference", "attachment", "answerSheet"]) as ResourceKind,
    path: requiredField(raw, "path", "资源", asStr),
    source: requiredField(raw, "source", "资源", asStr),
    edition: requiredField(raw, "edition", "资源", asStr),
    topics: field(raw, "topics", "资源", (v) => asArray(v, "topics").map((x) => asStr(x, "知识点")), []),
  };
}

export function serializeResource(r: Resource): Record<string, unknown> {
  return {
    id: r.id,
    projectId: r.projectId,
    title: r.title,
    kind: r.kind,
    path: r.path,
    source: r.source,
    edition: r.edition,
    topics: r.topics,
  };
}

export function parseMilestone(raw: unknown): Milestone {
  if (!isObject(raw)) throw new AppError("阶段进度必须是对象");
  rejectUnknown(raw, ["week", "topics", "resourceIds", "objective", "lessonCount"], "阶段进度");
  return {
    week: requiredField(raw, "week", "阶段进度", asInt),
    topics: field(raw, "topics", "阶段进度", (v) => asArray(v, "topics").map((x) => asStr(x, "知识点")), []),
    resourceIds: field(raw, "resourceIds", "阶段进度", (v) => asArray(v, "resourceIds").map((x) => asStr(x, "资源 ID")), []),
    objective: requiredField(raw, "objective", "阶段进度", asStr),
    lessonCount: requiredField(raw, "lessonCount", "阶段进度", asInt),
  };
}

export function serializeMilestone(m: Milestone): Record<string, unknown> {
  return { week: m.week, topics: m.topics, resourceIds: m.resourceIds, objective: m.objective, lessonCount: m.lessonCount };
}

export function parseSemester(raw: unknown): Semester {
  if (!isObject(raw)) throw new AppError("学期计划必须是对象");
  rejectUnknown(raw, ["id", "projectId", "title", "startDate", "endDate", "revision", "baseline", "evidence", "rationale", "milestones"], "学期计划");
  return {
    id: requiredField(raw, "id", "学期计划", asStr),
    projectId: requiredField(raw, "projectId", "学期计划", asStr),
    title: requiredField(raw, "title", "学期计划", asStr),
    startDate: requiredField(raw, "startDate", "学期计划", asStr),
    endDate: requiredField(raw, "endDate", "学期计划", asStr),
    revision: requiredField(raw, "revision", "学期计划", asInt),
    baseline: requiredField(raw, "baseline", "学期计划", asStr),
    evidence: field(raw, "evidence", "学期计划", (v) => asArray(v, "evidence").map((x) => asStr(x, "依据")), []),
    rationale: requiredField(raw, "rationale", "学期计划", asStr),
    milestones: requiredField(raw, "milestones", "学期计划", (v) => asArray(v, "milestones").map(parseMilestone)),
  };
}

export function serializeSemester(s: Semester): Record<string, unknown> {
  return {
    id: s.id,
    projectId: s.projectId,
    title: s.title,
    startDate: s.startDate,
    endDate: s.endDate,
    revision: s.revision,
    baseline: s.baseline,
    evidence: s.evidence,
    rationale: s.rationale,
    milestones: s.milestones.map(serializeMilestone),
  };
}

export function parseLesson(raw: unknown): Lesson {
  if (!isObject(raw)) throw new AppError("课程必须是对象");
  rejectUnknown(raw, ["id", "projectId", "semesterId", "semesterRevision", "title", "topics", "resourceIds", "startsAt", "endsAt", "aiEnabled", "attended", "progress", "state"], "课程");
  return {
    id: requiredField(raw, "id", "课程", asStr),
    projectId: requiredField(raw, "projectId", "课程", asStr),
    semesterId: requiredField(raw, "semesterId", "课程", asStr),
    semesterRevision: field(raw, "semesterRevision", "课程", asInt, 1),
    title: requiredField(raw, "title", "课程", asStr),
    topics: field(raw, "topics", "课程", (v) => asArray(v, "topics").map((x) => asStr(x, "知识点")), []),
    resourceIds: field(raw, "resourceIds", "课程", (v) => asArray(v, "resourceIds").map((x) => asStr(x, "资源 ID")), []),
    startsAt: requiredField(raw, "startsAt", "课程", asInt),
    endsAt: requiredField(raw, "endsAt", "课程", asInt),
    aiEnabled: requiredField(raw, "aiEnabled", "课程", asBool),
    attended: requiredField(raw, "attended", "课程", asBool),
    progress: requiredField(raw, "progress", "课程", asStr),
    state: oneOf(requiredField(raw, "state", "课程", (v) => v), "课程 state", ["planned", "active", "ended", "missed"]) as LessonState,
  };
}

export function serializeLesson(l: Lesson): Record<string, unknown> {
  return {
    id: l.id,
    projectId: l.projectId,
    semesterId: l.semesterId,
    semesterRevision: l.semesterRevision,
    title: l.title,
    topics: l.topics,
    resourceIds: l.resourceIds,
    startsAt: l.startsAt,
    endsAt: l.endsAt,
    aiEnabled: l.aiEnabled,
    attended: l.attended,
    progress: l.progress,
    state: l.state,
  };
}

export function parseScoringPoint(raw: unknown): ScoringPoint {
  if (!isObject(raw)) throw new AppError("评分点必须是对象");
  rejectUnknown(raw, ["id", "description", "points"], "评分点");
  return {
    id: requiredField(raw, "id", "评分点", asStr),
    description: requiredField(raw, "description", "评分点", asStr),
    points: requiredField(raw, "points", "评分点", asInt),
  };
}

export function serializeScoringPoint(p: ScoringPoint): Record<string, unknown> {
  return { id: p.id, description: p.description, points: p.points };
}

export function parseQuestion(raw: unknown): Question {
  if (!isObject(raw)) throw new AppError("题目必须是对象");
  rejectUnknown(raw, ["id", "prompt", "topics", "sourceIds", "extension", "estimatedMinutes", "answer", "acceptableAlternatives", "scoring"], "题目");
  return {
    id: requiredField(raw, "id", "题目", asStr),
    prompt: requiredField(raw, "prompt", "题目", asStr),
    topics: field(raw, "topics", "题目", (v) => asArray(v, "topics").map((x) => asStr(x, "知识点")), []),
    sourceIds: field(raw, "sourceIds", "题目", (v) => asArray(v, "sourceIds").map((x) => asStr(x, "来源 ID")), []),
    extension: requiredField(raw, "extension", "题目", asBool),
    estimatedMinutes: requiredField(raw, "estimatedMinutes", "题目", asInt),
    answer: requiredField(raw, "answer", "题目", asStr),
    acceptableAlternatives: requiredField(raw, "acceptableAlternatives", "题目", asStr),
    scoring: requiredField(raw, "scoring", "题目", (v) => asArray(v, "scoring").map(parseScoringPoint)),
  };
}

export function serializeQuestion(q: Question): Record<string, unknown> {
  return {
    id: q.id,
    prompt: q.prompt,
    topics: q.topics,
    sourceIds: q.sourceIds,
    extension: q.extension,
    estimatedMinutes: q.estimatedMinutes,
    answer: q.answer,
    acceptableAlternatives: q.acceptableAlternatives,
    scoring: q.scoring.map(serializeScoringPoint),
  };
}

export function parseAssessment(raw: unknown): Assessment {
  if (!isObject(raw)) throw new AppError("试题必须是对象");
  rejectUnknown(raw, ["id", "projectId", "semesterId", "semesterRevision", "lessonId", "taskId", "retestOfGradeId", "title", "kind", "revision", "startsAt", "endsAt", "instructions", "reviewEvidence", "questions", "publishedAt", "printedAt", "startedAt", "stoppedAt"], "试题");
  return {
    id: requiredField(raw, "id", "试题", asStr),
    projectId: requiredField(raw, "projectId", "试题", asStr),
    semesterId: requiredField(raw, "semesterId", "试题", asStr),
    semesterRevision: field(raw, "semesterRevision", "试题", asInt, 1),
    lessonId: field(raw, "lessonId", "试题", (v) => asOpt(v, "lessonId", asStr), null) as string | null,
    taskId: field(raw, "taskId", "试题", (v) => asOpt(v, "taskId", asStr), null) as string | null,
    retestOfGradeId: field(raw, "retestOfGradeId", "试题", (v) => asOpt(v, "retestOfGradeId", asStr), null) as string | null,
    title: requiredField(raw, "title", "试题", asStr),
    kind: oneOf(requiredField(raw, "kind", "试题", (v) => v), "试题 kind", ["homework", "weeklyExam", "mockExam", "retest"]) as AssessmentKind,
    revision: requiredField(raw, "revision", "试题", asInt),
    startsAt: requiredField(raw, "startsAt", "试题", asInt),
    endsAt: requiredField(raw, "endsAt", "试题", asInt),
    instructions: requiredField(raw, "instructions", "试题", asStr),
    reviewEvidence: requiredField(raw, "reviewEvidence", "试题", asStr),
    questions: requiredField(raw, "questions", "试题", (v) => asArray(v, "questions").map(parseQuestion)),
    publishedAt: requiredField(raw, "publishedAt", "试题", asInt),
    printedAt: field(raw, "printedAt", "试题", (v) => asOpt(v, "printedAt", asInt), null) as number | null,
    startedAt: field(raw, "startedAt", "试题", (v) => asOpt(v, "startedAt", asInt), null) as number | null,
    stoppedAt: field(raw, "stoppedAt", "试题", (v) => asOpt(v, "stoppedAt", asInt), null) as number | null,
  };
}

export function serializeAssessment(a: Assessment): Record<string, unknown> {
  return {
    id: a.id,
    projectId: a.projectId,
    semesterId: a.semesterId,
    semesterRevision: a.semesterRevision,
    lessonId: a.lessonId,
    taskId: a.taskId,
    retestOfGradeId: a.retestOfGradeId,
    title: a.title,
    kind: a.kind,
    revision: a.revision,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    instructions: a.instructions,
    reviewEvidence: a.reviewEvidence,
    questions: a.questions.map(serializeQuestion),
    publishedAt: a.publishedAt,
    printedAt: a.printedAt,
    startedAt: a.startedAt,
    stoppedAt: a.stoppedAt,
  };
}

/** 计划区间供时长；实际开考起计时。 */
export function examDeadline(a: Assessment): number {
  return a.startedAt === null ? a.endsAt : a.startedAt + (a.endsAt - a.startsAt);
}

export function parseSubmission(raw: unknown): Submission {
  if (!isObject(raw)) throw new AppError("提交必须是对象");
  rejectUnknown(raw, ["id", "assessmentId", "submittedAt", "resourceIds", "answers", "unfinished", "questionTimes"], "提交");
  return {
    id: requiredField(raw, "id", "提交", asStr),
    assessmentId: requiredField(raw, "assessmentId", "提交", asStr),
    submittedAt: requiredField(raw, "submittedAt", "提交", asInt),
    resourceIds: field(raw, "resourceIds", "提交", (v) => asArray(v, "resourceIds").map((x) => asStr(x, "附件 ID")), []),
    answers: requiredField(raw, "answers", "提交", asStr),
    unfinished: requiredField(raw, "unfinished", "提交", asBool),
    questionTimes: field(raw, "questionTimes", "提交", (v) => asArray(v, "questionTimes").map(parseQuestionTime), []),
  };
}

export function serializeSubmission(s: Submission): Record<string, unknown> {
  return {
    id: s.id,
    assessmentId: s.assessmentId,
    submittedAt: s.submittedAt,
    resourceIds: s.resourceIds,
    answers: s.answers,
    unfinished: s.unfinished,
    questionTimes: s.questionTimes.map(serializeQuestionTime),
  };
}

export function parseQuestionTime(raw: unknown): QuestionTime {
  if (!isObject(raw)) throw new AppError("完成时刻必须是对象");
  rejectUnknown(raw, ["questionId", "localTime"], "完成时刻");
  return {
    questionId: requiredField(raw, "questionId", "完成时刻", asStr),
    localTime: requiredField(raw, "localTime", "完成时刻", asStr),
  };
}

export function serializeQuestionTime(t: QuestionTime): Record<string, unknown> {
  return { questionId: t.questionId, localTime: t.localTime };
}

export function parsePointAward(raw: unknown): PointAward {
  if (!isObject(raw)) throw new AppError("评分必须是对象");
  rejectUnknown(raw, ["questionId", "pointId", "awarded", "evidence"], "评分");
  return {
    questionId: requiredField(raw, "questionId", "评分", asStr),
    pointId: requiredField(raw, "pointId", "评分", asStr),
    awarded: requiredField(raw, "awarded", "评分", asInt),
    evidence: requiredField(raw, "evidence", "评分", asStr),
  };
}

export function serializePointAward(p: PointAward): Record<string, unknown> {
  return { questionId: p.questionId, pointId: p.pointId, awarded: p.awarded, evidence: p.evidence };
}

export function parseErrorAnalysis(raw: unknown): ErrorAnalysis {
  if (!isObject(raw)) throw new AppError("错因分析必须是对象");
  rejectUnknown(raw, ["questionId", "cause", "evidence", "correction", "nextCheck", "retestDate", "confirmed"], "错因分析");
  return {
    questionId: requiredField(raw, "questionId", "错因分析", asStr),
    cause: requiredField(raw, "cause", "错因分析", asStr),
    evidence: requiredField(raw, "evidence", "错因分析", asStr),
    correction: requiredField(raw, "correction", "错因分析", asStr),
    nextCheck: requiredField(raw, "nextCheck", "错因分析", asStr),
    retestDate: requiredField(raw, "retestDate", "错因分析", asStr),
    confirmed: requiredField(raw, "confirmed", "错因分析", asBool),
  };
}

export function serializeErrorAnalysis(e: ErrorAnalysis): Record<string, unknown> {
  return {
    questionId: e.questionId,
    cause: e.cause,
    evidence: e.evidence,
    correction: e.correction,
    nextCheck: e.nextCheck,
    retestDate: e.retestDate,
    confirmed: e.confirmed,
  };
}

export function parseGrade(raw: unknown): Grade {
  if (!isObject(raw)) throw new AppError("批改必须是对象");
  rejectUnknown(raw, ["id", "submissionId", "assessmentRevision", "gradedAt", "awards", "errors", "needsReview", "feedback"], "批改");
  return {
    id: requiredField(raw, "id", "批改", asStr),
    submissionId: requiredField(raw, "submissionId", "批改", asStr),
    assessmentRevision: requiredField(raw, "assessmentRevision", "批改", asInt),
    gradedAt: requiredField(raw, "gradedAt", "批改", asInt),
    awards: requiredField(raw, "awards", "批改", (v) => asArray(v, "awards").map(parsePointAward)),
    errors: requiredField(raw, "errors", "批改", (v) => asArray(v, "errors").map(parseErrorAnalysis)),
    needsReview: requiredField(raw, "needsReview", "批改", asBool),
    feedback: requiredField(raw, "feedback", "批改", asStr),
  };
}

export function serializeGrade(g: Grade): Record<string, unknown> {
  return {
    id: g.id,
    submissionId: g.submissionId,
    assessmentRevision: g.assessmentRevision,
    gradedAt: g.gradedAt,
    awards: g.awards.map(serializePointAward),
    errors: g.errors.map(serializeErrorAnalysis),
    needsReview: g.needsReview,
    feedback: g.feedback,
  };
}

export function parseReview(raw: unknown): Review {
  if (!isObject(raw)) throw new AppError("复盘必须是对象");
  rejectUnknown(raw, ["id", "date", "projectId", "gradeIds", "findings", "actions"], "复盘");
  return {
    id: requiredField(raw, "id", "复盘", asStr),
    date: requiredField(raw, "date", "复盘", asStr),
    projectId: requiredField(raw, "projectId", "复盘", asStr),
    gradeIds: field(raw, "gradeIds", "复盘", (v) => asArray(v, "gradeIds").map((x) => asStr(x, "批改 ID")), []),
    findings: requiredField(raw, "findings", "复盘", asStr),
    actions: field(raw, "actions", "复盘", (v) => asArray(v, "actions").map((x) => asStr(x, "行动")), []),
  };
}

export function serializeReview(r: Review): Record<string, unknown> {
  return { id: r.id, date: r.date, projectId: r.projectId, gradeIds: r.gradeIds, findings: r.findings, actions: r.actions };
}

export function parseTeachingEvent(raw: unknown): TeachingEvent {
  if (!isObject(raw)) throw new AppError("教学事件必须是对象");
  rejectUnknown(raw, ["id", "projectId", "kind", "sourceId", "state", "createdAt"], "教学事件");
  return {
    id: requiredField(raw, "id", "教学事件", asStr),
    projectId: requiredField(raw, "projectId", "教学事件", asStr),
    kind: requiredField(raw, "kind", "教学事件", asStr),
    sourceId: requiredField(raw, "sourceId", "教学事件", asStr),
    state: requiredField(raw, "state", "教学事件", asStr),
    createdAt: requiredField(raw, "createdAt", "教学事件", asInt),
  };
}

export function serializeTeachingEvent(e: TeachingEvent): Record<string, unknown> {
  return { id: e.id, projectId: e.projectId, kind: e.kind, sourceId: e.sourceId, state: e.state, createdAt: e.createdAt };
}

export function parseProgressRecord(raw: unknown): ProgressRecord {
  if (!isObject(raw)) throw new AppError("进度记录必须是对象");
  rejectUnknown(raw, ["id", "projectId", "topic", "position", "state", "evidence", "nextAction", "source", "confirmed", "recordedAt"], "进度记录");
  return {
    id: requiredField(raw, "id", "进度记录", asStr),
    projectId: requiredField(raw, "projectId", "进度记录", asStr),
    topic: requiredField(raw, "topic", "进度记录", asStr),
    position: requiredField(raw, "position", "进度记录", asStr),
    state: oneOf(requiredField(raw, "state", "进度记录", (v) => v), "进度 state", ["studied", "practicing", "needsReview"]) as ProgressRecord["state"],
    evidence: requiredField(raw, "evidence", "进度记录", asStr),
    nextAction: requiredField(raw, "nextAction", "进度记录", asStr),
    source: oneOf(requiredField(raw, "source", "进度记录", (v) => v), "进度 source", ["user", "assistant"]) as ProgressSource,
    confirmed: requiredField(raw, "confirmed", "进度记录", asBool),
    recordedAt: requiredField(raw, "recordedAt", "进度记录", asInt),
  };
}

export function serializeProgressRecord(r: ProgressRecord): Record<string, unknown> {
  return {
    id: r.id,
    projectId: r.projectId,
    topic: r.topic,
    position: r.position,
    state: r.state,
    evidence: r.evidence,
    nextAction: r.nextAction,
    source: r.source,
    confirmed: r.confirmed,
    recordedAt: r.recordedAt,
  };
}

export function parseCorrection(raw: unknown): Correction {
  if (!isObject(raw)) throw new AppError("订正必须是对象");
  rejectUnknown(raw, ["id", "gradeId", "questionId", "explanation", "resourceIds", "submittedAt", "accepted", "feedback", "reviewedAt"], "订正");
  return {
    id: requiredField(raw, "id", "订正", asStr),
    gradeId: requiredField(raw, "gradeId", "订正", asStr),
    questionId: requiredField(raw, "questionId", "订正", asStr),
    explanation: requiredField(raw, "explanation", "订正", asStr),
    resourceIds: field(raw, "resourceIds", "订正", (v) => asArray(v, "resourceIds").map((x) => asStr(x, "附件 ID")), []),
    submittedAt: requiredField(raw, "submittedAt", "订正", asInt),
    accepted: field(raw, "accepted", "订正", (v) => asOpt(v, "accepted", asBool), null) as boolean | null,
    feedback: field(raw, "feedback", "订正", asStr, ""),
    reviewedAt: field(raw, "reviewedAt", "订正", (v) => asOpt(v, "reviewedAt", asInt), null) as number | null,
  };
}

export function serializeCorrection(c: Correction): Record<string, unknown> {
  return {
    id: c.id,
    gradeId: c.gradeId,
    questionId: c.questionId,
    explanation: c.explanation,
    resourceIds: c.resourceIds,
    submittedAt: c.submittedAt,
    accepted: c.accepted,
    feedback: c.feedback,
    reviewedAt: c.reviewedAt,
  };
}

// ---------- 校验辅助 ----------

export function checkText(s: string, max: number): boolean {
  return s.trim().length > 0 && Array.from(s).length <= max;
}

export function validEducationDate(s: string): boolean {
  return s.length === 10 && validDate(s);
}

/** 安全的项目内相对路径：非空、无反斜杠、非绝对、无 `..`/`.` 段。 */
export function isRelativePath(path: string): boolean {
  if (path.length === 0 || path.includes("\\") || isAbsolutePath(path)) return false;
  const stripped = path.replace(/\/+$/, "");
  if (stripped.length === 0) return path.length > 0 && false;
  return stripped.split("/").every((seg) => seg !== "." && seg !== ".." && seg !== "");
}

export function isAbsolutePath(path: string): boolean {
  return /^(\/|[A-Za-z]:[\\/]|\\\\)/.test(path);
}

// ---------- Education 数据类 ----------

export interface EducationData {
  focusTasks: import("./model").TeachingTask[];
  projects: ProjectStudy[];
  resources: Resource[];
  semesters: Semester[];
  semesterHistory: Semester[];
  lessons: Lesson[];
  assessments: Assessment[];
  submissions: Submission[];
  grades: Grade[];
  reviews: Review[];
  events: TeachingEvent[];
  completedTasks: CompletedStudyTask[];
  progress: ProgressRecord[];
  corrections: Correction[];
}

export class Education implements EducationData {
  focusTasks: import("./model").TeachingTask[] = [];
  projects: ProjectStudy[] = [];
  resources: Resource[] = [];
  semesters: Semester[] = [];
  semesterHistory: Semester[] = [];
  lessons: Lesson[] = [];
  assessments: Assessment[] = [];
  submissions: Submission[] = [];
  grades: Grade[] = [];
  reviews: Review[] = [];
  events: TeachingEvent[] = [];
  completedTasks: CompletedStudyTask[] = [];
  progress: ProgressRecord[] = [];
  corrections: Correction[] = [];

  /** 每次扫描或变更时重建：含停用配置与归档计划。 */
  resourceReferenceIndex(): Map<string, string[]> {
    const refs = new Map<string, string[]>();
    const add = (ids: string[], label: string): void => {
      for (const id of new Set(ids)) {
        const list = refs.get(id) ?? [];
        list.push(label);
        refs.set(id, list);
      }
    };
    for (const p of this.projects) {
      add(
        [p.syllabusId, ...p.pastPaperIds, ...p.mockPaperIds].filter((x): x is string => x !== null),
        "项目教学配置",
      );
    }
    for (const s of [...this.semesters, ...this.semesterHistory]) {
      for (const m of s.milestones) {
        add(m.resourceIds, `${s.title} v${s.revision} 第${m.week}周`);
      }
    }
    for (const l of this.lessons) {
      add(l.resourceIds, `课程：${l.title}`);
    }
    for (const a of this.assessments) {
      for (const q of a.questions) {
        add(q.sourceIds, `${a.title} / ${q.id}`);
      }
    }
    for (const s of this.submissions) {
      add(s.resourceIds, `答卷：${s.id}`);
    }
    for (const c of this.corrections) {
      add(c.resourceIds, `订正：${c.id}`);
    }
    return refs;
  }

  resourceReferences(id: string): string[] {
    return this.resourceReferenceIndex().get(id) ?? [];
  }

  event(project: string, kind: string, source: string, at: number): void {
    const eventId = `${kind}:${source}`;
    if (!this.events.some((e) => e.id === eventId)) {
      this.events.push({ id: eventId, projectId: project, kind, sourceId: source, state: "pending", createdAt: at });
    }
  }

  taskCompleted(task: Task, at: number): void {
    const record = completedStudyTaskFromTask(task, at);
    if (record === null) return;
    if (
      this.projects.some((p) => p.projectId === record.projectId && p.examMode) &&
      !this.completedTasks.some((t) => t.id === record.id)
    ) {
      const link = this.focusTasks.find((l) => l.taskId === record.id);
      if (link !== undefined) {
        const lesson = this.lessons.find((l) => l.id === link.sourceId);
        if (lesson !== undefined) {
          record.topics = [...lesson.topics];
          record.notes = lesson.progress;
        }
      } else {
        this.event(record.projectId, "taskHomework", record.id, at);
      }
      this.completedTasks.push(record);
    }
  }

  /** 课程/考试到点推进、持久化教学事件。 */
  tick(at: number): boolean {
    let changed = false;
    const events: { project: string; kind: string; source: string }[] = [];
    for (const lesson of this.lessons) {
      if ((lesson.state === "planned" || lesson.state === "active") && at >= lesson.endsAt) {
        lesson.state = lesson.attended ? "ended" : "missed";
        if (lesson.aiEnabled && lesson.attended) {
          events.push({ project: lesson.projectId, kind: "homework", source: lesson.id });
        }
        changed = true;
      } else if (lesson.state === "planned" && at >= lesson.startsAt) {
        lesson.state = "active";
        changed = true;
      }
    }
    for (const a of this.assessments) {
      if (
        (a.kind === "homework" || a.startedAt !== null) &&
        a.stoppedAt === null &&
        at >= examDeadline(a)
      ) {
        a.stoppedAt = examDeadline(a);
        changed = true;
      }
    }
    for (const { project, kind, source } of events) {
      this.event(project, kind, source, at);
    }
    // 每日复盘持久：包括 08:30 应用未开的日期。
    const grades = new Set<string>();
    for (const g of this.grades) {
      const nowMinutes = minutesOf(hourMinuteNow(at)) ?? -1;
      if (dateAt(g.gradedAt) < dateAt(at) && nowMinutes >= 510) {
        const sub = this.submissions.find((s) => s.id === g.submissionId);
        if (sub === undefined) continue;
        const a = this.assessments.find((x) => x.id === sub.assessmentId);
        if (a === undefined) continue;
        grades.add(`${a.projectId}|${dateAt(g.gradedAt)}`);
      }
    }
    for (const pair of grades) {
      const [p, d] = pair.split("|");
      const n = this.events.length;
      this.event(p!, "review", `${p}:${d}`, at);
      if (this.events.length !== n) changed = true;
    }
    // 周五起（含周末）为仍在进行中的应试学期登记周考事件。
    const today = localDateOf(at);
    if (weekdayMonday(today) >= 5) {
      const terms: { project: string; source: string }[] = [];
      for (const s of this.semesters) {
        if (
          s.startDate <= dateAt(at) &&
          s.endDate >= dateAt(at) &&
          this.projects.some((p) => p.projectId === s.projectId && p.examMode)
        ) {
          const start = parseDate(s.startDate)!;
          const week = Math.floor(daysBetween(start, today) / 7) + 1;
          terms.push({ project: s.projectId, source: `${s.id}:week${week}` });
        }
      }
      for (const { project, source } of terms) {
        const n = this.events.length;
        this.event(project, "weeklyExam", source, at);
        if (this.events.length !== n) changed = true;
      }
    }
    return changed;
  }

  /** 教学命令执行：校验 → 变更，全部成功后由上层统一 validate。 */
  apply(command: Command, at: number): void {
    switch (command.op) {
      case "recordProgress": {
        ensure(!this.progress.some((r) => r.id === command.record.id), "进度记录不可覆盖，请新增一条更正记录");
        command.record.recordedAt = at;
        command.record.confirmed = command.record.source === "user";
        this.progress.push(command.record);
        break;
      }
      case "confirmProgress": {
        const record = this.progress.find((r) => r.id === command.id);
        ensure(record !== undefined, "进度记录不存在");
        record.confirmed = true;
        break;
      }
      case "submitCorrection": {
        ensure(!this.corrections.some((c) => c.id === command.correction.id), "订正版本不可覆盖");
        command.correction.submittedAt = at;
        command.correction.accepted = null;
        command.correction.feedback = "";
        command.correction.reviewedAt = null;
        const project = (() => {
          const grade = this.grades.find((g) => g.id === command.correction.gradeId);
          if (grade === undefined) return null;
          const sub = this.submissions.find((s) => s.id === grade.submissionId);
          if (sub === undefined) return null;
          const a = this.assessments.find((x) => x.id === sub.assessmentId);
          return a?.projectId ?? null;
        })();
        ensure(project !== null, "订正缺少原始批改");
        this.event(project, "correction", command.correction.id, at);
        this.corrections.push(command.correction);
        break;
      }
      case "reviewCorrection": {
        const correction = this.corrections.find((c) => c.id === command.id && c.reviewedAt === null);
        ensure(correction !== undefined, "订正已检查或不存在");
        ensure(checkText(command.feedback, 50000), "订正检查需要反馈");
        correction.accepted = command.accepted;
        correction.feedback = command.feedback;
        correction.reviewedAt = at;
        break;
      }
      case "saveProject": {
        upsertBy(this.projects, command.project, (x) => x.projectId);
        break;
      }
      case "saveResource": {
        upsertBy(this.resources, command.resource, (x) => x.id);
        break;
      }
      case "removeResources": {
        ensure(command.ids.length > 0, "请选择要清理的资源登记");
        const referenced = this.resourceReferenceIndex();
        const known = new Set(this.resources.map((r) => r.id));
        for (const id of command.ids) {
          ensure(known.has(id), "资源登记不存在");
          ensure(!referenced.has(id), "资源仍被教学配置或历史记录引用，请修复路径并保留登记");
        }
        const ids = new Set(command.ids);
        this.resources = this.resources.filter((r) => !ids.has(r.id));
        break;
      }
      case "saveSemester": {
        const old = this.semesters.find((s) => s.id === command.semester.id);
        if (old !== undefined) {
          ensure(command.semester.revision === old.revision + 1, "学期计划更新必须递增版本");
          this.semesterHistory.push({ ...old, milestones: old.milestones.map((m) => ({ ...m, topics: [...m.topics], resourceIds: [...m.resourceIds] })) });
        }
        upsertBy(this.semesters, command.semester, (x) => x.id);
        break;
      }
      case "saveLesson": {
        const semester = this.semesters.find((s) => s.id === command.lesson.semesterId);
        ensure(semester !== undefined, "学期计划不存在");
        command.lesson.semesterRevision = semester.revision;
        ensure(command.lesson.startsAt > at, "课程必须安排在未来");
        ensure(
          !this.lessons.some(
            (l) => l.id === command.lesson.id && (l.state !== "planned" || l.attended),
          ),
          "已开始课程保留历史，不能改写",
        );
        command.lesson.state = "planned";
        command.lesson.attended = false;
        upsertBy(this.lessons, command.lesson, (x) => x.id);
        break;
      }
      case "setLessonResources": {
        const lesson = this.lessons.find((l) => l.id === command.id);
        ensure(lesson !== undefined, "课程不存在");
        ensure(
          lesson.state === "planned" && !lesson.attended && lesson.startsAt > at,
          "课程已开始，不能修改指定资料",
        );
        ensure(
          command.resourceIds.every((id) =>
            this.resources.some((r) => r.id === id && r.projectId === lesson.projectId),
          ),
          "只能指定本项目登记的资料",
        );
        ensure(new Set(command.resourceIds).size === command.resourceIds.length, "课程资料不能重复指定");
        lesson.resourceIds = [...command.resourceIds];
        break;
      }
      case "attendLesson": {
        const lesson = this.lessons.find((l) => l.id === command.id);
        ensure(lesson !== undefined, "课程不存在");
        ensure(at >= lesson.startsAt && at < lesson.endsAt, "只能在上课时确认参与");
        lesson.attended = true;
        lesson.progress = command.progress;
        break;
      }
      case "publishAssessment": {
        ensure(
          this.projects.some((p) => p.projectId === command.assessment.projectId && p.examMode),
          "发布作业和试卷前请启用应试模式",
        );
        ensure(!this.assessments.some((a) => a.id === command.assessment.id), "已发布题目和评分标准不可修改；请发布新 ID 的修订版");
        ensure(
          command.assessment.kind === "homework"
            ? command.assessment.endsAt > at
            : dateAt(command.assessment.startsAt) >= dateAt(at),
          "不能发布已截止的作业或已过考试日期的试卷",
        );
        const semester = this.semesters.find((s) => s.id === command.assessment.semesterId);
        ensure(semester !== undefined, "学期计划不存在");
        command.assessment.semesterRevision = semester.revision;
        command.assessment.publishedAt = at;
        command.assessment.printedAt = null;
        command.assessment.startedAt = null;
        command.assessment.stoppedAt = null;
        this.assessments.push(command.assessment);
        break;
      }
      case "confirmPrinted": {
        const a = this.assessments.find((x) => x.id === command.id);
        ensure(a !== undefined, "试卷不存在");
        a.printedAt = at;
        break;
      }
      case "startExam": {
        ensure(
          !this.assessments.some((a) => a.startedAt !== null && a.stoppedAt === null),
          "请先结束当前考试",
        );
        const a = this.assessments.find((x) => x.id === command.id);
        ensure(a !== undefined, "试卷不存在");
        ensure(
          a.kind !== "homework" &&
            a.printedAt !== null &&
            a.startedAt === null &&
            dateAt(at) === dateAt(a.startsAt),
          "请先打印试卷与答题卡，并在考试安排当天开始考试",
        );
        a.startedAt = at;
        break;
      }
      case "endExam": {
        const a = this.assessments.find((x) => x.id === command.id);
        ensure(a !== undefined, "考试不存在");
        ensure(
          a.kind !== "homework" && a.startedAt !== null && a.stoppedAt === null,
          "考试尚未开始或已经停笔",
        );
        a.stoppedAt = at;
        break;
      }
      case "submit": {
        ensure(!this.submissions.some((s) => s.id === command.submission.id), "提交版本不可覆盖");
        const a = this.assessments.find((x) => x.id === command.submission.assessmentId);
        ensure(a !== undefined, "作业/考试不存在");
        ensure(at >= a.startsAt, "尚未开始，不能提交");
        if (a.kind !== "homework") {
          ensure(a.startedAt !== null && a.stoppedAt !== null, "考试结束停笔后才能上传答题卡");
          ensure(command.submission.resourceIds.length > 0, "考试需要上传纸质答题卡");
        }
        ensure(
          checkText(command.submission.answers, 50000) ||
            command.submission.resourceIds.length > 0 ||
            command.submission.unfinished,
          "请提供答案、附件或标记未完成",
        );
        command.submission.submittedAt = at;
        const project = a.projectId;
        const source = command.submission.id;
        this.submissions.push(command.submission);
        this.event(project, "grade", source, at);
        break;
      }
      case "recordQuestionTimes": {
        ensure(command.questionTimes.length > 0, "没有需要补录的完成时刻");
        ensure(!this.grades.some((g) => g.submissionId === command.id), "已批改的答卷不能补录完成时刻");
        const submission = this.submissions.find((s) => s.id === command.id);
        ensure(submission !== undefined, "提交版本不存在");
        ensure(
          command.questionTimes.every(
            (t) => !submission.questionTimes.some((existing) => existing.questionId === t.questionId),
          ),
          "已有的完成时刻不能覆盖",
        );
        submission.questionTimes.push(...command.questionTimes);
        break;
      }
      case "grade": {
        ensure(!this.grades.some((g) => g.id === command.grade.id), "批改历史不可覆盖，复核请新增批改记录");
        command.grade.gradedAt = at;
        this.grades.push(command.grade);
        break;
      }
      case "saveReview": {
        ensure(!this.reviews.some((r) => r.id === command.review.id), "复盘历史不可覆盖");
        this.reviews.push(command.review);
        break;
      }
      case "claimEvent": {
        const event = this.events.find((e) => e.id === command.id && e.state === "pending");
        ensure(event !== undefined, "事件已处理");
        event.state = "running";
        break;
      }
      case "finishEvent": {
        const event = this.events.find((e) => e.id === command.id);
        ensure(event !== undefined, "教学事件不存在");
        const produced = (() => {
          switch (event.kind) {
            case "homework":
              return this.assessments.some(
                (a) =>
                  a.projectId === event.projectId &&
                  a.kind === "homework" &&
                  a.lessonId === event.sourceId,
              );
            case "taskHomework":
              return this.assessments.some(
                (a) => a.kind === "homework" && a.projectId === event.projectId && a.taskId === event.sourceId,
              );
            case "correction":
              return this.corrections.some((c) => c.id === event.sourceId && c.reviewedAt !== null);
            case "weeklyExam":
              return this.assessments.some(
                (a) =>
                  a.projectId === event.projectId &&
                  a.kind === "weeklyExam" &&
                  a.publishedAt >= event.createdAt,
              );
            case "grade":
              return this.grades.some((g) => g.submissionId === event.sourceId);
            case "review":
              return this.reviews.some(
                (r) => r.projectId === event.projectId && event.sourceId.endsWith(r.date),
              );
            default:
              return false;
          }
        })();
        ensure(produced, "请先保存本次教学事件的实际产物");
        event.state = "done";
        break;
      }
      case "retryEvent": {
        const event = this.events.find((e) => e.id === command.id && e.state !== "done");
        ensure(event !== undefined, "没有可重试的教学事件");
        event.state = "pending";
        break;
      }
    }
  }
}

function upsertBy<T>(list: T[], value: T, key: (x: T) => string): void {
  const k = key(value);
  const index = list.findIndex((x) => key(x) === k);
  if (index >= 0) {
    list[index] = value;
  } else {
    list.push(value);
  }
}

function completedStudyTaskFromTask(task: Task, at: number): CompletedStudyTask | null {
  if (task.projectId === null) return null;
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    notes: task.notes,
    topics: [...task.tags],
    completedAt: at,
  };
}

function hourMinuteNow(at: number): string {
  const d = new Date(at * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ---------- 校验 ----------

export function validateEducation(data: AppData): void {
  const e = data.education;
  uniqueEducationIds([
    ...e.resources.map((x) => x.id),
    ...e.semesters.map((x) => x.id),
    ...e.lessons.map((x) => x.id),
    ...e.assessments.map((x) => x.id),
    ...e.submissions.map((x) => x.id),
    ...e.grades.map((x) => x.id),
    ...e.reviews.map((x) => x.id),
  ]);
  uniqueEducationIds(e.projects.map((p) => p.projectId));
  uniqueEducationIds(e.events.map((p) => p.id));
  const projectExists = (id: string): boolean => data.projects.some((p) => p.id === id);
  const resource = (id: string, p: string): Resource | undefined =>
    e.resources.find((r) => r.id === id && r.projectId === p);
  ensure(
    e.lessons.length + e.assessments.length + e.submissions.length + e.grades.length <= 100000,
    "教学记录数量超出限制",
  );
  for (const p of e.projects) {
    ensure(projectExists(p.projectId) && isAbsolutePath(p.directory), "项目必须绑定绝对目录");
    ensure(p.examDate === null || validEducationDate(p.examDate), "无效的考试日期");
    if (p.examMode) {
      ensure(
        p.visionId !== null && data.visions.some((v) => v.id === p.visionId) && checkText(p.target, 50000),
        "应试模式必须绑定愿景并明确院校、专业、年份和科目目标",
      );
      ensure(
        p.syllabusId !== null && resource(p.syllabusId, p.projectId)?.kind === "syllabus",
        "应试模式必须绑定考纲",
      );
      ensure(
        p.pastPaperIds.length > 0 &&
          p.pastPaperIds.every((id) => resource(id, p.projectId)?.kind === "pastPaper"),
        "应试模式必须绑定真题",
      );
      ensure(
        p.mockPaperIds.length > 0 &&
          p.mockPaperIds.every((id) => resource(id, p.projectId)?.kind === "mockPaper"),
        "应试模式必须绑定模拟题",
      );
    }
  }
  for (const r of e.resources) {
    ensure(
      e.projects.some((p) => p.projectId === r.projectId) &&
        checkText(r.title, 50000) &&
        isRelativePath(r.path),
      "资源需要所属项目、名称和安全的相对路径",
    );
  }
  for (const s of e.semesters) {
    ensure(
      e.projects.some((p) => p.projectId === s.projectId) &&
        checkText(s.title, 50000) &&
        validEducationDate(s.startDate) &&
        validEducationDate(s.endDate) &&
        s.startDate <= s.endDate &&
        s.revision > 0 &&
        checkText(s.baseline, 50000) &&
        checkText(s.rationale, 50000) &&
        s.evidence.length > 0 &&
        s.milestones.length > 0,
      "学期计划缺少日期、学情诊断、依据或阶段进度",
    );
    for (const m of s.milestones) {
      ensure(
        m.week > 0 &&
          m.topics.length > 0 &&
          checkText(m.objective, 50000) &&
          m.lessonCount > 0 &&
          m.resourceIds.every((id) => resource(id, s.projectId) !== undefined),
        "无效的周进度或学习资源",
      );
    }
  }
  for (const l of e.lessons) {
    const s = [...e.semesters, ...e.semesterHistory].find(
      (x) => x.id === l.semesterId && x.projectId === l.projectId && x.revision === l.semesterRevision,
    );
    ensure(s !== undefined, "课程必须绑定本项目学期计划");
    ensure(
      checkText(l.title, 50000) &&
        l.topics.length > 0 &&
        l.endsAt - l.startsAt === 45 * 60 &&
        dateAt(l.startsAt) >= s.startDate &&
        dateAt(l.endsAt) <= s.endDate &&
        l.resourceIds.every((id) => resource(id, l.projectId) !== undefined),
      "课程需要45分钟、知识点和有效资源，且在学期范围内",
    );
    const minute = Math.floor(minutesOf(hourMinuteNow(l.startsAt)) ?? 0);
    ensure(
      (minute >= 8 * 60 && minute < 12 * 60 + 40) || (minute >= 14 * 60 && minute < 18 * 60 + 15),
      "课程须在上午或下午，晚间19–22点留给作业",
    );
    const same = e.lessons.filter((x) => dateAt(x.startsAt) === dateAt(l.startsAt));
    let morning = 0;
    let afternoon = 0;
    for (const x of same) {
      const h = new Date(x.startsAt * 1000).getHours();
      if (h < 12) morning += 1;
      else afternoon += 1;
    }
    ensure(morning <= 4 && afternoon <= 4, "跨项目每天最多上午4节、下午4节");
    ensure(
      !e.lessons.some((x) => x.id !== l.id && x.startsAt < l.endsAt && x.endsAt > l.startsAt),
      "跨项目课程时间冲突",
    );
    const date = dateAt(l.startsAt);
    for (const b of data.blocks) {
      if (b.attention === "required") {
        ensure(
          overlapMinutesOfBlock(b, date, minute, minute + 45) === 0,
          "课程与需专心的固定占用冲突",
        );
      }
    }
  }
  for (const a of e.assessments) {
    ensure(e.projects.some((p) => p.projectId === a.projectId), "AI作业和考试需要启用应试模式");
    ensure(
      [...e.semesters, ...e.semesterHistory].some(
        (s) => s.id === a.semesterId && s.projectId === a.projectId && s.revision === a.semesterRevision,
      ),
      "试题必须绑定学期计划",
    );
    ensure(
      a.revision > 0 &&
        a.startsAt < a.endsAt &&
        checkText(a.title, 50000) &&
        checkText(a.reviewEvidence, 50000) &&
        checkText(a.instructions, 50000) &&
        a.questions.length > 0,
      "发布前必须准备题目、考试说明、答案和独立复核记录",
    );
    if (a.kind === "homework") {
      ensure(
        (a.taskId === null &&
          a.lessonId !== null &&
          e.lessons.some(
            (l) => l.id === a.lessonId && l.projectId === a.projectId && l.aiEnabled && l.state === "ended",
          )) ||
          (a.lessonId === null &&
            a.taskId !== null &&
            e.completedTasks.some((t) => t.id === a.taskId && t.projectId === a.projectId)),
        "作业必须来自本项目已结束的AI课程或已完成学习任务",
      );
    }
    if (a.kind === "retest") {
      ensure(
        a.retestOfGradeId !== null &&
          e.grades.some((g) => {
            if (g.id !== a.retestOfGradeId) return false;
            return e.submissions.some((s) => {
              if (s.id !== g.submissionId) return false;
              return e.assessments.some((original) => original.id === s.assessmentId && original.projectId === a.projectId);
            });
          }),
        "复测必须关联本项目原始批改",
      );
    } else {
      ensure(a.retestOfGradeId === null, "只有复测可以引用原始批改");
    }
    if (a.kind === "weeklyExam") {
      ensure(weekdayMonday(localDateOf(a.startsAt)) >= 6, "周考安排在周末");
    }
    if (a.kind !== "homework") {
      ensure(
        !e.lessons.some((l) => l.startsAt < a.endsAt && l.endsAt > a.startsAt) &&
          !e.assessments.some(
            (b) =>
              b.id !== a.id &&
              b.kind !== "homework" &&
              b.startsAt < a.endsAt &&
              b.endsAt > a.startsAt,
          ),
        "考试与课程或其他考试冲突",
      );
    }
    uniqueEducationIds(a.questions.map((q) => q.id));
    for (const q of a.questions) {
      ensure(
        checkText(q.prompt, 50000) &&
          checkText(q.answer, 50000) &&
          q.topics.length > 0 &&
          q.estimatedMinutes > 0 &&
          q.scoring.length > 0 &&
          q.sourceIds.length > 0 &&
          q.sourceIds.every((id) => resource(id, a.projectId) !== undefined),
        "每题必须有来源、知识点、估时、答案和评分点",
      );
      uniqueEducationIds(q.scoring.map((p) => p.id));
      for (const p of q.scoring) {
        ensure(p.points > 0 && checkText(p.description, 50000), "评分点需要分值与判分依据");
      }
      if (!q.extension && a.kind !== "mockExam" && a.kind !== "retest") {
        ensure(
          q.topics.every(
            (t) =>
              e.lessons.some(
                (l) => l.projectId === a.projectId && l.state === "ended" && l.topics.includes(t),
              ) ||
              e.completedTasks.some((task) => task.projectId === a.projectId && task.topics.includes(t)) ||
              e.progress.some((r) => r.projectId === a.projectId && r.confirmed && r.topic === t),
          ),
          "基础练习不能包含尚未授课的知识点；拓展题须明确标记",
        );
      }
    }
  }
  for (const s of e.submissions) {
    const a = e.assessments.find((x) => x.id === s.assessmentId);
    ensure(a !== undefined, "提交引用了不存在的试题");
    ensure(
      s.resourceIds.every((id) => resource(id, a.projectId) !== undefined),
      "答卷附件必须属于本项目",
    );
    uniqueEducationIds(s.questionTimes.map((t) => t.questionId));
    for (const t of s.questionTimes) {
      ensure(
        a.questions.some((q) => q.id === t.questionId) &&
          t.localTime.length === 5 &&
          minutesOf(t.localTime) !== null,
        "每题记录本机HH:MM完成时刻",
      );
    }
  }
  for (const g of e.grades) {
    const s = e.submissions.find((x) => x.id === g.submissionId);
    ensure(s !== undefined, "批改缺少提交版本");
    const a = e.assessments.find((x) => x.id === s.assessmentId);
    ensure(a !== undefined, "试题不存在");
    ensure(g.assessmentRevision === a.revision && checkText(g.feedback, 50000), "批改必须引用发布时的评分版本并给出反馈");
    const seen = new Set<string>();
    for (const award of g.awards) {
      const point = a.questions
        .find((q) => q.id === award.questionId)
        ?.scoring.find((p) => p.id === award.pointId);
      ensure(point !== undefined, "批改不能临时增加评分点");
      ensure(
        award.awarded <= point.points &&
          checkText(award.evidence, 50000) &&
          !seen.has(`${award.questionId}|${award.pointId}`),
        "评分超范围、重复或缺少答卷证据",
      );
      seen.add(`${award.questionId}|${award.pointId}`);
    }
    const totalPoints = a.questions.reduce((n, q) => n + q.scoring.length, 0);
    ensure(g.needsReview || g.awards.length === totalPoints, "正式批改必须覆盖全部评分点；识别不清请标记待复核");
    for (const error of g.errors) {
      ensure(
        a.questions.some((q) => q.id === error.questionId) &&
          checkText(error.cause, 50000) &&
          checkText(error.evidence, 50000) &&
          checkText(error.correction, 50000) &&
          checkText(error.nextCheck, 50000) &&
          validEducationDate(error.retestDate),
        "错因分析需要证据、纠正动作和复测日期",
      );
    }
  }
  for (const r of e.reviews) {
    ensure(
      projectExists(r.projectId) &&
        validEducationDate(r.date) &&
        checkText(r.findings, 50000) &&
        r.actions.length > 0 &&
        r.gradeIds.length > 0 &&
        r.gradeIds.every((id) =>
          e.grades.some((g) => {
            if (g.id !== id) return false;
            return e.submissions.some((s) => {
              if (s.id !== g.submissionId) return false;
              return e.assessments.some((a) => a.id === s.assessmentId && a.projectId === r.projectId);
            });
          }),
        ),
      "复盘必须引用本项目批改并给出后续行动",
    );
  }
  for (const event of e.events) {
    ensure(
      projectExists(event.projectId) &&
        ["pending", "running", "done"].includes(event.state) &&
        ["homework", "taskHomework", "grade", "correction", "review", "weeklyExam"].includes(event.kind),
      "无效的教学事件",
    );
  }
  validateLearning(data);
}

function uniqueEducationIds(ids: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    ensure(id.trim().length > 0 && id.length <= 200 && !seen.has(id), "教学实体 ID 为空、过长或重复");
    seen.add(id);
  }
}

/** 导入可恢复记录，但不得静默改写已发布题目或历史。 */
export function validateEducationTransition(before: Education, after: Education): void {
  validateLearningTransition(before, after);
  for (const link of before.focusTasks) {
    ensure(
      after.focusTasks.some((x) => x.taskId === link.taskId && x.sourceId === link.sourceId && x.kind === link.kind),
      "已建立的教学待办来源关联不能删除或改写",
    );
  }
  const activeResources = new Set(after.resources.map((r) => r.id));
  const references = before.resourceReferenceIndex();
  for (const resource of before.resources) {
    if (!activeResources.has(resource.id)) {
      ensure(!references.has(resource.id), "教学历史引用的资源登记不能删除，请修复路径");
    }
  }
  for (const a of before.assessments) {
    ensure(after.assessments.some((b) => b.id === a.id), "已发布试卷不能删除");
    const b = after.assessments.find((x) => x.id === a.id);
    if (b !== undefined) {
      const old = cloneAssessment(a);
      old.printedAt = b.printedAt;
      old.startedAt = b.startedAt;
      old.stoppedAt = b.stoppedAt;
      ensure(assessmentEquals(old, b), "已发布题目与评分标准不可被导入或补丁改写");
    }
  }
  for (const s of before.submissions) {
    const b = after.submissions.find((x) => x.id === s.id);
    ensure(
      b !== undefined &&
        (() => {
          const old = cloneSubmission(s);
          old.questionTimes = b.questionTimes.map((t) => ({ ...t }));
          return (
            submissionEquals(old, b) &&
            startsWithQuestionTimes(b.questionTimes, s.questionTimes) &&
            (b.questionTimes.length === s.questionTimes.length ||
              !before.grades.some((g) => g.submissionId === s.id))
          );
        })(),
      "提交历史不可改写；只能在批改前补充缺失的完成时刻",
    );
  }
  for (const g of before.grades) {
    const b = after.grades.find((x) => x.id === g.id);
    ensure(b !== undefined && gradeEquals(b, g), "批改历史不可改写");
  }
}

function cloneAssessment(a: Assessment): Assessment {
  return {
    ...a,
    questions: a.questions.map((q) => ({
      ...q,
      topics: [...q.topics],
      sourceIds: [...q.sourceIds],
      scoring: q.scoring.map((p) => ({ ...p })),
    })),
  };
}

function cloneSubmission(s: Submission): Submission {
  return { ...s, resourceIds: [...s.resourceIds], questionTimes: s.questionTimes.map((t) => ({ ...t })) };
}

function assessmentEquals(a: Assessment, b: Assessment): boolean {
  return JSON.stringify(serializeAssessment(a)) === JSON.stringify(serializeAssessment(b));
}

function submissionEquals(a: Submission, b: Submission): boolean {
  return JSON.stringify(serializeSubmission(a)) === JSON.stringify(serializeSubmission(b));
}

function gradeEquals(a: Grade, b: Grade): boolean {
  return JSON.stringify(serializeGrade(a)) === JSON.stringify(serializeGrade(b));
}

function startsWithQuestionTimes(list: QuestionTime[], prefix: QuestionTime[]): boolean {
  return prefix.every((p, i) => list[i] !== undefined && list[i]!.questionId === p.questionId && list[i]!.localTime === p.localTime);
}

// ---------- Education 解析/序列化 ----------

const EDUCATION_KEYS = [
  "focusTasks",
  "projects",
  "resources",
  "semesters",
  "semesterHistory",
  "lessons",
  "assessments",
  "submissions",
  "grades",
  "reviews",
  "events",
  "completedTasks",
  "progress",
  "corrections",
] as const;

export function parseEducation(raw: unknown): Education {
  if (!isObject(raw)) throw new AppError("教学数据必须是对象");
  rejectUnknown(raw, [...EDUCATION_KEYS], "教学数据");
  const e = new Education();
  e.focusTasks = field(raw, "focusTasks", "教学数据", (v) =>
    asArray(v, "focusTasks").map((x) => {
      ensure(isObject(x), "教学待办关联必须是对象");
      rejectUnknown(x, ["taskId", "sourceId", "kind"], "教学待办关联");
      return {
        taskId: requiredField(x, "taskId", "教学待办关联", asStr),
        sourceId: requiredField(x, "sourceId", "教学待办关联", asStr),
        kind: oneOf(requiredField(x, "kind", "教学待办关联", (k) => k), "教学待办 kind", ["lesson", "homework"]) as "lesson" | "homework",
      };
    }),
    [],
  );
  e.projects = field(raw, "projects", "教学数据", (v) => asArray(v, "projects").map(parseProjectStudy), []);
  e.resources = field(raw, "resources", "教学数据", (v) => asArray(v, "resources").map(parseResource), []);
  e.semesters = field(raw, "semesters", "教学数据", (v) => asArray(v, "semesters").map(parseSemester), []);
  e.semesterHistory = field(raw, "semesterHistory", "教学数据", (v) => asArray(v, "semesterHistory").map(parseSemester), []);
  e.lessons = field(raw, "lessons", "教学数据", (v) => asArray(v, "lessons").map(parseLesson), []);
  e.assessments = field(raw, "assessments", "教学数据", (v) => asArray(v, "assessments").map(parseAssessment), []);
  e.submissions = field(raw, "submissions", "教学数据", (v) => asArray(v, "submissions").map(parseSubmission), []);
  e.grades = field(raw, "grades", "教学数据", (v) => asArray(v, "grades").map(parseGrade), []);
  e.reviews = field(raw, "reviews", "教学数据", (v) => asArray(v, "reviews").map(parseReview), []);
  e.events = field(raw, "events", "教学数据", (v) => asArray(v, "events").map(parseTeachingEvent), []);
  e.completedTasks = field(raw, "completedTasks", "教学数据", (v) => asArray(v, "completedTasks").map(parseCompletedStudyTask), []);
  e.progress = field(raw, "progress", "教学数据", (v) => asArray(v, "progress").map(parseProgressRecord), []);
  e.corrections = field(raw, "corrections", "教学数据", (v) => asArray(v, "corrections").map(parseCorrection), []);
  return e;
}

export function serializeEducation(e: Education): Record<string, unknown> {
  return {
    focusTasks: e.focusTasks.map((t) => ({ taskId: t.taskId, sourceId: t.sourceId, kind: t.kind })),
    projects: e.projects.map(serializeProjectStudy),
    resources: e.resources.map(serializeResource),
    semesters: e.semesters.map(serializeSemester),
    semesterHistory: e.semesterHistory.map(serializeSemester),
    lessons: e.lessons.map(serializeLesson),
    assessments: e.assessments.map(serializeAssessment),
    submissions: e.submissions.map(serializeSubmission),
    grades: e.grades.map(serializeGrade),
    reviews: e.reviews.map(serializeReview),
    events: e.events.map(serializeTeachingEvent),
    completedTasks: e.completedTasks.map(serializeCompletedStudyTask),
    progress: e.progress.map(serializeProgressRecord),
    corrections: e.corrections.map(serializeCorrection),
  };
}
