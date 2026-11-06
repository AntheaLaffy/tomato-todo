use super::*;
use serde_json::{json, Value};
fn at(day: u32, h: u32, m: u32) -> i64 {
    Local
        .with_ymd_and_hms(2026, 11, day, h, m, 0)
        .single()
        .unwrap()
        .timestamp()
}
fn command(data: &mut AppData, value: Value, time: i64) -> AppResult<()> {
    let mut next = data.clone();
    next.apply(
        crate::Action::Education {
            command: serde_json::from_value(value).unwrap(),
        },
        time,
    )?;
    validate_transition(&data.education, &next.education)?;
    *data = next;
    Ok(())
}
fn fixture() -> AppData {
    let mut data = AppData::default();
    let p = data.projects[0].id.clone();
    data.visions.push(crate::Vision {
        id: "vision".into(),
        name: "目标院校".into(),
        notes: "2027年目标专业".into(),
        project_id: None,
    });
    data.education=serde_json::from_value(json!({
        "projects":[{"projectId":p,"directory":std::env::temp_dir().join("teaching-fixture"),"examMode":true,"visionId":"vision","target":"2027年目标院校计算机专业 数学一 120分","examDate":"2027-12-25","syllabusId":"syllabus","pastPaperIds":["past"],"mockPaperIds":["mock"]}],
        "resources":[
            {"id":"syllabus","projectId":p,"title":"考纲","kind":"syllabus","path":"syllabus.pdf","source":"官方","edition":"2027","topics":["极限"]},
            {"id":"past","projectId":p,"title":"真题","kind":"pastPaper","path":"past.pdf","source":"历年真题","edition":"2026","topics":["极限"]},
            {"id":"mock","projectId":p,"title":"模拟题","kind":"mockPaper","path":"mock.pdf","source":"模拟卷","edition":"2027","topics":["极限"]}
        ],
        "semesters":[{"id":"term","projectId":p,"title":"基础学期","startDate":"2026-11-01","endDate":"2026-12-31","revision":1,"baseline":"极限基础薄弱","evidence":["课程目录与官方考纲；同科目经验尚缺，待补"],"rationale":"先补基础再限时训练","milestones":[{"week":1,"topics":["极限"],"resourceIds":["mock"],"objective":"能独立处理基本极限","lessonCount":4}]}],
        "lessons":[],"assessments":[],"submissions":[],"grades":[],"reviews":[],"events":[]
    })).unwrap();
    data.validate().unwrap();
    data
}
fn lesson(data: &AppData, id: &str, start: i64) -> Value {
    json!({"op":"saveLesson","lesson":{"id":id,"projectId":data.projects[0].id,"semesterId":"term","title":"极限基础","topics":["极限"],"resourceIds":["mock"],"startsAt":start,"endsAt":start+2700,"aiEnabled":true,"attended":false,"progress":"","state":"planned"}})
}
fn finish_lesson(data: &mut AppData) {
    command(data, lesson(data, "lesson", at(2, 8, 30)), at(1, 8, 0)).unwrap();
    command(
        data,
        json!({"op":"attendLesson","id":"lesson","progress":"完成课程，概念待复测"}),
        at(2, 8, 35),
    )
    .unwrap();
    data.tick(at(2, 9, 15));
    data.validate().unwrap();
}
fn assessment(data: &AppData, kind: &str) -> Value {
    json!({"op":"publishAssessment","assessment":{
        "id":"assessment","projectId":data.projects[0].id,"semesterId":"term","lessonId":"lesson","title":"极限练习","kind":kind,"revision":1,"startsAt":at(7,19,0),"endsAt":at(7,22,0),"instructions":"到点停笔，记录本机HH:MM","reviewEvidence":"独立复解并代入验证所有答案","questions":[{"id":"q1","prompt":"求极限","topics":["极限"],"sourceIds":["mock"],"extension":false,"estimatedMinutes":180,"answer":"1","acceptableAlternatives":"等价推导","scoring":[{"id":"p1","description":"正确使用极限法则","points":5}]}],"publishedAt":0,"printedAt":null,"startedAt":null,"stoppedAt":null
    }})
}
#[test]
fn exam_configuration_requires_vision_syllabus_and_both_paper_types() {
    let data = fixture();
    for field in ["visionId", "syllabusId"] {
        let mut candidate = data.clone();
        let mut p = serde_json::to_value(&candidate.education.projects[0]).unwrap();
        p[field] = Value::Null;
        candidate.education.projects[0] = serde_json::from_value(p).unwrap();
        assert!(candidate.validate().is_err());
    }
    let mut candidate = data.clone();
    candidate.education.projects[0].mock_paper_ids.clear();
    assert!(candidate.validate().is_err());
    let mut candidate = data.clone();
    candidate.education.resources[0].path = "../outside".into();
    assert!(candidate.validate().is_err());
}
#[test]
fn wall_clock_lessons_do_not_fabricate_attendance_or_mastery() {
    let mut data = fixture();
    command(
        &mut data,
        lesson(&fixture(), "absent", at(2, 8, 30)),
        at(1, 8, 0),
    )
    .unwrap_err(); // Cross-project references must fail.
    let planned = lesson(&data, "absent", at(2, 8, 30));
    command(&mut data, planned, at(1, 8, 0)).unwrap();
    data.tick(at(2, 9, 15));
    assert_eq!(data.education.lessons[0].state, LessonState::Missed);
    assert!(!data.education.events.iter().any(|e| e.kind == "homework"));
    let mut data = fixture();
    finish_lesson(&mut data);
    assert_eq!(data.education.lessons[0].state, LessonState::Ended);
    assert_eq!(
        data.education
            .events
            .iter()
            .filter(|e| e.kind == "homework")
            .count(),
        1
    );
    assert!(!data.tick(at(2, 9, 16)));
    assert_eq!(
        data.education
            .events
            .iter()
            .filter(|e| e.kind == "homework")
            .count(),
        1
    );
    assert!(data.sessions.is_empty());
}

