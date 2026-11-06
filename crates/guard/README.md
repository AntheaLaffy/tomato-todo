# tomato-guard —— 番茄 Todo 专注保护守护进程

番茄 Todo 重写后的原生残留之一：专注保护（全屏锁定 + 应用白名单）、系统通知
的守护进程。**无域无状态**：锁定只活在进程内，进程重启后不恢复锁定（runtime
会在每次专注会话重发 lock 命令）；被 tomato-runtime 经 127.0.0.1 HTTP 指挥。

## 构建与运行

```sh
cargo build --manifest-path crates/guard/Cargo.toml
cargo test  --manifest-path crates/guard/Cargo.toml

# 常驻服务（runtime 的固定端口 43988；token 由 guard 生成到数据目录，runtime 同路径取用）
tomato-guard --serve [--data DIR] [--port N] [--lock [--whitelist a,b]]

# 一次性调试命令
tomato-guard --lock --whitelist code,firefox   # 立即上锁并前台 enforce，直到进程退出
tomato-guard --unlock                          # 向运行中的 guard 发 unlock
tomato-guard --notify 番茄完成 休息一下
```

数据目录默认 `~/.local/share/studio.tomato.todo/guard/`（token 文件权限 0600）。

## HTTP 协议（契约见 API.md「guard 命令协议」）

| 端点 | 说明 |
| --- | --- |
| `POST /guard` `{"command":"lock","whitelist":["app-id",...]}` | 全屏锁定 + 白名单（已锁定时只替换白名单） |
| `POST /guard` `{"command":"unlock"}` | 解锁并销毁锁窗 |
| `POST /guard` `{"command":"notify","title":...,"body":...}` | 系统通知 |
| `GET /guard/status` | `{"locked":bool,"whitelist":[...],"pid":n,"backend":"<实际后端名>"}` |

所有请求需 `Authorization: Bearer <token>`；只监听 127.0.0.1，token 比较为恒时风格。

## 后端矩阵（运行时检测，见 `src/guard.rs`）

| 环境 | 窗口发现 / 激活 | 全屏锁窗 |
| --- | --- | --- |
| X11（会话非 Wayland） | EWMH 只读枚举 + _NET_ACTIVE_WINDOW（`x11.rs`） | 自建全屏 X 窗口 |
| niri / Sway / Hyprland（Wayland） | 各自的 IPC socket（`wayland.rs`） | xdg_toplevel 全屏锁面（`wayland_surface.rs`） |
| GNOME / KWin（Wayland） | 会话总线：GNOME Shell 扩展 `studio.tomato.Guard1`（需 desktop-integrations/）、KWin 脚本（`shell.rs`） | 同上 |
| 其他 Wayland 桌面 | 明确报错，**绝不把 Xwayland 当完整保护能力** | 不可用 |
| Windows | Win32 只读枚举（含 UWP AUMID / Wine 回退）+ 前台激活（`win32.rs`） | WS_POPUP 全屏锁窗 |
| macOS | Quartz 列举 + Accessibility 激活（仅限本进程，`macos.rs`） | **不可用**：guard 无宿主窗口，锁定应降级为白名单模式 |

锁窗不抓取键盘/指针：enforce 工作线程每 600ms 列出一次窗口，把白名单外的
前台窗口切回锁窗（与旧实现「把专注窗口拉回前台」语义一致）；锁窗句柄 RAII，
进程退出或 unlock 即销毁。

## 白名单语义（`guard::allowed`）

- 本进程自己的窗口**永远放行**（锁窗即本进程窗口）。
- 其余窗口只有 `app_id` 与白名单条目**精确相等**才放行——不做前缀/子串/大小写
  折叠匹配，`code-malicious` 不会蹭到 `code` 的权限。
- 白名单为空 = 严格锁定（除了锁窗全部拦截）；最多 100 项，校验见 `protocol.rs`。

## 测试政策（务必遵守）

- 单元测试全部无桌面依赖（状态机、HTTP 路由、白名单判定、各 IPC 报文形状）。
- **绝不在用户当前桌面自动启用真实锁定**。需要真桌面冒烟时，在独立嵌套桌面
  （如 Xephyr/sway 嵌套会话）里设 `TOMATO_GUARD_TEST_ISOLATED=1` 运行
  `cargo test`，`state.rs` 的 lock 测试只在该变量下执行；失败不影响主流程。
- 交叉编译自证：win32.rs 用 `cargo check --target x86_64-pc-windows-gnu`，
  macos.rs 用 `cargo check --target aarch64-apple-darwin`（Linux 主机上
  notify-rust 的 C 依赖无法交叉编译，验证 Rust 侧即可）。
