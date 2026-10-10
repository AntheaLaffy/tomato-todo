use super::*;

fn example_plan() -> plan::PlanFile {
    serde_json::from_str(include_str!("../../../docs/plan.example.json")).unwrap()
}
#[test]
fn documented_backup_example_loads_and_round_trips_new_lock_fields() {
    let data: AppData =
        serde_json::from_str(include_str!("../../../docs/backup.example.json")).unwrap();
    data.validate().unwrap();
    let mut e = engine();
    let s = e
        .dispatch(
            Action::Import {
                data: Box::new(data),
            },
            1000,
        )
        .unwrap();
    assert!(s.data.lock.schedules[0].strict);
    assert!(!s.data.lock.schedules[0].enabled);
    let exported: AppData = serde_json::from_str(&e.export(1000).unwrap()).unwrap();
    assert_eq!(exported.lock.schedules[0].start, "23:00");
    assert!(!exported.settings.protection.strict);
}

fn friday(hour: u32, minute: u32) -> i64 {
    Local
        .with_ymd_and_hms(2026, 10, 9, hour, minute, 0)
        .unwrap()
        .timestamp()
}
fn sleep_schedule(strict: bool) -> lock::LockSchedule {
    lock::LockSchedule {
        id: "sleep".into(),
        name: "睡眠".into(),
        start: "23:00".into(),
        end: "07:00".into(),
        days: vec![5],
        enabled: true,
        strict,
    }
}

#[test]
fn strict_focus_rejects_every_early_exit_in_both_modes_and_recovers_at_deadline() {
    for mode in [GuardMode::Lock, GuardMode::Whitelist] {
        let mut e = engine();
        let settings = Settings {
            protection: Protection {
                mode,
                strict: true,
                whitelist: vec!["editor".into()],
            },
            ..Settings::default()
        };
        e.dispatch(Action::SaveSettings { settings }, 1000).unwrap();
        e.dispatch(Action::StartTimer, 1000).unwrap();
        for action in [
            Action::EmergencyUnlock,
            Action::PauseTimer,
            Action::ResetTimer,
            Action::SkipTimer,
            Action::SaveSettings {
                settings: Settings::default(),
            },
            Action::Import {
                data: Box::default(),
            },
            Action::StartQuickLock {
                minutes: 1,
                strict: false,
            },
        ] {
            assert!(e.dispatch(action, 1100).unwrap_err().contains("严格模式"));
        }
        assert!(e.snapshot(2499).unwrap().data.strict_protected());
        assert!(!e.snapshot(2500).unwrap().data.protected());
        assert_eq!(e.data.sessions.len(), 1);
        assert!(e.data.sessions[0].completed);
        e.dispatch(
            Action::SaveSettings {
                settings: Settings::default(),
            },
            2500,
        )
        .unwrap();
    }
}

#[test]
fn scheduled_sleep_crosses_midnight_and_does_not_count_as_focus() {
    let mut e = engine();
    e.dispatch(
        Action::SaveLockSchedule {
            schedule: sleep_schedule(true),
        },
        friday(22, 0),
    )
    .unwrap();
    assert!(!e.snapshot(friday(22, 59)).unwrap().data.protected());
    e.dispatch(Action::StartTimer, friday(22, 58)).unwrap();
    let at = friday(23, 0);
    let s = e.snapshot(at).unwrap();
    assert!(s.data.strict_protected());
    assert!(!s.data.timer.running);
    assert_eq!(s.data.sessions.len(), 1);
    assert_eq!(s.data.sessions[0].duration_secs, 120);
    assert!(!s.data.sessions[0].completed);
    assert!(e.dispatch(Action::EmergencyUnlock, at + 3600).is_err());
    assert!(e.snapshot(at + 7 * 3600).unwrap().data.protected());
    assert!(!e.snapshot(at + 8 * 3600).unwrap().data.protected());
    assert_eq!(e.data.sessions.len(), 1);
    assert!(!e.snapshot(at + 86400).unwrap().data.protected()); // Saturday is not selected.
}

#[test]
fn ordinary_lock_can_end_once_strict_quick_lock_survives_restart() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("lock.sqlite3");
    let mut e = Engine::open(&path).unwrap();
    e.dispatch(
        Action::SaveLockSchedule {
            schedule: sleep_schedule(false),
        },
        friday(22, 0),
    )
    .unwrap();
    e.snapshot(friday(23, 0)).unwrap();
    e.dispatch(Action::EmergencyUnlock, friday(23, 1)).unwrap();
    assert!(!e.snapshot(friday(23, 2)).unwrap().data.protected());
    e.dispatch(
        Action::StartQuickLock {
            minutes: 2,
            strict: true,
        },
        friday(23, 3),
    )
    .unwrap();
    drop(e);
    let mut e = Engine::open(&path).unwrap();
    assert!(e.snapshot(friday(23, 4)).unwrap().data.strict_protected());
    assert!(e.dispatch(Action::EmergencyUnlock, friday(23, 4)).is_err());
    assert!(!e.snapshot(friday(23, 5)).unwrap().data.protected());
    assert!(e.data.sessions.is_empty());
}

