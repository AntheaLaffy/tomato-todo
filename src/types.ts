export type Mode = "focus" | "shortBreak" | "longBreak";
export type GuardMode = "off" | "lock" | "whitelist";
export interface Project {
  id: string;
  name: string;
  color: string;
  appWhitelist: string[] | null;
}
export type Verdict = "success" | "failure";
export type SignalKind = Verdict | "check";
export type BlockRule =
  | "never"
  | "always"
  | "unpaired"
  | "unfinishedTasks"
  | "incomplete"
  | "completed";
export interface SignalSpec {
  kind: SignalKind;
  direction: "head" | "tail";
  at: string;
  condition: "always" | "completed" | "incomplete";
}
export interface NodeSpec {
  id: string;
  name: string;
  start: string;
  end: string;
  requiredTasks: number;
  confirmationRequired: boolean;
  signal: SignalSpec | null;
  blockSuccess: BlockRule;
  blockFailure: BlockRule;
}
export interface MainlineNode {
  spec: NodeSpec;
  confirmed: boolean;
  emitted: boolean;
  result: { verdict: Verdict; at: number; signalId: string } | null;
}
export interface Goal {
  id: string;
  name: string;
  nodes: MainlineNode[];
}
export interface NodeBinding {
  taskId: string;
  goalId: string;
  nodeId: string;
  completed: boolean;
  boundAt: number;
}
export interface NodeProgress {
  goalId: string;
  nodeId: string;
  pairedCount: number;
  completedCount: number;
  allTasksCompleted: boolean;
  completed: boolean;
}
export interface SignalEvent {
  id: string;
  goalId: string;
  sourceNodeId: string;
  kind: SignalKind;
  direction: "head" | "tail";
  triggerAt: string;
  emittedAt: number;
  deliveries: {
    nodeId: string;
    blocked: boolean;
    blockRule: BlockRule;
    before: Verdict | null;
    after: Verdict | null;
    pairedCount: number;
    completedCount: number;
    completed: boolean;
  }[];
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
export interface Vision {
  id: string;
  name: string;
  notes: string;
  projectId: string | null;
  goalId: string | null;
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
  goalId: string | null;
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
  | { kind: "once"; date: string | null; time: string | null }
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
  date: string | null;
}
export interface Task {
  id: string;
  nodeId: string | null;
  templateId: string | null;
  recurring: boolean;
  scrapMinutes: number;
  title: string;
  notes: string;
  projectId: string | null;
  goalId: string | null;
  habitId: string | null;
  dueDate: string | null;
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
  notifications: boolean;
  alwaysOnTop: boolean;
  theme: "light" | "dark" | "system";
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
  completionSerial: number;
  lastFinishedMode: Mode | null;
}
export interface Session {
  id: string;
  taskId: string | null;
  taskTitle: string;
  projectName: string;
  startedAt: number;
  endedAt: number;
  durationSecs: number;
  completed: boolean;
}
export interface AppData {
  identities: Identity[];
  nodeBindings: NodeBinding[];
  signalEvents: SignalEvent[];
  version: number;
  tasks: Task[];
  templates: Template[];
  prints: PrintRecord[];
  projects: Project[];
  goals: Goal[];
  habits: Habit[];
  visions: Vision[];
  settings: Settings;
  timer: Timer;
  sessions: Session[];
  lock: LockState;
}
export interface PlanFile {
  format: "tomato-todo-plan";
  version: 1 | 2 | 3 | 4;
  templates?: Template[];
  prints?: PrintRecord[];
  goals?: { id: string; name: string; nodes: NodeSpec[] }[];
  habits?: Habit[];
  pomodoroMinutes: number;
  projects: PlanProject[];
  tasks: {
    id: string;
    title: string;
    templateId?: string | null;
    goalId?: string | null;
    habitId?: string | null;
    recurring?: boolean;
    scrapMinutes?: number;
    notes?: string;
    projectId?: string | null;
    dueDate?: string | null;
    reminderTime?: string | null;
    focusMinutes?: number | null;
    priority?: number;
    estimate?: number;
    tags?: string[];
    subtasks?: { id: string; title: string }[];
    repeat?: "none" | "daily" | "weekdays" | "weekly";
  }[];
}
export type TaskKind = "ordinary" | "habit" | "goal";
export interface Snapshot {
  nodeProgress: NodeProgress[];
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
