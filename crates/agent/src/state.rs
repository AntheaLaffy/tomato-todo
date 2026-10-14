use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{fs, path::Path};
use tomato_core::AppResult;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Preferences {
    pub enabled: bool,
    pub automatic: bool,
    pub provider: String,
    pub model: String,
    pub thinking_level: String,
    pub daily_capacity_minutes: Option<u32>,
    pub max_auto_wakes_per_day: u32,
    pub cooldown_hours: u32,
    pub quiet_start: String,
    pub quiet_end: String,
    pub web_search: String,
    /// 编程沙箱权限：workspace 只写工作区，full 用用户身份完整访问。
    pub coding_access: String,
}
impl Default for Preferences {
    fn default() -> Self {
        Self {
            enabled: false,
            automatic: true,
            provider: "deepseek".into(),
            model: String::new(),
            thinking_level: "medium".into(),
            daily_capacity_minutes: None,
            max_auto_wakes_per_day: 3,
            cooldown_hours: 24,
            quiet_start: "22:00".into(),
            quiet_end: "08:00".into(),
            web_search: "cached".into(),
            coding_access: "workspace".into(),
        }
    }
}
impl Preferences {
    pub fn validate(&self) -> AppResult<()> {
        if !["off", "minimal", "low", "medium", "high", "xhigh", "max"]
            .contains(&self.thinking_level.as_str())
        {
            return Err("思考强度需为 off/minimal/low/medium/high/xhigh/max".into());
        }
        if !["disabled", "cached", "live"].contains(&self.web_search.as_str()) {
            return Err("联网模式需为 disabled/cached/live".into());
        }
        if !["workspace", "full"].contains(&self.coding_access.as_str()) {
            return Err("编程权限需为 workspace/full".into());
        }
        if !["deepseek", "openai-codex"].contains(&self.provider.as_str())
            || self.model.len() > 200
            || self
                .daily_capacity_minutes
                .is_some_and(|m| !(15..=1440).contains(&m))
            || self.max_auto_wakes_per_day > 12
            || !(1..=168).contains(&self.cooldown_hours)
        {
            return Err("智能体设置超出允许范围".into());
        }
        for t in [&self.quiet_start, &self.quiet_end] {
            if chrono::NaiveTime::parse_from_str(t, "%H:%M").is_err() {
                return Err("安静时段需为 HH:MM".into());
            }
        }
        Ok(())
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Memory {
    pub id: String,
    pub kind: String,
    pub text: String,
    pub source: String,
    pub confirmed: bool,
    pub updated_at: i64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub id: String,
    pub role: String,
    pub text: String,
    pub at: i64,
    pub automatic: bool,
    #[serde(default)]
    pub entry_id: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,
    #[serde(default)]
    pub stopped: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub id: String,
    pub name: String,
    pub mime_type: String,
    pub bytes: usize,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchSource {
    pub conversation_id: String,
    pub message_id: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub session_file: Option<String>,
    pub messages: Vec<Message>,
    pub updated_at: i64,
    pub pinned: bool,
    pub branched_from: Option<BranchSource>,
}
impl Default for Conversation {
    fn default() -> Self {
        Self {
            id: String::new(),
            title: "新对话".into(),
            session_file: None,
            messages: Vec::new(),
            updated_at: 0,
            pinned: false,
            branched_from: None,
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WakeRecord {
    pub key: String,
    pub at: i64,
    pub status: String,
}
fn short_title(text: &str) -> String {
    let line = text
        .lines()
        .find(|line| !line.trim().is_empty())
        .unwrap_or("新对话")
        .trim();
    let mut title: String = line.chars().take(24).collect();
    if line.chars().count() > 24 {
        title.push('…');
    }
    title
}
/// 用户排定的一次任务或固定节奏的任务。到点由助手自己去做，而不是只分析：
/// 这是用户预先授权过的一次动作，因此这一轮带完整工具集（含 MCP），也不受异常
/// 唤醒的冷却、每日上限和安静时段限制。
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Schedule {
    /// 新建时留空，保存时由调用方补一个 uuid。
    #[serde(default)]
    pub id: String,
    pub name: String,
    /// 本机时间。`repeat` 为 once 时是 `YYYY-MM-DDTHH:MM`，否则只取 `HH:MM`。
    pub at: String,
    #[serde(default = "default_repeat")]
    pub repeat: String,
    /// 交给助手去做的事，写清目标与边界。
    pub instruction: String,
    /// 提前多少分钟提醒（0 = 不提醒）。助手据此建带提醒的任务。
    #[serde(default)]
    pub remind_minutes: u32,
    #[serde(default = "yes")]
    pub enabled: bool,
    /// 到点前多少分钟开始严格锁机（0 = 不锁）。防拖沓用：用户明确要求才设。
    #[serde(default)]
    pub lock_before_minutes: u32,
    /// 上次触发时间；一次性的任务用它防重，周期性的用它按天去重。
    #[serde(default)]
    pub fired_at: Option<i64>,
    /// 上次为它锁机的时间，避免一轮里反复锁。
    #[serde(default)]
    pub locked_at: Option<i64>,
}
fn default_repeat() -> String {
    "once".into()
}
fn yes() -> bool {
    true
}
impl Schedule {
    pub fn validate(&self) -> AppResult<()> {
        if self.id.is_empty() || self.name.trim().is_empty() || self.name.chars().count() > 40 {
            return Err("定时任务需要 1–40 字的名称".into());
        }
        if self.instruction.trim().is_empty() || self.instruction.chars().count() > 2000 {
            return Err("定时任务的指令需为 1–2000 字".into());
        }
        if !["once", "daily", "weekdays"].contains(&self.repeat.as_str()) {
            return Err("定时任务周期需为 once/daily/weekdays".into());
        }
        if self.remind_minutes > 240 {
            return Err("提前提醒最多 240 分钟".into());
        }
        if self.lock_before_minutes > 120 {
            return Err("提前锁机最多 120 分钟".into());
        }
        let parsed = if self.repeat == "once" {
            chrono::NaiveDateTime::parse_from_str(&self.at, "%Y-%m-%dT%H:%M").is_ok()
        } else {
            chrono::NaiveTime::parse_from_str(&self.at, "%H:%M").is_ok()
        };
        if !parsed {
            return Err("定时任务时间格式不对".into());
        }
        Ok(())
    }
    /// 到点前该不该开始锁机？返回剩余到点分钟数（锁到那时候）。
    pub fn lock_window(&self, now: chrono::NaiveDateTime) -> Option<u32> {
        if !self.enabled || self.lock_before_minutes == 0 {
            return None;
        }
        let target = self.target_time(now)?;
        let until = now.signed_duration_since(target).num_minutes();
        if until > 0 || -until > i64::from(self.lock_before_minutes) {
            return None;
        }
        use chrono::{Datelike, TimeZone};
        let locked_today = self.locked_at.is_some_and(|at| {
            chrono::Local
                .timestamp_opt(at, 0)
                .single()
                .is_some_and(|t| {
                    (t.year(), t.month(), t.day()) == (now.year(), now.month(), now.day())
                })
        });
        if locked_today {
            return None;
        }
        Some((-until).clamp(1, 720) as u32)
    }
    /// 这条安排相对 `now` 所在日期的目标时刻。
    pub fn target_time(&self, now: chrono::NaiveDateTime) -> Option<chrono::NaiveDateTime> {
        use chrono::Datelike;
        if self.repeat == "once" {
            return chrono::NaiveDateTime::parse_from_str(&self.at, "%Y-%m-%dT%H:%M").ok();
        }
        let time = chrono::NaiveTime::parse_from_str(&self.at, "%H:%M").ok()?;
        let today = chrono::NaiveDate::from_ymd_opt(now.year(), now.month(), now.day())?;
        if self.repeat == "weekdays" && today.weekday().number_from_monday() > 5 {
            return None;
        }
        Some(
            chrono::NaiveDate::from_ymd_opt(today.year(), today.month(), today.day())?
                .and_time(time),
        )
    }
    /// 这个时刻该不该触发？`now` 是本机时间。
    pub fn due(&self, now: chrono::NaiveDateTime) -> bool {
        if !self.enabled {
            return false;
        }
        use chrono::{Datelike, NaiveDate, TimeZone, Timelike};
        let fired_today = self.fired_at.is_some_and(|at| {
            chrono::Local
                .timestamp_opt(at, 0)
                .single()
                .is_some_and(|t| {
                    NaiveDate::from_ymd_opt(t.year(), t.month(), t.day())
                        == NaiveDate::from_ymd_opt(now.year(), now.month(), now.day())
                })
        });
        if self.repeat == "once" {
            let Ok(target) = chrono::NaiveDateTime::parse_from_str(&self.at, "%Y-%m-%dT%H:%M")
            else {
                return false;
            };
            let late = now.signed_duration_since(target).num_minutes();
            return self.fired_at.is_none() && (0..=30).contains(&late);
        }
        let Ok(target) = chrono::NaiveTime::parse_from_str(&self.at, "%H:%M") else {
            return false;
        };
        if self.repeat == "weekdays" && now.weekday().number_from_monday() > 5 {
            return false;
        }
        let same_minute = now.hour() == target.hour() && now.minute().abs_diff(target.minute()) < 1;
        same_minute && !fired_today
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Store {
    pub preferences: Preferences,
    pub memories: Vec<Memory>,
    pub wakes: Vec<WakeRecord>,
    /// 用户排定的定时任务：到点由助手自己去做（可以用 MCP 和改数据）。
    #[serde(default)]
    pub schedules: Vec<Schedule>,
    pub conversations: Vec<Conversation>,
    pub active: Option<String>,
    /// Legacy single-conversation fields, read once for migration and never written back.
    #[serde(default, skip_serializing)]
    messages: Vec<Message>,
    #[serde(default, skip_serializing)]
    session_file: Option<String>,
}
impl Store {
    pub fn load(dir: &Path) -> AppResult<Self> {
        private_directory(dir)?;
        let path = dir.join("state.json");
        if !path.exists() {
            return Ok(Self::default());
        }
        let mut store: Self = serde_json::from_slice(&fs::read(path).map_err(|e| e.to_string())?)
            .map_err(|e| format!("智能体状态损坏，原文件已保留：{e}"))?;
        store.migrate();
        store.preferences.validate()?;
        Ok(store)
    }
    fn migrate(&mut self) {
        if !self.conversations.is_empty() {
            self.messages.clear();
            self.session_file = None;
            return;
        }
        if self.messages.is_empty() && self.session_file.is_none() {
            return;
        }
        let updated_at = self.messages.last().map(|m| m.at).unwrap_or(0);
        let title = self
            .messages
            .iter()
            .find(|m| m.role == "user")
            .map(|m| short_title(&m.text))
            .unwrap_or_else(|| "旧对话".into());
        let conversation = Conversation {
            id: uuid::Uuid::new_v4().to_string(),
            title,
            session_file: self.session_file.take(),
            messages: std::mem::take(&mut self.messages),
            updated_at,
            ..Default::default()
        };
        self.active = Some(conversation.id.clone());
        self.conversations.push(conversation);
    }
    pub fn save(&self, dir: &Path) -> AppResult<()> {
        atomic_json(&dir.join("state.json"), self)
    }
    pub fn active_conversation(&self) -> Option<&Conversation> {
        let id = self.active.as_deref()?;
        self.conversations.iter().find(|c| c.id == id)
    }
    pub fn active_session(&self) -> Option<String> {
        self.active_conversation()
            .and_then(|c| c.session_file.clone())
    }
    pub fn messages(&self) -> Vec<Message> {
        self.active_conversation()
            .map(|c| c.messages.clone())
            .unwrap_or_default()
    }
    pub fn conversations_view(&self) -> Vec<Value> {
        let mut list: Vec<&Conversation> = self.conversations.iter().collect();
        list.sort_by_key(|c| (std::cmp::Reverse(c.pinned), std::cmp::Reverse(c.updated_at)));
        list.into_iter()
            .map(|c| {
                json!({"id":c.id,"title":c.title,"updatedAt":c.updated_at,"messageCount":c.messages.len(),"active":Some(c.id.as_str())==self.active.as_deref(),"pinned":c.pinned,"branchedFrom":c.branched_from})
            })
            .collect()
    }
    fn ensure_active(&mut self, at: i64) -> &mut Conversation {
        let known = self
            .active
            .as_deref()
            .is_some_and(|id| self.conversations.iter().any(|c| c.id == id));
        if !known {
            let id = uuid::Uuid::new_v4().to_string();
            self.conversations.push(Conversation {
                id: id.clone(),
                updated_at: at,
                ..Default::default()
            });
            self.active = Some(id);
        }
        let active = self.active.clone().unwrap_or_default();
        self.conversations
            .iter_mut()
            .find(|c| c.id == active)
            .expect("active conversation exists")
    }
    pub fn new_conversation(&mut self, at: i64) -> String {
        let id = uuid::Uuid::new_v4().to_string();
        self.conversations.push(Conversation {
            id: id.clone(),
            updated_at: at,
            ..Default::default()
        });
        self.active = Some(id.clone());
        id
    }
    pub fn switch_conversation(&mut self, id: &str) -> AppResult<()> {
        if !self.conversations.iter().any(|c| c.id == id) {
            return Err("会话不存在".into());
        }
        self.active = Some(id.into());
        Ok(())
    }
    pub fn delete_conversation(&mut self, id: &str) -> AppResult<Option<String>> {
        let index = self
            .conversations
            .iter()
            .position(|c| c.id == id)
            .ok_or("会话不存在")?;
        let removed = self.conversations.remove(index);
        if self.active.as_deref() == Some(id) {
            self.active = self
                .conversations
                .iter()
                .max_by_key(|c| c.updated_at)
                .map(|c| c.id.clone());
        }
        Ok(removed.session_file)
    }
    pub fn message(&mut self, role: &str, text: String, at: i64, automatic: bool) -> String {
        let id = uuid::Uuid::new_v4().to_string();
        let title = short_title(&text);
        let conversation = self.ensure_active(at);
        if role == "user" && conversation.title == "新对话" {
            conversation.title = title;
        }
        conversation.messages.push(Message {
            id: id.clone(),
            role: role.into(),
            text,
            at,
            automatic,
            entry_id: None,
            attachments: vec![],
            stopped: false,
        });
        conversation.updated_at = at;
        id
    }
    pub fn message_mut(&mut self, id: &str) -> Option<&mut Message> {
        self.conversations
            .iter_mut()
            .flat_map(|c| &mut c.messages)
            .find(|m| m.id == id)
    }
    pub fn fork_conversation(
        &mut self,
        message_id: &str,
        before: bool,
        session_file: String,
        at: i64,
    ) -> AppResult<String> {
        let source = self.active_conversation().ok_or("会话不存在")?;
        let index = source
            .messages
            .iter()
            .position(|m| m.id == message_id)
            .ok_or("消息不存在")?;
        let conversation = Conversation {
            id: uuid::Uuid::new_v4().to_string(),
            title: format!("{} · 分支", source.title),
            session_file: Some(session_file),
            messages: source.messages[..index + usize::from(!before)].to_vec(),
            updated_at: at,
            branched_from: Some(BranchSource {
                conversation_id: source.id.clone(),
                message_id: message_id.into(),
            }),
            ..Default::default()
        };
        let id = conversation.id.clone();
        self.conversations.push(conversation);
        self.active = Some(id.clone());
        Ok(id)
    }
    pub fn set_session(&mut self, path: &str, at: i64) {
        let conversation = self.ensure_active(at);
        conversation.session_file = Some(path.into());
        conversation.updated_at = at;
    }
}
pub fn private_directory(path: &Path) -> AppResult<()> {
    fs::create_dir_all(path).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700)).map_err(|e| e.to_string())?;
    }
    Ok(())
}
pub fn atomic_json(path: &Path, data: &impl Serialize) -> AppResult<()> {
    let parent = path.parent().ok_or("路径没有父目录")?;
    private_directory(parent)?;
    let temp = parent.join(format!(".{}.tmp", uuid::Uuid::new_v4()));
    let raw = serde_json::to_vec_pretty(data).map_err(|e| e.to_string())?;
    fs::write(&temp, raw).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&temp, fs::Permissions::from_mode(0o600)).map_err(|e| e.to_string())?;
    }
    fs::rename(&temp, path).map_err(|e| e.to_string())
}
pub fn nonempty_text(value: &Value, key: &str, max: usize) -> AppResult<String> {
    let text = value
        .get(key)
        .and_then(Value::as_str)
        .ok_or_else(|| format!("缺少 {key}"))?
        .trim();
    if text.is_empty() || text.chars().count() > max {
        return Err(format!("{key} 需为 1–{max} 个字符"));
    }
    Ok(text.into())
}
