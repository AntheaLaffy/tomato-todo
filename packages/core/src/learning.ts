//! 学情证据：已完成任务快照、来源可审计且不可覆写的进度历史、订正检查，
//! 按提交/批改/订正索引计算动态学情摘要及掌握/计时/订正/复测分层。
//! 对应 crates/core/src/learning.rs。

import { AppError, ensure, require } from "./errors";
import { asArray, asBool, asInt, asOpt, asStr, field, isObject, oneOf, rejectUnknown, requiredField } from "./json";
import type { Education } from "./education";
import type { AppData } from "./lib";
import type {
  Assessment,
  CompletedStudyTask,
  Correction,
  Grade,
  Lesson,
  ProgressRecord,
  Review,
  Submission,
} from "./model";
import { atLocalDateString, dateAt } from "./time";

export function parseCompletedStudyTask(raw: unknown): CompletedStudyTask {
  if (!isObject(raw)) throw new AppError("已完成学习任务快照必须是对象");
  rejectUnknown(raw, ["id", "projectId", "title", "notes", "topics", "completedAt"], "已完成学习任务快照");
  return {
    id: requiredField(raw, "id", "已完成学习任务快照", asStr),
    projectId: requiredField(raw, "projectId", "已完成学习任务快照", asStr),
    title: requiredField(raw, "title", "已完成学习任务快照", asStr),
    notes: requiredField(raw, "notes", "已完成学习任务快照", asStr),
    topics: field(raw, "topics", "已完成学习任务快照", (v) => asArray(v, "topics").map((x) => asStr(x, "知识点")), []),
    completedAt: requiredField(raw, "completedAt", "已完成学习任务快照", asInt),
  };
}

export function serializeCompletedStudyTask(t: CompletedStudyTask): Record<string, unknown> {
  return { id: t.id, projectId: t.projectId, title: t.title, notes: t.notes, topics: t.topics, completedAt: t.completedAt };
}

function text(s: string, max: number): boolean {
  return s.trim().length > 0 && Array.from(s).length <= max;
}

export function validateLearning(data: AppData): void {
  const e = data.education;
  ensure(e.progress.length + e.completedTasks.length + e.corrections.length <= 100000, "学习证据数量超出限制");
  const ids = new Set<string>();
  for (const task of e.completedTasks) {
    ensure(
      !ids.has(`task|${task.id}`) &&
        task.id.length > 0 &&
        data.projects.some((p) => p.id === task.projectId) &&
        text(task.title, 200) &&
        task.notes.length <= 50000 &&
        task.topics.length <= 20,
      "无效的已完成学习任务快照",
    );
    ids.add(`task|${task.id}`);
  }
  for (const record of e.progress) {
    ensure(
      !ids.has(`progress|${record.id}`) &&
        record.id.length > 0 &&
        data.projects.some((p) => p.id === record.projectId) &&
        text(record.topic, 200) &&
        text(record.position, 2000) &&
        text(record.evidence, 8000) &&
        Array.from(record.nextAction).length <= 2000,
      "学习进度需要项目、知识点、实际位置和依据",
    );
    ids.add(`progress|${record.id}`);
  }
  for (const correction of e.corrections) {
    const grade = require(e.grades.find((g) => g.id === correction.gradeId), "订正缺少批改记录");
    const assessment = require(
      (() => {
        const sub = e.submissions.find((s) => s.id === grade.submissionId);
        return sub === undefined ? undefined : e.assessments.find((a) => a.id === sub.assessmentId);
      })(),
      "订正缺少试题",
    );
    ensure(
      !ids.has(`correction|${correction.id}`) &&
        correction.id.length > 0 &&
        assessment.questions.some((q) => q.id === correction.questionId) &&
        Array.from(correction.explanation).length <= 8000 &&
        (text(correction.explanation, 8000) || correction.resourceIds.length > 0) &&
        correction.resourceIds.every((id) =>
          e.resources.some((r) => r.id === id && r.projectId === assessment.projectId),
        ) &&
        (correction.accepted !== null) === (correction.reviewedAt !== null) &&
        (correction.reviewedAt === null ||
          (correction.reviewedAt >= correction.submittedAt && text(correction.feedback, 8000))),
      "订正需要原题、解释或本项目附件；检查结果必须有反馈",
    );
    ids.add(`correction|${correction.id}`);
  }
}

