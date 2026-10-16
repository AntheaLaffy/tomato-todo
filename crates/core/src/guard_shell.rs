//! GNOME Shell extension and KWin scripting through the session bus.
use super::{AppResult, Window};
use gio::glib::{self, variant::ToVariant};
use serde::Deserialize;
use std::{
    io::Write,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

const INTERFACE: &str = "studio.tomato.Guard1";
const PATH: &str = "/studio/tomato/Guard";

fn bus() -> AppResult<gio::DBusConnection> {
    gio::bus_get_sync(gio::BusType::Session, gio::Cancellable::NONE).map_err(|e| e.to_string())
}
fn call(
    bus: &gio::DBusConnection,
    name: &str,
    path: &str,
    interface: &str,
    method: &str,
    args: &glib::Variant,
) -> AppResult<glib::Variant> {
    bus.call_sync(
        Some(name),
        path,
        interface,
        method,
        Some(args),
        None,
        gio::DBusCallFlags::NO_AUTO_START,
        400,
        gio::Cancellable::NONE,
    )
    .map_err(|e| e.to_string())
}

pub fn gnome_list() -> AppResult<Vec<Window>> {
    let reply = call(
        &bus()?,
        "org.gnome.Shell",
        PATH,
        INTERFACE,
        "ListWindows",
        &().to_variant(),
    )
    .map_err(|e| format!("GNOME 窗口接口不可用，请安装并启用番茄 Todo Shell 扩展：{e}"))?;
    let (json,) = reply.get::<(String,)>().ok_or("无效 GNOME 窗口响应")?;
    serde_json::from_str(&json).map_err(|e| e.to_string())
}
pub fn gnome_focus(id: u64) -> AppResult<bool> {
    let id = u32::try_from(id).map_err(|e| e.to_string())?;
    let reply = call(
        &bus()?,
        "org.gnome.Shell",
        PATH,
        INTERFACE,
        "FocusWindow",
        &(id,).to_variant(),
    )?;
    reply
        .get::<(bool,)>()
        .map(|v| v.0)
        .ok_or_else(|| "无效 GNOME 激活响应".into())
}

// KWin exposes load/run/unload rather than a window-list D-Bus method. As with
// kdotool, a short-lived script returns data to a unique callback, then unloads.
const KWIN_WINDOWS: &str = r#"
var list = typeof workspace.windowList === 'function' ? workspace.windowList() : workspace.clientList();
return list.filter(function(w) { return !w.deleted && !w.specialWindow; }).map(function(w) {
    return { native_id: String(w.internalId), app_id: String(w.desktopFileName || w.resourceClass || '') || null,
             title: String(w.caption), pid: w.pid > 0 ? w.pid : null, is_focused: w.active };
});
"#;

struct LoadedScript {
    bus: gio::DBusConnection,
    name: String,
    path: String,
}
impl Drop for LoadedScript {
    fn drop(&mut self) {
        let _ = call(
            &self.bus,
            "org.kde.KWin",
            &self.path,
            "org.kde.kwin.Script",
            "stop",
            &().to_variant(),
        );
        let _ = call(
            &self.bus,
            "org.kde.KWin",
            "/Scripting",
            "org.kde.kwin.Scripting",
            "unloadScript",
            &(self.name.as_str(),).to_variant(),
        );
    }
}

fn kwin_request(body: &str) -> AppResult<serde_json::Value> {
    let context = glib::MainContext::new();
    context.with_thread_default(|| -> AppResult<serde_json::Value> {
        let connection = bus()?;
        let (owner,) = call(&connection, "org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus", "GetNameOwner", &("org.kde.KWin",).to_variant())?
            .get::<(String,)>().ok_or("找不到 KWin 会话")?;
        let token = uuid::Uuid::new_v4().simple().to_string();
        let path = format!("/studio/tomato/Reply{token}");
        let name = format!("tomato-{token}");
        let xml = gio::DBusNodeInfo::for_xml("<node><interface name='studio.tomato.GuardReply1'><method name='Reply'><arg type='s' direction='in'/></method></interface></node>").map_err(|e| e.to_string())?;
        let result = Arc::new(Mutex::new(None));
        let received = result.clone();
        let registration = connection.register_object(&path, &xml.interfaces()[0],
            move |_, sender, _, _, _, args, invocation| {
                if sender != owner { invocation.return_dbus_error("studio.tomato.AccessDenied", "Only KWin may reply"); return; }
                if let Some((json,)) = args.get::<(String,)>() {
                    *received.lock().unwrap() = Some(json);
                }
                invocation.return_value(Some(&().to_variant()));
            }, |_, _, _, _, _| ().to_variant(), |_, _, _, _, _, _| false).map_err(|e| e.to_string())?;
        let operation = (|| -> AppResult<serde_json::Value> {
            let destination = serde_json::to_string(connection.unique_name().as_deref().ok_or("D-Bus 连接没有唯一名称")?).map_err(|e| e.to_string())?;
            let path_json = serde_json::to_string(&path).map_err(|e| e.to_string())?;
            let script = format!("var result; try {{ result = {{ok: (function() {{ {body} }})()}}; }} catch (e) {{ result = {{error: String(e)}}; }}\ncallDBus({destination}, {path_json}, 'studio.tomato.GuardReply1', 'Reply', JSON.stringify(result));");
            let mut file = tempfile::NamedTempFile::new().map_err(|e| e.to_string())?;
            file.write_all(script.as_bytes()).map_err(|e| e.to_string())?;
            let file_path = file.path().to_str().ok_or("无效脚本路径")?;
            let (id,) = call(&connection, "org.kde.KWin", "/Scripting", "org.kde.kwin.Scripting", "loadScript", &(file_path, name.as_str()).to_variant())?
                .get::<(i32,)>().filter(|(id,)| *id >= 0).ok_or("KWin 无法加载窗口脚本")?;
            let mut loaded = LoadedScript { bus: connection.clone(), name, path: format!("/Scripting/Script{id}") };
            if let Err(error) = call(&connection, "org.kde.KWin", &loaded.path, "org.kde.kwin.Script", "run", &().to_variant()) {
                // Plasma 5.27 exports scripts at /<id>; Plasma 6 uses /Scripting/Script<id>.
                if !["UnknownObject", "UnknownMethod", "UnknownInterface"].iter().any(|name| error.contains(name)) { return Err(error); }
                loaded.path = format!("/{id}");
                call(&connection, "org.kde.KWin", &loaded.path, "org.kde.kwin.Script", "run", &().to_variant())?;
            }
            let deadline = Instant::now() + Duration::from_millis(400);
            loop {
                while context.pending() { context.iteration(false); }
                if let Some(json) = result.lock().unwrap().take() {
                    let value: serde_json::Value = serde_json::from_str(&json).map_err(|e| e.to_string())?;
                    if let Some(error) = value.get("error") { return Err(format!("KWin 窗口脚本失败：{error}")); }
                    return value.get("ok").cloned().ok_or_else(|| "KWin 返回了无效结果".into());
                }
                if Instant::now() >= deadline { return Err("KWin 窗口脚本未响应".into()); }
                std::thread::sleep(Duration::from_millis(2));
            }
        })();
        let _ = connection.unregister_object(registration);
        operation
    }).map_err(|e| e.to_string())?
}

#[derive(Deserialize)]
struct KWinWindow {
    native_id: String,
    app_id: Option<String>,
    title: Option<String>,
    pid: Option<u32>,
    is_focused: bool,
}
fn window_id(native: &str) -> u64 {
    native.bytes().fold(0xcbf29ce484222325, |hash, b| {
        (hash ^ u64::from(b)).wrapping_mul(0x100000001b3)
    })
}
fn kwin_windows() -> AppResult<Vec<KWinWindow>> {
    let windows: Vec<KWinWindow> =
        serde_json::from_value(kwin_request(KWIN_WINDOWS)?).map_err(|e| e.to_string())?;
    let mut ids = std::collections::HashSet::new();
    if windows
        .iter()
        .any(|w| w.native_id.is_empty() || !ids.insert(window_id(&w.native_id)))
    {
        return Err("KWin 窗口标识无效或冲突".into());
    }
    Ok(windows)
}
pub fn kwin_list() -> AppResult<Vec<Window>> {
    Ok(kwin_windows()?
        .into_iter()
        .map(|w| Window {
            id: window_id(&w.native_id),
            app_id: w.app_id,
            title: w.title,
            pid: w.pid,
            is_focused: w.is_focused,
        })
        .collect())
}
pub fn kwin_focus(id: u64) -> AppResult<bool> {
    let target = kwin_windows()?
        .into_iter()
        .find(|w| window_id(&w.native_id) == id)
        .ok_or("KWin 窗口已关闭")?;
    let native = serde_json::to_string(&target.native_id).map_err(|e| e.to_string())?;
    let script = format!("var list = typeof workspace.windowList === 'function' ? workspace.windowList() : workspace.clientList(); var w = list.find(function(w) {{ return String(w.internalId) === {native}; }}); if (!w) throw new Error('Window closed'); w.minimized = false; if ('activeWindow' in workspace) workspace.activeWindow = w; else workspace.activeClient = w; return true;");
    kwin_request(&script)?;
    Ok(kwin_list()?.iter().any(|w| w.id == id && w.is_focused))
}
