#![cfg(target_os = "windows")]

use std::{
    process::{Child, Command},
    thread::sleep,
    time::{Duration, Instant},
};
use tomato_core::{guard, GuardMode, Protection};
use windows_sys::Win32::{
    Foundation::HWND,
    System::{
        LibraryLoader::GetModuleHandleW,
        Threading::{AttachThreadInput, GetCurrentThreadId},
    },
    UI::WindowsAndMessaging::{
        AllowSetForegroundWindow, CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW,
        GetForegroundWindow, GetWindowThreadProcessId, PeekMessageW, RegisterClassW,
        SetForegroundWindow, MSG, PM_REMOVE, WNDCLASSW, WS_OVERLAPPEDWINDOW, WS_VISIBLE,
    },
};

fn window(title: &str) -> HWND {
    let wide = |text: &str| text.encode_utf16().chain([0]).collect::<Vec<_>>();
    let class = wide("TomatoIsolatedGuardTest");
    let title = wide(title);
    unsafe {
        let instance = GetModuleHandleW(std::ptr::null());
        let registration = WNDCLASSW {
            hInstance: instance,
            lpfnWndProc: Some(DefWindowProcW),
            lpszClassName: class.as_ptr(),
            ..Default::default()
        };
        assert_ne!(RegisterClassW(&registration), 0);
        let window = CreateWindowExW(
            0,
            class.as_ptr(),
            title.as_ptr(),
            WS_OVERLAPPEDWINDOW | WS_VISIBLE,
            20,
            20,
            320,
            220,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            instance,
            std::ptr::null(),
        );
        assert!(!window.is_null());
        window
    }
}
fn pump() {
    unsafe {
        let mut message: MSG = std::mem::zeroed();
        while PeekMessageW(&mut message, std::ptr::null_mut(), 0, 0, PM_REMOVE) != 0 {
            DispatchMessageW(&message);
        }
    }
}
fn until(mut condition: impl FnMut() -> bool) {
    let start = Instant::now();
    while !condition() {
        assert!(
            start.elapsed() < Duration::from_secs(10),
            "Windows condition did not arrive"
        );
        pump();
        sleep(Duration::from_millis(20));
    }
}
struct Fixture(Child);
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

#[test]
#[ignore = "helper process, launched only by the isolated Windows guard test"]
fn fixture_window() {
    assert_eq!(
        std::env::var("TOMATO_WINDOWS_TEST_ISOLATED").as_deref(),
        Ok("1")
    );
    let title = std::env::var("TOMATO_WINDOWS_FIXTURE_TITLE").unwrap();
    let _window = window(&title);
    pump();
    std::fs::write(
        std::env::var("TOMATO_WINDOWS_FIXTURE_READY").unwrap(),
        "ready",
    )
    .unwrap();
    let controller: u32 = std::env::var("TOMATO_WINDOWS_TEST_CONTROLLER")
        .unwrap()
        .parse()
        .unwrap();
    loop {
        unsafe {
            AllowSetForegroundWindow(controller);
        }
        pump();
        sleep(Duration::from_millis(10));
    }
}

