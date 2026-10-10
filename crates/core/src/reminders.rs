//! Persist delivery state so polling and restarts cannot repeatedly steal focus.
use crate::{date_at, AppData, AppResult, Task};
use chrono::{Local, TimeZone};

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
        let time = Local
            .timestamp_opt(at, 0)
            .single()
            .unwrap()
            .format("%H:%M")
            .to_string();
        let mut changed = false;
        for t in &mut self.tasks {
            if (t.completed || t.due_date.as_deref() != Some(&date)) && t.reminder_pending {
                t.reminder_pending = false;
                changed = true;
            }
            if !t.completed
                && !t.reminder_fired
                && t.due_date.as_deref() == Some(&date)
                && t.reminder_time.as_ref().is_some_and(|r| r <= &time)
            {
                t.reminder_fired = true;
                t.reminder_pending = true;
                changed = true;
            }
        }
        changed
    }
}
