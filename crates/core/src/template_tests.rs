use crate::{templates::*, *};
use chrono::TimeZone;

fn at(day: u32, hour: u32, minute: u32) -> i64 {
    Local
        .with_ymd_and_hms(2026, 10, day, hour, minute, 0)
        .unwrap()
        .timestamp()
}
fn engine() -> Engine {
    Engine::open(":memory:").unwrap()
}
fn template() -> Template {
    Template {
        id: "shape".into(),
        automatic: false,
        print_ahead_days: 7,
        printing: Printing::Once {
            date: None,
            time: None,
        },
        shape: Shape {
            title: "练习".into(),
            notes: "原稿".into(),
            project_id: None,
            goal_id: None,
            habit_id: None,
            focus_minutes: Some(25),
            scrap_minutes: 30,
            priority: 1,
            estimate: 1,
            tags: vec!["学习".into()],
            subtasks: vec![TemplateSubtask {
                id: "step".into(),
                title: "复盘".into(),
            }],
        },
    }
}
fn save(e: &mut Engine, template: Template, dates: Vec<Option<String>>, time: i64) -> Snapshot {
    e.dispatch(
        Action::SaveTemplate {
            template,
            print_dates: dates,
        },
        time,
    )
    .unwrap()
}
fn weekly(t: &mut Template) {
    t.printing = Printing::Weekly {
        slots: vec![
            PrintSlot {
                days: vec![1],
                time: Some("09:00".into()),
            },
            PrintSlot {
                days: vec![1],
                time: Some("15:00".into()),
            },
        ],
    };
}
#[test]
fn weekly_daily_batch_survives_instance_deletion_and_restart() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("state.sqlite3");
    let mut e = Engine::open(&path).unwrap();
    let mut t = template();
    weekly(&mut t);
    t.automatic = true;
    t.print_ahead_days = 0;
    let s = save(&mut e, t, vec![], at(12, 8, 0));
    assert_eq!(s.data.tasks.len(), 2);
    assert!(s.data.tasks.iter().all(Task::is_habit));
    assert_eq!(s.data.prints.len(), 1);
    e.dispatch(
        Action::DeleteTask {
            id: s.data.tasks[0].id.clone(),
        },
        at(12, 8, 1),
    )
    .unwrap();
    drop(e);
    let mut e = Engine::open(&path).unwrap();
    let s = e
        .dispatch(
            Action::PrintTemplate {
                id: "shape".into(),
                dates: vec![Some("2026-10-12".into())],
            },
            at(12, 8, 2),
        )
        .unwrap();
    assert_eq!(s.data.tasks.len(), 1);
    assert_eq!(s.data.prints.len(), 1);
}
#[test]
fn manual_static_template_is_reusable_and_never_runs_itself() {
    let mut e = engine();
    save(&mut e, template(), vec![], at(12, 8, 0));
    assert!(e.snapshot(at(13, 8, 0)).unwrap().data.tasks.is_empty());
    let s = e
        .dispatch(
            Action::PrintTemplate {
                id: "shape".into(),
                dates: vec![
                    Some("2026-10-13".into()),
                    Some("2026-10-14".into()),
                    Some("2026-10-13".into()),
                ],
            },
            at(13, 8, 0),
        )
        .unwrap();
    assert_eq!(s.data.tasks.len(), 2);
    assert!(s.data.tasks.iter().all(|t| !t.recurring));
    assert_eq!(s.data.templates.len(), 1);
    e.dispatch(
        Action::ToggleTask {
            id: s.data.tasks[0].id.clone(),
        },
        at(13, 8, 1),
    )
    .unwrap();
    assert_eq!(e.snapshot(at(15, 8, 0)).unwrap().data.tasks.len(), 2);
}
#[test]
fn automatic_rolling_horizon_fills_gaps_before_start_not_only_on_entry() {
    let mut e = engine();
    let mut t = template();
    weekly(&mut t);
    t.automatic = false;
    save(
        &mut e,
        t.clone(),
        vec![Some("2026-10-26".into())],
        at(12, 8, 0),
    );
    // Having printed a later date must not suppress an earlier missing Monday.
    t.automatic = true;
    let s = save(&mut e, t, vec![], at(12, 8, 0));
    let dates: HashSet<_> = s
        .data
        .tasks
        .iter()
        .map(|t| t.due_date.as_deref().unwrap())
        .collect();
    assert_eq!(
        dates,
        HashSet::from(["2026-10-12", "2026-10-19", "2026-10-26"])
    );
    assert_eq!(s.data.tasks.len(), 6);
    assert_eq!(s.data.habits.len(), 1); // Re-saving retains the jurisdiction.
    assert_eq!(e.snapshot(at(13, 8, 0)).unwrap().data.tasks.len(), 6);
    let s = e.snapshot(at(26, 8, 0)).unwrap();
    assert!(s
        .data
        .tasks
        .iter()
        .any(|t| t.due_date.as_deref() == Some("2026-11-02")));
}
#[test]
fn automatic_once_prints_ahead_but_does_not_reprint_after_deletion() {
    let mut e = engine();
    let mut t = template();
    t.automatic = true;
    t.printing = Printing::Once {
        date: Some("2026-10-19".into()),
        time: Some("09:00".into()),
    };
    let s = save(&mut e, t, vec![], at(12, 8, 0));
    assert_eq!(s.data.tasks.len(), 1);
    e.dispatch(
        Action::DeleteTask {
            id: s.data.tasks[0].id.clone(),
        },
        at(12, 8, 1),
    )
    .unwrap();
    assert!(e.snapshot(at(19, 8, 0)).unwrap().data.tasks.is_empty());
}
#[test]
fn template_edits_are_future_only_and_explicit_sync_preserves_history() {
    let mut e = engine();
    let mut t = template();
    let s = save(
        &mut e,
        t.clone(),
        vec![Some("2026-10-12".into()), Some("2026-10-13".into())],
        at(12, 8, 0),
    );
    let completed = s.data.tasks[0].id.clone();
    let pending = s.data.tasks[1].id.clone();
    e.dispatch(
        Action::ToggleTask {
            id: completed.clone(),
        },
        at(12, 8, 1),
    )
    .unwrap();
    e.dispatch(
        Action::ToggleSubtask {
            task_id: pending.clone(),
            subtask_id: "step".into(),
        },
        at(12, 8, 1),
    )
    .unwrap();
    t.shape.title = "新稿".into();
    t.shape.scrap_minutes = 60;
    let s = save(&mut e, t, vec![Some("2026-10-14".into())], at(12, 8, 2));
    assert_eq!(s.data.tasks[0].title, "练习");
    assert_eq!(s.data.tasks[1].title, "练习");
    assert_eq!(s.data.tasks[2].title, "新稿");
    let s = e
        .dispatch(Action::SyncTemplate { id: "shape".into() }, at(12, 8, 3))
        .unwrap();
    assert_eq!(s.data.tasks[0].title, "练习");
    assert!(s.data.tasks[0].completed);
    assert_eq!(s.data.tasks[1].title, "新稿");
    assert!(s.data.tasks[1].subtasks[0].done);
    assert_eq!(s.data.tasks[1].due_date.as_deref(), Some("2026-10-13"));
    let s = e
        .dispatch(Action::DeleteTemplate { id: "shape".into() }, at(12, 8, 4))
        .unwrap();
    assert_eq!(s.data.tasks.len(), 3);
    assert!(s.data.tasks.iter().all(|t| t.template_id.is_none()));
    assert!(s.data.templates.is_empty() && s.data.prints.is_empty());
}
#[test]
fn save_and_batch_print_fail_atomically_for_rules_dates_and_references() {
    let mut e = engine();
    let before = e.export(at(12, 8, 0)).unwrap();
    let mut bad = template();
    weekly(&mut bad);
    assert!(e
        .dispatch(
            Action::SaveTemplate {
                template: bad.clone(),
                print_dates: vec![Some("2026-10-12".into()), Some("2026-02-30".into())]
            },
            at(12, 8, 0)
        )
        .is_err());
    assert_eq!(e.export(at(12, 8, 0)).unwrap(), before);
    bad.shape.goal_id = Some("missing".into());
    assert!(e
        .dispatch(
            Action::SaveTemplate {
                template: bad,
                print_dates: vec![]
            },
            at(12, 8, 0)
        )
        .is_err());
    assert_eq!(e.export(at(12, 8, 0)).unwrap(), before);
    let mut bad = template();
    bad.print_ahead_days = 91;
    assert!(e
        .dispatch(
            Action::SaveTemplate {
                template: bad,
                print_dates: vec![]
            },
            at(12, 8, 0)
        )
        .is_err());
    assert_eq!(e.export(at(12, 8, 0)).unwrap(), before);
}
#[test]
fn overdue_prints_inside_grace_but_spent_prints_are_skipped_at_boundary() {
    let mut e = engine();
    let mut t = template();
    t.printing = Printing::Once {
        date: None,
        time: Some("09:00".into()),
    };
    let s = save(
        &mut e,
        t.clone(),
        vec![Some("2026-10-12".into())],
        at(12, 9, 30),
    );
    assert_eq!(s.data.tasks.len(), 1);
    assert!(!s.data.tasks[0].reminder_expired);
    assert!(!s.data.task_is_void(&s.data.tasks[0], at(12, 9, 30)));
    assert!(e.snapshot(at(12, 9, 55)).unwrap().data.tasks[0].reminder_expired);
    let mut e = engine();
    let s = save(
        &mut e,
        t.clone(),
        vec![Some("2026-10-12".into())],
        at(12, 9, 55),
    );
    assert!(s.data.tasks.is_empty());
    assert!(s.data.prints.is_empty());
    assert!(!e.data.tick(at(12, 10, 0))); // Skipped printing must not keep persisting.
    let s = e
        .dispatch(
            Action::PrintTemplate {
                id: "shape".into(),
                dates: vec![Some("2026-10-12".into())],
            },
            at(13, 0, 0),
        )
        .unwrap();
    assert!(s.data.tasks.is_empty()); // Static grace never crosses midnight.
    t.shape.scrap_minutes = 0;
    let s = save(
        &mut engine(),
        t,
        vec![Some("2026-10-12".into())],
        at(12, 9, 25),
    );
    assert!(s.data.tasks.is_empty());
    let mut t = template();
    t.automatic = true;
    t.printing = Printing::Once {
        date: Some("2026-10-12".into()),
        time: Some("09:00".into()),
    };
    let mut e = engine();
    let s = save(&mut e, t, vec![], at(12, 9, 55));
    assert!(s.data.tasks.is_empty());
    assert!(!e.data.tick(at(12, 10, 0)));
}
#[test]
fn habits_skip_spent_slots_never_make_up_and_count_existing_misses() {
    let mut e = engine();
    let mut t = template();
    weekly(&mut t);
    t.shape.scrap_minutes = 600;
    let s = save(&mut e, t, vec![Some("2026-10-12".into())], at(12, 9, 30));
    assert_eq!(s.data.tasks.len(), 1);
    assert_eq!(s.data.tasks[0].reminder_time.as_deref(), Some("15:00"));
    assert_eq!(s.data.tasks[0].scrap_minutes, 0);
    let s = e.snapshot(at(12, 15, 25)).unwrap();
    assert!(s.data.tasks[0].reminder_expired);
    assert_eq!(s.stats.days.last().unwrap().missed, 1);
    assert!(e
        .dispatch(
            Action::ToggleTask {
                id: s.data.tasks[0].id.clone()
            },
            at(12, 15, 25)
        )
        .is_err());
    let s = e
        .dispatch(
            Action::DeleteHabit {
                id: s.data.habits[0].id.clone(),
            },
            at(12, 15, 26),
        )
        .unwrap();
    assert_eq!(s.data.tasks.len(), 1);
    assert!(!s.data.tasks[0].is_habit());
    assert!(s.data.templates.is_empty());
}
#[test]
fn v3_plan_and_backup_keep_the_ledger_and_do_not_reset_progress() {
    let mut e = engine();
    let mut t = template();
    weekly(&mut t);
    let s = save(&mut e, t, vec![Some("2026-10-12".into())], at(12, 8, 0));
    let id = s.data.tasks[0].id.clone();
    e.dispatch(
        Action::ToggleSubtask {
            task_id: id.clone(),
            subtask_id: "step".into(),
        },
        at(12, 8, 1),
    )
    .unwrap();
    let plan = e.data.export_plan();
    assert_eq!(plan.version, 4);
    plan.validate().unwrap();
    let s = e
        .dispatch(Action::ImportPlan { plan: plan.clone() }, at(12, 8, 2))
        .unwrap();
    assert!(s.data.tasks[0].subtasks[0].done);
    assert_eq!(s.data.tasks.len(), 2);
    let mut fresh = engine();
    let s = fresh
        .dispatch(Action::ImportPlan { plan }, at(12, 8, 0))
        .unwrap();
    assert_eq!(s.data.prints.len(), 1);
    assert!(!s.data.tasks[0].subtasks[0].done);
    fresh
        .dispatch(
            Action::DeleteTask {
                id: s.data.tasks[0].id.clone(),
            },
            at(12, 8, 1),
        )
        .unwrap();
    let backup: AppData = serde_json::from_str(&fresh.export(at(12, 8, 1)).unwrap()).unwrap();
    let mut restored = engine();
    restored
        .dispatch(
            Action::Import {
                data: Box::new(backup),
            },
            at(12, 8, 1),
        )
        .unwrap();
    let s = restored
        .dispatch(
            Action::PrintTemplate {
                id: "shape".into(),
                dates: vec![Some("2026-10-12".into())],
            },
            at(12, 8, 2),
        )
        .unwrap();
    assert_eq!(s.data.tasks.len(), 1);
}
#[test]
fn v1_v2_plans_become_templates_and_keep_existing_progress() {
    for version in [1, 2] {
        let json = format!(
            r#"{{"format":"tomato-todo-plan","version":{version},"pomodoroMinutes":25,"projects":[],"tasks":[{{"id":"old","title":"旧计划","repeat":"weekdays","dueDate":"2026-10-12"}}]}}"#
        );
        let plan: plan::PlanFile = serde_json::from_str(&json).unwrap();
        let mut e = engine();
        let s = e
            .dispatch(Action::ImportPlan { plan: plan.clone() }, at(12, 8, 0))
            .unwrap();
        assert_eq!(s.data.templates.len(), 1);
        assert!(s.data.tasks[0].recurring);
        e.dispatch(Action::ToggleTask { id: "old".into() }, at(12, 8, 1))
            .unwrap();
        let s = e
            .dispatch(Action::ImportPlan { plan }, at(12, 8, 2))
            .unwrap();
        assert!(s.data.tasks[0].completed);
        assert_eq!(s.data.tasks.len(), 5);
    }
}

