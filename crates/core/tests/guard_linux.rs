#![cfg(target_os = "linux")]
//! These endpoints exist only inside the test's private sockets/session bus.
use serde_json::{json, Value};
use std::{
    io::{Read, Write},
    os::unix::net::UnixListener,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    thread,
};
use tomato_core::{guard, GuardMode, Protection};

fn reset() {
    for name in ["NIRI_SOCKET", "SWAYSOCK", "HYPRLAND_INSTANCE_SIGNATURE"] {
        std::env::remove_var(name);
    }
    std::env::set_var("XDG_SESSION_TYPE", "wayland");
    std::env::set_var("WAYLAND_DISPLAY", "tomato-test-never-a-real-display");
}
fn protection() -> Protection {
    Protection {
        mode: GuardMode::Whitelist,
        whitelist: vec!["org.tomato.Allowed".into()],
        strict: false,
    }
}
fn assert_guard() {
    let own = std::process::id();
    let windows = guard::windows().unwrap();
    assert_eq!(windows.len(), 3);
    assert!(windows.iter().any(|w| w.pid == Some(own)));
    let allowed = windows
        .iter()
        .find(|w| w.app_id.as_deref() == Some("org.tomato.Allowed"))
        .unwrap();
    assert!(guard::allowed(allowed, own, &protection()));
    guard::preflight(own).unwrap();
    assert!(guard::enforce(&protection(), own).unwrap());
    assert!(guard::windows()
        .unwrap()
        .iter()
        .any(|w| w.pid == Some(own) && w.is_focused));
    assert!(!guard::enforce(&protection(), own).unwrap());
}

#[test]
fn private_sway_and_hyprland_ipc() {
    reset();
    let dir = tempfile::tempdir().unwrap();
    let focused = Arc::new(AtomicU64::new(3));
    let socket = dir.path().join("sway.sock");
    let listener = UnixListener::bind(&socket).unwrap();
    std::env::set_var("SWAYSOCK", &socket);
    let active = focused.clone();
    thread::spawn(move || {
        for stream in listener.incoming() {
            let mut stream = stream.unwrap();
            let mut header = [0; 14];
            stream.read_exact(&mut header).unwrap();
            assert_eq!(&header[..6], b"i3-ipc");
            let len = u32::from_le_bytes(header[6..10].try_into().unwrap());
            let kind = u32::from_le_bytes(header[10..].try_into().unwrap());
            let mut body = vec![0; len as usize];
            stream.read_exact(&mut body).unwrap();
            let value = if kind == 4 {
                let window = |id, app, pid| json!({"id":id,"app_id":app,"pid":pid,"name":app,"focused":active.load(Ordering::Relaxed)==id});
                // Native, Xwayland class fallback and a floating window, recursively.
                json!({"nodes":[{"nodes":[window(1,"tomato-todo",std::process::id()),window(2,"org.tomato.Allowed",200)]}],
                    "floating_nodes":[{"id":3,"window":99,"window_properties":{"class":"org.tomato.Blocked"},"pid":300,"focused":active.load(Ordering::Relaxed)==3}]})
            } else {
                assert_eq!(String::from_utf8(body).unwrap(), "[con_id=1] focus");
                active.store(1, Ordering::Relaxed);
                json!([{"success":true}])
            };
            let body = serde_json::to_vec(&value).unwrap();
            let mut response = b"i3-ipc".to_vec();
            response.extend_from_slice(&(body.len() as u32).to_le_bytes());
            response.extend_from_slice(&kind.to_le_bytes());
            stream.write_all(&response).unwrap();
            stream.write_all(&body).unwrap();
        }
    });
    assert_guard();
    std::env::set_var("SWAYSOCK", dir.path().join("missing"));
    assert!(!guard::info().available);
    std::env::remove_var("SWAYSOCK");
    focused.store(3, Ordering::Relaxed);
    let path = dir.path().join("hypr/test");
    std::fs::create_dir_all(&path).unwrap();
    let listener = UnixListener::bind(path.join(".socket.sock")).unwrap();
    std::env::set_var("XDG_RUNTIME_DIR", dir.path());
    std::env::set_var("HYPRLAND_INSTANCE_SIGNATURE", "test");
    thread::spawn(move || {
        for stream in listener.incoming() {
            let mut stream = stream.unwrap();
            let mut buffer = [0; 512];
            let size = stream.read(&mut buffer).unwrap();
            let command = std::str::from_utf8(&buffer[..size]).unwrap();
            let response = match command {
                "j/clients" => serde_json::to_string(&(1..=3).map(|id| json!({"address":format!("0x{id:x}"),"class":match id {1=>"tomato-todo",2=>"org.tomato.Allowed",_=>"org.tomato.Blocked"},"title":"测试窗口","pid":if id==1 { std::process::id() } else {id as u32 * 100},"mapped":true})).collect::<Vec<_>>()).unwrap(),
                "j/activewindow" => json!({"address":format!("0x{:x}",focused.load(Ordering::Relaxed))}).to_string(),
                "dispatch focuswindow address:0x1" => { focused.store(1, Ordering::Relaxed); "ok".into() },
                _ => panic!("Unexpected IPC: {command}")
            };
            stream.write_all(response.as_bytes()).unwrap();
        }
    });
    assert_guard();
    std::env::set_var("HYPRLAND_INSTANCE_SIGNATURE", "../../invalid");
    assert!(!guard::info().available);
}

