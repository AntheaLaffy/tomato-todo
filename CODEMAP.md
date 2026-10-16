---
mode: maintenance
ignore: See Scope and Exclusions
generated_at: 2026-10-10
---

Rust 驱动的 Linux 桌面番茄任务工具。当前目录使用 Git 管理，地图按受管源码导航。

## Scope and Exclusions

| Path / pattern | Treatment | Reason |
| --- | --- | --- |
| target/、node_modules/、dist/、src-tauri/gen/（除 gen/android/ 维护的工程源码）、agent/node_modules/、agent/bundle/ | Excluded | 构建、依赖、生成的 ACL schema 与随包运行产物；Android 工程由局部地图纳入 |
| artifacts/、*.sqlite3* | Excluded | 测试截图、私人课表分析与本地数据库 |
| Cargo.lock、pnpm-lock.yaml、**/package-lock.json | Excluded | 依赖锁文件保留，但无需逐项导航 |
| public/、src-tauri/icons/ | Boundary only | 静态二进制资源，引用由配置与视图管理 |
| src-tauri/capabilities/ | Boundary only | 短 JSON 原生权限清单；命令变更时定向核对 |
| CODEMAP.md、*.analysis.md | Excluded | 索引产物本身不递归纳入 |
| .agents/skills/ | Boundary only | 随项目的维护者技能；由 AGENTS.md 与 README 指引，不逐个导航 |
| agent/skills/ | Boundary only | 随包给学习助手按需读取的技能与练习；由 agent/CODEMAP.md 和 system-prompt.md 指引 |

## 任务指南

