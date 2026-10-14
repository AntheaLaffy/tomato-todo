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
    UI::{
        Input::KeyboardAndMouse::{
            GetAsyncKeyState, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT,
            KEYEVENTF_KEYUP, VK_CONTROL, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT,
        },
        WindowsAndMessaging::{
            EnumChildWindows, EnumWindows, GetClassNameW, GetForegroundWindow,
            GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindow,
            IsWindowVisible, PeekMessageW, SendMessageTimeoutW, SetForegroundWindow,
            ShowWindowAsync, MSG, PM_NOREMOVE, SMTO_ABORTIFHUNG, SW_RESTORE, WM_NULL,
        },
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
        Ok(enumeration.windows)
    }
}

fn modifier_pressed() -> bool {
    [VK_MENU, VK_CONTROL, VK_SHIFT, VK_LWIN, VK_RWIN]
        .into_iter()
        .any(|key| unsafe { GetAsyncKeyState(i32::from(key)) } < 0)
}
struct InputLink(u32, u32);
impl Drop for InputLink {
    fn drop(&mut self) {
        unsafe {
            AttachThreadInput(self.0, self.1, 0);
        }
    }
}
fn activate(window: HWND) -> bool {
    unsafe {
        if SetForegroundWindow(window) != 0 {
            // Foreground activation across input queues is asynchronous. Give
            // the UI a short chance to handle it before confirming a redirect.
            SendMessageTimeoutW(
                window,
                WM_NULL,
                0,
                0,
                SMTO_ABORTIFHUNG,
                100,
                std::ptr::null_mut(),
            );
        }
        pid(GetForegroundWindow()) == std::process::id()
    }
}
pub fn focus(id: u64) -> AppResult<bool> {
    let window = usize::try_from(id).map_err(|e| e.to_string())? as HWND;
    unsafe {
        if IsWindow(window) == 0 || pid(window) != std::process::id() {
            return Err("专注窗口已关闭或进程已变化".into());
        }
        if pid(GetForegroundWindow()) == std::process::id() {
            return Ok(true);
        }
        if modifier_pressed() {
            return Ok(false);
        }
        // The protection timer runs outside the UI thread and needs its own queue.
        let mut message: MSG = std::mem::zeroed();
        PeekMessageW(&mut message, std::ptr::null_mut(), 0, 0, PM_NOREMOVE);
        if IsIconic(window) != 0 {
            ShowWindowAsync(window, SW_RESTORE);
        }
        if activate(window) {
            return Ok(true);
        }
        if modifier_pressed() {
            return Ok(false);
        }
        // ALT releases the foreground lock. Avoid combining it with held user
        // modifiers, and keep a denied activation pending for the next guard tick.
        let inputs = [0, KEYEVENTF_KEYUP].map(|flags| INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VK_MENU,
                    dwFlags: flags,
                    ..Default::default()
                },
            },
        });
        let sent = SendInput(2, inputs.as_ptr(), std::mem::size_of::<INPUT>() as i32);
        if sent != 2 {
            if sent == 1 {
                SendInput(1, &inputs[1], std::mem::size_of::<INPUT>() as i32);
            }
            return Ok(false);
        }
        if activate(window) {
            return Ok(true);
        }
        let foreground = GetForegroundWindow();
        let current = GetCurrentThreadId();
        let thread = GetWindowThreadProcessId(foreground, std::ptr::null_mut());
        if thread == 0 || thread == current || modifier_pressed() {
            return Ok(false);
        }
        // Queue attachment makes activation synchronous with the previous app.
        // Leave unresponsive windows alone and always detach before returning.
        if SendMessageTimeoutW(
            foreground,
            WM_NULL,
            0,
            0,
            SMTO_ABORTIFHUNG,
            100,
            std::ptr::null_mut(),
        ) == 0
            || AttachThreadInput(current, thread, 1) == 0
        {
            return Ok(false);
        }
        let _input = InputLink(current, thread);
        Ok(activate(window))
    }
}
