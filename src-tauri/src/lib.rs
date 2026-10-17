//! Native entry points share the persisted core and system document commands.
use std::sync::{Arc, Mutex};
use tomato_core::{guard, now, Action, AppData, AppResult, Engine, GuardMode};

pub(crate) type Shared = Arc<Mutex<Engine>>;
#[cfg(not(target_os = "android"))]
mod desktop;
#[cfg(not(target_os = "android"))]
mod desktop_app;
mod files;
#[cfg(not(target_os = "android"))]
mod focus_audio;
#[cfg(target_os = "android")]
mod mobile;

fn preflight_action(current: &AppData, action: &Action) -> AppResult<()> {
    let mut proposed = current.clone();
    proposed.apply(
        serde_json::from_value(serde_json::to_value(action).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?,
        now(),
    )?;
    if !matches!(action, Action::EmergencyUnlock | Action::CompleteFocus)
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
    // The direct WebAudio sink can run silently on Bluetooth/PipeWire while
    // its clock and graph keep advancing. WebKit's shared mixer uses the
    // working media output path (requires GStreamer's inter plugin).
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_GST_ENABLE_AUDIO_MIXER").is_none() {
        std::env::set_var("WEBKIT_GST_ENABLE_AUDIO_MIXER", "1");
    }
    #[cfg(target_os = "android")]
    mobile::run();
    #[cfg(not(target_os = "android"))]
    desktop_app::run();
}
