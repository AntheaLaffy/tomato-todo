use crate::{nodes::*, templates::*, *};
use chrono::TimeZone;
fn at(hour: u32, minute: u32) -> i64 {
    Local
        .with_ymd_and_hms(2026, 10, 12, hour, minute, 0)
        .unwrap()
        .timestamp()
}
fn spec(id: &str, hour: u32) -> NodeSpec {
    NodeSpec {
        id: id.into(),
        name: id.into(),
        start: format!("2026-10-12T{hour:02}:00"),
        end: format!("2026-10-12T{:02}:00", hour + 1),
        required_tasks: 1,
        confirmation_required: false,
        signal: None,
        block_success: BlockRule::Never,
        block_failure: BlockRule::Never,
    }
}
fn signal(kind: SignalKind, direction: Direction, time: &str) -> SignalSpec {
    SignalSpec {
        kind,
        direction,
        at: format!("2026-10-12T{time}"),
        condition: CompletionCondition::Always,
    }
}
fn save(e: &mut Engine, gid: Option<String>, nodes: Vec<NodeSpec>) -> String {
    e.dispatch(
        Action::SaveGoal {
            id: gid,
            name: "主线".into(),
            nodes,
        },
        at(7, 0),
    )
    .unwrap()
    .data
    .goals[0]
        .id
        .clone()
}
fn task(e: &mut Engine, gid: &str, time: &str) -> String {
    let s = e
        .dispatch(
            Action::PrintInstances {
                shape: Shape {
                    title: "练习".into(),
                    notes: "".into(),
                    project_id: None,
                    goal_id: Some(gid.into()),
                    habit_id: None,
                    focus_minutes: Some(25),
                    scrap_minutes: 0,
                    priority: 0,
                    estimate: 1,
                    tags: vec![],
                    subtasks: vec![],
                },
                printing: Printing::Once {
                    date: Some("2026-10-12".into()),
                    time: Some(time.into()),
                },
            },
            at(7, 0),
        )
        .unwrap();
    s.data.tasks.last().unwrap().id.clone()
}
fn verdict(e: &Engine, i: usize) -> Option<Verdict> {
    e.data.goals[0].nodes[i].result.as_ref().map(|r| r.verdict)
}
#[test]
fn stable_identity_pairs_by_execution_time_not_print_time_or_name_and_uses_half_open_intervals() {
    let mut e = Engine::open(":memory:").unwrap();
    let gid = save(&mut e, None, vec![spec("a", 8), spec("b", 9)]);
    let a = task(&mut e, &gid, "08:59");
    let b = task(&mut e, &gid, "09:00");
    let unpaired = task(&mut e, &gid, "10:00");
    assert_eq!(
        e.data
            .tasks
            .iter()
            .find(|t| t.id == a)
            .unwrap()
            .node_id
            .as_deref(),
        Some("a")
    );
    assert_eq!(
        e.data
            .tasks
            .iter()
            .find(|t| t.id == b)
            .unwrap()
            .node_id
            .as_deref(),
        Some("b")
    );
    assert!(e
        .data
        .tasks
        .iter()
        .find(|t| t.id == unpaired)
        .unwrap()
        .node_id
        .is_none());
    let other = e
        .dispatch(
            Action::SaveGoal {
                id: None,
                name: "主线".into(),
                nodes: vec![spec("other-a", 8)],
            },
            at(7, 0),
        )
        .unwrap()
        .data
        .goals[1]
        .id
        .clone();
    assert_ne!(gid, other);
    task(&mut e, &other, "08:30");
    assert_eq!(
        e.data
            .node_progress(&gid, &e.data.goals[0].nodes[0])
            .paired_count,
        1
    );
    let mut specs = e.data.goals[0]
        .nodes
        .iter()
        .map(|n| n.spec.clone())
        .collect::<Vec<_>>();
    specs[0].name = "改名".into();
    specs[0].start = "2026-10-12T08:40".into();
    e.dispatch(
        Action::SaveGoal {
            id: Some(gid.clone()),
            name: "重命名主线".into(),
            nodes: specs,
        },
        at(7, 0),
    )
    .unwrap();
    assert_eq!(e.data.goals[0].id, gid);
    assert_eq!(
        e.data
            .tasks
            .iter()
            .find(|t| t.id == a)
            .unwrap()
            .node_id
            .as_deref(),
        Some("a")
    );
    assert!(e
        .snapshot(at(23, 0))
        .unwrap()
        .data
        .tasks
        .iter()
        .all(|t| !e.data.task_is_void(t, at(23, 0))));
}
#[test]
fn empty_pairing_is_not_complete_and_deleted_unfinished_instances_remain_unfinished() {
    let mut e = Engine::open(":memory:").unwrap();
    let mut n = spec("a", 8);
    n.required_tasks = 2;
    let gid = save(&mut e, None, vec![n]);
    assert!(!e.snapshot(at(7, 0)).unwrap().node_progress[0].completed);
    let a = task(&mut e, &gid, "08:10");
    let b = task(&mut e, &gid, "08:20");
    e.dispatch(Action::ToggleTask { id: a }, at(7, 0)).unwrap();
    e.dispatch(Action::DeleteTask { id: b }, at(7, 0)).unwrap();
    let s = e.snapshot(at(12, 0)).unwrap();
    assert_eq!(s.node_progress[0].paired_count, 2);
    assert_eq!(s.node_progress[0].completed_count, 1);
    assert!(!s.node_progress[0].completed);
    assert!(s.data.goals[0].nodes[0].result.is_none());
}
#[test]
fn direction_is_independent_of_success_failure_and_sender_cannot_block_itself() {
    for (kind, v) in [
        (SignalKind::Success, Verdict::Success),
        (SignalKind::Failure, Verdict::Failure),
    ] {
        for direction in [Direction::Head, Direction::Tail] {
            let mut e = Engine::open(":memory:").unwrap();
            let mut ns = (0..4)
                .map(|i| spec(&i.to_string(), 8 + i))
                .collect::<Vec<_>>();
            ns[1].signal = Some(signal(kind, direction, "08:10"));
            ns[1].block_success = BlockRule::Always;
            ns[1].block_failure = BlockRule::Always;
            save(&mut e, None, ns);
            e.snapshot(at(8, 10)).unwrap();
            for i in 0..4 {
                let affected = if direction == Direction::Head {
                    i <= 1
                } else {
                    i >= 1
                };
                assert_eq!(verdict(&e, i), affected.then_some(v));
            }
            assert_eq!(e.data.signal_events.len(), 1);
            assert!(!e.data.signal_events[0].deliveries[0].blocked);
        }
    }
}
#[test]
fn boundary_refuses_before_own_decision_and_each_semantic_has_independent_blocking() {
    for kind in [SignalKind::Success, SignalKind::Failure] {
        let mut e = Engine::open(":memory:").unwrap();
        let mut ns = vec![spec("source", 8), spec("boundary", 9), spec("tail", 10)];
        ns[0].signal = Some(signal(kind, Direction::Tail, "08:10"));
        ns[1].signal = Some(signal(SignalKind::Success, Direction::Tail, "23:00"));
        ns[1].block_failure = BlockRule::Always;
        save(&mut e, None, ns);
        e.snapshot(at(8, 10)).unwrap();
        if kind == SignalKind::Failure {
            assert!(verdict(&e, 1).is_none());
            assert!(verdict(&e, 2).is_none());
            assert!(e.data.signal_events[0].deliveries.last().unwrap().blocked);
        } else {
            assert_eq!(verdict(&e, 2), Some(Verdict::Success));
        }
    }
}
#[test]
fn all_conditional_block_rules_use_receivers_pairing_and_completion_at_delivery() {
    for (rule, has_task, done, blocked) in [
        (BlockRule::Never, false, false, false),
        (BlockRule::Always, false, false, true),
        (BlockRule::Unpaired, false, false, true),
        (BlockRule::Unpaired, true, false, false),
        (BlockRule::UnfinishedTasks, false, false, false),
        (BlockRule::UnfinishedTasks, true, false, true),
        (BlockRule::UnfinishedTasks, true, true, false),
        (BlockRule::Incomplete, false, false, true),
        (BlockRule::Incomplete, true, true, false),
        (BlockRule::Completed, true, true, true),
        (BlockRule::Completed, true, false, false),
    ] {
        let mut e = Engine::open(":memory:").unwrap();
        let mut ns = vec![spec("s", 8), spec("b", 9), spec("t", 10)];
        ns[0].signal = Some(signal(SignalKind::Failure, Direction::Tail, "10:00"));
        ns[1].signal = Some(signal(SignalKind::Success, Direction::Head, "23:00"));
        ns[1].block_failure = rule;
        let gid = save(&mut e, None, ns);
        if has_task {
            let id = task(&mut e, &gid, "09:30");
            if done {
                e.dispatch(Action::ToggleTask { id }, at(7, 0)).unwrap();
            }
        }
        e.snapshot(at(10, 0)).unwrap();
        assert_eq!(
            e.data.signal_events[0].deliveries.last().unwrap().blocked,
            blocked,
            "{rule:?}"
        );
        assert_eq!(verdict(&e, 2), (!blocked).then_some(Verdict::Failure));
    }
}
#[test]
fn timed_completion_condition_waits_after_deadline_and_never_replays_on_restart() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("state.db");
    let mut e = Engine::open(&path).unwrap();
    let mut n = spec("a", 8);
    let mut sig = signal(SignalKind::Success, Direction::Tail, "10:00");
    sig.condition = CompletionCondition::Completed;
    n.signal = Some(sig);
    let gid = save(&mut e, None, vec![n, spec("b", 9)]);
    let id = task(&mut e, &gid, "08:30");
    e.snapshot(at(10, 0)).unwrap();
    assert!(e.data.signal_events.is_empty());
    e.dispatch(Action::ToggleTask { id }, at(11, 0)).unwrap();
    assert_eq!(verdict(&e, 1), Some(Verdict::Success));
    assert_eq!(e.data.signal_events.len(), 1);
    drop(e);
    let mut e = Engine::open(path).unwrap();
    e.snapshot(at(12, 0)).unwrap();
    assert_eq!(e.data.signal_events.len(), 1);
}
#[test]
fn tail_check_cannot_be_blocked_keeps_failures_and_rechecks_later_completion_without_empty_success()
{
    let mut e = Engine::open(":memory:").unwrap();
    let mut ns = vec![spec("failed", 8), spec("work", 9), spec("last", 10)];
    ns[0].signal = Some(signal(SignalKind::Failure, Direction::Head, "08:00"));
    ns[1].signal = Some(signal(SignalKind::Success, Direction::Tail, "23:00"));
    ns[1].block_success = BlockRule::Always;
    ns[1].block_failure = BlockRule::Always;
    ns[2].signal = Some(signal(SignalKind::Check, Direction::Head, "12:00"));
    let gid = save(&mut e, None, ns);
    let id = task(&mut e, &gid, "09:30");
    e.snapshot(at(12, 0)).unwrap();
    assert_eq!(verdict(&e, 0), Some(Verdict::Failure));
    assert!(verdict(&e, 1).is_none());
    assert!(verdict(&e, 2).is_none());
    e.dispatch(Action::ToggleTask { id: id.clone() }, at(13, 0))
        .unwrap();
    assert_eq!(verdict(&e, 1), Some(Verdict::Success));
    assert!(e
        .data
        .task_is_void(e.data.tasks.iter().find(|t| t.id == id).unwrap(), at(13, 0)));
    assert_eq!(verdict(&e, 0), Some(Verdict::Failure));
    assert!(verdict(&e, 2).is_none());
    let count = e.data.signal_events.len();
    e.snapshot(at(14, 0)).unwrap();
    assert_eq!(count, e.data.signal_events.len());
    assert!(e
        .data
        .signal_events
        .iter()
        .filter(|s| s.kind == SignalKind::Check)
        .all(|s| s.deliveries.len() == 3 && s.deliveries.iter().all(|d| !d.blocked)));
}
#[test]
fn decisions_freeze_every_paired_instance_and_cannot_be_reversed_by_actions_or_backup() {
    let mut e = Engine::open(":memory:").unwrap();
    let mut n = spec("a", 8);
    n.signal = Some(signal(SignalKind::Success, Direction::Head, "10:00"));
    let gid = save(&mut e, None, vec![n]);
    let id = task(&mut e, &gid, "08:30");
    let old = e.snapshot(at(7, 0)).unwrap().data;
    e.dispatch(Action::ToggleTask { id: id.clone() }, at(7, 0))
        .unwrap();
    e.snapshot(at(10, 0)).unwrap();
    let before = e.export(at(10, 0)).unwrap();
    assert!(e.data.task_is_void(&e.data.tasks[0], at(10, 0)));
    for action in [
        Action::ToggleTask { id: id.clone() },
        Action::DetachTasks {
            ids: vec![id.clone()],
            target: DetachTarget::Goal,
        },
        Action::DeleteGoal { id: gid.clone() },
        Action::Import {
            data: Box::new(old),
        },
    ] {
        assert!(e.dispatch(action, at(10, 0)).is_err());
        assert_eq!(e.export(at(10, 0)).unwrap(), before);
    }
    let mut config = e.data.goals[0].nodes[0].spec.clone();
    config.start = "2026-10-12T07:00".into();
    assert!(e
        .dispatch(
            Action::SaveGoal {
                id: Some(gid.clone()),
                name: "改名".into(),
                nodes: vec![config]
            },
            at(10, 0)
        )
        .is_err());
    let mut config = e.data.goals[0].nodes[0].spec.clone();
    config.name = "新名字".into();
    e.dispatch(
        Action::SaveGoal {
            id: Some(gid),
            name: "组改名".into(),
            nodes: vec![config],
        },
        at(10, 0),
    )
    .unwrap();
    assert_eq!(verdict(&e, 0), Some(Verdict::Success));
}
#[test]
fn templates_keep_printing_independently_and_late_pairing_inherits_decision() {
    let mut e = Engine::open(":memory:").unwrap();
    let mut n = spec("a", 8);
    n.signal = Some(signal(SignalKind::Failure, Direction::Head, "07:30"));
    let gid = save(&mut e, None, vec![n]);
    e.snapshot(at(7, 30)).unwrap();
    let id = task(&mut e, &gid, "08:30"); // Helper prints at 07:00; irreversible result must still hold.
    let t = e.data.tasks.iter().find(|t| t.id == id).unwrap();
    assert!(e.data.task_is_void(t, at(8, 0)));
    assert_eq!(t.node_id.as_deref(), Some("a"));
    assert!(!t.completed);
    assert!(e
        .dispatch(Action::SelectTask { id: Some(id) }, at(8, 0))
        .is_err());
}
#[test]
fn node_configuration_rejects_overlap_and_non_tail_checks_atomically() {
    let mut e = Engine::open(":memory:").unwrap();
    let before = e.export(at(7, 0)).unwrap();
    for nodes in [
        vec![spec("same", 8), spec("same", 9)],
        vec![spec("a", 8), spec("b", 8)],
        {
            let mut n = spec("a", 8);
            n.signal = Some(signal(SignalKind::Check, Direction::Tail, "10:00"));
            vec![n]
        },
        {
            let mut n = spec("a", 8);
            n.signal = Some(signal(SignalKind::Check, Direction::Head, "10:00"));
            vec![n, spec("b", 9)]
        },
    ] {
        assert!(e
            .dispatch(
                Action::SaveGoal {
                    id: None,
                    name: "组".into(),
                    nodes
                },
                at(7, 0)
            )
            .is_err());
        assert_eq!(e.export(at(7, 0)).unwrap(), before);
    }
}
#[test]
fn backup_preserves_decisions_but_plan_exchanges_configuration_and_preserves_local_progress() {
    let mut e = Engine::open(":memory:").unwrap();
    let mut n = spec("a", 8);
    n.signal = Some(signal(SignalKind::Success, Direction::Head, "10:00"));
    let gid = save(&mut e, None, vec![n]);
    let id = task(&mut e, &gid, "08:30");
    e.dispatch(Action::ToggleTask { id }, at(7, 0)).unwrap();
    e.snapshot(at(10, 0)).unwrap();
    let backup: AppData = serde_json::from_str(&e.export(at(10, 0)).unwrap()).unwrap();
    let mut fresh = Engine::open(":memory:").unwrap();
    fresh
        .dispatch(
            Action::Import {
                data: Box::new(backup),
            },
            at(10, 0),
        )
        .unwrap();
    assert_eq!(verdict(&fresh, 0), Some(Verdict::Success));
    assert_eq!(fresh.data.signal_events.len(), 1);
    let plan = e.data.export_plan();
    plan.validate().unwrap();
    assert_eq!(plan.version, 4);
    let json = serde_json::to_value(&plan).unwrap();
    assert!(json["goals"][0]["nodes"][0].get("result").is_none());
    assert!(json.get("signalEvents").is_none());
    let before = e.data.goals[0].nodes[0].result.clone();
    e.dispatch(Action::ImportPlan { plan }, at(10, 0)).unwrap();
    assert_eq!(e.data.goals[0].nodes[0].result, before);
}