#[test]
fn invalid_schedules_are_atomic_and_restoring_backups_does_not_arm_locks() {
    let mut e = engine();
    let now = friday(22, 0);
    let before = e.export(now).unwrap();
    let mut invalid = sleep_schedule(true);
    invalid.start = "25:00".into();
    assert!(e
        .dispatch(Action::SaveLockSchedule { schedule: invalid }, now)
        .is_err());
    assert_eq!(e.export(now).unwrap(), before);
    e.dispatch(
        Action::SaveLockSchedule {
            schedule: sleep_schedule(true),
        },
        now,
    )
    .unwrap();
    let mut overlap = sleep_schedule(false);
    overlap.id = "overlap".into();
    overlap.days = vec![6];
    overlap.start = "06:00".into();
    overlap.end = "08:00".into();
    assert!(e
        .dispatch(Action::SaveLockSchedule { schedule: overlap }, now)
        .is_err());
    let backup = e.snapshot(now).unwrap().data;
    let s = e
        .dispatch(
            Action::Import {
                data: Box::new(backup),
            },
            now,
        )
        .unwrap();
    assert!(!s.data.lock.schedules[0].enabled);
    assert!(!e.snapshot(friday(23, 0)).unwrap().data.protected());
    let mut old = serde_json::to_value(AppData::default()).unwrap();
    old.as_object_mut().unwrap().remove("lock");
    old["settings"]["protection"]
        .as_object_mut()
        .unwrap()
        .remove("strict");
    let old: AppData = serde_json::from_value(old).unwrap();
    assert!(old.lock.schedules.is_empty());
    assert!(!old.settings.protection.strict);
}

#[test]
fn only_desktop_fault_recovery_can_release_strict_lock_early() {
    let mut e = engine();
    e.dispatch(
        Action::StartQuickLock {
            minutes: 60,
            strict: true,
        },
        1000,
    )
    .unwrap();
    assert!(e.dispatch(Action::EmergencyUnlock, 1001).is_err());
    e.release_failed_protection(1001).unwrap();
    assert!(!e.snapshot(1002).unwrap().data.protected());
    assert!(e.data.sessions.is_empty());
}

#[test]
fn ending_a_quick_break_does_not_cancel_the_upcoming_sleep_window() {
    let mut e = engine();
    e.dispatch(
        Action::SaveLockSchedule {
            schedule: sleep_schedule(true),
        },
        friday(22, 0),
    )
    .unwrap();
    e.dispatch(
        Action::StartQuickLock {
            minutes: 30,
            strict: false,
        },
        friday(22, 59),
    )
    .unwrap();
    e.dispatch(Action::EmergencyUnlock, friday(22, 59) + 10)
        .unwrap();
    assert!(e.snapshot(friday(23, 0)).unwrap().data.strict_protected());
}

#[test]
fn plan_round_trip_merges_without_resetting_progress_or_timer() {
    let mut e = engine();
    let settings = Settings {
        focus_minutes: 30,
        ..Settings::default()
    };
    e.dispatch(Action::SaveSettings { settings }, 1000).unwrap();
    e.dispatch(Action::StartTimer, 1000).unwrap();
    let before = e.snapshot(1010).unwrap().data;
    let first = e
        .dispatch(
            Action::ImportPlan {
                plan: example_plan(),
            },
            1010,
        )
        .unwrap();
    assert_eq!(first.data.tasks.len(), 1);
    assert_eq!(first.data.tasks[0].estimate, 2);
    assert_eq!(first.data.settings.focus_minutes, 30);
    assert_eq!(
        serde_json::to_value(&before.timer).unwrap(),
        serde_json::to_value(&first.data.timer).unwrap()
    );
    assert_eq!(first.data.sessions.len(), before.sessions.len());
    let task = first.data.tasks[0].clone();
    e.dispatch(
        Action::ToggleSubtask {
            task_id: task.id.clone(),
            subtask_id: task.subtasks[0].id.clone(),
        },
        1020,
    )
    .unwrap();
    let exported = e.snapshot(1020).unwrap().data.export_plan();
    exported.validate().unwrap();
    assert_eq!(exported.pomodoro_minutes, 30);
    assert_eq!(exported.projects.len(), 1);
    let json = serde_json::to_value(&exported).unwrap();
    assert!(json.get("settings").is_none());
    assert!(json["tasks"][0].get("completed").is_none());
    assert!(json["tasks"][0]["subtasks"][0].get("done").is_none());
    let second = e
        .dispatch(
            Action::ImportPlan {
                plan: exported.clone(),
            },
            1030,
        )
        .unwrap();
    assert_eq!(second.data.tasks.len(), 1);
    assert!(second.data.tasks[0].subtasks[0].done);
    e.dispatch(Action::ToggleTask { id: task.id }, 1040)
        .unwrap();
    let third = e
        .dispatch(
            Action::ImportPlan {
                plan: example_plan(),
            },
            1050,
        )
        .unwrap();
    assert_eq!(third.data.tasks.len(), 1);
    assert!(third.data.tasks[0].completed);
    assert!(third.data.export_plan().tasks.is_empty());
    let mut fresh = engine();
    let imported = fresh
        .dispatch(Action::ImportPlan { plan: exported }, 1060)
        .unwrap();
    assert_eq!(imported.data.tasks[0].estimate, 3); // ceil(2*30/25)
    assert!(!imported.data.tasks[0].subtasks[0].done);
}

#[test]
fn plan_validation_and_conversion_fail_atomically() {
    let mut e = engine();
    let before = e.export(1000).unwrap();
    let mut cases = Vec::new();
    let mut plan = example_plan();
    plan.tasks.push(plan.tasks[0].clone());
    cases.push(plan);
    let mut plan = example_plan();
    plan.tasks[0].project_id = Some("missing".into());
    cases.push(plan);
    let mut plan = example_plan();
    plan.tasks[0].due_date = Some("2026-02-30".into());
    cases.push(plan);
    let mut plan = example_plan();
    plan.version = 3;
    cases.push(plan);
    let mut plan = example_plan();
    plan.pomodoro_minutes = 0;
    cases.push(plan);
    let mut plan = example_plan();
    plan.pomodoro_minutes = 180;
    plan.tasks[0].estimate = 99;
    cases.push(plan);
    for plan in cases {
        assert!(e.dispatch(Action::ImportPlan { plan }, 1000).is_err());
        assert_eq!(e.export(1000).unwrap(), before);
    }
    let mut json = serde_json::to_value(example_plan()).unwrap();
    json["tasks"][0]["completed"] = true.into();
    assert!(serde_json::from_value::<plan::PlanFile>(json).is_err());
}

