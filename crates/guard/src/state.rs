//! 进程内锁定状态与 enforce 工作线程。
//! 无长期状态：进程退出即失去锁定，runtime 每次专注会话重发 lock 命令；
//! 进程内 re-lock 只替换白名单，unlock 结束工作线程并销毁锁窗（RAII）。
use crate::guard::{self, LockWindow};
use crate::protocol::Status;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};

/// enforce 循环间隔（与旧应用的保护 tick 一致）。
const TICK_MILLIS: u64 = 600;

pub struct State {
    inner: Mutex<Inner>,
    /// 实际后端名（构造时检测一次），随 /guard/status 返回给 runtime。
    backend: String,
}

struct Inner {
    locked: bool,
    whitelist: Arc<Mutex<Vec<String>>>,
    worker: Option<std::thread::JoinHandle<()>>,
    stop: Option<Arc<AtomicBool>>,
}

impl State {
    pub fn new() -> Self {
        State {
            inner: Mutex::new(Inner {
                locked: false,
                whitelist: Arc::new(Mutex::new(Vec::new())),
                worker: None,
                stop: None,
            }),
            backend: guard::Desktop::detect().name().to_string(),
        }
    }

    pub fn status(&self) -> Status {
        let inner = self.inner.lock().unwrap();
        let whitelist = inner.whitelist.lock().unwrap().clone();
        Status {
            locked: inner.locked,
            whitelist,
            pid: std::process::id(),
            backend: self.backend.clone(),
        }
    }

    /// 把 DeepSeek Harness 的窗口切到前台。锁机期间不抢（会让锁窗失去前台）。
    /// 没找到 DSH 窗口时返回 Ok(None)，不是错误。
    pub fn focus(&self) -> Result<Option<String>, String> {
        {
            let inner = self.inner.lock().map_err(|e| e.to_string())?;
            if inner.locked {
                return Ok(None);
            }
        }
        let desktop = guard::Desktop::detect();
        let window = desktop.focus_dsh().map_err(|error| error.to_string())?;
        Ok(window.map(|window| {
            window
                .title
                .or(window.app_id)
                .unwrap_or_else(|| "DeepSeek Harness".into())
        }))
    }

    /// 上锁或（已锁定时）替换白名单。锁窗创建失败时保持未锁定并报错。
    pub fn lock(&self, whitelist: Vec<String>) -> Result<(), String> {
        let mut inner = self.inner.lock().unwrap();
        if inner.locked {
            *inner.whitelist.lock().unwrap() = whitelist;
            return Ok(());
        }
        let desktop = guard::Desktop::detect();
        let lock_window = desktop
            .lock_window()
            .map_err(|error| format!("无法创建全屏锁窗（{}）：{error}", desktop.name()))?;
        let stop = Arc::new(AtomicBool::new(false));
        let shared = Arc::clone(&inner.whitelist);
        *shared.lock().unwrap() = whitelist;
        let worker_stop = Arc::clone(&stop);
        let worker = std::thread::Builder::new()
            .name("tomato-guard-enforce".into())
            .spawn(move || enforce_worker(desktop, lock_window, worker_stop, shared))
            .map_err(|error| format!("无法启动保护循环：{error}"))?;
        inner.locked = true;
        inner.worker = Some(worker);
        inner.stop = Some(stop);
        Ok(())
    }

    /// 解锁：通知工作线程退出并等待其销毁锁窗（最多约一个 tick）。
    pub fn unlock(&self) {
        let mut inner = self.inner.lock().unwrap();
        if !inner.locked {
            return;
        }
        if let Some(stop) = inner.stop.as_ref() {
            stop.store(true, Ordering::Relaxed);
        }
        let worker = inner.worker.take();
        inner.stop = None;
        drop(inner);
        if let Some(worker) = worker {
            let _ = worker.join();
        }
        let mut inner = self.inner.lock().unwrap();
        inner.locked = false;
        *inner.whitelist.lock().unwrap() = Vec::new();
    }
}