#[test]
fn scheduled_lessons_materialize_once_and_updates_keep_the_same_focus_task() {
    let mut data = fixture();
    command(
        &mut data,
        lesson(&fixture(), "bad", at(2, 8, 30)),
        at(1, 8, 0),
    )
    .unwrap_err();
    let request = lesson(&data, "focus-lesson", at(2, 8, 30));
    command(&mut data, request.clone(), at(1, 8, 0)).unwrap();
    let task = data.tasks[0].clone();
    assert_eq!(task.due_date.as_deref(), Some("2026-11-02"));
    assert_eq!(task.reminder_time.as_deref(), Some("08:30"));
    assert_eq!(task.focus_minutes, Some(45));
    assert_eq!(data.education.focus_tasks.len(), 1);
    assert!(!data.tick(at(1, 8, 1)));
    let mut revised = request;
    revised["lesson"]["startsAt"] = json!(at(3, 10, 0));
    revised["lesson"]["endsAt"] = json!(at(3, 10, 45));
    command(&mut data, revised, at(1, 8, 2)).unwrap();
    assert_eq!(data.tasks.len(), 1);
    assert_eq!(data.tasks[0].id, task.id);
    assert_eq!(data.tasks[0].due_date.as_deref(), Some("2026-11-03"));
    let mut plan = data.export_plan();
    assert!(plan.tasks.is_empty());
    plan.replace = true;
    data.apply(crate::Action::ImportPlan { plan }, at(1, 8, 3))
        .unwrap();
    assert_eq!(data.tasks[0].id, task.id);
    assert!(data
        .apply(
            crate::Action::DeleteTask {
                id: task.id.clone()
            },
            at(1, 8, 4)
        )
        .is_err());
    data.apply(
        crate::Action::SelectTask {
            id: Some(task.id.clone()),
        },
        at(3, 10, 0),
    )
    .unwrap();
    data.apply(crate::Action::StartTimer, at(3, 10, 0)).unwrap();
    assert!(data.education.lessons[0].attended);
    data.apply(crate::Action::ToggleTask { id: task.id }, at(3, 10, 10))
        .unwrap();
    data.tick(at(3, 10, 45));
    assert_eq!(
        data.education
            .events
            .iter()
            .filter(|e| e.kind == "homework")
            .count(),
        1
    );
    assert!(!data
        .education
        .events
        .iter()
        .any(|e| e.kind == "taskHomework"));
    assert_eq!(data.education.completed_tasks[0].topics, vec!["极限"]);
    assert!(data.education.progress.is_empty());
    data.validate().unwrap();
}

