//! Learning evidence stays separate from scheduled time and self-reported mastery.
use crate::{education::AssessmentKind, AppData, AppResult, SessionSource, Task};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CompletedStudyTask {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub notes: String,
    pub topics: Vec<String>,
    pub completed_at: i64,
}
impl CompletedStudyTask {
    pub fn from_task(task: &Task, at: i64) -> Option<Self> {
        Some(Self {
            id: task.id.clone(),
            project_id: task.project_id.clone()?,
            title: task.title.clone(),
            notes: task.notes.clone(),
            topics: task.tags.clone(),
            completed_at: at,
        })
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ProgressSource {
    User,
    Assistant,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ProgressState {
    Studied,
    Practicing,
    NeedsReview,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProgressRecord {
    pub id: String,
    pub project_id: String,
    pub topic: String,
    pub position: String,
    pub state: ProgressState,
    pub evidence: String,
    pub next_action: String,
    pub source: ProgressSource,
    pub confirmed: bool,
    pub recorded_at: i64,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Correction {
    pub id: String,
    pub grade_id: String,
    pub question_id: String,
    pub explanation: String,
    pub resource_ids: Vec<String>,
    pub submitted_at: i64,
    pub accepted: Option<bool>,
    pub feedback: String,
    pub reviewed_at: Option<i64>,
}
fn check(ok: bool, message: &str) -> AppResult<()> {
    if ok {
        Ok(())
    } else {
        Err(message.into())
    }
}
fn text(s: &str, max: usize) -> bool {
    !s.trim().is_empty() && s.chars().count() <= max
}
pub fn validate(data: &AppData) -> AppResult<()> {
    let e = &data.education;
    check(
        e.progress.len() + e.completed_tasks.len() + e.corrections.len() <= 100_000,
        "学习证据数量超出限制",
    )?;
    let mut ids = HashSet::new();
    for task in &e.completed_tasks {
        check(
            ids.insert(("task", &task.id))
                && !task.id.is_empty()
                && data.projects.iter().any(|p| p.id == task.project_id)
                && text(&task.title, 200)
                && task.notes.len() <= 50_000
                && task.topics.len() <= 20,
            "无效的已完成学习任务快照",
        )?;
    }
    for record in &e.progress {
        check(
            ids.insert(("progress", &record.id))
                && !record.id.is_empty()
                && data.projects.iter().any(|p| p.id == record.project_id)
                && text(&record.topic, 200)
                && text(&record.position, 2000)
                && text(&record.evidence, 8000)
                && record.next_action.chars().count() <= 2000,
            "学习进度需要项目、知识点、实际位置和依据",
        )?;
    }
    for correction in &e.corrections {
        let grade = e
            .grades
            .iter()
            .find(|g| g.id == correction.grade_id)
            .ok_or("订正缺少批改记录")?;
        let assessment = e
            .submissions
            .iter()
            .find(|s| s.id == grade.submission_id)
            .and_then(|s| e.assessments.iter().find(|a| a.id == s.assessment_id))
            .ok_or("订正缺少试题")?;
        check(
            ids.insert(("correction", &correction.id))
                && !correction.id.is_empty()
                && assessment
                    .questions
                    .iter()
                    .any(|q| q.id == correction.question_id)
                && correction.explanation.chars().count() <= 8000
                && (text(&correction.explanation, 8000) || !correction.resource_ids.is_empty())
                && correction.resource_ids.iter().all(|id| {
                    e.resources
                        .iter()
                        .any(|r| &r.id == id && r.project_id == assessment.project_id)
                })
                && correction.accepted.is_some() == correction.reviewed_at.is_some()
                && correction.reviewed_at.is_none_or(|at| {
                    at >= correction.submitted_at && text(&correction.feedback, 8000)
                }),
            "订正需要原题、解释或本项目附件；检查结果必须有反馈",
        )?;
    }
    Ok(())
}
pub fn validate_transition(
    before: &crate::education::Education,
    after: &crate::education::Education,
) -> AppResult<()> {
    for record in &before.progress {
        check(
            after.progress.iter().any(|r| r.id == record.id),
            "进度历史不能删除，请新增更正记录",
        )?;
        if let Some(next) = after.progress.iter().find(|r| r.id == record.id) {
            let mut old = record.clone();
            old.confirmed = next.confirmed;
            check(old == *next, "进度历史不可改写，请新增一条更正记录")?;
        }
    }
    for record in &before.completed_tasks {
        check(
            after
                .completed_tasks
                .iter()
                .find(|r| r.id == record.id)
                .is_some_and(|r| r == record),
            "已完成任务的学习内容快照不可改写",
        )?;
    }
    for record in &before.corrections {
        check(
            after.corrections.iter().any(|r| r.id == record.id),
            "订正历史不能删除",
        )?;
        if let Some(next) = after.corrections.iter().find(|r| r.id == record.id) {
            let mut old = record.clone();
            if old.reviewed_at.is_none() {
                old.accepted = next.accepted;
                old.feedback = next.feedback.clone();
                old.reviewed_at = next.reviewed_at;
            }
            check(old == *next, "订正与检查历史不可改写，请新增一次订正")?;
        }
    }
    Ok(())
}

struct SummaryIndex<'a> {
    submissions: HashMap<&'a str, &'a crate::education::Submission>,
    grades: HashMap<&'a str, &'a crate::education::Grade>,
    assessment_grades: HashMap<&'a str, &'a crate::education::Grade>,
    accepted: HashSet<(&'a str, &'a str)>,
    retests: HashMap<&'a str, Vec<&'a crate::education::Assessment>>,
}
impl<'a> SummaryIndex<'a> {
    fn new(e: &'a crate::education::Education) -> Self {
        let mut index = Self {
            submissions: HashMap::new(),
            grades: HashMap::new(),
            assessment_grades: HashMap::new(),
            accepted: HashSet::new(),
            retests: HashMap::new(),
        };
        let mut parents = HashMap::new();
        for s in &e.submissions {
            parents.insert(s.id.as_str(), s.assessment_id.as_str());
            if index
                .submissions
                .get(s.assessment_id.as_str())
                .is_none_or(|old| s.submitted_at >= old.submitted_at)
            {
                index.submissions.insert(&s.assessment_id, s);
            }
        }
        for g in &e.grades {
            if index
                .grades
                .get(g.submission_id.as_str())
                .is_none_or(|old| g.graded_at >= old.graded_at)
            {
                index.grades.insert(&g.submission_id, g);
            }
            if let Some(assessment) = parents.get(g.submission_id.as_str()) {
                if index
                    .assessment_grades
                    .get(assessment)
                    .is_none_or(|old| g.graded_at >= old.graded_at)
                {
                    index.assessment_grades.insert(assessment, g);
                }
            }
        }
        for c in &e.corrections {
            if c.accepted == Some(true) {
                index.accepted.insert((&c.grade_id, &c.question_id));
            }
        }
        for a in &e.assessments {
            if let Some(grade) = &a.retest_of_grade_id {
                index.retests.entry(grade).or_default().push(a);
            }
        }
        index
    }
}
fn assessment_summary(
    index: &SummaryIndex<'_>,
    a: &crate::education::Assessment,
    at: i64,
) -> Value {
    let submission = index.submissions.get(a.id.as_str()).copied();
    let grade = submission.and_then(|s| index.grades.get(s.id.as_str()).copied());
    let status = if let Some(g) = grade {
        if g.needs_review {
            "needsReview"
        } else if g.errors.iter().any(|error| {
            !index
                .accepted
                .contains(&(g.id.as_str(), error.question_id.as_str()))
        }) {
            "correctionDue"
        } else {
            "graded"
        }
    } else if submission.is_some() {
        "submitted"
    } else if a.kind != AssessmentKind::Homework
        && a.started_at.is_none()
        && crate::date_at(at) > crate::date_at(a.starts_at)
    {
        "missed"
    } else if a.kind != AssessmentKind::Homework
        && a.started_at.is_some()
        && a.stopped_at.is_none()
        && at < a.exam_deadline()
    {
        "inProgress"
    } else if a.kind != AssessmentKind::Homework
        && a.started_at.is_some()
        && (a.stopped_at.is_some() || at >= a.exam_deadline())
    {
        "awaitingSubmission"
    } else if a.kind == AssessmentKind::Homework && at >= a.ends_at {
        "overdue"
    } else if at < a.starts_at || (a.kind != AssessmentKind::Homework && a.started_at.is_none()) {
        "upcoming"
    } else {
        "awaitingSubmission"
    };
    json!({"id":a.id,"title":a.title,"kind":a.kind,"status":status,"startsAt":a.starts_at,"endsAt":a.ends_at,
        "submissionId":submission.map(|s| &s.id),"submittedAt":submission.map(|s| s.submitted_at),
        "unfinished":submission.is_some_and(|s| s.unfinished),"late":a.kind == AssessmentKind::Homework && submission.is_some_and(|s| s.submitted_at > a.ends_at),
        "gradeId":grade.map(|g| &g.id),"gradedAt":grade.map(|g| g.graded_at),
        "score":grade.filter(|g| !g.needs_review).map(|g| g.awards.iter().map(|p| p.awarded).sum::<u32>()),
        "total":a.questions.iter().flat_map(|q| &q.scoring).map(|p| p.points).sum::<u32>(),
        "needsReview":grade.is_some_and(|g| g.needs_review)})
}

/// Derived every time from current evidence; no second, stale summary to maintain.
pub fn summaries(data: &AppData, at: i64) -> Vec<Value> {
    let e = &data.education;
    let index = SummaryIndex::new(e);
    let mut summaries = Vec::new();
    for project in data.projects.iter().filter(|p| {
        e.projects.iter().any(|s| s.project_id == p.id)
            || e.progress.iter().any(|r| r.project_id == p.id)
    }) {
        let mut progress = e
            .progress
            .iter()
            .filter(|r| r.project_id == project.id)
            .collect::<Vec<_>>();
        progress.sort_by_key(|r| r.recorded_at);
        let mut topics = HashSet::new();
        let latest = progress
            .into_iter()
            .rev()
            .filter(|r| topics.insert(&r.topic))
            .collect::<Vec<_>>();
        let mut assessments = e
            .assessments
            .iter()
            .filter(|a| a.project_id == project.id)
            .map(|a| assessment_summary(&index, a, at))
            .collect::<Vec<_>>();
        assessments.sort_by_key(|a| std::cmp::Reverse(a["startsAt"].as_i64().unwrap_or(0)));
        let mut retests = Vec::new();
        let grades = e
            .assessments
            .iter()
            .filter(|a| a.project_id == project.id)
            .filter_map(|a| index.assessment_grades.get(a.id.as_str()).copied());
        for grade in grades {
            let attempts = index
                .retests
                .get(grade.id.as_str())
                .into_iter()
                .flatten()
                .map(|a| assessment_summary(&index, a, at))
                .collect::<Vec<_>>();
            for error in &grade.errors {
                retests.push(json!({"gradeId":grade.id,"questionId":error.question_id,"cause":error.cause,
                    "confirmed":error.confirmed,"retestDate":error.retest_date,"nextCheck":error.next_check,
                    "correctionAccepted":index.accepted.contains(&(grade.id.as_str(),error.question_id.as_str())),
                    "attempts":attempts}));
            }
        }
        retests.sort_by_key(|r| r["retestDate"].as_str().unwrap_or("").to_string());
        let recent_tasks = e
            .completed_tasks
            .iter()
            .rev()
            .filter(|t| t.project_id == project.id)
            .take(5)
            .collect::<Vec<_>>();
        let lessons = e
            .lessons
            .iter()
            .filter(|l| l.project_id == project.id)
            .collect::<Vec<_>>();
        let last_lesson = lessons
            .iter()
            .filter(|l| l.attended)
            .max_by_key(|l| l.starts_at);
        let latest_review = e
            .reviews
            .iter()
            .filter(|r| r.project_id == project.id)
            .max_by_key(|r| &r.date);
        let review_time = latest_review
            .and_then(|r| chrono::NaiveDate::parse_from_str(&r.date, "%Y-%m-%d").ok())
            .and_then(|date| date.and_hms_opt(0, 0, 0))
            .and_then(|dt| dt.and_local_timezone(chrono::Local).single())
            .map(|dt| dt.timestamp());
        let updated = latest
            .iter()
            .map(|r| r.recorded_at)
            .chain(recent_tasks.iter().map(|r| r.completed_at))
            .chain(last_lesson.iter().map(|l| l.starts_at))
            .chain(review_time)
            .chain(assessments.iter().filter_map(|a| a["submittedAt"].as_i64()))
            .chain(assessments.iter().filter_map(|a| a["gradedAt"].as_i64()))
            .chain(
                e.corrections
                    .iter()
                    .filter(|c| assessments.iter().any(|a| a["gradeId"] == c.grade_id))
                    .map(|c| c.reviewed_at.unwrap_or(c.submitted_at)),
            )
            .max();
        let task_ids = data
            .tasks
            .iter()
            .filter(|t| t.project_id.as_ref() == Some(&project.id))
            .map(|t| &t.id)
            .chain(
                e.completed_tasks
                    .iter()
                    .filter(|t| t.project_id == project.id)
                    .map(|t| &t.id),
            )
            .collect::<HashSet<_>>();
        let actual_seconds = data
            .sessions
            .iter()
            .filter(|s| {
                s.source == SessionSource::Timer
                    && s.ended_at >= at - 7 * 86400
                    && s.ended_at <= at
                    && s.task_id.as_ref().is_some_and(|id| task_ids.contains(id))
            })
            .map(|s| u64::from(s.duration_secs))
            .sum::<u64>();
        let assessment_count = assessments.len();
        let retest_count = retests.len();
        summaries.push(json!({"projectId":project.id,"projectName":project.name,"updatedAt":updated,
            "progress":latest.into_iter().take(12).collect::<Vec<_>>(),
            "progressCount":e.progress.iter().filter(|r| r.project_id == project.id).count(),"recentCompletedTasks":recent_tasks,
            "lastAttendedLesson":last_lesson.map(|l| json!({"id":l.id,"title":l.title,"progress":l.progress,"state":l.state})),
            "lessons":{"planned":lessons.iter().filter(|l| l.state == crate::education::LessonState::Planned).count(),
                "attended":lessons.iter().filter(|l| l.attended).count(),"missed":lessons.iter().filter(|l| l.state == crate::education::LessonState::Missed).count()},
            "actualFocusSeconds7d":actual_seconds,"assessments":assessments.into_iter().take(20).collect::<Vec<_>>(),
            "assessmentCount":assessment_count,"retests":retests.into_iter().take(20).collect::<Vec<_>>(),"retestCount":retest_count,
            "latestReview":latest_review,"pendingEvents":e.events.iter().filter(|r| r.project_id == project.id && r.state != "done").count(),
            "note":"计时与任务完成只说明投入或自报完成；掌握须查看答卷、批改与独立复测。空记录表示未知。"}));
    }
    summaries
}
