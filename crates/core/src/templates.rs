//! Shapes are copied at printing time. A durable ledger survives instance deletion.
use crate::{AppData, AppResult, Repeat, Task};
use chrono::{Datelike, Days, Local, NaiveDate, TimeZone, Timelike};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashSet};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TemplateSubtask {
    pub id: String,
    pub title: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Shape {
    pub title: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub goal_id: Option<String>,
    #[serde(default)]
    pub habit_id: Option<String>,
    #[serde(default)]
    pub focus_minutes: Option<u32>,
    #[serde(default)]
    pub scrap_minutes: u32,
    #[serde(default)]
    pub priority: u8,
    #[serde(default = "crate::default_estimate")]
    pub estimate: u32,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub subtasks: Vec<TemplateSubtask>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PrintSlot {
    pub days: Vec<u8>,
    pub time: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CalendarSlot {
    pub dates: Vec<String>,
    pub time: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Printing {
    Once {
        date: Option<String>,
        time: Option<String>,
    },
    Calendar {
        slots: Vec<CalendarSlot>,
    },
    Weekly {
        slots: Vec<PrintSlot>,
    },
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Template {
    pub id: String,
    pub shape: Shape,
    pub printing: Printing,
    #[serde(default)]
    pub automatic: bool,
    #[serde(default = "default_ahead_days")]
    pub print_ahead_days: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PrintRecord {
    pub template_id: String,
    /// None identifies an undated one-off printing.
    pub date: Option<String>,
}

fn default_ahead_days() -> u32 {
    7
}

fn valid_date(date: &str) -> bool {
    date.len() == 10 && NaiveDate::parse_from_str(date, "%Y-%m-%d").is_ok()
}
fn valid_time(time: &str) -> bool {
    let b = time.as_bytes();
    b.len() == 5
        && b[2] == b':'
        && [b[0], b[1], b[3], b[4]].iter().all(u8::is_ascii_digit)
        && &time[..2] <= "23"
        && &time[3..] <= "59"
}
impl Template {
    pub fn recurring(&self) -> bool {
        matches!(self.printing, Printing::Weekly { .. })
    }
    fn times(&self, date: &Option<String>) -> AppResult<Vec<Option<String>>> {
        if date.as_ref().is_some_and(|d| !valid_date(d)) {
            return Err("无效的印刷日期".into());
        }
        match &self.printing {
            Printing::Once {
                date: planned,
                time,
            } => {
                let _ = planned;
                if time.is_some() && date.is_none() {
                    return Err("定时实例需要日期".into());
                }
                Ok(vec![time.clone()])
            }
            Printing::Calendar { slots } => {
                let times: Vec<_> = slots
                    .iter()
                    .filter(|s| date.as_ref().is_some_and(|d| s.dates.contains(d)))
                    .map(|e| e.time.clone())
                    .collect();
                if times.is_empty() {
                    return Err("该日期不在日程表中".into());
                }
                Ok(times)
            }
            Printing::Weekly { slots } => {
                let day = date.as_ref().ok_or("周期印刷需要日期")?;
                let weekday = NaiveDate::parse_from_str(day, "%Y-%m-%d")
                    .map_err(|e| e.to_string())?
                    .weekday()
                    .number_from_monday() as u8;
                let times: Vec<_> = slots
                    .iter()
                    .filter(|s| s.days.contains(&weekday))
                    .map(|s| s.time.clone())
                    .collect();
                if times.is_empty() {
                    return Err("该日期不在本周安排中".into());
                }
                Ok(times)
            }
        }
    }
    pub(crate) fn instance(&self, date: Option<String>, time: Option<String>, at: i64) -> Task {
        let mut task = Task {
            id: crate::id(),
            node_id: None,
            template_id: Some(self.id.clone()),
            recurring: self.recurring(),
            title: String::new(),
            notes: String::new(),
            project_id: None,
            goal_id: None,
            habit_id: None,
            due_date: date,
            reminder_time: time,
            focus_minutes: None,
            scrap_minutes: 0,
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
        };
        self.copy_shape(&mut task);
        task
    }
    fn copy_shape(&self, task: &mut Task) {
        let s = &self.shape;
        task.title = s.title.clone();
        task.notes = s.notes.clone();
        task.project_id = s.project_id.clone();
        task.goal_id = s.goal_id.clone();
        task.habit_id = s.habit_id.clone();
        task.focus_minutes = s.focus_minutes;
        task.scrap_minutes = if task.is_habit() || task.goal_id.is_some() {
            0
        } else {
            s.scrap_minutes
        };
        task.priority = s.priority;
        task.estimate = s.estimate;
        task.tags = s.tags.clone();
        // Retain completion of matching steps when explicitly syncing an instance.
        task.subtasks = s
            .subtasks
            .iter()
            .map(|sub| crate::Subtask {
                id: sub.id.clone(),
                title: sub.title.clone(),
                done: task.subtasks.iter().any(|old| old.id == sub.id && old.done),
            })
            .collect();
    }
}

pub fn validate(data: &AppData) -> AppResult<()> {
    if data.templates.len() > 5000 || data.prints.len() > 200_000 {
        return Err("模板或印刷记录超出限制".into());
    }
    let mut ids = HashSet::new();
    for t in &data.templates {
        if t.id.is_empty() || !ids.insert(&t.id) {
            return Err("模板 ID 重复或为空".into());
        }
        let s = &t.shape;
        if t.print_ahead_days > 90 {
            return Err("预印天数需为 0–90 天".into());
        }
        if s.title.trim().is_empty()
            || s.title.chars().count() > 200
            || s.notes.len() > 50_000
            || s.priority > 3
            || !(1..=99).contains(&s.estimate)
            || s.scrap_minutes > 10_080
            || s.focus_minutes.is_some_and(|m| !(1..=180).contains(&m))
            || s.tags.len() > 20
            || s.tags.iter().any(|tag| tag.chars().count() > 40)
        {
            return Err("无效的模板形状".into());
        }
        let mut subs = HashSet::new();
        if s.subtasks.len() > 200
            || s.subtasks.iter().any(|sub| {
                sub.id.is_empty()
                    || !subs.insert(&sub.id)
                    || sub.title.trim().is_empty()
                    || sub.title.chars().count() > 200
            })
        {
            return Err("无效的模板子任务".into());
        }
        if s.project_id
            .as_ref()
            .is_some_and(|id| !data.projects.iter().any(|p| &p.id == id))
            || s.goal_id
                .as_ref()
                .is_some_and(|id| !data.goals.iter().any(|g| &g.id == id))
            || s.habit_id
                .as_ref()
                .is_some_and(|id| !data.habits.iter().any(|h| &h.id == id))
        {
            return Err("模板引用了不存在的容器".into());
        }
        if s.goal_id.is_some() && s.habit_id.is_some() {
            return Err("目标与习惯组不能同时管辖模板".into());
        }
        match &t.printing {
            Printing::Once { date, time } => {
                if date.as_ref().is_some_and(|d| !valid_date(d))
                    || time.as_ref().is_some_and(|time| !valid_time(time))
                {
                    return Err("无效的一次印刷日期或时间".into());
                }
                if t.automatic && date.is_none() {
                    return Err("自动一次印刷需要指定日期".into());
                }
                if s.habit_id.is_some() {
                    return Err("习惯模板必须重复印刷".into());
                }
            }
            Printing::Calendar { slots } => {
                if slots.is_empty() || slots.len() > 49 || s.habit_id.is_some() {
                    return Err("非重复日程需要 1–49 个时段，不能属于习惯组".into());
                }
                let mut seen = HashSet::new();
                let mut times = HashSet::new();
                for slot in slots {
                    if slot.dates.is_empty()
                        || slot.dates.len() > 366
                        || slot.time.as_ref().is_some_and(|time| !valid_time(time))
                        || !times.insert(&slot.time)
                        || slot
                            .dates
                            .iter()
                            .any(|date| !valid_date(date) || !seen.insert((date, &slot.time)))
                    {
                        return Err("无效或重复的日程时段，请把同一开始时间的日期合并".into());
                    }
                }
                if seen.len() > 366 {
                    return Err("一次日程表最多 366 项".into());
                }
            }
            Printing::Weekly { slots } => {
                if slots.is_empty() || slots.len() > 49 {
                    return Err("每周循环需要 1–49 个时段".into());
                }
                let mut seen = HashSet::new();
                for slot in slots {
                    let unique: HashSet<_> = slot.days.iter().collect();
                    if slot.days.is_empty()
                        || slot.days.len() > 7
                        || unique.len() != slot.days.len()
                        || slot.days.iter().any(|d| !(1..=7).contains(d))
                        || slot.time.as_ref().is_some_and(|time| !valid_time(time))
                        || (s.habit_id.is_some() && slot.time.is_none())
                        || slot.days.iter().any(|day| !seen.insert((day, &slot.time)))
                    {
                        return Err("无效或重复的周期时段".into());
                    }
                }
                if slots.iter().any(|s| s.time.is_some()) && slots.iter().any(|s| s.time.is_none())
                {
                    return Err("一个周期不能混用定时与不定时单元".into());
                }
            }
        }
    }
    let mut prints = HashSet::new();
    for p in &data.prints {
        if !ids.contains(&p.template_id)
            || p.date.as_ref().is_some_and(|d| !valid_date(d))
            || !prints.insert((&p.template_id, &p.date))
        {
            return Err("无效或重复的印刷记录".into());
        }
    }
    if data
        .tasks
        .iter()
        .any(|t| t.template_id.as_ref().is_some_and(|id| !ids.contains(id)))
    {
        return Err("实例引用了不存在的模板".into());
    }
    Ok(())
}

impl AppData {
    pub(crate) fn print_instances(
        &mut self,
        shape: Shape,
        printing: Printing,
        at: i64,
    ) -> AppResult<()> {
        if matches!(printing, Printing::Weekly { .. }) {
            return Err("循环规则需要保留为模板".into());
        }
        let dates: Vec<_> = match &printing {
            Printing::Once { date, .. } => vec![date.clone()],
            Printing::Calendar { slots } => slots
                .iter()
                .flat_map(|s| s.dates.iter().cloned().map(Some))
                .collect::<BTreeSet<_>>()
                .into_iter()
                .collect(),
            Printing::Weekly { .. } => unreachable!(),
        };
        let id = crate::id();
        self.templates.push(Template {
            id: id.clone(),
            shape,
            printing,
            automatic: false,
            print_ahead_days: 0,
        });
        self.validate()?;
        self.print_template(&id, &dates, at)?;
        self.delete_template(&id);
        Ok(())
    }

    pub(crate) fn save_template(&mut self, mut template: Template) -> AppResult<()> {
        template.shape.title = template.shape.title.trim().into();
        if template.shape.habit_id.is_none()
            && template.shape.goal_id.is_none()
            && matches!(&template.printing, Printing::Weekly { slots } if slots.iter().all(|s| s.time.is_some()))
        {
            let existing_habit = self
                .templates
                .iter()
                .find(|t| t.id == template.id)
                .and_then(|t| t.shape.habit_id.clone());
            let hid = existing_habit.unwrap_or_else(crate::id);
            if !self.habits.iter().any(|h| h.id == hid) {
                self.habits.push(crate::Habit {
                    id: hid.clone(),
                    name: template.shape.title.chars().take(40).collect(),
                });
            }
            template.shape.habit_id = Some(hid);
        }
        if let Some(i) = self.templates.iter().position(|t| t.id == template.id) {
            self.templates[i] = template;
        } else {
            self.templates.push(template);
        }
        Ok(())
    }
    pub(crate) fn delete_template(&mut self, id: &str) {
        self.templates.retain(|t| t.id != id);
        self.prints.retain(|p| p.template_id != id);
        for task in &mut self.tasks {
            if task.template_id.as_deref() == Some(id) {
                task.template_id = None;
            }
        }
    }
    pub(crate) fn print_template(
        &mut self,
        id: &str,
        dates: &[Option<String>],
        at: i64,
    ) -> AppResult<()> {
        if dates.is_empty() || dates.len() > 366 {
            return Err("每次印刷需要 1–366 个日期".into());
        }
        let template = self
            .templates
            .iter()
            .find(|t| t.id == id)
            .ok_or("模板不存在")?
            .clone();
        let dates = if let Printing::Weekly { slots } = &template.printing {
            let days: BTreeSet<_> = slots.iter().flat_map(|s| s.days.iter()).collect();
            let mut expanded = BTreeSet::new();
            for date in dates {
                let date = date.as_ref().ok_or("周期印刷需要日期")?;
                if !valid_date(date) {
                    return Err("无效的周期日期".into());
                }
                let date =
                    NaiveDate::parse_from_str(date, "%Y-%m-%d").map_err(|e| e.to_string())?;
                let monday = week_start(date);
                for day in &days {
                    let date = monday
                        .checked_add_days(Days::new(u64::from(**day - 1)))
                        .ok_or("日期超出范围")?;
                    expanded.insert(Some(date.to_string()));
                }
            }
            if expanded.len() > 366 {
                return Err("一次印刷范围过大，请拆分周期".into());
            }
            expanded.into_iter().collect::<Vec<_>>()
        } else {
            dates.to_vec()
        };
        // Resolve a complete cycle/calendar batch before mutating state.
        let batches: Vec<_> = dates
            .iter()
            .map(|date| template.times(date).map(|times| (date.clone(), times)))
            .collect::<AppResult<_>>()?;
        let mut printed_dates: HashSet<_> = self
            .prints
            .iter()
            .filter(|p| p.template_id == id)
            .map(|p| p.date.clone())
            .collect();
        for (date, times) in batches {
            if printed_dates.contains(&date) {
                continue;
            }
            let mut printed = false;
            for time in times {
                let task = template.instance(date.clone(), time, at);
                if self.printing_expired(&task, at) {
                    continue;
                }
                self.tasks.push(task);
                printed = true;
            }
            // A daily batch is final even when some earlier slots were already
            // spent: edits/deletion must not silently refill that day's history.
            if printed {
                printed_dates.insert(date.clone());
                self.prints.push(PrintRecord {
                    template_id: id.into(),
                    date,
                });
            }
        }
        Ok(())
    }
    fn printing_expired(&self, task: &Task, at: i64) -> bool {
        if task.goal_id.is_some() {
            return false;
        }
        let Some(time) = task.reminder_time.as_ref() else {
            return false;
        };
        let Some(date) = task.due_date.as_ref() else {
            return false;
        };
        let today = crate::date_at(at);
        if date < &today {
            return true;
        }
        if date > &today {
            return false;
        }
        let now = Local.timestamp_opt(at, 0).single().unwrap();
        let start = time[..2].parse::<i64>().unwrap() * 60 + time[3..].parse::<i64>().unwrap();
        let grace = if task.is_habit() {
            0
        } else {
            task.scrap_minutes
        };
        let end = start + crate::reminders::window_minutes(task, &self.settings) + i64::from(grace);
        i64::from(now.hour() * 3600 + now.minute() * 60 + now.second()) >= end * 60
    }
    pub(crate) fn sync_template(&mut self, id: &str) -> AppResult<()> {
        let template = self
            .templates
            .iter()
            .find(|t| t.id == id)
            .ok_or("模板不存在")?
            .clone();
        let void_ids: HashSet<_> = self
            .tasks
            .iter()
            .filter(|t| self.task_is_void(t, 0))
            .map(|t| t.id.clone())
            .collect();
        for task in &mut self.tasks {
            if !void_ids.contains(&task.id)
                && !task.completed
                && task.template_id.as_deref() == Some(id)
            {
                // Sync only shape, never schedule, jurisdiction or execution history.
                let mut shape = template.clone();
                shape.shape.goal_id = task.goal_id.clone();
                shape.shape.habit_id = task.habit_id.clone();
                shape.copy_shape(task);
            }
        }
        Ok(())
    }
    pub(crate) fn materialize_templates(&mut self, at: i64) -> bool {
        let today = NaiveDate::parse_from_str(&crate::date_at(at), "%Y-%m-%d").unwrap();
        let mut requests = Vec::new();
        let printed: HashSet<_> = self
            .prints
            .iter()
            .map(|p| (p.template_id.as_str(), p.date.as_deref()))
            .collect();
        for template in self.templates.iter().filter(|t| t.automatic) {
            let Some(end) = today.checked_add_days(Days::new(u64::from(template.print_ahead_days)))
            else {
                continue;
            };
            let dates: Vec<_> = match &template.printing {
                Printing::Once { date, .. } => date
                    .iter()
                    .filter(|d| d.as_str() <= end.to_string().as_str())
                    .cloned()
                    .map(Some)
                    .collect(),
                Printing::Calendar { slots } => slots
                    .iter()
                    .flat_map(|s| s.dates.iter())
                    .filter(|date| date.as_str() <= end.to_string().as_str())
                    .cloned()
                    .map(Some)
                    .collect::<BTreeSet<_>>()
                    .into_iter()
                    .collect(),
                Printing::Weekly { slots } => {
                    let days: BTreeSet<_> = slots.iter().flat_map(|s| s.days.iter()).collect();
                    let mut monday = week_start(today);
                    let last = week_start(end);
                    let mut dates = Vec::new();
                    while monday <= last {
                        for day in &days {
                            if let Some(date) =
                                monday.checked_add_days(Days::new(u64::from(**day - 1)))
                            {
                                dates.push(Some(date.to_string()));
                            }
                        }
                        let Some(next) = monday.checked_add_days(Days::new(7)) else {
                            break;
                        };
                        monday = next;
                    }
                    dates
                }
            };
            let dates: Vec<_> = dates
                .into_iter()
                .filter(|d| !printed.contains(&(template.id.as_str(), d.as_deref())))
                .collect();
            if !dates.is_empty() {
                requests.push((template.id.clone(), dates));
            }
        }
        let mut changed = false;
        for (id, dates) in requests {
            // Printing is atomic even at capacity: keep all or none of the cycle.
            let mut candidate = self.clone();
            if candidate.print_template(&id, &dates, at).is_ok()
                && candidate.tasks.len() != self.tasks.len()
                && candidate.validate().is_ok()
            {
                *self = candidate;
                changed = true;
            }
        }
        changed
    }
}

/// Convert legacy task input into the printing model without putting a rule on
/// an instance. Used only at the plan/input boundary.
pub(crate) fn from_task(task: &Task, repeat: Repeat, at: i64) -> Template {
    let date = task.due_date.clone().unwrap_or_else(|| crate::date_at(at));
    let weekday = NaiveDate::parse_from_str(&date, "%Y-%m-%d")
        .map(|d| d.weekday().number_from_monday() as u8)
        .unwrap_or(1);
    let days = match repeat {
        Repeat::Daily => (1..=7).collect(),
        Repeat::Weekdays => (1..=5).collect(),
        _ => vec![weekday],
    };
    Template {
        id: crate::id(),
        automatic: true,
        print_ahead_days: 0,
        printing: Printing::Weekly {
            slots: vec![PrintSlot {
                days,
                time: task.reminder_time.clone(),
            }],
        },
        shape: Shape {
            title: task.title.clone(),
            notes: task.notes.clone(),
            project_id: task.project_id.clone(),
            goal_id: task.goal_id.clone(),
            habit_id: task.habit_id.clone(),
            focus_minutes: task.focus_minutes,
            scrap_minutes: task.scrap_minutes,
            priority: task.priority,
            estimate: task.estimate,
            tags: task.tags.clone(),
            subtasks: task
                .subtasks
                .iter()
                .map(|s| TemplateSubtask {
                    id: s.id.clone(),
                    title: s.title.clone(),
                })
                .collect(),
        },
    }
}

fn week_start(date: NaiveDate) -> NaiveDate {
    date.checked_sub_days(Days::new(u64::from(
        date.weekday().number_from_monday() - 1,
    )))
    .unwrap_or(date)
}