#[test]
fn course_resources_can_be_assigned_only_before_class_from_same_project() {
    let mut data = fixture();
    let request = lesson(&data, "resources-lesson", at(2, 8, 30));
    command(&mut data, request, at(1, 8, 0)).unwrap();
    let task_id = data.education.focus_tasks[0].task_id.clone();
    let set =
        |ids: &[&str]| json!({"op":"setLessonResources","id":"resources-lesson","resourceIds":ids});
    command(&mut data, set(&["past", "syllabus"]), at(1, 8, 1)).unwrap();
    assert_eq!(
        data.education.lessons[0].resource_ids,
        vec!["past", "syllabus"]
    );
    assert_eq!(data.education.focus_tasks[0].task_id, task_id);
    assert_eq!(data.tasks.len(), 1);
    let before = data.education.lessons[0].resource_ids.clone();
    assert!(command(&mut data, set(&["missing"]), at(1, 8, 2)).is_err());
    assert!(command(&mut data, set(&["past", "past"]), at(1, 8, 2)).is_err());
    let mut another = data.clone();
    another
        .education
        .resources
        .push(crate::education::Resource {
            id: "other-project-resource".into(),
            project_id: "another-project".into(),
            ..another.education.resources[0].clone()
        });
    let cross_project: Command = serde_json::from_value(set(&["other-project-resource"])).unwrap();
    assert!(another.education.apply(cross_project, at(1, 8, 3)).is_err());
    assert_eq!(data.education.lessons[0].resource_ids, before);
    assert!(command(&mut data, set(&["mock"]), at(2, 8, 30)).is_err());
    assert_eq!(data.education.lessons[0].resource_ids, before);
    let mut attended = fixture();
    let request = lesson(&attended, "resources-lesson", at(2, 8, 30));
    command(&mut attended, request, at(1, 8, 0)).unwrap();
    command(
        &mut attended,
        json!({"op":"attendLesson","id":"resources-lesson","progress":"已学"}),
        at(2, 8, 31),
    )
    .unwrap();
    assert!(command(&mut attended, set(&["mock"]), at(2, 8, 32)).is_err());
    data.validate().unwrap();
}

#[test]
fn homework_focus_tasks_complete_only_with_a_finished_submission() {
    let mut data = fixture();
    finish_lesson(&mut data);
    let packet = assessment(&data, "homework");
    command(&mut data, packet, at(7, 18, 0)).unwrap();
    let link = data
        .education
        .focus_tasks
        .iter()
        .find(|l| l.kind == crate::teaching_tasks::TeachingTaskKind::Homework)
        .unwrap()
        .clone();
    assert!(data
        .apply(
            crate::Action::ToggleTask {
                id: link.task_id.clone()
            },
            at(7, 19, 0)
        )
        .is_err());
    for (id, unfinished) in [("part", true), ("finished", false)] {
        command(&mut data, json!({"op":"submit","submission":{"id":id,"assessmentId":"assessment","submittedAt":0,"resourceIds":[],"answers":"已完成部分","unfinished":unfinished,"questionTimes":[]}}), at(7, 19, if unfinished { 10 } else { 20 })).unwrap();
        assert_eq!(
            data.tasks
                .iter()
                .find(|t| t.id == link.task_id)
                .unwrap()
                .completed,
            !unfinished
        );
    }
    assert!(!data
        .sessions
        .iter()
        .any(|s| s.task_id.as_ref() == Some(&link.task_id)));
    assert!(!data
        .education
        .events
        .iter()
        .any(|e| e.kind == "taskHomework"));
    let restored: AppData = serde_json::from_value(serde_json::to_value(&data).unwrap()).unwrap();
    assert_eq!(restored.education.focus_tasks, data.education.focus_tasks);
    restored.validate().unwrap();
}

