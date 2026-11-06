# 跨平台适配进度与验收

目标：主流 Linux 桌面、Windows 与 macOS 都能用上番茄 Todo 的专注保护（guard）。
领域逻辑、UI 与助手都在 DSH 侧（TS/Node），不涉及平台差异；原生面只有
`crates/guard` 一个二进制。guard 无域无状态、受 runtime 经 HTTP 指挥
（协议见 [API.md](API.md) 的「guard 命令协议」）。

## 后端矩阵

| 会话 | 后端 | 状态 |
| --- | --- | --- |
| X11 | EWMH 只读枚举 + `_NET_ACTIVE_WINDOW` 激活 + guard 自建全屏锁窗 | 实现完成；Xvfb+openbox 隔离桌面冒烟通过 |
| Wayland · niri | niri JSON 行 IPC | 移植完成；真实会话待验收 |
| Wayland · Sway | i3 IPC 帧协议 | 移植完成；真实会话待验收 |
| Wayland · Hyprland | `hypr/<instance>/.socket.sock` IPC | 移植完成；真实会话待验收 |
| Wayland · GNOME | Shell 扩展 `studio.tomato.Guard1`（见 desktop-integrations/） | 扩展接口原样保留；真实会话待验收 |
| Wayland · KWin | `/Scripting` 脚本 + 唯一回调 | 移植完成；Plasma 5.27/6 真实会话待验收 |
| Wayland · 其它 | 明确报不支持，不回退 Xwayland | 按设计 |
| Windows | Win32 枚举/AUMID/WS_POPUP 锁窗 | 移植完成；`cargo check --target x86_64-pc-windows-gnu` 零告警；原生运行待验收 |
| macOS | Quartz 枚举 + Accessibility 激活 | 移植完成；对 aarch64-apple-darwin 编译验证零告警；无宿主窗口，锁机不可用（降级白名单模式），原生运行待验收 |

锁窗统一为 guard 自建的番茄红全屏锁面（X11 原生窗口 / Wayland `xdg_toplevel`
/ Windows `WS_POPUP`），初始化失败会同步回报给 runtime（HTTP 500），不会出现
「已锁定但锁面不存在」。白名单语义所有后端一致：own pid 永远放行，其余按
app_id 精确匹配，600ms enforce 循环。

## 验证政策

- Linux 构建与单测：`cargo build --manifest-path crates/guard/Cargo.toml` +
  `cargo test --manifest-path crates/guard/Cargo.toml`（当前 22 条全绿）。
- 隔离桌面冒烟：Xvfb+openbox（X11 后端）已通过——lock 200 → 全屏锁窗入
  `_NET_CLIENT_LIST`（FULLSCREEN、WM_CLASS "tomato-guard"、_NET_WM_PID）→
  re-lock 替换白名单 → notify/401/unlock 全对。**任何冒烟必须在独立嵌套桌面
  进行，绝不在用户当前桌面启用保护**。
- 交叉编译只验证类型：Windows GNU 与 macOS aarch64 目标 `cargo check` 零告警；
  不代替原生运行验收。真实硬件上的 Wayland/Windows/macOS 行为仍须逐项验收
  （锁面显示与缩放、UWP/AUMID 身份、Accessibility 权限流）。
- GNOME 扩展随 Linux 包发行，安装入口 `scripts/install-desktop-integration.py`；
  systemd user service 与自启由 `scripts/install.mjs` 处理（阶段 5 打包）。

## 留待收尾

- 真实硬件：niri/Sway/Hyprland/GNOME/KWin 会话验收；Windows MSVC 原生构建与
  运行；macOS 原生运行（含 Accessibility 权限流程）。
- notify 在无会话总线时的降级行为确认（zbus 可能回落连到真实会话总线）。
- GNOME 扩展随包安装与更新流程；guard 崩溃后 runtime 重启重发的端到端演练。
