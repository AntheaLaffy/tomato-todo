use crate::{desktop, files, Shared};

use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, State};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;
use tomato_core::{guard, now, Action, AppResult, Engine, GuardMode, Mode, Snapshot};

/// Show the window and use the desktop activation interface. Retry briefly
/// while the window maps, since plain focus requests may be ignored.
fn refocus(handle: &tauri::AppHandle) {
    desktop::show(handle);
    std::thread::spawn(|| {
        for _ in 0..8 {
            if guard::focus_own(std::process::id()).is_ok() {
                return;
            }
            std::thread::sleep(std::time::Duration::from_millis(120));
        }
    });
}
#[tauri::command]
fn snapshot(engine: State<Shared>) -> AppResult<Snapshot> {
    engine.lock().map_err(|e| e.to_string())?.snapshot(now())
}
#[tauri::command]
fn dispatch(action: Action, app: tauri::AppHandle, engine: State<Shared>) -> AppResult<Snapshot> {
    apply_action(&app, &engine, action, None)
}
pub(crate) fn apply_action(
    app: &tauri::AppHandle,
    engine: &Shared,
    action: Action,
    expected: Option<String>,
) -> AppResult<Snapshot> {
    let mut engine = engine.lock().map_err(|e| e.to_string())?;
    let current = engine.snapshot(now())?;
    if let Some(expected) = expected {
        if !current.data.reminder_idle()
            || tomato_agent::files::fingerprint(&current.data)? != expected
        {
            return Err("数据已变化或计时已启动，请重新审阅".into());
        }
    }
    crate::preflight_action(&current.data, &action)?;
    let result = engine.dispatch(action, now())?;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_always_on_top(result.data.settings.always_on_top);
    }
    Ok(result)
}
#[tauri::command]
async fn agent_call(
    request: serde_json::Value,
    service: State<'_, Arc<tomato_agent::Agent>>,
) -> AppResult<serde_json::Value> {
    // Quota and worker replies can wait on network I/O; keep the window thread free.
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.request(request))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
fn agent_open_login(
    app: tauri::AppHandle,
    service: State<Arc<tomato_agent::Agent>>,
) -> AppResult<()> {
    let status = service.status()?;
    let url = status["authEvent"]["url"]
        .as_str()
        .ok_or("当前没有登录链接")?;
    if !url.starts_with("https://auth.openai.com/") {
        return Err("登录链接不是官方认证域名".into());
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn guard_info() -> guard::GuardInfo {
    guard::info()
}

pub fn run() {
    // Resolve the bundled agent the same way the app does before the Tauri
    // context exists, so the `--mcp` entry works from a system install where
    // resources live in /usr/lib/<product name> instead of next to the binary.
    let context = tauri::generate_context!();
    let resource_dir =
        tauri::utils::platform::resource_dir(context.package_info(), &tauri::utils::Env::default())
            .ok();
    tomato_agent::mcp_entry(resource_dir.as_deref());
    // niri reports the native Wayland window's PID; Xwayland can report the
    // satellite's PID instead, preventing protection from finding this window.
    if std::env::var_os("NIRI_SOCKET").is_some() && std::env::var_os("WAYLAND_DISPLAY").is_some() {
        std::env::set_var("GDK_BACKEND", "wayland,x11");
    }
    let background = std::env::args().any(|arg| arg == "--background");
    let builder =
        tauri::Builder::default().plugin(tauri_plugin_single_instance::init(|app, args, _| {
            if args.iter().any(|arg| arg == "--background") {
                return;
            }
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }));
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    let builder = builder.plugin(tauri_plugin_autostart::init(
        tauri_plugin_autostart::MacosLauncher::LaunchAgent,
        Some(vec!["--background"]),
    ));
    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            let path = std::env::var_os("TOMATO_DATA_PATH")
                .map(std::path::PathBuf::from)
                .unwrap_or(app.path().app_data_dir()?.join("tomato.sqlite3"));
            let agent_dir = path
                .parent()
                .unwrap_or(std::path::Path::new("."))
                .join("agent");
            let mut engine = Engine::open(path).map_err(std::io::Error::other)?;
            let initial = engine.snapshot(now()).map_err(std::io::Error::other)?;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_always_on_top(initial.data.settings.always_on_top);
            }
            let engine = Arc::new(Mutex::new(engine));
            app.manage(engine.clone());
            let action_engine = engine.clone();
            let action_handle = app.handle().clone();
            let wake_handle = app.handle().clone();
            let resources = tomato_agent::resources(
                &std::env::current_exe()?,
                Some(&app.path().resource_dir()?),
            );
            let service = tomato_agent::Agent::open(
                engine.clone(),
                agent_dir,
                resources,
                Arc::new(move |action, expected| {
                    apply_action(&action_handle, &action_engine, action, expected)
                }),
                Arc::new(move || {
                    refocus(&wake_handle);
                    let _ = wake_handle.emit("agent-wake", ());
                }),
            )
            .map_err(std::io::Error::other)?;
            app.manage(service.clone());
            desktop::setup(app.handle(), background).map_err(std::io::Error::other)?;
            let handle = app.handle().clone();
            let mut serial = initial.data.timer.completion_serial;
            let mut reminded: Option<String> = None;
            let mut locked = false;
            let mut was_protected = false;
            std::thread::spawn(move || loop {
                std::thread::sleep(std::time::Duration::from_millis(600));
                let snapshot = engine.lock().ok().and_then(|mut e| e.snapshot(now()).ok());
                let Some(s) = snapshot else {
                    continue;
                };
                let _ = service.observe(&s);
                let pending = s
                    .data
                    .pending_reminder()
                    .map(|t| format!("{}/{:?}/{:?}", t.id, t.due_date, t.reminder_time));
                if pending != reminded {
                    if let Some(t) = s.data.pending_reminder() {
                        refocus(&handle);
                        if s.data.settings.notifications {
                            let _ = handle
                                .notification()
                                .builder()
                                .title("任务到时间了")
                                .body(&t.title)
                                .show();
                        }
                    }
                    reminded = pending;
                }
                desktop::update_tray(&handle, &s);
                let protect = s.data.protected();
                let entering = protect && !was_protected;
                was_protected = protect;
                if entering {
                    desktop::show(&handle);
                }
                let fullscreen = s.data.lock.active.is_some()
                    || (protect && s.data.settings.protection.mode == GuardMode::Lock);
                if fullscreen != locked {
                    if let Some(w) = handle.get_webview_window("main") {
                        let _ = w.set_fullscreen(fullscreen);
                    }
                    locked = fullscreen;
                }
                // Showing a tray window is asynchronous; give niri one tick to discover it.
                if protect && !entering {
                    let protection = if s.data.lock.active.is_some() {
                        tomato_core::Protection {
                            mode: GuardMode::Lock,
                            ..Default::default()
                        }
                    } else {
                        let mut protection = s.data.settings.protection.clone();
                        protection.whitelist = s.data.effective_whitelist();
                        protection
                    };
                    match guard::enforce(&protection, std::process::id()) {
                        Ok(true) => {
                            let _ = handle.emit("distraction-blocked", ());
                        }
                        Err(error) => {
                            if let Ok(mut e) = engine.lock() {
                                let _ = e.release_failed_protection(now());
                            }
                            let _ = handle.emit("protection-error", error);
                        }
                        _ => {}
                    }
                }
                if s.data.timer.completion_serial != serial {
                    serial = s.data.timer.completion_serial;
                    // A finished focus or break is exactly when the next decision is
                    // made, so bring the window back instead of only notifying.
                    refocus(&handle);
                    let body = if s.data.timer.last_finished_mode == Some(Mode::Focus) {
                        "又完成了一个番茄。起身活动一下，休息也很重要。"
                    } else {
                        "休息结束，准备好开始下一段专注了吗？"
                    };
                    if s.data.settings.notifications {
                        let _ = handle
                            .notification()
                            .builder()
                            .title("番茄 Todo")
                            .body(body)
                            .show();
                    }
                    let _ = handle.emit("phase-finished", body);
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let shared = window.state::<Shared>();
                let protected = shared
                    .lock()
                    .ok()
                    .and_then(|mut e| e.snapshot(now()).ok())
                    .is_some_and(|s| s.data.protected());
                if protected {
                    api.prevent_close();
                    let _ = window.emit("close-blocked", ());
                } else if desktop::close_to_tray(window.app_handle()) {
                    api.prevent_close();
                    let _ = window.hide();
                } else {
                    desktop::record_exit(window.app_handle());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            snapshot,
            dispatch,
            agent_call,
            agent_open_login,
            guard_info,
            files::export_data,
            files::read_import,
            files::save_agent_file,
            crate::platform_kind,
            desktop::desktop_status,
            desktop::save_desktop_settings,
            desktop::hide_to_tray,
            desktop::show_main_window,
            desktop::quit_app
        ])
        .build(context)
        .expect("无法启动番茄 Todo")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                if let Some(service) = app.try_state::<Arc<tomato_agent::Agent>>() {
                    service.shutdown();
                }
            }
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                if desktop::protected(app) {
                    api.prevent_exit();
                    desktop::show(app);
                    let _ = app.emit("close-blocked", ());
                } else {
                    desktop::record_exit(app);
                }
            }
        });
}
