import { teachingIndex } from "./education-index";
import { agentCall, dispatch, saveAgentFile, getSnapshot } from "./api";
import type { Snapshot, Project } from "./types";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  resourceKinds as kinds,
  resourceLibrary,
  resourceLinks,
  mountResources,
} from "./resources";
export interface ProjectStudy {
  projectId: string;
  directory: string;
  examMode: boolean;
  visionId: string | null;
  target: string;
  examDate: string | null;
  syllabusId: string | null;
  pastPaperIds: string[];
  mockPaperIds: string[];
}
export interface Resource {
  id: string;
  projectId: string;
  title: string;
  kind: string;
  path: string;
  source: string;
  edition: string;
  topics: string[];
}
export interface Semester {
  id: string;
  projectId: string;
  title: string;
  startDate: string;
  endDate: string;
  revision: number;
  baseline: string;
  evidence: string[];
  rationale: string;
  milestones: {
    week: number;
    topics: string[];
    resourceIds: string[];
    objective: string;
    lessonCount: number;
  }[];
}
export interface Lesson {
  id: string;
  projectId: string;
  semesterId: string;
  semesterRevision: number;
  title: string;
  topics: string[];
  resourceIds: string[];
  startsAt: number;
  endsAt: number;
  aiEnabled: boolean;
  attended: boolean;
  progress: string;
  state: string;
}
export interface Question {
  id: string;
  prompt: string;
  topics: string[];
  sourceIds: string[];
  extension: boolean;
  estimatedMinutes: number;
  answer: string;
  acceptableAlternatives: string;
  scoring: { id: string; description: string; points: number }[];
}
export interface Assessment {
  id: string;
  projectId: string;
  semesterId: string;
  semesterRevision: number;
  lessonId: string | null;
  taskId: string | null;
  retestOfGradeId: string | null;
  title: string;
  kind: string;
  revision: number;
  startsAt: number;
  endsAt: number;
  instructions: string;
  reviewEvidence: string;
  questions: Question[];
  publishedAt: number;
  printedAt: number | null;
  startedAt: number | null;
  stoppedAt: number | null;
}
export interface Submission {
  id: string;
  assessmentId: string;
  submittedAt: number;
  resourceIds: string[];
  answers: string;
  unfinished: boolean;
  questionTimes: { questionId: string; localTime: string }[];
}
export interface Grade {
  id: string;
  submissionId: string;
  assessmentRevision: number;
  gradedAt: number;
  awards: {
    questionId: string;
    pointId: string;
    awarded: number;
    evidence: string;
  }[];
  errors: {
    questionId: string;
    cause: string;
    evidence: string;
    correction: string;
    nextCheck: string;
    retestDate: string;
    confirmed: boolean;
  }[];
  needsReview: boolean;
  feedback: string;
}
export interface Review {
  id: string;
  date: string;
  projectId: string;
  gradeIds: string[];
  findings: string;
  actions: string[];
}
export interface ProgressRecord {
  id: string;
  projectId: string;
  topic: string;
  position: string;
  state: "studied" | "practicing" | "needsReview";
  evidence: string;
  nextAction: string;
  source: "user" | "assistant";
  confirmed: boolean;
  recordedAt: number;
}
export interface Correction {
  id: string;
  gradeId: string;
  questionId: string;
  explanation: string;
  resourceIds: string[];
  submittedAt: number;
  accepted: boolean | null;
  feedback: string;
  reviewedAt: number | null;
}
export interface StudySummary {
  projectId: string;
  projectName: string;
  updatedAt: number | null;
  progress: ProgressRecord[];
  progressCount: number;
  recentCompletedTasks: { id: string; title: string; completedAt: number }[];
  lastAttendedLesson: {
    id: string;
    title: string;
    progress: string;
    state: string;
  } | null;
  actualFocusSeconds7d: number;
  pendingEvents: number;
  assessments: {
    id: string;
    title: string;
    kind: string;
    status: string;
    score: number | null;
    total: number;
    late: boolean;
    unfinished: boolean;
    gradeId: string | null;
  }[];
  retests: {
    gradeId: string;
    questionId: string;
    cause: string;
    confirmed: boolean;
    retestDate: string;
    nextCheck: string;
    correctionAccepted: boolean;
  }[];
}
export interface Education {
  focusTasks?: {
    taskId: string;
    sourceId: string;
    kind: "lesson" | "homework";
  }[];
  projects: ProjectStudy[];
  progress: ProgressRecord[];
  corrections: Correction[];
  completedTasks: {
    id: string;
    projectId: string;
    title: string;
    notes: string;
    topics: string[];
    completedAt: number;
  }[];
  resources: Resource[];
  semesters: Semester[];
  semesterHistory: Semester[];
  lessons: Lesson[];
  assessments: Assessment[];
  submissions: Submission[];
  grades: Grade[];
  reviews: Review[];
  events: {
    id: string;
    projectId: string;
    kind: string;
    sourceId: string;
    state: string;
    createdAt: number;
  }[];
}
let educationPanelView: "student" | "teacher" = "student";
let educationProjectId: string | null = null;
const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const when = (n: number) =>
  new Date(n * 1000).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Keep the request tied to the event's immutable source, not an edited task row. */
