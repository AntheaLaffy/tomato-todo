export type Mode = "focus" | "shortBreak" | "longBreak";
export type GuardMode = "off" | "lock" | "whitelist";
export interface Project {
  id: string;
  name: string;
  color: string;
  appWhitelist: string[] | null;
}
export interface Goal {
  id: string;
  name: string;
  target: number;
  unit: string;
  measure: "count" | "time";
  dueDate: string | null;
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
export interface Task {
  id: string;
  title: string;
  notes: string;
  projectId: string | null;
  goalId: string | null;
  dueDate: string | null;
  reminderTime: string | null;
  focusMinutes: number | null;
  reminderFired: boolean;
  reminderPending: boolean;
  priority: number;
  estimate: number;
  completed: boolean;
  completedAt: number | null;
  repeat: "none" | "daily" | "weekdays" | "weekly";
  nextTaskId: string | null;
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
  version: number;
  tasks: Task[];
  projects: Project[];
  goals: Goal[];
  settings: Settings;
  timer: Timer;
  sessions: Session[];
  lock: LockState;
}
export interface PlanFile {
  format: "tomato-todo-plan";
  version: 1 | 2;
  pomodoroMinutes: number;
  projects: PlanProject[];
  tasks: {
    id: string;
    title: string;
    notes?: string;
    projectId?: string | null;
    dueDate?: string | null;
    reminderTime?: string | null;
    focusMinutes?: number | null;
    priority?: number;
    estimate?: number;
    tags?: string[];
    subtasks?: { id: string; title: string }[];
    repeat?: Task["repeat"];
  }[];
}
export interface Snapshot {
  data: AppData;
  stats: {
    todaySeconds: number;
    todayPomodoros: number;
    todayCompleted: number;
    totalSeconds: number;
    totalPomodoros: number;
    streak: number;
    days: { date: string; seconds: number; pomodoros: number }[];
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
