//! Quartz/辅助功能公共 API 的窗口发现与激活（仅限自身进程的窗口）。
//! 移植自旧 crates/core/src/guard_macos.rs。
//! 状态：待移植（stub，由切分后的代理或本代理后续填充；接口已定，勿改签名）。
use super::{AppResult, Window};

pub fn windows() -> AppResult<Vec<Window>> {
    Err("macOS 窗口接口未移植（待补）".into())
}

pub fn focus(id: u64) -> AppResult<()> {
    let _ = id;
    Err("macOS 激活接口未移植（待补）".into())
}