/** 进度/快照/订正历史不可删除、不可改写；确认与检查状态允许单向推进。 */
export function validateLearningTransition(before: Education, after: Education): void {
  for (const record of before.progress) {
    ensure(after.progress.some((r) => r.id === record.id), "进度历史不能删除，请新增更正记录");
    const next = after.progress.find((r) => r.id === record.id);
    if (next !== undefined) {
      const old = { ...record };
      old.confirmed = next.confirmed;
      ensure(progressEquals(old, next), "进度历史不可改写，请新增一条更正记录");
    }
  }
  for (const record of before.completedTasks) {
    ensure(
      after.completedTasks.find((r) => r.id === record.id) !== undefined &&
        completedTaskEquals(after.completedTasks.find((r) => r.id === record.id)!, record),
      "已完成任务的学习内容快照不可改写",
    );
  }
  for (const record of before.corrections) {
    ensure(after.corrections.some((r) => r.id === record.id), "订正历史不能删除");
    const next = after.corrections.find((r) => r.id === record.id);
    if (next !== undefined) {
      const old = { ...record, resourceIds: [...record.resourceIds] };
      if (old.reviewedAt === null) {
        old.accepted = next.accepted;
        old.feedback = next.feedback;
        old.reviewedAt = next.reviewedAt;
      }
      ensure(correctionEquals(old, next), "订正与检查历史不可改写，请新增一次订正");
    }
  }
}

function progressEquals(a: ProgressRecord, b: ProgressRecord): boolean {
  return (
    a.id === b.id &&
    a.projectId === b.projectId &&
    a.topic === b.topic &&
    a.position === b.position &&
    a.state === b.state &&
    a.evidence === b.evidence &&
    a.nextAction === b.nextAction &&
    a.source === b.source &&
    a.confirmed === b.confirmed &&
    a.recordedAt === b.recordedAt
  );
}

function completedTaskEquals(a: CompletedStudyTask, b: CompletedStudyTask): boolean {
  return (
    a.id === b.id &&
    a.projectId === b.projectId &&
    a.title === b.title &&
    a.notes === b.notes &&
    a.topics.length === b.topics.length &&
    a.topics.every((t, i) => b.topics[i] === t) &&
    a.completedAt === b.completedAt
  );
}

function correctionEquals(a: Correction, b: Correction): boolean {
  return (
    a.id === b.id &&
    a.gradeId === b.gradeId &&
    a.questionId === b.questionId &&
    a.explanation === b.explanation &&
    a.resourceIds.length === b.resourceIds.length &&
    a.resourceIds.every((r, i) => b.resourceIds[i] === r) &&
    a.submittedAt === b.submittedAt &&
    a.accepted === b.accepted &&
    a.feedback === b.feedback &&
    a.reviewedAt === b.reviewedAt
  );
}

// ---------- 学情摘要 ----------

interface SummaryIndex {
  submissions: Map<string, Submission>;
  grades: Map<string, Grade>;
  assessmentGrades: Map<string, Grade>;
  accepted: Set<string>;
  retests: Map<string, Assessment[]>;
}

