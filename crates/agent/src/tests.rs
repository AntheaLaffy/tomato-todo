use super::*;
use chrono::TimeZone;
use std::sync::atomic::{AtomicUsize, Ordering};

fn action(value: Value) -> Action {
    serde_json::from_value(value).unwrap()
}
fn time() -> i64 {
    Local
        .with_ymd_and_hms(2026, 10, 12, 12, 0, 0)
        .unwrap()
        .timestamp()
}
fn task(engine: &mut Engine, title: &str) {
    engine.dispatch(action(json!({"type":"saveTask","task":{"title":title,"estimate":4,"dueDate":"2026-10-12"}})),time()).unwrap();
}
#[test]
fn review_is_detailed_non_mutating_and_hash_checked() {
    let dir = tempfile::tempdir().unwrap();
    let mut engine = Engine::open(":memory:").unwrap();
    task(&mut engine, "old");
    let original = engine.export(time()).unwrap();
    let file = files::export(
        dir.path(),
        &mut engine,
        &json!({"name":"plan.json"}),
        true,
        time(),
    )
    .unwrap();
    let edited=files::patch(dir.path(),&json!({"name":"plan.json","fileHash":file["fileHash"],"edits":[{"op":"test","path":"/tasks/0/title","value":"old"},{"op":"replace","path":"/tasks/0/title","value":"new"}]})).unwrap();
    let args = json!({"name":"plan.json","fileHash":edited["fileHash"]});
    let (candidate, review) = files::candidate(dir.path(), &mut engine, &args, time()).unwrap();
    assert_eq!(engine.export(time()).unwrap(), original);
    assert!(review["changes"]
        .as_array()
        .unwrap()
        .iter()
        .any(|c| c["path"].as_str().unwrap().ends_with("/title")
            && c["before"] == "old"
            && c["after"] == "new"));
    engine.dispatch(candidate, time()).unwrap();
    assert_eq!(engine.snapshot(time()).unwrap().data.tasks[0].title, "new");
    assert!(files::candidate(dir.path(), &mut engine, &args, time())
        .unwrap_err()
        .contains("数据已变化"));
}
#[test]
fn failed_patch_and_invalid_candidate_leave_files_and_data_untouched() {
    let dir = tempfile::tempdir().unwrap();
    let mut engine = Engine::open(":memory:").unwrap();
    task(&mut engine, "old");
    let file = files::export(
        dir.path(),
        &mut engine,
        &json!({"name":"backup.json"}),
        false,
        time(),
    )
    .unwrap();
    let before = fs::read(dir.path().join("backup.json")).unwrap();
    assert!(files::patch(dir.path(),&json!({"name":"backup.json","fileHash":file["fileHash"],"edits":[{"op":"replace","path":"/tasks/0/title","value":"new"},{"op":"remove","path":"/missing"}]})).is_err());
    assert_eq!(fs::read(dir.path().join("backup.json")).unwrap(), before);
    assert!(files::patch(dir.path(),&json!({"name":"backup.json","fileHash":"stale","edits":[{"op":"replace","path":"/tasks/0/title","value":"new"}]})).is_err());
    assert!(files::read_file(dir.path(), &json!({"name":"../backup.json"})).is_err());
    let edited=files::patch(dir.path(),&json!({"name":"backup.json","fileHash":file["fileHash"],"edits":[{"op":"replace","path":"/settings/focusMinutes","value":0}]})).unwrap();
    assert!(files::candidate(
        dir.path(),
        &mut engine,
        &json!({"name":"backup.json","fileHash":edited["fileHash"]}),
        time()
    )
    .is_err());
    assert_eq!(engine.snapshot(time()).unwrap().data.tasks[0].title, "old");
}
fn service(dir: &Path, wakes: Arc<AtomicUsize>) -> Arc<Agent> {
    private_directory(&dir.join("workspace")).unwrap();
    let engine = Arc::new(Mutex::new(Engine::open(":memory:").unwrap()));
    let apply_engine = engine.clone();
    Arc::new(Agent {
        engine,
        dir: dir.into(),
        resources: dir.join("no-runtime"),
        inner: Mutex::new(Inner {
            store: Store::default(),
            live: Live::default(),
        }),
        process: Mutex::new(None),
        apply: Arc::new(move |action, expected| {
            let mut engine = apply_engine.lock().map_err(|e| e.to_string())?;
            let current = engine.snapshot(time())?;
            if let Some(expected) = expected {
                if !current.data.reminder_idle() || files::fingerprint(&current.data)? != expected {
                    return Err("数据已变化或计时已启动，请重新审阅".into());
                }
            }
            engine.dispatch(action, time())
        }),
        wake: Arc::new(move || {
            wakes.fetch_add(1, Ordering::SeqCst);
        }),
        workspace_lock: Mutex::new(()),
        worker_pending: Mutex::new(std::collections::HashMap::new()),
    })
}
#[test]
fn only_a_user_request_may_edit_mcp_servers_and_course_blocks() {
    let names = |agent: bool| {
        crate::tools::definitions(agent)
            .iter()
            .map(|tool| tool["name"].as_str().unwrap_or_default().to_string())
            .collect::<Vec<_>>()
    };
    let (wake, user) = (names(true), names(false));
    // Reading what is configured is fine on a wake; editing it is not.
    assert!(wake.contains(&"list_mcp_servers".to_string()));
    for tool in [
        "add_mcp_server",
        "remove_mcp_server",
        "save_block",
        "delete_block",
    ] {
        assert!(
            user.contains(&tool.to_string()),
            "{tool} missing for user turns"
        );
        assert!(
            !wake.contains(&tool.to_string()),
            "{tool} leaked into a wake"
        );
    }
}
#[test]
fn agent_cannot_apply_or_dispatch_and_memories_need_confirmation() {
    let dir = tempfile::tempdir().unwrap();
    let agent = service(dir.path(), Arc::new(AtomicUsize::new(0)));
    for name in ["dispatch", "apply_file"] {
        assert_eq!(
            agent.call(name, &json!({}), true).unwrap_err(),
            "工具未授权"
        );
    }
    let memory = agent
        .call(
            "remember",
            &json!({"kind":"hypothesis","text":"可能需要减量","source":"合成测试证据"}),
            true,
        )
        .unwrap();
    assert_eq!(memory["confirmed"], false);
    agent
        .request(json!({"op":"memory_save","id":memory["id"],"text":"用户确认的时间限制"}))
        .unwrap();
    let store = Store::load(dir.path()).unwrap();
    assert!(store.memories[0].confirmed);
    assert_eq!(store.memories[0].text, "用户确认的时间限制");
    let info = agent.status().unwrap();
    assert!(info.get("apiKey").is_none());
}
#[test]
fn interactive_calls_can_configure_tasks_directly() {
    let dir = tempfile::tempdir().unwrap();
    let agent = service(dir.path(), Arc::new(AtomicUsize::new(0)));
    // An automatic wake may only analyse; the same call is authorised once the user asks.
    assert_eq!(
        agent
            .call("create_task", &json!({"title":"刷题"}), true)
            .unwrap_err(),
        "工具未授权"
    );
    let created = agent
        .call(
            "create_task",
            &json!({"title":"刷题","estimate":2,"dueDate":"2026-10-12"}),
            false,
        )
        .unwrap();
    let id = created["data"]["tasks"][0]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let moved = agent
        .call(
            "move_tasks",
            &json!({"ids":[*id.clone()],"dueDate":"2026-10-13"}),
            false,
        )
        .unwrap();
    assert_eq!(moved["data"]["tasks"][0]["dueDate"], "2026-10-13");
    let done = agent
        .call("complete_task", &json!({"id":*id.clone()}), false)
        .unwrap();
    assert_eq!(done["data"]["tasks"][0]["completed"], true);
}
#[test]
fn user_skills_are_readable_from_the_agent_dir() {
    let dir = tempfile::tempdir().unwrap();
    let skill = dir.path().join("skills/my-skill");
    fs::create_dir_all(&skill).unwrap();
    fs::write(skill.join("SKILL.md"), "# 自定义技能").unwrap();
    let agent = service(dir.path(), Arc::new(AtomicUsize::new(0)));
    assert!(agent.available_skills().contains(&"my-skill".to_string()));
    let read = agent
        .call("read_skill", &json!({"name":"my-skill"}), true)
        .unwrap();
    assert_eq!(read["text"], "# 自定义技能");
    assert!(agent
        .call("read_skill", &json!({"name":"../secret"}), true)
        .is_err());
}
#[test]
fn conversations_switch_and_delete() {
    let mut store = Store::default();
    let first = store.new_conversation(10);
    store.message("user", "第一段".into(), 11, false);
    let second = store.new_conversation(20);
    store.message("user", "第二段".into(), 21, false);
    assert_eq!(store.active.as_deref(), Some(second.as_str()));
    assert_eq!(store.messages().len(), 1);
    assert_eq!(store.messages()[0].text, "第二段");
    assert_eq!(store.conversations_view().len(), 2);
    store.switch_conversation(&first).unwrap();
    assert_eq!(store.messages()[0].text, "第一段");
    store.delete_conversation(&first).unwrap();
    assert_eq!(store.active.as_deref(), Some(second.as_str()));
    assert_eq!(store.conversations_view().len(), 1);
}
#[test]
fn legacy_single_conversation_migrates() {
    let dir = tempfile::tempdir().unwrap();
    let legacy = json!({
        "messages":[{"id":"m","role":"user","text":"旧消息","at":5,"automatic":false}],
        "sessionFile":"/tmp/legacy.json"
    });
    fs::write(
        dir.path().join("state.json"),
        serde_json::to_vec(&legacy).unwrap(),
    )
    .unwrap();
    let store = Store::load(dir.path()).unwrap();
    assert_eq!(store.conversations_view().len(), 1);
    assert_eq!(store.messages()[0].text, "旧消息");
    assert_eq!(store.active_session().as_deref(), Some("/tmp/legacy.json"));
}
#[test]
fn wake_waits_for_idle_respects_quiet_and_deduplicates_across_restart() {
    let dir = tempfile::tempdir().unwrap();
    let count = Arc::new(AtomicUsize::new(0));
    let agent = service(dir.path(), count.clone());
    {
        let mut e = agent.engine.lock().unwrap();
        task(&mut e, "overload");
    }
    let mut snapshot = agent.engine.lock().unwrap().snapshot(time()).unwrap();
    agent.observe(&snapshot).unwrap();
    assert_eq!(count.load(Ordering::SeqCst), 0);
    {
        let mut i = agent.inner.lock().unwrap();
        i.store.preferences.enabled = true;
        i.store.preferences.daily_capacity_minutes = Some(30);
        i.store.preferences.quiet_start = "00:00".into();
        i.store.preferences.quiet_end = "00:00".into();
        i.live.last_scan = 0;
        i.live.auth = json!({"deepseek":{"configured":true}});
    }
    snapshot.data.timer.running = true;
    agent.observe(&snapshot).unwrap();
    assert_eq!(count.load(Ordering::SeqCst), 0);
    snapshot.data.timer.running = false;
    snapshot.data.timer.started_at = Some(time());
    agent.observe(&snapshot).unwrap();
    assert_eq!(count.load(Ordering::SeqCst), 0);
    snapshot.data.timer.started_at = None;
    // Missing runtime is intentional: wake scheduling itself must be committed
    // once, even when the analysis cannot start, to prevent retry storms.
    assert!(agent.observe(&snapshot).is_err());
    assert_eq!(count.load(Ordering::SeqCst), 1);
    agent.observe(&snapshot).unwrap();
    assert_eq!(count.load(Ordering::SeqCst), 1);
    let saved = Store::load(dir.path()).unwrap();
    assert_eq!(saved.wakes.len(), 1);
    assert_eq!(saved.wakes[0].status, "failed");
    let restarted = service(dir.path(), count.clone());
    restarted.inner.lock().unwrap().store = saved;
    restarted.inner.lock().unwrap().live.auth = json!({"deepseek":{"configured":true}});
    restarted.observe(&snapshot).unwrap();
    assert_eq!(count.load(Ordering::SeqCst), 1);
    let p = Preferences::default();
    assert!(quiet(
        &p,
        Local
            .with_ymd_and_hms(2026, 10, 12, 23, 0, 0)
            .unwrap()
            .timestamp()
    ));
    assert!(!quiet(&p, time()));
}