#[test]
fn plan_defaults_and_protection_match_task_contract() {
    let plan: plan::PlanFile = serde_json::from_str(r#"{"format":"tomato-todo-plan","version":1,"pomodoroMinutes":25,"projects":[],"tasks":[{"id":"minimal","title":"最小任务"}]}"#).unwrap();
    plan.validate().unwrap();
    assert_eq!(plan.tasks[0].estimate, 1);
    assert_eq!(plan.tasks[0].repeat, Repeat::None);
    let mut e = engine();
    let mut settings = Settings::default();
    settings.protection.mode = GuardMode::Lock;
    e.dispatch(Action::SaveSettings { settings }, 1000).unwrap();
    e.dispatch(Action::StartTimer, 1000).unwrap();
    assert!(e.dispatch(Action::ImportPlan { plan }, 1001).is_err());
    assert!(e.data.tasks.is_empty());
}

fn project_whitelist(e: &mut Engine, id: &str) -> Option<Vec<String>> {
    e.snapshot(1000)
        .unwrap()
        .data
        .projects
        .iter()
        .find(|p| p.id == id)
        .unwrap()
        .app_whitelist
        .clone()
}

#[test]
fn plan_project_whitelist_is_added_then_overwritten_by_import() {
    let mut e = engine();
    let create: plan::PlanFile = serde_json::from_str(
        r##"{"format":"tomato-todo-plan","version":1,"pomodoroMinutes":25,"projects":[{"id":"english","name":"英语一","color":"#849b7d","appWhitelist":["org.mozilla.firefox"]}],"tasks":[{"id":"t1","title":"词汇","projectId":"english"}]}"##,
    )
    .unwrap();
    e.dispatch(Action::ImportPlan { plan: create }, 1000)
        .unwrap();
    assert_eq!(
        project_whitelist(&mut e, "english"),
        Some(vec!["org.mozilla.firefox".to_string()])
    );

    // A regenerated file replaces the list, which is the agent round-trip.
    let update: plan::PlanFile = serde_json::from_str(
        r##"{"format":"tomato-todo-plan","version":1,"pomodoroMinutes":25,"projects":[{"id":"english","name":"英语一","color":"#849b7d","appWhitelist":["org.mozilla.firefox","mdict"]}],"tasks":[]}"##,
    )
    .unwrap();
    e.dispatch(Action::ImportPlan { plan: update }, 1010)
        .unwrap();
    assert_eq!(
        project_whitelist(&mut e, "english"),
        Some(vec!["org.mozilla.firefox".to_string(), "mdict".to_string()])
    );

    // Omitting the field keeps the local list instead of clearing it.
    let keep: plan::PlanFile = serde_json::from_str(
        r##"{"format":"tomato-todo-plan","version":1,"pomodoroMinutes":25,"projects":[{"id":"english","name":"英语一","color":"#849b7d"}],"tasks":[]}"##,
    )
    .unwrap();
    e.dispatch(Action::ImportPlan { plan: keep }, 1020).unwrap();
    assert_eq!(
        project_whitelist(&mut e, "english"),
        Some(vec!["org.mozilla.firefox".to_string(), "mdict".to_string()])
    );
}

#[test]
fn effective_whitelist_prefers_project_list_over_global() {
    let mut e = engine();
    let mut settings = Settings::default();
    settings.protection.whitelist = vec!["global.app".into()];
    e.dispatch(Action::SaveSettings { settings }, 1000).unwrap();
    let project = e
        .dispatch(
            Action::SaveProject {
                id: None,
                name: "英语".into(),
                color: "#849b7d".into(),
            },
            1000,
        )
        .unwrap()
        .data
        .projects
        .last()
        .unwrap()
        .id
        .clone();
    let task = e
        .dispatch(
            Action::SaveTask {
                task: TaskDraft {
                    project_id: Some(project.clone()),
                    ..draft()
                },
            },
            1000,
        )
        .unwrap()
        .data
        .tasks
        .last()
        .unwrap()
        .id
        .clone();
    // Before selecting a task only the global list applies.
    assert_eq!(
        e.snapshot(1000).unwrap().data.effective_whitelist(),
        vec!["global.app".to_string()]
    );
    e.dispatch(Action::SelectTask { id: Some(task) }, 1000)
        .unwrap();
    // Without a dedicated list the global list still applies.
    assert_eq!(
        e.snapshot(1000).unwrap().data.effective_whitelist(),
        vec!["global.app".to_string()]
    );
    // A dedicated list replaces the global one, so a project-only app is
    // allowed and the broader global list no longer is.
    e.dispatch(
        Action::SetProjectWhitelist {
            id: project.clone(),
            whitelist: Some(vec!["dict".into()]),
        },
        1000,
    )
    .unwrap();
    assert_eq!(
        e.snapshot(1000).unwrap().data.effective_whitelist(),
        vec!["dict".to_string()]
    );
    // Disabling falls back to the global list.
    e.dispatch(
        Action::SetProjectWhitelist {
            id: project.clone(),
            whitelist: None,
        },
        1000,
    )
    .unwrap();
    assert_eq!(
        e.snapshot(1000).unwrap().data.effective_whitelist(),
        vec!["global.app".to_string()]
    );
    // A blank project app ID is rejected without clobbering the stored list.
    assert!(e
        .dispatch(
            Action::SetProjectWhitelist {
                id: project.clone(),
                whitelist: Some(vec!["  ".into()]),
            },
            1000,
        )
        .is_err());
    e.dispatch(
        Action::SetProjectWhitelist {
            id: project,
            whitelist: Some(vec!["dict".into()]),
        },
        1000,
    )
    .unwrap();
    assert_eq!(
        e.snapshot(1000).unwrap().data.effective_whitelist(),
        vec!["dict".to_string()]
    );
}

#[test]
fn goals_group_tasks_and_track_count_progress() {
    let mut e = engine();
    let s = e
        .dispatch(
            Action::SaveGoal {
                id: None,
                name: "OpenCamp".into(),
                target: 3.0,
                unit: "节".into(),
                measure: GoalMeasure::Count,
                due_date: None,
            },
            1000,
        )
        .unwrap();
    let goal = s.data.goals[0].id.clone();
    let mut d1 = draft();
    d1.goal_id = Some(goal.clone());
    d1.due_date = Some("2026-10-09".into());
    let s = e.dispatch(Action::SaveTask { task: d1 }, 1000).unwrap();
    let task = s.data.tasks[0].id.clone();
    let mut d2 = draft();
    d2.goal_id = Some(goal.clone());
    e.dispatch(Action::SaveTask { task: d2 }, 1000).unwrap();
    assert_eq!(e.snapshot(1000).unwrap().data.goal_progress(&goal), 0.0);
    e.dispatch(Action::ToggleTask { id: task }, 1000).unwrap();
    assert_eq!(e.snapshot(1000).unwrap().data.goal_progress(&goal), 1.0);
    e.dispatch(Action::DeleteGoal { id: goal }, 1000).unwrap();
    let s = e.snapshot(1000).unwrap();
    assert!(s.data.goals.is_empty());
    assert!(s.data.tasks.iter().all(|t| t.goal_id.is_none()));
}

#[test]
fn time_goal_accumulates_focused_hours() {
    let mut e = engine();
    let s = e
        .dispatch(
            Action::SaveGoal {
                id: None,
                name: "OpenCamp".into(),
                target: 30.0,
                unit: "小时".into(),
                measure: GoalMeasure::Time,
                due_date: None,
            },
            1000,
        )
        .unwrap();
    let goal = s.data.goals[0].id.clone();
    let mut d = draft();
    d.goal_id = Some(goal.clone());
    d.focus_minutes = Some(30);
    let s = e.dispatch(Action::SaveTask { task: d }, 1000).unwrap();
    let task = s.data.tasks[0].id.clone();
    e.dispatch(Action::SelectTask { id: Some(task) }, 1000)
        .unwrap();
    e.dispatch(Action::StartTimer, 1000).unwrap();
    e.dispatch(Action::ResetTimer, 1000 + 3600).unwrap();
    let progress = e.snapshot(1000 + 3600).unwrap().data.goal_progress(&goal);
    assert!((progress - 0.5).abs() < 1e-9);
}

#[test]
fn goal_validation_rejects_bad_fields() {
    for (target, unit) in [(0.0, "节"), (-1.0, "节"), (10.0, "  ")] {
        let mut e = engine();
        assert!(e
            .dispatch(
                Action::SaveGoal {
                    id: None,
                    name: "目标".into(),
                    target,
                    unit: unit.into(),
                    measure: GoalMeasure::Count,
                    due_date: None,
                },
                1000,
            )
            .is_err());
    }
    let mut e = engine();
    assert!(e
        .dispatch(
            Action::SaveGoal {
                id: None,
                name: "坏日期".into(),
                target: 1.0,
                unit: "节".into(),
                measure: GoalMeasure::Count,
                due_date: Some("2026-02-30".into()),
            },
            1000,
        )
        .is_err());
}

#[test]
fn expired_routines_count_as_misses_but_goal_work_does_not() {
    let mut e = engine();
    let mut routine = draft();
    routine.due_date = Some("2026-10-09".into());
    routine.reminder_time = Some("09:00".into());
    routine.focus_minutes = Some(25);
    routine.estimate = 1;
    e.dispatch(Action::SaveTask { task: routine }, friday(8, 0))
        .unwrap();
    // The same schedule under a goal is a catch-up, not a routine miss.
    let s = e
        .dispatch(
            Action::SaveGoal {
                id: None,
                name: "OpenCamp".into(),
                target: 1.0,
                unit: "节".into(),
                measure: GoalMeasure::Count,
                due_date: None,
            },
            friday(8, 0),
        )
        .unwrap();
    let goal = s.data.goals[0].id.clone();
    let mut goal_task = draft();
    goal_task.due_date = Some("2026-10-09".into());
    goal_task.reminder_time = Some("09:00".into());
    goal_task.focus_minutes = Some(25);
    goal_task.estimate = 1;
    goal_task.goal_id = Some(goal);
    e.dispatch(Action::SaveTask { task: goal_task }, friday(8, 0))
        .unwrap();
    let s = e.snapshot(friday(12, 0)).unwrap();
    assert!(s.data.tasks.iter().all(|t| t.reminder_expired));
    let day = s
        .stats
        .days
        .iter()
        .find(|d| d.date == "2026-10-09")
        .unwrap();
    assert_eq!(day.missed, 1);
}

#[test]
fn habits_materialize_today_once_and_detach_on_delete() {
    let mut e = engine();
    let s = e
        .dispatch(
            Action::SaveHabit {
                id: None,
                name: "午饭".into(),
                project_id: None,
                focus_minutes: Some(25),
                slots: vec![
                    HabitSlot {
                        days: vec![1, 2, 3, 4, 5],
                        time: "12:00".into(),
                    },
                    HabitSlot {
                        days: vec![6, 7],
                        time: "12:40".into(),
                    },
                ],
            },
            friday(8, 0),
        )
        .unwrap();
    let habit = s.data.habits[0].id.clone();
    let todays: Vec<_> = s
        .data
        .tasks
        .iter()
        .filter(|t| t.habit_id.as_deref() == Some(habit.as_str()))
        .collect();
    assert_eq!(todays.len(), 1);
    assert_eq!(todays[0].reminder_time.as_deref(), Some("12:00"));
    assert_eq!(todays[0].due_date.as_deref(), Some("2026-10-09"));
    // Ticking again must not duplicate the occurrence.
    let s = e.snapshot(friday(8, 1)).unwrap();
    assert_eq!(
        s.data
            .tasks
            .iter()
            .filter(|t| t.habit_id.as_deref() == Some(habit.as_str()))
            .count(),
        1
    );
    // Deleting the habit leaves the occurrence as an ordinary timed task.
    e.dispatch(Action::DeleteHabit { id: habit }, friday(8, 2))
        .unwrap();
    assert!(e
        .snapshot(friday(8, 2))
        .unwrap()
        .data
        .tasks
        .iter()
        .all(|t| t.habit_id.is_none()));
}

#[test]
fn habit_validation_rejects_overlapping_days_and_bad_times() {
    let mut e = engine();
    let slot = |days: Vec<u8>, time: &str| HabitSlot {
        days,
        time: time.into(),
    };
    for slots in [
        vec![slot(vec![1, 2], "12:00"), slot(vec![2, 3], "12:30")],
        vec![slot(vec![], "12:00")],
        vec![slot(vec![1], "25:00")],
        vec![],
    ] {
        assert!(e
            .dispatch(
                Action::SaveHabit {
                    id: None,
                    name: "习惯".into(),
                    project_id: None,
                    focus_minutes: None,
                    slots,
                },
                friday(8, 0),
            )
            .is_err());
    }
}

#[test]
fn protection_rejects_mutations_until_emergency_or_completion() {
    let mut e = engine();
    let settings = Settings {
        protection: Protection {
            mode: GuardMode::Lock,
            whitelist: vec![],
            strict: false,
        },
        ..Settings::default()
    };
    e.dispatch(Action::SaveSettings { settings }, 1000).unwrap();
    e.dispatch(Action::StartTimer, 1000).unwrap();
    assert!(e.dispatch(Action::PauseTimer, 1100).is_err());
    assert!(e.dispatch(Action::ResetTimer, 1100).is_err());
    assert!(e
        .dispatch(
            Action::SaveSettings {
                settings: Settings::default()
            },
            1100
        )
        .is_err());
    let unlocked = e.dispatch(Action::EmergencyUnlock, 1100).unwrap();
    assert!(!unlocked.data.protected());
    assert_eq!(unlocked.data.sessions[0].duration_secs, 100);
    assert!(!unlocked.data.sessions[0].completed);
    e.dispatch(Action::StartTimer, 1200).unwrap();
    assert!(!e.snapshot(2700).unwrap().data.protected());
}

#[test]
fn recurring_weekday_task_skips_weekend_and_does_not_duplicate() {
    let mut e = engine();
    let at = Local
        .with_ymd_and_hms(2026, 10, 9, 12, 0, 0)
        .unwrap()
        .timestamp();
    let mut d = draft();
    d.due_date = Some("2026-10-09".into());
    d.repeat = Repeat::Weekdays;
    d.subtasks = vec![Subtask {
        id: id(),
        title: "步骤".into(),
        done: true,
    }];
    let s = e.dispatch(Action::SaveTask { task: d }, at).unwrap();
    let id = s.data.tasks[0].id.clone();
    let s = e
        .dispatch(Action::ToggleTask { id: id.clone() }, at)
        .unwrap();
    assert_eq!(s.data.tasks[1].due_date.as_deref(), Some("2026-10-12"));
    assert!(!s.data.tasks[1].subtasks[0].done);
    e.dispatch(Action::ToggleTask { id: id.clone() }, at)
        .unwrap();
    e.dispatch(Action::ToggleTask { id }, at).unwrap();
    assert_eq!(e.data.tasks.len(), 2);
}

#[test]
fn statistics_use_local_day_and_keep_partial_minutes_separate() {
    let mut e = engine();
    let today = Local
        .with_ymd_and_hms(2026, 10, 9, 12, 0, 0)
        .unwrap()
        .timestamp();
    e.dispatch(Action::StartTimer, today - 86400).unwrap();
    e.snapshot(today - 86400 + 1500).unwrap();
    e.dispatch(Action::SetMode { mode: Mode::Focus }, today)
        .unwrap();
    e.dispatch(Action::StartTimer, today).unwrap();
    let s = e.dispatch(Action::ResetTimer, today + 120).unwrap();
    assert_eq!(s.stats.today_seconds, 120);
    assert_eq!(s.stats.today_pomodoros, 0);
    assert_eq!(s.stats.total_seconds, 1620);
    assert_eq!(s.stats.streak, 1);
}

#[test]
fn corrupt_database_is_preserved() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("data.db");
    drop(Engine::open(&path).unwrap());
    let conn = Connection::open(&path).unwrap();
    conn.execute("UPDATE app_state SET data='not-json'", [])
        .unwrap();
    assert!(Engine::open(&path).is_err());
    let raw: String = conn
        .query_row("SELECT data FROM app_state", [], |r| r.get(0))
        .unwrap();
    assert_eq!(raw, "not-json");
}

