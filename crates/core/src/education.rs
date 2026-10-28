//! Teaching records use wall-clock lessons and immutable, reviewed assessment packets.
use crate::{AppData, AppResult};
use chrono::{Datelike, Local, TimeZone, Timelike};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Education {
    pub projects: Vec<ProjectStudy>,
    pub resources: Vec<Resource>,
    pub semesters: Vec<Semester>,
    #[serde(default)]
    pub semester_history: Vec<Semester>,
    pub lessons: Vec<Lesson>,
    pub assessments: Vec<Assessment>,
    pub submissions: Vec<Submission>,
    pub grades: Vec<Grade>,
    pub reviews: Vec<Review>,
    pub events: Vec<TeachingEvent>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectStudy {
    pub project_id: String,
    pub directory: String,
    pub exam_mode: bool,
    pub vision_id: Option<String>,
    pub target: String,
    pub exam_date: Option<String>,
    pub syllabus_id: Option<String>,
    pub past_paper_ids: Vec<String>,
    pub mock_paper_ids: Vec<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Resource {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub kind: ResourceKind,
    /// Relative to the project's authorized directory. Never grants filesystem access.
    pub path: String,
    pub source: String,
    pub edition: String,
    pub topics: Vec<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ResourceKind {
    Syllabus,
    Course,
    Book,
    PastPaper,
    MockPaper,
    Reference,
    Attachment,
    AnswerSheet,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Milestone {
    pub week: u16,
    pub topics: Vec<String>,
    pub resource_ids: Vec<String>,
    pub objective: String,
    pub lesson_count: u16,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Semester {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub start_date: String,
    pub end_date: String,
    pub revision: u32,
    pub baseline: String,
    /// URLs, dates and applicability of experience reports and official sources.
    pub evidence: Vec<String>,
    pub rationale: String,
    pub milestones: Vec<Milestone>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Lesson {
    pub id: String,
    pub project_id: String,
    pub semester_id: String,
    #[serde(default = "initial_revision")]
    pub semester_revision: u32,
    pub title: String,
    pub topics: Vec<String>,
    pub resource_ids: Vec<String>,
    pub starts_at: i64,
    pub ends_at: i64,
    pub ai_enabled: bool,
    pub attended: bool,
    pub progress: String,
    pub state: LessonState,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LessonState {
    Planned,
    Active,
    Ended,
    Missed,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AssessmentKind {
    Homework,
    WeeklyExam,
    MockExam,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScoringPoint {
    pub id: String,
    pub description: String,
    pub points: u32,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Question {
    pub id: String,
    pub prompt: String,
    pub topics: Vec<String>,
    pub source_ids: Vec<String>,
    pub extension: bool,
    pub estimated_minutes: u32,
    pub answer: String,
    pub acceptable_alternatives: String,
    pub scoring: Vec<ScoringPoint>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Assessment {
    pub id: String,
    pub project_id: String,
    pub semester_id: String,
    #[serde(default = "initial_revision")]
    pub semester_revision: u32,
    pub lesson_id: Option<String>,
    pub title: String,
    pub kind: AssessmentKind,
    pub revision: u32,
    pub starts_at: i64,
    pub ends_at: i64,
    pub instructions: String,
    pub review_evidence: String,
    pub questions: Vec<Question>,
    pub published_at: i64,
    pub printed_at: Option<i64>,
    pub started_at: Option<i64>,
    pub stopped_at: Option<i64>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Submission {
    pub id: String,
    pub assessment_id: String,
    pub submitted_at: i64,
    pub resource_ids: Vec<String>,
    pub answers: String,
    pub unfinished: bool,
    /// Locally displayed completion times, not durations.
    pub question_times: Vec<QuestionTime>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct QuestionTime {
    pub question_id: String,
    pub local_time: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PointAward {
    pub question_id: String,
    pub point_id: String,
    pub awarded: u32,
    pub evidence: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ErrorAnalysis {
    pub question_id: String,
    pub cause: String,
    pub evidence: String,
    pub correction: String,
    pub next_check: String,
    pub retest_date: String,
    pub confirmed: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Grade {
    pub id: String,
    pub submission_id: String,
    pub assessment_revision: u32,
    pub graded_at: i64,
    pub awards: Vec<PointAward>,
    pub errors: Vec<ErrorAnalysis>,
    pub needs_review: bool,
    pub feedback: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Review {
    pub id: String,
    pub date: String,
    pub project_id: String,
    pub grade_ids: Vec<String>,
    pub findings: String,
    pub actions: Vec<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TeachingEvent {
    pub id: String,
    pub project_id: String,
    pub kind: String,
    pub source_id: String,
    pub state: String,
    pub created_at: i64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "camelCase", deny_unknown_fields)]
pub enum Command {
    SaveProject { project: ProjectStudy },
    SaveResource { resource: Resource },
    SaveSemester { semester: Semester },
    SaveLesson { lesson: Lesson },
    AttendLesson { id: String, progress: String },
    PublishAssessment { assessment: Assessment },
    ConfirmPrinted { id: String },
    StartExam { id: String },
    Submit { submission: Submission },
    Grade { grade: Grade },
    SaveReview { review: Review },
    ClaimEvent { id: String },
    FinishEvent { id: String },
    RetryEvent { id: String },
}
impl Command {
    pub fn assistant_only(&self) -> bool {
        matches!(
            self,
            Self::SaveSemester { .. }
                | Self::SaveLesson { .. }
                | Self::PublishAssessment { .. }
                | Self::Grade { .. }
                | Self::SaveReview { .. }
                | Self::FinishEvent { .. }
                | Self::ClaimEvent { .. }
        )
    }
}
fn initial_revision() -> u32 {
    1
}
fn check(ok: bool, message: &str) -> AppResult<()> {
    if ok {
        Ok(())
    } else {
        Err(message.into())
    }
}
fn text(s: &str) -> bool {
    !s.trim().is_empty() && s.len() <= 50_000
}
fn date(s: &str) -> bool {
    s.len() == 10 && chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok()
}
fn local(at: i64) -> AppResult<chrono::DateTime<Local>> {
    Local
        .timestamp_opt(at, 0)
        .single()
        .ok_or_else(|| "无效的教学时间".into())
}
fn relative(path: &str) -> bool {
    !path.is_empty()
        && !path.contains('\\')
        && !std::path::Path::new(path).is_absolute()
        && std::path::Path::new(path)
            .components()
            .all(|p| matches!(p, std::path::Component::Normal(_)))
}
fn unique<'a>(ids: impl Iterator<Item = &'a str>) -> AppResult<()> {
    let mut seen = HashSet::new();
    for id in ids {
        check(
            !id.trim().is_empty() && id.len() <= 200 && seen.insert(id),
            "教学实体 ID 为空、过长或重复",
        )?;
    }
    Ok(())
}
impl Education {
    fn event(&mut self, project: &str, kind: &str, source: &str, at: i64) {
        let id = format!("{kind}:{source}");
        if !self.events.iter().any(|e| e.id == id) {
            self.events.push(TeachingEvent {
                id,
                project_id: project.into(),
                kind: kind.into(),
                source_id: source.into(),
                state: "pending".into(),
                created_at: at,
            });
        }
    }
    pub fn tick(&mut self, at: i64) -> bool {
        let mut changed = false;
        let mut events = Vec::new();
        for lesson in &mut self.lessons {
            if matches!(lesson.state, LessonState::Planned | LessonState::Active)
                && at >= lesson.ends_at
            {
                lesson.state = if lesson.attended {
                    LessonState::Ended
                } else {
                    LessonState::Missed
                };
                if lesson.ai_enabled && lesson.attended {
                    events.push((lesson.project_id.clone(), "homework", lesson.id.clone()));
                }
                changed = true;
            } else if lesson.state == LessonState::Planned && at >= lesson.starts_at {
                lesson.state = LessonState::Active;
                changed = true;
            }
        }
        for a in &mut self.assessments {
            if (a.kind == AssessmentKind::Homework || a.started_at.is_some())
                && a.stopped_at.is_none()
                && at >= a.ends_at
            {
                a.stopped_at = Some(a.ends_at);
                changed = true;
            }
        }
        for (p, k, s) in events {
            self.event(&p, k, &s, at);
        }
        // A daily review is durable, including days where the application was closed at 08:30.
        let grades = self
            .grades
            .iter()
            .filter(|g| {
                crate::date_at(g.graded_at) < crate::date_at(at)
                    && local(at).is_ok_and(|dt| dt.hour() * 60 + dt.minute() >= 510)
            })
            .filter_map(|g| {
                let sub = self.submissions.iter().find(|s| s.id == g.submission_id)?;
                let a = self
                    .assessments
                    .iter()
                    .find(|a| a.id == sub.assessment_id)?;
                Some((a.project_id.clone(), crate::date_at(g.graded_at)))
            })
            .collect::<HashSet<_>>();
        for (p, d) in grades {
            let n = self.events.len();
            self.event(&p, "review", &format!("{p}:{d}"), at);
            changed |= self.events.len() != n;
        }
        if let Ok(dt) = local(at) {
            if dt.weekday().number_from_monday() >= 5 {
                let terms = self
                    .semesters
                    .iter()
                    .filter(|s| {
                        s.start_date <= crate::date_at(at)
                            && s.end_date >= crate::date_at(at)
                            && self
                                .projects
                                .iter()
                                .any(|p| p.project_id == s.project_id && p.exam_mode)
                    })
                    .map(|s| {
                        let start =
                            chrono::NaiveDate::parse_from_str(&s.start_date, "%Y-%m-%d").unwrap();
                        (
                            s.project_id.clone(),
                            format!(
                                "{}:week{}",
                                s.id,
                                (dt.date_naive() - start).num_days() / 7 + 1
                            ),
                        )
                    })
                    .collect::<Vec<_>>();
                for (p, source) in terms {
                    let n = self.events.len();
                    self.event(&p, "weeklyExam", &source, at);
                    changed |= self.events.len() != n;
                }
            }
        }
        changed
    }
    pub fn apply(&mut self, command: Command, at: i64) -> AppResult<()> {
        macro_rules! save {
            ($list:ident, $value:expr, $key:ident) => {{
                let value = $value;
                if let Some(old) = self.$list.iter_mut().find(|x| x.$key == value.$key) {
                    *old = value;
                } else {
                    self.$list.push(value);
                }
            }};
        }
        match command {
            Command::SaveProject { project } => {
                save!(projects, project, project_id);
            }
            Command::SaveResource { resource } => {
                save!(resources, resource, id);
            }
            Command::SaveSemester { semester } => {
                if let Some(old) = self.semesters.iter().find(|s| s.id == semester.id) {
                    check(
                        semester.revision == old.revision + 1,
                        "学期计划更新必须递增版本",
                    )?;
                    self.semester_history.push(old.clone());
                }
                save!(semesters, semester, id);
            }
            Command::SaveLesson { mut lesson } => {
                lesson.semester_revision = self
                    .semesters
                    .iter()
                    .find(|s| s.id == lesson.semester_id)
                    .ok_or("学期计划不存在")?
                    .revision;
                check(lesson.starts_at > at, "课程必须安排在未来")?;
                check(
                    !self.lessons.iter().any(|l| {
                        l.id == lesson.id && (l.state != LessonState::Planned || l.attended)
                    }),
                    "已开始课程保留历史，不能改写",
                )?;
                lesson.state = LessonState::Planned;
                lesson.attended = false;
                save!(lessons, lesson, id);
            }
            Command::AttendLesson { id, progress } => {
                let l = self
                    .lessons
                    .iter_mut()
                    .find(|l| l.id == id)
                    .ok_or("课程不存在")?;
                check(at >= l.starts_at && at < l.ends_at, "只能在上课时确认参与")?;
                l.attended = true;
                l.progress = progress;
            }
            Command::PublishAssessment { mut assessment } => {
                check(
                    self.projects
                        .iter()
                        .any(|p| p.project_id == assessment.project_id && p.exam_mode),
                    "发布作业和试卷前请启用应试模式",
                )?;
                check(
                    !self.assessments.iter().any(|a| a.id == assessment.id),
                    "已发布题目和评分标准不可修改；请发布新 ID 的修订版",
                )?;
                check(assessment.ends_at > at, "不能发布已截止的作业或试卷")?;
                assessment.semester_revision = self
                    .semesters
                    .iter()
                    .find(|s| s.id == assessment.semester_id)
                    .ok_or("学期计划不存在")?
                    .revision;
                assessment.published_at = at;
                assessment.printed_at = None;
                assessment.started_at = None;
                assessment.stopped_at = None;
                self.assessments.push(assessment);
            }
            Command::ConfirmPrinted { id } => {
                let a = self
                    .assessments
                    .iter_mut()
                    .find(|a| a.id == id)
                    .ok_or("试卷不存在")?;
                a.printed_at = Some(at);
            }
            Command::StartExam { id } => {
                let a = self
                    .assessments
                    .iter_mut()
                    .find(|a| a.id == id)
                    .ok_or("试卷不存在")?;
                check(
                    a.kind != AssessmentKind::Homework
                        && a.printed_at.is_some()
                        && a.started_at.is_none()
                        && at >= a.starts_at
                        && at < a.ends_at,
                    "请先打印试卷与答题卡，并在考试窗口开始考试",
                )?;
                a.started_at = Some(at);
            }
            Command::Submit { mut submission } => {
                check(
                    !self.submissions.iter().any(|s| s.id == submission.id),
                    "提交版本不可覆盖",
                )?;
                let a = self
                    .assessments
                    .iter()
                    .find(|a| a.id == submission.assessment_id)
                    .ok_or("作业/考试不存在")?;
                check(at >= a.starts_at, "尚未开始，不能提交")?;
                if a.kind != AssessmentKind::Homework {
                    check(
                        a.started_at.is_some() && a.stopped_at.is_some(),
                        "考试结束停笔后才能上传答题卡",
                    )?;
                    check(
                        !submission.resource_ids.is_empty(),
                        "考试需要上传纸质答题卡",
                    )?;
                }
                check(
                    text(&submission.answers)
                        || !submission.resource_ids.is_empty()
                        || submission.unfinished,
                    "请提供答案、附件或标记未完成",
                )?;
                submission.submitted_at = at;
                let project = a.project_id.clone();
                let source = submission.id.clone();
                self.submissions.push(submission);
                self.event(&project, "grade", &source, at);
            }
            Command::Grade { mut grade } => {
                check(
                    !self.grades.iter().any(|g| g.id == grade.id),
                    "批改历史不可覆盖，复核请新增批改记录",
                )?;
                grade.graded_at = at;
                self.grades.push(grade);
            }
            Command::SaveReview { review } => {
                check(
                    !self.reviews.iter().any(|r| r.id == review.id),
                    "复盘历史不可覆盖",
                )?;
                self.reviews.push(review);
            }
            Command::ClaimEvent { id } => {
                self.events
                    .iter_mut()
                    .find(|e| e.id == id && e.state == "pending")
                    .ok_or("事件已处理")?
                    .state = "running".into();
            }
            Command::FinishEvent { id } => {
                let event = self
                    .events
                    .iter()
                    .find(|e| e.id == id)
                    .ok_or("教学事件不存在")?;
                let produced = match event.kind.as_str() {
                    "homework" => self.assessments.iter().any(|a| {
                        a.kind == AssessmentKind::Homework
                            && a.lesson_id.as_ref() == Some(&event.source_id)
                    }),
                    "weeklyExam" => self.assessments.iter().any(|a| {
                        a.project_id == event.project_id
                            && a.kind == AssessmentKind::WeeklyExam
                            && a.published_at >= event.created_at
                    }),
                    "grade" => self
                        .grades
                        .iter()
                        .any(|g| g.submission_id == event.source_id),
                    "review" => self.reviews.iter().any(|r| {
                        r.project_id == event.project_id && event.source_id.ends_with(&r.date)
                    }),
                    _ => false,
                };
                check(produced, "请先保存本次教学事件的实际产物")?;
                self.events.iter_mut().find(|e| e.id == id).unwrap().state = "done".into();
            }
            Command::RetryEvent { id } => {
                self.events
                    .iter_mut()
                    .find(|e| e.id == id && e.state != "done")
                    .ok_or("没有可重试的教学事件")?
                    .state = "pending".into();
            }
        }
        Ok(())
    }
}
pub fn validate(data: &AppData) -> AppResult<()> {
    let e = &data.education;
    unique(
        e.resources
            .iter()
            .map(|x| x.id.as_str())
            .chain(e.semesters.iter().map(|x| x.id.as_str()))
            .chain(e.lessons.iter().map(|x| x.id.as_str()))
            .chain(e.assessments.iter().map(|x| x.id.as_str()))
            .chain(e.submissions.iter().map(|x| x.id.as_str()))
            .chain(e.grades.iter().map(|x| x.id.as_str()))
            .chain(e.reviews.iter().map(|x| x.id.as_str())),
    )?;
    unique(e.projects.iter().map(|p| p.project_id.as_str()))?;
    unique(e.events.iter().map(|p| p.id.as_str()))?;
    let project_exists = |id: &str| data.projects.iter().any(|p| p.id == id);
    let resource = |id: &str, p: &str| e.resources.iter().find(|r| r.id == id && r.project_id == p);
    check(
        e.lessons.len() + e.assessments.len() + e.submissions.len() + e.grades.len() <= 100_000,
        "教学记录数量超出限制",
    )?;
    for p in &e.projects {
        check(
            project_exists(&p.project_id) && std::path::Path::new(&p.directory).is_absolute(),
            "项目必须绑定绝对目录",
        )?;
        check(
            p.exam_date.as_ref().is_none_or(|d| date(d)),
            "无效的考试日期",
        )?;
        if p.exam_mode {
            check(
                p.vision_id
                    .as_ref()
                    .is_some_and(|id| data.visions.iter().any(|v| &v.id == id))
                    && text(&p.target),
                "应试模式必须绑定愿景并明确院校、专业、年份和科目目标",
            )?;
            check(
                p.syllabus_id.as_ref().is_some_and(|id| {
                    resource(id, &p.project_id).is_some_and(|r| r.kind == ResourceKind::Syllabus)
                }),
                "应试模式必须绑定考纲",
            )?;
            check(
                !p.past_paper_ids.is_empty()
                    && p.past_paper_ids.iter().all(|id| {
                        resource(id, &p.project_id)
                            .is_some_and(|r| r.kind == ResourceKind::PastPaper)
                    }),
                "应试模式必须绑定真题",
            )?;
            check(
                !p.mock_paper_ids.is_empty()
                    && p.mock_paper_ids.iter().all(|id| {
                        resource(id, &p.project_id)
                            .is_some_and(|r| r.kind == ResourceKind::MockPaper)
                    }),
                "应试模式必须绑定模拟题",
            )?;
        }
    }
    for r in &e.resources {
        check(
            e.projects.iter().any(|p| p.project_id == r.project_id)
                && text(&r.title)
                && relative(&r.path),
            "资源需要所属项目、名称和安全的相对路径",
        )?;
    }
    for s in &e.semesters {
        check(
            e.projects.iter().any(|p| p.project_id == s.project_id)
                && text(&s.title)
                && date(&s.start_date)
                && date(&s.end_date)
                && s.start_date <= s.end_date
                && s.revision > 0
                && text(&s.baseline)
                && text(&s.rationale)
                && !s.evidence.is_empty()
                && !s.milestones.is_empty(),
            "学期计划缺少日期、学情诊断、依据或阶段进度",
        )?;
        for m in &s.milestones {
            check(
                m.week > 0
                    && !m.topics.is_empty()
                    && text(&m.objective)
                    && m.lesson_count > 0
                    && m.resource_ids
                        .iter()
                        .all(|id| resource(id, &s.project_id).is_some()),
                "无效的周进度或学习资源",
            )?;
        }
    }
    for l in &e.lessons {
        let s = e
            .semesters
            .iter()
            .chain(e.semester_history.iter())
            .find(|s| {
                s.id == l.semester_id
                    && s.project_id == l.project_id
                    && s.revision == l.semester_revision
            })
            .ok_or("课程必须绑定本项目学期计划")?;
        check(
            text(&l.title)
                && !l.topics.is_empty()
                && l.ends_at - l.starts_at == 45 * 60
                && crate::date_at(l.starts_at) >= s.start_date
                && crate::date_at(l.ends_at) <= s.end_date
                && l.resource_ids
                    .iter()
                    .all(|id| resource(id, &l.project_id).is_some()),
            "课程需要45分钟、知识点和有效资源，且在学期范围内",
        )?;
        let dt = local(l.starts_at)?;
        let minute = dt.hour() * 60 + dt.minute();
        check(
            (8 * 60..12 * 60 + 40).contains(&minute) || (14 * 60..18 * 60 + 15).contains(&minute),
            "课程须在上午或下午，晚间19–22点留给作业",
        )?;
        let same = e
            .lessons
            .iter()
            .filter(|x| crate::date_at(x.starts_at) == crate::date_at(l.starts_at));
        let (mut morning, mut afternoon) = (0, 0);
        for x in same {
            if local(x.starts_at)?.hour() < 12 {
                morning += 1;
            } else {
                afternoon += 1;
            }
        }
        check(
            morning <= 4 && afternoon <= 4,
            "跨项目每天最多上午4节、下午4节",
        )?;
        check(
            !e.lessons
                .iter()
                .any(|x| x.id != l.id && x.starts_at < l.ends_at && x.ends_at > l.starts_at),
            "跨项目课程时间冲突",
        )?;
        for b in &data.blocks {
            if b.attention == crate::blocks::Attention::Required {
                check(
                    b.overlap_minutes(dt.date_naive(), minute, minute + 45) == 0,
                    "课程与需专心的固定占用冲突",
                )?;
            }
        }
    }
    for a in &e.assessments {
        check(
            e.projects.iter().any(|p| p.project_id == a.project_id),
            "AI作业和考试需要启用应试模式",
        )?;
        check(
            e.semesters
                .iter()
                .chain(e.semester_history.iter())
                .any(|s| {
                    s.id == a.semester_id
                        && s.project_id == a.project_id
                        && s.revision == a.semester_revision
                }),
            "试题必须绑定学期计划",
        )?;
        check(
            a.revision > 0
                && a.starts_at < a.ends_at
                && text(&a.title)
                && text(&a.review_evidence)
                && text(&a.instructions)
                && !a.questions.is_empty(),
            "发布前必须准备题目、考试说明、答案和独立复核记录",
        )?;
        if a.kind == AssessmentKind::Homework {
            check(
                a.lesson_id.as_ref().is_some_and(|id| {
                    e.lessons.iter().any(|l| {
                        &l.id == id
                            && l.project_id == a.project_id
                            && l.ai_enabled
                            && l.state == LessonState::Ended
                    })
                }),
                "作业必须来自本项目已结束的AI课程",
            )?;
        }
        if a.kind == AssessmentKind::WeeklyExam {
            check(
                local(a.starts_at)?.weekday().number_from_monday() >= 6,
                "周考安排在周末",
            )?;
        }
        if a.kind != AssessmentKind::Homework {
            check(
                !e.lessons
                    .iter()
                    .any(|l| l.starts_at < a.ends_at && l.ends_at > a.starts_at)
                    && !e.assessments.iter().any(|b| {
                        b.id != a.id
                            && b.kind != AssessmentKind::Homework
                            && b.starts_at < a.ends_at
                            && b.ends_at > a.starts_at
                    }),
                "考试与课程或其他考试冲突",
            )?;
        }
        unique(a.questions.iter().map(|q| q.id.as_str()))?;
        for q in &a.questions {
            check(
                text(&q.prompt)
                    && text(&q.answer)
                    && !q.topics.is_empty()
                    && q.estimated_minutes > 0
                    && !q.scoring.is_empty()
                    && !q.source_ids.is_empty()
                    && q.source_ids
                        .iter()
                        .all(|id| resource(id, &a.project_id).is_some()),
                "每题必须有来源、知识点、估时、答案和评分点",
            )?;
            unique(q.scoring.iter().map(|p| p.id.as_str()))?;
            for p in &q.scoring {
                check(
                    p.points > 0 && text(&p.description),
                    "评分点需要分值与判分依据",
                )?;
            }
            if !q.extension && a.kind != AssessmentKind::MockExam {
                check(
                    q.topics.iter().all(|t| {
                        e.lessons.iter().any(|l| {
                            l.project_id == a.project_id
                                && l.state == LessonState::Ended
                                && l.topics.contains(t)
                        })
                    }),
                    "基础练习不能包含尚未授课的知识点；拓展题须明确标记",
                )?;
            }
        }
    }
    for s in &e.submissions {
        let a = e
            .assessments
            .iter()
            .find(|a| a.id == s.assessment_id)
            .ok_or("提交引用了不存在的试题")?;
        check(
            s.resource_ids
                .iter()
                .all(|id| resource(id, &a.project_id).is_some()),
            "答卷附件必须属于本项目",
        )?;
        unique(s.question_times.iter().map(|t| t.question_id.as_str()))?;
        for t in &s.question_times {
            check(
                a.questions.iter().any(|q| q.id == t.question_id)
                    && t.local_time.len() == 5
                    && chrono::NaiveTime::parse_from_str(&t.local_time, "%H:%M").is_ok(),
                "每题记录本机HH:MM完成时刻",
            )?;
        }
    }
    for g in &e.grades {
        let s = e
            .submissions
            .iter()
            .find(|s| s.id == g.submission_id)
            .ok_or("批改缺少提交版本")?;
        let a = e
            .assessments
            .iter()
            .find(|a| a.id == s.assessment_id)
            .ok_or("试题不存在")?;
        check(
            g.assessment_revision == a.revision && text(&g.feedback),
            "批改必须引用发布时的评分版本并给出反馈",
        )?;
        let mut seen = HashSet::new();
        for award in &g.awards {
            let point = a
                .questions
                .iter()
                .find(|q| q.id == award.question_id)
                .and_then(|q| q.scoring.iter().find(|p| p.id == award.point_id))
                .ok_or("批改不能临时增加评分点")?;
            check(
                award.awarded <= point.points
                    && text(&award.evidence)
                    && seen.insert((&award.question_id, &award.point_id)),
                "评分超范围、重复或缺少答卷证据",
            )?;
        }
        check(
            g.needs_review
                || g.awards.len() == a.questions.iter().map(|q| q.scoring.len()).sum::<usize>(),
            "正式批改必须覆盖全部评分点；识别不清请标记待复核",
        )?;
        for error in &g.errors {
            check(
                a.questions.iter().any(|q| q.id == error.question_id)
                    && text(&error.cause)
                    && text(&error.evidence)
                    && text(&error.correction)
                    && text(&error.next_check)
                    && date(&error.retest_date),
                "错因分析需要证据、纠正动作和复测日期",
            )?;
        }
    }
    for r in &e.reviews {
        check(
            project_exists(&r.project_id)
                && date(&r.date)
                && text(&r.findings)
                && !r.actions.is_empty()
                && !r.grade_ids.is_empty()
                && r.grade_ids.iter().all(|id| {
                    e.grades.iter().any(|g| {
                        &g.id == id
                            && e.submissions.iter().any(|s| {
                                s.id == g.submission_id
                                    && e.assessments.iter().any(|a| {
                                        a.id == s.assessment_id && a.project_id == r.project_id
                                    })
                            })
                    })
                }),
            "复盘必须引用本项目批改并给出后续行动",
        )?;
    }
    for event in &e.events {
        check(
            project_exists(&event.project_id)
                && ["pending", "running", "done"].contains(&event.state.as_str())
                && ["homework", "grade", "review", "weeklyExam"].contains(&event.kind.as_str()),
            "无效的教学事件",
        )?;
    }
    Ok(())
}
/// Imports may restore records, but cannot silently rewrite released questions or history.
pub fn validate_transition(before: &Education, after: &Education) -> AppResult<()> {
    for a in &before.assessments {
        if let Some(b) = after.assessments.iter().find(|b| b.id == a.id) {
            let mut old = a.clone();
            old.printed_at = b.printed_at;
            old.started_at = b.started_at;
            old.stopped_at = b.stopped_at;
            check(old == *b, "已发布题目与评分标准不可被导入或补丁改写")?;
        }
    }
    for s in &before.submissions {
        check(
            after
                .submissions
                .iter()
                .find(|b| b.id == s.id)
                .is_none_or(|b| b == s),
            "提交历史不可改写",
        )?;
    }
    for g in &before.grades {
        check(
            after
                .grades
                .iter()
                .find(|b| b.id == g.id)
                .is_none_or(|b| b == g),
            "批改历史不可改写",
        )?;
    }
    Ok(())
}

#[cfg(test)]
#[path = "education_tests.rs"]
mod tests;