impl Default for State {
    fn default() -> Self {
        Self::new()
    }
}

/// 工作线程：每 tick 列出一次窗口，把白名单外的前台窗口切回锁窗。
/// 锁窗句柄由本线程持有，线程退出（unlock/进程退出）时 RAII 销毁。
fn enforce_worker(
    desktop: guard::Desktop,
    lock_window: Box<dyn LockWindow + Send>,
    stop: Arc<AtomicBool>,
    whitelist: Arc<Mutex<Vec<String>>>,
) {
    let own_pid = std::process::id();
    let mut previous: Vec<guard::Window> = Vec::new();
    loop {
        std::thread::sleep(std::time::Duration::from_millis(TICK_MILLIS));
        if stop.load(Ordering::Relaxed) {
            break;
        }
        let whitelist = whitelist.lock().unwrap().clone();
        match desktop.windows() {
            Ok(windows) => {
                match guard::decide(&windows, own_pid, &whitelist) {
                    guard::Decision::Focus(id) => {
                        let blocked = windows.iter().find(|w| w.is_focused).cloned();
                        match desktop.focus(id) {
                            Ok(true) => eprintln!(
                                "tomato-guard：已把 {}(app_id={:?}, pid={:?}) 切回锁窗",
                                blocked.as_ref().and_then(|w| w.title.as_deref()).unwrap_or("?"),
                                blocked.as_ref().and_then(|w| w.app_id.as_deref()),
                                blocked.as_ref().and_then(|w| w.pid),
                            ),
                            Ok(false) => {
                                eprintln!("tomato-guard：锁窗激活请求未确认，下个 tick 重试")
                            }
                            Err(error) => eprintln!("tomato-guard：激活锁窗失败：{error}"),
                        }
                    }
                    guard::Decision::OwnClosed => {
                        eprintln!("tomato-guard：锁窗不在窗口列表中，下个 tick 重试")
                    }
                    guard::Decision::None => {}
                }
                // 诊断：记录锁定期间新出现的窗口（集合差集，按 id）。
                let (added, _removed) = guard::changed(&previous, &windows);
                for window in added {
                    if window.pid != Some(own_pid) {
                        eprintln!(
                            "tomato-guard：新窗口 {}（app_id={:?}，pid={:?}）",
                            window.title.as_deref().unwrap_or("?"),
                            window.app_id,
                            window.pid
                        );
                    }
                }
                previous = windows;
            }
            Err(error) => eprintln!("tomato-guard 保护检查失败：{error}"),
        }
    }
    drop(lock_window);
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 无桌面依赖的状态机单测。桌面会话下禁止自动启用保护（AGENTS.md），
    /// 因此 lock 路径只在隔离嵌套桌面（TOMATO_GUARD_TEST_ISOLATED=1，见
    /// README 冒烟说明）中执行；其余环境只验证解锁幂等与状态形状。
    #[test]
    fn unlock_without_lock_is_idempotent() {
        let state = State::new();
        assert!(!state.status().locked);
        assert!(state.status().whitelist.is_empty());
        assert_eq!(state.status().pid, std::process::id());
        assert_eq!(state.status().backend, guard::Desktop::detect().name());
        state.unlock();
        state.unlock();
        assert!(!state.status().locked);
    }

    #[test]
    fn lock_only_runs_inside_isolated_desktop() {
        if std::env::var("TOMATO_GUARD_TEST_ISOLATED").as_deref() != Ok("1") {
            // 非隔离环境：不调用 lock，避免在用户桌面上启用保护。
            return;
        }
        let state = State::new();
        state.lock(Vec::new()).expect("隔离嵌套桌面内 lock 必须成功");
        assert!(state.status().locked);
        state.lock(vec!["code".into()]).expect("re-lock 只替换白名单");
        assert_eq!(state.status().whitelist, vec!["code".to_string()]);
        state.unlock();
        assert!(!state.status().locked);
        assert!(state.status().whitelist.is_empty());
    }
}
