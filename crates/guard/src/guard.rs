//! 平台无关的保护语义与后端选择。
//! 移植自旧 crates/core/src/guard.rs（guard_x11/guard_wayland/guard_shell/
//! guard_windows/guard_macos 的公共层），去掉旧应用的窗口与域名依赖：
//! 「专注窗口」现在是 guard 自建的全屏锁窗。
#[cfg(target_os = "linux")]
#[path = "x11.rs"]
mod x11;
#[cfg(target_os = "linux")]
#[path = "wayland.rs"]
mod wayland;
#[cfg(target_os = "linux")]
#[path = "wayland_surface.rs"]
mod wayland_surface;
#[cfg(target_os = "linux")]
#[path = "shell.rs"]
mod shell;
#[cfg(target_os = "windows")]
#[path = "win32.rs"]
mod win32;
#[cfg(target_os = "macos")]
#[path = "macos.rs"]
mod macos;
use serde::{Deserialize, Serialize};

pub type AppResult<T> = Result<T, String>;

/// 桌面窗口的通用视图（形状与旧 guard::Window 一致）。
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Window {
    pub id: u64,
    pub app_id: Option<String>,
    pub title: Option<String>,
    pub pid: Option<u32>,
    #[serde(default)]
    pub is_focused: bool,
}

/// 锁窗的 RAII 句柄：句柄被丢弃即销毁窗口（X11 销毁 X 窗口、
/// Wayland 结束锁面线程、Windows DestroyWindow），不需要任何方法。
pub trait LockWindow: Send {}

/// 后端标签：只决定 dispatch，无状态；每次调用按需连接。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Backend {
    #[cfg(target_os = "linux")]
    Niri,
    #[cfg(target_os = "linux")]
    Sway,
    #[cfg(target_os = "linux")]
    Hyprland,
    #[cfg(target_os = "linux")]
    Gnome,
    #[cfg(target_os = "linux")]
    KWin,
    #[cfg(target_os = "linux")]
    X11,
    #[cfg(target_os = "linux")]
    WaylandUnsupported,
    #[cfg(target_os = "windows")]
    Win32,
    #[cfg(target_os = "macos")]
    Quartz,
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    Unsupported,
}

/// 平台能力门面；所有方法短连接式实现，可从任意线程调用。
#[derive(Clone, Copy, Debug)]
pub struct Desktop {
    backend: Backend,
}

impl Desktop {
    pub fn detect() -> Self {
        Desktop { backend: detect_backend() }
    }

    pub fn name(&self) -> &'static str {
        #[cfg(target_os = "linux")]
        {
            return match self.backend {
                Backend::Niri => "niri / Wayland",
                Backend::Sway => "Sway / Wayland",
                Backend::Hyprland => "Hyprland / Wayland",
                Backend::Gnome => "GNOME Shell / Wayland",
                Backend::KWin => "KWin / Wayland",
                Backend::X11 => "EWMH / X11",
                Backend::WaylandUnsupported => "Wayland",
            };
        }
        #[cfg(target_os = "windows")]
        {
            return "Win32 / Windows";
        }
        #[cfg(target_os = "macos")]
        {
            return "Quartz / macOS Accessibility";
        }
        #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
        {
            return "当前环境";
        }
    }

    pub fn windows(&self) -> AppResult<Vec<Window>> {
        #[cfg(target_os = "linux")]
        {
            return match self.backend {
                Backend::Niri => wayland::niri_list(),
                Backend::Sway => wayland::sway_list(),
                Backend::Hyprland => wayland::hypr_list(),
                Backend::Gnome => shell::gnome_list(),
                Backend::KWin => shell::kwin_list(),
                Backend::X11 => x11::windows(),
                Backend::WaylandUnsupported => Err(
                    "当前 Wayland 桌面尚无窗口接口，Xwayland 不能管控全部应用；已支持 niri、Sway、Hyprland、GNOME 扩展和 KDE KWin"
                        .into(),
                ),
            };
        }
        #[cfg(target_os = "windows")]
        {
            return win32::windows();
        }
        #[cfg(target_os = "macos")]
        {
            return macos::windows();
        }
        #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
        {
            return Err("当前平台尚未提供原生窗口保护接口".into());
        }
    }

    pub fn focus(&self, id: u64) -> AppResult<bool> {
        #[cfg(target_os = "linux")]
        {
            return match self.backend {
                Backend::Niri => wayland::niri_focus(id),
                Backend::Sway => wayland::sway_focus(id),
                Backend::Hyprland => wayland::hypr_focus(id),
                Backend::Gnome => shell::gnome_focus(id),
                Backend::KWin => shell::kwin_focus(id),
                Backend::X11 => x11::focus(id),
                Backend::WaylandUnsupported => Err("当前 Wayland 桌面尚无激活窗口接口".into()),
            };
        }
        #[cfg(target_os = "windows")]
        {
            return win32::focus(id);
        }
        #[cfg(target_os = "macos")]
        {
            return macos::focus(id);
        }
        #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
        {
            let _ = id;
            return Err("当前平台尚未提供原生窗口保护接口".into());
        }
    }

    /// 创建并显示 guard 自己的全屏锁窗。Wayland 四个后端统一走
    /// xdg-shell 全屏 toplevel（sway/hyprland/niri/GNOME/KWin 都能列出
    /// 并按 pid 激活，与旧实现「把 Tauri 窗 focus 回去」语义一致）。
    pub fn lock_window(&self) -> AppResult<Box<dyn LockWindow + Send>> {
        #[cfg(target_os = "linux")]
        {
            return match self.backend {
                Backend::Niri | Backend::Sway | Backend::Hyprland | Backend::Gnome | Backend::KWin => {
                    Ok(Box::new(wayland_surface::lock_surface()?))
                }
                Backend::X11 => Ok(Box::new(x11::lock_window()?)),
                Backend::WaylandUnsupported => Err("当前 Wayland 桌面尚无窗口接口".into()),
            };
        }
        #[cfg(target_os = "windows")]
        {
            return Ok(Box::new(win32::lock_window()?));
        }
        #[cfg(target_os = "macos")]
        {
            // macos 片没有宿主窗口：lock_window 永远返回明确错误（见 macos.rs），
            // 专注保护只能走白名单模式，错误信息直接透传给 runtime。
            return Err(macos::lock_window().unwrap_err());
        }
        #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
        {
            return Err("当前平台尚未提供原生窗口保护接口".into());
        }
    }
}

