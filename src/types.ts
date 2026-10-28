export type Mode = "focus" | "shortBreak" | "longBreak";
export type GuardMode = "off" | "lock" | "whitelist";
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
export interface HabitSlot {
  days: number[];
  time: string;
}
export interface Habit {
  id: string;
  name: string;
}
export type Attention = "required" | "light";
/** A fixed weekly commitment outside the plan (class, lab). Descriptive only. */
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
export interface AppData {
  education: import("./education").Education;
  identities: Identity[];
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
export interface PlanFile {
  format: "tomato-todo-plan";
  version: 6;
  blocks?: Block[];
  templates?: Template[];
  prints?: PrintRecord[];
  habits?: Habit[];
  pomodoroMinutes: number;
  projects: PlanProject[];
  tasks: {
    id: string;
    title: string;
    templateId?: string | null;
    habitId?: string | null;
    recurring?: boolean;
    scrapMinutes?: number;
    notes?: string;
    projectId?: string | null;
    dueDate: string;
    reminderTime?: string | null;
    focusMinutes?: number | null;
    priority?: number;
    estimate?: number;
    tags?: string[];
    subtasks?: { id: string; title: string }[];
    repeat?: "none";
  }[];
}
export type TaskKind = "ordinary" | "habit";
export interface Snapshot {
  taskKinds: Record<string, TaskKind>;
  data: AppData;
  stats: {
    todaySeconds: number;
    todayPomodoros: number;
    todayCompleted: number;
    totalSeconds: number;
    totalPomodoros: number;
    streak: number;
    days: {
      date: string;
      seconds: number;
      pomodoros: number;
      missed: number;
      completed: number;
      voided: number;
    }[];
  };
  remainingSecs: number;
  today: string;
  serverTime: number;
}
export interface GuardInfo {
  available: boolean;
  backend: string;
  message: string;
  windows: {
    id: number;
    app_id: string | null;
    title: string | null;
    pid: number | null;
    is_focused: boolean;
  }[];
}
export interface DesktopStatus {
  autostart: boolean;
  closeToTray: boolean;
  trayAvailable: boolean;
}
