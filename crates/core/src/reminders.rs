//! Persist delivery state so polling and restarts cannot repeatedly steal focus.
use crate::{date_at, AppData, AppResult, Task};
use chrono::{Local, TimeZone, Timelike};

pub fn validate(task: &Task) -> AppResult<()> {
    if task.focus_minutes.is_some_and(|m| !(1..=180).contains(&m)) {
        return Err("单次专注时长需为1—180分钟".into());
    }
    if let Some(time) = &task.reminder_time {
        let bytes = time.as_bytes();
        if task.due_date.is_none()
            || bytes.len() != 5
            || bytes[2] != b':'
            || ![bytes[0], bytes[1], bytes[3], bytes[4]]
                .iter()
                .all(u8::is_ascii_digit)
            || &time[..2] > "23"
            || &time[3..] > "59"
        {
            return Err("提醒需要计划日期和有效的 HH:MM 时间".into());
        }
    }
    Ok(())
}
fn minutes_of(time: &str) -> Option<i64> {
    let bytes = time.as_bytes();
    if bytes.len() != 5 || bytes[2] != b':' {
        return None;
    }
    Some(i64::from(
        time[..2].parse::<u32>().ok()? * 60 + time[3..].parse::<u32>().ok()?,
    ))
}

/// Length of the scheduled block: every focus session plus the breaks between
/// them, so a multi-pomodoro task stays valid across its rest gaps.
fn window_minutes(task: &Task, settings: &crate::Settings) -> i64 {
    let focus = i64::from(task.focus_minutes.unwrap_or(settings.focus_minutes));
    let sessions = i64::from(task.estimate.max(1));
    let every = i64::from(settings.long_break_every.max(1));
    let breaks: i64 = (1..sessions)
        .map(|i| {
            if i % every == 0 {
                i64::from(settings.long_break_minutes)
            } else {
                i64::from(settings.short_break_minutes)
            }
        })
        .sum();
    sessions * focus + breaks
}

impl AppData {
    pub fn reminder_idle(&self) -> bool {
        !self.timer.running
            && self.timer.started_at.is_none()
            && self.timer.remaining_secs == self.timer.duration_secs
            && self.lock.active.is_none()
    }
    pub fn pending_reminder(&self) -> Option<&Task> {
        if !self.reminder_idle() {
            return None;
        }
        self.tasks
            .iter()
            .filter(|t| !t.completed && t.reminder_pending)
            .min_by_key(|t| (&t.due_date, &t.reminder_time, &t.id))
    }
    pub(crate) fn tick_reminders(&mut self, at: i64) -> bool {
        let date = date_at(at);
        let now = Local.timestamp_opt(at, 0).single().unwrap();
        let now_minutes = i64::from(now.hour() * 60 + now.minute());
        let settings = &self.settings;
        let mut changed = false;
        for t in &mut self.tasks {
            let today = t.due_date.as_deref() == Some(&date);
            // Past its whole planned block, an unstarted reminder is void: it
            // no longer fires or pulls the window back today.
            let expired = today
                && t.reminder_time
                    .as_deref()
                    .and_then(minutes_of)
                    .is_some_and(|start| now_minutes > start + window_minutes(t, settings));
            if (t.completed || !today || expired) && t.reminder_pending {
                t.reminder_pending = false;
                changed = true;
            }
            if expired && !t.reminder_fired {
                t.reminder_fired = true;
                changed = true;
            }
            if !t.completed
                && !t.reminder_fired
                && today
                && !expired
                && t.reminder_time
                    .as_deref()
                    .and_then(minutes_of)
                    .is_some_and(|start| start <= now_minutes)
            {
                t.reminder_fired = true;
                t.reminder_pending = true;
                changed = true;
            }
        }
        changed
    }
}