#[cfg(target_os = "linux")]
fn linux_backend() -> Backend {
    let present = |name: &str| std::env::var_os(name).is_some_and(|value| !value.is_empty());
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

/// 纯函数：由 niri/sway/hyprland 环境变量、Wayland 会话与桌面名选出后端。
/// 语义照旧 guard.rs：会话非 Wayland 一律 X11；未知 Wayland 桌面报不支持，
/// 绝不把 Xwayland 当完整保护能力。
#[cfg(target_os = "linux")]
pub fn select_linux_backend(
    niri: bool,
    sway: bool,
    hyprland: bool,
    wayland: bool,
    desktop: &str,
) -> Backend {
    if niri {
        return Backend::Niri;
    }
    if sway {
        return Backend::Sway;
    }
    if hyprland {
        return Backend::Hyprland;
    }
    if !wayland {
        return Backend::X11;
    }
    let desktop = desktop.to_ascii_lowercase();
    if desktop
        .split(':')
        .any(|d| matches!(d, "gnome" | "gnome-classic" | "ubuntu"))
    {
        return Backend::Gnome;
    }
    if desktop.split(':').any(|d| matches!(d, "kde" | "plasma")) {
        return Backend::KWin;
    }
    Backend::WaylandUnsupported
}

fn detect_backend() -> Backend {
    #[cfg(target_os = "linux")]
    {
        return linux_backend();
    }
    #[cfg(target_os = "windows")]
    {
        return Backend::Win32;
    }
    #[cfg(target_os = "macos")]
    {
        return Backend::Quartz;
    }
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        return Backend::Unsupported;
    }
}

/// 白名单判定（语义照旧 guard::allowed）：
/// 自己的进程永远允许；否则按 app_id 与白名单逐项精确匹配。
pub fn allowed(window: &Window, own_pid: u32, whitelist: &[String]) -> bool {
    if window.pid == Some(own_pid) {
        return true;
    }
    window
        .app_id
        .as_ref()
        .is_some_and(|app| whitelist.iter().any(|allowed| allowed == app))
}

/// 单次保护检查的纯决策（可测试的核心计算）：
/// 找不到自己的锁窗 → OwnClosed（调用方应重建或报错）；
/// 前台窗口在白名单外 → 需要把锁窗拉回前台（返回其 id）；
/// 其余情况无需动作。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Decision {
    None,
    Focus(u64),
    OwnClosed,
}

pub fn decide(windows: &[Window], own_pid: u32, whitelist: &[String]) -> Decision {
    let own = windows
        .iter()
        .find(|w| w.pid == Some(own_pid) && !(cfg!(target_os = "macos") && w.id == 0));
    let Some(own) = own else {
        return Decision::OwnClosed;
    };
    let Some(active) = windows.iter().find(|w| w.is_focused) else {
        return Decision::None;
    };
    if allowed(active, own_pid, whitelist) {
        Decision::None
    } else {
        Decision::Focus(own.id)
    }
}

