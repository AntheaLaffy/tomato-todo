//! Portable plans intentionally omit execution history and local preferences.
use crate::{
    templates::{PrintRecord, Printing, Shape, Template, TemplateSubtask},
    AppData, AppResult, Goal, Habit, Project, Repeat, Subtask, Task,
};
use chrono::{Datelike, NaiveDate};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlanFile {
    pub format: String,
    pub version: u32,
    pub pomodoro_minutes: u32,
    pub projects: Vec<PlanProject>,
    pub tasks: Vec<PlanTask>,
    #[serde(default)]
    pub templates: Vec<Template>,
    #[serde(default)]
    pub prints: Vec<PrintRecord>,
    #[serde(default)]
    pub goals: Vec<PlanGoal>,
    #[serde(default)]
    pub habits: Vec<Habit>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlanGoal {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub nodes: Vec<crate::nodes::NodeSpec>,
}
impl PlanGoal {
    fn goal(&self) -> Goal {
        Goal {
            id: self.id.clone(),
            name: self.name.clone(),
            nodes: self
                .nodes
                .iter()
                .cloned()
                .map(crate::nodes::Node::new)
                .collect(),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlanProject {
    pub id: String,
    pub name: String,
    pub color: String,
    /// `None` keeps the local list; `Some` replaces it on import, which lets an
    /// agent regenerate one project's allow-list without touching the rest.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub app_whitelist: Option<Vec<String>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlanTask {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub template_id: Option<String>,
    #[serde(default)]
    pub goal_id: Option<String>,
    #[serde(default)]
    pub habit_id: Option<String>,
    #[serde(default)]
    pub recurring: bool,
    #[serde(default)]
    pub scrap_minutes: u32,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub due_date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reminder_time: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub focus_minutes: Option<u32>,
    #[serde(default)]
    pub priority: u8,
    #[serde(default = "crate::default_estimate")]
    pub estimate: u32,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub subtasks: Vec<PlanSubtask>,
    #[serde(default)]
    pub repeat: Repeat,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PlanSubtask {
    pub id: String,
    pub title: String,
}

impl PlanTask {
    fn task(&self, at: i64, estimate: u32) -> Task {
        Task {
            id: self.id.clone(),
            node_id: None,
            template_id: self.template_id.clone(),
            recurring: self.recurring || self.repeat != Repeat::None,
            title: self.title.clone(),
            notes: self.notes.clone(),
            project_id: self.project_id.clone(),
            goal_id: self.goal_id.clone(),
            habit_id: self.habit_id.clone(),
            due_date: self.due_date.clone(),
            reminder_time: self.reminder_time.clone(),
            focus_minutes: self.focus_minutes,
            reminder_fired: false,
            reminder_pending: false,
            reminder_expired: false,
            scrap_minutes: self.scrap_minutes,
            priority: self.priority,
            estimate,
            completed: false,
            completed_at: None,
            created_at: at,
            tags: self.tags.clone(),
            subtasks: self
                .subtasks
                .iter()
                .map(|s| Subtask {
                    id: s.id.clone(),
                    title: s.title.clone(),
                    done: false,
                })
                .collect(),
        }
    }
}

impl PlanFile {
    pub fn validate(&self) -> AppResult<()> {
        if self.version == 1
            && self
                .tasks
                .iter()
                .any(|t| t.focus_minutes.is_some() || t.reminder_time.is_some())
        {
            return Err("任务时间安排需要计划 v2".into());
        }
        if self.format != "tomato-todo-plan" || !matches!(self.version, 1..=4) {
            return Err("不支持的计划格式或版本".into());
        }
        if self.version >= 3 && self.tasks.iter().any(|t| t.repeat != Repeat::None) {
            return Err("v3/v4 的实例不拥有重复规则，请使用模板".into());
        }
        if self.version < 4 && !self.goals.is_empty() {
            return Err("主线节点需要计划 v4".into());
        }
        if self.version < 3
            && (!self.templates.is_empty()
                || !self.prints.is_empty()
                || !self.goals.is_empty()
                || !self.habits.is_empty()
                || self.tasks.iter().any(|t| {
                    t.template_id.is_some()
                        || t.goal_id.is_some()
                        || t.habit_id.is_some()
                        || t.recurring
                        || t.scrap_minutes != 0
                }))
        {
            return Err("模板与管辖字段需要计划 v3".into());
        }
        if !(1..=180).contains(&self.pomodoro_minutes) {
            return Err("计划的番茄时长需为 1–180 分钟".into());
        }
        let data = AppData {
            projects: self
                .projects
                .iter()
                .map(|p| Project {
                    id: p.id.clone(),
                    name: p.name.clone(),
                    color: p.color.clone(),
                    app_whitelist: p.app_whitelist.clone(),
                })
                .collect(),
            tasks: self.tasks.iter().map(|t| t.task(0, t.estimate)).collect(),
            templates: self.templates.clone(),
            prints: self.prints.clone(),
            goals: self.goals.iter().map(PlanGoal::goal).collect(),
            habits: self.habits.clone(),
            ..AppData::default()
        };
        data.validate()
    }

    pub fn merge_into(&self, data: &mut AppData, at: i64) -> AppResult<()> {
        self.validate()?;
        // Validate a full candidate first, so even direct callers never receive a partial merge.
        let mut next = data.clone();
        for plan_project in &self.projects {
            if let Some(existing) = next.projects.iter_mut().find(|p| p.id == plan_project.id) {
                // Project config is regenerated, not progress, so a provided list
                // wins over the local one; an omitted field keeps the local list.
                if let Some(whitelist) = &plan_project.app_whitelist {
                    existing.app_whitelist = Some(whitelist.clone());
                }
            } else {
                next.projects.push(Project {
                    id: plan_project.id.clone(),
                    name: plan_project.name.clone(),
                    color: plan_project.color.clone(),
                    app_whitelist: plan_project.app_whitelist.clone(),
                });
            }
        }
        for goal in &self.goals {
            if !next.goals.iter().any(|g| g.id == goal.id) {
                next.goals.push(goal.goal());
            }
        }
        for habit in &self.habits {
            if !next.habits.iter().any(|h| h.id == habit.id) {
                next.habits.push(habit.clone());
            }
        }
        for template in &self.templates {
            if !next.templates.iter().any(|t| t.id == template.id) {
                let mut template = template.clone();
                template.shape.estimate = converted_estimate(
                    template.shape.estimate,
                    template.shape.focus_minutes,
                    self.pomodoro_minutes,
                    data.settings.focus_minutes,
                )?;
                next.templates.push(template);
            }
        }
        for print in &self.prints {
            if !next
                .prints
                .iter()
                .any(|p| p.template_id == print.template_id && p.date == print.date)
            {
                next.prints.push(print.clone());
            }
        }
        let task_ids: HashSet<_> = data.tasks.iter().map(|t| &t.id).collect();
        for task in self.tasks.iter().filter(|t| !task_ids.contains(&t.id)) {
            let estimate = if task.focus_minutes.is_some() {
                task.estimate
            } else {
                (task.estimate * self.pomodoro_minutes).div_ceil(data.settings.focus_minutes)
            };
            if estimate > 99 {
                return Err(format!(
                    "任务“{}”换算后超过 99 个番茄，请先拆分任务",
                    task.title
                ));
            }
            let mut instance = task.task(at, estimate);
            if self.version < 3 {
                let template = task.legacy_template(at, estimate);
                instance.template_id = Some(template.id.clone());
                instance.recurring = task.repeat != Repeat::None;
                if !next.templates.iter().any(|t| t.id == template.id) {
                    next.templates.push(template);
                }
            }
            if let Some(id) = &instance.template_id {
                if !next
                    .prints
                    .iter()
                    .any(|p| &p.template_id == id && p.date == instance.due_date)
                {
                    next.prints.push(PrintRecord {
                        template_id: id.clone(),
                        date: instance.due_date.clone(),
                    });
                }
            }
            next.tasks.push(instance);
        }
        next.validate()?;
        *data = next;
        Ok(())
    }
}

impl AppData {
    pub fn export_plan(&self) -> PlanFile {
        let tasks: Vec<_> = self
            .tasks
            .iter()
            .filter(|t| !t.completed)
            .map(|t| PlanTask {
                template_id: t.template_id.clone(),
                goal_id: t.goal_id.clone(),
                habit_id: t.habit_id.clone(),
                recurring: t.recurring,
                scrap_minutes: t.scrap_minutes,
                id: t.id.clone(),
                title: t.title.clone(),
                notes: t.notes.clone(),
                project_id: t.project_id.clone(),
                due_date: t.due_date.clone(),
                reminder_time: t.reminder_time.clone(),
                focus_minutes: t.focus_minutes,
                priority: t.priority,
                estimate: t.estimate,
                tags: t.tags.clone(),
                repeat: Repeat::None,
                subtasks: t
                    .subtasks
                    .iter()
                    .map(|s| PlanSubtask {
                        id: s.id.clone(),
                        title: s.title.clone(),
                    })
                    .collect(),
            })
            .collect();
        let used: HashSet<_> = tasks
            .iter()
            .filter_map(|t| t.project_id.as_ref())
            .chain(
                self.templates
                    .iter()
                    .filter_map(|t| t.shape.project_id.as_ref()),
            )
            .collect();
        PlanFile {
            format: "tomato-todo-plan".into(),
            version: 4,
            templates: self.templates.clone(),
            prints: self.prints.clone(),
            goals: self
                .goals
                .iter()
                .map(|g| PlanGoal {
                    id: g.id.clone(),
                    name: g.name.clone(),
                    nodes: g.nodes.iter().map(|n| n.spec.clone()).collect(),
                })
                .collect(),
            habits: self.habits.clone(),
            pomodoro_minutes: self.settings.focus_minutes,
            projects: self
                .projects
                .iter()
                .filter(|p| used.contains(&p.id))
                .map(|p| PlanProject {
                    id: p.id.clone(),
                    name: p.name.clone(),
                    color: p.color.clone(),
                    app_whitelist: p.app_whitelist.clone(),
                })
                .collect(),
            tasks,
        }
    }
}

fn converted_estimate(
    estimate: u32,
    focus: Option<u32>,
    source: u32,
    destination: u32,
) -> AppResult<u32> {
    let estimate = if focus.is_some() {
        estimate
    } else {
        (estimate * source).div_ceil(destination)
    };
    if estimate > 99 {
        return Err("换算后超过 99 个番茄，请先拆分模板".into());
    }
    Ok(estimate)
}
impl PlanTask {
    fn legacy_template(&self, at: i64, estimate: u32) -> Template {
        let printing = if self.repeat == Repeat::None {
            Printing::Once {
                date: self.due_date.clone(),
                time: self.reminder_time.clone(),
            }
        } else {
            let date = self.due_date.clone().unwrap_or_else(|| crate::date_at(at));
            let weekday = NaiveDate::parse_from_str(&date, "%Y-%m-%d")
                .unwrap()
                .weekday()
                .number_from_monday() as u8;
            let days = match self.repeat {
                Repeat::Daily => (1..=7).collect(),
                Repeat::Weekdays => (1..=5).collect(),
                _ => vec![weekday],
            };
            Printing::Weekly {
                slots: vec![crate::templates::PrintSlot {
                    days,
                    time: self.reminder_time.clone(),
                }],
            }
        };
        Template {
            id: format!("plan:{}", self.id),
            automatic: self.repeat != Repeat::None,
            print_ahead_days: 0,
            printing,
            shape: Shape {
                title: self.title.clone(),
                notes: self.notes.clone(),
                project_id: self.project_id.clone(),
                goal_id: None,
                habit_id: None,
                focus_minutes: self.focus_minutes,
                scrap_minutes: 0,
                priority: self.priority,
                estimate,
                tags: self.tags.clone(),
                subtasks: self
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
}
