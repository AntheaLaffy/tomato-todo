//! Desktop resource export copies directly between files, regardless of preview size.
use std::sync::Arc;
use tauri::State;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use tomato_core::AppResult;

#[tauri::command]
pub async fn save_project_resource(
    app: tauri::AppHandle,
    service: State<'_, Arc<tomato_agent::Agent>>,
    resource_id: String,
) -> AppResult<bool> {
    let file = service.project_resource_file(&resource_id)?;
    let picker = app.dialog().file().set_file_name(&file.name);
    let target = tauri::async_runtime::spawn_blocking(move || picker.blocking_save_file())
        .await
        .map_err(|e| e.to_string())?;
    let Some(target) = target else {
        return Ok(false);
    };
    let target = target.into_path().map_err(|e| e.to_string())?;
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        // Recheck the grant after the user has chosen a destination.
        service.copy_project_resource(&resource_id, &target)?;
        Ok(true)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub fn open_project_resource(
    app: tauri::AppHandle,
    service: State<'_, Arc<tomato_agent::Agent>>,
    resource_id: String,
) -> AppResult<()> {
    let file = service.project_resource_file(&resource_id)?;
    app.opener()
        .open_path(file.path.to_string_lossy(), None::<&str>)
        .map_err(|e| e.to_string())
}
