//! 专注保护的纯计算部分：窗口集合与白名单判定。
//! 对应 crates/core/src/guard.rs 的 `allowed` 与 guard_windows.rs 的
//! app-id 解析（AUMID / ApplicationFrameHost 共享 UWP 框架 / 完整进程路径）。
//! 不做任何桌面调用——枚举、聚焦与锁屏执行由原生 guard 负责。

import type { Protection, Window } from "./model";

/**
 * 白名单判定（guard::allowed）：
 * 本进程窗口始终放行；off 放行一切；whitelist 精确匹配 appId；
 * lock 忽略白名单。
 */
export function allowed(window: Window, ownPid: number, protection: Protection): boolean {
  if (window.pid !== null && window.pid === ownPid) {
    return true;
  }
  return (
    protection.mode === "off" ||
    (protection.mode === "whitelist" &&
      window.appId !== null &&
      protection.whitelist.some((allowedId) => allowedId === window.appId))
  );
}

/** UWP 应用封装为 `aumid:{id}`（guard_windows::identity）。 */
export function formatAumid(id: string): string {
  return `aumid:${id}`;
}

/**
 * ApplicationFrameHost.exe 是共享框架进程：它本身不代表任何一个托管应用，
 * 授予它等于放行全部 UWP 应用。判断按完整路径的最后一段、不区分大小写。
 */
export function isApplicationFrameHost(processPath: string): boolean {
  const name = processPath.split(/[\\/]/).pop() ?? "";
  return name.toLowerCase() === "applicationframehost.exe";
}

/**
 * 共享框架窗口的托管应用选择：取第一个类名为
 * `Windows.UI.Core.CoreWindow` 且 PID ≠ 宿主 PID 的子窗口
 * （guard_windows::content）。
 */
export function selectFrameContentPid(
  hostPid: number,
  children: { className: string; pid: number }[],
): number | null {
  for (const child of children) {
    if (child.className === "Windows.UI.Core.CoreWindow" && child.pid !== 0 && child.pid !== hostPid) {
      return child.pid;
    }
  }
  return null;
}