#[test]
fn an_automatic_course_timer_does_not_confirm_attendance() {
    let mut data = fixture();
    data.settings.auto_start_tasks = true;
    let request = lesson(&data, "automatic-lesson", at(2, 8, 30));
    command(&mut data, request, at(1, 8, 0)).unwrap();
    data.tick(at(2, 8, 30));
    assert!(data.timer.running);
    assert!(!data.education.lessons[0].attended);
    assert!(data.education.progress.is_empty());
    assert!(data.education.events.iter().all(|e| e.kind != "homework"));
}
#[test]
fn cross_project_schedule_and_fixed_commitments_are_checked() {
    let mut data = fixture();
    let l = lesson(&data, "first", at(2, 8, 30));
    command(&mut data, l, at(1, 8, 0)).unwrap();
    let overlapping = lesson(&data, "second", at(2, 8, 45));
    assert!(command(&mut data, overlapping, at(1, 8, 0)).is_err());
    let mut wrong = lesson(&data, "wrong", at(2, 10, 0));
    wrong["lesson"]["endsAt"] = json!(at(2, 10, 30));
    assert!(command(&mut data, wrong, at(1, 8, 0)).is_err());
    data.blocks.push(crate::blocks::Block {
        id: "fixed".into(),
        title: "正式课".into(),
        days: vec![1],
        start: "10:00".into(),
        end: "11:00".into(),
        attention: crate::blocks::Attention::Required,
        notes: String::new(),
    });
    let conflict = lesson(&data, "conflict", at(2, 10, 0));
    assert!(command(&mut data, conflict, at(1, 8, 0)).is_err());
}
#[test]
fn released_answers_and_rubrics_are_immutable_and_grades_use_evidence() {
    let mut data = fixture();
    finish_lesson(&mut data);
    let mut packet = assessment(&data, "homework");
    packet["assessment"]["questions"][0]["topics"] = json!(["尚未学过的积分"]);
    assert!(command(&mut data, packet, at(2, 10, 0)).is_err());
    let packet = assessment(&data, "homework");
    let manual: Command = serde_json::from_value(packet.clone()).unwrap();
    assert!(crate::check_user_action(&crate::Action::Education { command: manual }).is_err());
    command(&mut data, packet.clone(), at(2, 10, 0)).unwrap();
    assert!(command(&mut data, packet, at(2, 10, 1)).is_err());
    let mut edited = data.education.clone();
    edited.assessments[0].questions[0].answer = "2".into();
    assert!(validate_transition(&data.education, &edited).is_err());
    command(&mut data,json!({"op":"submit","submission":{"id":"sub","assessmentId":"assessment","submittedAt":0,"resourceIds":[],"answers":"1","unfinished":false,"questionTimes":[{"questionId":"q1","localTime":"21:35"}]}}),at(7,22,0)).unwrap();
    let grade = json!({"op":"grade","grade":{"id":"grade","submissionId":"sub","assessmentRevision":1,"gradedAt":0,"awards":[{"questionId":"q1","pointId":"p1","awarded":5,"evidence":"答卷写明极限法则并得到1"}],"errors":[],"needsReview":false,"feedback":"推导与答案均正确"}});
    let mut wrong = grade.clone();
    wrong["grade"]["awards"][0]["awarded"] = json!(6);
    assert!(command(&mut data, wrong, at(7, 22, 1)).is_err());
    command(&mut data, grade, at(7, 22, 1)).unwrap();
    data.tick(at(8, 8, 30));
    assert!(data.education.events.iter().any(|e| e.kind == "review"));
}
#[test]
fn assistant_adds_only_missing_paper_times_before_grading() {
    let mut data = fixture();
    finish_lesson(&mut data);
    let mut packet = assessment(&data, "homework");
    let mut second = packet["assessment"]["questions"][0].clone();
    second["id"] = json!("q2");
    second["scoring"][0]["id"] = json!("p2");
    packet["assessment"]["questions"]
        .as_array_mut()
        .unwrap()
        .push(second);
    command(&mut data, packet, at(2, 10, 0)).unwrap();
    command(&mut data, json!({"op":"submit","submission":{"id":"paper","assessmentId":"assessment","submittedAt":0,"resourceIds":[],"answers":"答题卡已写完成时刻","unfinished":false,"questionTimes":[{"questionId":"q1","localTime":"18:42"}]}}), at(7, 19, 1)).unwrap();
    let supplement = json!({"op":"recordQuestionTimes","id":"paper","questionTimes":[{"questionId":"q2","localTime":"18:51"}]});
    let manual: Command = serde_json::from_value(supplement.clone()).unwrap();
    assert!(crate::check_user_action(&crate::Action::Education { command: manual }).is_err());
    let mut invalid = supplement.clone();
    invalid["questionTimes"][0]["localTime"] = json!("06:51 PM");
    assert!(command(&mut data, invalid, at(7, 19, 2)).is_err());
    assert_eq!(data.education.submissions[0].question_times.len(), 1);
    assert_eq!(
        data.education.submissions[0].question_times[0].local_time,
        "18:42"
    );
    command(&mut data, supplement.clone(), at(7, 19, 2)).unwrap();
    assert_eq!(
        data.education.submissions[0].question_times[0].local_time,
        "18:42"
    );
    assert_eq!(
        data.education.submissions[0].question_times[1].local_time,
        "18:51"
    );
    assert!(command(&mut data, supplement, at(7, 19, 3)).is_err());
    let mut modified = data.education.clone();
    modified.submissions[0].question_times[1].local_time = "18:52".into();
    assert!(validate_transition(&data.education, &modified).is_err());
    let mut modified = data.education.clone();
    modified.submissions[0].answers = "篡改答卷".into();
    assert!(validate_transition(&data.education, &modified).is_err());
    let grade = json!({"op":"grade","grade":{"id":"grade","submissionId":"paper","assessmentRevision":1,"gradedAt":0,"awards":[{"questionId":"q1","pointId":"p1","awarded":5,"evidence":"答题卡写明极限法则"},{"questionId":"q2","pointId":"p2","awarded":5,"evidence":"答题卡写明极限法则"}],"errors":[],"needsReview":false,"feedback":"正确"}});
    command(&mut data, grade, at(7, 19, 4)).unwrap();
    assert!(command(&mut data, json!({"op":"recordQuestionTimes","id":"paper","questionTimes":[{"questionId":"q2","localTime":"18:52"}]}), at(7, 19, 5)).is_err());
}
#[test]
fn exam_requires_printing_stops_at_deadline_and_collects_paper() {
    let mut data = fixture();
    finish_lesson(&mut data);
    let exam = assessment(&data, "weeklyExam");
    command(&mut data, exam, at(6, 10, 0)).unwrap();
    assert!(command(
        &mut data,
        json!({"op":"startExam","id":"assessment"}),
        at(7, 19, 0)
    )
    .is_err());
    command(
        &mut data,
        json!({"op":"confirmPrinted","id":"assessment"}),
        at(7, 18, 0),
    )
    .unwrap();
    command(
        &mut data,
        json!({"op":"startExam","id":"assessment"}),
        at(7, 19, 0),
    )
    .unwrap();
    data.tick(at(7, 22, 5));
    assert_eq!(data.education.assessments[0].stopped_at, Some(at(7, 22, 0)));
    assert!(command(&mut data,json!({"op":"submit","submission":{"id":"sub","assessmentId":"assessment","submittedAt":0,"resourceIds":[],"answers":"1","unfinished":false,"questionTimes":[]}}),at(7,22,5)).is_err());
}
#[test]
fn exam_start_is_flexible_within_day_but_duration_and_submission_are_separate() {
    let mut data = fixture();
    finish_lesson(&mut data);
    let packet = assessment(&data, "mockExam");
    command(&mut data, packet, at(6, 10, 0)).unwrap();
    command(
        &mut data,
        json!({"op":"confirmPrinted","id":"assessment"}),
        at(6, 18, 0),
    )
    .unwrap();
    assert!(command(
        &mut data,
        json!({"op":"startExam","id":"assessment"}),
        at(6, 23, 0)
    )
    .is_err());
    let mut evening = data.clone();
    command(
        &mut data,
        json!({"op":"startExam","id":"assessment"}),
        at(7, 9, 0),
    )
    .unwrap();
    assert_eq!(data.education.assessments[0].exam_deadline(), at(7, 12, 0));
    data.tick(at(7, 11, 59));
    assert_eq!(data.education.assessments[0].stopped_at, None);
    data.tick(at(7, 12, 1));
    assert_eq!(data.education.assessments[0].stopped_at, Some(at(7, 12, 0)));
    assert_eq!(
        crate::learning::summaries(&data, at(7, 12, 1))[0]["assessments"][0]["status"],
        "awaitingSubmission"
    );
    command(&mut data,json!({"op":"submit","submission":{"id":"later-paper","assessmentId":"assessment","submittedAt":0,"resourceIds":["mock"],"answers":"停笔时的答卷","unfinished":false,"questionTimes":[]}}),at(9,11,0)).unwrap();
    let summary = crate::learning::summaries(&data, at(9, 11, 0));
    assert_eq!(summary[0]["assessments"][0]["status"], "submitted");
    assert_eq!(summary[0]["assessments"][0]["late"], false);

    command(
        &mut evening,
        json!({"op":"startExam","id":"assessment"}),
        at(7, 23, 30),
    )
    .unwrap();
    assert_eq!(
        evening.education.assessments[0].exam_deadline(),
        at(8, 2, 30)
    );
    evening.tick(at(8, 2, 29));
    assert_eq!(evening.education.assessments[0].stopped_at, None);
    evening.tick(at(8, 2, 31));
    assert_eq!(
        evening.education.assessments[0].stopped_at,
        Some(at(8, 2, 30))
    );
    assert_eq!(
        crate::learning::summaries(&evening, at(8, 2, 31))[0]["assessments"][0]["status"],
        "awaitingSubmission"
    );
    let mut missed = fixture();
    finish_lesson(&mut missed);
    let packet = assessment(&missed, "mockExam");
    command(&mut missed, packet, at(6, 10, 0)).unwrap();
    assert_eq!(
        crate::learning::summaries(&missed, at(7, 23, 59))[0]["assessments"][0]["status"],
        "upcoming"
    );
    assert_eq!(
        crate::learning::summaries(&missed, at(8, 0, 0))[0]["assessments"][0]["status"],
        "missed"
    );
    assert!(command(
        &mut missed,
        json!({"op":"startExam","id":"assessment"}),
        at(8, 0, 0)
    )
    .is_err());

    let mut late_publish = fixture();
    finish_lesson(&mut late_publish);
    let packet = assessment(&late_publish, "mockExam");
    command(&mut late_publish, packet, at(7, 22, 30)).unwrap();
    command(
        &mut late_publish,
        json!({"op":"confirmPrinted","id":"assessment"}),
        at(7, 22, 31),
    )
    .unwrap();
    command(
        &mut late_publish,
        json!({"op":"startExam","id":"assessment"}),
        at(7, 23, 0),
    )
    .unwrap();
    assert_eq!(
        late_publish.education.assessments[0].exam_deadline(),
        at(8, 2, 0)
    );
}
#[test]
fn teaching_events_and_rubrics_survive_sqlite_restart() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("education.sqlite3");
    let mut data = fixture();
    finish_lesson(&mut data);
    let packet = assessment(&data, "homework");
    command(&mut data, packet, at(2, 10, 0)).unwrap();
    {
        let mut engine = crate::Engine::open(&path).unwrap();
        engine
            .dispatch(
                crate::Action::Import {
                    data: Box::new(data),
                },
                at(2, 10, 0),
            )
            .unwrap();
    }
    let mut engine = crate::Engine::open(&path).unwrap();
    let data = engine.snapshot(at(2, 10, 0)).unwrap().data;
    assert_eq!(data.education.assessments[0].questions[0].answer, "1");
    assert!(data.education.events.iter().any(|e| e.kind == "homework"));
}

