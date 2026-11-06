//! Sway/i3 IPC、Hyprland IPC 与 niri 会话 socket 的窗口发现与激活。
//! 移植自旧 crates/core/src/guard_wayland.rs 与 guard.rs 的 niri request()。
//! 状态：待移植（stub，由切分后的代理或本代理后续填充；接口已定，勿改签名）。
use super::{AppResult, Window};

pub fn sway_list() -> AppResult<Vec<Window>> {
    Err("Sway 窗口接口未移植（待补）".into())
}

pub fn sway_focus(id: u64) -> AppResult<bool> {
    let _ = id;
    Err("Sway 激活接口未移植（待补）".into())
}

pub fn hypr_list() -> AppResult<Vec<Window>> {
    Err("Hyprland 窗口接口未移植（待补）".into())
}

pub fn hypr_focus(id: u64) -> AppResult<bool> {
    let _ = id;
    Err("Hyprland 激活接口未移植（待补）".into())
}

pub fn niri_list() -> AppResult<Vec<Window>> {
    Err("niri 窗口接口未移植（待补）".into())
}

pub fn niri_focus(id: u64) -> AppResult<bool> {
    let _ = id;
    Err("niri 激活接口未移植（待补）".into())
}
