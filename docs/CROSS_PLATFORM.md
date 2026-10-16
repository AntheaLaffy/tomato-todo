# 跨平台适配进度与验收

目标是让主流 Linux 桌面、Windows、macOS 与 Android 都能使用番茄 Todo。核心库能编译或助手运行包能解压，只是中间证据；每个平台仍须验证实际应用、系统集成与安装产物。

当前优先完成 Linux、Windows 与 macOS 桌面端；Android 延后。默认 push/PR CI 仅运行桌面检查，Android job 只有手动触发并勾选 `android` 时才运行。

Windows 目前只覆盖 x64：ARM64 宿主（`windows-11-arm`）上隔离桌面保护回归等在 10 秒内拿不到前台窗口，原因尚未定位。该平台因此与 macOS 安装包一样延后，不进入 CI 与发布矩阵，避免用超时或跳过掩盖未适配的平台。

## 当前证据

| 范围 | 当前实现与验证 | 尚未证明 |
| --- | --- | --- |
| Linux x64/ARM64 助手运行包 | 固定 Node 22.23.3 与官方 SHA-256，两个架构实际下载并解包；x64 本机运行 Pi SDK、Rust 助手与 MCP/mock 模型集成测试通过 | ARM64 原生执行与整应用安装 |
| Windows x64/ARM64 助手运行包 | 两个架构实际下载、校验、解包，PE 架构核对；Rust 启动路径使用 `bin/node.exe`；GIO 依赖限定 Linux | Windows 原生执行、桌面层编译和安装 |
| macOS x64/ARM64 助手运行包 | 两个架构实际下载、校验、解包，Mach-O 架构核对 | macOS 原生执行、桌面层编译和安装 |
| 桌面 CI | 五个原生 runner 构建助手运行包和桌面整应用，加载真实 Pi SDK，测试核心/助手/桌面与工作区 Clippy；Windows x64 另跑隔离桌面保护回归 | 远端工作流执行结果、各桌面实际安装和行为 |
| Android CI（延后） | 四个 ABI 的核心及完整 Tauri 应用本机编译通过；universal debug APK 四 ABI ELF 与桌面 Node 资源排除已检查；API 33/35 用例保留为手动选项 | 远端工作流执行结果、API 35 设备行为及 ARM 真机安装 |
| Android 原生应用入口（延后） | 四 ABI debug APK 已构建；独立 API 33 模拟器的真实 IPC、SQLite 保存、计时重启恢复、手机导航、返回键及 SAF 备份/计划往返已输出通过；该轮结束清理随后被用户要求中止，模拟器与测试进程已回收 | 完整测试正常退出记录、刘海/软键盘与其他设备，系统保护、后台提醒/通知权限和 Pi 运行时 |
| macOS 窗口保护 | 新增 Quartz 窗口枚举、进程完整路径标识与 Accessibility 权限/前台检查；只激活本进程窗口，确认可见前台窗口后才报告回焦成功；无窗口前台应用不会绕过白名单 | 当前实现未编译或运行验证；需原生 macOS 权限、窗口/多显示器/Spaces 与失效处理验收 |
| 桌面系统集成 | GIO/AppIndicator 仅在 Linux 编译；Windows/macOS 使用原生自启动和托盘、Tauri 配置目录；登录通过 opener；Linux 编译、Clippy、自启动单测及隔离原生回归通过，Windows GNU 目标整应用 `cargo check` 通过 | Windows MSVC/macOS 目标构建与原生执行、通知和自启动行为 |
| 桌面发布矩阵 | v0.8.4 发行 Linux 两架构 deb/压缩包和 Windows x64 NSIS；Windows ARM64 与 macOS 安装包延后；全部构建成功后发布；actionlint 通过；本机生产 deb 构建成功，包内二进制、Node、worker 和许可证已核对 | 远端实际构建、签名、安装与升级 |
| Windows 窗口保护 | Win32 枚举/PID/标题、完整路径、后台线程回焦和输入队列恢复；同名不同目录、长路径、白名单与窗口失效已在独立 Wine/Openbox/Xvfb 上验证；Windows x64 原生 runner 的隔离桌面回归通过；封装应用优先 AUMID，旧 UWP 框架解析应用进程，Wine 回退到普通路径 | UWP/商店应用身份、真实桌面拒绝激活及整应用行为；ARM64 未验证，也不在 CI 与发布矩阵内 |
| Linux 窗口保护 | niri、X11 EWMH、Sway、Hyprland、GNOME Shell 扩展与 KDE KWin；niri/X11 整应用通过，Sway headless 真实窗口/白名单/聚焦通过，四个新增后端的私有 socket/D-Bus/脚本回归通过 | GNOME Shell 45–50、Plasma 5.27/6、Hyprland 真实会话，以及 GNOME/KDE/Xfce/Cinnamon/MATE/LXQt 等 X11 桌面各实际会话验收 |
| 专注提示音抑制 | Linux 通过 PulseAudio/PipeWire 兼容接口监听通知角色和聊天应用播放流，暂停、结束及退出时恢复；解析与角色边界单测通过 | Windows/macOS 音频会话实现；微信、QQ 等实际 Linux 客户端及各桌面音频栈验收 |

