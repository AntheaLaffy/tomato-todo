//! Portable plans intentionally omit execution history and local preferences.
use crate::{
    templates::{PrintRecord, Template},
    AppData, AppResult, Habit, Project, Repeat, Subtask, Task,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlanFile {
    pub format: String,
    pub version: u32,
    pub pomodoro_minutes: u32,
    pub projects: Vec<PlanProject>,
    pub tasks: Vec<PlanTask>,
    /// Fixed commitments outside the plan (course bands). Config only.
    #[serde(default)]
    pub blocks: Vec<crate::blocks::Block>,
    #[serde(default)]
    pub templates: Vec<Template>,
    #[serde(default)]
    pub prints: Vec<PrintRecord>,
    #[serde(default)]
    pub habits: Vec<Habit>,
    /// When true the file is the whole plan: incomplete instances,
    /// templates and habits it does not mention are removed. Completed instances and history
    /// are never touched.
    #[serde(default, skip_serializing_if = "is_false")]
    pub replace: bool,
}

fn is_false(value: &bool) -> bool {
    !*value
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
            template_id: self.template_id.clone(),
            recurring: self.recurring || self.repeat != Repeat::None,
            title: self.title.clone(),
            notes: self.notes.clone(),
            project_id: self.project_id.clone(),
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

    /// Configuration comes from the file; progress and history stay local. The
    /// reminder state survives only while the slot itself is unchanged.
    fn merge(&self, old: &Task, at: i64, estimate: u32) -> Task {
        let mut task = self.task(at, estimate);
        task.created_at = old.created_at;
        task.completed = old.completed;
        task.completed_at = old.completed_at;
        if old.due_date == self.due_date && old.reminder_time == self.reminder_time {
            task.reminder_fired = old.reminder_fired;
            task.reminder_pending = old.reminder_pending;
            task.reminder_expired = old.reminder_expired;
        }
        for sub in &mut task.subtasks {
            if let Some(prev) = old.subtasks.iter().find(|s| s.id == sub.id) {
                sub.done = prev.done;
            }
        }
        task
    }
}

impl PlanFile {
    pub fn validate(&self) -> AppResult<()> {
        if self.format != "tomato-todo-plan" || self.version != 6 {
            return Err("仅支持计划 v6；旧计划请按新格式重新导出".into());
        }
        if self.tasks.iter().any(|t| t.repeat != Repeat::None) {
            return Err("实例不拥有重复规则，请使用周期模板".into());
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
            blocks: self.blocks.clone(),
            templates: self.templates.clone(),
            prints: self.prints.clone(),
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
                // Project config is regenerated, not progress, so the file wins; an
                // omitted allow-list keeps the local one.
                existing.name = plan_project.name.clone();
                existing.color = plan_project.color.clone();
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
        for habit in &self.habits {
            if let Some(existing) = next.habits.iter_mut().find(|h| h.id == habit.id) {
                existing.name = habit.name.clone();
            } else {
                next.habits.push(habit.clone());
            }
        }
        // Blocks are pure config: the file's version of a band replaces the local
        // one, and bands the file does not mention are left alone.
        for block in &self.blocks {
            if let Some(existing) = next.blocks.iter_mut().find(|b| b.id == block.id) {
                *existing = block.clone();
            } else {
                next.blocks.push(block.clone());
            }
        }
        for plan_template in &self.templates {
            let mut template = plan_template.clone();
            template.shape.estimate = converted_estimate(
                template.shape.estimate,
                template.shape.focus_minutes,
                self.pomodoro_minutes,
                data.settings.focus_minutes,
            )?;
            if let Some(existing) = next.templates.iter_mut().find(|t| t.id == template.id) {
                *existing = template;
            } else {
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
        // Existing instances take the file's configuration while keeping progress.
        let incoming: HashMap<&str, &PlanTask> =
            self.tasks.iter().map(|t| (t.id.as_str(), t)).collect();
        for task in &mut next.tasks {
            let Some(plan) = incoming.get(task.id.as_str()) else {
                continue;
            };
            let estimate = plan_estimate(plan, self.pomodoro_minutes, data.settings.focus_minutes)?;
            let old = task.clone();
            let merged = plan.merge(&old, at, estimate);
            *task = merged;
        }
        let local_ids: HashSet<String> = next.tasks.iter().map(|t| t.id.clone()).collect();
        for task in self.tasks.iter().filter(|t| !local_ids.contains(&t.id)) {
            let estimate = plan_estimate(task, self.pomodoro_minutes, data.settings.focus_minutes)?;
            let instance = task.task(at, estimate);
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
        if self.replace {
            // The file is the whole plan. Drop the incomplete things it no longer
            // names, but never history: completed instances stay.
            let planned_tasks: HashSet<&str> = self.tasks.iter().map(|t| t.id.as_str()).collect();
            next.tasks
                .retain(|t| t.completed || planned_tasks.contains(t.id.as_str()));
            let planned_habits: HashSet<&str> = self.habits.iter().map(|h| h.id.as_str()).collect();
            let removed_habits: Vec<String> = next
                .habits
                .iter()
                .filter(|h| !planned_habits.contains(h.id.as_str()))
                .map(|h| h.id.clone())
                .collect();
            if !removed_habits.is_empty() {
                next.habits.retain(|h| !removed_habits.contains(&h.id));
                for task in &mut next.tasks {
                    if task
                        .habit_id
                        .as_ref()
                        .is_some_and(|id| removed_habits.contains(id))
                    {
                        task.habit_id = None;
                    }
                }
                for template in &mut next.templates {
                    if template
                        .shape
                        .habit_id
                        .as_ref()
                        .is_some_and(|id| removed_habits.contains(id))
                    {
                        template.shape.habit_id = None;
                    }
                }
            }
            let planned_templates: HashSet<&str> =
                self.templates.iter().map(|t| t.id.as_str()).collect();
            let removed_templates: Vec<String> = next
                .templates
                .iter()
                .filter(|t| !planned_templates.contains(t.id.as_str()))
                .map(|t| t.id.clone())
                .collect();
            for id in &removed_templates {
                next.delete_template(id);
            }
            let planned_blocks: HashSet<&str> = self.blocks.iter().map(|b| b.id.as_str()).collect();
            next.blocks
                .retain(|b| planned_blocks.contains(b.id.as_str()));
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
            version: 6,
            replace: false,
            blocks: self.blocks.clone(),
            templates: self.templates.clone(),
            prints: self.prints.clone(),
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

fn plan_estimate(task: &PlanTask, pomodoro: u32, focus: u32) -> AppResult<u32> {
    let estimate = if task.focus_minutes.is_some() {
        task.estimate
    } else {
        (task.estimate * pomodoro).div_ceil(focus)
    };
    if estimate > 99 {
        return Err(format!(
            "任务“{}”换算后超过 99 个番茄，请先拆分任务",
            task.title
        ));
    }
    Ok(estimate)
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
