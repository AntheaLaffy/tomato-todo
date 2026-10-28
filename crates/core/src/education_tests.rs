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