#[test]
fn auto_break_starts_only_during_live_transition() {
    let mut e = engine();
    e.dispatch(
        Action::SaveSettings {
            settings: Settings {
                auto_break: true,
                ..Settings::default()
            },
        },
        1000,
    )
    .unwrap();
    e.dispatch(Action::StartTimer, 1000).unwrap();
    let s = e.snapshot(2501).unwrap();
    assert!(s.data.timer.running);
    assert_eq!(s.data.timer.mode, Mode::ShortBreak);
    assert_eq!(s.remaining_secs, 300);
}
fn engine() -> Engine {
    Engine::open(":memory:").unwrap()
}
fn draft() -> TaskDraft {
    TaskDraft {
        id: None,
        title: "测试任务".into(),
        notes: "".into(),
        project_id: None,
        goal_id: None,
        due_date: None,
        reminder_time: None,
        focus_minutes: None,
        priority: 2,
        estimate: 2,
        tags: vec![],
        subtasks: vec![],
        repeat: Repeat::None,
    }
}
#[test]
fn pause_resume_excludes_paused_time_and_counts_once() {
    let mut e = engine();
    e.dispatch(Action::StartTimer, 1000).unwrap();
    assert_eq!(
        e.dispatch(Action::PauseTimer, 1100).unwrap().remaining_secs,
        1400
    );
    assert_eq!(e.snapshot(2000).unwrap().remaining_secs, 1400);
    e.dispatch(Action::StartTimer, 2000).unwrap();
    let s = e.snapshot(3400).unwrap();
    assert_eq!(s.data.sessions[0].duration_secs, 1500);
    assert_eq!(s.data.timer.mode, Mode::ShortBreak);
    assert!(!s.data.timer.running);
    assert_eq!(e.snapshot(9999).unwrap().data.sessions.len(), 1);
}
#[test]
fn long_break_after_four_completed_focus_sessions() {
    let mut e = engine();
    for i in 0..4 {
        let t = 1000 + i * 2000;
        e.dispatch(Action::SetMode { mode: Mode::Focus }, t)
            .unwrap();
        e.dispatch(Action::StartTimer, t).unwrap();
        e.snapshot(t + 1500).unwrap();
    }
    assert_eq!(e.data.timer.mode, Mode::LongBreak);
    assert_eq!(e.data.sessions.len(), 4);
}
#[test]
fn invalid_action_cannot_mutate_memory_or_database() {
    let mut e = engine();
    let mut d = draft();
    d.title = "  ".into();
    assert!(e.dispatch(Action::SaveTask { task: d }, 1000).is_err());
    assert!(e.data.tasks.is_empty());
    let settings = Settings {
        long_break_every: 0,
        ..Settings::default()
    };
    assert!(e.dispatch(Action::SaveSettings { settings }, 1000).is_err());
    assert_eq!(e.data.settings.long_break_every, 4);
}
#[test]
fn reopening_recovers_timer_without_fabricating_sessions() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("data.db");
    {
        let mut e = Engine::open(&path).unwrap();
        let settings = Settings {
            auto_break: true,
            auto_focus: true,
            ..Settings::default()
        };
        e.dispatch(Action::SaveSettings { settings }, 1000).unwrap();
        e.dispatch(Action::StartTimer, 1000).unwrap();
    }
    let mut e = Engine::open(path).unwrap();
    let s = e.snapshot(90000).unwrap();
    assert_eq!(s.data.sessions.len(), 1);
    assert!(!s.data.timer.running);
}
#[test]
fn partial_sessions_do_not_count_as_completed_pomodoros() {
    let mut e = engine();
    e.dispatch(Action::StartTimer, 1000).unwrap();
    let s = e.dispatch(Action::ResetTimer, 1060).unwrap();
    assert_eq!(s.data.sessions[0].duration_secs, 60);
    assert!(!s.data.sessions[0].completed);
    assert_eq!(s.stats.total_pomodoros, 0);
    assert_eq!(s.stats.total_seconds, 60);
}
#[test]
fn task_edit_completion_delete_and_restore() {
    let mut e = engine();
    let s = e
        .dispatch(Action::SaveTask { task: draft() }, 1000)
        .unwrap();
    let task = s.data.tasks[0].clone();
    e.dispatch(
        Action::SelectTask {
            id: Some(task.id.clone()),
        },
        1000,
    )
    .unwrap();
    e.dispatch(
        Action::ToggleTask {
            id: task.id.clone(),
        },
        1001,
    )
    .unwrap();
    assert!(e.data.tasks[0].completed);
    e.dispatch(
        Action::DeleteTask {
            id: task.id.clone(),
        },
        1002,
    )
    .unwrap();
    assert!(e.data.timer.task_id.is_none());
    e.dispatch(Action::RestoreTask { task }, 1003).unwrap();
    assert_eq!(e.data.tasks.len(), 1);
}
#[test]
fn import_validates_before_replacing_and_pauses_timer() {
    let mut e = engine();
    let mut backup = AppData::default();
    backup.settings.focus_minutes = 0;
    assert!(e
        .dispatch(
            Action::Import {
                data: Box::new(backup)
            },
            1000
        )
        .is_err());
    assert_eq!(e.data.settings.focus_minutes, 25);
    let mut backup = AppData::default();
    backup.start(1000);
    let s = e
        .dispatch(
            Action::Import {
                data: Box::new(backup),
            },
            1100,
        )
        .unwrap();
    assert!(!s.data.timer.running);
    assert_eq!(s.remaining_secs, 1400);
}
#[test]
fn active_task_cannot_be_switched_mid_session() {
    let mut e = engine();
    e.dispatch(Action::StartTimer, 1000).unwrap();
    assert!(e.dispatch(Action::SelectTask { id: None }, 1001).is_err());
}
#[test]
fn deleting_project_preserves_tasks() {
    let mut e = engine();
    let project = e.data.projects[0].id.clone();
    let mut d = draft();
    d.project_id = Some(project.clone());
    e.dispatch(Action::SaveTask { task: d }, 1000).unwrap();
    e.dispatch(Action::DeleteProject { id: project }, 1000)
        .unwrap();
    assert_eq!(e.data.tasks.len(), 1);
    assert!(e.data.tasks[0].project_id.is_none());
}

