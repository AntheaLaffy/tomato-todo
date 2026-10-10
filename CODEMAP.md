---
mode: maintenance
ignore: See Scope and Exclusions
generated_at: 2026-10-10
---

Rust 驱动的 Linux 桌面番茄任务工具。当前目录使用 Git 管理，地图按受管源码导航。

## Scope and Exclusions

| Path / pattern | Treatment | Reason |
| --- | --- | --- |
| target/、node_modules/、dist/、src-tauri/gen/、agent/node_modules/、agent/bundle/ | Excluded | 构建、依赖、生成的 ACL schema 与随包运行产物 |
| artifacts/、*.sqlite3* | Excluded | 测试截图、私人课表分析与本地数据库 |
| Cargo.lock、package-lock.json | Excluded | 依赖锁文件保留，但无需逐项导航 |
| public/、src-tauri/icons/ | Boundary only | 静态二进制资源，引用由配置与视图管理 |
| src-tauri/capabilities/ | Boundary only | 短 JSON 原生权限清单；命令变更时定向核对 |
| CODEMAP.md、*.analysis.md | Excluded | 索引产物本身不递归纳入 |

## 任务指南

| 任务 | Domain | Target | Also Check |
| --- | --- | --- | --- |
| 任务时间提醒与单次时长 | 业务核心 / 桌面 | crates/core/src/reminders.rs、src-tauri/src/main.rs | src/main.ts、src/types.ts、docs/PLAN_FORMAT.md |
| 目标容器与过期补做 | 业务核心 / 界面 | crates/core/src/nodes.rs 的配对/信号与 lib.rs 的 Goal、src/main.ts 的 goalDialog | src/types.ts、docs/BACKUP_FORMAT.md |
| 主线节点、信号与永久 ID | 业务核心 / 界面 | crates/core/src/nodes.rs、identities.rs、src/main.ts 的 goalDialog | docs/NODE_DESIGN.md、node_tests.rs、plan.rs、src/types.ts 与文件契约 |
| 习惯分组与周期印刷 | 业务核心 / 界面 | crates/core/src/templates.rs、src/main.ts 的 habitsTab | templates.rs 的 materialize_templates、src/types.ts、docs/BACKUP_FORMAT.md |
| 愿景标记 | 业务核心 / 界面 | crates/core/src/lib.rs 的 Vision、src/main.ts 的 visionsTab | src/types.ts、docs/BACKUP_FORMAT.md |
| 模板、手动批量印刷、滚动预印 | 业务核心 / 界面 | crates/core/src/templates.rs、src/main.ts 的 templateDialog/printDialog | crates/core/src/plan.rs、src/types.ts、docs/CODEMAP.md |
| 修改任务、计时、统计 | 业务核心 | crates/core/CODEMAP.md | src/types.ts 与 src/main.ts |
| 学习计划文件导入/导出 | 文件契约 | docs/CODEMAP.md、crates/core/src/plan.rs | src/api.ts、src/types.ts、src/main.ts、桌面/预览适配层 |
| 关键节点音效与音量 | 声音 / 契约 | src/audio.ts、src/sound-events.ts、src/main.ts 的 accept/设置 | crates/core/src/lib.rs 的 Settings、src/types.ts、docs/BACKUP_FORMAT.md、tests/audio.mjs |
| 学习助手、异常诊断与联网 | 智能体 / 桌面 | crates/agent/、agent/、src/agent.ts | docs/AGENT.md、crates/core/src/diagnostics.rs、tests/agent.mjs、桌面/预览桥接 |
| 调整界面与配色 | 界面 | src/CODEMAP.md | 必要时 API 类型 |
| 修复锁定或白名单 | 桌面 | crates/core/src/guard.rs、src-tauri/src/main.rs | tests/native.mjs、src 的 guardPage |
| 启动/打包/测试 | 构建 | README.md、package.json | src-tauri/tauri.conf.json、scripts/ |
| 安装/自启动/托盘/快捷栏 | 桌面 | src-tauri/src/desktop.rs、scripts/install.py | src/api.ts、src 的桌面设置、tests/native.mjs、tests/install.mjs |
| 配置 CI/CD、发布版本 | 构建 | .github/CODEMAP.md | package.json、src-tauri/tauri.conf.json、README.md |
| 维护项目结构 | 维护 | AGENTS.md、各级 CODEMAP.md | 实际新增/删除的文件 |

## 子目录

| Dir | Domain | Depends On | Purpose |
| --- | --- | --- | --- |
| crates/ | 业务核心 | Rust 依赖 | 领域模型与本地预览服务 |
| agent/ | 智能体运行时 | Pi SDK、Node | 随包的 Pi 会话、工具集、技能、MCP 与联网实现 |
| src-tauri/ | 桌面 | core、Tauri | 原生 IPC、窗口、通知与打包 |
| src/ | 界面 | Tauri API、Lucide | TypeScript 与 CSS 界面 |
| scripts/ | 构建 | Cargo、npm、Python | 开发服务与 Linux 用户安装 |
| .github/ | 构建 | GitHub Actions、Ubuntu 22.04 | CI 与标签发布工作流 |
| tests/ | 验证 | Chromium、WebKit、niri | 业务与隔离桌面集成测试 |
| docs/ | 文件契约 / 领域设计 | Rust core | 学习计划 v4 / 备份 v3 标准、Schema、通用示例及节点语义与实现记录 |
| public/ | 资源 | Vite | Internals not indexed：本地图标、字体及字体许可证 |

## 文件

| File | Domain | Function |
| --- | --- | --- |
| AGENTS.md | 维护 | 索引导航与隔离测试约束 |
| README.md | 使用 | 功能边界、运行、构建、验证与数据路径 |
| Cargo.toml | 构建 | Rust workspace 与编译配置 |
| package.json | 构建 | Node 依赖和开发/测试命令 |
| tsconfig.json | 构建 | TypeScript 编译约束 |
| vite.config.ts | 构建 | UI 构建与 /api 预览代理 |
| index.html | 界面 | 页面根节点与入口 |
| .gitignore | 维护 | 生成产物、私人分析和数据库排除 |
| LICENSE | 维护 | MIT 许可，对应 Cargo 工作区 license 字段 |
| CHANGELOG.md | 维护 | 版本变更与下一版本待办与关键节点音效记录 |