#[test]
fn ids_are_globally_unique_and_deleted_nodes_cannot_be_reused_even_after_backup_or_restart() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("ids.db");
    let mut e = Engine::open(&path).unwrap();
    let gid = save(&mut e, None, vec![spec("permanent-node", 8)]);
    assert!(e
        .dispatch(
            Action::SaveGoal {
                id: None,
                name: "另一组".into(),
                nodes: vec![spec("permanent-node", 9)]
            },
            at(7, 0)
        )
        .is_err());
    let project_id = e.data.projects[0].id.clone();
    assert!(e
        .dispatch(
            Action::SaveGoal {
                id: None,
                name: "跨类别冲突".into(),
                nodes: vec![spec(&project_id, 8)]
            },
            at(7, 0)
        )
        .is_err());
    e.dispatch(Action::DeleteGoal { id: gid }, at(7, 0))
        .unwrap();
    drop(e);
    let mut e = Engine::open(&path).unwrap();
    assert!(e
        .dispatch(
            Action::SaveGoal {
                id: None,
                name: "复用".into(),
                nodes: vec![spec("permanent-node", 8)]
            },
            at(7, 0)
        )
        .is_err());
    let backup: AppData = serde_json::from_str(&e.export(at(7, 0)).unwrap()).unwrap();
    let mut restored = Engine::open(":memory:").unwrap();
    restored
        .dispatch(
            Action::Import {
                data: Box::new(backup),
            },
            at(7, 0),
        )
        .unwrap();
    assert!(restored
        .dispatch(
            Action::SaveGoal {
                id: None,
                name: "备份复用".into(),
                nodes: vec![spec("permanent-node", 8)]
            },
            at(7, 0)
        )
        .is_err());
}
#[test]
fn deleted_task_id_is_reserved_and_undo_only_accepts_the_original_entity() {
    let mut e = Engine::open(":memory:").unwrap();
    let gid = save(&mut e, None, vec![spec("node", 8)]);
    let id = task(&mut e, &gid, "08:30");
    let original = e.data.tasks[0].clone();
    e.dispatch(Action::DeleteTask { id: id.clone() }, at(7, 0))
        .unwrap();
    let mut forged = original.clone();
    forged.title = "另一条任务".into();
    assert!(e
        .dispatch(Action::RestoreTask { task: forged }, at(7, 0))
        .is_err());
    let plan:plan::PlanFile=serde_json::from_value(serde_json::json!({"format":"tomato-todo-plan","version":4,"pomodoroMinutes":25,"projects":[],"tasks":[{"id":id,"title":"复用"}]})).unwrap();
    assert!(e.dispatch(Action::ImportPlan { plan }, at(7, 0)).is_err());
    e.dispatch(Action::RestoreTask { task: original }, at(7, 0))
        .unwrap();
    assert_eq!(e.data.tasks.len(), 1);
    assert_eq!(e.data.tasks[0].id, id);
    assert_eq!(e.data.node_bindings.len(), 1);
}