fn calendar(t: &mut Template) {
    t.printing = Printing::Calendar {
        slots: vec![
            CalendarSlot {
                dates: vec!["2026-10-12".into(), "2026-10-14".into()],
                time: Some("09:00".into()),
            },
            CalendarSlot {
                dates: vec!["2026-10-12".into(), "2026-10-15".into()],
                time: Some("15:00".into()),
            },
        ],
    };
}
#[test]
fn one_calendar_shape_reuses_multiple_times_and_dates_manually_or_automatically() {
    for automatic in [false, true] {
        let mut e = engine();
        let mut t = template();
        calendar(&mut t);
        t.automatic = automatic;
        let dates = if automatic {
            vec![]
        } else {
            vec![
                Some("2026-10-12".into()),
                Some("2026-10-14".into()),
                Some("2026-10-15".into()),
            ]
        };
        let s = save(&mut e, t, dates, at(12, 8, 0));
        assert_eq!(s.data.templates.len(), 1);
        assert_eq!(s.data.tasks.len(), 4);
        assert_eq!(s.data.prints.len(), 3);
        assert!(s
            .data
            .tasks
            .iter()
            .all(|t| !t.recurring && t.habit_id.is_none()));
        assert_eq!(
            s.data
                .tasks
                .iter()
                .map(|t| (
                    t.due_date.as_deref().unwrap(),
                    t.reminder_time.as_deref().unwrap()
                ))
                .collect::<HashSet<_>>(),
            HashSet::from([
                ("2026-10-12", "09:00"),
                ("2026-10-12", "15:00"),
                ("2026-10-14", "09:00"),
                ("2026-10-15", "15:00")
            ])
        );
        let backup: AppData = serde_json::from_str(&e.export(at(12, 8, 1)).unwrap()).unwrap();
        backup.validate().unwrap();
        e.data.export_plan().validate().unwrap();
        assert_eq!(e.snapshot(at(19, 8, 0)).unwrap().data.tasks.len(), 4);
    }
}
#[test]
fn transient_calendar_prints_all_dates_without_retaining_a_board_or_ledger() {
    let mut e = engine();
    let mut t = template();
    calendar(&mut t);
    let s = e
        .dispatch(
            Action::PrintInstances {
                shape: t.shape,
                printing: t.printing,
            },
            at(12, 9, 30),
        )
        .unwrap();
    assert_eq!(s.data.tasks.len(), 4); // First date is overdue but within its repair window.
    assert!(s.data.templates.is_empty() && s.data.prints.is_empty());
    assert!(s
        .data
        .tasks
        .iter()
        .all(|t| t.template_id.is_none() && !t.recurring));
    assert!(!s.data.task_is_void(&s.data.tasks[0], at(12, 9, 30)));
    let mut e = engine();
    let mut t = template();
    calendar(&mut t);
    t.automatic = true;
    let s = save(&mut e, t, vec![], at(12, 9, 55));
    assert_eq!(s.data.tasks.len(), 3); // Expired morning skipped; afternoon and future dates printed.
}
#[test]
fn cycle_anchor_prints_all_units_and_remains_manual_and_idempotent() {
    let mut e = engine();
    let mut t = template();
    t.printing = Printing::Weekly {
        slots: vec![
            PrintSlot {
                days: vec![1, 3],
                time: Some("09:00".into()),
            },
            PrintSlot {
                days: vec![2, 3, 7],
                time: Some("15:00".into()),
            },
        ],
    };
    let s = save(&mut e, t, vec![Some("2026-10-15".into())], at(12, 8, 0));
    assert_eq!(s.data.tasks.len(), 5);
    assert_eq!(s.data.prints.len(), 4);
    assert_eq!(s.data.templates.len(), 1);
    assert!(s
        .data
        .tasks
        .iter()
        .all(|t| t.due_date.as_deref().unwrap() >= "2026-10-12"
            && t.due_date.as_deref().unwrap() <= "2026-10-18"));
    assert_eq!(e.snapshot(at(19, 8, 0)).unwrap().data.tasks.len(), 5);
    let s = e
        .dispatch(
            Action::PrintTemplate {
                id: "shape".into(),
                dates: vec![Some("2026-10-20".into()), Some("2026-10-25".into())],
            },
            at(19, 8, 0),
        )
        .unwrap();
    assert_eq!(s.data.tasks.len(), 10); // Two anchors in the same cycle print it once.
}
#[test]
fn calendar_validation_and_transient_batches_fail_atomically() {
    let mut e = engine();
    let before = e.export(at(12, 8, 0)).unwrap();
    for slots in [
        vec![CalendarSlot {
            dates: vec!["2026-02-30".into()],
            time: None,
        }],
        vec![CalendarSlot {
            dates: vec!["2026-10-12".into(), "2026-10-12".into()],
            time: None,
        }],
        vec![
            CalendarSlot {
                dates: vec!["2026-10-12".into()],
                time: Some("09:00".into()),
            },
            CalendarSlot {
                dates: vec!["2026-10-14".into()],
                time: Some("09:00".into()),
            },
        ],
        vec![],
    ] {
        let t = template();
        assert!(e
            .dispatch(
                Action::PrintInstances {
                    shape: t.shape,
                    printing: Printing::Calendar { slots }
                },
                at(12, 8, 0)
            )
            .is_err());
        assert_eq!(e.export(at(12, 8, 0)).unwrap(), before);
    }
}
#[test]
fn multiple_shapes_share_a_habit_group_without_splitting_one_shape_per_time() {
    let mut e = engine();
    let s = e
        .dispatch(
            Action::SaveHabitGroup {
                id: None,
                name: "晨间".into(),
            },
            at(12, 8, 0),
        )
        .unwrap();
    let group = s.data.habits[0].id.clone();
    for id in ["exercise", "review"] {
        let mut t = template();
        weekly(&mut t);
        t.id = id.into();
        t.shape.habit_id = Some(group.clone());
        save(&mut e, t, vec![Some("2026-10-12".into())], at(12, 8, 0));
    }
    assert_eq!(e.data.habits.len(), 1);
    assert_eq!(e.data.templates.len(), 2);
    assert_eq!(e.data.tasks.len(), 4);
    let s = e
        .dispatch(Action::DeleteHabit { id: group }, at(12, 8, 1))
        .unwrap();
    assert!(s.data.habits.is_empty() && s.data.templates.is_empty());
    assert!(s
        .data
        .tasks
        .iter()
        .all(|t| t.habit_id.is_none() && t.template_id.is_none() && !t.recurring));
}
