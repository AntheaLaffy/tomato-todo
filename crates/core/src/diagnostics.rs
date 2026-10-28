//! Explainable local signals. No model calls, missing-data guesses, or automatic verdicts.
use crate::{date_at, reminders, Snapshot};
use chrono::{Days, Local, NaiveDate, TimeZone, Timelike};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Anomaly {
    pub key: String,
    pub kind: String,
    pub title: String,
    pub severity: String,
    pub evidence: Value,
    pub question: String,
}
fn signal(
    key: String,
    kind: &str,
    title: &str,
    severity: &str,
    evidence: Value,
    question: &str,
) -> Anomaly {
    Anomaly {
        key,
        kind: kind.into(),
        title: title.into(),
        severity: severity.into(),
        evidence,
        question: question.into(),
    }
}
fn minute(time: &str) -> Option<i64> {
    let (h, m) = time.split_once(':')?;
    Some(h.parse::<i64>().ok()? * 60 + m.parse::<i64>().ok()?)
}
fn median(values: &mut [u64]) -> u64 {
    values.sort_unstable();
    values[values.len() / 2]
}
/// Capacity is an explicit user budget, otherwise a historical active-day baseline,
/// falling back to the configured daily goal. A baseline is evidence, not availability.
pub fn diagnose(snapshot: &Snapshot, capacity_minutes: Option<u32>) -> Vec<Anomaly> {
    let data = &snapshot.data;
    let at = snapshot.server_time;
    let today = NaiveDate::parse_from_str(&snapshot.today, "%Y-%m-%d").expect("snapshot date");
    let week_start = today.checked_sub_days(Days::new(7)).unwrap().to_string();
    let month_start = today.checked_sub_days(Days::new(28)).unwrap().to_string();
    let mut by_day = HashMap::<String, u64>::new();
    for s in &data.sessions {
        let date = date_at(s.ended_at);
        if date >= month_start && date < snapshot.today {
            *by_day.entry(date).or_default() += u64::from(s.duration_secs) / 60;
        }
    }
    let mut active_minutes: Vec<_> = by_day.values().copied().filter(|m| *m >= 20).collect();
    let historical = (active_minutes.len() >= 5).then(|| median(&mut active_minutes));
    let (capacity, capacity_source) = if let Some(m) = capacity_minutes {
        (u64::from(m), "用户设置的日预算")
    } else if let Some(m) = historical {
        (m.max(30), "近28天至少5个活跃日的中位数（并非可用时间）")
    } else {
        (
            u64::from(data.settings.daily_goal * data.settings.focus_minutes),
            "每日番茄目标预算（并非可用时间）",
        )
    };
    let mut completed_rounds = HashMap::<&str, u32>::new();
    for s in data.sessions.iter().filter(|s| s.completed) {
        if let Some(id) = s.task_id.as_deref() {
            *completed_rounds.entry(id).or_default() += 1;
        }
    }
    let mut result = vec![];
    for offset in 0..3 {
        let date = today
            .checked_add_days(Days::new(offset))
            .unwrap()
            .to_string();
        let tasks: Vec<_> = data
            .tasks
            .iter()
            .filter(|t| {
                t.due_date.as_deref() == Some(&date) && !t.completed && !data.task_is_void(t, at)
            })
            .collect();
        let minutes: u64 = tasks
            .iter()
            .map(|t| {
                u64::from(
                    t.estimate
                        .saturating_sub(*completed_rounds.get(t.id.as_str()).unwrap_or(&0)),
                ) * u64::from(t.focus_minutes.unwrap_or(data.settings.focus_minutes))
            })
            .sum();
        let day = NaiveDate::parse_from_str(&date, "%Y-%m-%d").ok();
        let blocked_minutes = crate::blocks::required_minutes(&data.blocks, &date);
        if capacity > 0 && minutes * 100 > capacity * 130 {
            result.push(signal(format!("overload/{date}"), "overload", "计划用时高于当前预算", "warning",
                json!({"date":date,"remainingPlannedMinutes":minutes,"budgetMinutes":capacity,"budgetSource":capacity_source,"blockedMinutes":blocked_minutes,"taskIds":tasks.iter().take(30).map(|t| &t.id).collect::<Vec<_>>() }),
                "这些任务的预计用时是否准确？这一天有额外可用时间，还是需要减量或挪动？"));
        }
        if offset == 1 && historical.is_some() && !tasks.is_empty() && minutes * 100 < capacity * 30
        {
            result.push(signal(format!("underload/{date}"), "underload", "明日安排明显低于近期投入", "notice",
                json!({"date":date,"plannedMinutes":minutes,"baselineMinutes":capacity,"baselineSource":capacity_source,"blockedMinutes":blocked_minutes}),
                "明天是有意休息、课程占用，还是计划尚未补齐？不要仅凭空闲推断应该加任务。"));
        }
        let mut timed: Vec<_> = tasks
            .iter()
            .filter_map(|t| Some((minute(t.reminder_time.as_deref()?)?, *t)))
            .collect();
        timed.sort_by_key(|(start, t)| (*start, &t.id));
        // A band that demands attention makes a scheduled block a real conflict;
        // a "水课" band is exactly the place parallel work belongs, so it stays quiet.
        if let Some(day) = day {
            let required: Vec<_> = crate::blocks::on_date(&data.blocks, &date)
                .into_iter()
                .filter(|b| b.attention == crate::blocks::Attention::Required)
                .collect();
            for (start, task) in &timed {
                let end = (*start + reminders::window_minutes(task, &data.settings)) as u32;
                for band in &required {
                    let overlap = band.overlap_minutes(day, *start as u32, end);
                    if overlap > 0 {
                        result.push(signal(format!("block/{date}/{}/{}",task.id,band.id), "blockConflict", "计划时段落在需专心的课程内", "warning",
                            json!({"date":date,"taskId":task.id,"taskTitle":task.title,"blockId":band.id,"blockTitle":band.title,"blockStart":band.start,"blockEnd":band.end,"overlapMinutes":overlap}),
                            "这段安排和要专心听的课重叠：能挪到水课时段或课后吗？如果确实要课上做，说明后我不会再把它当冲突。"));
                    }
                }
            }
        }
        // Track the interval reaching furthest right; adjacent-only comparison misses
        // a long lecture overlapping several short assignments.
        let mut previous: Option<(i64, &crate::Task)> = None;
        for (start, task) in timed {
            let end = start + reminders::window_minutes(task, &data.settings);
            if let Some((previous_end, other)) = previous {
                if start < previous_end {
                    let mut ids = [other.id.as_str(), task.id.as_str()];
                    ids.sort();
                    // Naming the class turns "两个计划时段重叠" into a fact the user can
                    // confirm instead of a guess about why parallel work was planned.
                    let band = day.and_then(|day| {
                        data.blocks.iter().find(|b| {
                            b.attention == crate::blocks::Attention::Light
                                && b.overlap_minutes(
                                    day,
                                    start as u32,
                                    previous_end.min(end) as u32,
                                ) > 0
                        })
                    });
                    result.push(signal(format!("collision/{date}/{}/{}",ids[0],ids[1]), "collision", "两个计划时段重叠", "warning",
                        json!({"date":date,"taskIds":ids,"titles":[other.title,task.title],"overlapMinutes":previous_end.min(end)-start,"includesBreaks":true,"blockTitle":band.map(|b| b.title.clone())}),
                        "这两个安排能否同时完成？如果是在同一课程内做作业，请说明，避免把允许的并行误判为冲突。"));
                }
                if end <= previous_end {
                    continue;
                }
            }
            previous = Some((end, task));
        }
    }
    let mut habits = HashMap::<String, (u32, u32, Vec<&str>)>::new();
    for t in data.tasks.iter().filter(|t| {
        t.is_habit()
            && t.due_date
                .as_deref()
                .is_some_and(|d| d >= week_start.as_str() && d < snapshot.today.as_str())
    }) {
        let key = t
            .habit_id
            .as_ref()
            .or(t.template_id.as_ref())
            .unwrap_or(&t.id)
            .clone();
        let entry = habits.entry(key).or_default();
        entry.0 += 1;
        if !t.completed && t.reminder_expired {
            entry.1 += 1;
            entry.2.push(&t.id);
        }
    }
    for (id, (scheduled, missed, ids)) in habits {
        if scheduled >= 4 && missed >= 3 && missed * 100 >= scheduled * 50 {
            result.push(signal(format!("habit/{id}"), "habitAbsence", "近一周习惯多次未完成", "warning",
                json!({"habitId":id,"observedOccurrences":scheduled,"missedOccurrences":missed,"windowStart":week_start,"windowEnd":snapshot.today,"taskIds":ids}),
                "是时间安排不合适、任务太难、外部占用，还是已经不想继续这个习惯？先确认原因再改计划。"));
        }
    }
    let recent_sessions: Vec<_> = data
        .sessions
        .iter()
        .filter(|s| s.source == crate::SessionSource::Timer && s.ended_at >= at - 7 * 86400)
        .collect();
    let late: Vec<_> = recent_sessions
        .iter()
        .filter(|s| {
            let hour = Local
                .timestamp_opt(s.ended_at, 0)
                .single()
                .map(|t| t.hour())
                .unwrap_or(12);
            !(6..23).contains(&hour)
        })
        .collect();
    let distinct_late: std::collections::HashSet<_> =
        late.iter().map(|s| date_at(s.ended_at)).collect();
    if distinct_late.len() >= 3 {
        result.push(signal("rhythm/late".into(), "rhythmDrift", "近一周多天有深夜专注记录", "notice",
            json!({"lateDates":distinct_late,"lateSessionCount":late.len(),"window":"23:00–06:00 本机时间","sampleSessions":recent_sessions.len()}),
            "这是临时安排还是符合你的作息？结合你确认的睡眠和课程信息判断，不以统一作息评价用户。"));
    }
    let recent_days = by_day
        .iter()
        .filter(|(d, _)| d.as_str() >= week_start.as_str())
        .count();
    if let Some(baseline) = historical.filter(|_| recent_days >= 3) {
        let recent: Vec<_> = by_day
            .iter()
            .filter(|(d, _)| d.as_str() >= week_start.as_str())
            .map(|(_, m)| *m)
            .collect();
        if recent.iter().sum::<u64>() * 100 < baseline * recent.len() as u64 * 40 {
            result.push(signal("engagement/drop".into(), "engagementDrop", "近期记录的投入明显下降", "notice",
                json!({"recentActiveDays":recent.len(),"recentMeanMinutes":recent.iter().sum::<u64>()/recent.len() as u64,"baselineMinutes":historical}),
                "是否有考试、课程、身体状态或线下学习变化？先补全记录背景，再决定是否调整节奏。"));
        }
    }
    result.sort_by(|a, b| a.key.cmp(&b.key));
    result.truncate(30);
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Action, Engine};
    fn test_engine() -> Engine {
        Engine::open(":memory:").unwrap()
    }
    fn monday() -> i64 {
        Local
            .with_ymd_and_hms(2026, 10, 12, 8, 0, 0)
            .unwrap()
            .timestamp()
    }
    fn task(e: &mut Engine, title: &str, time: &str, minutes: u32) {
        let action: Action = serde_json::from_value(json!({"type":"saveTask","task":{"id":null,"title":title,"dueDate":"2026-10-12","reminderTime":time,"focusMinutes":minutes,"estimate":1}})).unwrap();
        e.dispatch(action, monday()).unwrap();
    }
    fn block(e: &mut Engine, start: &str, end: &str, attention: &str) {
        let action: Action = serde_json::from_value(json!({"type":"saveBlock","title":"大学英语Ⅰ","days":[1],"start":start,"end":end,"attention":attention})).unwrap();
        e.dispatch(action, monday()).unwrap();
    }
    #[test]
    fn required_block_turns_an_overlap_into_a_real_conflict() {
        let mut e = test_engine();
        block(&mut e, "09:55", "11:20", "required");
        task(&mut e, "英语作业", "10:00", 25);
        let signals = diagnose(&e.snapshot(monday()).unwrap(), Some(300));
        let conflicts: Vec<_> = signals
            .iter()
            .filter(|s| s.kind == "blockConflict")
            .collect();
        assert_eq!(conflicts.len(), 1);
        assert_eq!(conflicts[0].evidence["blockTitle"], "大学英语Ⅰ");
        assert_eq!(conflicts[0].evidence["overlapMinutes"], 25);
    }
    #[test]
    fn light_block_is_the_place_parallel_work_belongs() {
        let mut e = test_engine();
        block(&mut e, "09:55", "11:20", "light");
        task(&mut e, "英语作业", "10:00", 25);
        let signals = diagnose(&e.snapshot(monday()).unwrap(), Some(300));
        assert!(!signals.iter().any(|s| s.kind == "blockConflict"));
    }
    #[test]
    fn empty_data_is_quiet_and_conflicts_include_rest_gaps() {
        let mut e = test_engine();
        assert!(diagnose(&e.snapshot(monday()).unwrap(), None).is_empty());
        task(&mut e, "lecture", "09:00", 90);
        task(&mut e, "work", "09:30", 25);
        task(&mut e, "later", "10:00", 25);
        let signals = diagnose(&e.snapshot(monday()).unwrap(), Some(60));
        assert_eq!(signals.iter().filter(|s| s.kind == "collision").count(), 2);
        assert!(signals.iter().any(|s| s.kind == "overload"));
    }
    #[test]
    fn touching_blocks_and_completed_work_do_not_trigger_conflict() {
        let mut e = test_engine();
        task(&mut e, "one", "09:00", 25);
        task(&mut e, "two", "09:25", 25);
        assert!(diagnose(&e.snapshot(monday()).unwrap(), Some(100)).is_empty());
    }
    #[test]
    fn no_history_does_not_mean_underload_or_dormancy() {
        let mut e = test_engine();
        task(&mut e, "small", "10:00", 5);
        assert!(!diagnose(&e.snapshot(monday()).unwrap(), Some(100))
            .iter()
            .any(|s| s.kind == "underload"));
    }
}
