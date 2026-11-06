//! guard 自己的 Wayland 全屏锁面：xdg-shell toplevel（全屏、番茄红、无输入
//! 抓取），sway/hyprland/niri/GNOME/KWin 都能列出并按 pid 激活。
//! 依赖 wayland-client + wayland-protocols（xdg-shell）+ memmap2/libc（shm 缓冲）。
//! 状态：待移植（stub，由切分后的代理或本代理后续填充；接口已定，勿改签名）。
use super::{AppResult, LockWindow};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

pub struct WaylandLockSurface {
    stop: Arc<AtomicBool>,
    thread: Option<std::thread::JoinHandle<()>>,
}

impl LockWindow for WaylandLockSurface {}

impl Drop for WaylandLockSurface {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

pub fn lock_surface() -> AppResult<WaylandLockSurface> {
    Err("Wayland 全屏锁面未移植（待补）".into())
}
