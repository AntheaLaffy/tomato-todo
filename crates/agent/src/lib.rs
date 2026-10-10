//! App-owned Pi orchestration. The embedded agent cannot dispatch app mutations.
mod bridge;
pub mod files;
mod state;
#[cfg(test)]
mod tests;
pub mod tools;
mod worker;

use chrono::{Local, TimeZone, Timelike};
use serde_json::{json, Value};
pub use state::Preferences;
use state::{nonempty_text, private_directory, Memory, Store, WakeRecord};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};
use tomato_core::{
    diagnostics::{diagnose, Anomaly},
    now, Action, AppResult, Engine, Snapshot,
};

pub type SharedEngine = Arc<Mutex<Engine>>;
pub type Apply = Arc<dyn Fn(Action, Option<String>) -> AppResult<Snapshot> + Send + Sync>;
#[derive(Default)]
struct Live {
    busy: bool,
    authentication: bool,
    text: String,
    error: Option<String>,
    auth: Value,
    auth_event: Value,
    tool: String,
    wake_serial: u64,
    automatic: bool,
    anomalies: Vec<Anomaly>,
    last_scan: i64,
    reviewed: std::collections::HashMap<String, String>,
    job_id: String,
}
struct Inner {
    store: Store,
    live: Live,
}
pub struct Agent {
    engine: SharedEngine,
    dir: PathBuf,
    resources: PathBuf,
    inner: Mutex<Inner>,
    process: Mutex<Option<worker::Process>>,
    apply: Apply,
    wake: Arc<dyn Fn() + Send + Sync>,
    workspace_lock: Mutex<()>,
    network_pending:
        Mutex<std::collections::HashMap<String, std::sync::mpsc::Sender<AppResult<Value>>>>,
}
impl Agent {
    pub fn open(
        engine: SharedEngine,
        dir: PathBuf,
        resources: PathBuf,
        apply: Apply,
        wake: Arc<dyn Fn() + Send + Sync>,
    ) -> AppResult<Arc<Self>> {
        private_directory(&dir)?;
        private_directory(&dir.join("workspace"))?;
        private_directory(&dir.join("sessions"))?;
        let mut store = Store::load(&dir)?;
        for record in &mut store.wakes {
            if record.status == "running" {
                record.status = "interrupted".into();
            }
        }
        store.save(&dir)?;
        let service = Arc::new(Self {
            engine,
            dir,
            resources,
            inner: Mutex::new(Inner {
                store,
                live: Live::default(),
            }),
            process: Mutex::new(None),
            apply,
            wake,
            workspace_lock: Mutex::new(()),
            network_pending: Mutex::new(std::collections::HashMap::new()),
        });
        bridge::start(&service)?;
        if let Err(error) = service.ensure_worker() {
            service.inner.lock().map_err(|e| e.to_string())?.live.error = Some(error);
        }
        Ok(service)
    }
    pub fn data_dir(&self) -> &Path {
        &self.dir
    }
    fn ensure_worker(self: &Arc<Self>) -> AppResult<()> {
        let mut process = self.process.lock().map_err(|e| e.to_string())?;
        if let Some(p) = process.as_mut() {
            if p.child.try_wait().map_err(|e| e.to_string())?.is_none() {
                return Ok(());
            }
        }
        *process = Some(worker::start(self)?);
        Ok(())
    }
    fn send(self: &Arc<Self>, value: Value) -> AppResult<()> {
        self.ensure_worker()?;
        worker::send(
            self.process
                .lock()
                .map_err(|e| e.to_string())?
                .as_mut()
                .ok_or("Agent 进程未启动")?,
            &value,
        )
    }
    pub fn request(self: &Arc<Self>, args: Value) -> AppResult<Value> {
        let op = args["op"].as_str().ok_or("缺少 Agent 操作")?;
        match op {
            "status" => self.status(),
            "usage" => {
                let id = uuid::Uuid::new_v4().to_string();
                let (tx, rx) = std::sync::mpsc::channel();
                self.network_pending
                    .lock()
                    .map_err(|e| e.to_string())?
                    .insert(id.clone(), tx);
                let result = self.send(json!({"op":"usage","id":id})).and_then(|_| {
                    rx.recv_timeout(std::time::Duration::from_secs(20))
                        .map_err(|_| "获取用量超时".to_string())?
                });
                self.network_pending
                    .lock()
                    .map_err(|e| e.to_string())?
                    .remove(&id);
                result
            }
            "download_file" => {
                let _lock = self.workspace_lock.lock().map_err(|e| e.to_string())?;
                files::download(&self.dir.join("workspace"), &args)
            }
            "configure" => {
                let preferences: Preferences = serde_json::from_value(args["preferences"].clone())
                    .map_err(|e| e.to_string())?;
                preferences.validate()?;
                if ["apiKey", "exaKey"]
                    .iter()
                    .any(|key| args[*key].as_str().is_some_and(|v| v.len() > 4096))
                {
                    return Err("Key 过长".into());
                }
                {
                    let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
                    if inner.live.busy {
                        return Err("请先停止当前分析或登录再修改后端配置".into());
                    }
                    inner.store.preferences = preferences;
                    inner.store.save(&self.dir)?;
                }
                let api_key = args["apiKey"].as_str().unwrap_or_default().trim();
                let exa_key = args["exaKey"].as_str().unwrap_or_default().trim();
                if !api_key.is_empty() || !exa_key.is_empty() {
                    self.begin_auth()?;
                    if let Err(e) =
                        self.send(json!({"op":"api_key","key":api_key,"exaKey":exa_key}))
                    {
                        self.failure(&e);
                        return Err(e);
                    }
                }
                self.status()
            }
            "login" => {
                self.begin_auth()?;
                if let Err(e) = self.send(json!({"op":"login"})) {
                    self.failure(&e);
                    return Err(e);
                }
                self.status()
            }
            "login_answer" => {
                self.send(json!({"op":"login_answer","text":nonempty_text(&args,"text",8192)?}))?;
                self.status()
            }
            "logout" => {
                self.begin_auth()?;
                let provider = self
                    .inner
                    .lock()
                    .map_err(|e| e.to_string())?
                    .store
                    .preferences
                    .provider
                    .clone();
                if let Err(e) = self.send(json!({"op":"logout","provider":provider})) {
                    self.failure(&e);
                    return Err(e);
                }
                self.status()
            }
            "send" => {
                let images = validated_images(&args["images"])?;
                let text = if args["text"].as_str().is_none_or(|t| t.trim().is_empty())
                    && !images.is_empty()
                {
                    "请识别并分析这些图片，不清楚的地方先问我。".into()
                } else {
                    nonempty_text(&args, "text", 32000)?
                };
                self.prompt(text, false, images)?;
                self.status()
            }
            "cancel" => {
                self.send(json!({"op":"cancel"}))?;
                self.status()
            }
            "memory_save" => {
                let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
                let text = nonempty_text(&args, "text", 8000)?;
                let id = args["id"].as_str().unwrap_or_default();
                if let Some(m) = inner.store.memories.iter_mut().find(|m| m.id == id) {
                    m.text = text;
                    m.confirmed = true;
                    m.updated_at = now();
                } else {
                    if inner.store.memories.len() >= 200 {
                        return Err("记忆最多200条，请先整理".into());
                    }
                    inner.store.memories.push(Memory {
                        id: uuid::Uuid::new_v4().to_string(),
                        kind: "profile".into(),
                        text,
                        source: "用户在学习助手中录入".into(),
                        confirmed: true,
                        updated_at: now(),
                    });
                }
                inner.store.save(&self.dir)?;
                drop(inner);
                self.status()
            }
            "memory_delete" => {
                let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
                inner
                    .store
                    .memories
                    .retain(|m| Some(m.id.as_str()) != args["id"].as_str());
                inner.store.save(&self.dir)?;
                drop(inner);
                self.status()
            }
            "new_conversation" => {
                let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
                if inner.live.busy {
                    return Err("请先停止当前分析".into());
                }
                inner.store.session_file = None;
                inner.store.messages.clear();
                inner.store.save(&self.dir)?;
                drop(inner);
                self.status()
            }
            "tool" => self.call(
                args["name"].as_str().ok_or("缺少工具名")?,
                &args["arguments"],
                false,
            ),
            _ => Err("未知 Agent 操作".into()),
        }
    }
    fn begin_auth(&self) -> AppResult<()> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        if inner.live.busy {
            return Err("当前分析或登录尚未结束".into());
        }
        inner.live.busy = true;
        inner.live.authentication = true;
        inner.live.error = None;
        inner.live.auth_event = Value::Null;
        Ok(())
    }
    fn prompt(
        self: &Arc<Self>,
        text: String,
        automatic: bool,
        images: Vec<Value>,
    ) -> AppResult<()> {
        let command = {
            let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
            if inner.live.busy && !automatic {
                return Err("当前分析尚未结束".into());
            }
            let p = inner.store.preferences.clone();
            if !p.enabled {
                return Err("请先在连接配置中启用学习助手".into());
            }
            if inner.live.auth[&p.provider]["configured"] != true {
                return Err("请先配置 DeepSeek API Key 或完成 Codex 账号登录".into());
            }
            inner.live.busy = true;
            inner.live.authentication = false;
            inner.live.text.clear();
            inner.live.error = None;
            inner.live.automatic = automatic;
            inner.live.job_id = uuid::Uuid::new_v4().to_string();
            let displayed = if images.is_empty() {
                text.clone()
            } else {
                format!("{text}\n（附{}张图片，保存在私有会话中）", images.len())
            };
            inner.store.message("user", displayed, now(), automatic);
            inner.store.save(&self.dir)?;
            json!({"op":"prompt","automatic":automatic,"jobId":inner.live.job_id,"text":text,"images":images,"provider":p.provider,"model":p.model,"preferences":p,"sessionFile":inner.store.session_file,"tools":tools::definitions(automatic)})
        };
        if let Err(error) = self.send(command) {
            self.failure(&error);
            return Err(error);
        }
        Ok(())
    }
    fn failure(&self, error: &str) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.live.busy = false;
            inner.live.authentication = false;
            inner.live.error = Some(error.into());
            for w in inner.store.wakes.iter_mut().rev().take(30) {
                if w.status == "running" {
                    w.status = "failed".into();
                }
            }
            let _ = inner.store.save(&self.dir);
        }
    }
    fn event(&self, event: Value) {
        let Ok(mut inner) = self.inner.lock() else {
            return;
        };
        match event["type"].as_str().unwrap_or_default() {
            "auth" => {
                inner.live.auth = event["providers"].clone();
            }
            "auth_event" => {
                let incoming = &event["event"];
                if incoming["type"] == "auth_url" || !inner.live.auth_event.is_object() {
                    inner.live.auth_event = incoming.clone();
                } else if let Some(fields) = incoming.as_object() {
                    for (key, value) in fields {
                        inner.live.auth_event[key] = value.clone();
                    }
                }
            }
            "text" => {
                if let Some(text) = event["text"].as_str() {
                    if inner.live.text.len() < 512 * 1024 {
                        inner.live.text.push_str(text);
                    }
                }
            }
            "tool_start" => {
                inner.live.tool = event["name"].as_str().unwrap_or_default().into();
            }
            "session" => {
                if let Some(path) = event["path"].as_str() {
                    let path = PathBuf::from(path);
                    if path.starts_with(self.dir.join("sessions")) {
                        inner.store.session_file = Some(path.to_string_lossy().into_owned());
                    }
                }
            }
            "done" => {
                inner.live.busy = false;
                inner.live.authentication = false;
                inner.live.tool.clear();
                inner.live.auth_event = Value::Null;
                let text = event["text"]
                    .as_str()
                    .unwrap_or(&inner.live.text)
                    .to_string();
                let automatic = inner.live.automatic;
                if !text.is_empty() {
                    inner.store.message("assistant", text, now(), automatic);
                }
                inner.live.text.clear();
                for w in &mut inner.store.wakes {
                    if w.status == "running" {
                        w.status = "completed".into();
                    }
                }
            }
            "error" => {
                inner.live.busy = false;
                inner.live.authentication = false;
                inner.live.tool.clear();
                inner.live.error = Some(
                    event["message"]
                        .as_str()
                        .unwrap_or("Agent 请求失败")
                        .to_string(),
                );
                for w in &mut inner.store.wakes {
                    if w.status == "running" {
                        w.status = "failed".into();
                    }
                }
            }
            _ => {}
        }
        if !matches!(
            event["type"].as_str(),
            Some("text" | "tool_start" | "auth_event")
        ) {
            let _ = inner.store.save(&self.dir);
        }
    }
    pub fn status(&self) -> AppResult<Value> {
        let inner = self.inner.lock().map_err(|e| e.to_string())?;
        Ok(
            json!({"preferences":inner.store.preferences,"memories":inner.store.memories,"messages":inner.store.messages,"wakes":inner.store.wakes.iter().rev().take(30).collect::<Vec<_>>(),"busy":inner.live.busy,"authenticating":inner.live.authentication,"stream":inner.live.text,"error":inner.live.error,"providers":inner.live.auth,"authEvent":inner.live.auth_event,"tool":inner.live.tool,"wakeSerial":inner.live.wake_serial,"anomalies":inner.live.anomalies,"files":files::list(&self.dir.join("workspace"))?,"dataDir":self.dir,"mcpConfig":{"mcpServers":{"tomato":{"command":std::env::current_exe().map_err(|e|e.to_string())?,"args":["--mcp","--connection",self.dir.join("connection.json")]}}}}),
        )
    }
    pub fn observe(self: &Arc<Self>, snapshot: &Snapshot) -> AppResult<()> {
        let at = snapshot.server_time;
        let prompt = {
            let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
            if at - inner.live.last_scan >= 60 || inner.live.last_scan == 0 {
                inner.live.anomalies =
                    diagnose(snapshot, inner.store.preferences.daily_capacity_minutes);
                inner.live.last_scan = at;
            }
            let p = &inner.store.preferences;
            if !p.enabled
                || !p.automatic
                || inner.live.busy
                || inner.live.auth[&p.provider]["configured"] != true
                || !snapshot.data.reminder_idle()
                || quiet(p, at)
            {
                return Ok(());
            }
            let start = Local
                .timestamp_opt(at, 0)
                .single()
                .ok_or("时钟无效")?
                .date_naive();
            let today_count = inner
                .store
                .wakes
                .iter()
                .filter(|w| {
                    Local
                        .timestamp_opt(w.at, 0)
                        .single()
                        .is_some_and(|t| t.date_naive() == start)
                })
                .map(|w| w.at)
                .collect::<std::collections::HashSet<_>>()
                .len();
            if today_count >= p.max_auto_wakes_per_day as usize {
                return Ok(());
            }
            let eligible =
                inner
                    .live
                    .anomalies
                    .iter()
                    .filter(|a| {
                        !inner.store.wakes.iter().any(|w| {
                            w.key == a.key && at - w.at < i64::from(p.cooldown_hours) * 3600
                        })
                    })
                    .take(8)
                    .cloned()
                    .collect::<Vec<_>>();
            if eligible.is_empty() {
                return Ok(());
            }
            for anomaly in &eligible {
                inner.store.wakes.push(WakeRecord {
                    key: anomaly.key.clone(),
                    at,
                    status: "running".into(),
                });
            }
            if inner.store.wakes.len() > 1000 {
                let excess = inner.store.wakes.len() - 1000;
                inner.store.wakes.drain(..excess);
            }
            inner.live.wake_serial += 1;
            inner.store.save(&self.dir)?;
            inner.live.busy = true;
            format!("本地异常检测唤醒。先核实证据和用户背景，读取对应技能与已确认记忆，提出最少必要的问题。仅分析、提问和生成待审阅文件，不应用修改。证据：{}",serde_json::to_string(&eligible).map_err(|e|e.to_string())?)
        };
        (self.wake)();
        self.prompt(prompt, true, vec![])
    }
    pub fn call_job(self: &Arc<Self>, name: &str, args: &Value, job_id: &str) -> AppResult<Value> {
        let automatic = {
            let inner = self.inner.lock().map_err(|e| e.to_string())?;
            if !inner.live.busy || inner.live.authentication || inner.live.job_id != job_id {
                return Err("此工具请求所属会话已经结束".into());
            }
            inner.live.automatic
        };
        self.call(name, args, automatic)
    }
    pub fn call(self: &Arc<Self>, name: &str, args: &Value, agent: bool) -> AppResult<Value> {
        if !tools::definitions(agent).iter().any(|t| t["name"] == name) {
            return Err("工具未授权".into());
        }
        let workspace = self.dir.join("workspace");
        let _workspace_lock = if [
            "export_backup",
            "export_plan",
            "read_file",
            "patch_file",
            "stage_file",
            "review_file",
            "apply_file",
            "list_files",
        ]
        .contains(&name)
        {
            Some(self.workspace_lock.lock().map_err(|e| e.to_string())?)
        } else {
            None
        };
        match name {
            "web_search" | "web_fetch" => {
                let id = uuid::Uuid::new_v4().to_string();
                let (tx, rx) = std::sync::mpsc::channel();
                self.network_pending
                    .lock()
                    .map_err(|e| e.to_string())?
                    .insert(id.clone(), tx);
                let preferences = self
                    .inner
                    .lock()
                    .map_err(|e| e.to_string())?
                    .store
                    .preferences
                    .clone();
                let result=self.send(json!({"op":"network","id":id,"name":name,"arguments":args,"preferences":preferences})).and_then(|_|rx.recv_timeout(std::time::Duration::from_secs(25)).map_err(|_|"联网工具超时，请重试".to_string())?);
                self.network_pending
                    .lock()
                    .map_err(|e| e.to_string())?
                    .remove(&id);
                result
            }
            "get_memories" => Ok(json!(
                self.inner.lock().map_err(|e| e.to_string())?.store.memories
            )),
            "remember" => {
                let kind = nonempty_text(args, "kind", 30)?;
                if ![
                    "profile",
                    "preference",
                    "progress",
                    "hypothesis",
                    "reflection",
                ]
                .contains(&kind.as_str())
                {
                    return Err("无效记忆分类".into());
                }
                let text = nonempty_text(args, "text", 8000)?;
                let source = nonempty_text(args, "source", 300)?;
                let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
                if inner.store.memories.len() >= 200 {
                    return Err("记忆最多200条，请请用户整理".into());
                }
                if let Some(m) = inner.store.memories.iter().find(|m| m.text == text) {
                    return Ok(json!(m));
                }
                let memory = Memory {
                    id: uuid::Uuid::new_v4().to_string(),
                    kind,
                    text,
                    source,
                    confirmed: false,
                    updated_at: now(),
                };
                inner.store.memories.push(memory.clone());
                inner.store.save(&self.dir)?;
                Ok(json!(memory))
            }
            "read_skill" => {
                let name = nonempty_text(args, "name", 60)?;
                if ![
                    "study-diagnosis",
                    "study-planning",
                    "study-memory",
                    "tomato-files",
                    "tomato-workspace",
                    "tomato-guide",
                ]
                .contains(&name.as_str())
                {
                    return Err("未知内置技能".into());
                }
                let reference = args["reference"].as_str().unwrap_or("SKILL.md");
                if Path::new(reference)
                    .components()
                    .any(|c| !matches!(c, std::path::Component::Normal(_)))
                {
                    return Err("技能参考路径无效".into());
                }
                let path = self.resources.join("skills").join(&name).join(reference);
                let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
                if text.len() > 128 * 1024 {
                    return Err("参考文件过大".into());
                }
                Ok(json!({"name":name,"reference":reference,"text":text}))
            }
            "list_files" => files::list(&workspace),
            "read_file" => files::read_file(&workspace, args),
            "patch_file" => files::patch(&workspace, args),
            "stage_file" => files::stage(&workspace, args),
            "create_task" => {
                let mut task = args.clone();
                task["id"] = Value::Null;
                let action = serde_json::from_value(json!({"type":"saveTask","task":task}))
                    .map_err(|e| e.to_string())?;
                serde_json::to_value((self.apply)(action, None)?).map_err(|e| e.to_string())
            }
            "update_task" | "move_tasks" | "complete_task" => {
                let (action, base) = {
                    let mut engine = self.engine.lock().map_err(|e| e.to_string())?;
                    let s = engine.snapshot(now())?;
                    let base = files::fingerprint(&s.data)?;
                    let action = if name == "complete_task" {
                        let id = nonempty_text(args, "id", 100)?;
                        let task = s
                            .data
                            .tasks
                            .iter()
                            .find(|t| t.id == id)
                            .ok_or("任务不存在")?;
                        if task.completed {
                            return Ok(json!({"alreadyCompleted":true,"id":id}));
                        }
                        Action::ToggleTask { id }
                    } else {
                        let mut plan = s.data.export_plan();
                        if name == "move_tasks" {
                            let ids = args["ids"].as_array().ok_or("缺少任务 ids")?;
                            if ids.is_empty() || ids.len() > 100 {
                                return Err("每次移动1–100个任务".into());
                            }
                            for id in ids {
                                let id = id.as_str().ok_or("无效任务 ID")?;
                                let task = plan
                                    .tasks
                                    .iter_mut()
                                    .find(|t| t.id == id)
                                    .ok_or("任务不存在或已经完成")?;
                                task.due_date = Some(nonempty_text(args, "dueDate", 10)?);
                                if args.get("reminderTime").is_some() {
                                    task.reminder_time =
                                        args["reminderTime"].as_str().map(String::from);
                                }
                            }
                        } else {
                            let id = nonempty_text(args, "id", 100)?;
                            let changes = args["changes"].as_object().ok_or("缺少 changes")?;
                            let task = plan
                                .tasks
                                .iter_mut()
                                .find(|t| t.id == id)
                                .ok_or("任务不存在或已经完成")?;
                            let mut value =
                                serde_json::to_value(&*task).map_err(|e| e.to_string())?;
                            for (key, change) in changes {
                                if ![
                                    "title",
                                    "notes",
                                    "projectId",
                                    "dueDate",
                                    "reminderTime",
                                    "focusMinutes",
                                    "estimate",
                                    "priority",
                                    "tags",
                                    "scrapMinutes",
                                ]
                                .contains(&key.as_str())
                                {
                                    return Err(format!(
                                        "不允许更新 {key}，结构调整请使用文件流程"
                                    ));
                                }
                                value[key] = change.clone();
                            }
                            *task = serde_json::from_value(value).map_err(|e| e.to_string())?;
                        }
                        Action::ImportPlan { plan }
                    };
                    (action, base)
                };
                serde_json::to_value((self.apply)(action, Some(base))?).map_err(|e| e.to_string())
            }
            "create_project" | "save_vision" => {
                let mut value = args.clone();
                value["type"] = json!(if name == "create_project" {
                    "saveProject"
                } else {
                    "saveVision"
                });
                if name == "create_project" {
                    value["id"] = Value::Null;
                }
                let action = serde_json::from_value(value).map_err(|e| e.to_string())?;
                serde_json::to_value((self.apply)(action, None)?).map_err(|e| e.to_string())
            }
            "apply_file" => {
                let name = args["name"].as_str().ok_or("缺少文件名")?;
                if self
                    .inner
                    .lock()
                    .map_err(|e| e.to_string())?
                    .live
                    .reviewed
                    .get(name)
                    .map(String::as_str)
                    != args["fileHash"].as_str()
                {
                    return Err("请先审阅当前版本的文件".into());
                }
                let (action, base) = {
                    let mut engine = self.engine.lock().map_err(|e| e.to_string())?;
                    let snapshot = engine.snapshot(now())?;
                    if !snapshot.data.reminder_idle() {
                        return Err("计时或锁机尚未结束，请稍后应用".into());
                    }
                    let (action, _) = files::candidate(&workspace, &mut engine, args, now())?;
                    (action, files::fingerprint(&snapshot.data)?)
                };
                serde_json::to_value((self.apply)(action, Some(base))?).map_err(|e| e.to_string())
            }
            "dispatch" => {
                let action: Action =
                    serde_json::from_value(args["action"].clone()).map_err(|e| e.to_string())?;
                if matches!(action, Action::EmergencyUnlock) {
                    return Err("MCP 不能紧急解锁".into());
                }
                serde_json::to_value((self.apply)(action, None)?).map_err(|e| e.to_string())
            }
            _ => {
                let mut engine = self.engine.lock().map_err(|e| e.to_string())?;
                match name {
                    "export_backup" | "export_plan" => {
                        files::export(&workspace, &mut engine, args, name == "export_plan", now())
                    }
                    "review_file" => {
                        let (_, review) = files::candidate(&workspace, &mut engine, args, now())?;
                        self.inner
                            .lock()
                            .map_err(|e| e.to_string())?
                            .live
                            .reviewed
                            .insert(
                                review["name"].as_str().unwrap().into(),
                                review["fileHash"].as_str().unwrap().into(),
                            );
                        Ok(review)
                    }
                    "get_snapshot" => {
                        serde_json::to_value(engine.snapshot(now())?).map_err(|e| e.to_string())
                    }
                    "get_tasks" => {
                        let s = engine.snapshot(now())?;
                        let offset = args["offset"].as_u64().unwrap_or(0) as usize;
                        let limit = args["limit"].as_u64().unwrap_or(50).clamp(1, 100) as usize;
                        let tasks = s
                            .data
                            .tasks
                            .iter()
                            .filter(|t| {
                                args["projectId"]
                                    .as_str()
                                    .is_none_or(|id| t.project_id.as_deref() == Some(id))
                                    && args["goalId"]
                                        .as_str()
                                        .is_none_or(|id| t.goal_id.as_deref() == Some(id))
                                    && args["completed"]
                                        .as_bool()
                                        .is_none_or(|completed| t.completed == completed)
                            })
                            .collect::<Vec<_>>();
                        Ok(
                            json!({"total":tasks.len(),"offset":offset,"tasks":tasks.into_iter().skip(offset).take(limit).collect::<Vec<_>>()}),
                        )
                    }
                    "get_context" => {
                        let s = engine.snapshot(now())?;
                        let inner = self.inner.lock().map_err(|e| e.to_string())?;
                        Ok(
                            json!({"today":s.today,"stats":s.stats,"projects":s.data.projects,"goals":s.data.goals,"visions":s.data.visions,"nodeProgress":s.node_progress,"anomalies":diagnose(&s,inner.store.preferences.daily_capacity_minutes),"memories":inner.store.memories,"recentTasks":s.data.tasks.iter().filter(|t|t.due_date.as_deref().is_some_and(|d|d>=s.today.as_str())).take(50).collect::<Vec<_>>(),"taskCount":s.data.tasks.len(),"skills":["study-diagnosis","study-planning","study-memory","tomato-files","tomato-workspace","tomato-guide"],"permission":"仅分析、提问、编辑私有工作文件；应用需用户确认"}),
                        )
                    }
                    _ => Err("未知工具".into()),
                }
            }
        }
    }
    pub fn shutdown(&self) {
        if let Ok(mut p) = self.process.lock() {
            if let Some(p) = p.as_mut() {
                let _ = p.child.kill();
                let _ = p.child.wait();
            }
        }
    }
}
fn quiet(p: &Preferences, at: i64) -> bool {
    let minute =
        |t: &str| t[..2].parse::<u32>().unwrap_or(0) * 60 + t[3..].parse::<u32>().unwrap_or(0);
    let Some(time) = Local.timestamp_opt(at, 0).single() else {
        return true;
    };
    let current = time.hour() * 60 + time.minute();
    let start = minute(&p.quiet_start);
    let end = minute(&p.quiet_end);
    if start == end {
        false
    } else if start < end {
        current >= start && current < end
    } else {
        current >= start || current < end
    }
}
fn validated_images(value: &Value) -> AppResult<Vec<Value>> {
    use base64::Engine as _;
    if value.is_null() {
        return Ok(vec![]);
    }
    let images = value.as_array().ok_or("图片应为数组")?;
    if images.len() > 3 {
        return Err("每条消息最多3张图片".into());
    }
    for image in images {
        let data = image["data"].as_str().ok_or("图片缺少数据")?;
        if data.len() > 6 * 1024 * 1024 {
            return Err("单张图片不能超过4MB".into());
        }
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(data)
            .map_err(|_| "图片 Base64 无效")?;
        let valid = match image["mimeType"].as_str() {
            Some("image/png") => bytes.starts_with(&[137, 80, 78, 71, 13, 10, 26, 10]),
            Some("image/jpeg") => bytes.starts_with(&[255, 216, 255]),
            Some("image/webp") => bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP"),
            _ => false,
        };
        if !valid || bytes.len() > 4 * 1024 * 1024 || image["type"] != "image" {
            return Err("只接受真实 PNG/JPEG/WebP 图片，每张最多4MB".into());
        }
    }
    Ok(images.clone())
}
pub fn resources(exe: &Path, resource_dir: Option<&Path>) -> PathBuf {
    let local = exe.parent().unwrap_or(Path::new(".")).join("agent");
    if local.join("worker.mjs").exists() {
        return local;
    }
    if let Some(dir) = resource_dir {
        let bundled = dir.join("agent");
        if bundled.join("worker.mjs").exists() {
            return bundled;
        }
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../agent/bundle")
}
pub fn mcp_entry() -> bool {
    if !std::env::args().any(|arg| arg == "--mcp") {
        return false;
    }
    let exe = std::env::current_exe().expect("无法定位程序");
    let dir = resources(&exe, Some(Path::new("/usr/lib/tomato-todo")));
    let status = std::process::Command::new(dir.join("bin/node"))
        .arg(dir.join("mcp.mjs"))
        .args(std::env::args().skip(1).filter(|a| a != "--mcp"))
        .status();
    std::process::exit(status.ok().and_then(|s| s.code()).unwrap_or(1));
}
