// Win32 只读窗口发现、前台激活与 guard 自己的全屏锁窗。
// 移植自旧 crates/core/src/guard_windows.rs。
// 已移植：窗口枚举与前台激活逐行照搬旧实现；lock_window 为新增的
// guard 自建全屏锁窗（WS_POPUP 覆盖虚拟屏、番茄红背景、无输入抓取），
// 替代旧应用「把 Tauri 窗 focus 回去」的语义。
use super::{AppResult, LockWindow, Window};
use windows_sys::Win32::{
    Foundation::{CloseHandle, HWND, LPARAM, LRESULT, WPARAM},
    Graphics::{
        Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED},
        Gdi::{CreateSolidBrush, DeleteObject},
    },
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
            CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, EnumChildWindows,
            EnumWindows, GetClassNameW, GetForegroundWindow, GetMessageW, GetSystemMetrics,
            GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindow,
            IsWindowVisible, PeekMessageW, PostMessageW, PostQuitMessage, RegisterClassW,
            SendMessageTimeoutW, SetForegroundWindow, ShowWindowAsync, TranslateMessage,
            UnregisterClassW, MSG, PM_NOREMOVE, SMTO_ABORTIFHUNG, SM_CXVIRTUALSCREEN,
            SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN, SW_RESTORE, WM_CLOSE,
            WM_DESTROY, WM_NULL, WNDCLASSW, WS_POPUP, WS_VISIBLE,
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
        let target = pid(window);
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
        pid(GetForegroundWindow()) == target
    }
}
pub fn focus(id: u64) -> AppResult<bool> {
    let window = usize::try_from(id).map_err(|e| e.to_string())? as HWND;
    unsafe {
        if IsWindow(window) == 0 {
            return Err("目标窗口已关闭".into());
        }
        let target = pid(window);
        if pid(GetForegroundWindow()) == target {
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

/// 锁窗的窗口过程：WM_DESTROY 时结束消息循环，其余交给默认处理
/// （默认处理会响应 WM_CLOSE 并销毁窗口）。
unsafe extern "system" fn lock_proc(
    window: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if message == WM_DESTROY {
        PostQuitMessage(0);
        0
    } else {
        DefWindowProcW(window, message, wparam, lparam)
    }
}

/// guard 自建的全屏锁窗句柄：被丢弃时关窗并回收消息泵线程。
/// hwnd 存 usize 而非 HWND：0.61 的 HWND 是 `*mut c_void` 裸指针，
/// 自身不满足 Send；窗口句柄进程级有效，转 usize 保持语义且满足
/// `LockWindow: Send`（enforce 循环在别的线程拿着它）。
pub struct Win32LockWindow {
    hwnd: usize,
    thread: Option<std::thread::JoinHandle<()>>,
}

impl LockWindow for Win32LockWindow {}

impl Drop for Win32LockWindow {
    fn drop(&mut self) {
        let window = self.hwnd as HWND;
        unsafe {
            // 窗口若已被外力销毁，句柄不再有效，跳过投递。
            if IsWindow(window) != 0 {
                // WM_CLOSE → DefWindowProcW → DestroyWindow → WM_DESTROY →
                // lock_proc → PostQuitMessage → 泵线程退出。
                PostMessageW(window, WM_CLOSE, 0, 0);
            }
        }
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

/// 创建并显示 guard 自己的全屏锁窗（覆盖整个虚拟屏，番茄红背景）。
/// 无输入抓取：enforce 循环每 600ms 把白名单外的前台窗口切回本窗，
/// 与旧实现「把 Tauri 窗 focus 回去」的语义一致。
pub fn lock_window() -> AppResult<Win32LockWindow> {
    unsafe {
        let instance = GetModuleHandleW(std::ptr::null());
        if instance.is_null() {
            return Err(format!(
                "无法取得本进程模块句柄：{}",
                std::io::Error::last_os_error()
            ));
        }
        let class: Vec<u16> = "TomatoGuardLock".encode_utf16().chain([0]).collect();
        // 番茄红 #D96D55 写成 COLORREF（0x00BBGGRR）。类注册后系统持有该画刷，
        // 注册失败则类从未引用它，需自行释放。
        let brush = CreateSolidBrush(0x00_55_6D_D9);
        if RegisterClassW(&WNDCLASSW {
            style: 0,
            lpfnWndProc: Some(lock_proc),
            cbClsExtra: 0,
            cbWndExtra: 0,
            hInstance: instance,
            hIcon: std::ptr::null_mut(),
            hCursor: std::ptr::null_mut(),
            hbrBackground: brush,
            lpszMenuName: std::ptr::null(),
            lpszClassName: class.as_ptr(),
        }) == 0
        {
            DeleteObject(brush);
            return Err(format!(
                "无法注册锁窗窗口类：{}",
                std::io::Error::last_os_error()
            ));
        }
        let title: Vec<u16> = "番茄 Todo 专注锁定".encode_utf16().chain([0]).collect();
        let hwnd = CreateWindowExW(
            0,
            class.as_ptr(),
            title.as_ptr(),
            WS_POPUP | WS_VISIBLE,
            GetSystemMetrics(SM_XVIRTUALSCREEN),
            GetSystemMetrics(SM_YVIRTUALSCREEN),
            GetSystemMetrics(SM_CXVIRTUALSCREEN),
            GetSystemMetrics(SM_CYVIRTUALSCREEN),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            instance,
            std::ptr::null(),
        );
        if hwnd.is_null() {
            UnregisterClassW(class.as_ptr(), instance);
            DeleteObject(brush);
            return Err(format!(
                "无法创建全屏锁窗：{}",
                std::io::Error::last_os_error()
            ));
        }
        let thread = match std::thread::Builder::new()
            .name("tomato-guard-lock".into())
            .spawn(move || {
                let mut message: MSG = std::mem::zeroed();
                loop {
                    // GetMessageW 返回 0 即 WM_QUIT，负值表示出错，都退出。
                    if GetMessageW(&mut message, std::ptr::null_mut(), 0, 0) <= 0 {
                        break;
                    }
                    TranslateMessage(&message);
                    DispatchMessageW(&message);
                }
            }) {
            Ok(thread) => thread,
            Err(e) => {
                // 没有消息泵的窗口只能白占一个前台遮挡，销毁并撤销类。
                DestroyWindow(hwnd);
                UnregisterClassW(class.as_ptr(), instance);
                DeleteObject(brush);
                return Err(format!("无法启动锁窗消息线程：{e}"));
            }
        };
        Ok(Win32LockWindow {
            hwnd: hwnd as usize,
            thread: Some(thread),
        })
    }
}
