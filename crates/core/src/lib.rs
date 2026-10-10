//! Shared application engine. Both the desktop and preview call the same validated actions.
use chrono::{Datelike, Days, Local, NaiveDate, TimeZone, Weekday};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    path::Path,
};
use uuid::Uuid;
pub mod guard;
pub mod habits;
pub mod lock;
pub mod plan;
pub mod reminders;

pub type AppResult<T> = Result<T, String>;
pub(crate) fn id() -> String {
    Uuid::new_v4().to_string()
}
pub fn now() -> i64 {
    Local::now().timestamp()
}
fn date_at(timestamp: i64) -> String {
    Local
        .timestamp_opt(timestamp, 0)
        .single()
        .unwrap_or_else(Local::now)
        .format("%Y-%m-%d")
        .to_string()
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub color: String,
    /// When `Some`, this project's own list replaces the global whitelist during
    /// a whitelist focus session; `None` keeps using the global list.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub app_whitelist: Option<Vec<String>>,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GoalMeasure {
    #[default]
    Count,
    Time,
}

/// A long-lived objective that groups tasks and absorbs the work they miss.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Goal {
    pub id: String,
    pub name: String,
    pub target: f64,
    pub unit: String,
    #[serde(default)]
    pub measure: GoalMeasure,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub due_date: Option<String>,
}

/// One "weekdays at a time" band of a routine.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HabitSlot {
    /// 1 = Monday … 7 = Sunday.
    pub days: Vec<u8>,
    pub time: String,
}

/// A weekly routine that materializes one ordinary task per scheduled day, so a
/// habit can run at different times on different days without manual bookkeeping.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Habit {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub focus_minutes: Option<u32>,
    pub slots: Vec<HabitSlot>,
}

