//! Read-only Win32 discovery and foreground activation of our own process.
use crate::{guard::Window, AppResult};
use windows_sys::Win32::{
    Foundation::{CloseHandle, HWND, LPARAM},
    Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED},
    Storage::Packaging::Appx::GetApplicationUserModelId,
    System::LibraryLoader::{GetModuleHandleW, GetProcAddress},
    System::Threading::{
        AttachThreadInput, GetCurrentThreadId, OpenProcess, QueryFullProcessImageNameW,
        PROCESS_QUERY_LIMITED_INFORMATION,
    },
    UI::WindowsAndMessaging::{
        EnumChildWindows, EnumWindows, GetClassNameW, GetForegroundWindow, GetWindowTextLengthW,
        GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindow, IsWindowVisible,
        PeekMessageW, SetForegroundWindow, ShowWindowAsync, MSG, PM_NOREMOVE, SW_RESTORE,
    },
};

fn pid(window: HWND) -> u32 {
    let mut pid = 0;
    unsafe {
        GetWindowThreadProcessId(window, &mut pid);
    }
    pid
}
fn appmodel_available() -> bool {
    // Wine exports an AppModel stub that aborts instead of returning an error.
    // Its desktop apps still have real process paths; native Windows uses AUMIDs.
    let ntdll: Vec<u16> = "ntdll.dll".encode_utf16().chain([0]).collect();
    unsafe {
        GetProcAddress(
            GetModuleHandleW(ntdll.as_ptr()),
            c"wine_get_version".as_ptr().cast(),
        )
        .is_none()
    }
}
fn identity(pid: u32) -> Option<String> {
    unsafe {
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if process.is_null() {
            return None;
        }
        let mut app_id = vec![0u16; 4096];
        let mut app_length = app_id.len() as u32;
        if appmodel_available()
            && GetApplicationUserModelId(process, &mut app_length, app_id.as_mut_ptr()) == 0
            && app_length > 1
        {
            CloseHandle(process);
            return String::from_utf16(&app_id[..app_length as usize - 1])
                .ok()
                .map(|id| format!("aumid:{id}"));
        }
        let mut buffer = vec![0u16; 32768];
        let mut length = buffer.len() as u32;
        let success = QueryFullProcessImageNameW(process, 0, buffer.as_mut_ptr(), &mut length);
        CloseHandle(process);
        if success == 0 {
            return None;
        }
        // Keep the full path exactly as the OS reports it. Basenames would merge
        // unrelated apps, and case folding can merge files in case-sensitive folders.
        String::from_utf16(&buffer[..length as usize]).ok()
    }
}
struct FrameContent {
    host: u32,
    pid: Option<u32>,
}
unsafe extern "system" fn content(window: HWND, context: LPARAM) -> i32 {
    let frame = &mut *(context as *mut FrameContent);
    let mut class = [0u16; 128];
    let length = GetClassNameW(window, class.as_mut_ptr(), class.len() as i32);
    if length > 0
        && String::from_utf16_lossy(&class[..length as usize]) == "Windows.UI.Core.CoreWindow"
    {
        let candidate = pid(window);
        if candidate != 0 && candidate != frame.host {
            frame.pid = Some(candidate);
            return 0;
        }
    }
    1
}
struct Enumeration {
    foreground: HWND,
    windows: Vec<Window>,
}
unsafe extern "system" fn collect(window: HWND, context: LPARAM) -> i32 {
    if IsWindowVisible(window) == 0 {
        return 1;
    }
    let mut cloaked = 0u32;
    if DwmGetWindowAttribute(
        window,
        DWMWA_CLOAKED as u32,
        (&mut cloaked as *mut u32).cast(),
        4,
    ) >= 0
        && cloaked != 0
    {
        return 1;
    }
    let mut pid = pid(window);
    let mut app_id = identity(pid);
    // Older UWP apps have a shared frame process. Identify its actual app child;
    // never grant all hosted apps permission through ApplicationFrameHost.exe.
    if app_id.as_ref().is_some_and(|id| {
        id.rsplit('\\')
            .next()
            .is_some_and(|name| name.eq_ignore_ascii_case("ApplicationFrameHost.exe"))
    }) {
        let mut frame = FrameContent {
            host: pid,
            pid: None,
        };
        EnumChildWindows(
            window,
            Some(content),
            (&mut frame as *mut FrameContent) as LPARAM,
        );
        app_id = frame.pid.and_then(identity);
        if let Some(content_pid) = frame.pid {
            pid = content_pid;
        }
    }
    let mut title = vec![0u16; (GetWindowTextLengthW(window).clamp(0, 32767) + 1) as usize];
    let length = GetWindowTextW(window, title.as_mut_ptr(), title.len() as i32);
    let title = (length > 0).then(|| String::from_utf16_lossy(&title[..length as usize]));
    // EnumWindows invokes this callback synchronously; the caller's enumeration remains
    // exclusively borrowed and alive until enumeration returns.
    let enumeration = &mut *(context as *mut Enumeration);
    enumeration.windows.push(Window {
        id: window as usize as u64,
        app_id,
        title,
        pid: (pid != 0).then_some(pid),
        is_focused: enumeration.foreground == window,
    });
    1
}
pub fn windows() -> AppResult<Vec<Window>> {
    unsafe {
        let foreground = GetForegroundWindow();
        if foreground.is_null() {
            return Err("当前 Windows 桌面没有可访问的前台窗口".into());
        }
        let mut enumeration = Enumeration {
            foreground,
            windows: Vec::new(),
        };
        if EnumWindows(
            Some(collect),
            (&mut enumeration as *mut Enumeration) as LPARAM,
        ) == 0
        {
            return Err(format!(
                "无法读取 Windows 窗口：{}",
                std::io::Error::last_os_error()
            ));
        }
        if !enumeration.windows.iter().any(|w| w.is_focused) {
            return Err("当前 Windows 前台窗口不可访问".into());
        }
        Ok(enumeration.windows)
    }
}

