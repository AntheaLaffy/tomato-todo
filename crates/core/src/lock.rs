//! Local recurring lock windows use the weekday on which the interval starts.
use crate::AppResult;
use chrono::{Datelike, Days, Local, NaiveTime, TimeZone};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LockSchedule {
    pub id: String,
    pub name: String,
    pub start: String,
    pub end: String,
    pub days: Vec<u32>,
    pub enabled: bool,
    #[serde(default)]
    pub strict: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveLock {
    pub name: String,
    pub started_at: i64,
    pub ends_at: i64,
    pub strict: bool,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LockState {
    #[serde(default)]
    pub schedules: Vec<LockSchedule>,
    #[serde(default)]
    pub active: Option<ActiveLock>,
    #[serde(default)]
    pub suppressed_until: i64,
}

fn parse_time(s: &str) -> Option<NaiveTime> {
    if s.len() != 5 || s.as_bytes()[2] != b':' {
        return None;
    }
    NaiveTime::parse_from_str(s, "%H:%M").ok()
}

impl LockState {
    pub fn validate(&self) -> AppResult<()> {
        if self.schedules.len() > 20 {
            return Err("最多设置 20 个锁机时段".into());
        }
        let mut ids = HashSet::new();
        let mut occupied = vec![false; 7 * 1440];
        for s in &self.schedules {
            if s.id.is_empty()
                || !ids.insert(&s.id)
                || s.name.trim().is_empty()
                || s.name.chars().count() > 40
            {
                return Err("锁机名称需为 1–40 字符，ID 需唯一且非空".into());
            }
            if parse_time(&s.start).is_none() || parse_time(&s.end).is_none() || s.start == s.end {
                return Err("锁机时间需为有效 HH:MM，开始与结束不能相同".into());
            }
            let unique: HashSet<_> = s.days.iter().collect();
            if s.days.is_empty()
                || s.days.len() > 7
                || unique.len() != s.days.len()
                || s.days.iter().any(|d| !(1..=7).contains(d))
            {
                return Err("请选择不重复的星期（周一为 1，周日为 7）".into());
            }
            if s.enabled {
                use chrono::Timelike;
                let start = parse_time(&s.start).unwrap().num_seconds_from_midnight() / 60;
                let end = parse_time(&s.end).unwrap().num_seconds_from_midnight() / 60;
                let duration = (end + 1440 - start) % 1440;
                for day in &s.days {
                    for offset in 0..duration {
                        let minute = (((day - 1) * 1440 + start + offset) % (7 * 1440)) as usize;
                        if occupied[minute] {
                            return Err("启用的锁机时段不能重叠，请调整日期或时间".into());
                        }
                        occupied[minute] = true;
                    }
                }
            }
        }
        if let Some(a) = &self.active {
            if a.name.trim().is_empty()
                || a.name.chars().count() > 40
                || a.ends_at <= a.started_at
                || a.ends_at.saturating_sub(a.started_at) > 8 * 86400
            {
                return Err("无效的锁机状态".into());
            }
        }
        Ok(())
    }

    pub fn scheduled_at(&self, at: i64) -> Option<ActiveLock> {
        if at < self.suppressed_until {
            return None;
        }
        let today = Local.timestamp_opt(at, 0).single()?.date_naive();
        let mut result: Option<ActiveLock> = None;
        for date in [today.pred_opt()?, today] {
            for s in self
                .schedules
                .iter()
                .filter(|s| s.enabled && s.days.contains(&date.weekday().number_from_monday()))
            {
                let start_time = parse_time(&s.start)?;
                let end_time = parse_time(&s.end)?;
                let end_date = if end_time <= start_time {
                    date.checked_add_days(Days::new(1))?
                } else {
                    date
                };
                let Some(start) = Local
                    .from_local_datetime(&date.and_time(start_time))
                    .earliest()
                else {
                    continue;
                };
                let Some(end) = Local
                    .from_local_datetime(&end_date.and_time(end_time))
                    .latest()
                else {
                    continue;
                };
                if at >= start.timestamp() && at < end.timestamp() {
                    if let Some(a) = &mut result {
                        a.started_at = a.started_at.min(start.timestamp());
                        a.ends_at = a.ends_at.max(end.timestamp());
                        a.strict |= s.strict;
                    } else {
                        result = Some(ActiveLock {
                            name: s.name.clone(),
                            started_at: start.timestamp(),
                            ends_at: end.timestamp(),
                            strict: s.strict,
                        });
                    }
                }
            }
        }
        result
    }

    pub fn release(&mut self, at: i64) {
        // Ending a quick break must not suppress an unrelated future sleep schedule.
        if let Some(scheduled) = self.scheduled_at(at) {
            self.suppressed_until = self.suppressed_until.max(scheduled.ends_at);
        }
        self.active = None;
    }
}