#[test]
fn reminders_defer_during_focus_and_pause_then_start_atomically() {
    let mut e = engine();
    let mut d = draft();
    d.due_date = Some("2026-10-09".into());
    d.reminder_time = Some("09:00".into());
    let s = e
        .dispatch(Action::SaveTask { task: d }, friday(8, 59))
        .unwrap();
    let id = s.data.tasks[0].id.clone();
    assert!(!s.data.tasks[0].reminder_fired);
    e.dispatch(Action::StartTimer, friday(8, 59)).unwrap();
    let s = e.snapshot(friday(9, 0)).unwrap();
    assert!(s.data.tasks[0].reminder_pending);
    assert!(s.data.pending_reminder().is_none());
    e.dispatch(Action::PauseTimer, friday(9, 0)).unwrap();
    assert!(e
        .dispatch(Action::StartReminder { id: id.clone() }, friday(9, 1))
        .is_err());
    let s = e.dispatch(Action::ResetTimer, friday(9, 1)).unwrap();
    assert_eq!(s.data.pending_reminder().unwrap().id, id);
    let s = e
        .dispatch(Action::StartReminder { id: id.clone() }, friday(9, 1))
        .unwrap();
    assert!(s.data.timer.running);
    assert_eq!(s.data.timer.task_id, Some(id));
    assert!(!s.data.tasks[0].reminder_pending);
}