export function homeworkRequest(
  snapshot: Snapshot,
  eventId: string,
): string | null {
  const education = snapshot.data.education;
  const event = education.events.find((item) => item.id === eventId);
  if (
    !event ||
    !["homework", "taskHomework"].includes(event.kind) ||
    !education.projects.some(
      (project) => project.projectId === event.projectId && project.examMode,
    )
  )
    return null;
  const project = snapshot.data.projects.find((p) => p.id === event.projectId);
  if (!project) return null;
  let source: string;
  if (event.kind === "taskHomework") {
    const task = education.completedTasks.find(
      (item) =>
        item.id === event.sourceId && item.projectId === event.projectId,
    );
    if (!task) return null;
    source = `完成的任务：${task.title}（taskId: ${task.id}，完成于 ${when(task.completedAt)}）
任务完成时的备注：${task.notes || "未记录，需核实实际学到的位置"}
任务知识点：${task.topics.join("、") || "未记录，需先核实"}`;
  } else {
    const lesson = education.lessons.find(
      (item) =>
        item.id === event.sourceId && item.projectId === event.projectId,
    );
    if (!lesson) return null;
    const resources = lesson.resourceIds.map(
      (id) => education.resources.find((item) => item.id === id)?.title ?? id,
    );
    source = `刚结束的课程：${lesson.title}（lessonId: ${lesson.id}，${when(lesson.startsAt)}—${when(lesson.endsAt)}）
课程知识点：${lesson.topics.join("、") || "未记录，需先核实"}
实际进度：${lesson.progress || "未记录，需核实实际讲授范围"}
指定资料：${resources.join("、") || "未指定，需检查项目资料"}`;
  }
  return `请读取 exam-teaching 和 exam-authoring 技能，为应试项目「${project.name}」（projectId: ${event.projectId}）布置对应作业。
${source}
教学事件：${event.id}。先查询事件状态，若后台已在处理或已有作业，不要重复发布；需要重试时请先说明。读取 get_study_progress 与项目已授权资料，核实实际已学范围、证据和当日课程及自习负荷；只对有依据的已学内容出题，未知部分先问我，不推定掌握，也不要机械凑满 180 分钟。发布前完成命题蓝图、答案、评分点及独立复解与适用核验；保存实际作业后再 finishEvent。`;
}
export async function chooseProjectDirectory(): Promise<string | null> {
  return isTauri() ? invoke<string | null>("choose_project_directory") : null;
}
const assessmentKinds: Record<string, string> = {
  homework: "作业",
  weeklyExam: "周考",
  mockExam: "全真模拟",
  retest: "复测",
};
const eventKinds: Record<string, string> = {
  homework: "课后作业",
  taskHomework: "任务完成后布置作业",
  grade: "批改",
  correction: "检查订正",
  review: "复盘",
  weeklyExam: "准备周考",
};
const progressStates: Record<string, string> = {
  studied: "已学，待练习验证",
  practicing: "练习中",
  needsReview: "需要复习",
};
const assessmentStates: Record<string, string> = {
  upcoming: "尚未开始",
  awaitingSubmission: "待提交",
  submitted: "已交，待批改",
  needsReview: "批改待复核",
  correctionDue: "待订正",
  graded: "已批改",
  overdue: "已到期，待提交",
  inProgress: "考试中",
};
function progressCard(
  summary: StudySummary | undefined,
  projectId: string,
): string {
  return `<section class="study-progress"><div class="card-heading"><h3>最新学情</h3><button class="button secondary small-button" data-progress-record="${esc(projectId)}">更新学习进度</button></div><p>${summary?.updatedAt ? `最近更新：${when(summary.updatedAt)}` : "尚无实际学习记录，当前进度未知"} · 最近7天实际计时 ${Math.round((summary?.actualFocusSeconds7d || 0) / 60)} 分钟</p><p data-explanation>学习位置、任务完成、答卷成绩分别记录；完成课时或订正不自动表示掌握。</p>${summary?.progress.map((r) => `<article class="study-row"><strong>${esc(r.topic)}</strong> · ${esc(progressStates[r.state])}<p>${esc(r.position)}</p><p>依据：${esc(r.evidence)}</p><p>下一步：${esc(r.nextAction || "待安排")}</p><small>${when(r.recordedAt)} · ${r.source === "user" ? "本人登记" : "助手整理"} · ${r.confirmed ? "已确认" : "待确认"}</small>${!r.confirmed ? `<button class="text-button" data-progress-confirm="${esc(r.id)}">确认这条进度</button>` : ""}</article>`).join("") || "<p>可登记课程讲次、视频位置、习题页码和仍不确定的知识点。</p>"}${summary?.recentCompletedTasks.length ? `<details><summary>最近完成的学习任务</summary>${summary.recentCompletedTasks.map((t) => `<p>${esc(t.title)} · ${when(t.completedAt)}</p>`).join("")}</details>` : ""}</section>`;
}
function assessmentRow(a: Assessment, e: Education, at: number): string {
  const index = teachingIndex(e);
  const subs = index.submissions.get(a.id) || [];
  const latest = index.latestSubmission.get(a.id);
  const latestGrade = latest ? index.latestGrade.get(latest.id) : undefined;
  const status = {
    status: assessmentState(a, e, at),
    score:
      latestGrade && !latestGrade.needsReview
        ? latestGrade.awards.reduce((n, p) => n + p.awarded, 0)
        : null,
    total: a.questions
      .flatMap((q) => q.scoring)
      .reduce((n, p) => n + p.points, 0),
    late: !!latest && latest.submittedAt > a.endsAt,
    unfinished: latest?.unfinished,
  };
  const exam = a.kind !== "homework";
  const started = a.startedAt !== null;
  const stopped = a.stoppedAt !== null;
  const grades = subs.flatMap((s) => index.grades.get(s.id) || []);
  return `<article class="study-row" data-assessment-id="${esc(a.id)}"><h3>${esc(a.title)} · ${esc(assessmentKinds[a.kind] || a.kind)}</h3><p><strong>${esc(assessmentStates[status?.status || ""] || "待处理")}</strong>${status?.score !== null && status?.score !== undefined ? ` · ${status.score} / ${status.total}分` : ""}${status?.late ? " · 逾期提交" : ""}${status?.unfinished ? " · 含未完成部分" : ""}</p><p>${when(a.startsAt)} — ${when(a.endsAt)}${stopped ? " · 已停笔，请交卷" : ""}</p><p>${esc(a.instructions)}</p>${a.retestOfGradeId ? "<p>独立复测：关联原始批改，成绩单独记录。</p>" : ""}<details${exam && started && !stopped ? " open" : ""}><summary>查看题目</summary>${a.questions.map((q) => `<p><strong>${esc(q.id)}${q.extension ? "（拓展）" : ""}</strong> ${esc(q.prompt)}</p>${resourceLinks(q.sourceIds, e.resources, "题目来源")}`).join("")}</details><div class="button-row"><button class="button secondary small-button" data-paper="${esc(a.id)}">下载可打印试卷和答题卡</button>${exam ? `<button class="button secondary small-button" data-printed="${esc(a.id)}" ${a.printedAt ? "disabled" : ""}>${a.printedAt ? "已确认打印" : "确认打印完成"}</button>${!started ? `<button class="button secondary small-button" data-exam-start="${esc(a.id)}" ${!a.printedAt || at < a.startsAt || at >= a.endsAt ? "disabled" : ""}>开始考试</button>` : !stopped ? `<button class="button secondary small-button" data-exam-end="${esc(a.id)}">提前停笔并交卷</button>` : ""}` : ""}${!exam || stopped ? `<button class="button secondary small-button" data-study-submit="${esc(a.id)}" ${at < a.startsAt ? "disabled" : ""}>${subs.length ? "重交新版本" : exam ? "提交答题卡" : "交作业"}</button>` : ""}</div><p>${subs.length}次提交 · ${grades.length}次批改</p>${subs.map((s, i) => `<details><summary>第${i + 1}次提交 · ${when(s.submittedAt)}${s.submittedAt > a.endsAt ? " · 逾期" : ""}${s.unfinished ? " · 未完成" : ""}</summary><p>${esc(s.answers || "以附件为准")}</p><p>答卷附件 ${s.resourceIds.length} 份</p>${resourceLinks(s.resourceIds, e.resources, "答卷附件")}${s.questionTimes.map((t) => `<p>${esc(t.questionId)}：${esc(t.localTime)}</p>`).join("")}</details>`).join("")}${grades
    .map(
      (g) =>
        `<details><summary>${g.needsReview ? "待复核，分数未定" : "已批改"} · ${g.awards.reduce((n, p) => n + p.awarded, 0)}分 · ${when(g.gradedAt)}</summary><p>${esc(g.feedback)}</p>${g.awards.map((p) => `<p>${esc(p.questionId)} / ${esc(p.pointId)}：${p.awarded}分 · ${esc(p.evidence)}</p>`).join("")}${g.errors
          .map(
            (x) =>
              `<article class="study-row"><strong>${esc(x.questionId)}：${esc(x.cause)}${x.confirmed ? "" : "（错因待确认）"}</strong><p>证据：${esc(x.evidence)}<br>纠正：${esc(x.correction)}<br>下次检查：${esc(x.nextCheck)}<br>复测：${esc(x.retestDate)}</p><button class="button secondary small-button" data-correction-grade="${esc(g.id)}" data-correction-question="${esc(x.questionId)}">提交订正</button>${(
                index.corrections.get(g.id)?.get(x.questionId) || []
              )
                .map(
                  (c) =>
                    `<p>订正 ${when(c.submittedAt)} · ${c.accepted === null ? "待检查" : c.accepted ? "订正通过，仍需独立复测" : "继续订正"}<br>${esc(c.explanation)}<br>${esc(c.feedback)}</p>${resourceLinks(c.resourceIds, e.resources, "订正附件")}`,
                )
                .join("")}</article>`,
          )
          .join(
            "",
          )}<div class="button-row"><button class="text-button" data-grade-review="${esc(g.id)}">请助手复核与复盘</button><button class="text-button" data-retest-request="${esc(g.id)}">安排独立复测</button></div></details>`,
    )
    .join("")}</article>`;
}

