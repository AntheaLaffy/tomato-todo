//! Portable plans intentionally omit execution history and local preferences.
use crate::{AppData, AppResult, Project, Repeat, Subtask, Task};
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
            title: self.title.clone(),
            notes: self.notes.clone(),
            project_id: self.project_id.clone(),
            goal_id: None,
            habit_id: None,
            due_date: self.due_date.clone(),
            reminder_time: self.reminder_time.clone(),
            focus_minutes: self.focus_minutes,
            reminder_fired: false,
            reminder_pending: false,
            reminder_expired: false,
            priority: self.priority,
            estimate,
            completed: false,
            completed_at: None,
            created_at: at,
            tags: self.tags.clone(),
            repeat: self.repeat,
            next_task_id: None,
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
        if self.format != "tomato-todo-plan" || !matches!(self.version, 1 | 2) {
            return Err("不支持的计划格式或版本".into());
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
            next.tasks.push(task.task(at, estimate));
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
                repeat: t.repeat,
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
        let used: HashSet<_> = tasks.iter().filter_map(|t| t.project_id.as_ref()).collect();
        PlanFile {
            format: "tomato-todo-plan".into(),
            version: 2,
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
