//! Teaching owns the schedule; ordinary tasks provide the shared focus entry.
use crate::{
    education::{AssessmentKind, LessonState},
    AppData, AppResult, Task,
};
use chrono::{Local, TimeZone, Timelike};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TeachingTaskKind {
    Lesson,
    Homework,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TeachingTask {
    pub task_id: String,
    pub source_id: String,
    pub kind: TeachingTaskKind,
}

impl AppData {
    pub fn teaching_task(&self, task_id: &str) -> Option<&TeachingTask> {
        self.education
            .focus_tasks
            .iter()
            .find(|link| link.task_id == task_id)
    }

    pub(crate) fn materialize_teaching_tasks(&mut self, at: i64) -> bool {
        let enabled: HashSet<_> = self
            .education
            .projects
            .iter()
            .filter(|p| p.exam_mode)
            .map(|p| p.project_id.as_str())
            .collect();
        let mut sources = Vec::new();
        for lesson in &self.education.lessons {
            if enabled.contains(lesson.project_id.as_str())
                && crate::date_at(lesson.starts_at) >= crate::date_at(at)
            {
                sources.push((
                    TeachingTaskKind::Lesson,
                    lesson.id.clone(),
                    lesson.project_id.clone(),
                    lesson.title.clone(),
                    lesson.topics.join("、"),
                    lesson.starts_at,
                    45,
                ));
            }
        }
        for paper in &self.education.assessments {
            if paper.kind == AssessmentKind::Homework && enabled.contains(paper.project_id.as_str())
            {
                let minutes = paper
                    .questions
                    .iter()
                    .fold(0u32, |n, q| n.saturating_add(q.estimated_minutes));
                sources.push((
                    TeachingTaskKind::Homework,
                    paper.id.clone(),
                    paper.project_id.clone(),
                    paper.title.clone(),
                    paper.instructions.clone(),
                    paper.starts_at,
                    minutes.max(1),
                ));
            }
        }
        let links: HashMap<_, _> = self
            .education
            .focus_tasks
            .iter()
            .map(|link| (link.source_id.clone(), link.clone()))
            .collect();
        let positions: HashMap<_, _> = self
            .tasks
            .iter()
            .enumerate()
            .map(|(i, task)| (task.id.clone(), i))
            .collect();
        let mut submissions = HashMap::new();
        for submission in &self.education.submissions {
            let last = submissions
                .entry(submission.assessment_id.clone())
                .or_insert((submission.submitted_at, submission.unfinished));
            if submission.submitted_at >= last.0 {
                *last = (submission.submitted_at, submission.unfinished);
            }
        }
        let mut changed = false;
        for (kind, source_id, project_id, title, notes, starts_at, minutes) in sources {
            let link = links.get(&source_id).filter(|link| link.kind == kind);
            let task_id = link.map(|link| link.task_id.clone());
            let position = task_id.as_ref().and_then(|id| positions.get(id).copied());
            if task_id.is_some() && position.is_none() {
                continue;
            }
            let due_date = crate::date_at(starts_at);
            let is_lesson = kind == TeachingTaskKind::Lesson;
            let time = Local.timestamp_opt(starts_at, 0).single();
            let reminder = is_lesson
                .then(|| time.map(|t| t.format("%H:%M").to_string()))
                .flatten();
            let focus = if is_lesson {
                45
            } else {
                minutes.min(self.settings.focus_minutes)
            };
            let estimate = minutes.div_ceil(focus).max(1);
            let scrap = if is_lesson {
                time.map(|t| (1440 - t.hour() * 60 - t.minute()).saturating_sub(45))
                    .unwrap_or(0)
            } else {
                0
            };
            let index = if let Some(index) = position {
                index
            } else {
                let id = crate::id();
                self.education.focus_tasks.push(TeachingTask {
                    task_id: id.clone(),
                    source_id: source_id.clone(),
                    kind: kind.clone(),
                });
                self.tasks.push(Task {
                    id,
                    template_id: None,
                    recurring: false,
                    title: title.clone(),
                    notes: notes.clone(),
                    project_id: Some(project_id.clone()),
                    habit_id: None,
                    due_date: Some(due_date.clone()),
                    reminder_time: reminder.clone(),
                    focus_minutes: Some(focus),
                    scrap_minutes: scrap,
                    priority: 1,
                    estimate,
                    reminder_fired: false,
                    reminder_pending: false,
                    reminder_expired: false,
                    completed: false,
                    completed_at: None,
                    created_at: at,
                    tags: vec![if is_lesson { "课程" } else { "作业" }.into()],
                    subtasks: vec![],
                });
                changed = true;
                self.tasks.len() - 1
            };
            let task = &mut self.tasks[index];
            if !task.completed
                && (task.title != title
                    || task.notes != notes
                    || task.project_id.as_ref() != Some(&project_id)
                    || task.due_date.as_ref() != Some(&due_date)
                    || task.reminder_time != reminder
                    || task.focus_minutes != Some(focus)
                    || task.estimate != estimate
                    || task.scrap_minutes != scrap)
            {
                if task.due_date.as_ref() != Some(&due_date) || task.reminder_time != reminder {
                    task.reminder_fired = false;
                    task.reminder_pending = false;
                    task.reminder_expired = false;
                }
                task.title = title;
                task.notes = notes;
                task.project_id = Some(project_id);
                task.due_date = Some(due_date);
                task.reminder_time = reminder;
                task.focus_minutes = Some(focus);
                task.estimate = estimate;
                task.scrap_minutes = scrap;
                changed = true;
            }
            if kind == TeachingTaskKind::Homework {
                let submitted = submissions
                    .get(&source_id)
                    .filter(|(_, unfinished)| !unfinished)
                    .map(|(at, _)| *at);
                if self.tasks[index].completed != submitted.is_some()
                    || self.tasks[index].completed_at != submitted
                {
                    if submitted.is_some()
                        && self.timer.task_id.as_ref() == Some(&self.tasks[index].id)
                    {
                        self.record(at, false);
                        self.timer.task_id = None;
                        self.reset_to(crate::Mode::Focus);
                    }
                    self.tasks[index].completed = submitted.is_some();
                    self.tasks[index].completed_at = submitted;
                    changed = true;
                }
            }
        }
        changed
    }

    pub(crate) fn complete_teaching_task(&mut self, task_id: &str, at: i64) -> AppResult<()> {
        let Some(link) = self.teaching_task(task_id).cloned() else {
            return Ok(());
        };
        if link.kind == TeachingTaskKind::Homework {
            return Err("请从作业入口提交答卷，提交完成后会自动完成待办".into());
        }
        let lesson = self
            .education
            .lessons
            .iter_mut()
            .find(|l| l.id == link.source_id)
            .ok_or("课程不存在")?;
        lesson.attended = true;
        if lesson.progress.trim().is_empty() {
            lesson.progress =
                "本人从今日专注确认课程任务完成，具体学习位置待补充；掌握情况待复测".into();
        }
        if at >= lesson.ends_at {
            lesson.state = LessonState::Ended;
            if lesson.ai_enabled {
                let project = lesson.project_id.clone();
                let source = lesson.id.clone();
                self.education.event(&project, "homework", &source, at);
            }
        }
        Ok(())
    }

    pub(crate) fn start_teaching_task(&mut self, at: i64) {
        if self.timer.mode != crate::Mode::Focus {
            return;
        }
        let link = self
            .timer
            .task_id
            .as_ref()
            .and_then(|id| self.teaching_task(id))
            .cloned();
        if let Some(link) = link.filter(|l| l.kind == TeachingTaskKind::Lesson) {
            if let Some(lesson) = self
                .education
                .lessons
                .iter_mut()
                .find(|l| l.id == link.source_id)
            {
                if at >= lesson.starts_at && at < lesson.ends_at {
                    lesson.attended = true;
                }
            }
        }
    }
}

pub(crate) fn validate(data: &AppData) -> AppResult<()> {
    let mut tasks = HashSet::new();
    let mut sources = HashSet::new();
    for link in &data.education.focus_tasks {
        let task = data
            .tasks
            .iter()
            .find(|t| t.id == link.task_id)
            .ok_or("教学待办关联的任务不存在")?;
        let project = match link.kind {
            TeachingTaskKind::Lesson => data
                .education
                .lessons
                .iter()
                .find(|l| l.id == link.source_id)
                .map(|l| &l.project_id),
            TeachingTaskKind::Homework => data
                .education
                .assessments
                .iter()
                .find(|a| a.id == link.source_id && a.kind == AssessmentKind::Homework)
                .map(|a| &a.project_id),
        }
        .ok_or("教学待办来源不存在或类型不符")?;
        if task.project_id.as_ref() != Some(project)
            || !tasks.insert(&link.task_id)
            || !sources.insert(&link.source_id)
            || task.template_id.is_some()
            || task.habit_id.is_some()
            || task.recurring
        {
            return Err("教学来源必须关联同项目的唯一普通任务".into());
        }
    }
    Ok(())
}
