//! Win32 只读窗口发现、前台激活与 guard 自己的全屏锁窗。
//! 移植自旧 crates/core/src/guard_windows.rs。
//! 状态：待移植（stub，由切分后的代理或本代理后续填充；接口已定，勿改签名）。
use super::{AppResult, LockWindow, Window};

pub struct Win32LockWindow;

impl LockWindow for Win32LockWindow {}

pub fn windows() -> AppResult<Vec<Window>> {
    Err("Windows 窗口接口未移植（待补）".into())
}

pub fn focus(id: u64) -> AppResult<bool> {
    let _ = id;
    Err("Windows 激活接口未移植（待补）".into())
}

pub fn lock_window() -> AppResult<Win32LockWindow> {
    Err("Windows 全屏锁窗未移植（待补）".into())
}