#[test]
fn new_projects_require_directory_and_lessons_keep_their_plan_revision() {
    let mut engine = crate::Engine::open(":memory:").unwrap();
    let action: crate::Action = serde_json::from_value(
        json!({"type":"saveProject","id":null,"name":"新项目","color":"#849b7d"}),
    )
    .unwrap();
    assert!(engine.dispatch(action, at(1, 8, 0)).is_err());
    let mut data = fixture();
    let planned = lesson(&data, "lesson", at(2, 8, 30));
    command(&mut data, planned, at(1, 8, 0)).unwrap();
    let mut revision = data.education.semesters[0].clone();
    revision.revision = 2;
    revision.rationale = "根据诊断调整后续课时，保留原授课依据".into();
    command(
        &mut data,
        json!({"op":"saveSemester","semester":revision}),
        at(1, 9, 0),
    )
    .unwrap();
    assert_eq!(data.education.lessons[0].semester_revision, 1);
    assert_eq!(data.education.semester_history[0].revision, 1);
    assert_eq!(data.education.semesters[0].revision, 2);
}

fn submit(data: &mut AppData, id: &str, assessment: &str, time: i64) {
    command(data,json!({"op":"submit","submission":{"id":id,"assessmentId":assessment,"submittedAt":0,"resourceIds":[],"answers":"我的推导","unfinished":false,"questionTimes":[]}}),time).unwrap();
}
fn grade(data: &mut AppData, id: &str, submission: &str, time: i64) {
    command(data,json!({"op":"grade","grade":{"id":id,"submissionId":submission,"assessmentRevision":1,"gradedAt":0,"awards":[{"questionId":"q1","pointId":"p1","awarded":2,"evidence":"写出法则但计算有误"}],"errors":[{"questionId":"q1","cause":"计算环节待核实","evidence":"答卷计算不一致","correction":"重新推导并检查","nextCheck":"独立做一道同类题","retestDate":"2026-11-08","confirmed":false}],"needsReview":false,"feedback":"需订正计算"}}),time).unwrap();
}
#[test]
fn completed_learning_task_creates_one_durable_homework_event_and_snapshot() {
    let mut data = fixture();
    let task:crate::TaskDraft=serde_json::from_value(json!({"title":"极限第1讲","projectId":data.projects[0].id,"dueDate":"2026-11-02","tags":["极限"],"notes":"视频已听完，习题待做"})).unwrap();
    data.apply(crate::Action::SaveTask { task }, at(2, 8, 0))
        .unwrap();
    let id = data.tasks[0].id.clone();
    data.apply(crate::Action::ToggleTask { id: id.clone() }, at(2, 9, 0))
        .unwrap();
    assert_eq!(data.education.completed_tasks.len(), 1);
    assert!(data
        .education
        .events
        .iter()
        .any(|e| e.kind == "taskHomework" && e.source_id == id));
    let event_id = format!("taskHomework:{id}");
    assert!(command(
        &mut data,
        json!({"op":"finishEvent","id":event_id}),
        at(2, 9, 1)
    )
    .is_err());
    data.apply(crate::Action::ToggleTask { id: id.clone() }, at(2, 9, 2))
        .unwrap();
    data.apply(crate::Action::ToggleTask { id: id.clone() }, at(2, 9, 3))
        .unwrap();
    assert_eq!(data.education.completed_tasks.len(), 1);
    data.apply(crate::Action::DeleteTask { id: id.clone() }, at(2, 9, 4))
        .unwrap();
    assert_eq!(data.education.completed_tasks[0].title, "极限第1讲");
    let mut packet = assessment(&data, "homework");
    packet["assessment"]["lessonId"] = Value::Null;
    packet["assessment"]["taskId"] = json!(id);
    command(&mut data, packet, at(2, 10, 0)).unwrap();
    command(
        &mut data,
        json!({"op":"finishEvent","id":event_id}),
        at(2, 10, 1),
    )
    .unwrap();
    assert_eq!(
        data.education
            .events
            .iter()
            .find(|e| e.id == event_id)
            .unwrap()
            .state,
        "done"
    );
    let before = data.education.clone();
    data.education.completed_tasks[0].title = "篡改".into();
    assert!(validate_transition(&before, &data.education).is_err());
}
#[test]
fn progress_is_timestamped_versioned_and_never_infers_mastery_from_time() {
    let mut data = fixture();
    let project_id = data.projects[0].id.clone();
    for (id, position, time) in [("old", "第1讲", at(2, 8, 0)), ("new", "第2讲", at(2, 9, 0))] {
        command(&mut data,json!({"op":"recordProgress","record":{"id":id,"projectId":project_id,"topic":"极限","position":position,"state":"practicing","evidence":"本人记录，习题尚未验证","nextAction":"完成基础题","source":"assistant","confirmed":true,"recordedAt":0}}),time).unwrap();
    }
    assert!(!data.education.progress[1].confirmed);
    assert_eq!(data.education.progress[1].recorded_at, at(2, 9, 0));
    let summary = crate::learning::summaries(&data, at(2, 10, 0));
    assert_eq!(summary[0]["progress"][0]["position"], "第2讲");
    assert_eq!(summary[0]["progressCount"], 2);
    assert!(summary[0]["assessments"].as_array().unwrap().is_empty());
    command(
        &mut data,
        json!({"op":"confirmProgress","id":"new"}),
        at(2, 10, 0),
    )
    .unwrap();
    assert!(data.education.progress[1].confirmed);
    let before = data.education.clone();
    data.education.progress[1].position = "已掌握".into();
    assert!(validate_transition(&before, &data.education).is_err());
}
#[test]
fn submission_revision_grading_correction_and_retest_keep_original_evidence() {
    let mut data = fixture();
    finish_lesson(&mut data);
    let packet = assessment(&data, "homework");
    command(&mut data, packet, at(7, 18, 0)).unwrap();
    submit(&mut data, "sub", "assessment", at(7, 20, 0));
    grade(&mut data, "grade", "sub", at(7, 20, 1));
    let summary = crate::learning::summaries(&data, at(7, 20, 1));
    assert_eq!(summary[0]["assessments"][0]["status"], "correctionDue");
    command(&mut data,json!({"op":"submitCorrection","correction":{"id":"fix","gradeId":"grade","questionId":"q1","explanation":"重新计算并检查符号","resourceIds":[],"submittedAt":0,"accepted":true,"feedback":"伪造检查","reviewedAt":1}}),at(7,20,2)).unwrap();
    assert!(data.education.corrections[0].accepted.is_none());
    assert!(command(
        &mut data,
        json!({"op":"finishEvent","id":"correction:fix"}),
        at(7, 20, 3)
    )
    .is_err());
    command(&mut data,json!({"op":"reviewCorrection","id":"fix","accepted":true,"feedback":"推导已修正，安排独立复测"}),at(7,20,3)).unwrap();
    command(
        &mut data,
        json!({"op":"finishEvent","id":"correction:fix"}),
        at(7, 20, 4),
    )
    .unwrap();
    assert!(command(
        &mut data,
        json!({"op":"reviewCorrection","id":"fix","accepted":false,"feedback":"改写旧记录"}),
        at(7, 20, 5)
    )
    .is_err());
    let mut retest = assessment(&data, "retest");
    retest["assessment"]["id"] = json!("retest");
    retest["assessment"]["lessonId"] = Value::Null;
    retest["assessment"]["startsAt"] = json!(at(8, 19, 0));
    retest["assessment"]["endsAt"] = json!(at(8, 20, 0));
    assert!(command(&mut data, retest.clone(), at(7, 20, 5)).is_err());
    retest["assessment"]["retestOfGradeId"] = json!("grade");
    command(&mut data, retest, at(7, 20, 5)).unwrap();
    let summary = crate::learning::summaries(&data, at(7, 20, 6));
    assert_eq!(summary[0]["retests"][0]["correctionAccepted"], true);
    assert_eq!(
        summary[0]["retests"][0]["attempts"][0]["status"],
        "upcoming"
    );
    // A new submission needs its own grade, even within the same second.
    submit(&mut data, "sub2", "assessment", at(7, 20, 0));
    let summary = crate::learning::summaries(&data, at(7, 20, 7));
    let homework = summary[0]["assessments"]
        .as_array()
        .unwrap()
        .iter()
        .find(|a| a["id"] == "assessment")
        .unwrap();
    assert_eq!(homework["status"], "submitted");
    assert!(homework["score"].is_null());
    assert_eq!(data.education.grades.len(), 1);
    assert_eq!(data.education.submissions.len(), 2);
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("learning.sqlite3");
    let mut engine = crate::Engine::open(&path).unwrap();
    engine
        .dispatch(
            crate::Action::Import {
                data: Box::new(data),
            },
            at(7, 20, 7),
        )
        .unwrap();
    drop(engine);
    let mut engine = crate::Engine::open(path).unwrap();
    let s = engine.snapshot(at(7, 20, 7)).unwrap();
    assert_eq!(s.data.education.corrections[0].accepted, Some(true));
    assert_eq!(s.study_progress[0]["retests"].as_array().unwrap().len(), 1);
}
#[test]
fn exam_can_end_early_but_cannot_submit_before_stopping() {
    let mut data = fixture();
    finish_lesson(&mut data);
    let packet = assessment(&data, "weeklyExam");
    command(&mut data, packet, at(6, 18, 0)).unwrap();
    command(
        &mut data,
        json!({"op":"confirmPrinted","id":"assessment"}),
        at(7, 18, 0),
    )
    .unwrap();
    command(
        &mut data,
        json!({"op":"startExam","id":"assessment"}),
        at(7, 19, 0),
    )
    .unwrap();
    let sub = json!({"op":"submit","submission":{"id":"sub","assessmentId":"assessment","resourceIds":[],"answers":"文本","unfinished":false,"submittedAt":0,"questionTimes":[]}});
    assert!(command(&mut data, sub.clone(), at(7, 19, 10)).is_err());
    command(
        &mut data,
        json!({"op":"endExam","id":"assessment"}),
        at(7, 19, 30),
    )
    .unwrap();
    assert_eq!(
        data.education.assessments[0].stopped_at,
        Some(at(7, 19, 30))
    );
    assert!(command(&mut data, sub, at(7, 19, 31)).is_err());
}