#[test]
fn reminder_persists_reschedule_rearms_and_old_days_expire() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("reminders.sqlite3");
    let mut e = Engine::open(&path).unwrap();
    let mut d = draft();
    d.due_date = Some("2026-10-09".into());
    d.reminder_time = Some("09:00".into());
    let s = e
        .dispatch(Action::SaveTask { task: d.clone() }, friday(9, 1))
        .unwrap();
    let id = s.data.tasks[0].id.clone();
    assert!(s.data.pending_reminder().is_some());
    // There is no dismiss action: an unhandled reminder stays pending, and
    // that state survives a restart.
    drop(e);
    let mut e = Engine::open(&path).unwrap();
    assert!(e
        .snapshot(friday(9, 2))
        .unwrap()
        .data
        .pending_reminder()
        .is_some());
    // Rescheduling to a later time re-arms the reminder.
    d.id = Some(id);
    d.reminder_time = Some("10:00".into());
    e.dispatch(Action::SaveTask { task: d }, friday(9, 2))
        .unwrap();
    assert!(e
        .snapshot(friday(9, 30))
        .unwrap()
        .data
        .pending_reminder()
        .is_none());
    assert!(e
        .snapshot(friday(10, 0))
        .unwrap()
        .data
        .pending_reminder()
        .is_some());
    // A new day clears yesterday's unhandled reminder.
    assert!(e
        .snapshot(friday(10, 0) + 86400)
        .unwrap()
        .data
        .pending_reminder()
        .is_none());
}

