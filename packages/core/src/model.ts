//! 领域数据模型：与 crates/core 的 serde 结构一一对应。
//!
//! 命名规则：TS 内部字段名即 JSON camelCase 名（对应 `#[serde(rename_all="camelCase")]`）。
//! 枚举是字符串字面量联合（serde camelCase 取值），序列化即直接输出。
//! 可选 JSON 字段（serde `Option` / `#[serde(default)]`）解析后统一为 `T | null` 或缺省值；
//! 序列化时按 Rust 的 `skip_serializing_if` 决定是否省略键。

export interface Project {
  id: string;
  name: string;
  color: string;
  /** 提供时替代通用白名单；序列化时 null 省略（skip_serializing_if）。 */
  appWhitelist: string[] | null;
}

export interface HabitSlot {
  /** 1 = 周一 … 7 = 周日。 */
  days: number[];
  time: string;
}

export interface Habit {
  id: string;
  name: string;
}

export interface Vision {
  id: string;
  name: string;
  notes: string;
  /** 序列化时 null 省略。 */
  projectId: string | null;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

/** 管辖分类：由冻结字段推导，永不作为用户数据存储。 */
export type TaskKind = "ordinary" | "habit";

export interface Task {
  id: string;
  templateId: string | null;
  /** 印刷时冻结的重复来源；改模板不重写历史分类。 */
  recurring: boolean;
  title: string;
  notes: string;
  projectId: string | null;
  habitId: string | null;
  dueDate: string | null;
  reminderTime: string | null;
  focusMinutes: number | null;
  /** 普通任务计划块结束后的静态重修窗口（分钟）；0 即到点作废。 */
  scrapMinutes: number;
  priority: number;
  estimate: number;
  reminderFired: boolean;
  reminderPending: boolean;
  reminderExpired: boolean;
  completed: boolean;
  completedAt: number | null;
  createdAt: number;
  tags: string[];
  subtasks: Subtask[];
}

/** 任务的管辖分类（单一权威定义，读冻结字段）。 */
export function kindOf(task: Pick<Task, "reminderTime" | "habitId" | "recurring">): TaskKind {
  return task.reminderTime !== null && (task.habitId !== null || task.recurring)
    ? "habit"
    : "ordinary";
}

export function isHabit(task: Pick<Task, "reminderTime" | "habitId" | "recurring">): boolean {
  return kindOf(task) === "habit";
}

export type Repeat = "none" | "daily" | "weekdays" | "weekly";

export interface TaskDraft {
  id: string | null;
  title: string;
  notes: string;
  projectId: string | null;
  dueDate: string | null;
  reminderTime: string | null;
  focusMinutes: number | null;
  scrapMinutes: number;
  priority: number;
  estimate: number;
  tags: string[];
  subtasks: Subtask[];
  repeat: Repeat;
}

export type GuardMode = "off" | "lock" | "whitelist";

export interface Protection {
  mode: GuardMode;
  whitelist: string[];
  strict: boolean;
}

export interface Settings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
  dailyGoal: number;
  autoBreak: boolean;
  autoFocus: boolean;
  autoStartTasks: boolean;
  sound: boolean;
  soundVolume: number;
  notifications: boolean;
  alwaysOnTop: boolean;
  theme: string;
  personaBackdrop: boolean;
  protection: Protection;
}

export type Mode = "focus" | "shortBreak" | "longBreak";

export interface Timer {
  mode: Mode;
  running: boolean;
  taskId: string | null;
  durationSecs: number;
  remainingSecs: number;
  deadline: number | null;
  startedAt: number | null;
  cycle: number;
  cycleDate: string | null;
  completionSerial: number;
  lastFinishedMode: Mode | null;
  autoFocusBlocked: boolean;
}

export type SessionSource = "timer" | "taskEstimate";

export interface Session {
  id: string;
  source: SessionSource;
  taskId: string | null;
  taskTitle: string;
  projectName: string;
  startedAt: number;
  endedAt: number;
  durationSecs: number;
  completed: boolean;
}

export type DetachTarget = "project" | "habit";

export interface DayStat {
  date: string;
  seconds: number;
  pomodoros: number;
  /** 定时重复习惯当天到期未完成。 */
  missed: number;
  completed: number;
  /** 普通定时实例当天作废未完成。 */
  voided: number;
}

export interface Stats {
  todaySeconds: number;
  todayPomodoros: number;
  todayCompleted: number;
  totalSeconds: number;
  totalPomodoros: number;
  streak: number;
  days: DayStat[];
}

// ---------- 定时锁机（数据模型 + 纯调度逻辑；桌面执行留原生 guard） ----------

export interface LockSchedule {
  id: string;
  name: string;
  start: string;
  end: string;
  days: number[];
  enabled: boolean;
  strict: boolean;
}

export interface ActiveLock {
  name: string;
  startedAt: number;
  endsAt: number;
  strict: boolean;
}

export interface LockState {
  schedules: LockSchedule[];
  active: ActiveLock | null;
  suppressedUntil: number;
}

// ---------- 课表阻塞时段 ----------

export type Attention = "required" | "light";

export interface Block {
  id: string;
  title: string;
  /** 1 = 周一 … 7 = 周日。 */
  days: number[];
  /** 本机 HH:MM；end 不晚于 start 表示跨午夜。 */
  start: string;
  end: string;
  attention: Attention;
  notes: string;
}

