#![cfg(target_os = "windows")]

use std::{
    process::{Child, Command},
    thread::sleep,
    time::{Duration, Instant},
};
use tomato_core::{guard, GuardMode, Protection};
use windows_sys::Win32::{
    Foundation::{HWND, RECT},
    System::LibraryLoader::GetModuleHandleW,
    UI::{
        Input::KeyboardAndMouse::{
            GetAsyncKeyState, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, INPUT_MOUSE, KEYBDINPUT,
            KEYEVENTF_KEYUP, MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP, MOUSEINPUT, VK_MENU,
            VK_SHIFT,
        },
        WindowsAndMessaging::{
            CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, GetForegroundWindow,
            GetWindowRect, LockSetForegroundWindow, PeekMessageW, RegisterClassW, SetCursorPos,
            LSFW_LOCK, MSG, PM_REMOVE, WNDCLASSW, WS_OVERLAPPEDWINDOW, WS_VISIBLE,
        },
    },
};

fn window(title: &str, left: i32) -> HWND {
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
            left,
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
#[track_caller]
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
    let fixture = window(
        &title,
        std::env::var("TOMATO_WINDOWS_FIXTURE_LEFT")
            .unwrap()
            .parse()
            .unwrap(),
    );
    pump();
    std::fs::write(
        std::env::var("TOMATO_WINDOWS_FIXTURE_READY").unwrap(),
        "ready",
    )
    .unwrap();
    let lock_request =
        std::path::PathBuf::from(std::env::var("TOMATO_WINDOWS_FIXTURE_LOCK").unwrap());
    loop {
        unsafe {
            if lock_request.exists() && GetForegroundWindow() == fixture {
                assert_ne!(LockSetForegroundWindow(LSFW_LOCK), 0);
                std::fs::rename(&lock_request, lock_request.with_extension("locked")).unwrap();
            }
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
    let launch = |name: &str, left: i32| {
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
                "TOMATO_WINDOWS_FIXTURE_LOCK",
                root.path().join(format!("{name}.lock")),
            )
            .env("TOMATO_WINDOWS_FIXTURE_LEFT", left.to_string())
            .spawn()
            .unwrap();
        Fixture(child)
    };
    let own = window("Tomato-Win32-Own", 20);
    let own_pid = std::process::id();
    let allowed = launch("Tomato-Win32-Allowed", 380);
    let blocked = launch("Tomato-Win32-Blocked", 740);
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
                let mut bounds: RECT = std::mem::zeroed();
                assert_ne!(GetWindowRect(target, &mut bounds), 0);
                assert_ne!(SetCursorPos(bounds.left + 80, bounds.top + 80), 0);
                let inputs = [MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP].map(|flags| INPUT {
                    r#type: INPUT_MOUSE,
                    Anonymous: INPUT_0 {
                        mi: MOUSEINPUT {
                            dwFlags: flags,
                            ..Default::default()
                        },
                    },
                });
                assert_eq!(
                    SendInput(2, inputs.as_ptr(), std::mem::size_of::<INPUT>() as i32),
                    2
                );
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
    let lock_request = root.path().join("Tomato-Win32-Blocked.lock");
    std::fs::write(&lock_request, "lock").unwrap();
    until(|| lock_request.with_extension("locked").exists());
    let shift = |flags| unsafe {
        let input = INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VK_SHIFT,
                    dwFlags: flags,
                    ..Default::default()
                },
            },
        };
        assert_eq!(SendInput(1, &input, std::mem::size_of::<INPUT>() as i32), 1);
    };
    let enforce_background = |protection: &Protection| {
        let copy = protection.clone();
        let worker = std::thread::spawn(move || guard::enforce(&copy, own_pid));
        until(|| worker.is_finished());
        worker.join().unwrap()
    };
    shift(0);
    pump();
    let deferred = enforce_background(&protection);
    shift(KEYEVENTF_KEYUP);
    assert!(!deferred.unwrap());
    assert_eq!(unsafe { GetForegroundWindow() }, block.id as usize as HWND);
    until(|| enforce_background(&protection).unwrap());
    until(|| {
        guard::windows().is_ok_and(|windows| {
            windows
                .iter()
                .any(|w| w.pid == Some(own_pid) && w.is_focused)
        })
    });
    for _ in 0..3 {
        focus(block.id);
        until(|| enforce_background(&protection).unwrap());
        assert!(unsafe { GetAsyncKeyState(i32::from(VK_MENU)) } >= 0);
        assert!(unsafe { GetAsyncKeyState(i32::from(VK_SHIFT)) } >= 0);
    }
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