function buildSummaryIndex(e: Education): SummaryIndex {
  const index: SummaryIndex = {
    submissions: new Map(),
    grades: new Map(),
    assessmentGrades: new Map(),
    accepted: new Set(),
    retests: new Map(),
  };
  const parents = new Map<string, string>();
  for (const s of e.submissions) {
    parents.set(s.id, s.assessmentId);
    const old = index.submissions.get(s.assessmentId);
    if (old === undefined || s.submittedAt >= old.submittedAt) {
      index.submissions.set(s.assessmentId, s);
    }
  }
  for (const g of e.grades) {
    const old = index.grades.get(g.submissionId);
    if (old === undefined || g.gradedAt >= old.gradedAt) {
      index.grades.set(g.submissionId, g);
    }
    const assessment = parents.get(g.submissionId);
    if (assessment !== undefined) {
      const oldA = index.assessmentGrades.get(assessment);
      if (oldA === undefined || g.gradedAt >= oldA.gradedAt) {
        index.assessmentGrades.set(assessment, g);
      }
    }
  }
  for (const c of e.corrections) {
    if (c.accepted === true) {
      index.accepted.add(`${c.gradeId}|${c.questionId}`);
    }
  }
  for (const a of e.assessments) {
    if (a.retestOfGradeId !== null) {
      const list = index.retests.get(a.retestOfGradeId) ?? [];
      list.push(a);
      index.retests.set(a.retestOfGradeId, list);
    }
  }
  return index;
}

function assessmentSummary(index: SummaryIndex, a: Assessment, at: number): Record<string, unknown> {
  const submission = index.submissions.get(a.id) ?? null;
  const grade = submission !== null ? (index.grades.get(submission.id) ?? null) : null;
  const status = (() => {
    if (grade !== null) {
      if (grade.needsReview) return "needsReview";
      if (
        grade.errors.some(
          (error) => !index.accepted.has(`${grade.id}|${error.questionId}`),
        )
      ) {
        return "correctionDue";
      }
      return "graded";
    }
    if (submission !== null) return "submitted";
    if (a.kind !== "homework" && a.startedAt === null && dateAt(at) > dateAt(a.startsAt)) {
      return "missed";
    }
    if (
      a.kind !== "homework" &&
      a.startedAt !== null &&
      a.stoppedAt === null &&
      at < examDeadline(a)
    ) {
      return "inProgress";
    }
    if (
      a.kind !== "homework" &&
      a.startedAt !== null &&
      (a.stoppedAt !== null || at >= examDeadline(a))
    ) {
      return "awaitingSubmission";
    }
    if (a.kind === "homework" && at >= a.endsAt) return "overdue";
    if (at < a.startsAt || (a.kind !== "homework" && a.startedAt === null)) return "upcoming";
    return "awaitingSubmission";
  })();
  return {
    id: a.id,
    title: a.title,
    kind: a.kind,
    status,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    submissionId: submission?.id ?? null,
    submittedAt: submission?.submittedAt ?? null,
    unfinished: submission !== null && submission.unfinished,
    late: a.kind === "homework" && submission !== null && submission.submittedAt > a.endsAt,
    gradeId: grade?.id ?? null,
    gradedAt: grade?.gradedAt ?? null,
    score: grade !== null && !grade.needsReview ? grade.awards.reduce((n, p) => n + p.awarded, 0) : null,
    total: a.questions.reduce((n, q) => n + q.scoring.reduce((m, p) => m + p.points, 0), 0),
    needsReview: grade !== null && grade.needsReview,
  };
}

function examDeadline(a: Assessment): number {
  return a.startedAt === null ? a.endsAt : a.startedAt + (a.endsAt - a.startsAt);
}

