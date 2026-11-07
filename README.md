# 番茄 Todo

[![CI](https://github.com/AntheaLaffy/dsh-plugin-tomato-todo/actions/workflows/ci.yml/badge.svg)](https://github.com/AntheaLaffy/dsh-plugin-tomato-todo/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/AntheaLaffy/dsh-plugin-tomato-todo?include_prereleases)](https://github.com/AntheaLaffy/dsh-plugin-tomato-todo/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Linux / Windows](https://img.shields.io/badge/platform-Linux%20%2F%20Windows-blue)

番茄 Todo 是 DeepSeek Harness（DSH）的专注插件：今日专注、任务与统计的界面住在 DSH 里，一个 Node 本地 runtime 管数据与番茄计时，一个 Rust 原生守卫做专注保护、窗口激活与通知。奶油白与番茄红，数据留在本机，不依赖账号或联网。

> **不靠意志力，靠环境**：白名单把分心挡在外面，AI 帮你把环境调成你的样子。

## 目录

- [它解决什么](#它解决什么)
- [为考研而作](#为考研而作)
- [三个部分](#三个部分)
- [安装](#安装)
- [在 DSH 里能做什么](#在-dsh-里能做什么)
- [专注保护能做什么、不能做什么](#专注保护能做什么不能做什么)
- [数据与备份](#数据与备份)
- [文档](#文档)
- [开发与贡献](#开发与贡献)
- [路线图](#路线图)

## 它解决什么

它想解决的不是「怎么计时」，而是「怎么让专注更容易发生」。

- **环境胜过意志力。** 专注时，不在白名单里的应用会被自动切回专注界面；你不必每次都战胜自己，只需提前把环境设好。
- **日常只有两件事。** 当下（今日专注：选一件最重要的事开一个番茄）和对话（学习助手）。愿景、习惯、课表和模板用于记录方向与安排，给助手落笔用，不是每天的功课；统计只用来回看，不是绩效评估。规划半天不动手是最常见的失败方式，所以第一次打开时会直接把这两件事说清楚。
- **让 AI 维护你的环境。** 学习助手就是 DSH 的对话：说一句「英语任务需要词典和浏览器」，它经插件自带的 `tomato_*` 工具直接改好计划、白名单与模板，或先给一份待审阅文件。过去几乎不值得维护的个性化配置，现在是一句话的事。
- **桌面级、躲不掉。** runtime 与守卫随登录自启（systemd user service），DSH 没开时番茄计时、专注保护与到点通知也照常工作。
- **只属于你。** 任务、统计和设置都在本机的计划 JSON 里，不联网、不要账号（模型对话走 DSH 自己的配置）。
- **开源，可以接着改。** 核心是 TypeScript 加上一个小的 Rust 守卫，计划格式与文档公开；欢迎用智能体按自己的需求继续扩展。

## 为考研而作

番茄 Todo 最初就是为了应付考研这种**超长线、多科目、有固定课表**的备考而写的。普通番茄钟只能计时，而备考真正难的是「每天怎么排、漏了怎么办、这一轮复习有没有到位」。

- **科目即项目**：数学一、英语一、408、政治各建一个项目，各自配一条应用白名单——听网课放行播放器、背单词只留词典、做题时把娱乐挡在外面。
- **课表与刷题并排**：每周的课、实验登记成阻塞时段，哪天被占满、哪天能加量一目了然；水课可以标成可并行。
- **重复练习交给模板**：单词、笔记、真题按周期自动印成当天的实例，漏做进入待补队列，不用每天手动建任务。
- **节奏交给助手**：DSH 对话里的助手读得到计划与投入记录，会指出安排超量或过松、习惯缺勤、深夜还在学，并帮你把计划调好。

功能细节见 [文档](#文档)。

## 三个部分

番茄 Todo 拆成三个部件，各干自己该干的事：

```
DSH（你的对话与界面）
 ├─ 番茄主视图（九页）+ composer.dock 入口卡 + 常驻 HUD / 沉浸层
 ├─ 学习助手 = DSH 对话，经插件自带的 tomato_* Host 工具读写计划
 └─ Host 工具每次调用：一次性 tomato-runtime --mcp → 运行中实例
tomato-runtime（Node，随插件分发，本机常驻）
 ├─ 领域核心 @tomato/core：任务/习惯/模板/课表/诊断/统计（plan.json，原子写）
 ├─ 番茄计时与到点提醒调度、项目资料库授权
 └─ HTTP API（127.0.0.1:43987）：面板数据面 + /api/* + /mcp（streamable HTTP，供外部客户端）
tomato-guard（Rust 原生守卫，被 runtime 指挥）
 ├─ 专注保护：白名单 + 全屏（niri 用实际 DSH 窗口，其他后端自建锁窗）
 ├─ 窗口激活与系统通知
 └─ 随登录自启（systemd user service）
```

- **插件**（`dsh-plugin-tomato-todo`）负责 DSH 内的界面与工具：九页主视图、入口卡、HUD、`tomato_*` Host 工具与随包教学技能。
- **runtime** 负责所有领域逻辑与数据：任务规则、模板印刷、诊断、统计、计时与提醒。面板数据直连它的本地 API；助手的一切写操作都经过它，规则与保护在它这里执行。
- **守卫** 只做浏览器做不到的事：锁住屏幕、把非白名单应用切走、发通知、激活窗口。它没有领域逻辑，只被 runtime 指挥。

## 安装

### 从插件市场安装（已有 DSH）

插件已发布到 npm：`dsh-plugin-tomato-todo`。添加作者索引源后可直接在 **插件 → 发现** 里搜索安装：

```
https://anthealaffy.github.io/dsh-plugin-tomato-todo/index.json
```

打开方式：**插件 → 实验性插件 → 自定义插件索引**，然后 **发现 → 添加索引源**，粘贴上面的 URL，搜索「番茄 Todo」。也可以跳过市场直接装包：

```sh
npm install -g dsh-plugin-tomato-todo
```

装完仍需 runtime 与守卫（面板要连 `127.0.0.1:43987`，专注保护要 `tomato-guard`），见下面的「runtime 与守卫」。插件本身只含界面、Host 工具与随包技能。

### 发行页的三种包

发行页另外提供三种离线包，按「有没有 DSH」选一个即可：

| 包                                            | 内容                                                     | 适合                            |
| --------------------------------------------- | -------------------------------------------------------- | ------------------------------- |
| `tomato-todo-<版本>-<arch>-linux-full.tar.gz` | 内嵌 DSH（含依赖）+ runtime + 守卫 + 插件 + `dsh` 启动器 | 从零开始，不想另外安装 DSH      |
| `tomato-todo-<版本>-<arch>-linux.tar.gz`      | runtime + 守卫 + 插件                                    | 已经装好 DSH，只要番茄          |
| `tomato-todo-plugin-<版本>.tar.gz`            | 只有 `plugin/`                                           | 已有 DSH 与 runtime，只更新插件 |

前置：Linux；Node ≥ 24.9（完整版内嵌的 DSH 要求；只装 runtime 时 ≥ 20.11 即可）。安装都在用户目录，不需要 root。

### 完整版（内嵌 DSH）

解包后装 runtime/守卫，再把插件挂进 DSH profile 并启动：

```sh
tar -xzf tomato-todo-<版本>-<arch>-linux-full.tar.gz
cd tomato-todo-<版本>-full

node scripts/install.mjs --runtime runtime/bin/tomato-runtime --guard guard/tomato-guard
node scripts/install-dsh.mjs --profile tomato

./dsh --profile tomato web
```

- `install-dsh.mjs` 第一次会用 DSH 的 web 模板创建 profile `tomato`，并把本目录的 `plugin/` 以 `link:` 挂进 `dsh.profile.bundles`；profile 已存在时只追加插件，不覆盖现有配置。
- 数据、凭据、会话仍然在 `~/.dsh`（可用 `DSH_HOME` 覆盖），与系统安装的 DSH 共用；完整版只是自带一份 DSH 程序。
- 内嵌的 DSH 版本固定在 `packaging/dsh-version`（当前 `0.2.2-rc.1`）。升级 DSH 时重新下载新版完整包即可，profile 与数据不动。
- 安装后再移动解包目录会让 `link:` 失效：把目录放稳；已经移动的话重跑一次 `node scripts/install-dsh.mjs --profile tomato`。
- 可选：`ln -s "$PWD/dsh" ~/.local/bin/tomato-dsh`，之后用 `tomato-dsh --profile tomato web` 启动。
- runtime 与守卫的 systemd user service 由 `install.mjs` 写好；需要登录自启时执行 `systemctl --user enable --now tomato-runtime`。

### 轻量版（已有 DSH）

```sh
tar -xzf tomato-todo-<版本>-<arch>-linux.tar.gz
cd tomato-todo-<版本>

node scripts/install.mjs --runtime runtime/bin/tomato-runtime --guard guard/tomato-guard
```

然后在 DSH 的 `plugin_manager` 里安装本目录的 `plugin/`；或手动在 profile 的 `package.json` 加：

```json
"dsh-plugin-tomato-todo": "link:<解包目录>/plugin"
```

并把 `dsh-plugin-tomato-todo` 加入 `dsh.profile.bundles`。重启 DSH 后，composer.dock 出现番茄入口卡，对话获得 `tomato_*` 工具。

### 只装/更新插件

下载插件包，在 DSH 的 `plugin_manager` 里安装解包后的 `plugin/`，或按上面的 `link:` 方式挂进 profile。插件只含界面、Host 工具与随包技能；面板需要 `tomato-runtime` 在 `127.0.0.1:43987` 运行，专注保护需要 `tomato-guard`。

### runtime 与守卫（单独安装）

```sh
node scripts/install.mjs
systemctl --user enable --now tomato-runtime
```

登录后 runtime 与守卫随会话自启；守卫的专注保护与通知不依赖 DSH 是否打开。具体的安装选项（自启、数据目录、桌面集成）以 `scripts/install.mjs --help` 与安装输出为准。

### 从源码构建

```sh
pnpm install
pnpm build:runtime                                  # 打包 runtime（内置 @tomato/core）
cargo build --release --manifest-path crates/guard/Cargo.toml
node scripts/install.mjs
```

要从源码打发行包：`node scripts/package-release.mjs`（轻量版 + 插件包），
加 `--full` 会再内嵌一份 DSH 产出完整版（需要网络安装 DSH 依赖）。

完整的构建、测试与贡献说明见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 在 DSH 里能做什么

### 今日专注

打开入口卡就是当下：番茄钟加上今天与待补的任务。到点由守卫发通知，一键开始；正在计时、暂停或锁机时提醒自动延后。

### 任务与项目

任务可增删改、完成撤销、优先级、截止日期、标签、备注、子任务，支持搜索、筛选与排序。**项目**是环境维度：不同类型、不同科目的任务需要不同的应用白名单（同样是听课，英语课和编译原理课要放的软件不一样），所以专属白名单挂在项目上。

### 本周日程

每周重复的课程、实验登记成**阻塞时段**，以半透明色带铺在周历网格背景里；任务按时间落格，一眼看出哪天空、哪天过载。每个时段标成**需专心**或**水课**——需专心的时段里排专注任务会被本地诊断提示真实冲突，水课时段表示签到即可、课上能并行写作业。

### 数据统计

当天专注时间、完成番茄、连续天数、近七天趋势、项目时间分布与专注历史；提前结束也保留实际用时。

### 学习助手（= DSH 对话）

助手就是 DSH 的对话。它维护你的个性化环境：把一句话落成项目、白名单、模板与任务，并主动指出安排冲突、估时偏差和漏排。怎么用：

1. **直接说人话**：它能读你的任务、计划与投入记录，再动手改环境——新建项目、配应用白名单、加模板，或把一句话排成定时任务。
2. **要方案就等方案**：改动数据时它先生成**待审阅**文件，在对话中展示改动摘要，你批准后才应用。
3. **接外部系统**：座位、图书馆这类系统可通过 MCP 服务器接进 DSH（DSH 自身的 MCP 配置）；番茄 Todo 的 runtime 也把自己暴露成 MCP 服务器，见 [MCP 接入指南](docs/MCP.md)。

### 专注保护与定时锁机

原生守卫通过各桌面接口提供全屏锁定与应用白名单（各桌面配置与验证范围见下方适配表）；每个项目可选配专属白名单，专注该项目的任务时替代通用白名单。独立的「小憩 / 定时锁机」支持 1–720 分钟快速锁机、跨午夜的每周重复时段，到点发系统通知并在 HUD 提示休息，睡眠不计入学习时长。

### 设置

专注/休息时长、每日目标、自动衔接、明暗主题、关键节点音效、桌面集成、学习计划与备份都在面板的设置页。

## 桌面环境适配

任务、计时、统计与备份共用同一份实现（@tomato/core）。专注保护和定时锁机按桌面选择原生窗口接口；接口不可用时明确提示，普通计时仍可使用。各桌面的实现与实际会话验收分开记录：

| 桌面 / 会话                                          | 窗口保护后端              | 当前验证                                                |
| ---------------------------------------------------- | ------------------------- | ------------------------------------------------------- |
| niri / Wayland                                       | niri IPC                  | 隔离整应用通过                                          |
| Sway / Wayland                                       | 原生 i3 IPC               | headless 真实 GTK 窗口与白名单/聚焦通过                 |
| Hyprland / Wayland                                   | 原生 Hyprland socket      | 协议回归通过；本机缺少 GPU，真实嵌套会话待验收          |
| GNOME / Wayland                                      | 随包 Shell 扩展（45–50）  | 扩展逻辑与私有 D-Bus 通过；真实 Shell 会话待验收        |
| KDE Plasma / Wayland                                 | KWin 脚本接口（5.27 / 6） | 两代接口的私有 D-Bus/脚本回归通过；真实 KWin 会话待验收 |
| GNOME、KDE、Xfce、Cinnamon、MATE、LXQt 等的 X11 会话 | EWMH                      | Openbox 核心及整应用通过；各桌面实际会话待验收          |
| 其他 Wayland 合成器                                  | 尚无原生后端              | 普通计时可用，保护显示不可用                            |

- **Wayland 原生窗口**：守卫优先使用原生 Wayland，让窗口 PID 和应用标识能被正确识别。后端故障不会退回只包含部分窗口的 Xwayland 列表。
- **GNOME 扩展**：源码目录运行 `python3 scripts/install-desktop-integration.py`；首次安装后注销并重新登录，再运行 `gnome-extensions enable tomato-guard@studio.tomato.todo`。安装器只复制文件，不自动启用扩展或保护。
- **KDE Plasma**：直接使用当前会话的 KWin 脚本接口，无需安装额外扩展；脚本执行完或发生错误后卸载，不修改用户的 KWin 插件设置。
- **应用白名单**：各后端的应用标识可能不同，切换桌面后请从真实窗口列表重新选择；GNOME 通常返回 `.desktop` ID，KWin 优先桌面文件 ID，Sway/Hyprland 使用应用类或原生 app ID。
- **系统通知**：守卫把提醒交给桌面通知中心；通知服务不可用时只影响提醒，不影响锁机与计时。
- **自启动**：由 `scripts/install.mjs` 注册 systemd user service；niri 会话需启用 XDG 自启动目标。仅在本机保存的桌面偏好为 `$XDG_CONFIG_HOME/studio.tomato.todo/desktop.json`，不随任务备份导入到其他电脑。
- **系统运行库**：依赖 `pactl`（专注时抑制其他应用提示音；Arch 由 `libpulse` 提供，Debian / Ubuntu 为 `pulseaudio-utils`）。

Windows 桌面层与跨平台 CI 的当前证据和剩余验收项见 [跨平台适配记录](docs/CROSS_PLATFORM.md)。

## 专注保护能做什么、不能做什么

守卫通过当前桌面的原生窗口接口获取前台窗口并把不允许的应用切回专注界面。白名单按精确应用标识匹配（niri 的 `app_id`、X11 的 `WM_CLASS` 应用类），可直接添加当前打开的应用。浏览器内的所有网站共用一个应用标识，因此允许浏览器也会允许其中的娱乐网站。

这是**自律辅助功能**。它不会结束其他进程，不会暂停或修改其他应用；无法阻止系统快捷键、工作区总览、其他显示器的内容或外部结束进程。严格模式由守卫拒绝提前退出，而非只隐藏按钮；IPC 故障仍会解除当前保护并报错。尚未实现云同步、在线自习室、网站过滤或操作系统级安全锁屏。

定时锁机需要 runtime 与守卫保持运行，登录自启即可。电脑休眠时不唤醒，恢复或重开时若仍在时段内则继续锁机。星期按开始日期计算，启用的时段不允许重叠。进入睡眠时结束当前专注并保留实际用时；锁机结束不会自动重启专注。

## 数据与备份

任务、统计和设置只保存在本机的计划 JSON：`$XDG_DATA_HOME/studio.tomato.todo/plan.json`，未设置时位于 `~/.local/share/studio.tomato.todo/`。它是唯一数据源，原子写入；runtime 可用 `--data` 指定其他数据目录。**不要在 runtime 运行时手动改文件**，迁移数据请用导出与备份。

- **学习计划**（设置 → 学习计划）：导出未完成实例、模板、项目与课表阻塞时段，便于编辑或分享。导入是**以文件为准的配置更新**——相同 ID 的任务、模板、项目与阻塞时段按文件更新，完成进度、专注历史一律保留；文件没提到的实体默认不动，加 `"replace": true` 改为整份同步。规范见 [PLAN_FORMAT.md](docs/PLAN_FORMAT.md)。
- **完整备份**：包含严格模式、定时锁机与永久 ID 历史。导入备份会替换当前数据，需在界面确认，并暂停导入的计时器。规范见 [BACKUP_FORMAT.md](docs/BACKUP_FORMAT.md)。

用户提供的课表和私人备考分析位于忽略版本管理的 `artifacts/planning/`，不打入程序。

## 文档

| 文档                                  | 内容                                               |
| ------------------------------------- | -------------------------------------------------- |
| [设计理念](docs/DESIGN.md)            | 任务、习惯、项目与愿景为什么这样分；模板印刷的取舍 |
| [学习计划格式](docs/PLAN_FORMAT.md)   | v6 计划文件字段语义、Schema 与通用示例             |
| [完整备份格式](docs/BACKUP_FORMAT.md) | v4 备份字段语义、Schema 与示例                     |
| [MCP 接入指南](docs/MCP.md)           | 把 tomato-runtime 的 MCP 接入任意客户端            |
| [CODEMAP.md](CODEMAP.md)              | 按任务与目录的代码导航地图                         |

## 开发与贡献

需要 Node.js 22.12+ 与 pnpm；Rust stable 仅在 `crates/guard/` 需要。快速上手：

```sh
pnpm install
pnpm core:test         # 领域核心的 vitest 测试
pnpm runtime:test      # runtime 的 node --test 测试
pnpm build:runtime     # 打包 runtime
```

提交前请读 [CONTRIBUTING.md](CONTRIBUTING.md)：命令、架构、worktree 约定、隔离桌面测试约束与提交信息规范都在那里。

## 路线图

DSH 插件架构已经落地（0.13.0 起）。**稳定版 1.0.0 的验收条件是外观、功能、性能三项都通过**（外观成套统一、功能闭环实测、性能达标）；在那之前只发 0.x 小版本。以下是尚未实现的方向，欢迎一起补齐：

- **网站级过滤与系统级安全锁屏**：白名单按应用匹配，浏览器内所有网站共用一个标识；保护也不阻止系统快捷键或外部强杀。
- **云同步与在线自习室**：任务、统计与设置默认只保存在本机。

## 许可

[MIT](LICENSE)。
