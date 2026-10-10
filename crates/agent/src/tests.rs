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
    Arc::new(Agent {
        engine,
        dir: dir.into(),
        resources: dir.join("no-runtime"),
        inner: Mutex::new(Inner {
            store: Store::default(),
            live: Live::default(),
        }),
        process: Mutex::new(None),
        apply: Arc::new(|_, _| Err("unexpected apply".into())),
        wake: Arc::new(move || {
            wakes.fetch_add(1, Ordering::SeqCst);
        }),
        workspace_lock: Mutex::new(()),
        network_pending: Mutex::new(std::collections::HashMap::new()),
    })
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
