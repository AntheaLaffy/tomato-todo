# 番茄 Todo

[![CI](https://github.com/AntheaLaffy/tomato-todo/actions/workflows/ci.yml/badge.svg)](https://github.com/AntheaLaffy/tomato-todo/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/AntheaLaffy/tomato-todo?include_prereleases)](https://github.com/AntheaLaffy/tomato-todo/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Linux x86_64](https://img.shields.io/badge/platform-Linux%20x86__64-blue)

一个以 Rust 为核心的 Linux 桌面专注工具。奶油白与番茄红界面，支持深色模式，任务、计时和统计保存在本机，不依赖账户或联网。

> **不靠意志力，靠环境**：白名单把分心挡在外面，AI 帮你把环境调成你的样子。

## 目录

- [桌面环境适配](#桌面环境适配)
- [运行](#运行)
- [为什么做这样一个工具](#为什么做这样一个工具)
- [已实现](#已实现)
- [专注保护的适用范围](#专注保护的适用范围)
- [开发与验证](#开发与验证)
- [数据与实现](#数据与实现)
- [路线图](#路线图)

## 桌面环境适配

番茄 Todo 是 Linux 桌面应用，任务、番茄钟、统计、备份等主体功能在各主流桌面环境都可用。与桌面深度耦合的两项能力——**专注保护**和**定时锁机**——目前只在 **niri / Wayland** 上完整可用，因为它们需要通过 niri IPC 获取前台窗口并把不允许的应用切回番茄 Todo。

| 桌面 / 会话 | 任务、计时与统计 | 专注保护与定时锁机 | 托盘与自启动 |
| --- | --- | --- | --- |
| **niri / Wayland**（主要验证环境） | ✅ | ✅ 完整可用 | ✅ |
| 其他 Wayland 合成器（GNOME、KDE 等） | ✅ | ⚠️ 按钮显示不可用 | ✅ 需 AppIndicator / StatusNotifier |
| X11 | ✅ | ⚠️ 按钮显示不可用 | ✅ 需 AppIndicator / StatusNotifier |

- **niri / Wayland**：程序优先使用原生 Wayland，让窗口 PID 和应用标识能被正确识别；即使启动终端设置了 `GDK_BACKEND=x11`，也不会因此误用 Xwayland 中转窗口。
- **GNOME、KDE、其他 Wayland 合成器和 X11**：仍可使用任务与计时功能，但保护与锁机按钮会显示不可用。
- **托盘**：需要 AppIndicator 运行库（Arch 的 `libappindicator-gtk3`，Debian 的 `libayatana-appindicator3-1`）及桌面上的 StatusNotifier 托盘组件。程序会检测组件是否存在：没有托盘时正常显示窗口和退出，后台启动会等待桌面组件最多约 10 秒后显示窗口。保护专注中拒绝从托盘隐藏、暂停或退出。
- **自启动**：配置为 `$XDG_CONFIG_HOME/autostart/studio.tomato.todo.desktop`。Linux 桌面在用户登录后读取该项；niri 会话需要启用 XDG 自启动目标。仅在本机保存的桌面偏好为 `$XDG_CONFIG_HOME/studio.tomato.todo/desktop.json`，不会随任务备份导入到其他电脑。
- **系统运行库**：程序依赖系统 GTK 3 和 WebKitGTK 4.1（Arch 为 `gtk3` / `webkit2gtk-4.1`，Debian / Ubuntu 为 `libgtk-3-0` / `libwebkit2gtk-4.1-0`）。
- **构建兼容性**：此构建在当前 Linux x86_64 环境验证，不保证直接兼容所有发行版的旧版 glibc；发布用 Debian 安装包在 CI 的 Ubuntu 22.04 上构建，以覆盖较旧的发行版。

## 运行

本次已构建的程序：`target/release/tomato-todo`。在项目根目录执行：

```sh
./target/release/tomato-todo
```

Debian 安装包位于 `target/release/bundle/deb/`。已发布的版本见 [Releases](https://github.com/AntheaLaffy/tomato-todo/releases)：Debian / Ubuntu 下载 `.deb`，其他发行版可解压 `*-x86_64-linux.tar.gz` 后用其中的 `install.py` 安装。

Arch / niri 可直接安装到用户目录，无需 root：

```sh
python3 scripts/install.py --autostart --pin-dms
```

`--autostart` 启用登录后后台启动；`--pin-dms` 为现有 DankMaterialShell 栏添加固定入口。其他桌面可省略 `--pin-dms`。程序安装在 `~/.local/lib/tomato-todo/`，命令入口为 `~/.local/bin/tomato-todo`，应用列表入口为 `$XDG_DATA_HOME/applications/tomato-todo.desktop`（默认 `~/.local/share/applications/`）。快捷栏采用窗口实际的 `tomato-todo` 标识来匹配图标与现有窗口。修改 DMS 配置前会保存备份，重复安装不会重复添加入口。使用 `--pin-dms` 后执行 `dms restart` 刷新桌面栏；本次已安装并刷新。

## 为什么做这样一个工具

它想解决的不是「怎么计时」，而是「怎么让专注更容易发生」。

- **环境胜过意志力。** 专注时，不在白名单里的应用会被自动切回专注界面；你不必每次都战胜自己，只需提前把环境设好。
- **让 AI 维护你的环境。** 学习计划和每个项目的专属应用白名单都是可读写的 JSON：把「英语任务需要词典和浏览器」告诉 AI，改完文件再导入即可。过去几乎不值得维护的个性化配置，现在是一句话的事。
- **桌面级、躲不掉。** 登录自启动、系统托盘常驻，关掉窗口也继续计时。
- **只属于你。** 任务、统计和设置都在本机，不联网、不要账号。
- **开源，可以接着改。** 核心是 Rust，计划格式与文档公开；欢迎用智能体按自己的需求继续扩展。

## 已实现

- 任务与项目：增删改、完成与撤销、优先级、截止日期、标签、备注、子任务、每日/工作日/每周重复；搜索、筛选和排序。
- 可选时间安排：任务可填写提醒时刻、单次专注时长和重复周期；灵活任务留空即可。到点唤出窗口、高亮任务，一键开始；正在计时、暂停计时或锁机时延后。程序需保持运行，电脑休眠时不唤醒；当天迟到补提醒，跨日不补。
- 番茄钟：自定义专注/短休息/长休息，暂停、继续、跳过、重置、任务关联、循环与自动衔接。计时由 Rust 管理，重启后按实际截止时间恢复，不把应用关闭期间虚构成连续完成的番茄。
- 统计：当天专注时间、完成番茄、连续天数、近七天趋势、项目时间分布与专注历史；提前结束也保留实际用时，但不计为完成番茄。
- 专注体验：沉浸计时、合成雨声与棕噪声、音量、结束铃声、系统通知、置顶、明暗/跟随系统主题、键盘快捷键。
- 桌面集成：应用菜单与图标、单实例唤回、登录自启动、系统托盘菜单（打开、开始/暂停、收起、退出）。默认关闭窗口收起到托盘并继续计时；“偏好设置 → 桌面集成”可调整。完全退出会结束当前计时并保留实际用时。
- 学习计划：独立的 JSON v2 文件标准（兼容导入 v1），支持导出未完成任务、合并导入、按 ID 去重和预计番茄时长换算。项目的 `appWhitelist`（个性应用白名单）会随计划文件导出，并在导入时按项目覆盖，便于让 AI 按项目批量维护；导入保留本机设置、专注记录与已有任务进度。
- 完整备份：SQLite 持久化、JSON 导入导出、导入校验。导入备份会替换当前数据，需要在界面确认，并暂停导入的计时器。
- 专注保护：在 **niri / Wayland** 上提供全屏锁定及应用白名单；每个项目可选配专属白名单，启用后在专注该项目的任务时替代通用白名单；保护中拒绝任务修改、暂停、重置和关闭窗口。可选严格模式禁止从应用内临时退出，到时自动解除；普通模式保留输入“结束专注”的提前退出。
- 定时锁机：独立的“小憩 / 定时锁机”页面，支持 1—720 分钟快速锁机、跨午夜的每周重复时段、逐时段严格执行。到点从托盘唤回全屏休息界面，睡眠不计入学习时长。规则默认不创建、不启用。

## 专注保护的适用范围

程序通过 niri IPC 获取前台窗口并把不允许的应用切回番茄 Todo。白名单按精确 `app_id` 匹配，可直接添加当前打开的应用。浏览器内的所有网站共用一个应用标识，因此允许浏览器也会允许其中的娱乐网站。

这是自律辅助功能。它不会结束其他进程，不会暂停或修改其他应用；无法阻止系统快捷键、工作区总览、其他显示器的内容或外部结束进程。严格模式由 Rust 拒绝提前退出，而非只隐藏按钮；IPC 故障仍会解除当前保护并报错。GNOME、KDE、其他 Wayland 合成器和 X11 上仍可使用任务与计时功能，但保护与锁机按钮会显示不可用。尚未实现云同步、在线自习室、网站过滤或操作系统级安全锁屏。

定时锁机需要应用保持运行，可收起到托盘并开启登录自启动。电脑休眠时不唤醒，恢复或重开应用时若仍在时段内则继续锁机。星期按开始日期计算，启用的时段不允许重叠。进入睡眠时结束当前专注并保留实际用时；锁机结束不会自动重启专注。

## 开发与验证

需要 Rust stable、Node.js 22.12+、系统 GTK 3 / WebKitGTK 4.1 开发库、C 编译工具链和 pkg-config。

```sh
npm ci
npm run desktop        # Tauri 桌面开发
npm run dev            # Rust 服务 + Vite 浏览器预览
npm run check          # TypeScript + Rust Clippy
npm run format:check   # rustfmt + Prettier 格式检查
npm test               # Rust 单元测试 + 构建 + 浏览器端到端测试
npm run desktop:deb    # 构建生产安装包
```

浏览器预览访问 `http://127.0.0.1:1420`，Rust 服务仅监听 `127.0.0.1:4319`。端到端测试使用独立临时数据库、4321 端口和 Chromium；可用 `CHROMIUM_PATH` 指定浏览器可执行文件。

原生保护测试：`npm run test:native`，需要 niri、Xvfb、tauri-driver、WebKitWebDriver、Python GObject/GTK。测试创建独立的嵌套桌面，验证白名单放行、非白名单回焦、拒绝关闭与暂停、全屏锁定和紧急恢复，不在用户当前桌面测试阻拦。

此测试入口构建内置界面的独立测试程序，无需另起 Vite；同时使用私有 D-Bus、临时 XDG 配置和 StatusNotifier 测试宿主，验证真实托盘菜单、隐藏后的计时、自启动开关、单实例恢复与无托盘时的回退。安装脚本验证：`npm run test:install`，使用临时用户目录检查配置保留、图标/启动项及重复安装。

验证入口覆盖 Rust 状态机、计划往返导入、旧备份兼容、严格执行、跨午夜锁机，以及真实浏览器和独立嵌套 niri 桌面。生产程序加载内置界面，无需 Vite 服务。

持续集成在 Ubuntu 22.04 上运行 `npm run check`、`npm run format:check` 与 `npm test`；推送 `v*` 标签时由 [Release 工作流](.github/workflows/release.yml) 构建 `.deb` 与独立压缩包并发布到 Releases。

## 数据与实现

交换学习计划请使用 **偏好设置 → 学习计划 → 导入计划 / 导出计划**。字段和行为见 [学习计划文件标准](docs/PLAN_FORMAT.md)，配有 [JSON Schema](docs/plan.schema.json) 与 [通用示例](docs/plan.example.json)。计划只新增未知 ID 的任务；要恢复完成进度和设置，使用下方「数据与备份」。

给某个项目配置个性应用白名单时，可以先导出计划，把应用 ID 写进对应项目的 `appWhitelist`，再导入覆盖；例如告诉 AI「英语任务需要词典和浏览器」，由 AI 修改后回导即可。也可以在「专注保护」页选中项目，启用专属白名单后直接编辑；它只在应用白名单模式下、且专注该项目的任务时生效，并替代通用白名单。

[完整备份标准](docs/BACKUP_FORMAT.md) 及其 [Schema](docs/backup.schema.json)、[示例](docs/backup.example.json) 包含严格模式和定时锁机字段。恢复时暂停计时、清除当前锁机、停用导入的时段；规则和严格选项保留，需在本机重新启用。旧备份缺少新字段时默认关闭。

桌面默认数据库为 `$XDG_DATA_HOME/studio.tomato.todo/tomato.sqlite3`，未设置时位于 `~/.local/share/studio.tomato.todo/`。`TOMATO_DATA_PATH` 可指定独立数据库。预览版使用 `artifacts/preview.sqlite3`，不会与正式版混用。不要在程序运行时手动修改 SQLite；迁移数据请使用界面内的 JSON 备份。

Rust 负责状态机、任务规则、数据校验、SQLite、统计和桌面保护；TypeScript 只负责视图、交互与本地声音。核心库由 Tauri 和 Axum 预览服务共享，避免预览与桌面产生两套业务逻辑。详见 [CODEMAP.md](CODEMAP.md)。字体 DM Sans 随应用打包，许可位于 `public/fonts/OFL.txt`。

用户提供的课表和私人备考分析位于忽略版本管理的 `artifacts/planning/`，不打入程序，也没有写入默认任务数据库。

## 路线图

以下是方向，**尚未实现**，欢迎一起补齐：

- **音效**：为计时开始 / 暂停 / 结束、休息切换与锁机等关键节点补充音效，并可与现有提示音一起控制开关与音量。
- **内嵌智能体**：启动时静默检查一轮数据异常，只在发现异常时唤醒智能体，主动追问并归因（计划是否合理、是力不从心还是太轻松、长期搁置的兴趣项等）；无异常则保持静默、不消耗 token。
- **面向智能体的扩展**：公开计划格式与文档，方便用技能/智能体理解项目并代你调整学习环境，让用户按自己的方式继续改进。