/// A motivational marker: a name plus some prose that can belong to a project, a
/// goal, or stand on its own as the overall vision. It carries no jurisdiction —
/// no progress to catch up on, no failure, no missed days.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vision {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub goal_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Subtask {
    pub id: String,
    pub title: String,
    pub done: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    pub notes: String,
    pub project_id: Option<String>,
    #[serde(default)]
    pub goal_id: Option<String>,
    #[serde(default)]
    pub habit_id: Option<String>,
    pub due_date: Option<String>,
    #[serde(default)]
    pub reminder_time: Option<String>,
    #[serde(default)]
    pub focus_minutes: Option<u32>,
    pub priority: u8,
    pub estimate: u32,
    #[serde(default)]
    pub reminder_fired: bool,
    #[serde(default)]
    pub reminder_pending: bool,
    /// Set once the task's day has passed or its planned block is over. A
    /// routine (timed, no goal) is spent from then on; it does not roll over.
    #[serde(default)]
    pub reminder_expired: bool,
    pub completed: bool,
    pub completed_at: Option<i64>,
    pub created_at: i64,
    pub tags: Vec<String>,
    pub subtasks: Vec<Subtask>,
    #[serde(default)]
    pub repeat: Repeat,
    #[serde(default)]
    pub next_task_id: Option<String>,
}
impl Task {
    /// Repetition is what makes a miss a habit miss. A one-off timed item is an
    /// appointment: it is spent when its time passes, but it is not a lapse.
    pub fn is_habit(&self) -> bool {
        self.reminder_time.is_some()
            && self.goal_id.is_none()
            && (self.habit_id.is_some() || self.repeat != Repeat::None)
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Repeat {
    #[default]
    None,
    Daily,
    Weekdays,
    Weekly,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskDraft {
    pub id: Option<String>,
    pub title: String,
    #[serde(default)]
    pub notes: String,
    pub project_id: Option<String>,
    #[serde(default)]
    pub goal_id: Option<String>,
    pub due_date: Option<String>,
    #[serde(default)]
    pub reminder_time: Option<String>,
    #[serde(default)]
    pub focus_minutes: Option<u32>,
    #[serde(default)]
    pub priority: u8,
    #[serde(default = "default_estimate")]
    pub estimate: u32,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub subtasks: Vec<Subtask>,
    #[serde(default)]
    pub repeat: Repeat,
}
fn default_estimate() -> u32 {
    1
}

/// App IDs must be short, non-blank and free of control characters, matching the
/// global whitelist rule so project lists cannot smuggle in unenforceable values.
fn valid_app_ids(list: &[String]) -> bool {
    list.len() <= 100
        && list
            .iter()
            .all(|a| !a.trim().is_empty() && a.len() <= 200 && !a.chars().any(char::is_control))
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub focus_minutes: u32,
    pub short_break_minutes: u32,
    pub long_break_minutes: u32,
    pub long_break_every: u32,
    pub daily_goal: u32,
    pub auto_break: bool,
    pub auto_focus: bool,
    pub sound: bool,
    pub notifications: bool,
    pub always_on_top: bool,
    pub theme: String,
    #[serde(default)]
    pub protection: Protection,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Protection {
    #[serde(default)]
    pub mode: GuardMode,
    #[serde(default)]
    pub whitelist: Vec<String>,
    #[serde(default)]
    pub strict: bool,
}
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GuardMode {
    #[default]
    Off,
    Lock,
    Whitelist,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            focus_minutes: 25,
            short_break_minutes: 5,
            long_break_minutes: 15,
            long_break_every: 4,
            daily_goal: 8,
            auto_break: false,
            auto_focus: false,
            sound: true,
            notifications: true,
            always_on_top: false,
            theme: "light".into(),
            protection: Protection::default(),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Mode {
    Focus,
    ShortBreak,
    LongBreak,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Timer {
    pub mode: Mode,
    pub running: bool,
    pub task_id: Option<String>,
    pub duration_secs: u32,
    pub remaining_secs: u32,
    pub deadline: Option<i64>,
    pub started_at: Option<i64>,
    pub cycle: u32,
    pub completion_serial: u64,
    pub last_finished_mode: Option<Mode>,
}
impl Default for Timer {
    fn default() -> Self {
        Self {
            mode: Mode::Focus,
            running: false,
            task_id: None,
            duration_secs: 1500,
            remaining_secs: 1500,
            deadline: None,
            started_at: None,
            cycle: 0,
            completion_serial: 0,
            last_finished_mode: None,
        }
    }
}
impl Timer {
    pub fn remaining(&self, at: i64) -> u32 {
        self.deadline
            .filter(|_| self.running)
            .map(|d| d.saturating_sub(at).clamp(0, self.duration_secs as i64) as u32)
            .unwrap_or(self.remaining_secs)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub task_id: Option<String>,
    pub task_title: String,
    pub project_name: String,
    pub started_at: i64,
    pub ended_at: i64,
    pub duration_secs: u32,
    pub completed: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppData {
    pub version: u32,
    pub tasks: Vec<Task>,
    pub projects: Vec<Project>,
    #[serde(default)]
    pub goals: Vec<Goal>,
    #[serde(default)]
    pub habits: Vec<Habit>,
    #[serde(default)]
    pub visions: Vec<Vision>,
    pub settings: Settings,
    pub timer: Timer,
    pub sessions: Vec<Session>,
    #[serde(default)]
    pub lock: lock::LockState,
}
impl Default for AppData {
    fn default() -> Self {
        Self {
            version: 1,
            tasks: vec![],
            projects: vec![
                Project {
                    id: id(),
                    name: "工作".into(),
                    color: "#df7561".into(),
                    app_whitelist: None,
                },
                Project {
                    id: id(),
                    name: "学习".into(),
                    color: "#849b7d".into(),
                    app_whitelist: None,
                },
                Project {
                    id: id(),
                    name: "生活".into(),
                    color: "#d5a553".into(),
                    app_whitelist: None,
                },
            ],
            goals: vec![],
            habits: vec![],
            visions: vec![],
            settings: Settings::default(),
            timer: Timer::default(),
            sessions: vec![],
            lock: lock::LockState::default(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Action {
    StartReminder {
        id: String,
    },
    SaveTask {
        task: TaskDraft,
    },
    ToggleTask {
        id: String,
    },
    DeleteTask {
        id: String,
    },
    RestoreTask {
        task: Task,
    },
    ToggleSubtask {
        task_id: String,
        subtask_id: String,
    },
    SaveProject {
        id: Option<String>,
        name: String,
        color: String,
    },
    SetProjectWhitelist {
        id: String,
        whitelist: Option<Vec<String>>,
    },
    DeleteProject {
        id: String,
    },
    SaveGoal {
        id: Option<String>,
        name: String,
        target: f64,
        unit: String,
        #[serde(default)]
        measure: GoalMeasure,
        #[serde(default)]
        due_date: Option<String>,
    },
    DeleteGoal {
        id: String,
    },
    SaveHabit {
        id: Option<String>,
        name: String,
        #[serde(default)]
        project_id: Option<String>,
        #[serde(default)]
        focus_minutes: Option<u32>,
        slots: Vec<HabitSlot>,
    },
    DeleteHabit {
        id: String,
    },
    SaveVision {
        id: Option<String>,
        name: String,
        #[serde(default)]
        notes: String,
        #[serde(default)]
        project_id: Option<String>,
        #[serde(default)]
        goal_id: Option<String>,
    },
    DeleteVision {
        id: String,
    },
    SelectTask {
        id: Option<String>,
    },
    StartTimer,
    PauseTimer,
    ResetTimer,
    SkipTimer,
    SetMode {
        mode: Mode,
    },
    SaveSettings {
        settings: Settings,
    },
    LoadExample,
    Import {
        data: Box<AppData>,
    },
    ImportPlan {
        plan: plan::PlanFile,
    },
    EmergencyUnlock,
    SaveLockSchedule {
        schedule: lock::LockSchedule,
    },
    DeleteLockSchedule {
        id: String,
    },
    StartQuickLock {
        minutes: u32,
        strict: bool,
    },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DayStat {
    pub date: String,
    pub seconds: u64,
    pub pomodoros: u32,
    /// Routines (timed, no goal) whose day passed without being completed.
    pub missed: u32,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Stats {
    pub today_seconds: u64,
    pub today_pomodoros: u32,
    pub today_completed: usize,
    pub total_seconds: u64,
    pub total_pomodoros: usize,
    pub streak: u32,
    pub days: Vec<DayStat>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub data: AppData,
    pub stats: Stats,
    pub remaining_secs: u32,
    pub today: String,
    pub server_time: i64,
}

impl AppData {
    pub fn protected(&self) -> bool {
        self.lock.active.is_some()
            || (self.timer.running
                && self.timer.mode == Mode::Focus
                && self.settings.protection.mode != GuardMode::Off)
    }
    /// Permitted app IDs for a whitelist-mode focus session. A project that has
    /// its own list replaces the global one; otherwise the global list applies.
    pub fn effective_whitelist(&self) -> Vec<String> {
        let project = self
            .timer
            .task_id
            .as_ref()
            .and_then(|id| self.tasks.iter().find(|t| &t.id == id))
            .and_then(|t| t.project_id.as_ref())
            .and_then(|id| self.projects.iter().find(|p| &p.id == id));
        match project.and_then(|p| p.app_whitelist.as_ref()) {
            Some(list) => list.clone(),
            None => self.settings.protection.whitelist.clone(),
        }
    }
    /// Accumulated progress toward a goal: completed tasks for count goals, or
    /// focused hours for time goals.
    pub fn goal_progress(&self, goal_id: &str) -> f64 {
        let Some(goal) = self.goals.iter().find(|g| g.id == goal_id) else {
            return 0.0;
        };
        match goal.measure {
            GoalMeasure::Count => self
                .tasks
                .iter()
                .filter(|t| t.goal_id.as_deref() == Some(goal_id) && t.completed)
                .count() as f64,
            GoalMeasure::Time => {
                let ids: HashSet<&String> = self
                    .tasks
                    .iter()
                    .filter(|t| t.goal_id.as_deref() == Some(goal_id))
                    .map(|t| &t.id)
                    .collect();
                let seconds: u64 = self
                    .sessions
                    .iter()
                    .filter(|s| s.task_id.as_ref().is_some_and(|id| ids.contains(id)))
                    .map(|s| u64::from(s.duration_secs))
                    .sum();
                seconds as f64 / 3600.0
            }
        }
    }
    pub fn strict_protected(&self) -> bool {
        self.lock.active.as_ref().is_some_and(|a| a.strict)
            || (self.timer.running
                && self.timer.mode == Mode::Focus
                && self.settings.protection.mode != GuardMode::Off
                && self.settings.protection.strict)
    }
    fn duration(&self, mode: Mode) -> u32 {
        60 * match mode {
            Mode::Focus => self
                .tasks
                .iter()
                .find(|t| Some(&t.id) == self.timer.task_id.as_ref())
                .and_then(|t| t.focus_minutes)
                .unwrap_or(self.settings.focus_minutes),
            Mode::ShortBreak => self.settings.short_break_minutes,
            Mode::LongBreak => self.settings.long_break_minutes,
        }
    }
    fn reset_to(&mut self, mode: Mode) {
        self.timer.mode = mode;
        self.timer.running = false;
        self.timer.duration_secs = self.duration(mode);
        self.timer.remaining_secs = self.timer.duration_secs;
        self.timer.deadline = None;
        self.timer.started_at = None;
    }
    fn start(&mut self, at: i64) {
        if self.timer.mode == Mode::Focus {
            if self.timer.started_at.is_none()
                && !self.timer.running
                && self.timer.remaining_secs == self.timer.duration_secs
            {
                self.reset_to(Mode::Focus);
            }
            if let Some(t) = self
                .tasks
                .iter_mut()
                .find(|t| Some(&t.id) == self.timer.task_id.as_ref())
            {
                t.reminder_pending = false;
            }
        }
        if !self.timer.running {
            self.timer.started_at.get_or_insert(at);
            self.timer.deadline = Some(at + self.timer.remaining_secs as i64);
            self.timer.running = true;
        }
    }
    fn record(&mut self, at: i64, completed: bool) {
        let elapsed = self.timer.duration_secs - self.timer.remaining(at);
        if self.timer.mode != Mode::Focus || elapsed == 0 {
            return;
        }
        let task = self
            .tasks
            .iter()
            .find(|t| Some(&t.id) == self.timer.task_id.as_ref());
        let project = task
            .and_then(|t| t.project_id.as_ref())
            .and_then(|id| self.projects.iter().find(|p| &p.id == id));
        self.sessions.push(Session {
            id: id(),
            task_id: self.timer.task_id.clone(),
            task_title: task.map(|t| t.title.clone()).unwrap_or("自由专注".into()),
            project_name: project.map(|p| p.name.clone()).unwrap_or("未分类".into()),
            started_at: self.timer.started_at.unwrap_or(at - elapsed as i64),
            ended_at: at,
            duration_secs: elapsed,
            completed,
        });
    }
    /// Advance at most one phase after downtime: never fabricate unattended focus sessions.
    pub fn tick(&mut self, at: i64) -> bool {
        let materialized = self.materialize_habits(at);
        let changed = self.tick_with_lock(at) || materialized;
        self.tick_reminders(at) || changed
    }
    fn tick_with_lock(&mut self, at: i64) -> bool {
        let previous = serde_json::to_value(&self.lock).ok();
        if self.lock.active.as_ref().is_some_and(|a| at >= a.ends_at) {
            self.lock.active = None;
        }
        if let Some(mut scheduled) = self.lock.scheduled_at(at) {
            if let Some(active) = &self.lock.active {
                scheduled.started_at = active.started_at.min(scheduled.started_at);
                scheduled.ends_at = active.ends_at.max(scheduled.ends_at);
                scheduled.strict |= active.strict;
            }
            self.lock.active = Some(scheduled);
        }
        let changed = previous != serde_json::to_value(&self.lock).ok();
        if let Some(active) = &self.lock.active {
            let start = active.started_at;
            if self.timer.running {
                let stop = start.max(self.timer.started_at.unwrap_or(start)).min(at);
                self.tick_timer(stop);
                self.record(stop, false);
                self.reset_to(Mode::Focus);
                return true;
            }
            return changed;
        }
        self.tick_timer(at) || changed
    }
    fn tick_timer(&mut self, at: i64) -> bool {
        if !self.timer.running || self.timer.remaining(at) > 0 {
            return false;
        }
        let end = self.timer.deadline.unwrap_or(at);
        let finished = self.timer.mode;
        self.record(end, true);
        if finished == Mode::Focus {
            self.timer.cycle = self.timer.cycle.saturating_add(1);
        }
        let next = if finished == Mode::Focus {
            if self
                .timer
                .cycle
                .is_multiple_of(self.settings.long_break_every)
            {
                Mode::LongBreak
            } else {
                Mode::ShortBreak
            }
        } else {
            Mode::Focus
        };
        self.reset_to(next);
        self.timer.completion_serial = self.timer.completion_serial.saturating_add(1);
        self.timer.last_finished_mode = Some(finished);
        let auto = if next == Mode::Focus {
            self.settings.auto_focus
        } else {
            self.settings.auto_break
        };
        // Auto transitions are only for a live app, not hours spent closed or asleep.
        if auto && at - end < 5 {
            self.start(at);
        }
        true
    }
    pub fn apply(&mut self, action: Action, at: i64) -> AppResult<()> {
        self.tick(at);
        if self.strict_protected() {
            return Err("严格模式生效中，不能提前结束或修改；到时自动解除".into());
        }
        if self.protected() && !matches!(action, Action::EmergencyUnlock) {
            return Err("专注保护中，结束前不能修改任务或计时；如有急事请使用紧急退出".into());
        }
        match action {
            Action::StartReminder { id } => {
                if !self.reminder_idle() {
                    return Err("请先结束当前计时".into());
                }
                let t = self
                    .tasks
                    .iter_mut()
                    .find(|t| t.id == id && !t.completed && t.reminder_pending)
                    .ok_or("提醒已失效")?;
                t.reminder_pending = false;
                self.timer.task_id = Some(id);
                self.reset_to(Mode::Focus);
                self.start(at);
            }
            Action::EmergencyUnlock => {
                self.record(at, false);
                self.reset_to(Mode::Focus);
                self.lock.release(at);
            }
            Action::SaveLockSchedule { schedule } => {
                if let Some(index) = self.lock.schedules.iter().position(|s| s.id == schedule.id) {
                    self.lock.schedules[index] = schedule;
                } else {
                    self.lock.schedules.push(schedule);
                }
                self.lock.validate()?;
                self.tick(at);
            }
            Action::DeleteLockSchedule { id } => self.lock.schedules.retain(|s| s.id != id),
            Action::StartQuickLock { minutes, strict } => {
                if !(1..=720).contains(&minutes) {
                    return Err("快速锁机时长需为 1–720 分钟".into());
                }
                self.record(at, false);
                self.reset_to(Mode::Focus);
                self.lock.active = Some(lock::ActiveLock {
                    name: "小憩".into(),
                    started_at: at,
                    ends_at: at + i64::from(minutes) * 60,
                    strict,
                });
            }
            Action::SaveTask { task: d } => {
                let existing =
                    d.id.as_ref()
                        .and_then(|id| self.tasks.iter().position(|t| &t.id == id));
                if d.id.is_some() && existing.is_none() {
                    return Err("任务不存在，可能已经被删除".into());
                }
                let old = existing.map(|i| &self.tasks[i]);
                let task = Task {
                    id: d.id.unwrap_or_else(id),
                    title: d.title.trim().into(),
                    notes: d.notes,
                    project_id: d.project_id,
                    goal_id: d.goal_id,
                    habit_id: old.and_then(|t| t.habit_id.clone()),
                    reminder_fired: old.is_some_and(|t| {
                        t.due_date == d.due_date
                            && t.reminder_time == d.reminder_time
                            && t.reminder_fired
                    }),
                    reminder_pending: old.is_some_and(|t| {
                        t.due_date == d.due_date
                            && t.reminder_time == d.reminder_time
                            && t.reminder_pending
                    }),
                    reminder_expired: old.is_some_and(|t| {
                        t.due_date == d.due_date
                            && t.reminder_time == d.reminder_time
                            && t.reminder_expired
                    }),
                    focus_minutes: d.focus_minutes,
                    reminder_time: d.reminder_time,
                    due_date: d.due_date,
                    priority: d.priority,
                    estimate: d.estimate,
                    completed: old.is_some_and(|t| t.completed),
                    completed_at: old.and_then(|t| t.completed_at),
                    created_at: old.map(|t| t.created_at).unwrap_or(at),
                    tags: d
                        .tags
                        .into_iter()
                        .map(|t| t.trim().to_string())
                        .filter(|t| !t.is_empty())
                        .collect(),
                    subtasks: d.subtasks,
                    repeat: d.repeat,
                    next_task_id: old.and_then(|t| t.next_task_id.clone()),
                };
                match existing {
                    Some(i) => self.tasks[i] = task,
                    None => self.tasks.push(task),
                }
            }
            Action::ToggleTask { id: task_id } => {
                let t = self
                    .tasks
                    .iter_mut()
                    .find(|t| t.id == task_id)
                    .ok_or("任务不存在")?;
                t.completed = !t.completed;
                t.completed_at = if t.completed { Some(at) } else { None };
                // Reopening the previous occurrence must not generate duplicate future tasks.
                if t.completed && t.repeat != Repeat::None && t.next_task_id.is_none() {
                    let today = date_at(at);
                    let base = t.due_date.as_deref().unwrap_or(&today).max(&today);
                    let base =
                        NaiveDate::parse_from_str(base, "%Y-%m-%d").map_err(|e| e.to_string())?;
                    let mut next = base
                        .checked_add_days(Days::new(if t.repeat == Repeat::Weekly { 7 } else { 1 }))
                        .ok_or("日期超出范围")?;
                    if t.repeat == Repeat::Weekdays {
                        while matches!(next.weekday(), Weekday::Sat | Weekday::Sun) {
                            next = next.succ_opt().ok_or("日期超出范围")?;
                        }
                    }
                    let mut upcoming = t.clone();
                    upcoming.id = id();
                    upcoming.completed = false;
                    upcoming.completed_at = None;
                    upcoming.created_at = at;
                    upcoming.due_date = Some(next.to_string());
                    upcoming.next_task_id = None;
                    upcoming.reminder_fired = false;
                    upcoming.reminder_pending = false;
                    for sub in &mut upcoming.subtasks {
                        sub.id = id();
                        sub.done = false;
                    }
                    t.next_task_id = Some(upcoming.id.clone());
                    self.tasks.push(upcoming);
                }
            }
            Action::DeleteTask { id } => {
                if !self.tasks.iter().any(|t| t.id == id) {
                    return Err("任务不存在".into());
                }
                if self.timer.task_id.as_ref() == Some(&id) {
                    self.record(at, false);
                    self.reset_to(self.timer.mode);
                    self.timer.task_id = None;
                }
                self.tasks.retain(|t| t.id != id);
            }
            Action::RestoreTask { mut task } => {
                if self.tasks.iter().any(|t| t.id == task.id) {
                    return Err("任务已经存在".into());
                }
                if task
                    .project_id
                    .as_ref()
                    .is_some_and(|id| !self.projects.iter().any(|p| &p.id == id))
                {
                    task.project_id = None;
                }
                self.tasks.push(task);
            }
            Action::ToggleSubtask {
                task_id,
                subtask_id,
            } => {
                let sub = self
                    .tasks
                    .iter_mut()
                    .find(|t| t.id == task_id)
                    .and_then(|t| t.subtasks.iter_mut().find(|s| s.id == subtask_id))
                    .ok_or("子任务不存在")?;
                sub.done = !sub.done;
            }
            Action::SaveProject {
                id: pid,
                name,
                color,
            } => {
                if let Some(pid) = pid {
                    let p = self
                        .projects
                        .iter_mut()
                        .find(|p| p.id == pid)
                        .ok_or("项目不存在")?;
                    p.name = name.trim().into();
                    p.color = color;
                } else {
                    self.projects.push(Project {
                        id: id(),
                        name: name.trim().into(),
                        color,
                        app_whitelist: None,
                    });
                }
            }
            Action::SetProjectWhitelist { id: pid, whitelist } => {
                let p = self
                    .projects
                    .iter_mut()
                    .find(|p| p.id == pid)
                    .ok_or("项目不存在")?;
                p.app_whitelist = whitelist;
            }
            Action::DeleteProject { id } => {
                self.projects.retain(|p| p.id != id);
                for task in &mut self.tasks {
                    if task.project_id.as_ref() == Some(&id) {
                        task.project_id = None;
                    }
                }
                self.visions.retain(|a| a.project_id.as_ref() != Some(&id));
            }
            Action::SaveGoal {
                id: gid,
                name,
                target,
                unit,
                measure,
                due_date,
            } => {
                if let Some(gid) = gid {
                    let g = self
                        .goals
                        .iter_mut()
                        .find(|g| g.id == gid)
                        .ok_or("目标不存在")?;
                    g.name = name.trim().into();
                    g.target = target;
                    g.unit = unit.trim().into();
                    g.measure = measure;
                    g.due_date = due_date;
                } else {
                    self.goals.push(Goal {
                        id: id(),
                        name: name.trim().into(),
                        target,
                        unit: unit.trim().into(),
                        measure,
                        due_date,
                    });
                }
            }
            Action::DeleteGoal { id } => {
                self.goals.retain(|g| g.id != id);
                for task in &mut self.tasks {
                    if task.goal_id.as_ref() == Some(&id) {
                        task.goal_id = None;
                    }
                }
                self.visions.retain(|a| a.goal_id.as_ref() != Some(&id));
            }
            Action::SaveHabit {
                id: hid,
                name,
                project_id,
                focus_minutes,
                slots,
            } => {
                if let Some(hid) = hid {
                    let h = self
                        .habits
                        .iter_mut()
                        .find(|h| h.id == hid)
                        .ok_or("习惯不存在")?;
                    h.name = name.trim().into();
                    h.project_id = project_id;
                    h.focus_minutes = focus_minutes;
                    h.slots = slots;
                } else {
                    self.habits.push(Habit {
                        id: id(),
                        name: name.trim().into(),
                        project_id,
                        focus_minutes,
                        slots,
                    });
                }
            }
            Action::DeleteHabit { id } => {
                self.habits.retain(|h| h.id != id);
                // Existing occurrences keep running as ordinary timed tasks.
                for task in &mut self.tasks {
                    if task.habit_id.as_ref() == Some(&id) {
                        task.habit_id = None;
                    }
                }
            }
            Action::SaveVision {
                id: aid,
                name,
                notes,
                project_id,
                goal_id,
            } => {
                if let Some(aid) = aid {
                    let a = self
                        .visions
                        .iter_mut()
                        .find(|a| a.id == aid)
                        .ok_or("愿景不存在")?;
                    a.name = name.trim().into();
                    a.notes = notes;
                    a.project_id = project_id;
                    a.goal_id = goal_id;
                } else {
                    self.visions.push(Vision {
                        id: id(),
                        name: name.trim().into(),
                        notes,
                        project_id,
                        goal_id,
                    });
                }
            }
            Action::DeleteVision { id } => self.visions.retain(|a| a.id != id),
            Action::SelectTask { id } => {
                if id
                    .as_ref()
                    .is_some_and(|id| !self.tasks.iter().any(|t| &t.id == id && !t.completed))
                {
                    return Err("请选择一个未完成的任务".into());
                }
                if self.timer.running || self.timer.remaining(at) < self.timer.duration_secs {
                    return Err("请先结束当前计时，再切换专注任务".into());
                }
                self.timer.task_id = id;
                self.reset_to(self.timer.mode);
            }
            Action::StartTimer => self.start(at),
            Action::PauseTimer => {
                self.timer.remaining_secs = self.timer.remaining(at);
                self.timer.running = false;
                self.timer.deadline = None;
            }
            Action::ResetTimer => {
                self.record(at, false);
                self.reset_to(self.timer.mode);
            }
            Action::SkipTimer => {
                self.record(at, false);
                let next = if self.timer.mode == Mode::Focus {
                    Mode::ShortBreak
                } else {
                    Mode::Focus
                };
                self.reset_to(next);
            }
            Action::SetMode { mode } => {
                if mode != self.timer.mode {
                    self.record(at, false);
                    self.reset_to(mode);
                }
            }
            Action::SaveSettings { settings } => {
                self.settings = settings;
                if !self.timer.running && self.timer.remaining_secs == self.timer.duration_secs {
                    self.reset_to(self.timer.mode);
                }
            }
            Action::ImportPlan { plan } => plan.merge_into(self, at)?,
            Action::Import { data } => {
                data.validate()?;
                let mut data = *data;
                // Restoring a file must not silently arm a scheduled desktop lock.
                data.lock.active = None;
                data.lock.suppressed_until = 0;
                for schedule in &mut data.lock.schedules {
                    schedule.enabled = false;
                }
                // A backup is data, not authorization to restart an old clock.
                data.timer.remaining_secs = data.timer.remaining(at).max(1);
                data.timer.running = false;
                data.timer.deadline = None;
                data.timer.completion_serial = self.timer.completion_serial;
                *self = data;
            }
            Action::LoadExample => {
                if !self.tasks.is_empty() {
                    return Err("只有空任务列表可以载入示例".into());
                }
                let today = date_at(at);
                for (index, (title, notes, priority, estimate)) in [
                    (
                        "梳理本周的工作计划",
                        "把大目标拆成小步骤，让每一天都更从容。",
                        3,
                        2,
                    ),
                    (
                        "读完正在看的那一章",
                        "关掉消息提醒，给阅读留一段完整的时间。",
                        2,
                        1,
                    ),
                    ("整理桌面，整理思绪", "一个舒服的环境，是专注的开始。", 1, 1),
                ]
                .into_iter()
                .enumerate()
                {
                    self.tasks.push(Task {
                        id: id(),
                        title: title.into(),
                        notes: notes.into(),
                        project_id: self.projects.get(index).map(|p| p.id.clone()),
                        goal_id: None,
                        habit_id: None,
                        due_date: Some(today.clone()),
                        reminder_time: None,
                        focus_minutes: None,
                        reminder_fired: false,
                        reminder_pending: false,
                        reminder_expired: false,
                        priority,
                        estimate,
                        completed: false,
                        completed_at: None,
                        created_at: at + index as i64,
                        tags: vec!["示例".into()],
                        subtasks: vec![],
                        repeat: Repeat::None,
                        next_task_id: None,
                    });
                }
            }
        }
        self.validate()
    }

    pub fn validate(&self) -> AppResult<()> {
        self.lock.validate()?;
        fn ensure(ok: bool, message: &str) -> AppResult<()> {
            if ok {
                Ok(())
            } else {
                Err(message.into())
            }
        }
        ensure(self.version == 1, "不支持此数据版本")?;
        ensure(
            self.tasks.len() <= 50_000
                && self.sessions.len() <= 200_000
                && self.projects.len() <= 500,
            "数据超出数量限制",
        )?;
        let s = &self.settings;
        ensure(
            (1..=180).contains(&s.focus_minutes)
                && (1..=60).contains(&s.short_break_minutes)
                && (1..=120).contains(&s.long_break_minutes)
                && (2..=12).contains(&s.long_break_every)
                && (1..=30).contains(&s.daily_goal),
            "计时设置超出允许范围",
        )?;
        ensure(
            ["light", "dark", "system"].contains(&s.theme.as_str()),
            "无效的主题",
        )?;
        ensure(valid_app_ids(&s.protection.whitelist), "无效的应用白名单")?;
        let mut ids = HashSet::new();
        for p in &self.projects {
            ensure(!p.id.is_empty() && ids.insert(&p.id), "项目 ID 重复或为空")?;
            ensure(
                !p.name.trim().is_empty() && p.name.chars().count() <= 40,
                "项目名称需为 1–40 个字符",
            )?;
            ensure(
                p.color.len() == 7
                    && p.color.starts_with('#')
                    && p.color[1..].bytes().all(|b| b.is_ascii_hexdigit()),
                "无效的项目颜色",
            )?;
            ensure(
                p.app_whitelist.as_ref().is_none_or(|l| valid_app_ids(l)),
                "无效的项目应用白名单",
            )?;
        }
        let mut goal_ids = HashSet::new();
        ensure(self.goals.len() <= 500, "目标数量超出限制")?;
        for g in &self.goals {
            ensure(
                !g.id.is_empty() && goal_ids.insert(&g.id),
                "目标 ID 重复或为空",
            )?;
            ensure(
                !g.name.trim().is_empty() && g.name.chars().count() <= 40,
                "目标名称需为 1–40 个字符",
            )?;
            ensure(
                g.target.is_finite() && g.target > 0.0 && g.target <= 1_000_000.0,
                "目标量需为正数",
            )?;
            ensure(
                !g.unit.trim().is_empty() && g.unit.chars().count() <= 10,
                "目标单位需为 1–10 个字符",
            )?;
            ensure(
                g.due_date.as_ref().is_none_or(|d| {
                    d.len() == 10 && NaiveDate::parse_from_str(d, "%Y-%m-%d").is_ok()
                }),
                "无效的目标日期",
            )?;
        }
        let mut habit_ids = HashSet::new();
        ensure(self.habits.len() <= 500, "习惯数量超出限制")?;
        for h in &self.habits {
            ensure(
                !h.id.is_empty() && habit_ids.insert(&h.id),
                "习惯 ID 重复或为空",
            )?;
            habits::validate(h)?;
            ensure(
                h.project_id.as_ref().is_none_or(|p| ids.contains(p)),
                "习惯引用了不存在的项目",
            )?;
        }
        let mut vision_ids = HashSet::new();
        ensure(self.visions.len() <= 500, "愿景数量超出限制")?;
        for a in &self.visions {
            ensure(
                !a.id.is_empty() && vision_ids.insert(&a.id),
                "愿景 ID 重复或为空",
            )?;
            ensure(
                !a.name.trim().is_empty() && a.name.chars().count() <= 40,
                "愿景名称需为 1–40 个字符",
            )?;
            ensure(a.notes.len() <= 50_000, "愿景内容过长")?;
            ensure(
                !(a.project_id.is_some() && a.goal_id.is_some()),
                "愿景只能属于一个项目或一个目标",
            )?;
            ensure(
                a.project_id.as_ref().is_none_or(|p| ids.contains(p)),
                "愿景引用了不存在的项目",
            )?;
            ensure(
                a.goal_id.as_ref().is_none_or(|g| goal_ids.contains(g)),
                "愿景引用了不存在的目标",
            )?;
        }
        let projects = ids;
        let mut tasks = HashSet::new();
        for t in &self.tasks {
            reminders::validate(t)?;
            ensure(
                !t.id.is_empty() && tasks.insert(&t.id),
                "任务 ID 重复或为空",
            )?;
            ensure(
                !t.title.trim().is_empty() && t.title.chars().count() <= 200,
                "任务名称需为 1–200 个字符",
            )?;
            ensure(
                t.notes.len() <= 50_000
                    && t.tags.len() <= 20
                    && t.tags.iter().all(|t| t.chars().count() <= 40),
                "备注或标签过长",
            )?;
            ensure(
                t.priority <= 3 && (1..=99).contains(&t.estimate),
                "无效的优先级或预计番茄数",
            )?;
            ensure(
                t.project_id.as_ref().is_none_or(|p| projects.contains(p)),
                "任务引用了不存在的项目",
            )?;
            ensure(
                t.goal_id.as_ref().is_none_or(|g| goal_ids.contains(g)),
                "任务引用了不存在的目标",
            )?;
            ensure(
                t.habit_id.as_ref().is_none_or(|h| habit_ids.contains(h)),
                "任务引用了不存在的习惯",
            )?;
            // Repeating and rolling over must never combine: the pair would pile
            // up every failed instance forever. Repetition belongs to habits,
            // which expire instead of rolling over.
            ensure(
                !(t.goal_id.is_some() && t.repeat != Repeat::None),
                "目标管辖的任务不能重复；重复的例行事项请建成习惯",
            )?;
            // Timed is a necessary condition for both jurisdictions.
            ensure(
                !(t.goal_id.is_some() && t.reminder_time.is_none()),
                "目标管辖的任务需要精确时间",
            )?;
            ensure(
                t.due_date.as_ref().is_none_or(|d| {
                    d.len() == 10 && NaiveDate::parse_from_str(d, "%Y-%m-%d").is_ok()
                }),
                "无效的任务日期",
            )?;
            let mut subs = HashSet::new();
            ensure(
                t.subtasks.len() <= 200
                    && t.subtasks.iter().all(|s| {
                        !s.id.is_empty()
                            && subs.insert(&s.id)
                            && !s.title.trim().is_empty()
                            && s.title.chars().count() <= 200
                    }),
                "无效的子任务",
            )?;
            ensure(
                t.completed == t.completed_at.is_some(),
                "任务完成状态与日期不一致",
            )?;
        }
        let t = &self.timer;
        ensure(
            (1..=10800).contains(&t.duration_secs)
                && t.remaining_secs <= t.duration_secs
                && t.running == t.deadline.is_some(),
            "计时器数据不正确",
        )?;
        ensure(
            t.task_id.as_ref().is_none_or(|id| tasks.contains(id)),
            "计时器任务不存在",
        )?;
        let mut sessions = HashSet::new();
        for s in &self.sessions {
            ensure(
                !s.id.is_empty()
                    && sessions.insert(&s.id)
                    && s.ended_at >= s.started_at
                    && (1..=10800).contains(&s.duration_secs)
                    && s.task_title.chars().count() <= 200
                    && s.project_name.chars().count() <= 40,
                "无效的专注记录",
            )?;
        }
        Ok(())
    }
    pub fn stats(&self, at: i64) -> Stats {
        let today = date_at(at);
        let current = NaiveDate::parse_from_str(&today, "%Y-%m-%d").expect("valid local date");
        let mut by_day: HashMap<String, (u64, u32)> = HashMap::new();
        for session in &self.sessions {
            let entry = by_day.entry(date_at(session.ended_at)).or_default();
            entry.0 += session.duration_secs as u64;
            entry.1 += u32::from(session.completed);
        }
        let mut missed_by_day: HashMap<&str, u32> = HashMap::new();
        for t in &self.tasks {
            if t.reminder_expired && t.is_habit() {
                if let Some(date) = t.due_date.as_deref() {
                    *missed_by_day.entry(date).or_default() += 1;
                }
            }
        }
        let days: Vec<DayStat> = (0..28)
            .rev()
            .map(|n| {
                let date = current.checked_sub_days(Days::new(n)).unwrap().to_string();
                let (seconds, pomodoros) = by_day.get(&date).copied().unwrap_or_default();
                let missed = missed_by_day
                    .get(date.as_str())
                    .copied()
                    .unwrap_or_default();
                DayStat {
                    date,
                    seconds,
                    pomodoros,
                    missed,
                }
            })
            .collect();
        let focused: HashSet<_> = by_day
            .iter()
            .filter(|(_, (_, count))| *count > 0)
            .map(|(day, _)| day.clone())
            .collect();
        let mut day = current;
        if !focused.contains(&today) {
            day = day.pred_opt().unwrap();
        }
        let mut streak = 0;
        while focused.contains(&day.to_string()) {
            streak += 1;
            day = day.pred_opt().unwrap();
        }
        let last = days.last().unwrap();
        Stats {
            today_seconds: last.seconds,
            today_pomodoros: last.pomodoros,
            today_completed: self
                .tasks
                .iter()
                .filter(|t| t.completed_at.is_some_and(|ts| date_at(ts) == today))
                .count(),
            total_seconds: self.sessions.iter().map(|s| s.duration_secs as u64).sum(),
            total_pomodoros: self.sessions.iter().filter(|s| s.completed).count(),
            streak,
            days,
        }
    }
}

pub struct Engine {
    conn: Connection,
    data: AppData,
}
impl Engine {
    /// Desktop-only recovery for a failed compositor connection; not an exposed Action.
    pub fn release_failed_protection(&mut self, at: i64) -> AppResult<()> {
        let mut next = self.data.clone();
        next.record(at, false);
        next.reset_to(Mode::Focus);
        next.lock.release(at);
        next.validate()?;
        self.persist(&next)?;
        self.data = next;
        Ok(())
    }
    pub fn open(path: impl AsRef<Path>) -> AppResult<Self> {
        let path = path.as_ref();
        if let Some(parent) = path.parent().filter(|p| !p.as_os_str().is_empty()) {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let conn = Connection::open(path).map_err(|e| e.to_string())?;
        conn.busy_timeout(std::time::Duration::from_secs(5))
            .map_err(|e| e.to_string())?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);").map_err(|e| e.to_string())?;
        let raw = conn.query_row("SELECT data FROM app_state WHERE id=1", [], |r| {
            r.get::<_, String>(0)
        });
        let data = match raw {
            Ok(raw) => serde_json::from_str::<AppData>(&raw)
                .map_err(|e| format!("数据读取失败，原文件已保留：{e}"))?,
            Err(rusqlite::Error::QueryReturnedNoRows) => AppData::default(),
            Err(e) => return Err(e.to_string()),
        };
        data.validate()?;
        let engine = Self { conn, data };
        engine.persist(&engine.data)?;
        Ok(engine)
    }
    fn persist(&self, data: &AppData) -> AppResult<()> {
        let raw = serde_json::to_string(data).map_err(|e| e.to_string())?;
        self.conn.execute("INSERT INTO app_state (id,data) VALUES (1,?1) ON CONFLICT(id) DO UPDATE SET data=excluded.data", params![raw]).map_err(|e| format!("保存失败：{e}"))?;
        Ok(())
    }
    pub fn dispatch(&mut self, action: Action, at: i64) -> AppResult<Snapshot> {
        let mut next = self.data.clone();
        next.apply(action, at)?;
        self.persist(&next)?;
        self.data = next;
        self.snapshot(at)
    }
    pub fn snapshot(&mut self, at: i64) -> AppResult<Snapshot> {
        let mut next = self.data.clone();
        if next.tick(at) {
            next.validate()?;
            self.persist(&next)?;
            self.data = next;
        }
        Ok(Snapshot {
            remaining_secs: self.data.timer.remaining(at),
            stats: self.data.stats(at),
            data: self.data.clone(),
            today: date_at(at),
            server_time: at,
        })
    }
    pub fn export(&mut self, at: i64) -> AppResult<String> {
        self.snapshot(at)?;
        serde_json::to_string_pretty(&self.data).map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests;
