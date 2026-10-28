//! Android host for the shared local core. System services are added here,
//! independently of desktop tray/autostart and its subprocess-based assistant.
use crate::{files, Shared};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, State};
use tomato_core::{guard, now, Action, AppResult, Engine, Snapshot};

#[tauri::command]
fn snapshot(engine: State<Shared>) -> AppResult<Snapshot> {
    engine.lock().map_err(|e| e.to_string())?.snapshot(now())
}

#[tauri::command]
fn dispatch(action: Action, engine: State<Shared>) -> AppResult<Snapshot> {
    let mut engine = engine.lock().map_err(|e| e.to_string())?;
    let current = engine.snapshot(now())?;
    crate::preflight_action(&current.data, &action)?;
    tomato_core::check_user_action(&action)?;
    engine.dispatch(action, now())
}

#[tauri::command]
fn guard_info() -> guard::GuardInfo {
    guard::info()
}

#[tauri::command]
fn agent_call(request: serde_json::Value) -> AppResult<serde_json::Value> {
    let _ = request;
    Err("Android 学习助手运行时尚未接入".into())
}

#[tauri::command]
fn agent_open_login() -> AppResult<()> {
    Err("Android 学习助手运行时尚未接入".into())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let path = app.path().app_data_dir()?.join("tomato.sqlite3");
            let mut engine = Engine::open(path).map_err(std::io::Error::other)?;
            let initial = engine.snapshot(now()).map_err(std::io::Error::other)?;
            let engine = Arc::new(Mutex::new(engine));
            app.manage(engine.clone());
            let handle = app.handle().clone();
            let mut serial = initial.data.timer.completion_serial;
            std::thread::spawn(move || loop {
                std::thread::sleep(std::time::Duration::from_millis(600));
                let snapshot = engine.lock().ok().and_then(|mut e| e.snapshot(now()).ok());
                let Some(s) = snapshot else { continue };
                if s.data.timer.completion_serial != serial {
                    serial = s.data.timer.completion_serial;
                    let _ = handle.emit("phase-finished", ());
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            snapshot,
            dispatch,
            guard_info,
            agent_call,
            agent_open_login,
            files::export_data,
            files::read_import,
            files::save_agent_file,
            files::choose_project_directory,
            crate::platform_kind
        ])
        .run(tauri::generate_context!())
        .expect("无法启动番茄 Todo");
}
