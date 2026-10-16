use super::*;
use chrono::TimeZone;
use std::sync::atomic::{AtomicUsize, Ordering};

#[test]
fn creator_easter_egg_is_agent_selected_and_conversation_scoped() {
    let dir = tempfile::tempdir().unwrap();
    let agent = service(dir.path(), Arc::new(AtomicUsize::new(0)));
    let job = {
        let mut inner = agent.inner.lock().unwrap();
        inner.live.auth = json!({"deepseek":{"configured":true}});
        inner.store.preferences.enabled = true;
        let command = agent
            .prompt_command(
                &mut inner,
                "把你做出来的如月风铃来看看你啦".into(),
                false,
                false,
                vec![],
                vec![],
            )
            .unwrap();
        assert_eq!(command["creatorMode"], false);
        assert_eq!(command["preferences"]["codingAccess"], "workspace");
        assert!(command["tools"]
            .as_array()
            .unwrap()
            .iter()
            .any(|t| t["name"] == "enable_creator_mode"));
        command["jobId"].as_str().unwrap().to_owned()
    };
    assert!(agent
        .call_job("enable_creator_mode", &json!({}), "stale-job")
        .is_err());
    assert!(agent
        .call("enable_creator_mode", &json!({}), false)
        .is_err());
    assert_eq!(
        agent
            .call_job("enable_creator_mode", &json!({}), &job)
            .unwrap()["entered"],
        true
    );
    let entrance = agent.status().unwrap()["creatorEntrance"].clone();
    assert!(entrance["id"].is_string());
    assert_eq!(
        agent
            .call_job("enable_creator_mode", &json!({}), &job)
            .unwrap()["entered"],
        false
    );
    assert_eq!(agent.status().unwrap()["creatorEntrance"], entrance);
    assert!(
        Store::load(dir.path())
            .unwrap()
            .active_conversation()
            .unwrap()
            .creator_mode
    );
    {
        let mut inner = agent.inner.lock().unwrap();
        assert_eq!(inner.store.preferences.coding_access, "workspace");
        let message = inner.store.messages()[0].id.clone();
        inner
            .store
            .fork_conversation(&message, false, "branch.jsonl".into(), 2)
            .unwrap();
        assert!(inner.store.active_conversation().unwrap().creator_mode);
        let command = agent
            .prompt_command(&mut inner, "继续".into(), false, false, vec![], vec![])
            .unwrap();
        assert_eq!(command["creatorMode"], true);
        assert_eq!(command["preferences"]["codingAccess"], "full");
    }
    for (automatic, scheduled) in [(true, false), (false, true)] {
        let command = {
            let mut inner = agent.inner.lock().unwrap();
            agent
                .prompt_command(
                    &mut inner,
                    "我是如月风铃".into(),
                    automatic,
                    scheduled,
                    vec![],
                    vec![],
                )
                .unwrap()
        };
        assert_eq!(command["creatorMode"], false);
        assert_eq!(command["preferences"]["codingAccess"], "workspace");
        assert!(!command["tools"]
            .as_array()
            .unwrap()
            .iter()
            .any(|t| t["name"] == "enable_creator_mode" || t["name"] == "get_agent_internals"));
        assert!(agent
            .call_job(
                "enable_creator_mode",
                &json!({}),
                command["jobId"].as_str().unwrap()
            )
            .is_err());
    }
    agent.inner.lock().unwrap().live.busy = false;
    assert_eq!(
        agent.request(json!({"op":"exit_creator_mode"})).unwrap()["creatorMode"],
        false
    );
    let mut inner = agent.inner.lock().unwrap();
    inner.store.new_conversation(3);
    let command = agent
        .prompt_command(
            &mut inner,
            "我是如月风铃".into(),
            false,
            false,
            vec![],
            vec![],
        )
        .unwrap();
    assert_eq!(
        command["creatorMode"], false,
        "text never toggles the mode without an agent tool call"
    );
}