#[test]
fn resource_cleanup_retains_archived_plan_references_and_is_atomic() {
    let mut data = fixture();
    let mut extra = data.education.resources[0].clone();
    extra.id = "unused".into();
    data.education.resources.push(extra);
    assert!(command(
        &mut data,
        json!({"op":"removeResources","ids":["unused","mock"]}),
        at(1, 8, 0)
    )
    .is_err());
    assert!(data.education.resources.iter().any(|r| r.id == "unused"));
    let mut revised = data.education.semesters[0].clone();
    revised.revision += 1;
    revised.milestones[0].resource_ids = vec!["past".into()];
    command(
        &mut data,
        json!({"op":"saveSemester","semester":revised}),
        at(1, 8, 0),
    )
    .unwrap();
    // Mock remains configured too; detach it to isolate the archived-plan reference.
    data.education.projects[0].exam_mode = false;
    data.education.projects[0].mock_paper_ids.clear();
    assert!(data
        .education
        .resource_references("mock")
        .iter()
        .any(|r| r.contains("v1")));
    assert!(command(
        &mut data,
        json!({"op":"removeResources","ids":["mock"]}),
        at(1, 8, 0)
    )
    .is_err());
    command(
        &mut data,
        json!({"op":"removeResources","ids":["unused"]}),
        at(1, 8, 0),
    )
    .unwrap();
    assert!(!data.education.resources.iter().any(|r| r.id == "unused"));
    let mut removed = data.education.clone();
    removed.resources.retain(|r| r.id != "mock");
    assert!(validate_transition(&data.education, &removed).is_err());
}
