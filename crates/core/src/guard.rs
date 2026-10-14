//! Native desktop focus control without terminating or suspending other apps.
#[cfg(target_os = "macos")]
#[path = "guard_macos.rs"]
mod macos;
#[cfg(target_os = "windows")]
#[path = "guard_windows.rs"]
mod win32;
#[cfg(target_os = "linux")]
#[path = "guard_x11.rs"]
mod x11;
use crate::{AppResult, GuardMode, Protection};
use serde::{Deserialize, Serialize};
#[cfg(target_os = "linux")]
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

#[cfg(target_os = "linux")]
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
pub fn windows() -> AppResult<Vec<Window>> {
    #[cfg(target_os = "macos")]
    {
        macos::windows()
    }
    #[cfg(target_os = "windows")]
    {
        win32::windows()
    }
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("NIRI_SOCKET").is_none() {
            return x11::windows();
        }
        let reply = request(json!("Windows"))?;
        serde_json::from_value(reply["Windows"].clone()).map_err(|e| e.to_string())
    }
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        Err("当前平台尚未提供原生窗口保护接口".into())
    }
}
fn backend() -> &'static str {
    if cfg!(target_os = "windows") {
        "Win32 / Windows"
    } else if cfg!(target_os = "macos") {
        "Quartz / macOS Accessibility"
    } else if std::env::var_os("NIRI_SOCKET").is_some() {
        "niri / Wayland"
    } else {
        "EWMH / X11"
    }
}
pub fn info() -> GuardInfo {
    match windows() {
        Ok(windows) => GuardInfo {
            available: true,
            backend: backend().into(),
            message: "窗口保护可用。非白名单应用会被切回专注界面。".into(),
            windows,
        },
        Err(e) => GuardInfo {
            available: false,
            backend: "当前环境".into(),
            message: format!("{e}。普通番茄计时仍可使用。"),
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
    if !windows()?
        .iter()
        .any(|w| w.pid == Some(own_pid) && !(cfg!(target_os = "macos") && w.id == 0))
    {
        return Err("未找到番茄 Todo 的桌面窗口，无法开启专注保护".into());
    }
    Ok(())
}
/// Report a confirmed redirect; a deferred Windows activation leaves protection running.
pub fn enforce(protection: &Protection, own_pid: u32) -> AppResult<bool> {
    if protection.mode == GuardMode::Off {
        return Ok(false);
    }
    let windows = windows()?;
    let own = windows
        .iter()
        .find(|w| w.pid == Some(own_pid) && !(cfg!(target_os = "macos") && w.id == 0))
        .ok_or("专注窗口已关闭")?;
    if let Some(active) = windows.iter().find(|w| w.is_focused) {
        if !allowed(active, own_pid, protection) {
            return focus_window(own.id);
        }
    }
    Ok(false)
}
fn focus_window(id: u64) -> AppResult<bool> {
    #[cfg(target_os = "macos")]
    {
        macos::focus(id).map(|()| true)
    }
    #[cfg(target_os = "windows")]
    {
        win32::focus(id)
    }
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("NIRI_SOCKET").is_none() {
            return x11::focus(id).map(|()| true);
        }
        request(json!({"Action": {"FocusWindow": {"id": id}}}))?;
        Ok(true)
    }
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        let _ = id;
        Err("当前平台尚未提供原生窗口保护接口".into())
    }
}
/// Use the desktop's native activation interface for reminders and protection.
pub fn focus_own(own_pid: u32) -> AppResult<()> {
    let windows = windows()?;
    let own = windows
        .iter()
        .find(|w| w.pid == Some(own_pid) && !(cfg!(target_os = "macos") && w.id == 0))
        .ok_or("未找到番茄 Todo 的窗口")?;
    if own.is_focused {
        return Ok(());
    }
    if focus_window(own.id)? {
        Ok(())
    } else {
        Err("前台激活请求暂未完成".into())
    }
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