| 任务 | Domain | Target | Also Check |
| --- | --- | --- | --- |
| 任务时间提醒与单次时长 | 业务核心 / 桌面 | crates/core/src/reminders.rs、src-tauri/src/desktop_app.rs | src/main.ts、src/types.ts、docs/PLAN_FORMAT.md、docs/HANDBOOK/12-课表与提醒.md |
| 目标容器与过期补做 | 业务核心 / 界面 | crates/core/src/nodes.rs 的配对/信号与 lib.rs 的 Goal、src/main.ts 的 goalDialog | src/types.ts、docs/BACKUP_FORMAT.md |
| 主线节点、信号与永久 ID | 业务核心 / 界面 | crates/core/src/nodes.rs、identities.rs、src/nodegraph.ts | docs/NODE_DESIGN.md、docs/HANDBOOK/15-目标与主线.md、src/main.ts 的 goalDialog、node_tests.rs、plan.rs、src/types.ts 与文件契约 |
| 习惯分组与周期印刷 | 业务核心 / 界面 | crates/core/src/templates.rs、src/main.ts 的 habitsTab | templates.rs 的 materialize_templates、src/types.ts、docs/BACKUP_FORMAT.md |
| 愿景标记 | 业务核心 / 界面 | crates/core/src/lib.rs 的 Vision、src/main.ts 的 visionsTab | src/types.ts、docs/BACKUP_FORMAT.md |
| 模板标签、手动批量印刷、滚动预印 | 业务核心 / 界面 | crates/core/src/templates.rs、src/main.ts 的 tasksPage/templatesCard/templateDialog/printDialog | crates/core/src/plan.rs、docs/HANDBOOK/14-模板与印刷.md、src/types.ts、docs/CODEMAP.md |
| 课表阻塞时段与课内并行 | 业务核心 / 界面 / 智能体 | crates/core/src/blocks.rs、src/main.ts 的 schedulePage/blocksCard/blockDialog | crates/core/src/diagnostics.rs、docs/HANDBOOK/12-课表与提醒.md、docs/HANDBOOK/17-诊断与统计.md、plan.rs、crates/agent/src/{tools.rs,lib.rs}、docs/PLAN_FORMAT.md |
| 修改任务、计时、统计 | 业务核心 | crates/core/CODEMAP.md | src/types.ts 与 src/main.ts |
| 学习计划文件导入/导出 | 文件契约 | docs/CODEMAP.md、crates/core/src/plan.rs | src/api.ts、src/types.ts、src/main.ts、桌面/预览适配层 |
| 写作业 BGM 导入与播放 | 声音 / 界面 | src/bgm.ts、src/main.ts 的 soundDialog | src/CODEMAP.md、tests/audio.mjs、tests/integration.mjs、docs/HANDBOOK/24-界面手感与音效.md |
| 雨声/棕噪音无声与循环 | 声音 / 桌面 | src/audio.ts、src-tauri/src/lib.rs | public/audio/LICENSE.md、Linux GStreamer bad 插件打包依赖、tests/audio.mjs、docs/HANDBOOK/24-界面手感与音效.md |
| 关键节点音效与音量 | 声音 / 契约 | src/audio.ts、src/sound-events.ts、src/main.ts 的 accept/设置 | crates/core/src/lib.rs 的 Settings、docs/HANDBOOK/24-界面手感与音效.md、src/types.ts、docs/BACKUP_FORMAT.md、tests/audio.mjs |
| 专注时拦截其他应用提示音 | 声音 / 桌面 | src-tauri/src/focus_audio.rs、desktop_app.rs | docs/HANDBOOK/24-界面手感与音效.md、README.md、Linux 打包依赖 |
| 学习助手、异常诊断、联网与 MCP | 智能体 / 桌面 | crates/agent/、agent/、src/agent.ts | docs/HANDBOOK/18-助手-权限与唤醒.md、docs/HANDBOOK/19-助手-文件工作区与MCP.md、agent/mcp-config.mjs 与 agent/session.mjs 的 MCP 加载、docs/AGENT.md、crates/core/src/diagnostics.rs、tests/agent.mjs、桌面/预览桥接 |
| 作者彩蛋、提示词原文与完整访问 | 智能体 | crates/agent/src/creator.rs、agent/session.mjs、agent/system-prompt.md | crates/agent/src/{lib.rs,state.rs}、src/agent.ts、tests/agent.mjs、docs/AGENT.md |
| 运行时人格与切换 | 智能体 | crates/agent/src/state.rs 的 Persona、crates/agent/src/tools.rs、agent/session.mjs | crates/agent/src/lib.rs 的 prompt_command/call、src/agent.ts 的 personas sheet、docs/AGENT.md、tests/agent.mjs |
| Canvas 文档与 Codex ImageGen | 智能体 / 界面 | crates/agent/src/canvas.rs、src/agent-canvas.ts、agent/imagegen.mjs、src/agent-media.ts | agent/session.mjs、crates/agent/src/{lib.rs,state.rs,tools.rs}、src/agent.ts、tests/agent-workspace.mjs、docs/AGENT.md |
| 对话历史搜索/归档、思考展示、编辑重试、分支、附件与 Markdown | 智能体 / 界面 | crates/agent/src/CODEMAP.md、agent/CODEMAP.md、src/agent.ts、src/agent-chat.ts、src/agent-markdown.ts | src/api.ts、src-tauri/src/files.rs、tests/agent.mjs、docs/AGENT.md |
| Codex CLI 登录与第三方模型配置 | 智能体 / 界面 | agent/codex-config.mjs、agent/worker.mjs | agent/session.mjs、agent/web.mjs、src/agent.ts、tests/agent.mjs、docs/AGENT.md、scripts/build-agent.mjs |
| 调整界面与配色 | 界面 | src/CODEMAP.md | 必要时 API 类型 |
| 修复锁定或白名单 | 桌面 | crates/core/src/guard.rs、crates/core/src/guard_windows.rs、src-tauri/src/desktop_app.rs | crates/core/tests/guard_windows.rs、tests/windows.mjs、tests/native.mjs、src 的 guardPage |
| 启动/打包/测试 | 构建 | README.md、CONTRIBUTING.md、package.json | src-tauri/tauri.conf.json、scripts/ |
| 跨平台适配 | 构建 / 桌面 | docs/CROSS_PLATFORM.md、scripts/agent-runtime.mjs、src-tauri/CODEMAP.md | crates/core/src/guard.rs、crates/agent/、.github/workflows/ci.yml、src/ |
| Linux Wayland 桌面保护 | 桌面 | crates/core/src/guard.rs、guard_wayland.rs、guard_shell.rs、desktop-integrations/CODEMAP.md | scripts/install-desktop-integration.py、tests/linux-desktops.mjs、tests/wayland.mjs、docs/CROSS_PLATFORM.md |
| 安装/自启动/托盘/快捷栏 | 桌面 | src-tauri/src/desktop.rs、scripts/install.py | src/api.ts、src 的桌面设置、tests/native.mjs、tests/install.mjs |
| 配置 CI/CD、发布版本 | 构建 | .github/CODEMAP.md | package.json、src-tauri/tauri.conf.json、README.md |
| 发布到 AUR | 发布 | scripts/publish-aur.mjs、packaging/aur/ | .github/workflows/release.yml、scripts/build-agent.mjs |
| 维护项目结构 | 维护 | AGENTS.md、各级 CODEMAP.md | .agents/skills/README.md、实际新增/删除的文件 |
| 查实现事实 / 读代码前先看说明 | 参考手册 | docs/HANDBOOK/README.md 的覆盖表 | 各章 C/D 段（机制、语义规则与不变量）、附录 docs/HANDBOOK/04-导航对照.md、scripts/check-handbook.py |