#[test]
fn node_decision_stops_its_active_focus_and_keeps_only_actual_partial_work() {
    let mut e = Engine::open(":memory:").unwrap();
    let mut n = spec("a", 8);
    n.signal = Some(signal(SignalKind::Success, Direction::Head, "08:10"));
    let gid = save(&mut e, None, vec![n]);
    let id = task(&mut e, &gid, "08:30");
    e.dispatch(Action::SelectTask { id: Some(id) }, at(8, 0))
        .unwrap();
    e.dispatch(Action::StartTimer, at(8, 0)).unwrap();
    let s = e.snapshot(at(8, 10)).unwrap();
    assert!(!s.data.timer.running);
    assert!(s.data.timer.task_id.is_none());
    assert_eq!(s.data.sessions.len(), 1);
    assert_eq!(s.data.sessions[0].duration_secs, 600);
    assert!(!s.data.sessions[0].completed);
    assert!(!s.data.tasks[0].completed);
}

#[test]
fn orphaned_historical_task_ids_stay_reserved_without_a_live_instance() {
    let mut e = Engine::open(":memory:").unwrap();
    let mut backup = AppData::default();
    backup.sessions.push(Session {
        id: "old-session".into(),
        task_id: Some("historical-task".into()),
        task_title: "历史任务".into(),
        project_name: "".into(),
        started_at: 1000,
        ended_at: 1060,
        duration_secs: 60,
        completed: false,
    });
    e.dispatch(
        Action::Import {
            data: Box::new(backup),
        },
        at(7, 0),
    )
    .unwrap();
    assert!(e
        .data
        .identities
        .iter()
        .any(|r| r.id == "historical-task" && r.retired));
    let plan:plan::PlanFile=serde_json::from_value(serde_json::json!({"format":"tomato-todo-plan","version":4,"pomodoroMinutes":25,"projects":[],"tasks":[{"id":"historical-task","title":"另一实体"}]})).unwrap();
    assert!(e.dispatch(Action::ImportPlan { plan }, at(7, 0)).is_err());
}

