//! niri's documented IPC controls focus without terminating or suspending other apps.
use crate::{AppResult, GuardMode, Protection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Window {
    pub id: u64,
    pub app_id: Option<String>,
    pub title: Option<String>,
    pub pid: Option<u32>,
    #[serde(default)]
    pub is_focused: bool,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GuardInfo {
    pub available: bool,
    pub backend: String,
    pub message: String,
    pub windows: Vec<Window>,
}

#[cfg(unix)]
fn request(value: Value) -> AppResult<Value> {
    use std::{
        io::{BufRead, BufReader, Read, Write},
        os::unix::net::UnixStream,
        time::Duration,
    };
    let path = std::env::var_os("NIRI_SOCKET").ok_or("当前桌面没有提供 niri 窗口接口")?;
    let mut socket = UnixStream::connect(path).map_err(|e| format!("无法连接 niri：{e}"))?;
    socket
        .set_read_timeout(Some(Duration::from_millis(400)))
        .map_err(|e| e.to_string())?;
    socket
        .set_write_timeout(Some(Duration::from_millis(400)))
        .map_err(|e| e.to_string())?;
    writeln!(socket, "{value}").map_err(|e| e.to_string())?;
    let mut line = String::new();
    BufReader::new(socket.take(2 * 1024 * 1024))
        .read_line(&mut line)
        .map_err(|e| e.to_string())?;
    let response: Value = serde_json::from_str(&line).map_err(|e| e.to_string())?;
    response
        .get("Ok")
        .cloned()
        .ok_or_else(|| format!("niri 拒绝了请求：{}", response["Err"]))
}
#[cfg(not(unix))]
fn request(_: Value) -> AppResult<Value> {
    Err("专注保护目前支持 Linux niri 桌面".into())
}

pub fn windows() -> AppResult<Vec<Window>> {
    let reply = request(json!("Windows"))?;
    serde_json::from_value(reply["Windows"].clone()).map_err(|e| e.to_string())
}
pub fn info() -> GuardInfo {
    match windows() {
        Ok(windows) => GuardInfo {
            available: true,
            backend: "niri / Wayland".into(),
            message: "窗口保护可用。非白名单应用会被切回专注界面。".into(),
            windows,
        },
        Err(e) => GuardInfo {
            available: false,
            backend: "当前环境".into(),
            message: format!("{e}。应用白名单管控需要 niri 桌面；普通番茄计时仍可使用。"),
            windows: vec![],
        },
    }
}
pub fn allowed(window: &Window, own_pid: u32, protection: &Protection) -> bool {
    if window.pid == Some(own_pid) {
        return true;
    }
    protection.mode == GuardMode::Off
        || (protection.mode == GuardMode::Whitelist
            && window
                .app_id
                .as_ref()
                .is_some_and(|app| protection.whitelist.iter().any(|allowed| allowed == app)))
}
pub fn preflight(own_pid: u32) -> AppResult<()> {
    if !windows()?.iter().any(|w| w.pid == Some(own_pid)) {
        return Err("未找到番茄 Todo 的桌面窗口，无法开启专注保护".into());
    }
    Ok(())
}
pub fn enforce(protection: &Protection, own_pid: u32) -> AppResult<bool> {
    if protection.mode == GuardMode::Off {
        return Ok(false);
    }
    let windows = windows()?;
    let own = windows
        .iter()
        .find(|w| w.pid == Some(own_pid))
        .ok_or("专注窗口已关闭")?;
    if let Some(active) = windows.iter().find(|w| w.is_focused) {
        if !allowed(active, own_pid, protection) {
            request(json!({"Action": {"FocusWindow": {"id": own.id}}}))?;
            return Ok(true);
        }
    }
    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn window(app: &str, pid: u32) -> Window {
        Window {
            id: 1,
            app_id: Some(app.into()),
            title: None,
            pid: Some(pid),
            is_focused: true,
        }
    }
    #[test]
    fn whitelist_matches_exact_app_ids_and_own_process() {
        let p = Protection {
            mode: GuardMode::Whitelist,
            whitelist: vec!["code".into()],
            strict: false,
        };
        assert!(allowed(&window("code", 200), 100, &p));
        assert!(!allowed(&window("code-malicious", 200), 100, &p));
        assert!(allowed(&window("tomato", 100), 100, &p));
        assert!(!allowed(&window("tomato", 201), 100, &p));
    }
    #[test]
    fn lock_mode_ignores_whitelist() {
        let p = Protection {
            mode: GuardMode::Lock,
            whitelist: vec!["code".into()],
            strict: false,
        };
        assert!(!allowed(&window("code", 200), 100, &p));
    }
}