## 子目录

| Dir | Domain | Depends On | Purpose |
| --- | --- | --- | --- |
| crates/ | 业务核心 | Rust 依赖 | 领域模型与本地预览服务 |
| desktop-integrations/ | 桌面集成 | GNOME Shell | 可选原生窗口桥接扩展，随 Linux 包发行，由用户安装启用 |
| agent/ | 智能体运行时 | Pi SDK、Node | 随包的 Pi 会话、工具集、技能、MCP 与联网实现 |
| src-tauri/ | 原生宿主 | core、Tauri、Android SDK/NDK | 桌面/Android 入口、原生 IPC、窗口、通知与打包 |
| src/ | 界面 | Tauri API、Lucide | TypeScript 与 CSS 界面 |
| scripts/ | 构建 | Cargo、npm、Python | 开发服务、Linux 用户安装与 AUR 发布 |
| packaging/ | 发布 | AUR | 发行打包模板：AUR PKGBUILD 模板与桌面入口，由 scripts/publish-aur.mjs 渲染 |
| .github/ | 构建 | GitHub Actions、Linux/Windows/macOS、Android NDK | CI 与标签发布工作流 |
| tests/ | 验证 | Chromium、WebKit、niri | 业务与隔离桌面集成测试 |
| docs/ | 文件契约 / 领域设计 / 实现手册 | Rust core | 学习计划 v5 / 备份 v3 标准、Schema、通用示例，设计理念与节点语义实现记录；docs/HANDBOOK/ 按域记录实现事实与边界 |
| assets/ | 展示 | — | Boundary only：README 截图，仅由 README 引用，不含代码 |
| public/ | 资源 | Vite | Internals not indexed：本地图标、字体及字体许可证 |

## 文件

| File | Domain | Function |
| --- | --- | --- |
| AGENTS.md | 维护 | 索引导航与隔离测试约束 |
| README.md | 使用 | 面向安装用户的入口：卖点、界面截图、安装、桌面适配、数据与备份、文档索引 |
| CONTRIBUTING.md | 维护 | 开发环境、命令、架构、隔离桌面测试约束与提交信息规范 |
| Cargo.toml | 构建 | Rust workspace 与编译配置 |
| package.json | 构建 | Node 依赖和开发/测试命令 |
| tsconfig.json | 构建 | TypeScript 编译约束 |
| vite.config.ts | 构建 | UI 构建与 /api 预览代理 |
| index.html | 界面 | 页面根节点与入口 |
| .gitignore | 维护 | 生成产物、私人分析和数据库排除 |
| LICENSE | 维护 | MIT 许可，对应 Cargo 工作区 license 字段 |
| CHANGELOG.md | 维护 | 版本变更与下一版本待办与关键节点音效记录 |
