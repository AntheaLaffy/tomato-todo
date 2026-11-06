//! @tomato/core —— 番茄 Todo 领域核心（crates/core 的语义级 TypeScript 移植）。
//!
//! 零运行时依赖、纯 ESM、可在 Node 直接 import。外部 JSON 形状与旧引擎一致：
//! camelCase、日期 `YYYY-MM-DD`、时间 `HH:MM`、时间戳 Unix 秒
//! （见 docs/PLAN_FORMAT.md 与 docs/BACKUP_FORMAT.md）。
//!
//! 模块索引见 packages/core/CODEMAP.md。

// 基础
export {
  AppError,
  ensure,
  require,
  charCount,
  utf8Len,
  clone,
  deepEqual,
} from "./errors";
export { id } from "./ids";
export {
  dateAt,
  now,
  validDate,
  validTime,
  minutesOf,
  parseDate,
  addDays,
  formatDate,
  weekdayMonday,
  weekStart,
  daysBetween,
  atLocal,
  atLocalDate,
  atLocalDateString,
  hourMinuteString,
  secondsOfDay,
  localDateOf,
  hourMinuteOf,
} from "./time";
export type { CalendarDate } from "./time";

// 模型
export type {
  Project,
  HabitSlot,
  Habit,
  Vision,
  Subtask,
  Task,
  TaskKind,
  Repeat,
  TaskDraft,
  GuardMode,
  Protection,
  Settings,
  Mode,
  Timer,
  SessionSource,
  Session,
  DetachTarget,
  DayStat,
  Stats,
  LockSchedule,
  ActiveLock,
  LockState,
  Attention,
  Block,
  TemplateSubtask,
  Shape,
  PrintSlot,
  CalendarSlot,
  Printing,
  Template,
  PrintRecord,
  Identity,
  PlanProject,
  PlanSubtask,
  PlanTask,
  PlanFile,
  ResourceKind,
  ProjectStudy,
  Resource,
  Milestone,
  Semester,
  LessonState,
  Lesson,
  AssessmentKind,
  ScoringPoint,
  Question,
  Assessment,
  Submission,
  QuestionTime,
  PointAward,
  ErrorAnalysis,
  Grade,
  Review,
  TeachingEvent,
  TeachingTaskKind,
  TeachingTask,
  CompletedStudyTask,
  ProgressSource,
  ProgressState,
  ProgressRecord,
  Correction,
  Window,
  Snapshot,
} from "./model";
export { kindOf, isHabit } from "./model";

// 校验与域逻辑
export {
  validAppIds,
  defaultSettings,
  defaultTimer,
  checkUserAction,
  parseAction,
  parseAppData,
  serializeAppData,
  serializeTask,
  parseTask,
  parseTaskDraft,
  parseSettings,
  serializeSettings,
  parseTimer,
  serializeTimer,
  parseSession,
  serializeSession,
  parseProject,
  serializeProject,
  parseVision,
  serializeVision,
  parseSubtask,
  serializeSubtask,
  parseProtection,
  serializeProtection,
} from "./lib";
export { AppData } from "./lib";
export type { Action } from "./lib";

// 子域模块
export * from "./lock";
export * from "./blocks";
export * from "./habits";
export * from "./identities";
export * from "./migration";
export * from "./plan";
export * from "./templates";
export * from "./reminders";
export * from "./teaching_tasks";
export * from "./education";
export * from "./learning";
export * from "./diagnostics";
export * from "./guard";

// Engine
export { Engine } from "./engine";
export type { EnginePersist } from "./engine";
