//! guard 自己的 Wayland 全屏锁面：xdg-shell toplevel（全屏、番茄红、无输入抓取）。
//! 新写：wayland-client 0.31 连 $WAYLAND_DISPLAY（connect_to_env），registry 绑
//! wl_compositor/wl_shm/xdg_wm_base（xdg_wm_base 绑 version 1 即可，绑完先
//! event_queue.roundtrip 并处理 Ping→pong），创建 wl_surface + xdg_surface +
//! xdg_toplevel 后 set_title/set_app_id/set_fullscreen(None)/commit；xdg_surface
//! 的 configure 事件 ack_configure 并首次 attach。缓冲区用 memfd
//! （libc::syscall(SYS_memfd_create)）+ ftruncate + memmap2 映射，涂满番茄红
//! 0xD96D55（RGBX8888），经 wl_shm_pool + wl_buffer attach+damage+commit。
//! 不抓取键盘/指针：enforce 循环每 600ms 会把白名单外的前台窗口切回来，
//! 锁面本身不拦截输入。主循环用 stop 标志可中断：prepare_read + libc poll
//! （约 100ms 超时）→ read → dispatch_pending；stop 置位或出错即退出线程
//! （Drop 时代理随线程栈销毁，surface 随之销毁）。Wayland 错误日志 eprintln。
use super::{AppResult, LockWindow};
use std::{
    os::fd::{AsFd, AsRawFd, BorrowedFd, RawFd},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};
use wayland_client::{
    delegate_noop,
    globals::{registry_queue_init, GlobalListContents},
    protocol::{wl_buffer, wl_compositor, wl_registry, wl_shm, wl_shm_pool, wl_surface},
    Connection, Dispatch, QueueHandle,
};
use wayland_protocols::xdg::shell::client::{xdg_surface, xdg_toplevel, xdg_wm_base};

/// 锁面缓冲：32×32 RGBX8888，全涂番茄红 0xD96D55；compositor 会把小缓冲
/// 放大铺满全屏 surface，无需按 configure 尺寸重绘。
const WIDTH: i32 = 32;
const HEIGHT: i32 = 32;
const STRIDE: i32 = WIDTH * 4;

/// 事件队列的 State：锁面配置与 shm 资源都随线程存活到线程退出。
/// 字段按声明顺序析构：surface → buffer → pool → map（buffer 先于 pool 销毁）。
struct State {
    surface: Option<wl_surface::WlSurface>,
    buffer: Option<wl_buffer::WlBuffer>,
    pool: Option<wl_shm_pool::WlShmPool>,
    map: Option<memmap2::MmapMut>,
    attached: bool,
}

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
    let stop = Arc::new(AtomicBool::new(false));
    let thread_stop = Arc::clone(&stop);
    let thread = std::thread::Builder::new()
        .name("tomato-guard-lock".into())
        .spawn(move || run(thread_stop))
        .map_err(|e| e.to_string())?;
    Ok(WaylandLockSurface { stop, thread: Some(thread) })
}

/// 线程入口：所有 Wayland 错误只记日志（eprintln）并结束线程。
fn run(stop: Arc<AtomicBool>) {
    if let Err(error) = run_inner(&stop) {
        eprintln!("番茄 Todo 专注锁面：{error}");
    }
}