#[test]
#[ignore = "requires an isolated Windows desktop, or the fresh Wine/Xvfb prefix from tests/windows.mjs"]
fn real_win32_windows_focus_whitelist_and_failure() {
    assert_eq!(
        std::env::var("TOMATO_WINDOWS_TEST_ISOLATED").as_deref(),
        Ok("1")
    );
    let root = tempfile::tempdir().unwrap();
    let launch = |name: &str| {
        let folder = root
            .path()
            .join(format!("{name}-{}", "directory".repeat(15)));
        std::fs::create_dir(&folder).unwrap();
        let exe = folder.join("tool.exe");
        std::fs::copy(std::env::current_exe().unwrap(), &exe).unwrap();
        let child = Command::new(exe)
            .args(["--ignored", "--exact", "fixture_window", "--nocapture"])
            .env("TOMATO_WINDOWS_FIXTURE_TITLE", name)
            .env(
                "TOMATO_WINDOWS_FIXTURE_READY",
                root.path().join(format!("{name}.ready")),
            )
            .env(
                "TOMATO_WINDOWS_TEST_CONTROLLER",
                std::process::id().to_string(),
            )
            .spawn()
            .unwrap();
        Fixture(child)
    };
    let own = window("Tomato-Win32-Own");
    let own_pid = std::process::id();
    let allowed = launch("Tomato-Win32-Allowed");
    let blocked = launch("Tomato-Win32-Blocked");
    until(|| {
        root.path().join("Tomato-Win32-Allowed.ready").exists()
            && root.path().join("Tomato-Win32-Blocked.ready").exists()
    });
    until(|| {
        guard::windows().is_ok_and(|windows| {
            windows.iter().any(|w| w.pid == Some(allowed.0.id()))
                && windows.iter().any(|w| w.pid == Some(blocked.0.id()))
        })
    });
    let info = guard::info();
    assert_eq!(info.backend, "Win32 / Windows");
    let allow = info
        .windows
        .iter()
        .find(|w| w.pid == Some(allowed.0.id()))
        .unwrap();
    let block = info
        .windows
        .iter()
        .find(|w| w.pid == Some(blocked.0.id()))
        .unwrap();
    assert_ne!(allow.app_id, block.app_id);
    assert!(allow.app_id.as_ref().unwrap().len() > 200);
    assert!(allow.app_id.as_deref().unwrap().ends_with("tool.exe"));
    assert!(std::path::Path::new(allow.app_id.as_ref().unwrap()).is_absolute());
    assert!(info
        .windows
        .iter()
        .any(|w| w.pid == Some(own_pid) && w.title.as_deref() == Some("Tomato-Win32-Own")));
    guard::preflight(own_pid).unwrap();
    let focus = |id| {
        let target = id as usize as HWND;
        until(|| {
            unsafe {
                let current = GetCurrentThreadId();
                let foreground =
                    GetWindowThreadProcessId(GetForegroundWindow(), std::ptr::null_mut());
                let target_thread = GetWindowThreadProcessId(target, std::ptr::null_mut());
                let foreground_link =
                    foreground != current && AttachThreadInput(current, foreground, 1) != 0;
                let target_link = target_thread != current
                    && target_thread != foreground
                    && AttachThreadInput(current, target_thread, 1) != 0;
                SetForegroundWindow(target);
                if target_link {
                    AttachThreadInput(current, target_thread, 0);
                }
                if foreground_link {
                    AttachThreadInput(current, foreground, 0);
                }
            }
            pump();
            guard::windows().is_ok_and(|windows| windows.iter().any(|w| w.id == id && w.is_focused))
        });
    };
    let mut protection = Protection {
        mode: GuardMode::Whitelist,
        whitelist: vec![allow.app_id.clone().unwrap()],
        strict: false,
    };
    focus(allow.id);
    assert!(!guard::enforce(&protection, own_pid).unwrap());
    focus(block.id);
    // Exercise the same background thread used by the desktop timer.
    let copy = protection.clone();
    let worker = std::thread::spawn(move || guard::enforce(&copy, own_pid));
    until(|| worker.is_finished());
    assert!(worker.join().unwrap().unwrap());
    until(|| {
        guard::windows().is_ok_and(|windows| {
            windows
                .iter()
                .any(|w| w.pid == Some(own_pid) && w.is_focused)
        })
    });
    protection.mode = GuardMode::Lock;
    focus(allow.id);
    assert!(guard::enforce(&protection, own_pid).unwrap());
    focus(block.id);
    protection.mode = GuardMode::Off;
    assert!(!guard::enforce(&protection, own_pid).unwrap());
    guard::focus_own(own_pid).unwrap();
    unsafe {
        DestroyWindow(own);
    }
    focus(block.id);
    protection.mode = GuardMode::Lock;
    assert_eq!(
        guard::enforce(&protection, own_pid).unwrap_err(),
        "专注窗口已关闭"
    );
}
