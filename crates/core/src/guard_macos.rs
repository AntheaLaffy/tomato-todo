//! Public Quartz/Accessibility APIs; activation is restricted to our process.
use super::Window;
use crate::AppResult;
use std::{
    ffi::{c_char, c_void, CStr, CString},
    ptr,
    time::{Duration, Instant},
};

type Ref = *const c_void;
const UTF8: u32 = 0x0800_0100;

#[link(name = "CoreFoundation", kind = "framework")]
unsafe extern "C" {
    fn CFRelease(value: Ref);
    fn CFGetTypeID(value: Ref) -> usize;
    fn CFArrayGetTypeID() -> usize;
    fn CFArrayGetCount(array: Ref) -> isize;
    fn CFArrayGetValueAtIndex(array: Ref, index: isize) -> Ref;
    fn CFDictionaryGetTypeID() -> usize;
    fn CFDictionaryGetValue(dictionary: Ref, key: Ref) -> Ref;
    fn CFBooleanGetTypeID() -> usize;
    fn CFBooleanGetValue(boolean: Ref) -> u8;
    fn CFNumberGetTypeID() -> usize;
    fn CFNumberGetValue(number: Ref, kind: isize, value: *mut c_void) -> u8;
    fn CFStringGetTypeID() -> usize;
    fn CFStringCreateWithCString(allocator: Ref, value: *const c_char, encoding: u32) -> Ref;
    fn CFStringGetLength(string: Ref) -> isize;
    fn CFStringGetMaximumSizeForEncoding(length: isize, encoding: u32) -> isize;
    fn CFStringGetCString(string: Ref, buffer: *mut c_char, size: isize, encoding: u32) -> u8;
    static kCFBooleanTrue: Ref;
    static kCFBooleanFalse: Ref;
}

#[link(name = "CoreGraphics", kind = "framework")]
unsafe extern "C" {
    fn CGWindowListCopyWindowInfo(options: u32, relative: u32) -> Ref;
}

#[link(name = "ApplicationServices", kind = "framework")]
unsafe extern "C" {
    fn AXIsProcessTrusted() -> u8;
    fn AXUIElementCreateSystemWide() -> Ref;
    fn AXUIElementCreateApplication(pid: i32) -> Ref;
    fn AXUIElementCopyAttributeValue(element: Ref, attribute: Ref, value: *mut Ref) -> i32;
    fn AXUIElementGetPid(element: Ref, pid: *mut i32) -> i32;
    fn AXUIElementSetAttributeValue(element: Ref, attribute: Ref, value: Ref) -> i32;
    fn AXUIElementPerformAction(element: Ref, action: Ref) -> i32;
}

#[link(name = "proc")]
unsafe extern "C" {
    fn proc_pidpath(pid: i32, buffer: *mut c_void, size: u32) -> i32;
}

// Create/Copy results belong to the caller; dictionary/array values remain
// borrowed for the lifetime of their owning snapshot.
struct Owned(Ref);
impl Owned {
    fn new(value: Ref) -> AppResult<Self> {
        if value.is_null() {
            Err("macOS 窗口接口返回空对象".into())
        } else {
            Ok(Self(value))
        }
    }
}
impl Drop for Owned {
    fn drop(&mut self) {
        unsafe { CFRelease(self.0) }
    }
}
fn string(value: &str) -> AppResult<Owned> {
    let value = CString::new(value).map_err(|e| e.to_string())?;
    Owned::new(unsafe { CFStringCreateWithCString(ptr::null(), value.as_ptr(), UTF8) })
}
fn attribute(element: Ref, name: &str) -> AppResult<Owned> {
    let key = string(name)?;
    let mut value = ptr::null();
    let error = unsafe { AXUIElementCopyAttributeValue(element, key.0, &mut value) };
    if error != 0 {
        return Err(format!("macOS 无法读取 {name}（辅助功能错误 {error}）"));
    }
    Owned::new(value)
}
fn dictionary_value(dictionary: Ref, key: &str) -> AppResult<Ref> {
    let key = string(key)?;
    Ok(unsafe { CFDictionaryGetValue(dictionary, key.0) })
}
fn number(value: Ref) -> Option<i64> {
    if value.is_null() || unsafe { CFGetTypeID(value) != CFNumberGetTypeID() } {
        return None;
    }
    let mut result = 0i64;
    // kCFNumberSInt64Type = 4.
    (unsafe { CFNumberGetValue(value, 4, (&mut result as *mut i64).cast()) } != 0).then_some(result)
}
fn text(value: Ref) -> Option<String> {
    if value.is_null() || unsafe { CFGetTypeID(value) != CFStringGetTypeID() } {
        return None;
    }
    let size = unsafe { CFStringGetMaximumSizeForEncoding(CFStringGetLength(value), UTF8) }
        .checked_add(1)?;
    let mut buffer = vec![0u8; usize::try_from(size).ok()?];
    if unsafe { CFStringGetCString(value, buffer.as_mut_ptr().cast(), size, UTF8) } == 0 {
        return None;
    }
    CStr::from_bytes_until_nul(&buffer)
        .ok()
        .map(|value| value.to_string_lossy().into_owned())
}
fn app_id(pid: i32) -> Option<String> {
    let mut buffer = [0u8; 4096]; // PROC_PIDPATHINFO_MAXSIZE.
    if unsafe { proc_pidpath(pid, buffer.as_mut_ptr().cast(), buffer.len() as u32) } <= 0 {
        return None;
    }
    CStr::from_bytes_until_nul(&buffer)
        .ok()
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned)
}
fn require_accessibility() -> AppResult<()> {
    if unsafe { AXIsProcessTrusted() } == 0 {
        return Err("请在系统设置 → 隐私与安全性 → 辅助功能中允许番茄 Todo 控制窗口".into());
    }
    Ok(())
}
fn active_pid() -> AppResult<i32> {
    let system = Owned::new(unsafe { AXUIElementCreateSystemWide() })?;
    let app = attribute(system.0, "AXFocusedApplication")?;
    let mut pid = 0;
    let error = unsafe { AXUIElementGetPid(app.0, &mut pid) };
    if error != 0 || pid <= 0 {
        return Err(format!("无法识别 macOS 前台应用（辅助功能错误 {error}）"));
    }
    Ok(pid)
}

