//! GNOME Shell 扩展与 KWin 脚本经会话总线的窗口发现与激活。
//! 移植自旧 crates/core/src/guard_shell.rs（扩展接口 studio.tomato.Guard1 保持原样）。
//! 状态：待移植（stub，由切分后的代理或本代理后续填充；接口已定，勿改签名）。
use super::{AppResult, Window};

pub fn gnome_list() -> AppResult<Vec<Window>> {
    Err("GNOME Shell 窗口接口未移植（待补）".into())
}

pub fn gnome_focus(id: u64) -> AppResult<bool> {
    let _ = id;
    Err("GNOME Shell 激活接口未移植（待补）".into())
}

pub fn kwin_list() -> AppResult<Vec<Window>> {
    Err("KWin 窗口接口未移植（待补）".into())
}

pub fn kwin_focus(id: u64) -> AppResult<bool> {
    let _ = id;
    Err("KWin 激活接口未移植（待补）".into())
}
