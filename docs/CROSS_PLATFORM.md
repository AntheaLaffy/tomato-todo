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
| Linux 窗口保护 | 保留 niri IPC，新增原生 X11 EWMH；Openbox/Xvfb 的真实核心及 Tauri/WebKit 白名单、回焦、快速锁机、紧急恢复和 WM 失效严格释放测试通过；检测活跃 WM，不将 Xwayland 列表当成完整桌面 | GNOME、KDE Plasma、Xfce、Cinnamon、MATE、LXQt 各实际会话验收，以及其他 Wayland 合成器后端 |

## 桌面构建与发布

`pnpm run desktop:package` 使用 Tauri 自动合并的平台配置：Linux 默认 deb，Windows 默认 NSIS，macOS 默认 DMG。CI 在五个原生 runner 上构建生产桌面程序；标签发布另外构建 Linux 两架构与 Windows x64 安装包并统一上传。实际安装行为与发布工作流结果仍须验收。

Linux 本机 `pnpm run test:native` 在嵌套 niri/私有 D-Bus 中通过：托盘菜单、后台启动、自启动开关、关闭到托盘计时、单实例、无托盘回退，以及白名单/全屏/紧急释放。Windows GNU 的整应用 `cargo check` 在 Linux 交叉工具链上通过；它不代替 Windows MSVC 原生构建和运行。

## X11 窗口保护

原生 X11 会话自动使用 EWMH 后端，支持窗口列表、前台窗口、`_NET_WM_PID`、`WM_CLASS` 应用类与标题。niri 会话继续优先使用 niri IPC；其他 Wayland 会话目前不会退到只可看到部分窗口的 Xwayland。

核心协议测试：`pnpm run test:x11`。整应用测试：`pnpm run test:x11:app`。测试均由入口自动分配独立 Xvfb/Openbox 会话，整应用另开私有 D-Bus 和临时数据库；不能把用户当前桌面的 DISPLAY 传给测试执行器。

X11 和 niri 的应用标识可能不同；切换桌面后应从保护页的真实应用列表重新选择白名单。X11 后端已经用 Openbox 验证，不能用这项证据代替 GNOME/KDE 等各实际会话的验收。

## Windows 窗口保护

Windows 使用 Win32 窗口接口；普通程序以操作系统报告的完整可执行路径作为精确应用标识，不按文件名合并不同目录的程序，也不通过字符大小写转换合并文件。封装应用优先使用 `aumid:` 标识；老式 UWP 的共享 ApplicationFrameHost 从应用子窗口识别真实进程，不能通过允许框架进程一次放行所有应用。

后台计时线程创建自己的消息队列，按需要短暂连接前台/UI 输入队列，退出时恢复连接。Windows 拒绝激活或前台窗口不可访问时返回失败，桌面循环解除当前保护并报错。不给用户注入键盘事件，也不结束其他应用。

`pnpm run test:windows` 在 Windows GitHub Actions 的 x64 runner 上执行原生测试；Linux 本机自动交叉编译并使用新 Wine 前缀和 Xvfb/Openbox。原生回归只覆盖 x64：ARM64 runner 上同一用例等不到前台窗口而超时，尚未定位；在原因查清之前，ARM64 不进入 CI 与发布矩阵，而不是把这条必检改成跳过。Wine 当前缺少 AppModel API，测试只验证普通程序；商店应用身份和真实 Windows 策略必须在原生环境验收。白名单上限同步为每项 32768 字符，长路径与 Unicode 路径的全局/项目白名单、备份和计划已验证。

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