#[test]
fn reminder_expires_after_its_planned_block() {
    let mut e = engine();
    let mut d = draft();
    d.due_date = Some("2026-10-09".into());
    d.reminder_time = Some("09:00".into());
    d.focus_minutes = Some(25);
    d.estimate = 1;
    e.dispatch(Action::SaveTask { task: d }, friday(8, 50))
        .unwrap();
    // 1 session, 25 min: valid until 09:25.
    assert!(e
        .snapshot(friday(9, 20))
        .unwrap()
        .data
        .pending_reminder()
        .is_some());
    let late = e.snapshot(friday(9, 26)).unwrap().data;
    assert!(!late.tasks[0].reminder_pending);
    assert!(late.pending_reminder().is_none());
}

#[test]
fn reminder_window_covers_multi_pomodoro_breaks_and_old_slots_stay_void() {
    let mut e = engine();
    let mut d = draft();
    d.due_date = Some("2026-10-09".into());
    d.reminder_time = Some("09:00".into());
    d.focus_minutes = Some(25);
    d.estimate = 3;
    e.dispatch(Action::SaveTask { task: d }, friday(8, 50))
        .unwrap();
    // 3 * 25 + 2 short breaks (5) = 85 min: valid until 10:25.
    assert!(e
        .snapshot(friday(10, 20))
        .unwrap()
        .data
        .pending_reminder()
        .is_some());
    assert!(e
        .snapshot(friday(10, 26))
        .unwrap()
        .data
        .pending_reminder()
        .is_none());
    // A slot that was already over before the app opened never fires.
    let mut late = engine();
    let mut d = draft();
    d.due_date = Some("2026-10-09".into());
    d.reminder_time = Some("09:00".into());
    d.focus_minutes = Some(25);
    d.estimate = 1;
    late.dispatch(Action::SaveTask { task: d }, friday(8, 0))
        .unwrap();
    let s = late.snapshot(friday(12, 0)).unwrap().data;
    assert!(!s.tasks[0].reminder_pending);
    assert!(s.pending_reminder().is_none());
}

#[test]
fn single_session_length_is_independent_of_the_date() {
    let mut e = engine();
    let mut d = draft();
    d.due_date = None;
    d.focus_minutes = Some(40);
    let s = e.dispatch(Action::SaveTask { task: d }, 1000).unwrap();
    let id = s.data.tasks[0].id.clone();
    e.dispatch(Action::SelectTask { id: Some(id) }, 1000)
        .unwrap();
    assert_eq!(e.snapshot(1000).unwrap().data.timer.duration_secs, 40 * 60);
}

