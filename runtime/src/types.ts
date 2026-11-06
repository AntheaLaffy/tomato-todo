// 番茄 Todo runtime：数据形状（桩）。
//
// 以旧 src/types.ts 的 JSON 形状为起点（camelCase；日期 YYYY-MM-DD、时间 HH:MM、
// 时间戳 Unix 秒）。@tomato/core（packages/core/src/index.ts）落地后是唯一权威，
// 本文件由 lead 在合并时整体替换；在此之前只作为 runtime 桩的类型契约。
// 教学（education）相关字段仅保留旧 src/education.ts 的顶层形状，内容留空。

export type Mode = "focus" | "shortBreak" | "longBreak";
export type GuardMode = "off" | "lock" | "whitelist";
export type Attention = "required" | "light";
export type TaskKind = "ordinary" | "habit";

export interface Project {
  id: string;
  name: string;
  color: string;
  appWhitelist: string[] | null;
}

export interface Identity {
  id: string;
  kind: string;
  retired: boolean;
  restoreTask: string | null;
}

export interface Habit {
  id: string;
  name: string;
}

export interface HabitSlot {
  days: number[];
  time: string;
}

/** 计划之外的固定每周占用（课程、实验），仅描述性。 */
export interface Block {
  id: string;
  title: string;
  days: number[];
  start: string;
  end: string;
  attention: Attention;
  notes: string;
}

export interface Vision {
  id: string;
  name: string;
  notes: string;
  projectId: string | null;
}

