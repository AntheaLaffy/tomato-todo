//! Native entry points share the persisted core and system document commands.
use std::sync::{Arc, Mutex};
use tomato_core::{guard, now, Action, AppData, AppResult, Engine, GuardMode};

pub(crate) type Shared = Arc<Mutex<Engine>>;
#[cfg(not(target_os = "android"))]
mod desktop;
#[cfg(not(target_os = "android"))]
mod desktop_app;
mod files;
#[cfg(target_os = "android")]
mod mobile;

fn preflight_action(current: &AppData, action: &Action) -> AppResult<()> {
    let mut proposed = current.clone();
    proposed.apply(
        serde_json::from_value(serde_json::to_value(action).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?,
        now(),
    )?;
    if !matches!(action, Action::EmergencyUnlock)
        && (proposed.protected()
            || proposed.lock.schedules.iter().any(|s| s.enabled)
            || (proposed.settings.protection.mode != GuardMode::Off
                && current.settings.protection.mode != proposed.settings.protection.mode))
    {
        guard::preflight(std::process::id())?;
    }
    Ok(())
}

#[tauri::command]
fn platform_kind() -> &'static str {
    if cfg!(target_os = "android") {
        "android"
    } else {
        "desktop"
    }
}

#[cfg_attr(target_os = "android", tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "android")]
    mobile::run();
    #[cfg(not(target_os = "android"))]
    desktop_app::run();
}