const statusLabels: Record<string, string> = {
  upcoming: "未开始",
  inProgress: "进行中",
  awaitingSubmission: "待提交",
  submitted: "待批改",
  needsReview: "待复核",
  correctionDue: "待订正",
  graded: "已批改",
  overdue: "逾期未交",
};
const dateOnly = (seconds: number) => {
  const d = new Date(seconds * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const shiftDate = (value: string, days: number) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
};
const dateDistance = (from: string, to: string) => {
  const parse = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.floor((parse(to) - parse(from)) / 86400000);
};
function dashboardAssessmentStatus(a: Assessment, snapshot: Snapshot) {
  return assessmentState(a, snapshot.data.education, snapshot.serverTime);
}
function assessmentState(a: Assessment, e: Education, at: number) {
  const index = teachingIndex(e);
  const submission = index.latestSubmission.get(a.id);
  const grade = submission ? index.latestGrade.get(submission.id) : undefined;
  if (grade?.needsReview) return "needsReview";
  if (
    grade?.errors.some(
      (error) => !index.accepted.get(grade.id)?.has(error.questionId),
    )
  )
    return "correctionDue";
  if (grade) return "graded";
  if (submission) return "submitted";
  if (a.kind !== "homework" && a.startedAt && !a.stoppedAt) return "inProgress";
  if (a.stoppedAt || at >= a.endsAt) return "overdue";
  if (at < a.startsAt) return "upcoming";
  return "awaitingSubmission";
}
const assessmentPriority = (status: string) =>
  [
    "inProgress",
    "overdue",
    "awaitingSubmission",
    "correctionDue",
    "needsReview",
    "submitted",
  ].indexOf(status);
function dashboardProjectLink(projectId: string, label = "打开完整项目记录") {
  return `<button class="text-button" data-page="project:${esc(projectId)}">${esc(label)} ↗</button>`;
}
function dashboardAssessmentLine(
  a: Assessment,
  status: string,
  detail = "",
  resources: Resource[] = [],
) {
  return `<article class="education-dashboard-row"><div><strong>${esc(a.title)}</strong><small>${esc(assessmentKinds[a.kind] || a.kind)} · ${when(a.startsAt)}–${when(a.endsAt)}${detail ? ` · ${esc(detail)}` : ""}</small>${resourceLinks(
    a.questions.flatMap((q) => q.sourceIds),
    resources,
  )}</div><span class="education-status status-${esc(status)}">${esc(statusLabels[status] || "待处理")}</span><button class="text-button" data-page="project:${esc(a.projectId)}">查看</button></article>`;
}
function teacherAssessmentLine(a: Assessment, snapshot: Snapshot) {
  const e = snapshot.data.education;
  const index = teachingIndex(e);
  const submissions = index.submissions.get(a.id) || [];
  const gradeCount = submissions.reduce(
    (n, s) => n + (index.grades.get(s.id)?.length || 0),
    0,
  );
  const topics = [
    ...new Set(a.questions.flatMap((question) => question.topics)),
  ].join("、");
  return dashboardAssessmentLine(
    a,
    dashboardAssessmentStatus(a, snapshot),
    `${a.questions.length}题 · ${topics || "知识点未标注"} · ${submissions.length}次提交 / ${gradeCount}次批改`,
    e.resources,
  );
}
function dashboardLessonLine(l: Lesson, resources: Resource[]) {
  const state =
    l.state === "missed"
      ? "缺课"
      : l.attended
        ? "已参加"
        : l.state === "ended"
          ? "已下课，参与情况未登记"
          : l.state === "active"
            ? "进行中"
            : "待上课";
  return `<article class="education-dashboard-row"><div><strong>${esc(l.title)}</strong><small>${when(l.startsAt)} · ${esc(l.topics.join("、"))}</small>${l.progress ? `<small>实际进度：${esc(l.progress)}</small>` : ""}${resourceLinks(l.resourceIds, resources)}</div><span class="education-status">${state}</span></article>`;
}
function studentDashboard(
  snapshot: Snapshot,
  project: Project,
  study: ProjectStudy,
  summary: StudySummary | undefined,
) {
  const e = snapshot.data.education;
  const end = shiftDate(snapshot.today, 7);
  const lessons = e.lessons
    .filter(
      (l) =>
        l.projectId === project.id &&
        l.endsAt >= snapshot.serverTime &&
        dateOnly(l.startsAt) < end,
    )
    .sort((a, b) => a.startsAt - b.startsAt);
  const followupStatuses = new Set([
    "overdue",
    "awaitingSubmission",
    "inProgress",
    "submitted",
    "correctionDue",
    "needsReview",
  ]);
  const followups = e.assessments
    .filter(
      (a) =>
        a.projectId === project.id &&
        followupStatuses.has(dashboardAssessmentStatus(a, snapshot)),
    )
    .sort(
      (a, b) =>
        assessmentPriority(dashboardAssessmentStatus(a, snapshot)) -
          assessmentPriority(dashboardAssessmentStatus(b, snapshot)) ||
        a.endsAt - b.endsAt,
    );
  const nextAssessments = e.assessments
    .filter(
      (a) =>
        a.projectId === project.id &&
        dashboardAssessmentStatus(a, snapshot) === "upcoming" &&
        a.startsAt >= snapshot.serverTime &&
        dateOnly(a.startsAt) < end,
    )
    .sort((a, b) => a.startsAt - b.startsAt);
  const progress = summary?.progress.slice(0, 4) || [];
  const todayTasks = snapshot.data.tasks
    .filter(
      (task) =>
        task.projectId === project.id &&
        !task.completed &&
        task.dueDate <= snapshot.today,
    )
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) ||
        (a.reminderTime || "99:99").localeCompare(b.reminderTime || "99:99"),
    )
    .slice(0, 4);
  return `<section class="education-dashboard-project"><div class="education-dashboard-project-head"><div><span class="eyebrow">学习项目</span><h2>${esc(project.name)}</h2><p>${esc(study.target || "应试目标尚未填写")}</p></div>${dashboardProjectLink(project.id)}</div><section class="education-dashboard-today"><h3>今日学习任务</h3>${todayTasks.map((task) => `<article class="education-dashboard-row"><div><strong>${esc(task.title)}</strong><small>${task.dueDate < snapshot.today ? "逾期" : "今天"}${task.reminderTime ? ` · ${esc(task.reminderTime)}` : ""} · ${task.estimate} 个番茄</small></div><button class="button secondary small-button" data-focus-task="${esc(task.id)}">开始专注</button></article>`).join("") || `<p class="subtle">今天没有未完成的项目任务。</p>`}</section><div class="education-dashboard-columns"><section><h3>需要处理</h3>${
    followups
      .slice(0, 4)
      .map((a) =>
        dashboardAssessmentLine(
          a,
          dashboardAssessmentStatus(a, snapshot),
          "",
          e.resources,
        ),
      )
      .join("") || `<p class="subtle">暂时没有待交、待订正或待复核事项。</p>`
  }</section><section><h3>接下来一周</h3>${lessons
    .slice(0, 3)
    .map((l) => dashboardLessonLine(l, e.resources))
    .join("")}${
    nextAssessments
      .slice(0, 2)
      .map((a) => dashboardAssessmentLine(a, "upcoming", "", e.resources))
      .join("") ||
    (!lessons.length ? `<p class="subtle">暂无排定课程或考试。</p>` : "")
  }</section></div><section class="education-dashboard-progress"><h3>最近学到哪里</h3>${progress.map((r) => `<article class="education-dashboard-row"><div><strong>${esc(r.topic)} · ${esc(progressStates[r.state] || r.state)}</strong><small>${esc(r.position)} · ${esc(r.evidence)}</small></div><span class="education-status">${r.confirmed ? "已确认" : "待确认"}</span></article>`).join("") || `<p class="subtle">暂无登记的学习进度。</p>`}</section><div class="education-dashboard-actions"><button class="button secondary small-button" data-teaching-question="${esc(project.id)}">问老师下一步怎么学</button>${dashboardProjectLink(project.id, "查看全部学情与资料")}</div></section>`;
}
function teacherDashboard(
  snapshot: Snapshot,
  project: Project,
  study: ProjectStudy,
  summary: StudySummary | undefined,
) {
  const e = snapshot.data.education;
  const terms = e.semesters.filter((s) => s.projectId === project.id);
  const semester =
    terms
      .filter(
        (s) => s.startDate <= snapshot.today && s.endDate >= snapshot.today,
      )
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ||
    terms
      .filter((s) => s.startDate > snapshot.today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ||
    terms.sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  const semesterStarted = !!semester && snapshot.today >= semester.startDate;
  const semesterEnded = !!semester && snapshot.today > semester.endDate;
  const weekNumber =
    semesterStarted && semester
      ? Math.floor(dateDistance(semester.startDate, snapshot.today) / 7) + 1
      : 0;
  const currentWeekStart =
    semesterStarted && semester
      ? shiftDate(semester.startDate, (weekNumber - 1) * 7)
      : snapshot.today;
  const currentWeekEnd =
    semester && !semesterEnded
      ? [
          shiftDate(currentWeekStart, 7),
          shiftDate(semester.endDate, 1),
        ].sort()[0]
      : shiftDate(currentWeekStart, 7);
  const milestone =
    semesterStarted && !semesterEnded
      ? semester?.milestones.find((m) => m.week === weekNumber)
      : undefined;
  const lessons = e.lessons
    .filter(
      (l) =>
        l.projectId === project.id &&
        l.semesterId === semester?.id &&
        dateOnly(l.startsAt) >= currentWeekStart &&
        dateOnly(l.startsAt) < currentWeekEnd,
    )
    .sort((a, b) => a.startsAt - b.startsAt);
  const weekAssessments = e.assessments
    .filter(
      (a) =>
        a.projectId === project.id &&
        a.semesterId === semester?.id &&
        dateOnly(a.startsAt) >= currentWeekStart &&
        dateOnly(a.startsAt) < currentWeekEnd,
    )
    .sort((a, b) => a.startsAt - b.startsAt);
  const pendingStatuses = new Set([
    "overdue",
    "awaitingSubmission",
    "inProgress",
    "submitted",
    "needsReview",
    "correctionDue",
  ]);
  const pending = e.assessments
    .filter(
      (a) =>
        a.projectId === project.id &&
        pendingStatuses.has(dashboardAssessmentStatus(a, snapshot)),
    )
    .sort(
      (a, b) =>
        assessmentPriority(dashboardAssessmentStatus(a, snapshot)) -
          assessmentPriority(dashboardAssessmentStatus(b, snapshot)) ||
        a.endsAt - b.endsAt,
    );
  const attended = lessons.filter((l) => l.attended).length;
  const remaining = Math.max(0, (milestone?.lessonCount ?? 0) - lessons.length);
  const currentResources = new Set(milestone?.resourceIds || []);
  const resources = e.resources.filter(
    (r) => r.projectId === project.id && currentResources.has(r.id),
  );
  const progress = summary?.progress.slice(0, 5) || [];
  return `<section class="education-dashboard-project"><div class="education-dashboard-project-head"><div><span class="eyebrow">教师视图</span><h2>${esc(project.name)}</h2><p>${esc(study.target || "应试目标尚未填写")}</p></div>${dashboardProjectLink(project.id)}</div><div class="education-dashboard-metrics"><div><strong>${milestone?.lessonCount ?? 0}</strong><span>本周计划课时</span></div><div><strong>${lessons.length}</strong><span>本周已排课程</span></div><div><strong>${attended}</strong><span>已确认参与</span></div><div><strong>${pending.length}</strong><span>待处理作业 / 测评</span></div></div><section class="education-week-plan"><div class="education-section-heading"><div><h3>${semesterEnded ? `学期已结束 · ${esc(semester!.title)}` : semesterStarted ? `第 ${weekNumber} 周 · ${esc(semester!.title)}` : semester ? `学期将于 ${semester.startDate} 开始` : "尚未建立学期大纲"}</h3><small>${semester ? `${semester.startDate} — ${semester.endDate} · 本教学周 ${currentWeekStart} 至 ${shiftDate(currentWeekEnd, -1)}` : "从项目页让助手核对资料并建立学期计划"}</small></div></div>${
    milestone
      ? `<p class="education-week-topics">${esc(milestone.topics.join("、") || "本周主题待定")}</p><p>${esc(milestone.objective)}</p>${resourceLinks(
          resources.map((r) => r.id),
          e.resources,
          "本周指定资料",
        )}`
      : `<p class="subtle">本周没有对应的阶段目标；检查学期计划的起始日期和周次。</p>`
  }</section><div class="education-dashboard-columns"><section><h3>本周教学落实</h3><p class="education-week-count">计划 ${milestone?.lessonCount ?? 0} 节 · 已排 ${lessons.length} 节 · 还可安排 ${remaining} 节</p>${lessons.map((l) => dashboardLessonLine(l, e.resources)).join("") || `<p class="subtle">本周尚未排入课程。</p>`}</section><section><h3>作业与考试队列</h3>${
    pending
      .slice(0, 5)
      .map((a) => teacherAssessmentLine(a, snapshot))
      .join("") || `<p class="subtle">当前没有待提交或待批改测评。</p>`
  }${weekAssessments
    .filter((a) => !pending.includes(a))
    .slice(0, 3)
    .map((a) => teacherAssessmentLine(a, snapshot))
    .join(
      "",
    )}</section></div><section class="education-dashboard-progress"><h3>最新学情依据</h3>${progress.map((r) => `<article class="education-dashboard-row"><div><strong>${esc(r.topic)} · ${esc(progressStates[r.state] || r.state)}</strong><small>${esc(r.position)} · ${esc(r.evidence)}</small><small>下一步：${esc(r.nextAction || "待安排")} · ${when(r.recordedAt)}</small></div><span class="education-status">${r.confirmed ? "已确认" : "待确认"}</span></article>`).join("") || `<p class="subtle">没有学情记录；未知范围不应推定为已掌握。</p>`}</section><div class="education-dashboard-actions"><button class="button secondary small-button" data-teaching-review="${esc(project.id)}">让老师复盘本周并安排下一步</button>${dashboardProjectLink(project.id, "进入完整教学记录")}</div></section>`;
}
export function educationDashboard(snapshot: Snapshot): string {
  const e = snapshot.data.education;
  const projects = snapshot.data.projects.filter((project) =>
    e.projects.some(
      (study) => study.examMode && study.projectId === project.id,
    ),
  );
  const active =
    projects.find((p) => p.id === educationProjectId) || projects[0];
  const study = e.projects.find((p) => p.projectId === active?.id);
  const summary = snapshot.studyProgress?.find(
    (item) => item.projectId === active?.id,
  );
  const view = educationPanelView;
  return `<div class="education-dashboard"><div class="page-heading"><div><div class="eyebrow">应试学习</div><h1>应试教育</h1><p>学习进度、课程安排、作业与测评集中在这里。</p></div><div class="education-view-switch" role="group" aria-label="面板视图"><button type="button" data-education-view="student" aria-pressed="${view === "student"}" class="${view === "student" ? "active" : ""}">学生端</button><button type="button" data-education-view="teacher" aria-pressed="${view === "teacher"}" class="${view === "teacher" ? "active" : ""}">教师端</button></div></div>${
    active && study
      ? `${projects.length > 1 ? `<nav class="education-project-nav" aria-label="应试项目">${projects.map((p) => `<button type="button" data-education-project="${esc(p.id)}" aria-current="${p.id === active.id ? "page" : "false"}" class="${p.id === active.id ? "active" : ""}">${esc(p.name)}</button>`).join("")}</nav>` : ""}${view === "student" ? studentDashboard(snapshot, active, study, summary) : teacherDashboard(snapshot, active, study, summary)}`
      : `<section class="education-dashboard-empty"><h2>还没有应试学习项目</h2><p>在项目中授权资料目录，再配置考纲、目标和课程资源。</p><button class="button primary" data-action="new-project">新建应试项目</button></section>`
  }</div>`;
}
export function educationCard(snapshot: Snapshot, project: Project): string {
  const e = snapshot.data.education,
    p = e.projects.find((p) => p.projectId === project.id),
    rs = e.resources.filter((r) => r.projectId === project.id);
  const options = (kind: string, ids: string[]) =>
    rs
      .filter((r) => r.kind === kind)
      .map(
        (r) =>
          `<option value="${esc(r.id)}" ${ids.includes(r.id) ? "selected" : ""}>${esc(r.title)}</option>`,
      )
      .join("");
  const summary = snapshot.studyProgress?.find(
    (s) => s.projectId === project.id,
  );
  const assessments = e.assessments
    .filter((a) => a.projectId === project.id)
    .sort((a, b) => b.startsAt - a.startsAt);
  const review = e.reviews.filter((r) => r.projectId === project.id).slice(-3);
  const today = e.assessments.filter(
    (a) =>
      a.kind === "homework" &&
      new Date(a.startsAt * 1000).toLocaleDateString() ===
        new Date(snapshot.serverTime * 1000).toLocaleDateString(),
  );
  const minutes = today
    .flatMap((a) => a.questions)
    .reduce((n, q) => n + q.estimatedMinutes, 0);
  return `<section class="card education-card" data-study-project="${esc(project.id)}"><div class="card-heading"><h2>项目资料与应试教学</h2><div class="button-row"><button class="button secondary small-button" data-page="education">应试面板</button><button class="button secondary small-button" data-teaching-request="${esc(project.id)}">让助手备课</button></div></div><p>资料目录：${esc(p?.directory || "尚未绑定，上传和教学前必须授权")} <button class="text-button" data-study-directory="${esc(project.id)}">选择 / 重新授权</button></p>
 ${
   p
     ? `<details><summary>${p.examMode ? "应试模式已开启" : "配置应试模式"}</summary><form class="study-config" data-project="${esc(project.id)}"><label class="form-field"><span>愿景（必选）</span><select name="visionId"><option value="">请选择</option>${snapshot.data.visions.map((v) => `<option value="${esc(v.id)}" ${p.visionId === v.id ? "selected" : ""}>${esc(v.name)}</option>`).join("")}</select></label><label class="form-field"><span>院校、专业、考试年份、科目及目标分数</span><textarea name="target">${esc(p.target)}</textarea></label><label class="form-field"><span>考试日期</span><input type="date" name="examDate" value="${esc(p.examDate)}"></label><label class="form-field"><span>考纲</span><select name="syllabusId"><option value="">请选择</option>${options("syllabus", p.syllabusId ? [p.syllabusId] : [])}</select></label><div class="form-grid"><label class="form-field"><span>真题（可多选）</span><select name="pastPaperIds" multiple>${options("pastPaper", p.pastPaperIds)}</select></label><label class="form-field"><span>模拟题（可多选）</span><select name="mockPaperIds" multiple>${options("mockPaper", p.mockPaperIds)}</select></label></div><label><input type="checkbox" name="examMode" ${p.examMode ? "checked" : ""}>开启应试模式，作业由助手生成</label><button class="button secondary" type="submit">保存教学配置</button></form></details><div class="button-row"><label class="form-field"><span>导入资料类型</span><select class="study-resource-kind">${Object.entries(
         kinds,
       )
         .map(([k, v]) => `<option value="${k}">${v}</option>`)
         .join(
           "",
         )}</select></label><label class="button secondary">导入资料<input class="study-upload" type="file" multiple hidden data-project="${esc(project.id)}"></label></div>`
     : ""
 }
 ${progressCard(summary, project.id)}
 ${resourceLibrary(snapshot, project)}
 <details><summary>学期进度计划</summary>${
   e.semesters
     .filter((s) => s.projectId === project.id)
     .map(
       (s) =>
         `<article><h3>${esc(s.title)} · v${s.revision}</h3><p>${esc(s.startDate)} — ${esc(s.endDate)}</p><p>起点：${esc(s.baseline)}</p><p>${esc(s.rationale)}</p>${s.evidence.map((x) => `<p>依据：${esc(x)}</p>`).join("")}${s.milestones.map((m) => `<p>第${m.week}周 · ${m.lessonCount}节 · ${esc(m.topics.join("、"))}<br>${esc(m.objective)}</p>${resourceLinks(m.resourceIds, e.resources, "指定资料")}`).join("")}</article>`,
     )
     .join("") || "<p>请让助手核对考纲、资源和学情后制定学期计划。</p>"
 }</details>
 <p>今日全科作业供给：${minutes} 分钟（估时）。默认晚自习19:00–22:00；固定课程计入学习负荷，作业按实际可用时间调整。</p>
 <details open><summary>作业与考试 ${assessments.length}</summary>${
   assessments
     .map((a) => {
       return assessmentRow(a, e, snapshot.serverTime);
     })
     .join("") || "<p>课程或学习任务完成后，助手根据已学进度准备作业。</p>"
 }</details>
 <details><summary>每日复盘</summary>${review.map((r) => `<p>${esc(r.date)}：${esc(r.findings)}</p><ul>${r.actions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>`).join("") || "<p>暂无复盘。</p>"}</details><details><summary>教学事件</summary>${e.events
   .filter((x) => x.projectId === project.id)
   .slice(-15)
   .map(
     (x) =>
       `<p>${esc(eventKinds[x.kind] || x.kind)} · ${esc({ pending: "待执行", running: "执行中 / 中断待重试", done: "已完成" }[x.state] || x.state)} ${x.state !== "done" ? `<button class="text-button" data-event-retry="${esc(x.id)}">${x.state === "running" ? "中断后重新执行" : "请求执行"}</button>` : ""}</p>`,
   )
   .join("")}</details></section>`;
}
export function printablePaper(a: Assessment): string {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${esc(a.title)}</title><style>body{font:16px serif;line-height:1.7;margin:20mm}article{break-inside:avoid;margin-bottom:18mm}section{break-before:page}.space{height:65mm;border-bottom:1px solid #aaa}small{display:block}</style><h1>${esc(a.title)}</h1><p>试卷ID：${esc(a.id)} · v${a.revision} · ${when(a.startsAt)} — ${when(a.endsAt)}</p><p>${esc(a.instructions)}</p>${a.questions.map((q) => `<article><h2>${esc(q.id)}${q.extension ? "（拓展）" : ""}（${q.scoring.reduce((n, p) => n + p.points, 0)}分）</h2><p style="white-space:pre-wrap">${esc(q.prompt)}</p></article>`).join("")}<section><h1>答题卡</h1><p>姓名：____________　试卷：${esc(a.id)}　日期：____________</p><p>每题完成后记录本机显示的当地时刻，精确到时、分；考试结束立即停笔并拍照上传。</p>${a.questions.map((q) => `<article><h2>${esc(q.id)}</h2><small>完成时刻：____:____　返回修改时刻：____:____</small><div class="space"></div></article>`).join("")}</section></html>`;
}
export function educationFocusExams(snapshot: Snapshot): string {
  const e = snapshot.data.education;
  const exams = e.assessments.filter(
    (a) =>
      a.kind !== "homework" &&
      new Date(a.startsAt * 1000).toLocaleDateString("sv-SE") <=
        snapshot.today &&
      (new Date(a.startsAt * 1000).toLocaleDateString("sv-SE") ===
        snapshot.today ||
        a.startedAt) &&
      !e.submissions.some((s) => s.assessmentId === a.id && !s.unfinished),
  );
  if (!exams.length) return "";
  return `<section class="card"><div class="card-heading"><h2>今日测评 <span class="count-label">${exams.length}</span></h2></div>${exams.map((a) => `<article class="study-row"><strong>${esc(a.title)}</strong><p>${when(a.startsAt)} — ${when(a.endsAt)}</p><button class="button secondary small-button" data-open-assessment="${esc(a.id)}">${a.startedAt ? (a.stoppedAt ? "提交答题卡" : "查看进行中的考试") : "查看试卷与开考"}</button></article>`).join("")}</section>`;
}

function openAssessment(
  snapshot: Snapshot,
  id: string,
  hooks: Parameters<typeof mountEducation>[1],
) {
  const a = snapshot.data.education.assessments.find((a) => a.id === id);
  if (!a) return;
  hooks.modal(
    `<h2 id="modal-title">作业与测评</h2><div data-focus-assessment="${esc(id)}">${assessmentRow(a, snapshot.data.education, snapshot.serverTime)}</div><div class="modal-actions"><button class="button secondary" data-action="close-modal">返回今日专注</button></div>`,
  );
  mountEducation(snapshot, hooks);
}

export function openTeachingTask(
  snapshot: Snapshot,
  taskId: string,
  hooks: Parameters<typeof mountEducation>[1],
): boolean {
  const link = snapshot.data.education.focusTasks?.find(
    (l) => l.taskId === taskId,
  );
  if (!link) return false;
  if (link.kind === "homework") openAssessment(snapshot, link.sourceId, hooks);
  else {
    const lesson = snapshot.data.education.lessons.find(
      (l) => l.id === link.sourceId,
    )!;
    const canAssign =
      lesson.state === "planned" &&
      !lesson.attended &&
      lesson.startsAt > snapshot.serverTime;
    hooks.modal(
      `<h2 id="modal-title">${esc(lesson.title)}</h2><p>${when(lesson.startsAt)} — ${when(lesson.endsAt)}</p><p>${esc(lesson.topics.join("、"))}</p><p>${esc(lesson.progress || "具体学习位置尚未记录")}</p>${resourceLinks(lesson.resourceIds, snapshot.data.education.resources, "课程资料")}${canAssign ? `<button class="button secondary small-button" data-lesson-resources="${esc(lesson.id)}">指定课程资料</button>` : ""}<p data-explanation>从任务列表选择课程即可使用番茄钟；勾选完成会记录本人确认的课程参与，掌握情况仍需练习与复测。</p><div class="modal-actions">${snapshot.serverTime >= lesson.startsAt && snapshot.serverTime < lesson.endsAt ? `<button class="button secondary" data-attend-lesson="${esc(lesson.id)}">记录学习进度</button>` : ""}<button class="button secondary" data-action="close-modal">返回任务列表</button></div>`,
    );
    mountEducation(snapshot, hooks);
  }
  return true;
}

export function mountEducation(
  snapshot: Snapshot,
  hooks: {
    accept: (s: Snapshot) => void;
    toast: (s: string) => void;
    ask: (s: string) => void;
    modal: (s: string) => void;
    close: () => void;
    refresh: () => void;
  },
): void {
  const run = async (f: () => Promise<unknown>) => {
    try {
      await f();
    } catch (e) {
      hooks.toast(String(e));
    }
  };
  mountResources(snapshot, hooks);
  const command = async (command: Record<string, unknown>) => {
    const next = await dispatch({ type: "education", command });
    hooks.accept(next);
    const panel = document.querySelector<HTMLElement>(
      "[data-focus-assessment]",
    );
    if (panel) {
      const a = next.data.education.assessments.find(
        (a) => a.id === panel.dataset.focusAssessment,
      );
      if (a)
        panel.innerHTML = assessmentRow(
          a,
          next.data.education,
          next.serverTime,
        );
      mountEducation(next, hooks);
    }
  };
  document
    .querySelectorAll<HTMLFormElement>(".study-config")
    .forEach((form) => {
      form.onsubmit = (e) => {
        e.preventDefault();
        void run(async () => {
          const f = new FormData(form),
            old = snapshot.data.education.projects.find(
              (p) => p.projectId === form.dataset.project,
            )!;
          await command({
            op: "saveProject",
            project: {
              ...old,
              visionId: f.get("visionId") || null,
              target: String(f.get("target")),
              examDate: f.get("examDate") || null,
              syllabusId: f.get("syllabusId") || null,
              pastPaperIds: f.getAll("pastPaperIds"),
              mockPaperIds: f.getAll("mockPaperIds"),
              examMode: f.has("examMode"),
            },
          });
          hooks.toast("教学配置已保存");
        });
      };
    });
  const bind = (selector: string, fn: (el: HTMLElement) => Promise<unknown>) =>
    document
      .querySelectorAll<HTMLElement>(selector)
      .forEach((el) => (el.onclick = () => void run(() => fn(el))));
  bind("[data-open-assessment]", async (el) =>
    openAssessment(snapshot, el.dataset.openAssessment!, hooks),
  );
  bind("[data-education-project]", async (el) => {
    educationProjectId = el.dataset.educationProject!;
    hooks.refresh();
    document
      .querySelector<HTMLElement>(
        `[data-education-project="${CSS.escape(educationProjectId)}"]`,
      )
      ?.focus();
  });
  document
    .querySelectorAll<HTMLElement>("[data-education-view]")
    .forEach((el) => {
      el.onclick = () => {
        educationPanelView =
          el.dataset.educationView === "teacher" ? "teacher" : "student";
        hooks.refresh();
      };
    });
  document
    .querySelectorAll<HTMLElement>("[data-teaching-question]")
    .forEach((el) => {
      el.onclick = () =>
        hooks.ask(
          `请读取exam-teaching技能和项目${el.dataset.teachingQuestion}的最新学情，结合本周课程与作业，给我明确的下一步学习建议；未知处先核实，不推定掌握。`,
        );
    });
  document
    .querySelectorAll<HTMLElement>("[data-teaching-review]")
    .forEach((el) => {
      el.onclick = () =>
        hooks.ask(
          `请读取exam-teaching技能，复盘项目${el.dataset.teachingReview}当前教学周（从学期起始日推算）：对照本周学期里程碑、实际课程参与与进度、作业和考试发布/提交/批改、最新学情，区分已落实与未落实的内容，提出下周调整。若需要改教学记录或排课，请直接执行并保存，不只给建议。`,
        );
    });
  bind("[data-study-directory]", async (el) => {
    let directory = await chooseProjectDirectory();
    if (!isTauri())
      directory = prompt("输入并授权此项目的资料目录（本机绝对路径）");
    if (directory)
      hooks.accept(
        await agentCall<Snapshot>({
          op: "authorize_project_directory",
          projectId: el.dataset.studyDirectory,
          directory,
        }),
      );
  });
  bind("[data-teaching-request]", async (el) =>
    hooks.ask(
      `请读取 exam-teaching 技能，为项目 ${el.dataset.teachingRequest} 核对愿景、考纲、真题、模拟题和资源。结合学情与联网查证的同科目经验，制定有依据的学期进度并安排课程、周末周考。跨项目每天上午4节、下午2至4节，每节45分钟；19–22点为晚自习，固定课程计入当晚学习负荷并减少作业；按get_study_progress中的最新实际学情备课，复盘时间服从我的作息。缺少条件先向我补齐。`,
    ),
  );
  bind("[data-lesson-resources]", async (el) => {
    const lesson = snapshot.data.education.lessons.find(
      (l) => l.id === el.dataset.lessonResources,
    )!;
    const resources = snapshot.data.education.resources.filter(
      (r) => r.projectId === lesson.projectId,
    );
    hooks.modal(
      `<h2 id="modal-title">指定课程资料 · ${esc(lesson.title)}</h2><p>从本项目已登记的资料中选择。开课后资料保留历史，不能修改。</p><form id="lesson-resources-form">${resources.length ? `<div class="lesson-resource-choices">${resources.map((r) => `<label><input type="checkbox" name="resourceIds" value="${esc(r.id)}" ${lesson.resourceIds.includes(r.id) ? "checked" : ""}>${esc(r.title)} · ${esc(kinds[r.kind] || r.kind)}</label>`).join("")}</div>` : `<p>本项目暂无资料，请先在项目资料库导入或登记。</p>`}<div class="modal-actions"><button type="button" class="button secondary" id="lesson-resources-cancel">返回课程</button><button type="submit" class="button primary" ${resources.length ? "" : "disabled"}>保存指定资料</button></div></form>`,
    );
    document.getElementById("lesson-resources-cancel")!.onclick = () =>
      openTeachingTask(
        snapshot,
        snapshot.data.education.focusTasks!.find(
          (link) => link.sourceId === lesson.id && link.kind === "lesson",
        )!.taskId,
        hooks,
      );
    const form = document.querySelector<HTMLFormElement>(
      "#lesson-resources-form",
    )!;
    form.onsubmit = (event) => {
      event.preventDefault();
      if (form.dataset.saving) return;
      void run(async () => {
        form.dataset.saving = "true";
        const button = form.querySelector<HTMLButtonElement>(
          'button[type="submit"]',
        )!;
        button.disabled = true;
        try {
          const next = await dispatch({
            type: "education",
            command: {
              op: "setLessonResources",
              id: lesson.id,
              resourceIds: new FormData(form).getAll("resourceIds"),
            },
          });
          hooks.accept(next);
          const link = next.data.education.focusTasks?.find(
            (item) => item.sourceId === lesson.id && item.kind === "lesson",
          );
          if (link) openTeachingTask(next, link.taskId, hooks);
          hooks.toast("课程资料已指定");
        } finally {
          delete form.dataset.saving;
          button.disabled = false;
        }
      });
    };
  });
  bind("[data-attend-lesson]", async (el) => {
    const progress = prompt("记录当前学习进度（下课后仍以实际进度为准）");
    if (progress !== null)
      await command({
        op: "attendLesson",
        id: el.dataset.attendLesson,
        progress,
      });
  });
  bind("[data-paper]", async (el) => {
    const a = snapshot.data.education.assessments.find(
      (a) => a.id === el.dataset.paper,
    )!;
    await saveAgentFile(printablePaper(a), `${a.title}.html`, "text/html");
  });
  bind("[data-printed]", async (el) =>
    command({ op: "confirmPrinted", id: el.dataset.printed }),
  );
  bind("[data-exam-start]", async (el) =>
    command({ op: "startExam", id: el.dataset.examStart }),
  );
  bind("[data-exam-end]", async (el) => {
    await command({ op: "endExam", id: el.dataset.examEnd });
    hooks.toast("已记录停笔，请上传答题卡交卷");
  });
  bind("[data-grade-review]", async (el) =>
    hooks.ask(
      `请读取exam-teaching，对批改 ${el.dataset.gradeReview} 根据原提交和发布时评分标准复核，保留旧记录；有改动保存新批改ID，再保存复盘。`,
    ),
  );
  bind("[data-retest-request]", async (el) =>
    hooks.ask(
      `请读取exam-teaching，为批改 ${el.dataset.retestRequest} 中的薄弱点安排独立复测：使用未做过的题目，kind=retest，retestOfGradeId绑定原批改；预先复解、保存答案和评分点，避开固定课程与其他考试。订正通过不视为复测通过。`,
    ),
  );
  bind("[data-progress-confirm]", async (el) =>
    command({ op: "confirmProgress", id: el.dataset.progressConfirm }),
  );
  bind("[data-progress-record]", async (el) => {
    hooks.modal(
      `<h2 id="modal-title">更新学习进度</h2><form id="study-progress-form"><label class="form-field"><span>知识点 / 章节</span><input name="topic" required maxlength="200" autofocus></label><label class="form-field"><span>实际学到哪里（讲次、页码或视频位置）</span><textarea name="position" required maxlength="2000"></textarea></label><label class="form-field"><span>状态</span><select name="state"><option value="studied">已学，待练习验证</option><option value="practicing">练习中</option><option value="needsReview">需要复习</option></select></label><label class="form-field"><span>依据 / 仍不确定的地方</span><textarea name="evidence" required maxlength="8000"></textarea></label><label class="form-field"><span>下一步</span><textarea name="nextAction" maxlength="2000"></textarea></label><p role="status" id="study-progress-status"></p><div class="modal-actions"><button type="button" class="button secondary" id="study-progress-cancel">取消</button><button type="submit" class="button primary">保存进度</button></div></form>`,
    );
    document.getElementById("study-progress-cancel")!.onclick = hooks.close;
    const form = document.querySelector<HTMLFormElement>(
      "#study-progress-form",
    )!;
    form.onsubmit = (event) => {
      event.preventDefault();
      if (form.dataset.saving) return;
      void run(async () => {
        form.dataset.saving = "true";
        const button = form.querySelector<HTMLButtonElement>(
          'button[type="submit"]',
        )!;
        button.disabled = true;
        try {
          const f = new FormData(form);
          await command({
            op: "recordProgress",
            record: {
              id: crypto.randomUUID(),
              projectId: el.dataset.progressRecord,
              topic: String(f.get("topic")),
              position: String(f.get("position")),
              state: f.get("state"),
              evidence: String(f.get("evidence")),
              nextAction: String(f.get("nextAction")),
              source: "user",
              confirmed: true,
              recordedAt: 0,
            },
          });
          hooks.close();
        } finally {
          delete form.dataset.saving;
          button.disabled = false;
        }
      });
    };
  });
  bind("[data-correction-grade]", async (el) => {
    const grade = snapshot.data.education.grades.find(
      (g) => g.id === el.dataset.correctionGrade,
    )!;
    const sub = snapshot.data.education.submissions.find(
      (s) => s.id === grade.submissionId,
    )!;
    const a = snapshot.data.education.assessments.find(
      (a) => a.id === sub.assessmentId,
    )!;
    hooks.modal(
      `<h2 id="modal-title">提交 ${esc(el.dataset.correctionQuestion)} 的订正</h2><form id="study-correction-form"><label class="form-field"><span>为什么错、正确思路、下次如何检查</span><textarea name="explanation" maxlength="8000" autofocus></textarea></label><label class="form-field"><span>订正照片 / 文件</span><input type="file" name="files" multiple></label><p role="status" id="study-correction-status"></p><div class="modal-actions"><button type="button" class="button secondary" id="study-correction-cancel">取消</button><button type="submit" class="button primary">提交订正并等待检查</button></div></form>`,
    );
    document.getElementById("study-correction-cancel")!.onclick = hooks.close;
    const form = document.querySelector<HTMLFormElement>(
      "#study-correction-form",
    )!;
    const ids: string[] = [];
    const uploaded = new Set<File>();
    const correctionId = crypto.randomUUID();
    form.onsubmit = (event) => {
      event.preventDefault();
      if (form.dataset.saving) return;
      void run(async () => {
        form.dataset.saving = "true";
        const button = form.querySelector<HTMLButtonElement>(
          'button[type="submit"]',
        )!;
        button.disabled = true;
        try {
          const f = new FormData(form);
          for (const file of f.getAll("files"))
            if (file instanceof File && file.size && !uploaded.has(file)) {
              ids.push((await upload(file, a.projectId)).id);
              uploaded.add(file);
            }
          await command({
            op: "submitCorrection",
            correction: {
              id: correctionId,
              gradeId: grade.id,
              questionId: el.dataset.correctionQuestion,
              explanation: String(f.get("explanation")),
              resourceIds: ids,
              submittedAt: 0,
              accepted: null,
              feedback: "",
              reviewedAt: null,
            },
          });
          hooks.close();
        } finally {
          delete form.dataset.saving;
          button.disabled = false;
        }
      });
    };
  });
  bind("[data-event-retry]", async (el) =>
    command({ op: "retryEvent", id: el.dataset.eventRetry }),
  );
  bind("[data-study-submit]", async (el) => {
    const a = snapshot.data.education.assessments.find(
      (a) => a.id === el.dataset.studySubmit,
    )!;
    hooks.modal(
      `<h2 id="modal-title">提交 ${esc(a.title)}</h2><form id="study-submit-form"><label class="form-field"><span>文字答案 / 提交说明</span><textarea name="answers"></textarea></label><label class="form-field"><span>上传答题卡照片或文件</span><input type="file" name="files" multiple></label>${a.questions.map((q) => `<label class="form-field"><span>${esc(q.id)} 完成时刻（本机HH:MM）</span><input type="time" name="time:${esc(q.id)}"></label>`).join("")}<label><input type="checkbox" name="unfinished">本次未完成</label><p>每次重交保存新版本；截止后仍可提交，会记录真实提交时间。</p><p id="study-submit-status" role="status"></p><div class="modal-actions"><button type="button" id="study-submit-cancel" class="button secondary">取消</button><button class="button primary" type="submit">提交并等待批改</button></div></form>`,
    );
    document.getElementById("study-submit-cancel")!.onclick = hooks.close;
    const form = document.querySelector<HTMLFormElement>("#study-submit-form")!;
    const submissionId = crypto.randomUUID();
    const ids: string[] = [];
    const uploaded = new Set<File>();
    form.onsubmit = (e) => {
      e.preventDefault();
      if (form.dataset.saving) return;
      void run(async () => {
        form.dataset.saving = "true";
        const button = form.querySelector<HTMLButtonElement>(
          'button[type="submit"]',
        )!;
        button.disabled = true;
        try {
          const f = new FormData(form);
          for (const file of f.getAll("files"))
            if (file instanceof File && file.size && !uploaded.has(file)) {
              const r = await upload(file, a.projectId);
              ids.push(r.id);
              uploaded.add(file);
            }
          await command({
            op: "submit",
            submission: {
              id: submissionId,
              assessmentId: a.id,
              submittedAt: 0,
              resourceIds: ids,
              answers: String(f.get("answers")),
              unfinished: f.has("unfinished"),
              questionTimes: a.questions
                .filter((q) => f.get(`time:${q.id}`))
                .map((q) => ({
                  questionId: q.id,
                  localTime: f.get(`time:${q.id}`),
                })),
            },
          });
          hooks.close();
        } finally {
          delete form.dataset.saving;
          button.disabled = false;
        }
      });
    };
  });
  document.querySelectorAll<HTMLInputElement>(".study-upload").forEach(
    (input) =>
      (input.onchange = () =>
        void run(async () => {
          const kind = input
            .closest(".education-card")!
            .querySelector<HTMLSelectElement>(".study-resource-kind")!.value;
          for (const file of Array.from(input.files || [])) {
            const attachment = await upload(file, input.dataset.project!);
            const fresh = await getSnapshot();
            const resource = fresh.data.education.resources.find(
              (r) => r.id === attachment.id,
            )!;
            await command({
              op: "saveResource",
              resource: { ...resource, kind },
            });
          }
          hooks.toast("资料已导入项目");
        })),
  );
}
async function upload(file: File, projectId: string): Promise<{ id: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let raw = "";
  for (let i = 0; i < bytes.length; i += 32768)
    raw += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return agentCall({
    op: "upload_attachment",
    projectId,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    data: btoa(raw),
  });
}

export function educationBanner(snapshot: Snapshot): string {
  const exam = snapshot.data.education.assessments.find(
    (a) => a.startedAt && !a.stoppedAt,
  );
  if (exam)
    return `<section class="reminder-banner"><strong>考试中：${esc(exam.title)} · 本机时间 <span class="teaching-local-clock"></span> · 剩余 <span class="teaching-remaining" data-ends-at="${exam.endsAt}"></span></strong><p>请独立作答，每题完成后在纸质答题卡填写本机HH:MM时刻。${when(exam.endsAt)}停笔，随后拍照上传。</p><button class="text-button" data-page="project:${esc(exam.projectId)}">查看考试与提交入口</button></section>`;
  const lesson = snapshot.data.education.lessons.find(
    (l) => l.state === "active",
  );
  if (!lesson) {
    const pending = snapshot.studyProgress
      ?.flatMap((p) =>
        p.assessments.map((a) => ({ ...a, projectId: p.projectId })),
      )
      .find((a) =>
        [
          "awaitingSubmission",
          "submitted",
          "needsReview",
          "correctionDue",
          "overdue",
        ].includes(a.status),
      );
    return pending
      ? `<section class="reminder-banner"><strong>${esc(pending.title)} · ${esc(assessmentStates[pending.status])}</strong><button class="text-button" data-page="project:${esc(pending.projectId)}">打开作业、批改与订正</button></section>`
      : "";
  }
  return lesson
    ? `<section class="reminder-banner"><strong>上课中：${esc(lesson.title)} · ${when(lesson.endsAt)}下课</strong><button class="text-button" data-attend-lesson="${esc(lesson.id)}">${lesson.attended ? "更新学习进度" : "确认参与课程"}</button><button class="text-button" data-page="project:${esc(lesson.projectId)}">打开项目资料</button></section>`
    : "";
}