/** 每次从当前证据推导；没有第二份会过期的摘要。 */
export function summaries(data: AppData, at: number): Record<string, unknown>[] {
  const e = data.education;
  const index = buildSummaryIndex(e);
  const out: Record<string, unknown>[] = [];
  for (const project of data.projects.filter(
    (p) =>
      e.projects.some((s) => s.projectId === p.id) || e.progress.some((r) => r.projectId === p.id),
  )) {
    const progress = e.progress.filter((r) => r.projectId === project.id).slice().sort((a, b) => a.recordedAt - b.recordedAt);
    const topics = new Set<string>();
    const latest = progress
      .slice()
      .reverse()
      .filter((r) => {
        if (topics.has(r.topic)) return false;
        topics.add(r.topic);
        return true;
      });
    const assessments = e.assessments
      .filter((a) => a.projectId === project.id)
      .map((a) => assessmentSummary(index, a, at))
      .sort((a, b) => (b.startsAt as number) - (a.startsAt as number));
    const retests: Record<string, unknown>[] = [];
    const grades = e.assessments
      .filter((a) => a.projectId === project.id)
      .map((a) => index.assessmentGrades.get(a.id))
      .filter((g): g is Grade => g !== undefined);
    for (const grade of grades) {
      const attempts = (index.retests.get(grade.id) ?? []).map((a) => assessmentSummary(index, a, at));
      for (const error of grade.errors) {
        retests.push({
          gradeId: grade.id,
          questionId: error.questionId,
          cause: error.cause,
          confirmed: error.confirmed,
          retestDate: error.retestDate,
          nextCheck: error.nextCheck,
          correctionAccepted: index.accepted.has(`${grade.id}|${error.questionId}`),
          attempts,
        });
      }
    }
    retests.sort((a, b) => String(a["retestDate"]).localeCompare(String(b["retestDate"])));
    const recentTasks = e.completedTasks
      .slice()
      .reverse()
      .filter((t) => t.projectId === project.id)
      .slice(0, 5);
    const lessons = e.lessons.filter((l) => l.projectId === project.id);
    const lastLesson = lessons
      .filter((l) => l.attended)
      .reduce<Lesson | null>((best, l) => (best === null || l.startsAt > best.startsAt ? l : best), null);
    const latestReview = e.reviews
      .filter((r) => r.projectId === project.id)
      .reduce<Review | null>((best, r) => (best === null || r.date > best.date ? r : best), null);
    const reviewTime = latestReview === null ? null : atLocalDateString(latestReview.date);
    const updated = Math.max(
      ...[
        ...latest.map((r) => r.recordedAt),
        ...recentTasks.map((r) => r.completedAt),
        ...(lastLesson !== null ? [lastLesson.startsAt] : []),
        ...(reviewTime !== null ? [reviewTime] : []),
        ...assessments.filter((a) => typeof a["submittedAt"] === "number").map((a) => a["submittedAt"] as number),
        ...assessments.filter((a) => typeof a["gradedAt"] === "number").map((a) => a["gradedAt"] as number),
        ...e.corrections
          .filter((c) => assessments.some((a) => a["gradeId"] === c.gradeId))
          .map((c) => c.reviewedAt ?? c.submittedAt),
      ].filter((n) => typeof n === "number"),
      -Infinity,
    );
    const taskIds = new Set<string>([
      ...data.tasks.filter((t) => t.projectId === project.id).map((t) => t.id),
      ...e.completedTasks.filter((t) => t.projectId === project.id).map((t) => t.id),
    ]);
    const actualSeconds = data.sessions
      .filter(
        (s) =>
          s.source === "timer" &&
          s.endedAt >= at - 7 * 86400 &&
          s.endedAt <= at &&
          s.taskId !== null &&
          taskIds.has(s.taskId),
      )
      .reduce((n, s) => n + s.durationSecs, 0);
    const assessmentCount = assessments.length;
    const retestCount = retests.length;
    out.push({
      projectId: project.id,
      projectName: project.name,
      updatedAt: Number.isFinite(updated) ? updated : null,
      progress: latest.slice(0, 12),
      progressCount: e.progress.filter((r) => r.projectId === project.id).length,
      recentCompletedTasks: recentTasks,
      lastAttendedLesson:
        lastLesson === null
          ? null
          : { id: lastLesson.id, title: lastLesson.title, progress: lastLesson.progress, state: lastLesson.state },
      lessons: {
        planned: lessons.filter((l) => l.state === "planned").length,
        attended: lessons.filter((l) => l.attended).length,
        missed: lessons.filter((l) => l.state === "missed").length,
      },
      actualFocusSeconds7d: actualSeconds,
      assessments: assessments.slice(0, 20),
      assessmentCount,
      retests: retests.slice(0, 20),
      retestCount,
      latestReview,
      pendingEvents: e.events.filter((r) => r.projectId === project.id && r.state !== "done").length,
      note: "计时与任务完成只说明投入或自报完成；掌握须查看答卷、批改与独立复测。空记录表示未知。",
    });
  }
  return out;
}