## 桌面构建与发布

`pnpm run desktop:package` 使用 Tauri 自动合并的平台配置：Linux 默认 deb，Windows 默认 NSIS，macOS 默认 DMG。CI 在五个原生 runner 上构建生产桌面程序；标签发布另外构建 Linux 两架构与 Windows x64 安装包并统一上传。实际安装行为与发布工作流结果仍须验收。

Linux 本机 `pnpm run test:native` 在嵌套 niri/私有 D-Bus 中通过：托盘菜单、后台启动、自启动开关、关闭到托盘计时、单实例、无托盘回退，以及白名单/全屏/紧急释放。Windows GNU 的整应用 `cargo check` 在 Linux 交叉工具链上通过；它不代替 Windows MSVC 原生构建和运行。

托盘菜单打开、重复启动、显示窗口命令与提醒共用原生激活路径：先恢复最小化并显示，再通过 niri/Win32 等窗口接口短暂重试。Windows 托盘左键打开窗口，右键保留菜单。Linux 在曾连接托盘宿主后持续检查隐藏窗口的托盘可用性，宿主退出时恢复窗口；首次后台启动仍保留等待桌面栏就绪的宽限期。`tests/native.mjs` 覆盖 niri 下的焦点确认、宿主退出恢复与重启重连；Windows 托盘鼠标行为仍须原生 Windows 整应用验收。

## X11 窗口保护

原生 X11 会话自动使用 EWMH 后端，支持窗口列表、前台窗口、`_NET_WM_PID`、`WM_CLASS` 应用类与标题。Wayland 会话使用下述原生后端，未支持的合成器与后端故障均不会退到只可看到部分窗口的 Xwayland。

核心协议测试：`pnpm run test:x11`。整应用测试：`pnpm run test:x11:app`。测试均由入口自动分配独立 Xvfb/Openbox 会话，整应用另开私有 D-Bus 和临时数据库；不能把用户当前桌面的 DISPLAY 传给测试执行器。

X11 和 niri 的应用标识可能不同；切换桌面后应从保护页的真实应用列表重新选择白名单。X11 后端已经用 Openbox 验证，不能用这项证据代替 GNOME/KDE 等各实际会话的验收。

## Linux Wayland 桌面保护

后端由非空的 `NIRI_SOCKET`、`SWAYSOCK`、`HYPRLAND_INSTANCE_SIGNATURE` 选择；其余 Wayland 会话根据 `XDG_CURRENT_DESKTOP` 选择 GNOME 或 KDE。X11 会话使用 EWMH；未知 Wayland 明确不可用。