pub(super) fn windows() -> AppResult<Vec<Window>> {
    require_accessibility()?;
    let active = active_pid()?;
    // Include minimized/other-Space windows so changing Spaces does not erase
    // our activation target. Only an on-screen window can count as focused.
    let list = Owned::new(unsafe { CGWindowListCopyWindowInfo(16, 0) })?;
    if unsafe { CFGetTypeID(list.0) != CFArrayGetTypeID() } {
        return Err("macOS 窗口列表格式错误".into());
    }
    let mut result = Vec::new();
    let mut focused = false;
    for index in 0..unsafe { CFArrayGetCount(list.0) } {
        let entry = unsafe { CFArrayGetValueAtIndex(list.0, index) };
        if entry.is_null() || unsafe { CFGetTypeID(entry) != CFDictionaryGetTypeID() } {
            continue;
        }
        if number(dictionary_value(entry, "kCGWindowLayer")?) != Some(0) {
            continue;
        }
        let Some(pid) = number(dictionary_value(entry, "kCGWindowOwnerPID")?)
            .and_then(|pid| i32::try_from(pid).ok())
            .filter(|pid| *pid > 0)
        else {
            continue;
        };
        let Some(id) = number(dictionary_value(entry, "kCGWindowNumber")?)
            .and_then(|id| u32::try_from(id).ok())
            .filter(|id| *id != 0)
        else {
            continue;
        };
        // Quartz lists windows from front to back. Protection matches apps,
        // so the frontmost normal window represents the active application.
        let visible = dictionary_value(entry, "kCGWindowIsOnscreen")?;
        let on_screen = !visible.is_null()
            && unsafe {
                CFGetTypeID(visible) == CFBooleanGetTypeID() && CFBooleanGetValue(visible) != 0
            };
        let is_focused = pid == active && on_screen && !focused;
        focused |= is_focused;
        result.push(Window {
            id: id.into(),
            app_id: app_id(pid),
            // macOS may omit titles without screen-recording permission.
            title: text(dictionary_value(entry, "kCGWindowName")?),
            pid: Some(pid as u32),
            is_focused,
        });
    }
    if !focused {
        // Menus and apps with no normal window still count as a foreground
        // app; their absence must not silently bypass whitelist enforcement.
        result.push(Window {
            id: 0,
            app_id: app_id(active),
            title: None,
            pid: Some(active as u32),
            is_focused: true,
        });
    }
    Ok(result)
}

pub(super) fn focus(id: u64) -> AppResult<()> {
    let own_pid = std::process::id();
    if id == 0
        || !windows()?
            .iter()
            .any(|w| w.id == id && w.pid == Some(own_pid))
    {
        return Err("拒绝激活不存在或不属于番茄 Todo 的 macOS 窗口".into());
    }
    let app = Owned::new(unsafe { AXUIElementCreateApplication(own_pid as i32) })?;
    let window =
        attribute(app.0, "AXMainWindow").or_else(|_| attribute(app.0, "AXFocusedWindow"))?;
    let minimized = string("AXMinimized")?;
    // Already-restored windows may not expose a settable minimized attribute.
    let _ = unsafe { AXUIElementSetAttributeValue(window.0, minimized.0, kCFBooleanFalse) };
    let frontmost = string("AXFrontmost")?;
    let error = unsafe { AXUIElementSetAttributeValue(app.0, frontmost.0, kCFBooleanTrue) };
    if error != 0 {
        return Err(format!("macOS 拒绝激活专注应用（辅助功能错误 {error}）"));
    }
    let raise = string("AXRaise")?;
    let error = unsafe { AXUIElementPerformAction(window.0, raise.0) };
    if error != 0 {
        return Err(format!("macOS 无法显示专注窗口（辅助功能错误 {error}）"));
    }
    let deadline = Instant::now() + Duration::from_millis(500);
    loop {
        if windows()?
            .iter()
            .any(|w| w.id != 0 && w.pid == Some(own_pid) && w.is_focused)
        {
            return Ok(());
        }
        if Instant::now() >= deadline {
            return Err("macOS 未将专注窗口切换到前台".into());
        }
        std::thread::sleep(Duration::from_millis(20));
    }
}
