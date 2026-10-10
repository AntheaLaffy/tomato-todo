use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{fs, path::Path};
use tomato_core::AppResult;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Preferences {
    pub enabled: bool,
    pub automatic: bool,
    pub provider: String,
    pub model: String,
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
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WakeRecord {
    pub key: String,
    pub at: i64,
    pub status: String,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Store {
    pub preferences: Preferences,
    pub memories: Vec<Memory>,
    pub messages: Vec<Message>,
    pub wakes: Vec<WakeRecord>,
    pub session_file: Option<String>,
}
impl Store {
    pub fn load(dir: &Path) -> AppResult<Self> {
        private_directory(dir)?;
        let path = dir.join("state.json");
        if !path.exists() {
            return Ok(Self::default());
        }
        let store: Self = serde_json::from_slice(&fs::read(path).map_err(|e| e.to_string())?)
            .map_err(|e| format!("智能体状态损坏，原文件已保留：{e}"))?;
        store.preferences.validate()?;
        Ok(store)
    }
    pub fn save(&self, dir: &Path) -> AppResult<()> {
        atomic_json(&dir.join("state.json"), self)
    }
    pub fn message(&mut self, role: &str, text: String, at: i64, automatic: bool) -> String {
        let id = uuid::Uuid::new_v4().to_string();
        self.messages.push(Message {
            id: id.clone(),
            role: role.into(),
            text,
            at,
            automatic,
        });
        if self.messages.len() > 300 {
            self.messages.drain(..self.messages.len() - 300);
        }
        id
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
