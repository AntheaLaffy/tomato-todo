//! Weekly routines materialize one ordinary task per scheduled day.
use crate::{date_at, AppData, AppResult, Habit, Task};
use chrono::{Datelike, Local, TimeZone};

fn time_is_valid(time: &str) -> bool {
    let bytes = time.as_bytes();
    bytes.len() == 5
        && bytes[2] == b':'
        && [bytes[0], bytes[1], bytes[3], bytes[4]]
            .iter()
            .all(u8::is_ascii_digit)
        && &time[..2] <= "23"
        && &time[3..] <= "59"
}

pub fn validate(habit: &Habit) -> AppResult<()> {
    if habit.name.trim().is_empty() || habit.name.chars().count() > 40 {
        return Err("习惯名称需为 1–40 个字符".into());
    }
    if habit.focus_minutes.is_some_and(|m| !(1..=180).contains(&m)) {
        return Err("习惯的单次时长需为 1–180 分钟".into());
    }
    if habit.slots.is_empty() || habit.slots.len() > 7 {
        return Err("习惯需要 1–7 个时段".into());
    }
    // A weekday may only appear once, so at most one slot applies per day.
    let mut seen = [false; 8];
    for slot in &habit.slots {
        if slot.days.is_empty() || slot.days.iter().any(|d| !(1..=7).contains(d)) {
            return Err("习惯的星期需为 1–7".into());
        }
        for day in &slot.days {
            if seen[*day as usize] {
                return Err("同一个星期不能出现在两个时段".into());
            }
            seen[*day as usize] = true;
        }
        if !time_is_valid(&slot.time) {
            return Err("习惯时间需为有效的 HH:MM".into());
        }
    }
    Ok(())
}

impl AppData {
    /// Create today's occurrence for each habit scheduled today, unless one is
    /// already there. Runs before reminders so the new task can fire — or, if
    /// its time already passed, be counted as a miss.
    pub(crate) fn materialize_habits(&mut self, at: i64) -> bool {
        let date = date_at(at);
        let weekday = Local
            .timestamp_opt(at, 0)
            .single()
            .unwrap()
            .weekday()
            .number_from_monday() as u8;
        let mut added = Vec::new();
        for habit in &self.habits {
            let Some(slot) = habit.slots.iter().find(|s| s.days.contains(&weekday)) else {
                continue;
            };
            let exists = self.tasks.iter().any(|t| {
                t.habit_id.as_deref() == Some(habit.id.as_str())
                    && t.due_date.as_deref() == Some(date.as_str())
            });
            if exists {
                continue;
            }
            added.push(Task {
                id: crate::id(),
                title: habit.name.clone(),
                notes: String::new(),
                project_id: habit.project_id.clone(),
                goal_id: None,
                habit_id: Some(habit.id.clone()),
                due_date: Some(date.clone()),
                reminder_time: Some(slot.time.clone()),
                focus_minutes: habit.focus_minutes,
                priority: 0,
                estimate: 1,
                reminder_fired: false,
                reminder_pending: false,
                reminder_expired: false,
                completed: false,
                completed_at: None,
                created_at: at,
                tags: vec![],
                subtasks: vec![],
                repeat: crate::Repeat::None,
                next_task_id: None,
            });
        }
        let changed = !added.is_empty();
        self.tasks.extend(added);
        changed
    }
}