fn run_inner(stop: &Arc<AtomicBool>) -> AppResult<()> {
    let connection =
        Connection::connect_to_env().map_err(|e| format!("无法连接 $WAYLAND_DISPLAY：{e}"))?;
    let (globals, mut queue) =
        registry_queue_init::<State>(&connection).map_err(|e| e.to_string())?;
    let qh = queue.handle();
    let compositor = globals
        .bind::<wl_compositor::WlCompositor, _, _>(&qh, 1..=4, ())
        .map_err(|e| e.to_string())?;
    let shm = globals
        .bind::<wl_shm::WlShm, _, _>(&qh, 1..=1, ())
        .map_err(|e| e.to_string())?;
    // xdg_wm_base 绑 version 1 即可；绑完先 roundtrip 完成绑定握手（Ping→pong）。
    let wm_base = globals
        .bind::<xdg_wm_base::XdgWmBase, _, _>(&qh, 1..=1, ())
        .map_err(|e| e.to_string())?;
    let mut state = State { surface: None, buffer: None, pool: None, map: None, attached: false };
    queue.roundtrip(&mut state).map_err(|e| e.to_string())?;

    let surface = compositor.create_surface(&qh, ());
    let xdg_surface = wm_base.get_xdg_surface(&surface, &qh, ());
    let toplevel = xdg_surface.get_toplevel(&qh, ());
    toplevel.set_title("番茄 Todo 专注锁定".into());
    toplevel.set_app_id("tomato-guard".into());
    toplevel.set_fullscreen(None);
    surface.commit();

    let (pool, buffer, map) = shm_buffer(&shm, &qh)?;
    state.pool = Some(pool);
    state.map = Some(map);
    state.surface = Some(surface);
    state.buffer = Some(buffer);

    while !stop.load(Ordering::Relaxed) {
        connection.flush().map_err(|e| e.to_string())?;
        match connection.prepare_read() {
            Some(guard) => {
                let fd = guard.connection_fd().as_raw_fd();
                let mut pollfd = libc::pollfd { fd, events: libc::POLLIN, revents: 0 };
                match unsafe { libc::poll(&mut pollfd, 1, 100) } {
                    ret if ret < 0 => {
                        let error = std::io::Error::last_os_error();
                        // 被信号打断就重试；guard 随作用域结束 drop，即取消读取意图。
                        if error.kind() != std::io::ErrorKind::Interrupted {
                            return Err(format!("Wayland 轮询失败：{error}"));
                        }
                    }
                    0 => {}
                    _ => match guard.read() {
                        Ok(_) => {}
                        // 与 wayland-client 自身 blocking_read 同语义：仍 WouldBlock 视作没读到。
                        Err(wayland_client::backend::WaylandError::Io(e))
                            if e.kind() == std::io::ErrorKind::WouldBlock => {}
                        Err(e) => return Err(format!("Wayland 读取失败：{e}")),
                    },
                }
            }
            // 已有事件排队：跳过 poll，直接派发。
            None => {}
        }
        queue.dispatch_pending(&mut state).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 创建 memfd 支持的 shm 缓冲：整块涂番茄红 0xD96D55（RGBX8888）。
/// 返回 (pool, buffer, map)：pool 与 map 必须活到 buffer 销毁（compositor 随时可读 mmap 内存）。
fn shm_buffer(
    shm: &wl_shm::WlShm,
    qh: &QueueHandle<State>,
) -> AppResult<(wl_shm_pool::WlShmPool, wl_buffer::WlBuffer, memmap2::MmapMut)> {
    let size = (STRIDE * HEIGHT) as usize;
    let fd = Fd::memfd(size)?;
    let mut map = unsafe { memmap2::MmapMut::map_mut(&fd) }.map_err(|e| e.to_string())?;
    // RGBX8888 的内存布局是 [R, G, B, X]；小端 u32 即 0xFF556DD9。
    let red = u32::from_ne_bytes([0xD9, 0x6D, 0x55, 0xFF]);
    for chunk in map.chunks_exact_mut(4) {
        chunk.copy_from_slice(&red.to_ne_bytes());
    }
    let pool = shm.create_pool(fd.as_fd(), size as i32, qh, ());
    let buffer = pool.create_buffer(0, WIDTH, HEIGHT, STRIDE, wl_shm::Format::Rgbx8888, qh, ());
    Ok((pool, buffer, map))
}

/// memfd 的 RAII 句柄：实现 AsFd/AsRawFd 供 wl_shm.create_pool 与 memmap2
/// 使用，Drop 时关闭（fd 经 SCM_RIGHTS 传给 compositor 后本端即可关闭）。
struct Fd(RawFd);
impl Fd {
    fn memfd(size: usize) -> AppResult<Self> {
        let name = b"tomato-guard-lock\0";
        let raw =
            unsafe { libc::syscall(libc::SYS_memfd_create, name.as_ptr(), libc::MFD_CLOEXEC) }
                as RawFd;
        if raw < 0 {
            return Err(format!("memfd_create 失败：{}", std::io::Error::last_os_error()));
        }
        if unsafe { libc::ftruncate(raw, size as libc::off_t) } != 0 {
            let error = std::io::Error::last_os_error();
            unsafe { libc::close(raw) };
            return Err(format!("ftruncate 失败：{error}"));
        }
        Ok(Fd(raw))
    }
}
impl Drop for Fd {
    fn drop(&mut self) {
        unsafe { libc::close(self.0) };
    }
}
impl AsFd for Fd {
    fn as_fd(&self) -> BorrowedFd<'_> {
        // 安全：self.0 是本 struct 持有的有效 fd，借出期间不会关闭。
        unsafe { BorrowedFd::borrow_raw(self.0) }
    }
}
impl AsRawFd for Fd {
    fn as_raw_fd(&self) -> RawFd {
        self.0
    }
}

// registry_queue_init 已在内部完成 registry 枚举，之后无事件：no-op。
impl Dispatch<wl_registry::WlRegistry, GlobalListContents> for State {
    fn event(
        _state: &mut Self,
        _proxy: &wl_registry::WlRegistry,
        _event: wl_registry::Event,
        _data: &GlobalListContents,
        _conn: &Connection,
        _qh: &QueueHandle<Self>,
    ) {
    }
}
// 其余代理没有需要处理的业务事件（buffer release、surface enter/leave、
// toplevel configure/close 都忽略：锁面生命周期由 stop 标志管理）。
delegate_noop!(State: ignore wl_compositor::WlCompositor);
delegate_noop!(State: ignore wl_shm::WlShm);
delegate_noop!(State: ignore wl_shm_pool::WlShmPool);
delegate_noop!(State: ignore wl_buffer::WlBuffer);
delegate_noop!(State: ignore wl_surface::WlSurface);
delegate_noop!(State: ignore xdg_toplevel::XdgToplevel);

impl Dispatch<xdg_wm_base::XdgWmBase, ()> for State {
    fn event(
        _state: &mut Self,
        proxy: &xdg_wm_base::XdgWmBase,
        event: xdg_wm_base::Event,
        _data: &(),
        _conn: &Connection,
        _qh: &QueueHandle<Self>,
    ) {
        if let xdg_wm_base::Event::Ping { serial } = event {
            proxy.pong(serial);
        }
    }
}
impl Dispatch<xdg_surface::XdgSurface, ()> for State {
    fn event(
        state: &mut Self,
        proxy: &xdg_surface::XdgSurface,
        event: xdg_surface::Event,
        _data: &(),
        _conn: &Connection,
        _qh: &QueueHandle<Self>,
    ) {
        if let xdg_surface::Event::Configure { serial, .. } = event {
            proxy.ack_configure(serial);
            // 首次 configure 时 attach 缓冲：attach+damage+commit 一次即可，
            // 后续 configure 只 ack（缓冲已挂载，compositor 自行缩放）。
            if !state.attached {
                if let (Some(surface), Some(buffer)) = (state.surface.as_ref(), state.buffer.as_ref())
                {
                    surface.attach(Some(buffer), 0, 0);
                    surface.damage(0, 0, WIDTH, HEIGHT);
                    surface.commit();
                    state.attached = true;
                }
            }
        }
    }
}
