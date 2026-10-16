//! Native desktop focus control without terminating or suspending other apps.
#[cfg(target_os = "macos")]
#[path = "guard_macos.rs"]
mod macos;
#[cfg(target_os = "linux")]
#[path = "guard_shell.rs"]
mod shell;
#[cfg(target_os = "linux")]
#[path = "guard_wayland.rs"]
mod wayland;
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
        match linux_backend() {
            LinuxBackend::Niri => {
                let reply = request(json!("Windows"))?;
                serde_json::from_value(reply["Windows"].clone()).map_err(|e| e.to_string())
            }
            LinuxBackend::Sway => wayland::sway_list(),
            LinuxBackend::Hyprland => wayland::hypr_list(),
            LinuxBackend::Gnome => shell::gnome_list(),
            LinuxBackend::KWin => shell::kwin_list(),
            LinuxBackend::X11 => x11::windows(),
            LinuxBackend::Unsupported => Err(
                "当前 Wayland 桌面尚无窗口接口，Xwayland 不能管控全部应用；已支持 niri、Sway、Hyprland、GNOME 扩展和 KDE KWin"
                    .into(),
            ),
        }
    }
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        Err("当前平台尚未提供原生窗口保护接口".into())
    }
}
#[cfg(target_os = "linux")]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum LinuxBackend {
    Niri,
    Sway,
    Hyprland,
    Gnome,
    KWin,
    X11,
    Unsupported,
}
#[cfg(target_os = "linux")]
fn linux_backend() -> LinuxBackend {
    let present = |name| std::env::var_os(name).is_some_and(|value| !value.is_empty());
    let desktop = std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default();
    select_linux_backend(
        present("NIRI_SOCKET"),
        present("SWAYSOCK"),
        present("HYPRLAND_INSTANCE_SIGNATURE"),
        present("WAYLAND_DISPLAY")
            || std::env::var("XDG_SESSION_TYPE").is_ok_and(|s| s.eq_ignore_ascii_case("wayland")),
        &desktop,
    )
}
#[cfg(target_os = "linux")]
fn select_linux_backend(
    niri: bool,
    sway: bool,
    hyprland: bool,
    wayland: bool,
    desktop: &str,
) -> LinuxBackend {
    if niri {
        return LinuxBackend::Niri;
    }
    if sway {
        return LinuxBackend::Sway;
    }
    if hyprland {
        return LinuxBackend::Hyprland;
    }
    if !wayland {
        return LinuxBackend::X11;
    }
    let desktop = desktop.to_ascii_lowercase();
    if desktop
        .split(':')
        .any(|d| matches!(d, "gnome" | "gnome-classic" | "ubuntu"))
    {
        return LinuxBackend::Gnome;
    }
    if desktop.split(':').any(|d| matches!(d, "kde" | "plasma")) {
        return LinuxBackend::KWin;
    }
    LinuxBackend::Unsupported
}
fn backend() -> &'static str {
    #[cfg(target_os = "linux")]
    {
        match linux_backend() {
            LinuxBackend::Niri => "niri / Wayland",
            LinuxBackend::Sway => "Sway / Wayland",
            LinuxBackend::Hyprland => "Hyprland / Wayland",
            LinuxBackend::Gnome => "GNOME Shell / Wayland",
            LinuxBackend::KWin => "KWin / Wayland",
            LinuxBackend::X11 => "EWMH / X11",
            LinuxBackend::Unsupported => "Wayland",
        }
    }
    #[cfg(target_os = "windows")]
    {
        "Win32 / Windows"
    }
    #[cfg(target_os = "macos")]
    {
        "Quartz / macOS Accessibility"
    }
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        "当前环境"
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
            backend: backend().into(),
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
/// Deferred native activation leaves protection running for the next check.
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
        match linux_backend() {
            LinuxBackend::Niri => {
                request(json!({"Action": {"FocusWindow": {"id": id}}}))?;
                Ok(true)
            }
            LinuxBackend::Sway => wayland::sway_focus(id),
            LinuxBackend::Hyprland => wayland::hypr_focus(id),
            LinuxBackend::Gnome => shell::gnome_focus(id),
            LinuxBackend::KWin => shell::kwin_focus(id),
            LinuxBackend::X11 => x11::focus(id).map(|()| true),
            LinuxBackend::Unsupported => Err("当前 Wayland 桌面尚无激活窗口接口".into()),
        }
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

#[cfg(all(test, target_os = "linux"))]
mod linux_tests {
    use super::*;
    #[test]
    fn compositor_selection_does_not_treat_unknown_wayland_as_x11() {
        assert_eq!(
            select_linux_backend(true, false, false, true, "GNOME"),
            LinuxBackend::Niri
        );
        assert_eq!(
            select_linux_backend(false, true, false, true, "sway"),
            LinuxBackend::Sway
        );
        assert_eq!(
            select_linux_backend(false, false, true, true, "Hyprland"),
            LinuxBackend::Hyprland
        );
        assert_eq!(
            select_linux_backend(false, false, false, true, "ubuntu:GNOME"),
            LinuxBackend::Gnome
        );
        assert_eq!(
            select_linux_backend(false, false, false, true, "KDE"),
            LinuxBackend::KWin
        );
        for desktop in [
            "GNOME",
            "KDE",
            "XFCE",
            "X-Cinnamon",
            "MATE",
            "LXQt",
            "Unity",
            "Budgie",
        ] {
            assert_eq!(
                select_linux_backend(false, false, false, false, desktop),
                LinuxBackend::X11
            );
        }
        assert_eq!(
            select_linux_backend(false, false, false, true, "unknown"),
            LinuxBackend::Unsupported
        );
    }
}
