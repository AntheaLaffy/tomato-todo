use gio::prelude::*;
use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
use tomato_core::{now, Action, AppResult, Mode, Snapshot};

const ENTRY: &str = "studio.tomato.todo.desktop";
const MANAGED: &str = "X-Tomato-Todo-Managed=true";

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Preferences {
    pub close_to_tray: bool,
}
impl Default for Preferences {
    fn default() -> Self {
        Self {
            close_to_tray: true,
        }
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub autostart: bool,
    pub close_to_tray: bool,
    pub tray_available: bool,
}
struct TrayItems {
    status: MenuItem<tauri::Wry>,
    toggle: MenuItem<tauri::Wry>,
    hide: MenuItem<tauri::Wry>,
    quit: MenuItem<tauri::Wry>,
}
pub struct DesktopState {
    preferences: Mutex<Preferences>,
    preferences_path: PathBuf,
    autostart_path: PathBuf,
    tray_created: AtomicBool,
    items: Mutex<Option<TrayItems>>,
}

fn config_home() -> AppResult<PathBuf> {
    if let Some(path) = std::env::var_os("XDG_CONFIG_HOME").filter(|p| !p.is_empty()) {
        let path = PathBuf::from(path);
        if path.is_absolute() {
            return Ok(path);
        }
    }
    std::env::var_os("HOME")
        .map(|p| PathBuf::from(p).join(".config"))
        .ok_or_else(|| "找不到用户配置目录".into())
}
fn atomic_write(path: &Path, content: &[u8]) -> AppResult<()> {
    std::fs::create_dir_all(path.parent().ok_or("无效配置路径")?).map_err(|e| e.to_string())?;
    let temporary = path.with_extension(format!("tmp-{}", std::process::id()));
    std::fs::write(&temporary, content).map_err(|e| e.to_string())?;
    std::fs::rename(&temporary, path).map_err(|e| e.to_string())
}
fn quote_exec(path: &Path) -> AppResult<String> {
    let raw = path.to_str().ok_or("程序路径必须是 UTF-8")?;
    if raw.contains(['\n', '\r', '\0']) {
        return Err("无效程序路径".into());
    }
    // Desktop-entry string escaping happens before Exec argument escaping.
    Ok(format!(
        "\"{}\"",
        raw.replace('\\', "\\\\\\\\")
            .replace('"', "\\\\\\\"")
            .replace('`', "\\\\`")
            .replace('$', "\\\\$")
            .replace('%', "%%")
    ))
}
fn autostart_entry(executable: &Path) -> AppResult<String> {
    Ok(format!("[Desktop Entry]\nType=Application\nName=番茄 Todo\nExec={} --background\nIcon=tomato-todo\nTerminal=false\nStartupNotify=false\n{}\n", quote_exec(executable)?, MANAGED))
}
fn set_autostart(path: &Path, enabled: bool, executable: &Path) -> AppResult<()> {
    if path.exists() {
        let existing = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
        if !existing.lines().any(|l| l == MANAGED) {
            return Err("已有同名自启动项来自其他程序，请先检查该文件".into());
        }
    }
    if enabled {
        atomic_write(path, autostart_entry(executable)?.as_bytes())
    } else if path.exists() {
        std::fs::remove_file(path).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

fn tray_host_available() -> bool {
    // A successfully created icon can still have no panel host. Never hide the
    // only window in that case, including when autostart precedes the shell.
    gio::DBusProxy::for_bus_sync(
        gio::BusType::Session,
        gio::DBusProxyFlags::DO_NOT_AUTO_START,
        None,
        "org.kde.StatusNotifierWatcher",
        "/StatusNotifierWatcher",
        "org.kde.StatusNotifierWatcher",
        gio::Cancellable::NONE,
    )
    .ok()
    .and_then(|p| p.cached_property("IsStatusNotifierHostRegistered"))
    .and_then(|v| v.get::<bool>())
    .unwrap_or(false)
}
pub fn tray_available(app: &tauri::AppHandle) -> bool {
    app.state::<DesktopState>()
        .tray_created
        .load(Ordering::Relaxed)
        && tray_host_available()
}
pub fn protected(app: &tauri::AppHandle) -> bool {
    app.state::<crate::Shared>()
        .lock()
        .ok()
        .and_then(|mut e| e.snapshot(now()).ok())
        .is_some_and(|s| s.data.protected())
}
pub fn show(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
pub fn close_to_tray(app: &tauri::AppHandle) -> bool {
    app.state::<DesktopState>()
        .preferences
        .lock()
        .map(|p| p.close_to_tray)
        .unwrap_or(false)
        && tray_available(app)
}
#[tauri::command]
pub fn desktop_status(app: tauri::AppHandle) -> AppResult<Status> {
    let native = app.state::<DesktopState>();
    let close_to_tray = native
        .preferences
        .lock()
        .map_err(|e| e.to_string())?
        .close_to_tray;
    let raw = std::fs::read_to_string(&native.autostart_path).unwrap_or_default();
    Ok(Status {
        autostart: raw.lines().any(|l| l == MANAGED) && !raw.lines().any(|l| l == "Hidden=true"),
        close_to_tray,
        tray_available: tray_available(&app),
    })
}
#[tauri::command]
pub fn save_desktop_settings(
    app: tauri::AppHandle,
    autostart: bool,
    close_to_tray: bool,
) -> AppResult<Status> {
    if protected(&app) {
        return Err("专注保护中，暂时不能修改桌面设置".into());
    }
    let native = app.state::<DesktopState>();
    let executable = std::env::current_exe().map_err(|e| e.to_string())?;
    let mut preferences = native.preferences.lock().map_err(|e| e.to_string())?;
    let old = serde_json::to_vec(&*preferences).map_err(|e| e.to_string())?;
    let next = Preferences { close_to_tray };
    atomic_write(
        &native.preferences_path,
        &serde_json::to_vec(&next).map_err(|e| e.to_string())?,
    )?;
    if let Err(error) = set_autostart(&native.autostart_path, autostart, &executable) {
        let _ = atomic_write(&native.preferences_path, &old);
        return Err(error);
    }
    *preferences = next;
    drop(preferences);
    desktop_status(app)
}
#[tauri::command]
pub fn hide_to_tray(app: tauri::AppHandle) -> AppResult<()> {
    if protected(&app) {
        return Err("专注保护中，暂时不能隐藏窗口".into());
    }
    if !tray_available(&app) {
        return Err("当前桌面没有可用托盘，窗口将保持显示".into());
    }
    app.get_webview_window("main")
        .ok_or("找不到主窗口")?
        .hide()
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn show_main_window(app: tauri::AppHandle) {
    show(&app);
}
#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) -> AppResult<()> {
    if protected(&app) {
        return Err("专注保护中，暂时不能退出应用；严格模式需等待结束".into());
    }
    record_exit(&app);
    app.exit(0);
    Ok(())
}
pub fn record_exit(app: &tauri::AppHandle) {
    if let Ok(mut engine) = app.state::<crate::Shared>().lock() {
        let _ = engine.dispatch(Action::ResetTimer, now());
    }
}
fn menu_action(app: &tauri::AppHandle, id: &str) -> AppResult<()> {
    match id {
        "show" => {
            show(app);
            Ok(())
        }
        "hide" => hide_to_tray(app.clone()),
        "quit" => quit_app(app.clone()),
        "toggle" => {
            let engine = app.state::<crate::Shared>();
            let running = engine
                .lock()
                .map_err(|e| e.to_string())?
                .snapshot(now())?
                .data
                .timer
                .running;
            crate::apply_action(
                app,
                &engine,
                if running {
                    Action::PauseTimer
                } else {
                    Action::StartTimer
                },
                None,
            )?;
            Ok(())
        }
        _ => Ok(()),
    }
}
pub fn update_tray(app: &tauri::AppHandle, snapshot: &Snapshot) {
    let native = app.state::<DesktopState>();
    let Ok(items) = native.items.lock() else {
        return;
    };
    let Some(items) = items.as_ref() else {
        return;
    };
    let mode = match snapshot.data.timer.mode {
        Mode::Focus => "专注",
        Mode::ShortBreak => "短休息",
        Mode::LongBreak => "长休息",
    };
    let seconds = snapshot.remaining_secs;
    let _ = items.status.set_text(format!(
        "{} · {:02}:{:02}",
        mode,
        seconds / 60,
        seconds % 60
    ));
    let _ = items.toggle.set_text(if snapshot.data.timer.running {
        "暂停计时"
    } else {
        "开始计时"
    });
    let enabled = !snapshot.data.protected();
    let _ = items.toggle.set_enabled(enabled);
    let _ = items.hide.set_enabled(enabled);
    let _ = items.quit.set_enabled(enabled);
}
pub fn setup(app: &tauri::AppHandle, background: bool) -> AppResult<()> {
    let config = config_home()?;
    let preferences_path = config.join("studio.tomato.todo/desktop.json");
    let preferences = std::fs::read_to_string(&preferences_path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default();
    app.manage(DesktopState {
        preferences: Mutex::new(preferences),
        preferences_path,
        autostart_path: config.join("autostart").join(ENTRY),
        tray_created: AtomicBool::new(false),
        items: Mutex::new(None),
    });
    let create_tray = || -> tauri::Result<()> {
        let status = MenuItem::with_id(app, "status", "番茄 Todo", false, None::<&str>)?;
        let open = MenuItem::with_id(app, "show", "打开番茄 Todo", true, None::<&str>)?;
        let toggle = MenuItem::with_id(app, "toggle", "开始计时", true, None::<&str>)?;
        let hide = MenuItem::with_id(app, "hide", "收起到托盘", true, None::<&str>)?;
        let quit = MenuItem::with_id(app, "quit", "退出番茄 Todo", true, None::<&str>)?;
        let separator = PredefinedMenuItem::separator(app)?;
        let menu = Menu::with_items(app, &[&status, &separator, &open, &toggle, &hide, &quit])?;
        let mut builder = TrayIconBuilder::with_id("tomato-tray")
            .menu(&menu)
            .title("番茄 Todo")
            .on_menu_event(|app, event| {
                if let Err(error) = menu_action(app, event.id.as_ref()) {
                    show(app);
                    let _ = app.emit("desktop-error", error);
                }
            });
        if let Some(icon) = app.default_window_icon() {
            builder = builder.icon(icon.clone());
        }
        builder.build(app)?;
        let native = app.state::<DesktopState>();
        *native.items.lock().unwrap() = Some(TrayItems {
            status,
            toggle,
            hide,
            quit,
        });
        native.tray_created.store(true, Ordering::Relaxed);
        Ok(())
    };
    // The upstream indicator binding panics when its dynamically loaded Linux
    // library is absent; check before entering it so the main window still works.
    let indicator_available = ["libayatana-appindicator3.so.1", "libappindicator3.so.1"]
        .iter()
        .any(|name| unsafe { libloading::Library::new(name) }.is_ok());
    if !indicator_available {
        eprintln!("未安装 AppIndicator 运行库，保留主窗口");
    } else if let Err(error) = create_tray() {
        eprintln!("托盘不可用，保留主窗口：{error}");
    }
    if !background || protected(app) {
        show(app);
    } else {
        let handle = app.clone();
        std::thread::spawn(move || {
            for _ in 0..20 {
                if tray_available(&handle) && !protected(&handle) {
                    return;
                }
                std::thread::sleep(std::time::Duration::from_millis(500));
            }
            show(&handle);
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn autostart_roundtrip_preserves_unrelated_files() {
        let dir = std::env::temp_dir().join(format!("tomato-desktop-unit-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(ENTRY);
        let executable = Path::new("/tmp/My Tomato/100%/tomato-todo");
        set_autostart(&path, true, executable).unwrap();
        let raw = std::fs::read_to_string(&path).unwrap();
        assert!(raw.contains("Exec=\"/tmp/My Tomato/100%%/tomato-todo\" --background"));
        set_autostart(&path, true, executable).unwrap();
        set_autostart(&path, false, executable).unwrap();
        assert!(!path.exists());
        std::fs::write(&path, "[Desktop Entry]\nName=Other\n").unwrap();
        assert!(set_autostart(&path, false, executable).is_err());
        assert!(set_autostart(&path, true, executable).is_err());
        assert!(quote_exec(Path::new("/tmp/bad\ncommand")).is_err());
        std::fs::remove_dir_all(dir).unwrap();
    }
}