- **Sway**：直接实现 i3 IPC 帧协议，递归读取普通/浮动窗口树；原生窗口用 app ID，Xwayland 窗口用 class；按容器 ID 激活并重新查询确认聚焦。
- **Hyprland**：连接当前运行目录下 `hypr/<instance>/.socket.sock`，读取 clients/activewindow 并通过窗口地址激活；异常地址、协议错误与断连显式失败。
- **GNOME Shell 45–50**：随 Linux 包提供 ES module 扩展，导出 `org.gnome.Shell` 的 `/studio/tomato/Guard`、`studio.tomato.Guard1` 接口。`ListWindows() -> s` 返回统一窗口 JSON，`FocusWindow(u) -> b` 按 Meta 稳定序号恢复最小化、切换工作区并聚焦；禁用扩展即取消导出。
- **KDE Plasma 5.27 / 6**：通过 KWin 的 load/run/unload 脚本接口查询窗口；识别两代脚本对象路径与 workspace API。每次使用唯一回调路径，校验回调发送者是当前 KWin，完成或失败后卸载脚本。临时脚本只枚举或激活窗口，不修改 KWin 插件设置。依据：[KWin API](https://develop.kde.org/docs/plasma/kwin/api/)、[Plasma 5.27 脚本对象实现](https://invent.kde.org/plasma/kwin/-/blob/Plasma/5.27/src/scripting/scripting.cpp)。

GNOME 源码安装：`python3 scripts/install-desktop-integration.py`。压缩包使用解压目录中的同名安装器；用户安装后位于 `~/.local/lib/tomato-todo/`；deb / AUR 位于 `/usr/lib/Tomato Todo/`。首次安装后注销并重新登录，再执行 `gnome-extensions enable tomato-guard@studio.tomato.todo`。安装器不连接或启用真实桌面扩展；更新启用中的扩展需重新登录。Shell 扩展机制见 [GNOME 文档](https://gjs.guide/extensions/overview/anatomy.html)。

验证入口：

```sh
cargo test -p tomato-core --test guard_linux       # 私有 Sway/Hyprland socket
pnpm run test:linux-desktops                     # 私有 D-Bus + GNOME 逻辑/KWin 生成脚本
pnpm run test:wayland                            # 独立 headless Sway，需安装 sway
pnpm run test:wayland --hyprland                 # Xvfb→niri→Hyprland，需 GPU/DMA-BUF v4
```

2026-10-16：Sway 1.12 headless 下真实 GTK 窗口、PID、白名单放行、非白名单切回和聚焦确认通过；niri 与 Openbox/X11 整应用回归通过。GNOME/KWin 目前是扩展逻辑、私有 D-Bus 与实际生成脚本的回归证据，未替代真实桌面验收。Hyprland 0.56.2 的协议回归通过，但本机没有 `/dev/dri`，嵌套 niri 软件渲染只提供 DMA-BUF v3，Hyprland 启动要求 v4，真实会话测试在窗口创建前失败；该项保持待验收，没有跳过或计为通过。

## Windows 窗口保护

Windows 使用 Win32 窗口接口；普通程序以操作系统报告的完整可执行路径作为精确应用标识，不按文件名合并不同目录的程序，也不通过字符大小写转换合并文件。封装应用优先使用 `aumid:` 标识；老式 UWP 的共享 ApplicationFrameHost 从应用子窗口识别真实进程，不能通过允许框架进程一次放行所有应用。

后台计时线程创建自己的消息队列，先尝试普通前台激活；拒绝时在没有修饰键按下的情况下发送成对的 ALT 按下/释放并重试，必要时短暂连接能响应的前台输入队列，退出时恢复连接。跨线程激活用 `WM_NULL` 消息确认前台状态，只有确认本进程窗口已在前台才计为拦截成功。修饰键尚未松开、激活暂时被拒绝或切换期间没有可访问的前台窗口，都留到下一次 0.6 秒检查继续处理，保持本轮专注；窗口枚举失败或本应用窗口失效才由桌面循环释放保护。前台限制与 ALT 解锁规则见 [SetForegroundWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setforegroundwindow) 和 [LockSetForegroundWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-locksetforegroundwindow)。

`pnpm run test:windows` 在 Windows GitHub Actions 的 x64 runner 上执行原生测试；Linux 本机自动交叉编译并使用新 Wine 前缀和 Xvfb/Openbox。fixture 用鼠标输入切换应用，并请求前台锁定，覆盖后台线程反复回焦与按住修饰键时延后且保持按键状态。2026-10-14 的独立 Wine 回归已通过；Wine 的 AppModel 与前台锁定语义不完整，不能代替本轮改动的原生 Windows 整应用验收。原生回归只覆盖 x64：ARM64 runner 上同一用例等不到前台窗口而超时，尚未定位；在原因查清之前，ARM64 不进入 CI 与发布矩阵，而不是把这条必检改成跳过。白名单上限同步为每项 32768 字符，长路径与 Unicode 路径的全局/项目白名单、备份和计划已验证。

本周日程按时间轴上方实际占用的空间计算剩余窗口高度，保留原来的 780px 最大高度；窗口缩小或显示缩放增大时才压缩。时间轴至少 224px，保持小时刻度可辨，短任务块至少 34px；07:00、23:00 标签留在两端以内。Chromium 已覆盖常见物理分辨率及 125%、约 133%、150% 缩放，并验证滚动不改变时间比例、拉高窗口会增加时间轴高度。非常矮的窗口或较高提醒横幅可能需要滚动页面；原生 WebView2 实际缩放仍需 Windows 整应用验收。

## 构建助手运行包

本机使用 `pnpm run agent:build`。交叉打包使用显式目标，例如：

```sh
node scripts/build-agent.mjs --target=aarch64-apple-darwin
node scripts/build-agent.mjs --target=x86_64-pc-windows-msvc
```

支持 Linux GNU、Windows MSVC 和 macOS 的 x64/ARM64 目标。产物始终写入 `agent/bundle/`；打包其他目标后，运行本机应用前重新执行 `pnpm run agent:build`。交叉打包不证明目标平台能执行，也不安装目标平台工具链。

Android 和 Linux musl 不复用桌面 GNU Node 包：构建脚本在修改已有 bundle 前拒绝这些目标，防止把 ABI 不兼容的运行时装入应用。Android 助手的运行方式仍需实现和验证。

运行 `node --test tests/agent-runtime.mjs` 检查随包 Node 版本、真实 Pi SDK 加载，以及无效目标不会破坏已有运行包。Windows/macOS 目前保留环境 HTTP(S) 代理；Linux 额外使用 GIO 桌面代理回退。Windows/macOS 系统代理接入尚待实现。

## 完整验收仍需覆盖

- **构建与安装**：Tauri 桌面依赖按目标隔离，Windows 安装器、macOS 应用包、Linux 发行包与 Android APK 均能在对应环境安装、启动和升级；发布工作流上传实际对应产物。
- **基础业务**：任务、计划与备份往返、计时、声音和助手在各平台实际应用中工作；前后台切换、重启和跨午夜后状态一致。
- **桌面集成**：按操作系统实现自启动、托盘、通知、登录浏览器和数据路径。无托盘宿主时始终保留可操作窗口，覆盖 GNOME 与其他主流 Linux 桌面。
- **专注保护**：各桌面使用对应窗口接口并验证白名单、锁定、释放和失效处理。Wayland 权限限制须通过实际桌面集成解决，不能把 niri 专用接口写成所有 Linux 桌面的保护能力。测试全部使用隔离桌面。
- **Android 系统集成**：移动入口、窄屏触控与安全区域、系统文件 URI 导入/导出、通知权限、后台计时/提醒、恢复与返回键，以及助手权限和运行方式；用模拟器和设备验证。
- **CI**：在已有核心/助手矩阵上加入各平台整应用构建、安装包与 Android 设备测试；所有必须检查保持阻断失败，不用跳过或 `continue-on-error` 代替平台适配。

本阶段先闭合桌面端缺口并取得实际平台行为证据；Android 不作为当前桌面版本的发布条件。
