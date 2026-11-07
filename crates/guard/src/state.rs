//! 进程内锁定状态与 enforce 工作线程。
//! 无长期状态：进程退出即失去锁定，runtime 每次专注会话重发 lock 命令；
//! niri 直接全屏/回焦 DSH，其他后端持有自建锁窗（RAII）。
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
    native_target: Option<u64>,
    immersive: bool,
}

impl State {
    pub fn new() -> Self {
        State {
            inner: Mutex::new(Inner {
                locked: false,
                whitelist: Arc::new(Mutex::new(Vec::new())),
                worker: None,
                stop: None,
                native_target: None,
                immersive: false,
            }),
            backend: guard::Desktop::detect().name().to_string(),
        }
    }

    pub fn status(&self) -> Status {
        let inner = self.inner.lock().unwrap();
        let whitelist = inner.whitelist.lock().unwrap().clone();
        Status {
            locked: inner.locked && inner.worker.as_ref().is_some_and(|w| !w.is_finished()),
            whitelist,
            pid: std::process::id(),
            backend: self.backend.clone(),
        }
    }

    /// 只暴露有可见窗口的实际 app_id，供白名单建议使用。
    pub fn running_apps(&self) -> Result<Vec<String>, String> {
        let ids = guard::Desktop::detect()
            .windows()?
            .into_iter()
            .filter_map(|window| window.app_id)
            .filter(|id| !id.is_empty())
            .collect::<std::collections::BTreeSet<_>>();
        Ok(ids.into_iter().collect())
    }

    /// 自建锁窗期间不激活 DSH；niri 的保护目标本来就是 DSH。
    /// 没找到 DSH 窗口时返回 Ok(None)，不是错误。
    pub fn focus(&self) -> Result<Option<String>, String> {
        {
            let inner = self.inner.lock().map_err(|e| e.to_string())?;
            if inner.locked && inner.native_target.is_none() {
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
        if inner.worker.as_ref().is_some_and(|w| w.is_finished()) {
            inner.worker.take().unwrap().join().ok();
            inner.locked = false;
        }
        if inner.locked {
            *inner.whitelist.lock().unwrap() = whitelist;
            return Ok(());
        }
        let desktop = guard::Desktop::detect();
        let (lock_window, native_target) =
            if desktop.native_dsh() {
                let target = desktop
                    .dsh_window()?
                    .ok_or("未找到 DSH 窗口，无法开启专注保护")?;
                desktop.fullscreen(&target, true)?;
                if !target.is_focused && !desktop.focus(target.id)? {
                    let _ = desktop.fullscreen(&target, inner.immersive);
                    return Err("DSH 窗口尚未取得焦点".into());
                }
                (None, Some(target.id))
            } else {
                (
                    Some(desktop.lock_window().map_err(|error| {
                        format!("无法创建全屏锁窗（{}）：{error}", desktop.name())
                    })?),
                    None,
                )
            };
        let stop = Arc::new(AtomicBool::new(false));
        let shared = Arc::clone(&inner.whitelist);
        *shared.lock().unwrap() = whitelist;
        let worker_stop = Arc::clone(&stop);
        let worker = std::thread::Builder::new()
            .name("tomato-guard-enforce".into())
            .spawn(move || enforce_worker(desktop, lock_window, native_target, worker_stop, shared))
            .map_err(|error| format!("无法启动保护循环：{error}"))?;
        inner.locked = true;
        inner.worker = Some(worker);
        inner.stop = Some(stop);
        inner.native_target = native_target;
        Ok(())
    }

    pub fn fullscreen(&self, enabled: bool) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        let desktop = guard::Desktop::detect();
        let target = desktop.dsh_window()?.ok_or("未找到 DSH 窗口")?;
        desktop.fullscreen(&target, enabled || inner.locked)?;
        inner.immersive = enabled;
        Ok(())
    }

    /// 解锁：通知工作线程退出并等待其销毁锁窗（最多约一个 tick）。
    pub fn unlock(&self) -> Result<(), String> {
        let mut inner = self.inner.lock().unwrap();
        if !inner.locked {
            return Ok(());
        }
        if let Some(stop) = inner.stop.as_ref() {
            stop.store(true, Ordering::Relaxed);
        }
        let worker = inner.worker.take();
        inner.stop = None;
        if let Some(worker) = worker {
            let _ = worker.join();
        }
        inner.locked = false;
        *inner.whitelist.lock().unwrap() = Vec::new();
        if let Some(id) = inner.native_target.take() {
            let desktop = guard::Desktop::detect();
            if let Some(target) = desktop.windows()?.into_iter().find(|w| w.id == id) {
                desktop.fullscreen(&target, inner.immersive)?;
            }
        }
        Ok(())
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
    lock_window: Option<Box<dyn LockWindow + Send>>,
    native_target: Option<u64>,
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
                let decision = if let Some(id) = native_target {
                    let Some(_) = windows.iter().find(|w| w.id == id) else {
                        eprintln!("tomato-guard：DSH 窗口已关闭，等待 runtime 重新预检");
                        break;
                    };
                    guard::decide_target(&windows, id, &whitelist)
                } else {
                    guard::decide(&windows, own_pid, &whitelist)
                };
                match decision {
                    guard::Decision::Focus(id) => {
                        let blocked = windows.iter().find(|w| w.is_focused).cloned();
                        if native_target.is_some() {
                            if let Some(target) = windows.iter().find(|w| w.id == id) {
                                if let Err(error) = desktop.fullscreen(target, true) {
                                    eprintln!("tomato-guard：恢复 DSH 全屏失败：{error}");
                                }
                            }
                        }
                        match desktop.focus(id) {
                            Ok(true) => eprintln!(
                                "tomato-guard：已把 {}(app_id={:?}, pid={:?}) 切回锁窗",
                                blocked
                                    .as_ref()
                                    .and_then(|w| w.title.as_deref())
                                    .unwrap_or("?"),
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
        state.unlock().unwrap();
        state.unlock().unwrap();
        assert!(!state.status().locked);
    }

    #[test]
    fn lock_only_runs_inside_isolated_desktop() {
        if std::env::var("TOMATO_GUARD_TEST_ISOLATED").as_deref() != Ok("1") {
            // 非隔离环境：不调用 lock，避免在用户桌面上启用保护。
            return;
        }
        let state = State::new();
        state
            .lock(Vec::new())
            .expect("隔离嵌套桌面内 lock 必须成功");
        assert!(state.status().locked);
        state
            .lock(vec!["code".into()])
            .expect("re-lock 只替换白名单");
        assert_eq!(state.status().whitelist, vec!["code".to_string()]);
        state.unlock().unwrap();
        assert!(!state.status().locked);
        assert!(state.status().whitelist.is_empty());
    }
}