#[test]
fn reminder_validation_and_lock_deferral() {
    let mut e = engine();
    for time in ["9:00", "24:00", "12:60", "早上", "aa:bb"] {
        let mut d = draft();
        d.due_date = Some("2026-10-09".into());
        d.reminder_time = Some(time.into());
        assert!(e
            .dispatch(Action::SaveTask { task: d }, friday(8, 0))
            .is_err());
    }
    let mut d = draft();
    d.reminder_time = Some("09:00".into());
    assert!(e
        .dispatch(Action::SaveTask { task: d.clone() }, friday(8, 0))
        .is_err());
    d.due_date = Some("2026-10-09".into());
    e.dispatch(Action::SaveTask { task: d }, friday(8, 59))
        .unwrap();
    e.dispatch(
        Action::StartQuickLock {
            minutes: 2,
            strict: false,
        },
        friday(8, 59),
    )
    .unwrap();
    assert!(e
        .snapshot(friday(9, 0))
        .unwrap()
        .data
        .pending_reminder()
        .is_none());
    assert!(e
        .snapshot(friday(9, 1))
        .unwrap()
        .data
        .pending_reminder()
        .is_some());
}

#[test]
fn custom_duration_and_repeat_keep_schedule_without_changing_global_settings() {
    let mut e = engine();
    let mut d = draft();
    d.due_date = Some("2026-10-09".into());
    d.reminder_time = Some("09:00".into());
    d.focus_minutes = Some(40);
    d.repeat = Repeat::Daily;
    let s = e
        .dispatch(Action::SaveTask { task: d }, friday(9, 0))
        .unwrap();
    let id = s.data.tasks[0].id.clone();
    let s = e
        .dispatch(Action::StartReminder { id: id.clone() }, friday(9, 0))
        .unwrap();
    assert_eq!(s.remaining_secs, 2400);
    assert_eq!(s.data.settings.focus_minutes, 25);
    e.dispatch(Action::ResetTimer, friday(9, 1)).unwrap();
    let s = e.dispatch(Action::ToggleTask { id }, friday(9, 1)).unwrap();
    let next = &s.data.tasks[1];
    assert_eq!(next.focus_minutes, Some(40));
    assert_eq!(next.reminder_time.as_deref(), Some("09:00"));
    assert!(!next.reminder_fired);
    assert!(!next.reminder_pending);
    assert_eq!(next.due_date.as_deref(), Some("2026-10-10"));
}

#[test]
fn v2_plan_preserves_schedule_and_duration_old_backups_remain_flexible() {
    let mut e = engine();
    let mut d = draft();
    d.due_date = Some("2026-10-09".into());
    d.reminder_time = Some("09:00".into());
    d.focus_minutes = Some(40);
    let s = e
        .dispatch(Action::SaveTask { task: d }, friday(8, 0))
        .unwrap();
    let mut plan = s.data.export_plan();
    assert_eq!(plan.version, 2);
    let imported = engine()
        .dispatch(Action::ImportPlan { plan: plan.clone() }, friday(8, 0))
        .unwrap();
    let t = &imported.data.tasks[0];
    assert_eq!(t.focus_minutes, Some(40));
    assert_eq!(t.estimate, 2);
    assert_eq!(t.reminder_time.as_deref(), Some("09:00"));
    plan.version = 1;
    assert!(plan.validate().is_err());
    let mut json = serde_json::to_value(&s.data).unwrap();
    let task = json["tasks"][0].as_object_mut().unwrap();
    for key in [
        "focusMinutes",
        "reminderTime",
        "reminderFired",
        "reminderPending",
    ] {
        task.remove(key);
    }
    let old: AppData = serde_json::from_value(json).unwrap();
    assert!(old.tasks[0].reminder_time.is_none());
    assert!(old.tasks[0].focus_minutes.is_none());
    old.validate().unwrap();
}

#[test]
fn reminder_queue_and_completion_do_not_drop_other_tasks() {
    let mut e = engine();
    let mut d = draft();
    d.due_date = Some("2026-10-09".into());
    d.reminder_time = Some("09:00".into());
    e.dispatch(Action::SaveTask { task: d.clone() }, friday(8, 0))
        .unwrap();
    d.reminder_time = Some("09:01".into());
    e.dispatch(Action::SaveTask { task: d }, friday(8, 0))
        .unwrap();
    let s = e.snapshot(friday(9, 2)).unwrap();
    let id = s.data.pending_reminder().unwrap().id.clone();
    let s = e.dispatch(Action::ToggleTask { id }, friday(9, 2)).unwrap();
    assert_eq!(
        s.data.pending_reminder().unwrap().reminder_time.as_deref(),
        Some("09:01")
    );
    let mut bad = draft();
    bad.focus_minutes = Some(0);
    assert!(e
        .dispatch(Action::SaveTask { task: bad }, friday(9, 2))
        .is_err());
}

#[test]
fn imported_partial_timer_keeps_remaining_time_and_defers_reminders() {
    let mut e = engine();
    let mut d = draft();
    d.due_date = Some("2026-10-09".into());
    d.reminder_time = Some("09:00".into());
    let mut data = e
        .dispatch(Action::SaveTask { task: d }, friday(8, 0))
        .unwrap()
        .data;
    data.timer.remaining_secs = 6;
    data.timer.started_at = None;
    let s = e
        .dispatch(
            Action::Import {
                data: Box::new(data),
            },
            friday(9, 0),
        )
        .unwrap();
    assert!(s.data.pending_reminder().is_none());
    let s = e.dispatch(Action::StartTimer, friday(9, 0)).unwrap();
    assert_eq!(s.remaining_secs, 6);
    assert!(!e.snapshot(friday(9, 0) + 6).unwrap().data.timer.running);
}
