//! System document pickers share validation across desktop paths and Android URIs.
use crate::Shared;
use tauri::State;
use tauri_plugin_dialog::DialogExt;
#[cfg(target_os = "android")]
use tauri_plugin_fs::FsExt;
use tomato_core::{now, AppResult};

#[tauri::command]
pub async fn save_agent_file(app: tauri::AppHandle, name: String, data: String) -> AppResult<bool> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    if name.is_empty()
        || name.chars().count() > 200
        || name
            .chars()
            .any(|c| c.is_control() || matches!(c, '/' | '\\' | ':'))
    {
        return Err("文件名无效".into());
    }
    if data.len() > 28 * 1024 * 1024 {
        return Err("导出文件最多 20 MB".into());
    }
    let bytes = STANDARD.decode(data).map_err(|_| "导出文件 Base64 无效")?;
    if bytes.len() > 20 * 1024 * 1024 {
        return Err("导出文件最多 20 MB".into());
    }
    let picker = app.dialog().file().set_file_name(&name);
    let path = tauri::async_runtime::spawn_blocking(move || picker.blocking_save_file())
        .await
        .map_err(|e| e.to_string())?;
    let Some(path) = path else {
        return Ok(false);
    };
    #[cfg(target_os = "android")]
    {
        use std::io::Write;
        let mut options = tauri_plugin_fs::OpenOptions::new();
        options.write(true).create(true).truncate(true);
        app.fs()
            .open(path, options)
            .map_err(|e| e.to_string())?
            .write_all(&bytes)
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "android"))]
    {
        let path = path.into_path().map_err(|e| e.to_string())?;
        tauri::async_runtime::spawn_blocking(move || std::fs::write(path, bytes))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| e.to_string())?;
    }
    Ok(true)
}

#[tauri::command]
pub async fn export_data(
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
    let picker = app
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
        });
    // Native pickers wait for user input. Keep that wait off the async worker
    // so mobile plugin dispatch and unrelated commands can keep progressing.
    let path = tauri::async_runtime::spawn_blocking(move || picker.blocking_save_file())
        .await
        .map_err(|e| e.to_string())?;
    if let Some(path) = path {
        #[cfg(target_os = "android")]
        {
            use std::io::Write;
            // SAF returns content:// URIs, which are not filesystem paths.
            let mut options = tauri_plugin_fs::OpenOptions::new();
            options.write(true).create(true).truncate(true);
            app.fs()
                .open(path, options)
                .map_err(|e| e.to_string())?
                .write_all(json.as_bytes())
                .map_err(|e| e.to_string())?;
        }
        #[cfg(not(target_os = "android"))]
        {
            let path = path.into_path().map_err(|e| e.to_string())?;
            std::fs::write(path, json).map_err(|e| e.to_string())?;
        }
        return Ok(true);
    }
    Ok(false)
}
#[tauri::command]
pub async fn read_import(
    app: tauri::AppHandle,
    plan: Option<bool>,
) -> AppResult<Option<serde_json::Value>> {
    let is_plan = plan.unwrap_or(false);
    let picker = app.dialog().file().add_filter(
        if is_plan {
            "JSON 学习计划"
        } else {
            "JSON 数据备份"
        },
        &["json"],
    );
    let path = tauri::async_runtime::spawn_blocking(move || picker.blocking_pick_file())
        .await
        .map_err(|e| e.to_string())?;
    if let Some(path) = path {
        #[cfg(target_os = "android")]
        let raw = {
            use std::io::Read;
            let mut options = tauri_plugin_fs::OpenOptions::new();
            options.read(true);
            let mut raw = String::new();
            app.fs()
                .open(path, options)
                .map_err(|e| e.to_string())?
                .take(20 * 1024 * 1024 + 1)
                .read_to_string(&mut raw)
                .map_err(|e| e.to_string())?;
            if raw.len() > 20 * 1024 * 1024 {
                return Err("文件不能超过 20 MB".into());
            }
            raw
        };
        #[cfg(not(target_os = "android"))]
        let raw = {
            let path = path.into_path().map_err(|e| e.to_string())?;
            if std::fs::metadata(&path).map_err(|e| e.to_string())?.len() > 20 * 1024 * 1024 {
                return Err("文件不能超过 20 MB".into());
            }
            std::fs::read_to_string(path).map_err(|e| e.to_string())?
        };
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

#[tauri::command]
pub async fn choose_project_directory(app: tauri::AppHandle) -> AppResult<Option<String>> {
    #[cfg(target_os = "android")]
    {
        let _ = app;
        Err("Android 尚不支持助手项目目录授权，请在桌面端设置".into())
    }
    #[cfg(not(target_os = "android"))]
    {
        let picker = app.dialog().file();
        let path = tauri::async_runtime::spawn_blocking(move || picker.blocking_pick_folder())
            .await
            .map_err(|e| e.to_string())?;
        path.map(|p| {
            p.into_path()
                .map(|p| p.to_string_lossy().into_owned())
                .map_err(|e| e.to_string())
        })
        .transpose()
    }
}