// ---------- 模板与印刷 ----------

export interface TemplateSubtask {
  id: string;
  title: string;
}

export interface Shape {
  title: string;
  notes: string;
  projectId: string | null;
  habitId: string | null;
  focusMinutes: number | null;
  scrapMinutes: number;
  priority: number;
  estimate: number;
  tags: string[];
  subtasks: TemplateSubtask[];
}

export interface PrintSlot {
  days: number[];
  time: string | null;
}

export interface CalendarSlot {
  dates: string[];
  time: string | null;
}

export type Printing =
  | { kind: "once"; date: string | null; time: string | null }
  | { kind: "calendar"; slots: CalendarSlot[] }
  | { kind: "weekly"; slots: PrintSlot[] };

export interface Template {
  id: string;
  shape: Shape;
  printing: Printing;
  automatic: boolean;
  printAheadDays: number;
}

export interface PrintRecord {
  templateId: string;
  date: string | null;
}

// ---------- 永久 ID 登记 ----------

export interface Identity {
  id: string;
  kind: string;
  retired: boolean;
  /** 原任务恢复记录：canonical 序列化后的 Task JSON 字符串。 */
  restoreTask: string | null;
}

// ---------- 计划文件 v6 ----------

export interface PlanProject {
  id: string;
  name: string;
  color: string;
  /** 序列化时 null 省略；提供时导入会覆盖本机清单。 */
  appWhitelist: string[] | null;
}

export interface PlanSubtask {
  id: string;
  title: string;
}

export interface PlanTask {
  id: string;
  title: string;
  templateId: string | null;
  habitId: string | null;
  recurring: boolean;
  scrapMinutes: number;
  notes: string;
  projectId: string | null;
  dueDate: string | null;
  /** 序列化时 null 省略。 */
  reminderTime: string | null;
  /** 序列化时 null 省略。 */
  focusMinutes: number | null;
  priority: number;
  estimate: number;
  tags: string[];
  subtasks: PlanSubtask[];
  repeat: Repeat;
}

export interface PlanFile {
  format: string;
  version: number;
  pomodoroMinutes: number;
  projects: PlanProject[];
  tasks: PlanTask[];
  blocks: Block[];
  templates: Template[];
  prints: PrintRecord[];
  habits: Habit[];
  /** 序列化时 false 省略。 */
  replace: boolean;
}

// ---------- 教学 ----------

export type ResourceKind =
  | "syllabus"
  | "course"
  | "book"
  | "pastPaper"
  | "mockPaper"
  | "reference"
  | "attachment"
  | "answerSheet";

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
  kind: ResourceKind;
  /** 相对项目授权目录；永不授予文件系统访问。 */
  path: string;
  source: string;
  edition: string;
  topics: string[];
}

export interface Milestone {
  week: number;
  topics: string[];
  resourceIds: string[];
  objective: string;
  lessonCount: number;
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
  milestones: Milestone[];
}

export type LessonState = "planned" | "active" | "ended" | "missed";

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
  state: LessonState;
}

export type AssessmentKind = "homework" | "weeklyExam" | "mockExam" | "retest";

export interface ScoringPoint {
  id: string;
  description: string;
  points: number;
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
  scoring: ScoringPoint[];
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
  kind: AssessmentKind;
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
  /** 本机完成时刻，不是时长。 */
  questionTimes: QuestionTime[];
}

export interface QuestionTime {
  questionId: string;
  localTime: string;
}

export interface PointAward {
  questionId: string;
  pointId: string;
  awarded: number;
  evidence: string;
}

export interface ErrorAnalysis {
  questionId: string;
  cause: string;
  evidence: string;
  correction: string;
  nextCheck: string;
  retestDate: string;
  confirmed: boolean;
}

export interface Grade {
  id: string;
  submissionId: string;
  assessmentRevision: number;
  gradedAt: number;
  awards: PointAward[];
  errors: ErrorAnalysis[];
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

export interface TeachingEvent {
  id: string;
  projectId: string;
  kind: string;
  sourceId: string;
  state: string;
  createdAt: number;
}

export type TeachingTaskKind = "lesson" | "homework";

export interface TeachingTask {
  taskId: string;
  sourceId: string;
  kind: TeachingTaskKind;
}

// ---------- 学情证据 ----------

export interface CompletedStudyTask {
  id: string;
  projectId: string;
  title: string;
  notes: string;
  topics: string[];
  completedAt: number;
}

export type ProgressSource = "user" | "assistant";
export type ProgressState = "studied" | "practicing" | "needsReview";

export interface ProgressRecord {
  id: string;
  projectId: string;
  topic: string;
  position: string;
  state: ProgressState;
  evidence: string;
  nextAction: string;
  source: ProgressSource;
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

// ---------- 守护纯计算部分（窗口集合/白名单判定；无桌面调用） ----------

export interface Window {
  id: number;
  appId: string | null;
  title: string | null;
  pid: number | null;
  isFocused: boolean;
}

// ---------- 快照 ----------

export interface Snapshot {
  taskKinds: Record<string, TaskKind>;
  data: import("./lib").AppData;
  studyProgress: unknown[];
  stats: Stats;
  remainingSecs: number;
  today: string;
  serverTime: number;
}
