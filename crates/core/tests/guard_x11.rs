#![cfg(target_os = "linux")]

use std::{
    thread::sleep,
    time::{Duration, Instant},
};
use tomato_core::{guard, GuardMode, Protection};
use x11rb::{
    connection::Connection,
    protocol::xproto::{
        AtomEnum, ClientMessageEvent, ConnectionExt, CreateWindowAux, EventMask, PropMode,
        WindowClass,
    },
    wrapper::ConnectionExt as _,
    COPY_DEPTH_FROM_PARENT, CURRENT_TIME,
};

fn wait_until(mut condition: impl FnMut() -> bool) {
    let start = Instant::now();
    while !condition() {
        assert!(
            start.elapsed() < Duration::from_secs(5),
            "X11 condition did not arrive"
        );
        sleep(Duration::from_millis(20));
    }
}

#[test]
#[ignore = "requires the isolated Xvfb/Openbox session created by tests/x11.mjs"]
fn real_ewmh_windows_focus_whitelist_and_failure() {
    assert_eq!(
        std::env::var("TOMATO_X11_TEST_ISOLATED").as_deref(),
        Ok("1")
    );
    let (connection, screen) = x11rb::connect(None).unwrap();
    let screen = &connection.setup().roots[screen];
    let root = screen.root;
    let atom = |name: &str| {
        connection
            .intern_atom(false, name.as_bytes())
            .unwrap()
            .reply()
            .unwrap()
            .atom
    };
    wait_until(|| guard::info().available);
    let own_pid = std::process::id();
    let create = |class: Option<&str>, pid: Option<u32>| {
        let id = connection.generate_id().unwrap();
        connection
            .create_window(
                COPY_DEPTH_FROM_PARENT,
                id,
                root,
                10,
                10,
                200,
                150,
                0,
                WindowClass::INPUT_OUTPUT,
                0,
                &CreateWindowAux::new().background_pixel(screen.white_pixel),
            )
            .unwrap()
            .check()
            .unwrap();
        if let Some(class) = class {
            connection
                .change_property8(
                    PropMode::REPLACE,
                    id,
                    AtomEnum::WM_CLASS,
                    AtomEnum::STRING,
                    format!("instance\0{class}\0").as_bytes(),
                )
                .unwrap()
                .check()
                .unwrap();
        }
        if let Some(pid) = pid {
            connection
                .change_property32(
                    PropMode::REPLACE,
                    id,
                    atom("_NET_WM_PID"),
                    AtomEnum::CARDINAL,
                    &[pid],
                )
                .unwrap()
                .check()
                .unwrap();
        }
        connection
            .change_property8(
                PropMode::REPLACE,
                id,
                atom("_NET_WM_NAME"),
                atom("UTF8_STRING"),
                "隔离专注测试".as_bytes(),
            )
            .unwrap()
            .check()
            .unwrap();
        connection.map_window(id).unwrap().check().unwrap();
        connection.flush().unwrap();
        id
    };
    let own = create(Some("Tomato-X11-Test"), Some(own_pid));
    let allowed = create(Some("Allowed"), Some(own_pid + 1));
    let blocked = create(Some("Allowed-malicious"), Some(own_pid + 2));
    let unknown = create(None, None);
    wait_until(|| guard::windows().is_ok_and(|windows| windows.len() == 4));
    let info = guard::info();
    assert_eq!(info.backend, "EWMH / X11");
    assert!(info.windows.iter().any(|w| w.id == u64::from(own)
        && w.pid == Some(own_pid)
        && w.title.as_deref() == Some("隔离专注测试")));
    guard::preflight(own_pid).unwrap();
    assert!(guard::preflight(own_pid + 100).is_err());
    let focus = |id| {
        connection
            .send_event(
                false,
                root,
                EventMask::SUBSTRUCTURE_REDIRECT | EventMask::SUBSTRUCTURE_NOTIFY,
                ClientMessageEvent::new(
                    32,
                    id,
                    atom("_NET_ACTIVE_WINDOW"),
                    [2, CURRENT_TIME, 0, 0, 0],
                ),
            )
            .unwrap()
            .check()
            .unwrap();
        connection.flush().unwrap();
        wait_until(|| {
            guard::windows().is_ok_and(|windows| {
                windows
                    .iter()
                    .any(|w| w.id == u64::from(id) && w.is_focused)
            })
        });
    };
    let wait_own = || {
        wait_until(|| {
            guard::windows().is_ok_and(|windows| {
                windows
                    .iter()
                    .any(|w| w.id == u64::from(own) && w.is_focused)
            })
        })
    };
    let mut protection = Protection {
        mode: GuardMode::Whitelist,
        whitelist: vec!["Allowed".into()],
        strict: false,
    };
    focus(allowed);
    assert!(!guard::enforce(&protection, own_pid).unwrap());
    focus(blocked);
    assert!(guard::enforce(&protection, own_pid).unwrap());
    wait_own();
    focus(unknown);
    assert!(guard::enforce(&protection, own_pid).unwrap());
    wait_own();
    focus(allowed);
    protection.mode = GuardMode::Lock;
    assert!(guard::enforce(&protection, own_pid).unwrap());
    wait_own();
    focus(blocked);
    protection.mode = GuardMode::Off;
    assert!(!guard::enforce(&protection, own_pid).unwrap());
    guard::focus_own(own_pid).unwrap();
    wait_own();
    connection.destroy_window(own).unwrap().check().unwrap();
    connection.flush().unwrap();
    wait_until(|| {
        guard::windows().is_ok_and(|windows| !windows.iter().any(|w| w.id == u64::from(own)))
    });
    protection.mode = GuardMode::Lock;
    assert_eq!(
        guard::enforce(&protection, own_pid).unwrap_err(),
        "专注窗口已关闭"
    );
}

#[test]
#[ignore = "requires the isolated X11 server and Wayland environment from tests/x11.mjs"]
fn xwayland_does_not_report_complete_desktop_protection() {
    assert_eq!(
        std::env::var("TOMATO_X11_TEST_ISOLATED").as_deref(),
        Ok("1")
    );
    assert!(std::env::var_os("NIRI_SOCKET").is_none());
    assert!(!guard::info().available);
    assert!(guard::windows()
        .unwrap_err()
        .contains("Xwayland 不能管控全部应用"));
}
