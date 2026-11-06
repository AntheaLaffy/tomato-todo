//! macOS 窗口后端：Quartz 列举 + Accessibility 前台激活，只作用于本进程。
//!
//! 自旧 `crates/core/src/guard_macos.rs` 移植：[`windows`] 枚举普通层窗口供
//! 白名单判定，[`focus`] 把本进程自己的窗口激活到前台；激活范围始终限制在
//! 本进程内，绝不动其它应用（Public Quartz/Accessibility APIs, activation is
//! restricted to our process）。
//!
//! guard 守护进程在 macOS 上没有宿主窗口（没有可供绘制锁屏的窗口），因此
//! [`lock_window`] 始终返回明确的错误；macOS 上的专注保护只能走白名单语义
//! （[`windows`] + [`focus`]）。
//!
//! 白名单判定统一在 guard 模块的 `allowed`：本进程的窗口永远放行；其它窗口
//! 只有在 `app_id` 与白名单条目**完全相等**时才放行（app_id 是 `proc_pidpath`
//! 报告的可执行文件完整路径，不做前缀/子串匹配，避免 `code-malicious` 蹭
//! `code` 的权限）。
use super::Window;
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
    fn new(value: Ref) -> Result<Self, String> {
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
fn string(value: &str) -> Result<Owned, String> {
    let value = CString::new(value).map_err(|e| e.to_string())?;
    Owned::new(unsafe { CFStringCreateWithCString(ptr::null(), value.as_ptr(), UTF8) })
}
fn attribute(element: Ref, name: &str) -> Result<Owned, String> {
    let key = string(name)?;
    let mut value = ptr::null();
    let error = unsafe { AXUIElementCopyAttributeValue(element, key.0, &mut value) };
    if error != 0 {
        return Err(format!("macOS 无法读取 {name}（辅助功能错误 {error}）"));
    }
    Owned::new(value)
}
fn dictionary_value(dictionary: Ref, key: &str) -> Result<Ref, String> {
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
fn require_accessibility() -> Result<(), String> {
    if unsafe { AXIsProcessTrusted() } == 0 {
        return Err("请在系统设置 → 隐私与安全性 → 辅助功能中允许番茄 Todo 控制窗口".into());
    }
    Ok(())
}
fn active_pid() -> Result<i32, String> {
    let system = Owned::new(unsafe { AXUIElementCreateSystemWide() })?;
    let app = attribute(system.0, "AXFocusedApplication")?;
    let mut pid = 0;
    let error = unsafe { AXUIElementGetPid(app.0, &mut pid) };
    if error != 0 || pid <= 0 {
        return Err(format!("无法识别 macOS 前台应用（辅助功能错误 {error}）"));
    }
    Ok(pid)
}

pub fn windows() -> Result<Vec<Window>, String> {
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

/// 把 `id` 对应的窗口激活到前台。`id` 必须是本进程拥有的窗口（macOS 上
/// 不允许激活其它应用的窗口）。激活成功即确认（返回 `Ok(true)`）；macOS
/// 没有"延迟激活"的 `Ok(false)` 分支，确认失败直接报错。
///
/// 注意：guard 守护进程在 macOS 上没有宿主窗口，若本进程没有任何窗口，
/// 所有权检查会给出明确错误（`拒绝激活不存在或不属于番茄 Todo 的 macOS 窗口`）。
pub fn focus(id: u64) -> Result<bool, String> {
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
            return Ok(true);
        }
        if Instant::now() >= deadline {
            return Err("macOS 未将专注窗口切换到前台".into());
        }
        std::thread::sleep(Duration::from_millis(20));
    }
}

/// macOS 没有宿主窗口：guard 守护进程没有自己的窗口可绘制全屏锁机界面，
/// 因此锁机模式不可用，始终返回明确的错误。白名单保护仍可用（[`windows`]
/// + [`focus`]），锁机应降级为白名单模式。
pub fn lock_window() -> Result<(), String> {
    Err("macOS 上没有宿主窗口，无法全屏锁机；请改用白名单模式".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::guard::allowed;
    fn window(app: &str, pid: u32) -> Window {
        Window {
            id: 1,
            app_id: Some(app.into()),
            title: None,
            pid: Some(pid),
            is_focused: true,
        }
    }
    #[test]
    fn whitelist_matches_exact_app_ids_and_own_process() {
        let whitelist = vec!["code".into()];
        assert!(allowed(&window("code", 200), 100, &whitelist));
        assert!(!allowed(&window("code-malicious", 200), 100, &whitelist));
        assert!(allowed(&window("tomato", 100), 100, &whitelist));
        assert!(!allowed(&window("tomato", 201), 100, &whitelist));
    }
    #[test]
    fn empty_whitelist_allows_only_own_process() {
        let whitelist: Vec<String> = vec![];
        assert!(allowed(&window("code", 100), 100, &whitelist));
        assert!(!allowed(&window("code", 200), 100, &whitelist));
    }
    #[test]
    fn window_without_app_id_is_denied() {
        let whitelist = vec!["code".into()];
        let anonymous = Window {
            id: 2,
            app_id: None,
            title: None,
            pid: Some(200),
            is_focused: true,
        };
        assert!(!allowed(&anonymous, 100, &whitelist));
    }
}