export interface PlanProject {
  id: string;
  name: string;
  color: string;
  appWhitelist?: string[];
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface TemplateShape {
  title: string;
  notes: string;
  projectId: string | null;
  habitId: string | null;
  focusMinutes: number | null;
  scrapMinutes: number;
  priority: number;
  estimate: number;
  tags: string[];
  subtasks: { id: string; title: string }[];
}

export interface CalendarSlot {
  dates: string[];
  time: string | null;
}

export type Printing =
  | { kind: "once"; date: string; time: string | null }
  | { kind: "calendar"; slots: CalendarSlot[] }
  | { kind: "weekly"; slots: { days: number[]; time: string | null }[] };

export interface Template {
  id: string;
  shape: TemplateShape;
  printing: Printing;
  automatic: boolean;
  printAheadDays: number;
}

export interface PrintRecord {
  templateId: string;
  date: string;
}

export interface Task {
  id: string;
  templateId: string | null;
  recurring: boolean;
  scrapMinutes: number;
  title: string;
  notes: string;
  projectId: string | null;
  habitId: string | null;
  dueDate: string;
  reminderTime: string | null;
  focusMinutes: number | null;
  reminderFired: boolean;
  reminderPending: boolean;
  reminderExpired: boolean;
  priority: number;
  estimate: number;
  completed: boolean;
  completedAt: number | null;
  createdAt: number;
  tags: string[];
  subtasks: Subtask[];
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
  theme: "light" | "dark" | "system";
  personaBackdrop: boolean;
  protection: { mode: GuardMode; whitelist: string[]; strict: boolean };
}

export interface LockSchedule {
  id: string;
  name: string;
  start: string;
  end: string;
  days: number[];
  enabled: boolean;
  strict: boolean;
}

export interface LockState {
  schedules: LockSchedule[];
  active: {
    name: string;
    startedAt: number;
    endsAt: number;
    strict: boolean;
  } | null;
  suppressedUntil: number;
}

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

export interface Session {
  id: string;
  source: "timer" | "taskEstimate";
  taskId: string | null;
  taskTitle: string;
  projectName: string;
  startedAt: number;
  endedAt: number;
  durationSecs: number;
  completed: boolean;
}

// —— 教学（桩）：字段名与旧 src/education.ts 对齐，内容在 core 落地前为空。 ——

export interface StudySummary {
  projectId: string;
  projectName: string;
  updatedAt: number | null;
  progress: unknown[];
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
  assessments: unknown[];
  retests: unknown[];
}

export interface Education {
  focusTasks: {
    taskId: string;
    sourceId: string;
    kind: "lesson" | "homework";
  }[];
  projects: unknown[];
  progress: unknown[];
  corrections: unknown[];
  completedTasks: {
    id: string;
    projectId: string;
    title: string;
    notes: string;
    topics: string[];
    completedAt: number;
  }[];
  resources: unknown[];
  semesters: unknown[];
  semesterHistory: unknown[];
  lessons: unknown[];
  assessments: unknown[];
  submissions: unknown[];
  grades: unknown[];
  reviews: unknown[];
  events: {
    id: string;
    projectId: string;
    kind: string;
    sourceId: string;
    state: string;
    createdAt: number;
  }[];
}

export interface AppData {
  education: Education;
  identities: Identity[];
  /** 桩阶段固定为 0；core 落地后换成真实 schema 版本。 */
  version: number;
  tasks: Task[];
  blocks: Block[];
  templates: Template[];
  prints: PrintRecord[];
  projects: Project[];
  habits: Habit[];
  visions: Vision[];
  settings: Settings;
  timer: Timer;
  sessions: Session[];
  lock: LockState;
}

// 计划 v6（runtime 内部存储）：tasks 携带运行进度字段（completed/completedAt/
// reminder* 等），导出为交换格式时由 exportPlan() 剥离。语义见 docs/PLAN_FORMAT.md。
export interface PlanFile {
  format: "tomato-todo-plan";
  version: 6;
  pomodoroMinutes: number;
  projects: PlanProject[];
  tasks: Task[];
  blocks?: Block[];
  templates?: Template[];
  prints?: PrintRecord[];
  habits?: Habit[];
}

// 计划 v6 交换格式（exportPlan 产出）：只含未完成任务，剥离进度与提醒送达状态。
export interface PlanExportTask {
  id: string;
  title: string;
  templateId?: string | null;
  habitId?: string | null;
  recurring?: boolean;
  notes?: string;
  projectId?: string | null;
  dueDate: string;
  reminderTime?: string | null;
  focusMinutes?: number | null;
  scrapMinutes?: number;
  priority?: number;
  estimate?: number;
  tags?: string[];
  subtasks?: { id: string; title: string }[];
}

export interface PlanExportFile {
  format: "tomato-todo-plan";
  version: 6;
  pomodoroMinutes: number;
  projects: PlanProject[];
  tasks: PlanExportTask[];
  blocks?: Block[];
  templates?: Template[];
  prints?: PrintRecord[];
  habits?: Habit[];
}

// 计时/设置/会话等运行时状态：单独 state.json（防抖原子写），与计划数据分离。
export interface RuntimeState {
  settings: Settings;
  timer: Timer;
  sessions: Session[];
  identities: Identity[];
  visions: Vision[];
  lock: LockState;
  education: Education;
}

export interface BackupFile {
  format: "tomato-todo-backup";
  version: 4;
  exportedAt: number;
  plan: PlanFile;
  state: RuntimeState;
}

export interface DayStats {
  date: string;
  seconds: number;
  pomodoros: number;
  missed: number;
  completed: number;
  voided: number;
}

export interface Stats {
  todaySeconds: number;
  todayPomodoros: number;
  todayCompleted: number;
  totalSeconds: number;
  totalPomodoros: number;
  streak: number;
  days: DayStats[];
}

export interface TodayStats {
  todaySeconds: number;
  todayPomodoros: number;
  todayCompleted: number;
  streak: number;
}

export interface Snapshot {
  studyProgress: StudySummary[];
  taskKinds: Record<string, TaskKind>;
  data: AppData;
  stats: Stats;
  remainingSecs: number;
  today: string;
  serverTime: number;
}

export interface TodayView {
  today: string;
  serverTime: number;
  tasks: Task[];
  overdue: Task[];
  blocks: Block[];
  timer: Timer;
  remainingSecs: number;
  stats: TodayStats;
  dailyGoal: number;
}

export interface ExportResult {
  name: string;
  fileHash: string;
  bytes: number;
  asOf: number;
}

export interface TaskInput {
  title: string;
  notes?: string;
  projectId?: string | null;
  habitId?: string | null;
  dueDate: string;
  reminderTime?: string | null;
  focusMinutes?: number | null;
  scrapMinutes?: number;
  priority?: number;
  estimate?: number;
  tags?: string[];
  subtasks?: { id?: string; title: string }[];
}

export type DispatchAction =
  | { type: "focusStart"; taskId?: string | null; minutes?: number }
  | { type: "focusPause" }
  | { type: "focusResume" }
  | { type: "focusStop" }
  | { type: "focusDiscard" }
  | {
      type: "saveSettings";
      settings: Partial<Settings> & {
        protection?: Partial<Settings["protection"]>;
      };
    }
  | {
      type: "saveVision";
      id?: string | null;
      name: string;
      notes?: string;
      projectId?: string | null;
    }
  | {
      type: "saveBlock";
      id?: string | null;
      title: string;
      days: number[];
      start: string;
      end: string;
      attention?: Attention;
      notes?: string;
    }
  | { type: "deleteBlock"; id: string }
  | { type: "createProject"; name: string; color?: string; directory?: string }
  | { type: "deleteTask"; id: string };
