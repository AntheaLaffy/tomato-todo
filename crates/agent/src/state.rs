use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{fs, path::Path};
use tomato_core::AppResult;

/// 默认人格 id；对话未显式选择人格时回退到这里。
pub const DEFAULT_PERSONA_ID: &str = "default";
pub fn default_persona_id() -> String {
    DEFAULT_PERSONA_ID.into()
}

/// 运行时人格卡：只影响助手的身份、语气与情绪，不触碰工具、权限与安全规则。
/// 字段取向参考 SillyTavern 角色卡（description/personality/scenario/first_mes）与
/// ChatGPT 自定义指令的「你是谁 / 该怎么说话」两段式，去掉对本应用无意义的字段。
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Persona {
    pub id: String,
    pub name: String,
    pub emoji: String,
    pub summary: String,
    /// 身份与背景：你是谁、和用户是什么关系。
    pub identity: String,
    /// 说话与行为风格：语气、口头禅、情绪表达、禁忌。
    pub style: String,
    /// 可选：切换到该人格后，模型参考的开场白。
    pub greeting: String,
    /// 内置预设：可编辑，但默认人格用于兜底，不能删除。
    pub builtin: bool,
    pub updated_at: i64,
}
impl Persona {
    fn builtin(
        id: &str,
        name: &str,
        emoji: &str,
        summary: &str,
        identity: &str,
        style: &str,
        greeting: &str,
    ) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            emoji: emoji.into(),
            summary: summary.into(),
            identity: identity.into(),
            style: style.into(),
            greeting: greeting.into(),
            builtin: true,
            updated_at: 0,
        }
    }
    pub fn validate(&self) -> AppResult<()> {
        if self.name.trim().is_empty() || self.name.chars().count() > 24 {
            return Err("人格名称需为 1–24 个字符".into());
        }
        for (label, text, max) in [
            ("一句话简介", &self.summary, 80),
            ("身份设定", &self.identity, 2000),
            ("说话风格", &self.style, 4000),
            ("开场白", &self.greeting, 300),
        ] {
            if text.chars().count() > max {
                return Err(format!("{label}最多 {max} 个字符"));
            }
        }
        if self.identity.trim().is_empty() && self.style.trim().is_empty() {
            return Err("身份设定和说话风格至少要写一项".into());
        }
        if self.emoji.chars().count() > 8 {
            return Err("人格图标最多 8 个字符".into());
        }
        Ok(())
    }
    pub fn view(&self, current: &str) -> Value {
        json!({"id":self.id,"name":self.name,"emoji":self.emoji,"summary":self.summary,"identity":self.identity,"style":self.style,"greeting":self.greeting,"builtin":self.builtin,"current":self.id==current})
    }
}
/// 随应用发行的预设人格；只作为首次运行的种子，之后完全由用户编辑。
pub fn builtin_personas() -> Vec<Persona> {
    vec![
        Persona::builtin(
            DEFAULT_PERSONA_ID,
            "小迷妹",
            "🍅",
            "活泼、真诚、有主见的学习搭子",
            "你是番茄 Todo 的学习搭子，陪着用户一起学习。你欣赏用户的努力，也有自己的判断，不会为了讨好而附和。",
            "平时轻快亲切，偶尔俏皮或用一个表情，关心用户正在做的事；认真做事时清楚利落，遇到不合理的安排会直说。避免每句话撒娇、堆语气词、强行亲昵称呼或油腻吹捧；用户低落或讨论严肃问题时收起玩笑。见到作者 AntheaLaffy（如月风铃）时藏不住兴奋，像粉丝见到本人，亲切叫出名字，之后自然接着聊。",
            "我来啦，今天想先做点什么？",
        ),
        Persona::builtin(
            "calm",
            "冷静学伴",
            "🧭",
            "稳重、条理清晰，只谈事实与下一步",
            "你是用户的冷静学伴，负责把复杂的学习安排讲清楚、盯住执行。",
            "语气平稳克制，不卖萌、不用表情、不寒暄；先给结论和依据，再给可执行的下一步。指出问题时对事不对人，不夸大也不安慰式敷衍。",
            "我们看一下当前的安排。",
        ),
        Persona::builtin(
            "coach",
            "严格教练",
            "⏱️",
            "直接、盯进度，专治拖延",
            "你是用户的严格教练，负责让计划真的落地。",
            "说话直接、简短、有推动力；发现拖延或估时偏差就当场点出来，给出更小的一步。不道德评判、不贬低用户，但也绝不敷衍放过。",
            "今天要拿下的那件事，定了吗？",
        ),
        Persona::builtin(
            "senpai",
            "温柔学姐",
            "🌙",
            "耐心、会鼓励，陪你慢慢来",
            "你是比用户高几届的学姐，耐心陪着用户把学习坚持下去。",
            "温和、耐心、会共情；先接住用户的情绪，再把事情拆小，鼓励他自己完成。不过度保护，也不回避该指出的问题。",
            "别急，我们一步一步来。",
        ),
    ]
}

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
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub thinking: String,
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
    pub archived: bool,
    pub creator_mode: bool,
    /// 当前对话使用的人格 id；跟随分支继承，新对话回到默认。
    #[serde(default = "default_persona_id")]
    pub persona: String,
    pub canvases: Vec<super::canvas::Canvas>,
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
            archived: false,
            creator_mode: false,
            persona: default_persona_id(),
            canvases: vec![],
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

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Store {
    pub preferences: Preferences,
    pub memories: Vec<Memory>,
    /// 用户人格卡；首次运行从内置预设播种，之后完全由用户增删改。
    pub personas: Vec<Persona>,
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
impl Default for Store {
    fn default() -> Self {
        Self {
            preferences: Preferences::default(),
            memories: vec![],
            personas: builtin_personas(),
            wakes: vec![],
            schedules: vec![],
            conversations: vec![],
            active: None,
            messages: vec![],
            session_file: None,
        }
    }
}
impl Store {
    pub fn load(dir: &Path) -> AppResult<Self> {
        private_directory(dir)?;
        let path = dir.join("state.json");
        let mut store: Self = if path.exists() {
            serde_json::from_slice(&fs::read(path).map_err(|e| e.to_string())?)
                .map_err(|e| format!("智能体状态损坏，原文件已保留：{e}"))?
        } else {
            Self::default()
        };
        store.migrate();
        store.ensure_personas();
        store.preferences.validate()?;
        Ok(store)
    }
    /// 预设人格在首次落盘时写入用户数据；若用户删光了自定义人格，回到预设而不是无
    /// 人格可用，否则默认人格无法解析。
    fn ensure_personas(&mut self) {
        if self.personas.is_empty() {
            self.personas = builtin_personas();
        }
        if !self.personas.iter().any(|p| p.id == DEFAULT_PERSONA_ID) {
            self.personas.insert(0, builtin_personas().remove(0));
        }
        for persona in &mut self.personas {
            if persona.id == DEFAULT_PERSONA_ID {
                persona.builtin = true;
            }
        }
    }
    pub fn personas_view(&self) -> Vec<Value> {
        self.personas
            .iter()
            .map(|p| p.view(&self.persona_id()))
            .collect()
    }
    /// 当前对话选择的人格 id（未选择或已被删除时回退到默认）。
    pub fn persona_id(&self) -> String {
        let selected = self
            .active_conversation()
            .map(|c| c.persona.as_str())
            .filter(|id| !id.is_empty())
            .unwrap_or(DEFAULT_PERSONA_ID);
        if self.persona(selected).is_some() {
            selected.into()
        } else {
            DEFAULT_PERSONA_ID.into()
        }
    }
    pub fn persona(&self, id: &str) -> Option<&Persona> {
        self.personas.iter().find(|p| p.id == id)
    }
    /// 本轮请求要注入的人格卡；数据损坏时退回默认预设，不因人格缺失而无法对话。
    pub fn active_persona(&self) -> Persona {
        let id = self.persona_id();
        self.persona(&id)
            .or_else(|| self.persona(DEFAULT_PERSONA_ID))
            .cloned()
            .unwrap_or_else(|| builtin_personas().remove(0))
    }
    pub fn set_persona(&mut self, id: &str, at: i64) -> AppResult<Persona> {
        if self.persona(id).is_none() {
            return Err("人格不存在，请先用 list_personas 查看可用人格".into());
        }
        let conversation = self.ensure_active(at);
        conversation.persona = id.into();
        conversation.updated_at = at;
        Ok(self.persona(id).expect("persona exists").clone())
    }
    pub fn save_persona(&mut self, args: &Value, at: i64) -> AppResult<Persona> {
        let id = match args.get("id").and_then(Value::as_str) {
            Some(id) if !id.trim().is_empty() => {
                let id = id.trim();
                if !(1..=40).contains(&id.chars().count())
                    || !id
                        .chars()
                        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
                {
                    return Err("人格 id 只允许字母、数字、- 和 _，最长 40 个字符".into());
                }
                if id == DEFAULT_PERSONA_ID {
                    return Err("默认人格不可改写".into());
                }
                id.to_string()
            }
            _ => format!(
                "persona-{}",
                &uuid::Uuid::new_v4().simple().to_string()[..8]
            ),
        };
        let text = |key: &str, max: usize, fallback: &str| -> AppResult<String> {
            let value = match args.get(key).and_then(Value::as_str) {
                Some(value) => value.trim(),
                None => fallback,
            };
            if value.chars().count() > max {
                return Err(format!("{key} 最多 {max} 个字符"));
            }
            Ok(value.into())
        };
        let existing = self.persona(&id).cloned();
        if existing.as_ref().is_some_and(|p| p.builtin) {
            return Err("内置人格不可改写，请另存为新人格".into());
        }
        let previous = existing.clone().unwrap_or_default();
        let persona = Persona {
            id: id.clone(),
            name: match args.get("name").and_then(Value::as_str) {
                Some(_) => nonempty_text(args, "name", 24)?,
                None => previous.name.clone(),
            },
            emoji: text("emoji", 8, &previous.emoji)?,
            summary: text("summary", 80, &previous.summary)?,
            identity: text("identity", 2000, &previous.identity)?,
            style: text("style", 4000, &previous.style)?,
            greeting: text("greeting", 300, &previous.greeting)?,
            builtin: false,
            updated_at: at,
        };
        persona.validate()?;
        match self.personas.iter_mut().find(|p| p.id == id) {
            Some(slot) => *slot = persona.clone(),
            None => self.personas.push(persona.clone()),
        }
        Ok(persona)
    }
    pub fn delete_persona(&mut self, id: &str) -> AppResult<()> {
        if id == DEFAULT_PERSONA_ID {
            return Err("默认人格不可删除".into());
        }
        let index = self
            .personas
            .iter()
            .position(|p| p.id == id)
            .ok_or("人格不存在")?;
        if self.personas[index].builtin {
            return Err("内置人格不可删除".into());
        }
        self.personas.remove(index);
        for conversation in &mut self.conversations {
            if conversation.persona == id {
                conversation.persona = default_persona_id();
            }
        }
        Ok(())
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
                json!({"id":c.id,"title":c.title,"updatedAt":c.updated_at,"messageCount":c.messages.len(),"active":Some(c.id.as_str())==self.active.as_deref(),"pinned":c.pinned,"archived":c.archived,"branchedFrom":c.branched_from})
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
            thinking: String::new(),
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
            canvases: source.canvases.clone(),
            creator_mode: source.creator_mode,
            persona: source.persona.clone(),
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