#[test]
fn restoring_a_backup_cannot_rewrite_signal_evidence_or_closed_completion_facts() {
    let mut e = Engine::open(":memory:").unwrap();
    let mut n = spec("a", 8);
    n.signal = Some(signal(SignalKind::Success, Direction::Head, "10:00"));
    let gid = save(&mut e, None, vec![n]);
    let id = task(&mut e, &gid, "08:30");
    e.dispatch(Action::ToggleTask { id }, at(7, 0)).unwrap();
    e.snapshot(at(10, 0)).unwrap();
    let before = e.export(at(10, 0)).unwrap();
    let original = e.data.clone();
    let mut wrong = original.clone();
    wrong.goals[0].nodes[0].spec.block_failure = BlockRule::Always;
    assert!(e
        .dispatch(
            Action::Import {
                data: Box::new(wrong)
            },
            at(10, 0)
        )
        .is_err());
    let mut wrong = original.clone();
    wrong.tasks[0].completed = false;
    wrong.tasks[0].completed_at = None;
    wrong.node_bindings[0].completed = false;
    assert!(e
        .dispatch(
            Action::Import {
                data: Box::new(wrong)
            },
            at(10, 0)
        )
        .is_err());
    let mut wrong = original;
    wrong.signal_events[0].deliveries[0].completed_count = 0;
    assert!(e
        .dispatch(
            Action::Import {
                data: Box::new(wrong)
            },
            at(10, 0)
        )
        .is_err());
    assert_eq!(e.export(at(10, 0)).unwrap(), before);
}