struct InputLink(u32, u32);
impl Drop for InputLink {
    fn drop(&mut self) {
        unsafe {
            AttachThreadInput(self.0, self.1, 0);
        }
    }
}
fn link(from: u32, to: u32) -> Option<InputLink> {
    (from != to && to != 0 && unsafe { AttachThreadInput(from, to, 1) } != 0)
        .then(|| InputLink(from, to))
}
pub fn focus(id: u64) -> AppResult<()> {
    let window = usize::try_from(id).map_err(|e| e.to_string())? as HWND;
    unsafe {
        if IsWindow(window) == 0 || pid(window) != std::process::id() {
            return Err("专注窗口已关闭或进程已变化".into());
        }
        if IsIconic(window) != 0 {
            ShowWindowAsync(window, SW_RESTORE);
        }
        if SetForegroundWindow(window) != 0 && pid(GetForegroundWindow()) == std::process::id() {
            return Ok(());
        }
        // The timer runs off the UI thread. Give it a message queue and briefly
        // share input with our UI and foreground thread; restore both links on exit.
        let mut message: MSG = std::mem::zeroed();
        PeekMessageW(&mut message, std::ptr::null_mut(), 0, 0, PM_NOREMOVE);
        let current = GetCurrentThreadId();
        let ui = GetWindowThreadProcessId(window, std::ptr::null_mut());
        let foreground = GetWindowThreadProcessId(GetForegroundWindow(), std::ptr::null_mut());
        let _ui = link(current, ui);
        let _foreground = if foreground != ui {
            link(current, foreground)
        } else {
            None
        };
        if SetForegroundWindow(window) == 0 || pid(GetForegroundWindow()) != std::process::id() {
            return Err("Windows 拒绝了前台激活请求，已停止窗口保护".into());
        }
    }
    Ok(())
}
