//! EWMH 窗口发现、激活与全屏锁窗（移植自旧 crates/core/src/guard_x11.rs）。
//! 锁窗是 guard 自建的普通客户端窗口：进入 _NET_CLIENT_LIST、带 _NET_WM_PID
//! 与 WM_CLASS，因此 enforce 循环按 pid 找到它并照旧逻辑 focus 回去。
use super::{AppResult, LockWindow, Window};
use x11rb::{
    connection::Connection,
    protocol::xproto::{
        Atom, AtomEnum, ClientMessageEvent, ConnectionExt, CreateWindowAux, EventMask,
        GetPropertyReply, PropMode, WindowClass,
    },
    rust_connection::RustConnection,
    wrapper::ConnectionExt as _,
    COPY_DEPTH_FROM_PARENT, CURRENT_TIME,
};

/// 锁窗背景色：番茄红 #d96d55（与插件设计语言一致）。
const TOMATO_RED: u32 = 0xd96d55;

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
    // EWMH 要求所有者窗口存活且自引用；仅根窗口能力可能在 WM 崩溃后残留。
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

/// WM_CLASS 属性的 class 段（两个 NUL 分隔串的第二个）；纯函数便于测试。
fn class_from_wm_class(value: &[u8]) -> Option<String> {
    let class = value.split(|b| *b == 0).nth(1)?;
    (!class.is_empty()).then(|| String::from_utf8_lossy(class).into_owned())
}

pub fn windows() -> AppResult<Vec<Window>> {
    let (connection, root) = connect()?;
    let clients = property(&connection, root, "_NET_CLIENT_LIST", AtomEnum::WINDOW)?;
    let mut ids: Vec<_> = clients.value32().ok_or("无效 X11 窗口列表")?.collect();
    let active = property(&connection, root, "_NET_ACTIVE_WINDOW", AtomEnum::WINDOW)?
        .value32()
        .and_then(|mut values| values.next())
        .filter(|id| *id != 0);
    // Modal/override-redirect 窗口可能激活但不在客户端列表。
    if let Some(active) = active.filter(|id| !ids.contains(id)) {
        ids.push(active);
    }
    let mut windows = Vec::new();
    for id in ids {
        // 查询根窗口与元数据之间客户端可能已关闭。
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
            .and_then(|p| class_from_wm_class(&p.value));
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

pub fn focus(id: u64) -> AppResult<bool> {
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
    connection.flush().map_err(|e| e.to_string())?;
    Ok(true)
}

/// guard 自己的全屏锁窗。RAII：句柄丢弃即销毁窗口。
pub struct X11LockWindow {
    id: u32,
    connection: RustConnection,
}

impl LockWindow for X11LockWindow {}

impl Drop for X11LockWindow {
    fn drop(&mut self) {
        let _ = self
            .connection
            .destroy_window(self.id)
            .map_err(|e| e.to_string())
            .and_then(|cookie| cookie.check().map_err(|e| e.to_string()))
            .and_then(|()| self.connection.flush().map_err(|e| e.to_string()));
    }
}

pub fn lock_window() -> AppResult<X11LockWindow> {
    let (connection, root) = connect()?;
    let geometry = connection
        .get_geometry(root)
        .map_err(|e| e.to_string())?
        .reply()
        .map_err(|e| e.to_string())?;
    let id = connection.generate_id().map_err(|e| e.to_string())?;
    let aux = CreateWindowAux::new()
        .background_pixel(TOMATO_RED)
        .event_mask(EventMask::EXPOSURE);
    connection
        .create_window(
            COPY_DEPTH_FROM_PARENT,
            id,
            root,
            0,
            0,
            geometry.width,
            geometry.height,
            0,
            WindowClass::INPUT_OUTPUT,
            0,
            &aux,
        )
        .map_err(|e| e.to_string())?
        .check()
        .map_err(|e| e.to_string())?;
    // WM_CLASS 让 WM 按应用归组；_NET_WM_PID 是 enforce 循环认出锁窗的关键。
    connection
        .change_property8(
            PropMode::REPLACE,
            id,
            AtomEnum::WM_CLASS,
            AtomEnum::STRING,
            b"tomato-guard\0TomatoGuard\0",
        )
        .map_err(|e| e.to_string())?
        .check()
        .map_err(|e| e.to_string())?;
    connection
        .change_property32(
            PropMode::REPLACE,
            id,
            atom(&connection, "_NET_WM_PID")?,
            AtomEnum::CARDINAL,
            &[std::process::id()],
        )
        .map_err(|e| e.to_string())?
        .check()
        .map_err(|e| e.to_string())?;
    connection
        .change_property8(
            PropMode::REPLACE,
            id,
            atom(&connection, "_NET_WM_NAME")?,
            atom(&connection, "UTF8_STRING")?,
            "番茄专注中".as_bytes(),
        )
        .map_err(|e| e.to_string())?
        .check()
        .map_err(|e| e.to_string())?;
    // 初始属性声明全屏；再发 ClientMessage 兼容不读初始 _NET_WM_STATE 的 WM。
    let state = atom(&connection, "_NET_WM_STATE")?;
    let fullscreen = atom(&connection, "_NET_WM_STATE_FULLSCREEN")?;
    connection
        .change_property32(PropMode::REPLACE, id, state, AtomEnum::ATOM, &[fullscreen])
        .map_err(|e| e.to_string())?
        .check()
        .map_err(|e| e.to_string())?;
    connection
        .map_window(id)
        .map_err(|e| e.to_string())?
        .check()
        .map_err(|e| e.to_string())?;
    let event = ClientMessageEvent::new(32, id, state, [1, fullscreen, 0, 1, 0]);
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
    connection.flush().map_err(|e| e.to_string())?;
    Ok(X11LockWindow { id, connection })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wm_class_parses_second_null_separated_field() {
        assert_eq!(
            class_from_wm_class(b"instance\0Code\0"),
            Some("Code".into())
        );
        assert_eq!(
            class_from_wm_class(b"org.tomato.Todo\0tomato-todo\0"),
            Some("tomato-todo".into())
        );
        assert_eq!(class_from_wm_class(b""), None);
        assert_eq!(class_from_wm_class(b"only-instance\0"), None);
        assert_eq!(class_from_wm_class(b"a\0\0"), None);
    }
}
