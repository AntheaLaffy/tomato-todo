//! runtime → guard 的 HTTP 命令协议（契约见 API.md「guard 命令协议」）。
//! guard 本身无域无状态：锁定只活在进程内，runtime 每次专注会话重发命令。
use serde::{Deserialize, Serialize};

/// `POST /guard` 的请求体。serde 内部标签，字段名小写：
/// `{"command":"lock","whitelist":[...]}` / `{"command":"unlock"}` /
/// `{"command":"notify","title":...,"body":...}`。
#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "command", rename_all = "lowercase")]
pub enum Command {
    Lock {
        #[serde(default)]
        whitelist: Vec<String>,
    },
    Unlock,
    Notify {
        title: String,
        body: String,
    },
    /// 把 DeepSeek Harness 的窗口切到前台（桌面窗口托管模式与浏览器都适用）。
    Focus,
}

/// `GET /guard/status` 的响应体（形状由 API.md 固定）。
/// backend 是实际后端名（`guard::Desktop::name()`，如 "Sway / Wayland"），
/// 供 runtime 诊断与错误提示使用。
#[derive(Clone, Debug, Serialize)]
pub struct Status {
    pub locked: bool,
    pub whitelist: Vec<String>,
    pub pid: u32,
    pub backend: String,
}

#[derive(Serialize)]
pub struct OkReply {
    pub ok: bool,
}

/// `focus` 的响应：没找到 DSH 窗口时 `focused=false` 且 `window=null`。
#[derive(Serialize)]
pub struct FocusReply {
    pub ok: bool,
    pub focused: bool,
    pub window: Option<String>,
}

#[derive(Serialize)]
pub struct ErrorReply {
    pub error: String,
}

/// 白名单校验，移植旧 crates/core/src/lib.rs 的 `valid_app_ids` 语义：
/// 最多 100 项；每项非空白、无控制字符、最多 32768 个字符。
pub fn valid_whitelist(list: &[String]) -> bool {
    list.len() <= 100
        && list.iter().all(|a| {
            !a.trim().is_empty() && a.chars().count() <= 32768 && !a.chars().any(char::is_control)
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn command_json_round_trip() {
        let lock: Command = serde_json::from_str(r#"{"command":"lock","whitelist":["code"]}"#).unwrap();
        assert!(matches!(lock, Command::Lock { ref whitelist } if whitelist == &["code".to_string()]));
        let lock_empty: Command = serde_json::from_str(r#"{"command":"lock"}"#).unwrap();
        assert!(matches!(lock_empty, Command::Lock { ref whitelist } if whitelist.is_empty()));
        let unlock: Command = serde_json::from_str(r#"{"command":"unlock"}"#).unwrap();
        assert!(matches!(unlock, Command::Unlock));
        let notify: Command =
            serde_json::from_str(r#"{"command":"notify","title":"番茄","body":"完成"}"#).unwrap();
        assert!(matches!(notify, Command::Notify { ref title, ref body } if title == "番茄" && body == "完成"));
        let focus: Command = serde_json::from_str(r#"{"command":"focus"}"#).unwrap();
        assert!(matches!(focus, Command::Focus));
        assert!(serde_json::from_str::<Command>(r#"{"command":"unknown"}"#).is_err());
        assert!(serde_json::from_str::<Command>(r#"{}"#).is_err());
    }

    #[test]
    fn whitelist_validation_matches_old_semantics() {
        assert!(valid_whitelist(&[]));
        assert!(valid_whitelist(&["code".into()]));
        assert!(!valid_whitelist(&["".into()]));
        assert!(!valid_whitelist(&["  ".into()]));
        assert!(!valid_whitelist(&["a\u{0}b".into()]));
        assert!(!valid_whitelist(&["a\nb".into()]));
        let long = "x".repeat(32769);
        assert!(!valid_whitelist(&[long]));
        assert!(valid_whitelist(&vec!["x".into(); 100]));
        assert!(!valid_whitelist(&vec!["x".into(); 101]));
    }

    #[test]
    fn status_json_shape() {
        let status = Status {
            locked: true,
            whitelist: vec!["code".into()],
            pid: 42,
            backend: "Sway / Wayland".into(),
        };
        let value: serde_json::Value = serde_json::to_value(&status).unwrap();
        assert_eq!(
            value,
            serde_json::json!({"locked": true, "whitelist": ["code"], "pid": 42, "backend": "Sway / Wayland"})
        );
    }
}
