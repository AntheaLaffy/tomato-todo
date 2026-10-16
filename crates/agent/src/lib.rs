//! App-owned Pi orchestration. The embedded agent cannot dispatch app mutations.
mod attachments;
mod bridge;
mod canvas;
mod conversations;
mod creator;
pub mod files;
mod state;
#[cfg(test)]
mod tests;
pub mod tools;
mod worker;

use chrono::{Local, TimeZone, Timelike};
use serde_json::{json, Value};
pub use state::Preferences;
use state::{nonempty_text, private_directory, Attachment, Memory, Store, WakeRecord};
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
    thinking: String,
    generated: Vec<Attachment>,
    error: Option<String>,
    auth: Value,
    auth_event: Value,
    tool: String,
    wake_serial: u64,
    automatic: bool,
    scheduled: bool,
    creator_entrance: Value,
    anomalies: Vec<Anomaly>,
    last_scan: i64,
    reviewed: std::collections::HashMap<String, String>,
    job_id: String,
    questions: Value,
    plan: Value,
    /// 助手的「手」：一段待演的动作脚本，界面按 serial 演一次。
    hand: Value,
    hand_serial: u64,
    /// 这一轮助手改动了什么：轮末打包成一批「事迹」，界面回去时演给用户看。
    pending_deeds: Vec<Value>,
    deeds: Value,
    deeds_serial: u64,
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
    worker_pending:
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
            worker_pending: Mutex::new(std::collections::HashMap::new()),
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
    /// Ask the packaged runtime something and wait for its `network_result` reply.
    /// 记一笔「这一轮助手改了什么」，轮末由 `flush_deeds` 打包给界面演一遍。
    fn note_deed(&self, text: impl Into<String>, selector: Option<String>) {
        if let Ok(mut inner) = self.inner.lock() {
            let text: String = text.into();
            let mut deed = json!({"text":text});
            if let Some(selector) = selector {
                deed["selector"] = json!(selector);
            }
            inner.live.pending_deeds.push(deed);
            // 一轮里改得再多也只演前几件，免得变成流水账。
            if inner.live.pending_deeds.len() > 6 {
                inner.live.pending_deeds.remove(0);
            }
        }
    }
    /// 轮末把这一轮的事迹打包成一批（带自增 serial），界面按 serial 演一次。
    /// 调用者已经握着 `inner`，所以不再加锁。
    fn flush_deeds(inner: &mut Inner) {
        if inner.live.pending_deeds.is_empty() {
            return;
        }
        let items = std::mem::take(&mut inner.live.pending_deeds);
        inner.live.deeds_serial += 1;
        inner.live.deeds = json!({
            "serial":inner.live.deeds_serial,
            "at":now(),
            "items":items,
        });
    }
    /// Used for provider quota, network tools and MCP configuration, which all live
    /// on the Node side rather than in this process.
    fn ask_worker(self: &Arc<Self>, mut value: Value, seconds: u64) -> AppResult<Value> {
        let id = uuid::Uuid::new_v4().to_string();
        let (tx, rx) = std::sync::mpsc::channel();
        self.worker_pending
            .lock()
            .map_err(|e| e.to_string())?
            .insert(id.clone(), tx);
        value["id"] = json!(id);
        let result = self.send(value).and_then(|_| {
            rx.recv_timeout(std::time::Duration::from_secs(seconds))
                .map_err(|_| "Agent 运行包响应超时".to_string())?
        });
        self.worker_pending
            .lock()
            .map_err(|e| e.to_string())?
            .remove(&id);
        result
    }
    pub fn request(self: &Arc<Self>, args: Value) -> AppResult<Value> {
        let op = args["op"].as_str().ok_or("缺少 Agent 操作")?;
        match op {
            "status" => self.status(),
            "exit_creator_mode" => {
                let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
                if inner.live.busy {
                    return Err("请先停止当前运行，再退出作者模式".into());
                }
                let mut next = inner.store.clone();
                if let Some(c) = next
                    .conversations
                    .iter_mut()
                    .find(|c| Some(&c.id) == next.active.as_ref())
                {
                    c.creator_mode = false;
                }
                next.save(&self.dir)?;
                inner.store = next;
                drop(inner);
                self.status()
            }
            "usage" => {
                let provider = self
                    .inner
                    .lock()
                    .map_err(|e| e.to_string())?
                    .store
                    .preferences
                    .provider
                    .clone();
                self.ask_worker(json!({"op":"usage","provider":provider}), 20)
            }
            // Codex-style MCP server management, answered by the packaged runtime
            // so the SDK's own config validation is the single source of truth.
            "mcp_list" => self.ask_worker(json!({"op":"mcp","action":"list"}), 20),
            "mcp_add" => self.ask_worker(
                json!({"op":"mcp","action":"add","server":args["server"].clone()}),
                20,
            ),
            "mcp_remove" => self.ask_worker(
                json!({"op":"mcp","action":"remove","server":args["server"].clone()}),
                20,
            ),
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
            "upload_attachment" => serde_json::to_value(attachments::upload(&self.dir, &args)?)
                .map_err(|e| e.to_string()),
            "download_attachment" => {
                attachments::download(&self.dir, &nonempty_text(&args, "id", 100)?)
            }
            "canvas_get" => self.canvas_operation("get_canvas", &args, "user"),
            "canvas_save" | "canvas_restore" | "canvas_delete" => {
                self.canvas_operation(args["op"].as_str().unwrap(), &args, "user")?;
                self.status()
            }
            "search_conversations"
            | "rename_conversation"
            | "pin_conversation"
            | "archive_conversation"
            | "branch_conversation"
            | "edit_message"
            | "retry_message" => self.conversation_operation(args["op"].as_str().unwrap(), &args),
            "send" => {
                let (attachments, mut images) =
                    attachments::for_prompt(&self.dir, &args["attachmentIds"])?;
                images.extend(validated_images(&args["images"])?);
                validated_images(&json!(images))?;
                let text = if args["text"].as_str().is_none_or(|t| t.trim().is_empty())
                    && (!images.is_empty() || !attachments.is_empty())
                {
                    "请分析这些附件，不清楚的地方先问我。".into()
                } else {
                    nonempty_text(&args, "text", 32000)?
                };
                self.prompt(text, false, false, images, attachments)?;
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
                inner.store.new_conversation(now());
                inner.live.questions = Value::Null;
                inner.live.plan = Value::Null;
                inner.live.text.clear();
                inner.live.thinking.clear();
                inner.live.generated.clear();
                inner.live.error = None;
                inner.store.save(&self.dir)?;
                drop(inner);
                self.status()
            }
            "switch_conversation" => {
                let id = nonempty_text(&args, "id", 100)?;
                let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
                if inner.live.busy {
                    return Err("请先停止当前分析".into());
                }
                inner.store.switch_conversation(&id)?;
                inner.live.questions = Value::Null;
                inner.live.plan = Value::Null;
                inner.live.text.clear();
                inner.live.thinking.clear();
                inner.live.generated.clear();
                inner.live.error = None;
                inner.store.save(&self.dir)?;
                drop(inner);
                self.status()
            }
            "delete_conversation" => {
                let id = nonempty_text(&args, "id", 100)?;
                let session = {
                    let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
                    if inner.live.busy {
                        return Err("请先停止当前分析".into());
                    }
                    let session = inner.store.delete_conversation(&id)?;
                    inner.store.save(&self.dir)?;
                    session
                };
                if let Some(path) = session {
                    let path = PathBuf::from(path);
                    if path.starts_with(self.dir.join("sessions")) {
                        let _ = fs::remove_file(path);
                    }
                }
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
        scheduled: bool,
        images: Vec<Value>,
        attachments: Vec<Attachment>,
    ) -> AppResult<()> {
        let command = {
            let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
            if inner.live.busy && !automatic {
                return Err("当前分析尚未结束".into());
            }
            self.prompt_command(&mut inner, text, automatic, scheduled, images, attachments)?
        };
        self.send_prompt(command)
    }
    fn validate_prompt(inner: &Inner, automatic: bool, images: &[Value]) -> AppResult<Preferences> {
        let p = inner.store.preferences.clone();
        if automatic && !p.enabled {
            return Err("请先在连接配置中启用学习助手".into());
        }
        if inner.live.auth[&p.provider]["configured"] != true {
            return Err("请先配置 DeepSeek API Key 或完成 Codex 账号登录".into());
        }
        if !images.is_empty() {
            let models = inner.live.auth[&p.provider]["models"].as_array();
            let model = models.and_then(|models| {
                if !p.model.is_empty() {
                    return models.iter().find(|m| m["id"] == p.model);
                }
                models
                    .iter()
                    .find(|m| m["id"] == "deepseek-chat")
                    .or_else(|| {
                        models
                            .iter()
                            .find(|m| m["id"].as_str().is_some_and(|id| !id.contains("spark")))
                    })
                    .or_else(|| models.first())
            });
            if model.is_some_and(|m| m["vision"] == false) {
                return Err("所选模型不支持图片，请选择支持视觉的模型后发送".into());
            }
        }
        Ok(p)
    }
    fn prompt_command(
        &self,
        inner: &mut Inner,
        text: String,
        automatic: bool,
        scheduled: bool,
        images: Vec<Value>,
        attachments: Vec<Attachment>,
    ) -> AppResult<Value> {
        let mut p = Self::validate_prompt(inner, automatic, &images)?;
        let displayed = if images.is_empty() || !attachments.is_empty() {
            text.clone()
        } else {
            format!("{text}\n（附{}张图片，保存在私有会话中）", images.len())
        };
        let mut next = inner.store.clone();
        let message_id = next.message("user", displayed, now(), automatic);
        next.message_mut(&message_id).unwrap().attachments = attachments.clone();
        let creator_mode =
            !automatic && !scheduled && next.active_conversation().is_some_and(|c| c.creator_mode);
        let mut definitions = tools::definitions(automatic);
        if creator_mode {
            p.coding_access = "full".into();
        }
        if !automatic && !scheduled {
            definitions.push(creator::activation_tool());
            definitions.push(creator::tool());
        }
        next.save(&self.dir)?;
        inner.store = next;
        inner.live.busy = true;
        inner.live.authentication = false;
        inner.live.questions = Value::Null;
        inner.live.text.clear();
        inner.live.thinking.clear();
        inner.live.generated.clear();
        inner.live.error = None;
        inner.live.automatic = automatic && !scheduled;
        inner.live.scheduled = scheduled;
        inner.live.job_id = uuid::Uuid::new_v4().to_string();
        Ok(
            json!({"op":"prompt","automatic":automatic,"scheduled":scheduled,"creatorMode":creator_mode,"jobId":inner.live.job_id,"userMessageId":message_id,"text":text,"images":images,"attachments":attachments,"provider":p.provider,"model":p.model,"preferences":p,"sessionFile":inner.store.active_session(),"tools":definitions}),
        )
    }
    fn send_prompt(self: &Arc<Self>, command: Value) -> AppResult<()> {
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
    fn skill_roots(&self) -> Vec<PathBuf> {
        let mut roots = vec![self.resources.join("skills"), self.dir.join("skills")];
        if let Some(home) = std::env::var_os("HOME") {
            roots.push(PathBuf::from(home).join(".agents/skills"));
        }
        roots
    }
    /// 测试与内部使用：当前可读到的技能名。
    pub fn available_skill_names(&self) -> Vec<String> {
        self.available_skills()
    }
    fn available_skills(&self) -> Vec<String> {
        let mut names: Vec<String> = Vec::new();
        for root in self.skill_roots() {
            let Ok(entries) = fs::read_dir(&root) else {
                continue;
            };
            for entry in entries.flatten() {
                if !entry.path().join("SKILL.md").is_file() {
                    continue;
                }
                if let Some(name) = entry.file_name().to_str() {
                    let name = name.to_string();
                    if !names.contains(&name) {
                        names.push(name);
                    }
                }
            }
        }
        names.sort();
        names
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
            "text_reset" => inner.live.text.clear(),
            "thinking" => {
                if let Some(text) = event["text"].as_str() {
                    if inner.live.thinking.len() < 512 * 1024 {
                        inner.live.thinking.push_str(text);
                    }
                }
            }
            "tool_end" => inner.live.tool.clear(),
            "tool_start" => {
                inner.live.tool = event["name"].as_str().unwrap_or_default().into();
            }
            "session" => {
                if let Some(path) = event["path"].as_str() {
                    let path = PathBuf::from(path);
                    if path.starts_with(self.dir.join("sessions")) {
                        inner.store.set_session(&path.to_string_lossy(), now());
                    }
                }
            }
            "message_entry" => {
                if let Some(message) = event["messageId"]
                    .as_str()
                    .and_then(|id| inner.store.message_mut(id))
                {
                    message.entry_id = event["entryId"].as_str().map(str::to_owned);
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
                let thinking = std::mem::take(&mut inner.live.thinking);
                let generated = std::mem::take(&mut inner.live.generated);
                if !text.is_empty() || !thinking.is_empty() || !generated.is_empty() {
                    let id = inner.store.message("assistant", text, now(), automatic);
                    let message = inner.store.message_mut(&id).unwrap();
                    message.entry_id = event["entryId"].as_str().map(str::to_owned);
                    message.stopped = event["stopped"] == true;
                    message.thinking = thinking;
                    message.attachments = generated;
                }
                inner.live.text.clear();
                inner.live.thinking.clear();
                inner.live.generated.clear();
                for w in &mut inner.store.wakes {
                    if w.status == "running" {
                        w.status = "completed".into();
                    }
                }
                // 一轮结束了：这一轮改过的东西打包给界面演一遍。
                Self::flush_deeds(&mut inner);
            }
            "error" => {
                inner.live.busy = false;
                inner.live.authentication = false;
                inner.live.tool.clear();
                if !inner.live.generated.is_empty() {
                    let images = std::mem::take(&mut inner.live.generated);
                    let text = std::mem::take(&mut inner.live.text);
                    let thinking = std::mem::take(&mut inner.live.thinking);
                    let automatic = inner.live.automatic;
                    let id = inner.store.message("assistant", text, now(), automatic);
                    let message = inner.store.message_mut(&id).unwrap();
                    message.attachments = images;
                    message.thinking = thinking;
                }
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
            Some("text" | "thinking" | "text_reset" | "tool_start" | "tool_end" | "auth_event")
        ) {
            let _ = inner.store.save(&self.dir);
        }
    }
    pub fn status(&self) -> AppResult<Value> {
        let inner = self.inner.lock().map_err(|e| e.to_string())?;
        // Names of files the user already reviewed, so the UI can offer an explicit
        // approve/decline instead of making them hunt through the sheets.
        let reviewed = inner.live.reviewed.keys().cloned().collect::<Vec<_>>();
        Ok(
            json!({"creatorEntrance":inner.live.creator_entrance,"creatorMode":inner.store.active_conversation().is_some_and(|c| c.creator_mode),"preferences":inner.store.preferences,"memories":inner.store.memories,"messages":inner.store.messages(),"conversations":inner.store.conversations_view(),"canvases":canvas::summaries(&inner.store),"generated":inner.live.generated,"wakes":inner.store.wakes.iter().rev().take(30).collect::<Vec<_>>(),"busy":inner.live.busy,"authenticating":inner.live.authentication,"stream":inner.live.text,"thinking":inner.live.thinking,"error":inner.live.error,"providers":inner.live.auth,"authEvent":inner.live.auth_event,"tool":inner.live.tool,"questions":inner.live.questions,"plan":inner.live.plan,"hand":inner.live.hand,"deeds":inner.live.deeds,"schedules":inner.store.schedules,"wakeSerial":inner.live.wake_serial,"anomalies":inner.live.anomalies,"reviewed":reviewed,"files":files::list(&self.dir.join("workspace"))?,"dataDir":self.dir,"mcpConfig":{"mcpServers":{"tomato":{"command":std::env::current_exe().map_err(|e|e.to_string())?,"args":["--mcp","--connection",self.dir.join("connection.json")]}}}}),
        )
    }
    pub fn observe(self: &Arc<Self>, snapshot: &Snapshot) -> AppResult<()> {
        let at = snapshot.server_time;
        // 用户排定的定时任务排在最前：它们是用户明确的安排，所以不受「自动唤醒」
        // 开关、每日上限、冷却和安静时段限制——但助手得是启用且已连接的状态。
        let due: Option<(String, String, String, u32)> = {
            let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
            let p = inner.store.preferences.clone();
            let ready = p.enabled
                && inner.live.auth[&p.provider]["configured"] == true
                && !inner.live.busy
                && snapshot.data.reminder_idle();
            let now = Local.timestamp_opt(at, 0).single().map(|t| t.naive_local());
            match (ready, now) {
                (true, Some(now)) => {
                    let hit = inner.store.schedules.iter().find(|s| s.due(now)).map(|s| {
                        (
                            s.id.clone(),
                            s.name.clone(),
                            s.instruction.clone(),
                            s.remind_minutes,
                        )
                    });
                    if let Some((id, name, instruction, remind)) = hit.clone() {
                        for s in &mut inner.store.schedules {
                            if s.id == id {
                                s.fired_at = Some(at);
                            }
                        }
                        inner.store.save(&self.dir)?;
                        Some((id, name, instruction, remind))
                    } else {
                        None
                    }
                }
                _ => None,
            }
        };
        // 到点前的「防拖沓」：用户给这条安排开了提前锁机就起一个严格锁，锁到点。
        if let Some(now) = Local.timestamp_opt(at, 0).single().map(|t| t.naive_local()) {
            let lock = {
                let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
                let hit = inner
                    .store
                    .schedules
                    .iter()
                    .find(|s| s.lock_window(now).is_some())
                    .map(|s| {
                        (
                            s.id.clone(),
                            s.lock_window(now).unwrap_or(0),
                            s.name.clone(),
                        )
                    });
                if let Some((id, minutes, name)) = hit.clone() {
                    for s in &mut inner.store.schedules {
                        if s.id == id {
                            s.locked_at = Some(at);
                        }
                    }
                    inner.store.save(&self.dir)?;
                    Some((minutes, name))
                } else {
                    None
                }
            };
            if let Some((minutes, name)) = lock {
                if snapshot.data.lock.active.is_none() {
                    let _ = (self.apply)(
                        Action::StartQuickLock {
                            minutes,
                            strict: true,
                        },
                        None,
                    );
                    let _ = self.inner.lock().map(|mut inner| {
                        inner.store.message(
                            "assistant",
                            format!("距「{name}」还有 {minutes} 分钟，按你的安排先严格锁机到点。"),
                            crate::now(),
                            true,
                        );
                    });
                }
            }
        }
        if let Some((_id, name, instruction, remind)) = due {
            let remind_note = if remind > 0 {
                format!("（用户希望在到点前 {remind} 分钟被提醒：需要的话建一条带提醒的任务。）")
            } else {
                String::new()
            };
            let text = format!("这是你为用户排定的定时任务「{name}」，现在到点了{remind_note}。按下面的指令现在去办：能直接用工具做完的就做完（包括 MCP、建/改任务），不要只写方案；做完用一两句话说清做了什么、结果如何、以及需要用户本人补做的动作。指令：{instruction}");
            self.inner
                .lock()
                .map_err(|e| e.to_string())?
                .live
                .wake_serial += 1;
            return self.prompt(text, false, true, vec![], vec![]);
        }
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
            format!("本地检测到一个学习安排信号。看一眼当前数据和已确认背景，用一两句话说你注意到了什么、你的建议（怎么调、为什么）和想问的一个点，不要罗列清单。这一轮只分析、提问和准备待审阅文件，不直接改数据；用户回应后即可直接调整。信号：{}",serde_json::to_string(&eligible).map_err(|e|e.to_string())?)
        };
        (self.wake)();
        self.prompt(prompt, true, false, vec![], vec![])
    }
    pub fn call_job(self: &Arc<Self>, name: &str, args: &Value, job_id: &str) -> AppResult<Value> {
        let automatic = {
            let inner = self.inner.lock().map_err(|e| e.to_string())?;
            if !inner.live.busy || inner.live.authentication || inner.live.job_id != job_id {
                return Err("此工具请求所属会话已经结束".into());
            }
            inner.live.automatic
        };
        if name == "enable_creator_mode" {
            let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
            if inner.live.automatic
                || inner.live.scheduled
                || !inner.live.busy
                || inner.live.job_id != job_id
            {
                return Err("作者彩蛋仅由当前用户主动对话开启".into());
            }
            let mut next = inner.store.clone();
            let active = next.active.clone().ok_or("没有当前对话")?;
            let conversation = next
                .conversations
                .iter_mut()
                .find(|c| c.id == active)
                .ok_or("没有当前对话")?;
            let entered = !conversation.creator_mode;
            conversation.creator_mode = true;
            next.save(&self.dir)?;
            inner.store = next;
            if entered {
                inner.live.creator_entrance = json!({"id":uuid::Uuid::new_v4().to_string(),"conversationId":active,"at":now()});
            }
            return Ok(
                json!({"creatorMode":true,"codingAccess":"full","entered":entered,"note":"作者模式已开启，入场特效由界面播放。现在按当前人格自然地接住见到作者的彩蛋；完整编程访问与 get_agent_internals 本轮即可使用。"}),
            );
        }
        if matches!(name, "store_generated_image" | "image_reference") {
            if automatic {
                return Err("自动唤醒不能生成或编辑图片".into());
            }
            if self
                .inner
                .lock()
                .map_err(|e| e.to_string())?
                .store
                .preferences
                .provider
                != "openai-codex"
            {
                return Err("当前模型连接不支持图像生成，请切换到 Codex 账号".into());
            }
            if name == "image_reference" {
                return attachments::download(&self.dir, &nonempty_text(args, "id", 100)?);
            }
            let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
            if !inner.live.busy || inner.live.job_id != job_id {
                return Err("此图片请求已经结束".into());
            }
            let image = attachments::upload(&self.dir, args)?;
            inner.live.generated.push(image.clone());
            return Ok(json!(image));
        }
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
            "get_canvas" | "save_canvas" => self.canvas_operation(name, args, "assistant"),
            "web_search" | "web_fetch" => {
                let preferences = self
                    .inner
                    .lock()
                    .map_err(|e| e.to_string())?
                    .store
                    .preferences
                    .clone();
                self.ask_worker(
                    json!({"op":"network","name":name,"arguments":args,"preferences":preferences}),
                    25,
                )
            }
            "get_memories" => Ok(json!(
                self.inner.lock().map_err(|e| e.to_string())?.store.memories
            )),
            // MCP servers live in the app's own mcp.json (Codex-style add/list/remove).
            // Reading is fine on a wake; editing another program's launch config is not.
            "list_mcp_servers" => self.request(json!({"op":"mcp_list"})),
            "add_mcp_server" | "remove_mcp_server" => self.request(json!({
                "op": if name == "add_mcp_server" { "mcp_add" } else { "mcp_remove" },
                "server": args.clone(),
            })),
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
            "clear_plan" => {
                self.inner.lock().map_err(|e| e.to_string())?.live.plan = Value::Null;
                Ok(json!({"cleared":true}))
            }
            "update_plan" => {
                let plan = args["plan"].as_array().cloned().unwrap_or_default();
                let mut running = 0;
                for item in &plan {
                    if item["step"]
                        .as_str()
                        .map(str::trim)
                        .unwrap_or("")
                        .is_empty()
                    {
                        return Err("计划步骤不能为空".into());
                    }
                    match item["status"].as_str().unwrap_or("") {
                        "pending" | "completed" => {}
                        "in_progress" => running += 1,
                        _ => return Err("步骤状态需为 pending/in_progress/completed".into()),
                    }
                }
                if running > 1 {
                    return Err("至多一个步骤处于进行中".into());
                }
                self.inner.lock().map_err(|e| e.to_string())?.live.plan = json!(plan);
                Ok(json!({"updated":true}))
            }
            // 让界面「演一遍」：脚本存在这里，界面按 serial 演一次（和 questions/plan 同一条通道）。
            "show_me" => {
                let steps = args["steps"].as_array().cloned().unwrap_or_default();
                if steps.is_empty() || steps.len() > 12 {
                    return Err("演示脚本需要 1–12 个步骤".into());
                }
                for step in &steps {
                    let kind = step["kind"].as_str().unwrap_or_default();
                    if ![
                        "move",
                        "click",
                        "type",
                        "highlight",
                        "say",
                        "keyboard",
                        "wait",
                        "hide",
                    ]
                    .contains(&kind)
                    {
                        return Err(format!("不支持的演示步骤：{kind}"));
                    }
                    if step["target"]
                        .as_str()
                        .is_some_and(|t| t.chars().count() > 200)
                    {
                        return Err("演示目标选择器过长".into());
                    }
                    if kind == "type" {
                        if step["target"].as_str().unwrap_or("").is_empty() {
                            return Err("打字步骤需要 target".into());
                        }
                        if step["text"].as_str().unwrap_or("").chars().count() > 200 {
                            return Err("演示里一次最多输入 200 个字符".into());
                        }
                    }
                    if kind == "say" {
                        let lines: Vec<String> = match &step["lines"] {
                            Value::String(line) => vec![line.clone()],
                            Value::Array(list) => list
                                .iter()
                                .filter_map(|line| line.as_str().map(String::from))
                                .collect(),
                            _ => Vec::new(),
                        };
                        if lines.is_empty() || lines.len() > 4 {
                            return Err("讲稿需要 1–4 行".into());
                        }
                        if lines.iter().any(|line| line.chars().count() > 300) {
                            return Err("讲稿每行最多 300 字".into());
                        }
                    }
                    if kind == "wait" && step["ms"].as_u64().unwrap_or(0) > 8_000 {
                        return Err("演示里的一次等待最多 8 秒".into());
                    }
                }
                let serial = {
                    let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
                    inner.live.hand_serial += 1;
                    inner.live.hand = json!({
                        "serial":inner.live.hand_serial,
                        "at":now(),
                        "label":args["label"].as_str().unwrap_or("助手"),
                        "steps":steps,
                    });
                    inner.live.hand_serial
                };
                Ok(
                    json!({"playing":true,"serial":serial,"note":"脚本交给界面播放；讲稿内容由你写，界面只负责演。"}),
                )
            }
            // 定时任务：用户排定「到点让助手去做」，助手也能自己排（例如抢座位）。
            "list_schedules" => {
                let inner = self.inner.lock().map_err(|e| e.to_string())?;
                Ok(json!({"schedules":inner.store.schedules}))
            }
            "save_schedule" | "delete_schedule" => {
                let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
                if name == "delete_schedule" {
                    let id = args["id"].as_str().ok_or("缺少定时任务 id")?;
                    let before = inner.store.schedules.len();
                    inner.store.schedules.retain(|s| s.id != id);
                    if inner.store.schedules.len() == before {
                        return Err("没有这个定时任务".into());
                    }
                    inner.store.save(&self.dir)?;
                    return Ok(json!({"deleted":id,"schedules":inner.store.schedules}));
                }
                let mut schedule: crate::state::Schedule =
                    serde_json::from_value(args.clone()).map_err(|e| e.to_string())?;
                if schedule.id.trim().is_empty() {
                    schedule.id = uuid::Uuid::new_v4().to_string();
                }
                schedule.validate()?;
                let exists = inner.store.schedules.iter().any(|s| s.id == schedule.id);
                if !exists && inner.store.schedules.len() >= 20 {
                    return Err("定时任务最多 20 条".into());
                }
                if let Some(existing) = inner
                    .store
                    .schedules
                    .iter_mut()
                    .find(|s| s.id == schedule.id)
                {
                    // 改时间或指令不该让它当天重复触发，保留已触发记录。
                    schedule.fired_at = existing.fired_at;
                    *existing = schedule.clone();
                } else {
                    inner.store.schedules.push(schedule.clone());
                }
                inner.store.save(&self.dir)?;
                Ok(json!({"saved":schedule.id,"schedules":inner.store.schedules}))
            }
            // 助手自己写技能：把「这类事怎么办」沉淀成文件，下次同类任务开场就读到。
            "save_skill" | "delete_skill" => {
                let skill = nonempty_text(args, "name", 40)?;
                if !skill
                    .chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
                    || skill.starts_with('-')
                    || skill.ends_with('-')
                {
                    return Err("技能名只能用小写字母、数字和连字符".into());
                }
                let dir = self.dir.join("skills").join(&skill);
                if name == "delete_skill" {
                    if !dir.is_dir() {
                        return Err("没有这个技能".into());
                    }
                    fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
                    return Ok(json!({"deleted":skill}));
                }
                let description = nonempty_text(args, "description", 400)?;
                let body = args["body"].as_str().unwrap_or("").trim().to_string();
                if body.is_empty() || body.chars().count() > 20_000 {
                    return Err("技能正文需为 1–20000 字".into());
                }
                fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
                let file = dir.join("SKILL.md");
                let text =
                    format!("---\nname: {skill}\ndescription: {description}\n---\n\n{body}\n");
                fs::write(&file, text).map_err(|e| e.to_string())?;
                Ok(json!({"saved":skill,"path":file.to_string_lossy()}))
            }
            "request_user_input" => {
                let questions = args["questions"].as_array().cloned().unwrap_or_default();
                if questions.is_empty() || questions.len() > 3 {
                    return Err("请提供 1–3 个问题".into());
                }
                for question in &questions {
                    if question["question"]
                        .as_str()
                        .map(str::trim)
                        .unwrap_or("")
                        .is_empty()
                    {
                        return Err("问题不能为空".into());
                    }
                    if question["detail"]
                        .as_str()
                        .is_some_and(|d| d.chars().count() > 2_000)
                    {
                        return Err("问题说明过长".into());
                    }
                    let labels = question["options"]
                        .as_array()
                        .map(|options| {
                            options
                                .iter()
                                .filter_map(|option| option["label"].as_str().map(String::from))
                                .collect::<Vec<_>>()
                        })
                        .unwrap_or_default();
                    if !(2..=6).contains(&labels.len()) {
                        return Err("每个问题提供 2–6 个选项".into());
                    }
                    let unique: std::collections::HashSet<&String> = labels.iter().collect();
                    if unique.len() != labels.len()
                        || labels
                            .iter()
                            .any(|label| label.trim().is_empty() || label.chars().count() > 40)
                    {
                        return Err("选项名称需为 1–40 个字符且不重复".into());
                    }
                    // A plan-review intent names the label that approves; the UI marks
                    // the other options as the way out, so the name must exist.
                    if let Some(intent) = question.get("intent") {
                        if intent["kind"] != "plan-review" {
                            return Err("未知的提问意图".into());
                        }
                        let approve = intent["approve"].as_str().unwrap_or_default();
                        if !labels.iter().any(|label| label == approve) {
                            return Err("批准项必须是该问题的一个选项".into());
                        }
                    }
                }
                self.inner.lock().map_err(|e| e.to_string())?.live.questions = json!(questions);
                Ok(
                    json!({"shown":true,"note":"问题已展示，用户会作为下一条消息作答；先简短说明你会怎么用这些答案。"}),
                )
            }
            "read_skill" => {
                let name = nonempty_text(args, "name", 60)?;
                let reference = args["reference"].as_str().unwrap_or("SKILL.md");
                for value in [&name, &reference.to_string()] {
                    if Path::new(value)
                        .components()
                        .any(|c| !matches!(c, std::path::Component::Normal(_)))
                    {
                        return Err("技能路径无效".into());
                    }
                }
                let path = self
                    .skill_roots()
                    .into_iter()
                    .map(|root| root.join(&name).join(reference))
                    .find(|path| path.is_file())
                    .ok_or("未知技能")?;
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
                let snapshot = (self.apply)(action, None)?;
                let title = args["title"].as_str().unwrap_or_default().to_string();
                let selector = snapshot
                    .data
                    .tasks
                    .iter()
                    .max_by_key(|task| task.created_at)
                    .map(|task| format!("[data-task-id=\"{}\"]", task.id));
                self.note_deed(format!("建了任务「{title}」"), selector);
                serde_json::to_value(snapshot).map_err(|e| e.to_string())
            }
            // 课表阻塞时段：模型能直接增删，和界面上那张卡片是同一份数据。
            "save_block" | "delete_block" => {
                let title = args["title"]
                    .as_str()
                    .unwrap_or_default()
                    .trim()
                    .to_string();
                let known = args["id"].as_str().map(String::from);
                // 删掉之后名字就没了，先记下来，好给用户一句说明。
                let removed = if name == "delete_block" {
                    known.as_ref().and_then(|id| {
                        let mut engine = self.engine.lock().ok()?;
                        let snapshot = engine.snapshot(now()).ok()?;
                        snapshot
                            .data
                            .blocks
                            .iter()
                            .find(|block| &block.id == id)
                            .map(|block| block.title.clone())
                    })
                } else {
                    None
                };
                let mut value = args.clone();
                value["type"] = json!(if name == "save_block" {
                    "saveBlock"
                } else {
                    "deleteBlock"
                });
                if name == "save_block" && value.get("id").is_none() {
                    value["id"] = Value::Null;
                }
                let action = serde_json::from_value(value).map_err(|e| e.to_string())?;
                let snapshot = (self.apply)(action, None)?;
                if name == "save_block" {
                    let selector = snapshot
                        .data
                        .blocks
                        .iter()
                        .find(|block| !title.is_empty() && block.title == title)
                        .map(|block| format!("[data-block-id=\"{}\"]", block.id));
                    self.note_deed(format!("课表里记下了「{title}」"), selector);
                } else {
                    self.note_deed(
                        match removed {
                            Some(title) => format!("删掉了课表时段「{title}」"),
                            None => "删掉了一个课表时段".to_string(),
                        },
                        None,
                    );
                }
                serde_json::to_value(snapshot).map_err(|e| e.to_string())
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
                let snapshot = (self.apply)(action, Some(base))?;
                // 任务改动是助手最常做的事：把动到的那条标出来，回去时演给用户看。
                let selector = match name {
                    "complete_task" => args["id"]
                        .as_str()
                        .map(|id| format!("[data-task-id=\"{id}\"]")),
                    _ => None,
                };
                let text = match name {
                    "complete_task" => "把这条任务勾掉了".to_string(),
                    "move_tasks" => format!(
                        "把 {} 个任务挪到了 {}",
                        args["ids"].as_array().map(Vec::len).unwrap_or(0),
                        args["dueDate"].as_str().unwrap_or("另一天")
                    ),
                    _ => "改了一条任务".to_string(),
                };
                self.note_deed(text, selector);
                serde_json::to_value(snapshot).map_err(|e| e.to_string())
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
                // 兜底路径也要留下痕迹：按 Action 类型给一句人话，能定位就带上选择器。
                let deed = match &action {
                    Action::SaveBlock { title, .. } => {
                        Some((format!("课表里记下了「{title}」"), None))
                    }
                    Action::DeleteBlock { .. } => Some(("删掉了一个课表时段".to_string(), None)),
                    Action::ToggleTask { id } => Some((
                        "勾掉了一条任务".to_string(),
                        Some(format!("[data-task-id=\"{id}\"]")),
                    )),
                    Action::DeleteTask { .. } => Some(("删掉了一条任务".to_string(), None)),
                    Action::RestoreTask { .. } => Some(("找回了一条任务".to_string(), None)),
                    Action::ImportPlan { .. } => Some(("导入了学习计划".to_string(), None)),
                    Action::Import { .. } => Some(("恢复了备份".to_string(), None)),
                    Action::SaveGoal { name, .. } => Some((format!("更新了主线「{name}」"), None)),
                    Action::SaveHabit { name, .. } => Some((format!("更新了习惯「{name}」"), None)),
                    Action::SaveVision { name, .. } => {
                        Some((format!("记下了愿景「{name}」"), None))
                    }
                    _ => None,
                };
                let snapshot = (self.apply)(action, None)?;
                if let Some((text, selector)) = deed {
                    self.note_deed(text, selector);
                }
                serde_json::to_value(snapshot).map_err(|e| e.to_string())
            }
            // Declining a proposal only forgets the review: the file stays in the
            // workspace until the user asks for something else.
            "reject_file" => {
                let name = args["name"].as_str().ok_or("缺少文件名")?;
                let removed = self
                    .inner
                    .lock()
                    .map_err(|e| e.to_string())?
                    .live
                    .reviewed
                    .remove(name)
                    .is_some();
                Ok(json!({"declined":removed,"name":name}))
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
                        let skills = self.available_skills();
                        let inner = self.inner.lock().map_err(|e| e.to_string())?;
                        Ok(
                            json!({"today":s.today,"stats":s.stats,"projects":s.data.projects,"goals":s.data.goals,"visions":s.data.visions,"blocks":s.data.blocks,"todayBlocks":tomato_core::blocks::on_date(&s.data.blocks,&s.today),"nodeProgress":s.node_progress,"anomalies":diagnose(&s,inner.store.preferences.daily_capacity_minutes),"memories":inner.store.memories,"recentTasks":s.data.tasks.iter().filter(|t|t.due_date.as_deref().is_some_and(|d|d>=s.today.as_str())).take(50).collect::<Vec<_>>(),"taskCount":s.data.tasks.len(),"skills":skills,"permission":"用户主动发起时可直接执行允许的操作；自动唤醒仅分析、提问与准备文件。保护规则不可绕开。"}),
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
fn node_executable(resources: &Path) -> PathBuf {
    resources.join(if cfg!(target_os = "windows") {
        "bin/node.exe"
    } else {
        "bin/node"
    })
}
pub fn mcp_entry(resource_dir: Option<&Path>) -> bool {
    if !std::env::args().any(|arg| arg == "--mcp") {
        return false;
    }
    let exe = std::env::current_exe().expect("无法定位程序");
    // Take the resource dir from the caller: Tauri installs bundled resources
    // under /usr/lib/<product name> ("Tomato Todo"), which is not where the
    // binary sits, so a path relative to the executable cannot find them.
    let dir = resources(&exe, resource_dir);
    let status = std::process::Command::new(node_executable(&dir))
        .arg(dir.join("mcp.mjs"))
        .args(std::env::args().skip(1).filter(|a| a != "--mcp"))
        .status();
    std::process::exit(status.ok().and_then(|s| s.code()).unwrap_or(1));
}
