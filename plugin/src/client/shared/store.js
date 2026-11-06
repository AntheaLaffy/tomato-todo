// 客户端唯一状态源：一份 runtime 快照 + 订阅 + Action 提交 + 轮询。
//
// 为什么集中在这里：九个页面共享同一份数据（任务改动要立刻反映到统计/导航
// 计数），而且 runtime 是外部进程，页面各自 fetch 会出现互相覆盖的竞态。
// 轮询节奏随计时器状态自适应：专注中 1.2s（HUD 秒数要准），空闲 5s。
import { useState, useEffect } from "../runtime.js";
import { getState, postDispatch, ApiError } from "./api.js";

let snapshot = null;
let readError = null;
let inflightRead = null;
let pollTimer = null;
let disposed = false;
const listeners = new Set();

function emit() {
  for (const fn of Array.from(listeners)) {
    try {
      fn(snapshot, readError);
    } catch {
      /* 订阅者异常不影响其他人 */
    }
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSnapshot() {
  return snapshot;
}

export function getReadError() {
  return readError;
}

/** 组件订阅快照：任何 refresh/dispatch 后重渲染。 */
export function useSnapshot() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const off = subscribe(() => setTick((n) => n + 1));
    return off;
  }, []);
  return snapshot;
}

function apply(next) {
  snapshot = next;
  readError = null;
  emit();
}

export function refresh() {
  if (disposed) return Promise.resolve(snapshot);
  if (inflightRead !== null) return inflightRead;
  inflightRead = getState({ timeoutMs: 4000 })
    .then((next) => {
      apply(next);
      return next;
    })
    .catch((e) => {
      readError = e instanceof ApiError ? e.userMessage : String(e);
      emit();
      return snapshot;
    })
    .finally(() => {
      inflightRead = null;
    });
  return inflightRead;
}

const MUTATING = new Set();

/**
 * 提交一个 Action。成功后用响应里的 snapshot 立即更新（免一次往返）；
 * 失败抛出可读错误，由页面显示行内错误。
 */
export async function dispatch(action) {
  const key = action && action.type ? action.type : "unknown";
  MUTATING.add(key);
  try {
    const res = await postDispatch(action, { timeoutMs: 8000 });
    if (res && res.snapshot) {
      apply(res.snapshot);
    } else {
      await refresh();
    }
    return res;
  } catch (e) {
    const err = e instanceof ApiError ? e : new ApiError(String(e), 0);
    err.actionType = key;
    throw err;
  } finally {
    MUTATING.delete(key);
  }
}

/** 安全提交：失败时返回 { ok:false, error }，永不抛异常（事件处理器用）。 */
export async function tryDispatch(action) {
  try {
    await dispatch(action);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e && e.userMessage ? e.userMessage : String(e) };
  }
}

function nextDelay() {
  const data = snapshot && snapshot.data;
  const timer = data && data.timer;
  const running = !!(timer && timer.running);
  return running ? 1200 : 5000;
}

export function startPolling() {
  stopPolling();
  disposed = false;
  const tick = () => {
    if (disposed) return;
    refresh().finally(() => {
      if (disposed) return;
      pollTimer = setTimeout(tick, nextDelay());
    });
  };
  refresh();
  pollTimer = setTimeout(tick, nextDelay());
  return stopPolling;
}

export function stopPolling() {
  if (pollTimer !== null) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

export function dispose() {
  disposed = true;
  stopPolling();
  listeners.clear();
}
