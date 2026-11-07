//! Explicit fullscreen requests avoid niri's toggle-only IPC action.
use super::{AppResult, Window};
use wayland_client::{
    globals::{registry_queue_init, GlobalListContents},
    protocol::wl_registry,
    Connection, Dispatch, Proxy, QueueHandle,
};
use wayland_protocols_wlr::foreign_toplevel::v1::client::{
    zwlr_foreign_toplevel_handle_v1::{self as handle, ZwlrForeignToplevelHandleV1},
    zwlr_foreign_toplevel_manager_v1::{self as manager, ZwlrForeignToplevelManagerV1},
};

#[derive(Default)]
struct Toplevels {
    windows: Vec<Toplevel>,
}

struct Toplevel {
    handle: ZwlrForeignToplevelHandleV1,
    app_id: Option<String>,
    title: Option<String>,
}

pub fn fullscreen(window: &Window, enabled: bool) -> AppResult<()> {
    let connection = Connection::connect_to_env().map_err(|e| e.to_string())?;
    let (globals, mut queue) =
        registry_queue_init::<Toplevels>(&connection).map_err(|e| e.to_string())?;
    let _manager = globals
        .bind::<ZwlrForeignToplevelManagerV1, _, _>(&queue.handle(), 3..=3, ())
        .map_err(|e| format!("桌面未提供 Wayland 全屏控制接口：{e}"))?;
    let mut state = Toplevels::default();
    // The manager sends new handles first; their properties arrive on the next sync.
    queue.roundtrip(&mut state).map_err(|e| e.to_string())?;
    queue.roundtrip(&mut state).map_err(|e| e.to_string())?;
    let matches: Vec<_> = state
        .windows
        .iter()
        .filter(|w| w.app_id == window.app_id && w.title == window.title)
        .collect();
    let [target] = matches.as_slice() else {
        return Err("无法唯一识别 DSH 的 Wayland 窗口".into());
    };
    if enabled {
        target.handle.set_fullscreen(None);
    } else {
        target.handle.unset_fullscreen();
    }
    queue.roundtrip(&mut state).map_err(|e| e.to_string())?;
    Ok(())
}

impl Dispatch<wl_registry::WlRegistry, GlobalListContents> for Toplevels {
    fn event(
        _: &mut Self,
        _: &wl_registry::WlRegistry,
        _: wl_registry::Event,
        _: &GlobalListContents,
        _: &Connection,
        _: &QueueHandle<Self>,
    ) {
    }
}

impl Dispatch<ZwlrForeignToplevelManagerV1, ()> for Toplevels {
    fn event(
        state: &mut Self,
        _: &ZwlrForeignToplevelManagerV1,
        event: manager::Event,
        _: &(),
        _: &Connection,
        _: &QueueHandle<Self>,
    ) {
        if let manager::Event::Toplevel { toplevel } = event {
            state.windows.push(Toplevel {
                handle: toplevel,
                app_id: None,
                title: None,
            });
        }
    }
    wayland_client::event_created_child!(Toplevels, ZwlrForeignToplevelManagerV1, [
        0 => (ZwlrForeignToplevelHandleV1, ())
    ]);
}

impl Dispatch<ZwlrForeignToplevelHandleV1, ()> for Toplevels {
    fn event(
        state: &mut Self,
        proxy: &ZwlrForeignToplevelHandleV1,
        event: handle::Event,
        _: &(),
        _: &Connection,
        _: &QueueHandle<Self>,
    ) {
        if matches!(event, handle::Event::Closed) {
            state.windows.retain(|w| w.handle.id() != proxy.id());
            return;
        }
        let Some(window) = state
            .windows
            .iter_mut()
            .find(|w| w.handle.id() == proxy.id())
        else {
            return;
        };
        match event {
            handle::Event::AppId { app_id } => window.app_id = Some(app_id),
            handle::Event::Title { title } => window.title = Some(title),
            _ => {}
        }
    }
}