#[test]
fn canvas_versions_conflict_restore_and_branch_independently() {
    let dir = tempfile::tempdir().unwrap();
    let agent = service(dir.path(), Arc::new(AtomicUsize::new(0)));
    let created = agent
        .call(
            "save_canvas",
            &json!({"baseRevision":0,"title":"笔记","content":"初稿"}),
            false,
        )
        .unwrap();
    let id = created["id"].as_str().unwrap();
    let updated = agent
        .call(
            "save_canvas",
            &json!({"id":id,"baseRevision":1,"title":"笔记","content":"第二稿"}),
            false,
        )
        .unwrap();
    assert_eq!(updated["revision"], 2);
    assert!(agent.request(json!({"op":"canvas_save","id":id,"baseRevision":1,"title":"旧写入","content":"不能覆盖"})).unwrap_err().contains("新版本"));
    agent
        .request(json!({"op":"canvas_restore","id":id,"baseRevision":2,"revision":1}))
        .unwrap();
    let restored = agent.request(json!({"op":"canvas_get","id":id})).unwrap();
    assert_eq!(restored["revision"], 3);
    assert_eq!(restored["content"], "初稿");
    assert_eq!(restored["versions"].as_array().unwrap().len(), 3);
    assert_eq!(
        agent
            .request(json!({"op":"canvas_get","id":id,"revision":2}))
            .unwrap()["content"],
        "第二稿"
    );
    {
        let mut inner = agent.inner.lock().unwrap();
        let original = inner.store.active.clone().unwrap();
        let message = inner
            .store
            .message("assistant", "笔记已保存".into(), 4, false);
        inner
            .store
            .fork_conversation(&message, false, "branch.jsonl".into(), 5)
            .unwrap();
        drop(inner);
        agent
            .call(
                "save_canvas",
                &json!({"id":id,"baseRevision":3,"title":"分支","content":"独立修改"}),
                false,
            )
            .unwrap();
        let mut inner = agent.inner.lock().unwrap();
        inner.store.switch_conversation(&original).unwrap();
        inner.store.save(dir.path()).unwrap();
    }
    assert_eq!(
        agent.request(json!({"op":"canvas_get","id":id})).unwrap()["content"],
        "初稿"
    );
    assert!(!Store::load(dir.path())
        .unwrap()
        .active_conversation()
        .unwrap()
        .canvases
        .is_empty());
    assert!(agent
        .call(
            "save_canvas",
            &json!({"baseRevision":0,"title":"自动","content":"不能改"}),
            true
        )
        .is_err());
    assert!(!tools::definitions(true)
        .iter()
        .any(|t| t["name"] == "generate_image"));
    agent.inner.lock().unwrap().live.busy = true;
    assert!(agent
        .request(json!({"op":"canvas_delete","id":id,"baseRevision":3}))
        .is_err());
    agent.inner.lock().unwrap().live.busy = false;
    agent
        .request(json!({"op":"canvas_delete","id":id,"baseRevision":3}))
        .unwrap();
    assert!(agent.request(json!({"op":"canvas_get","id":id})).is_err());
}