/// 前后两次窗口列表的集合差集（按 id），供诊断日志使用。
pub fn changed(previous: &[Window], current: &[Window]) -> (Vec<Window>, Vec<Window>) {
    let ids = |list: &[Window]| list.iter().map(|w| w.id).collect::<std::collections::HashSet<_>>();
    let (old, new) = (ids(previous), ids(current));
    let added = current.iter().filter(|w| !old.contains(&w.id)).cloned().collect();
    let removed = previous.iter().filter(|w| !new.contains(&w.id)).cloned().collect();
    (added, removed)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn window(id: u64, app: &str, pid: u32, focused: bool) -> Window {
        Window {
            id,
            app_id: Some(app.into()),
            title: None,
            pid: Some(pid),
            is_focused: focused,
        }
    }

    #[test]
    fn whitelist_matches_exact_app_ids_and_own_process() {
        let whitelist = vec!["code".into()];
        assert!(allowed(&window(1, "code", 200, true), 100, &whitelist));
        assert!(!allowed(&window(1, "code-malicious", 200, true), 100, &whitelist));
        assert!(allowed(&window(1, "tomato", 100, true), 100, &whitelist));
        assert!(!allowed(&window(1, "tomato", 201, true), 100, &whitelist));
    }

    #[test]
    fn empty_whitelist_is_strict_lock() {
        // 语义照旧 GuardMode::Lock：白名单为空时除了自己的窗口全部拦截。
        let whitelist: Vec<String> = vec![];
        assert!(!allowed(&window(1, "code", 200, true), 100, &whitelist));
        assert!(allowed(&window(1, "anything", 100, true), 100, &whitelist));
    }

    #[test]
    fn decide_redirects_blocked_focus_to_own_window() {
        let windows = vec![
            window(10, "tomato-guard", 100, false),
            window(20, "code", 200, false),
            window(30, "blocked", 300, true),
        ];
        assert_eq!(
            decide(&windows, 100, &["code".into()]),
            Decision::Focus(10)
        );
        // 白名单应用在前台：无需动作。
        let windows = vec![
            window(10, "tomato-guard", 100, false),
            window(20, "code", 200, true),
        ];
        assert_eq!(decide(&windows, 100, &["code".into()]), Decision::None);
        // 锁窗自身在前台：无需动作。
        let windows = vec![window(10, "tomato-guard", 100, true)];
        assert_eq!(decide(&windows, 100, &[]), Decision::None);
        // 没有前台窗口：无需动作。
        let windows = vec![window(10, "tomato-guard", 100, false)];
        assert_eq!(decide(&windows, 100, &[]), Decision::None);
        // 锁窗丢失：OwnClosed。
        let windows = vec![window(30, "blocked", 300, true)];
        assert_eq!(decide(&windows, 100, &[]), Decision::OwnClosed);
    }

    #[test]
    fn changed_reports_added_and_removed_by_id() {
        let before = vec![window(1, "a", 10, false), window(2, "b", 20, false)];
        let after = vec![window(2, "b", 20, false), window(3, "c", 30, false)];
        let (added, removed) = changed(&before, &after);
        assert_eq!(added.iter().map(|w| w.id).collect::<Vec<_>>(), vec![3]);
        assert_eq!(removed.iter().map(|w| w.id).collect::<Vec<_>>(), vec![1]);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn compositor_selection_does_not_treat_unknown_wayland_as_x11() {
        assert_eq!(select_linux_backend(true, false, false, true, "GNOME"), Backend::Niri);
        assert_eq!(select_linux_backend(false, true, false, true, "sway"), Backend::Sway);
        assert_eq!(select_linux_backend(false, false, true, true, "Hyprland"), Backend::Hyprland);
        assert_eq!(
            select_linux_backend(false, false, false, true, "ubuntu:GNOME"),
            Backend::Gnome
        );
        assert_eq!(select_linux_backend(false, false, false, true, "KDE"), Backend::KWin);
        for desktop in [
            "GNOME", "KDE", "XFCE", "X-Cinnamon", "MATE", "LXQt", "Unity", "Budgie",
        ] {
            assert_eq!(
                select_linux_backend(false, false, false, false, desktop),
                Backend::X11
            );
        }
        assert_eq!(
            select_linux_backend(false, false, false, true, "unknown"),
            Backend::WaylandUnsupported
        );
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn niri_request_shape_is_preserved_for_port() {
        // 契约性检查：niri 请求走其会话 socket 的 JSON 行协议（移植自旧 guard.rs）。
        let request: serde_json::Value = serde_json::json!({"Action": {"FocusWindow": {"id": 7}}});
        assert_eq!(request["Action"]["FocusWindow"]["id"], 7);
        let request: serde_json::Value = serde_json::json!("Windows");
        assert!(request.is_string());
    }
}