#[test]
fn mainline_statistics_report_the_whole_line_and_each_node_timing() {
    let mut e = Engine::open(":memory:").unwrap();
    let mut ns = vec![spec("a", 8), spec("b", 9)];
    ns[1].signal = Some(signal(SignalKind::Check, Direction::Head, "12:00"));
    save(&mut e, None, ns);
    let gid = e.data.goals[0].id.clone();
    let a = task(&mut e, &gid, "08:30");
    let b = task(&mut e, &gid, "09:30");
    // Paired work alone does not settle a line: an unfinished node keeps it open.
    let s = e.snapshot(at(10, 0)).unwrap();
    assert_eq!(s.stats.goals[0].outcome, LineOutcome::Pending);
    assert_eq!(s.stats.goals[0].nodes[0].paired, 1);
    assert_eq!(s.stats.goals[0].start.as_deref(), Some("2026-10-12T08:00"));
    assert_eq!(s.stats.goals[0].end.as_deref(), Some("2026-10-12T10:00"));
    e.dispatch(Action::ToggleTask { id: a }, at(10, 1)).unwrap();
    e.dispatch(Action::ToggleTask { id: b }, at(10, 2)).unwrap();
    let s = e.snapshot(at(12, 1)).unwrap();
    assert_eq!(s.stats.goals[0].outcome, LineOutcome::Success);
    assert_eq!(s.stats.goals[0].decided_at, Some(at(12, 1)));
    assert!(s.stats.goals[0]
        .nodes
        .iter()
        .all(|n| n.verdict == Some(Verdict::Success) && n.node_completed));
    // The daily cross-section counts the two nodes decided today.
    assert_eq!(s.stats.days.last().unwrap().goal_success, 2);
    assert_eq!(s.stats.days.last().unwrap().goal_failure, 0);
}

#[test]
fn failed_mainline_records_the_failure_and_voids_its_pairings_together() {
    let mut e = Engine::open(":memory:").unwrap();
    let mut ns = vec![spec("a", 8), spec("b", 9)];
    ns[0].signal = Some(signal(SignalKind::Failure, Direction::Tail, "10:00"));
    save(&mut e, None, ns);
    let gid = e.data.goals[0].id.clone();
    task(&mut e, &gid, "08:30");
    task(&mut e, &gid, "09:30");
    let s = e.snapshot(at(10, 1)).unwrap();
    assert_eq!(s.stats.goals[0].outcome, LineOutcome::Failure);
    assert_eq!(s.stats.goals[0].decided_at, Some(at(10, 1)));
    assert!(s.stats.goals[0]
        .nodes
        .iter()
        .all(|n| n.verdict == Some(Verdict::Failure)));
    // The cross-section pins the whole line's failure to the instant it happened,
    // together with the instances it voided.
    let day = s.stats.days.last().unwrap();
    assert_eq!(day.goal_failure, 2);
    assert_eq!(day.goal_voided, 2);
    assert_eq!(day.goal_success, 0);
}