#[test]
fn completed_images_are_private_and_retained_when_stopped() {
    let dir = tempfile::tempdir().unwrap();
    let agent = service(dir.path(), Arc::new(AtomicUsize::new(0)));
    let image = json!({"name":"generated.png","mimeType":"image/png","data":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII="});
    assert!(agent
        .call_job("store_generated_image", &image, "stale-job")
        .is_err());
    {
        let mut inner = agent.inner.lock().unwrap();
        inner.live.busy = true;
        inner.live.job_id = "image-job".into();
        inner.store.preferences.provider = "openai-codex".into();
        inner.store.message("user", "请生成图片".into(), 1, false);
    }
    let result = agent
        .call_job("store_generated_image", &image, "image-job")
        .unwrap();
    assert_eq!(agent.status().unwrap()["generated"][0]["id"], result["id"]);
    agent.event(json!({"type":"done","text":"","stopped":true}));
    let saved = Store::load(dir.path()).unwrap();
    assert_eq!(
        saved.messages().last().unwrap().attachments[0].id,
        result["id"]
    );
    assert!(saved.messages().last().unwrap().stopped);
    assert_eq!(
        attachments::download(dir.path(), result["id"].as_str().unwrap()).unwrap()["data"],
        image["data"]
    );
    assert!(agent
        .call_job("store_generated_image", &image, "image-job")
        .is_err());
    {
        let mut inner = agent.inner.lock().unwrap();
        inner.live.busy = true;
        inner.live.job_id = "image-error-job".into();
        inner.store.message("user", "另一张图片".into(), 2, false);
        inner.store.preferences.provider = "deepseek".into();
    }
    assert!(agent
        .call_job("store_generated_image", &image, "image-error-job")
        .unwrap_err()
        .contains("不支持图像生成"));
    agent.inner.lock().unwrap().store.preferences.provider = "openai-codex".into();
    let completed = agent
        .call_job("store_generated_image", &image, "image-error-job")
        .unwrap();
    agent.event(json!({"type":"error","message":"模型后续请求失败"}));
    assert_eq!(
        Store::load(dir.path())
            .unwrap()
            .messages()
            .last()
            .unwrap()
            .attachments[0]
            .id,
        completed["id"]
    );
    assert_eq!(agent.status().unwrap()["error"], "模型后续请求失败");
}

#[test]
fn thinking_preference_defaults_and_validates_sdk_levels() {
    let mut preferences: Preferences = serde_json::from_value(json!({})).unwrap();
    assert_eq!(preferences.thinking_level, "medium");
    for level in ["off", "minimal", "low", "medium", "high", "xhigh", "max"] {
        preferences.thinking_level = level.into();
        preferences.validate().unwrap();
        let saved = serde_json::to_value(&preferences).unwrap();
        assert_eq!(saved["thinkingLevel"], level);
    }
    preferences.thinking_level = "unknown".into();
    assert!(preferences.validate().is_err());
}

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
fn a_schedule_can_lock_the_machine_before_it_and_skills_can_be_written() {
    let dir = tempfile::tempdir().unwrap();
    let agent = service(dir.path(), Arc::new(AtomicUsize::new(0)));
    // 提前 10 分钟严格锁机：只在到点前那 10 分钟里要锁，锁过就不再锁。
    let saved = agent
        .call(
            "save_schedule",
            &json!({"name":"抢座位","at":"21:50","repeat":"daily","instruction":"用 seat MCP 约明天的座位","lockBeforeMinutes":10,"remindMinutes":15}),
            false,
        )
        .unwrap();
    assert!(saved["saved"].as_str().is_some());
    let schedule: crate::state::Schedule =
        serde_json::from_value(agent.status().unwrap()["schedules"][0].clone()).unwrap();
    let date = chrono::NaiveDate::from_ymd_opt(2026, 10, 12).unwrap();
    assert_eq!(
        schedule.lock_window(date.and_hms_opt(21, 45, 0).unwrap()),
        Some(5)
    );
    assert_eq!(
        schedule.lock_window(date.and_hms_opt(21, 30, 0).unwrap()),
        None
    );
    let mut locked = schedule.clone();
    locked.locked_at = Some(
        chrono::Local
            .with_ymd_and_hms(2026, 10, 12, 21, 45, 0)
            .unwrap()
            .timestamp(),
    );
    assert_eq!(
        locked.lock_window(date.and_hms_opt(21, 45, 0).unwrap()),
        None
    );
    // 技能：写进去能被读到，删掉就没了；名字不合法直接拒绝。
    agent
        .call(
            "save_skill",
            &json!({"name":"seat-rush","description":"定时抢图书馆座位的判断与边界","body":"# 抢座位\n\n先看有没有网……"}),
            false,
        )
        .unwrap();
    let file = dir.path().join("skills/seat-rush/SKILL.md");
    assert!(file.is_file());
    assert!(std::fs::read_to_string(&file)
        .unwrap()
        .contains("description: 定时抢图书馆座位的判断与边界"));
    assert!(agent
        .available_skill_names()
        .contains(&"seat-rush".to_string()));
    assert!(agent
        .call(
            "save_skill",
            &json!({"name":"../evil","description":"x","body":"y"}),
            false
        )
        .is_err());
    assert!(agent
        .call(
            "save_skill",
            &json!({"name":"ok","description":"x","body":""}),
            false
        )
        .is_err());
    agent
        .call("delete_skill", &json!({"name":"seat-rush"}), false)
        .unwrap();
    assert!(!file.exists());
}
#[test]
fn schedules_are_saved_validated_and_only_fire_once_a_day() {
    let dir = tempfile::tempdir().unwrap();
    let agent = service(dir.path(), Arc::new(AtomicUsize::new(0)));
    // 助手自己排一条「每天固定时刻办事」的任务，并把提前提醒写进去。
    let saved = agent
        .call(
            "save_schedule",
            &json!({"name":"抢图书馆座位","at":"21:50","repeat":"weekdays","instruction":"用 seat MCP 预约明天的座位，并建一条按时签到的任务提醒我","remindMinutes":15}),
            false,
        )
        .unwrap();
    assert!(saved["saved"].as_str().is_some_and(|id| !id.is_empty()));
    let listed = agent.call("list_schedules", &json!({}), false).unwrap();
    let schedule = &listed["schedules"][0];
    assert_eq!(schedule["name"], json!("抢图书馆座位"));
    assert_eq!(schedule["enabled"], json!(true));
    assert_eq!(schedule["remindMinutes"], json!(15));
    // due() 只在该时刻那一分钟、且当天没触发过时为真。
    let parsed: crate::state::Schedule = serde_json::from_value(schedule.clone()).unwrap();
    let at = |h, m| {
        chrono::NaiveDate::from_ymd_opt(2026, 10, 12)
            .unwrap()
            .and_hms_opt(h, m, 0)
            .unwrap()
    };
    assert!(parsed.due(at(21, 50)));
    assert!(!parsed.due(at(21, 49)));
    assert!(!parsed.due(at(21, 51)));
    let mut fired = parsed.clone();
    fired.fired_at = Some(
        chrono::Local
            .with_ymd_and_hms(2026, 10, 12, 21, 50, 0)
            .unwrap()
            .timestamp(),
    );
    assert!(!fired.due(at(21, 50)), "同一天不重复触发");
    // 周末不触发（weekdays）。
    let saturday = |h, m| {
        chrono::NaiveDate::from_ymd_opt(2026, 10, 17)
            .unwrap()
            .and_hms_opt(h, m, 0)
            .unwrap()
    };
    assert!(!parsed.due(saturday(21, 50)));
    // 坏输入被拒：时间格式、周期、缺指令。
    assert!(agent
        .call(
            "save_schedule",
            &json!({"name":"x","at":"25:99","instruction":"y"}),
            false
        )
        .is_err());
    assert!(agent
        .call(
            "save_schedule",
            &json!({"name":"x","at":"21:50","repeat":"hourly","instruction":"y"}),
            false
        )
        .is_err());
    assert!(agent
        .call("save_schedule", &json!({"name":"x","at":"21:50"}), false)
        .is_err());
    let id = schedule["id"].as_str().unwrap().to_string();
    assert_eq!(
        agent
            .call("delete_schedule", &json!({"id":id}), false)
            .unwrap()["deleted"],
        json!(id)
    );
    assert_eq!(
        agent.status().unwrap()["schedules"]
            .as_array()
            .unwrap()
            .len(),
        0
    );
}
#[test]
fn what_the_assistant_changed_becomes_a_deed_batch_for_the_ui() {
    let dir = tempfile::tempdir().unwrap();
    let agent = service(dir.path(), Arc::new(AtomicUsize::new(0)));
    // 改数据本身也要能用（这条分支曾经在恢复时漏掉过）。
    let saved = agent
        .call(
            "save_block",
            &json!({"title":"模式识别与机器学习","days":[1],"start":"19:30","end":"21:40","attention":"required"}),
            false,
        )
        .unwrap();
    let block_id = saved["data"]["blocks"][0]["id"]
        .as_str()
        .unwrap()
        .to_string();
    // 轮末（界面看到的 "done"）才打包成一批，带自增 serial。
    agent.event(json!({"type":"done","text":"加好了"}));
    let status = agent.status().unwrap();
    assert_eq!(status["deeds"]["serial"], json!(1));
    assert_eq!(
        status["deeds"]["items"][0]["text"],
        json!("课表里记下了「模式识别与机器学习」")
    );
    assert_eq!(
        status["deeds"]["items"][0]["selector"],
        json!(format!("[data-block-id=\"{block_id}\"]"))
    );
    // 没有改动的一轮不产生新的批次。
    agent.event(json!({"type":"done","text":"只是在聊"}));
    assert_eq!(agent.status().unwrap()["deeds"]["serial"], json!(1));
    // 兜底路径（dispatch）也留痕。
    agent
        .call(
            "dispatch",
            &json!({"action":{"type":"deleteBlock","id":block_id}}),
            false,
        )
        .unwrap();
    agent.event(json!({"type":"done","text":""}));
    let status = agent.status().unwrap();
    assert_eq!(status["deeds"]["serial"], json!(2));
    assert_eq!(
        status["deeds"]["items"][0]["text"],
        json!("删掉了一个课表时段")
    );
}
#[test]
fn show_me_stores_a_bounded_script_and_bumps_its_serial() {
    let dir = tempfile::tempdir().unwrap();
    let agent = service(dir.path(), Arc::new(AtomicUsize::new(0)));
    let play = |steps: Value| agent.call("show_me", &json!({ "steps": steps }), false);
    let first = play(json!([
        { "kind": "move", "target": ".blocks-card" },
        { "kind": "say", "lines": ["色带是课表占用"] }
    ]))
    .unwrap();
    assert_eq!(first["playing"], json!(true));
    assert_eq!(first["serial"], json!(1));
    let status = agent.status().unwrap();
    assert_eq!(status["hand"]["serial"], json!(1));
    assert_eq!(status["hand"]["steps"][1]["kind"], json!("say"));
    // 第二次演出的 serial 必须往前走，界面才知道要再演一遍。
    assert_eq!(
        play(json!([{ "kind": "say", "lines": ["再来一次"] }])).unwrap()["serial"],
        json!(2)
    );
    assert_eq!(
        play(json!([{ "kind": "dance" }])).unwrap_err(),
        "不支持的演示步骤：dance"
    );
    assert!(play(json!([{ "kind": "type", "target": "#agent-text" }, { "kind": "type", "target": "#agent-text", "text": "x".repeat(201) }])).is_err());
    assert!(play(json!([{ "kind": "say", "lines": [] }])).is_err());
}
#[test]
fn questions_take_multi_select_and_a_real_approve_label() {
    let dir = tempfile::tempdir().unwrap();
    let agent = service(dir.path(), Arc::new(AtomicUsize::new(0)));
    let ask = |questions: Value| {
        agent.call(
            "request_user_input",
            &json!({ "questions": questions }),
            true,
        )
    };
    // Multi-select plus a plan-review intent whose approve label exists.
    assert_eq!(
        ask(json!([{"id":"apply","header":"确认","question":"写进软件？","detail":"新增 12 个任务","multiSelect":true,"options":[{"label":"批准","description":"按方案写入"},{"label":"先说说","description":"想改几处"}],"intent":{"kind":"plan-review","approve":"批准"}}]))
            .unwrap()["shown"],
        serde_json::json!(true)
    );
    assert_eq!(
        ask(json!([{"id":"x","header":"确认","question":"？","options":[{"label":"A","description":"a"},{"label":"B","description":"b"}],"intent":{"kind":"plan-review","approve":"C"}}]))
            .unwrap_err(),
        "批准项必须是该问题的一个选项"
    );
    assert!(ask(json!([{"id":"x","header":"确认","question":"？","options":[{"label":"A","description":"a"},{"label":"A","description":"b"}]}])).is_err());
    assert!(ask(json!([{"id":"x","header":"确认","question":"？","options":[{"label":"only one","description":""}]}])).is_err());
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
    // 向用户提问的选择卡必须两种模式都能用：曾经只在唤醒里，正常对话拿不到。
    for tool in ["request_user_input", "update_plan"] {
        assert!(wake.contains(&tool.to_string()), "{tool} missing on a wake");
        assert!(
            user.contains(&tool.to_string()),
            "{tool} missing for user turns"
        );
    }
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
fn conversation_archive_is_persistent_searchable_and_reversible() {
    let dir = tempfile::tempdir().unwrap();
    let agent = service(dir.path(), Arc::new(AtomicUsize::new(0)));
    let (id, message) = {
        let mut inner = agent.inner.lock().unwrap();
        let id = inner.store.new_conversation(1);
        let message = inner.store.message("user", "归档资料".into(), 2, false);
        (id, message)
    };
    agent
        .request(json!({"op":"pin_conversation","id":id,"pinned":true}))
        .unwrap();
    let result = agent
        .request(json!({"op":"archive_conversation","id":id,"archived":true}))
        .unwrap();
    assert_eq!(result["conversations"][0]["archived"], true);
    let store = Store::load(dir.path()).unwrap();
    assert!(store.active_conversation().unwrap().archived);
    assert!(store.active_conversation().unwrap().pinned);
    assert_eq!(store.messages()[0].id, message);
    assert_eq!(
        agent
            .request(json!({"op":"search_conversations","query":"归档资料"}))
            .unwrap()["conversations"][0]["id"],
        id
    );
    agent.inner.lock().unwrap().live.busy = true;
    assert!(agent
        .request(json!({"op":"archive_conversation","id":id,"archived":false}))
        .is_err());
    agent.inner.lock().unwrap().live.busy = false;
    assert!(agent
        .request(json!({"op":"archive_conversation","id":id}))
        .is_err());
    agent
        .request(json!({"op":"archive_conversation","id":id,"archived":false}))
        .unwrap();
    let store = Store::load(dir.path()).unwrap();
    assert!(!store.active_conversation().unwrap().archived);
    assert_eq!(store.messages()[0].text, "归档资料");
}
#[test]
fn conversation_search_keeps_old_content_and_branch_preserves_original() {
    let dir = tempfile::tempdir().unwrap();
    let agent = service(dir.path(), Arc::new(AtomicUsize::new(0)));
    let (original, target) = {
        let mut inner = agent.inner.lock().unwrap();
        let original = inner.store.new_conversation(1);
        inner.store.message("user", "第一轮".into(), 2, false);
        let target =
            inner
                .store
                .message("assistant", format!("{}微积分", "x".repeat(200)), 3, false);
        inner.store.message_mut(&target).unwrap().entry_id = Some("pi-node".into());
        inner.store.set_session("original.jsonl", 3);
        for at in 4..360 {
            inner
                .store
                .message("assistant", "后续讨论".into(), at, false);
        }
        inner.store.save(dir.path()).unwrap();
        (original, target)
    };
    let found = agent
        .request(json!({"op":"search_conversations","query":"微积分"}))
        .unwrap();
    assert_eq!(found["conversations"][0]["id"], original);
    assert_eq!(found["conversations"][0]["messageId"], target);
    assert!(found["conversations"][0]["snippet"]
        .as_str()
        .unwrap()
        .contains("微积分"));
    agent
        .request(json!({"op":"rename_conversation","id":original,"title":"Analysis"}))
        .unwrap();
    assert_eq!(
        agent
            .request(json!({"op":"search_conversations","query":"ANALYSIS"}))
            .unwrap()["conversations"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    agent
        .request(json!({"op":"pin_conversation","id":original,"pinned":true}))
        .unwrap();
    let mut store = Store::load(dir.path()).unwrap();
    assert!(store.messages().len() > 300);
    let before = serde_json::to_value(store.active_conversation().unwrap()).unwrap();
    let branch = store
        .fork_conversation(&target, false, "branch.jsonl".into(), 400)
        .unwrap();
    assert_eq!(store.messages().len(), 2);
    assert_eq!(store.messages()[1].entry_id.as_deref(), Some("pi-node"));
    assert_eq!(store.active_session().as_deref(), Some("branch.jsonl"));
    assert_eq!(
        store
            .active_conversation()
            .unwrap()
            .branched_from
            .as_ref()
            .unwrap()
            .conversation_id,
        original
    );
    store.switch_conversation(&original).unwrap();
    assert_eq!(
        serde_json::to_value(store.active_conversation().unwrap()).unwrap(),
        before
    );
    store.delete_conversation(&original).unwrap();
    assert_eq!(store.active.as_deref(), Some(branch.as_str()));
}
#[test]
fn attachments_are_private_validated_and_survive_message_branches() {
    use base64::Engine as _;
    let dir = tempfile::tempdir().unwrap();
    private_directory(&dir.path().join("workspace")).unwrap();
    let content = "科目,小时\n数学,3\n";
    let args = json!({"name":"复习.csv","mimeType":"text/csv","data":base64::engine::general_purpose::STANDARD.encode(content)});
    let file = attachments::upload(dir.path(), &args).unwrap();
    let (meta, bytes) = attachments::load(dir.path(), &file.id).unwrap();
    assert_eq!(meta.bytes, content.len());
    assert_eq!(bytes, content.as_bytes());
    assert!(attachments::upload(dir.path(), &json!({"name":"../outside","data":"AA=="})).is_err());
    assert!(attachments::upload(
        dir.path(),
        &json!({"name":"image.png","mimeType":"image/png","data":"AA=="})
    )
    .is_err());
    assert!(attachments::load(dir.path(), "../outside").is_err());
    assert!(attachments::for_prompt(dir.path(), &json!([file.id, file.id])).is_err());
    let mut store = Store::default();
    let original = store.new_conversation(1);
    let message = store.message("user", "看附件".into(), 2, false);
    store.message_mut(&message).unwrap().attachments = vec![file.clone()];
    store
        .fork_conversation(&message, false, "branch.jsonl".into(), 3)
        .unwrap();
    store.delete_conversation(&original).unwrap();
    store.save(dir.path()).unwrap();
    let loaded = Store::load(dir.path()).unwrap();
    assert_eq!(loaded.messages()[0].attachments[0].id, file.id);
    assert_eq!(
        attachments::download(dir.path(), &file.id).unwrap()["data"],
        args["data"]
    );
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let path = dir
            .path()
            .join("workspace/attachments")
            .join(&file.id)
            .join(&file.name);
        assert_eq!(
            fs::metadata(&path).unwrap().permissions().mode() & 0o777,
            0o600
        );
        fs::remove_file(&path).unwrap();
        std::os::unix::fs::symlink(dir.path().join("state.json"), &path).unwrap();
        assert!(attachments::download(dir.path(), &file.id).is_err());
    }
}
#[test]
fn sdk_entry_ids_and_user_stop_persist_without_a_failure() {
    let dir = tempfile::tempdir().unwrap();
    let agent = service(dir.path(), Arc::new(AtomicUsize::new(0)));
    let id = agent
        .inner
        .lock()
        .unwrap()
        .store
        .message("user", "请求".into(), 1, false);
    agent.event(json!({"type":"message_entry","messageId":id,"entryId":"user-node"}));
    agent.event(json!({"type":"text","text":"工具前的说明"}));
    agent.event(json!({"type":"thinking","text":"先检查资料"}));
    agent.event(json!({"type":"text_reset"}));
    agent.event(json!({"type":"text","text":"部分回复"}));
    agent.event(json!({"type":"done","text":"部分回复","entryId":"assistant-node","stopped":true}));
    let s = agent.status().unwrap();
    assert_eq!(s["messages"][0]["entryId"], "user-node");
    assert_eq!(s["messages"][1]["entryId"], "assistant-node");
    assert_eq!(s["messages"][1]["stopped"], true);
    assert_eq!(s["stream"], "");
    assert_eq!(s["thinking"], "");
    assert_eq!(s["messages"][1]["thinking"], "先检查资料");
    assert!(s["error"].is_null());
    let saved = Store::load(dir.path()).unwrap();
    assert!(saved.messages()[1].stopped);
    assert_eq!(saved.messages()[1].thinking, "先检查资料");
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

#[test]
fn agent_next_to_the_binary_outranks_the_resource_dir() {
    let root = tempfile::tempdir().unwrap();
    let exe_dir = root.path().join("lib/tomato-todo");
    std::fs::create_dir_all(exe_dir.join("agent")).unwrap();
    std::fs::write(exe_dir.join("agent/worker.mjs"), b"").unwrap();
    let exe = exe_dir.join("tomato-todo");
    std::fs::write(&exe, b"").unwrap();
    let resources_dir = root.path().join("lib/Tomato Todo");
    std::fs::create_dir_all(resources_dir.join("agent")).unwrap();
    std::fs::write(resources_dir.join("agent/worker.mjs"), b"").unwrap();
    assert_eq!(resources(&exe, Some(&resources_dir)), exe_dir.join("agent"));
}

#[test]
fn resource_dir_covers_a_system_install_where_the_agent_is_not_beside_the_binary() {
    let root = tempfile::tempdir().unwrap();
    let exe_dir = root.path().join("bin");
    std::fs::create_dir_all(&exe_dir).unwrap();
    let exe = exe_dir.join("tomato-todo");
    std::fs::write(&exe, b"").unwrap();
    // Tauri installs bundled resources under /usr/lib/<product name>; the
    // executable lives in /usr/bin, so the lookup must fall back to it.
    let resources_dir = root.path().join("lib/Tomato Todo");
    std::fs::create_dir_all(resources_dir.join("agent")).unwrap();
    std::fs::write(resources_dir.join("agent/worker.mjs"), b"").unwrap();
    assert_eq!(
        resources(&exe, Some(&resources_dir)),
        resources_dir.join("agent")
    );
}
