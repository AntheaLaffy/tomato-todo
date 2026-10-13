//! EWMH window discovery and activation on native X11 sessions.
use crate::{guard::Window, AppResult};
use x11rb::{
    connection::Connection,
    protocol::xproto::{
        Atom, AtomEnum, ClientMessageEvent, ConnectionExt, EventMask, GetPropertyReply,
    },
    rust_connection::RustConnection,
    CURRENT_TIME,
};

fn connect() -> AppResult<(RustConnection, u32)> {
    if std::env::var("XDG_SESSION_TYPE").is_ok_and(|s| s.eq_ignore_ascii_case("wayland"))
        || std::env::var_os("WAYLAND_DISPLAY").is_some_and(|s| !s.is_empty())
    {
        return Err("当前 Wayland 会话需要合成器原生窗口接口，Xwayland 不能管控全部应用".into());
    }
    let (connection, screen) = x11rb::connect(None).map_err(|e| format!("无法连接 X11：{e}"))?;
    let root = connection.setup().roots[screen].root;
    let owner = property(
        &connection,
        root,
        "_NET_SUPPORTING_WM_CHECK",
        AtomEnum::WINDOW,
    )?
    .value32()
    .and_then(|mut values| values.next())
    .filter(|id| *id != 0)
    .ok_or("X11 窗口管理器未运行")?;
    // EWMH requires a live owner window with a self-reference. Root capabilities
    // alone may outlive a crashed window manager and cannot prove focus works.
    if property(
        &connection,
        owner,
        "_NET_SUPPORTING_WM_CHECK",
        AtomEnum::WINDOW,
    )?
    .value32()
    .and_then(|mut values| values.next())
        != Some(owner)
    {
        return Err("X11 窗口管理器的 EWMH 所有者无效".into());
    }
    let supported = property(&connection, root, "_NET_SUPPORTED", AtomEnum::ATOM)?;
    let supported = supported
        .value32()
        .ok_or("当前 X11 窗口管理器没有 EWMH 接口")?;
    let active = atom(&connection, "_NET_ACTIVE_WINDOW")?;
    let clients = atom(&connection, "_NET_CLIENT_LIST")?;
    let supported: Vec<_> = supported.collect();
    if !supported.contains(&active) || !supported.contains(&clients) {
        return Err("当前 X11 窗口管理器没有窗口列表与激活接口".into());
    }
    Ok((connection, root))
}
fn atom(connection: &RustConnection, name: &str) -> AppResult<Atom> {
    connection
        .intern_atom(false, name.as_bytes())
        .map_err(|e| e.to_string())?
        .reply()
        .map(|reply| reply.atom)
        .map_err(|e| e.to_string())
}
fn property(
    connection: &RustConnection,
    window: u32,
    name: &str,
    kind: impl Into<Atom>,
) -> AppResult<GetPropertyReply> {
    connection
        .get_property(false, window, atom(connection, name)?, kind, 0, 256 * 1024)
        .map_err(|e| e.to_string())?
        .reply()
        .map_err(|e| e.to_string())
}

pub fn windows() -> AppResult<Vec<Window>> {
    let (connection, root) = connect()?;
    let clients = property(&connection, root, "_NET_CLIENT_LIST", AtomEnum::WINDOW)?;
    let mut ids: Vec<_> = clients.value32().ok_or("无效 X11 窗口列表")?.collect();
    let active = property(&connection, root, "_NET_ACTIVE_WINDOW", AtomEnum::WINDOW)?
        .value32()
        .and_then(|mut values| values.next())
        .filter(|id| *id != 0);
    // Modal/override-redirect windows can be active without being on the client list.
    if let Some(active) = active.filter(|id| !ids.contains(id)) {
        ids.push(active);
    }
    let mut windows = Vec::new();
    for id in ids {
        // A client may close between the root query and its metadata queries.
        if connection
            .get_window_attributes(id)
            .map_err(|e| e.to_string())?
            .reply()
            .is_err()
        {
            continue;
        }
        let pid = property(&connection, id, "_NET_WM_PID", AtomEnum::CARDINAL)
            .ok()
            .and_then(|p| p.value32().and_then(|mut values| values.next()));
        let app_id = property(&connection, id, "WM_CLASS", AtomEnum::STRING)
            .ok()
            .and_then(|p| {
                let class = p.value.split(|b| *b == 0).nth(1)?;
                (!class.is_empty()).then(|| String::from_utf8_lossy(class).into_owned())
            });
        let title = property(
            &connection,
            id,
            "_NET_WM_NAME",
            atom(&connection, "UTF8_STRING")?,
        )
        .ok()
        .filter(|p| !p.value.is_empty())
        .or_else(|| property(&connection, id, "WM_NAME", AtomEnum::STRING).ok())
        .filter(|p| !p.value.is_empty())
        .map(|p| String::from_utf8_lossy(&p.value).into_owned());
        windows.push(Window {
            id: u64::from(id),
            app_id,
            title,
            pid,
            is_focused: active == Some(id),
        });
    }
    Ok(windows)
}

pub fn focus(id: u64) -> AppResult<()> {
    let (connection, root) = connect()?;
    let id = u32::try_from(id).map_err(|e| e.to_string())?;
    let event = ClientMessageEvent::new(
        32,
        id,
        atom(&connection, "_NET_ACTIVE_WINDOW")?,
        [2, CURRENT_TIME, 0, 0, 0],
    );
    connection
        .send_event(
            false,
            root,
            EventMask::SUBSTRUCTURE_REDIRECT | EventMask::SUBSTRUCTURE_NOTIFY,
            event,
        )
        .map_err(|e| e.to_string())?
        .check()
        .map_err(|e| e.to_string())?;
    connection.flush().map_err(|e| e.to_string())
}