#[test]
#[ignore = "only tests/linux-desktops.mjs supplies the private D-Bus fixture"]
fn private_gnome_and_kwin_bus() {
    assert_eq!(
        std::env::var("TOMATO_SHELL_TEST_ISOLATED").as_deref(),
        Ok("1")
    );
    reset();
    // fixture exposes both services on an independent bus, never the user's Shell.
    for (desktop, legacy) in [("GNOME", false), ("KDE", false), ("KDE", true)] {
        std::env::set_var("XDG_CURRENT_DESKTOP", desktop);
        let connection = gio::bus_get_sync(gio::BusType::Session, gio::Cancellable::NONE).unwrap();
        use gio::glib::variant::ToVariant;
        connection
            .call_sync(
                Some("org.gnome.Shell"),
                "/studio/tomato/Guard",
                "studio.tomato.Guard1",
                "Reset",
                Some(&(std::process::id(), legacy).to_variant()),
                None,
                gio::DBusCallFlags::NONE,
                1000,
                gio::Cancellable::NONE,
            )
            .unwrap();
        assert_guard();
        let value: Value = json!({"desktop":desktop});
        println!("verified {value}");
    }
}

#[test]
#[ignore = "only tests/wayland.mjs starts an isolated real compositor"]
fn real_wayland_compositor() {
    assert_eq!(
        std::env::var("TOMATO_WAYLAND_TEST_ISOLATED").as_deref(),
        Ok("1")
    );
    let windows = guard::windows().unwrap();
    let own = windows
        .iter()
        .find(|w| w.app_id.as_deref() == Some("org.tomato.Own"))
        .expect("own fixture window");
    let allowed = windows
        .iter()
        .find(|w| w.app_id.as_deref() == Some("org.tomato.Allowed"))
        .expect("allowed fixture window");
    let blocked = windows
        .iter()
        .find(|w| w.app_id.as_deref() == Some("org.tomato.Blocked"))
        .expect("blocked fixture window");
    let own_pid = own.pid.expect("native PID");
    guard::preflight(own_pid).unwrap();
    fn focus(pid: u32) {
        for _ in 0..20 {
            if guard::focus_own(pid).is_ok() {
                return;
            }
            thread::sleep(std::time::Duration::from_millis(100));
        }
        panic!("Could not focus fixture PID {pid}");
    }
    focus(allowed.pid.unwrap());
    assert!(!guard::enforce(&protection(), own_pid).unwrap());
    focus(blocked.pid.unwrap());
    let mut redirected = false;
    for _ in 0..20 {
        redirected |= guard::enforce(&protection(), own_pid).unwrap();
        if redirected {
            break;
        }
        thread::sleep(std::time::Duration::from_millis(100));
    }
    assert!(redirected);
    assert!(guard::windows()
        .unwrap()
        .iter()
        .any(|w| w.pid == Some(own_pid) && w.is_focused));
    assert!(guard::preflight(u32::MAX).is_err());
}
