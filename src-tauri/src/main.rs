#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod desktop;

use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_notification::NotificationExt;
use tomato_core::{guard, now, Action, AppResult, Engine, GuardMode, Mode, Snapshot};

type Shared = Arc<Mutex<Engine>>;
/// Show the window and ask niri to focus it. `set_focus` alone is a request the
/// compositor may ignore, so retry the IPC focus briefly while the window maps.
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
    apply_action(&app, &engine, action)
}
fn apply_action(app: &tauri::AppHandle, engine: &Shared, action: Action) -> AppResult<Snapshot> {
    let mut engine = engine.lock().map_err(|e| e.to_string())?;
    let current = engine.snapshot(now())?;
    let mut proposed = current.data.clone();
    proposed.apply(
        serde_json::from_value(serde_json::to_value(&action).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?,
        now(),
    )?;
    if !matches!(action, Action::EmergencyUnlock)
        && (proposed.protected()
            || proposed.lock.schedules.iter().any(|s| s.enabled)
            || (proposed.settings.protection.mode != GuardMode::Off
                && current.data.settings.protection.mode != proposed.settings.protection.mode))
    {
        guard::preflight(std::process::id())?;
    }
    let result = engine.dispatch(action, now())?;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_always_on_top(result.data.settings.always_on_top);
    }
    Ok(result)
}
#[tauri::command]
fn guard_info() -> guard::GuardInfo {
    guard::info()
}
#[tauri::command]
async fn export_data(
    app: tauri::AppHandle,
    engine: State<'_, Shared>,
    plan: Option<bool>,
) -> AppResult<bool> {
    let is_plan = plan.unwrap_or(false);
    let json = if is_plan {
        let data = engine
            .lock()
            .map_err(|e| e.to_string())?
            .snapshot(now())?
            .data;
        serde_json::to_string_pretty(&data.export_plan()).map_err(|e| e.to_string())?
    } else {
        engine.lock().map_err(|e| e.to_string())?.export(now())?
    };
    let path = app
        .dialog()
        .file()
        .add_filter(
            if is_plan {
                "JSON 学习计划"
            } else {
                "JSON 数据备份"
            },
            &["json"],
        )
        .set_file_name(if is_plan {
            "tomato-todo-plan.json"
        } else {
            "tomato-todo-backup.json"
        })
        .blocking_save_file();
    if let Some(path) = path {
        let path = path.into_path().map_err(|e| e.to_string())?;
        std::fs::write(path, json).map_err(|e| e.to_string())?;
        return Ok(true);
    }
    Ok(false)
}
#[tauri::command]
async fn read_import(
    app: tauri::AppHandle,
    plan: Option<bool>,
) -> AppResult<Option<serde_json::Value>> {
    let is_plan = plan.unwrap_or(false);
    let path = app
        .dialog()
        .file()
        .add_filter(
            if is_plan {
                "JSON 学习计划"
            } else {
                "JSON 数据备份"
            },
            &["json"],
        )
        .blocking_pick_file();
    if let Some(path) = path {
        let path = path.into_path().map_err(|e| e.to_string())?;
        if std::fs::metadata(&path).map_err(|e| e.to_string())?.len() > 20 * 1024 * 1024 {
            return Err("文件不能超过 20 MB".into());
        }
        let raw = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
        if is_plan {
            let data: tomato_core::plan::PlanFile =
                serde_json::from_str(&raw).map_err(|e| format!("计划格式错误：{e}"))?;
            data.validate()?;
            return serde_json::to_value(data)
                .map(Some)
                .map_err(|e| e.to_string());
        }
        let data: tomato_core::AppData =
            serde_json::from_str(&raw).map_err(|e| format!("备份格式错误：{e}"))?;
        data.validate()?;
        return serde_json::to_value(data)
            .map(Some)
            .map_err(|e| e.to_string());
    }
    Ok(None)
}

fn main() {
    // niri reports the native Wayland window's PID; Xwayland can report the
    // satellite's PID instead, preventing protection from finding this window.
    if std::env::var_os("NIRI_SOCKET").is_some() && std::env::var_os("WAYLAND_DISPLAY").is_some() {
        std::env::set_var("GDK_BACKEND", "wayland,x11");
    }
    let background = std::env::args().any(|arg| arg == "--background");
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _| {
            if args.iter().any(|arg| arg == "--background") {
                return;
            }
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            let path = std::env::var_os("TOMATO_DATA_PATH")
                .map(std::path::PathBuf::from)
                .unwrap_or(app.path().app_data_dir()?.join("tomato.sqlite3"));
            let mut engine = Engine::open(path).map_err(std::io::Error::other)?;
            let initial = engine.snapshot(now()).map_err(std::io::Error::other)?;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_always_on_top(initial.data.settings.always_on_top);
            }
            let engine = Arc::new(Mutex::new(engine));
            app.manage(engine.clone());
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
            guard_info,
            export_data,
            read_import,
            desktop::desktop_status,
            desktop::save_desktop_settings,
            desktop::hide_to_tray,
            desktop::show_main_window,
            desktop::quit_app
        ])
        .build(tauri::generate_context!())
        .expect("无法启动番茄 Todo")
        .run(|app, event| {
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
