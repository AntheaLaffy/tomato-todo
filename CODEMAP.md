---
mode: maintenance
ignore: See Scope and Exclusions
generated_at: 2026-11-07
---

番茄 Todo 重写后的仓库地图：DSH 插件 + TypeScript 领域核心 + Node runtime + Rust 原生守卫。
当前目录使用 Git 管理，地图按受管源码导航。

## Scope and Exclusions

| Path / pattern | Treatment | Reason |
| --- | --- | --- |
| node_modules/、packages/core/node_modules/、target/、runtime/vendor/、**/.vite/ | Excluded | 依赖、构建与缓存产物 |
| crates/guard/Cargo.lock | Excluded | 依赖锁文件保留，无需逐项导航 |
| public 类二进制资源、plugin/icon.svg | Boundary only | 静态资源，引用由配置与视图管理 |
| .agents/skills/ | Boundary only | 随项目的维护者技能，由 AGENTS.md 指引 |
| LEAD-NOTES.md | Excluded | lead 协调台账，非源码导航目标 |

## 任务指南

| 任务 | Domain | Target | Also Check |
| --- | --- | --- | --- |
| 任务/习惯/模板/阻塞时段/锁机/统计的领域逻辑 | 业务核心 | packages/core/src/ 对应模块（engine.ts 为引擎入口） | docs/HANDBOOK/ 对应章、docs/PLAN_FORMAT.md、packages/core/test/ |
| 番茄计时、提醒调度、数据落盘 | runtime | runtime/src/engine.ts | runtime/test/engine.test.mjs、API.md |
| HTTP API 与 MCP 入口 | runtime | runtime/src/server.mjs、mcp.mjs、mcp-stdio.mjs；局部地图 runtime/CODEMAP.md | API.md、docs/MCP.md、runtime/test/、runtime/test/connection.test.mjs |
| guard 客户端与 --guard-status | runtime | runtime/src/guard-client.ts | API.md guard 命令协议、runtime/test/ |
| 项目资料库的本机授权与文件读取 | runtime | runtime/src/project-library.mjs、runtime/src/server.mjs（`/api/projects*`、`/api/resources/*`）、runtime/src/engine.ts 的 `validateResourceAction` | docs/EDUCATION.md、API.md「项目资料库」、docs/HANDBOOK/06-安全与隐私边界.md |
| DSH 插件 host 工具（15 个 `tomato_*`） | 插件 | plugin/index.js、plugin/host-tool-specs.js（由 scripts/build-host-tools.mjs 生成） | runtime/src/tools.mjs、scripts/plugin-host.test.mjs、plugin/README.md、API.md、docs/MCP.md |
| DSH 插件内置技能与跨 agent 链接 | 插件 | plugin/skills.js（技能提供者）、plugin/skills/（文件清单见 plugin/CODEMAP.md）、plugin/link-skills.js（挂载时软链）与 link-skills.mjs（命令行） | plugin/README.md、plugin/CODEMAP.md |
| 插件界面与展示语言（zh/en/ja） | 插件 | plugin/src/client/shared/copy.js、plugin/src/client/shared/ja.js、plugin/locale/ja.json | plugin/README.md、API.md「插件契约」、plugin/CODEMAP.md |
| DSH 插件 UI 源码（皮肤/主视图/沉浸/HUD） | 插件 | plugin/src/client/（入口 entry.js；skin/ 皮肤、app/ 框架与常驻组件、pages/ 九页、shared/ 组件库与数据层；局部地图 plugin/src/client/CODEMAP.md） | docs/SKIN.md、docs/LEGACY_FEATURES.md、API.md「UI 数据面」、scripts/smoke-client.mjs |
| DSH 插件 client 构建与冒烟 | 插件 | plugin/client.js（构建产物，pnpm build:client）、scripts/build-client.mjs、scripts/smoke-client.mjs | plugin/README.md、docs/SKIN.md |
| 专注保护与锁屏（各桌面后端） | 原生 | crates/guard/src/CODEMAP.md（guard/state、niri IPC 与 toplevel 显式全屏） | API.md guard 命令协议、crates/guard/README.md、scripts/niri-guard.test.mjs |
| GNOME Shell 桥接扩展 | 桌面集成 | desktop-integrations/ | crates/guard/src/shell.rs |
| 数据迁移（旧 sqlite → plan.json） | 工具 | scripts/export-sqlite.mjs | scripts/export-sqlite.test.mjs |
| 安装与自启 | 工具 | scripts/install.mjs | scripts/install.test.mjs |
| 发布与 CI | 构建 | .github/workflows/ci.yml、packaging/aur/ | scripts/publish-aur.mjs |
| 手册自查 | 文档 | scripts/check-handbook.py、handbook-paths.py | docs/HANDBOOK/README.md |

## 子目录

| Dir | Domain | Depends On | Purpose |
| --- | --- | --- | --- |
| packages/core/ | 业务核心 | 无（零依赖 TS） | 领域模型与规则引擎，vitest 全覆盖 |
| runtime/ | 服务 | packages/core（合并时经 esbuild 打入 vendor/） | 数据落盘、计时/提醒、HTTP API、MCP 入口与项目资料库；源码与测试索引见 runtime/CODEMAP.md |
| plugin/ | DSH 插件 | runtime HTTP/MCP 契约 | host 工具、随包技能与全 DSH 番茄皮肤九页主视图（client.js 为 esbuild 产物）；包内分派见 plugin/CODEMAP.md |
| crates/guard/ | 原生守卫 | 系统库 | 专注保护/锁屏/通知，受 runtime 指挥；源码索引见 crates/guard/src/CODEMAP.md |
| desktop-integrations/ | 桌面集成 | GNOME Shell | 可选原生窗口桥接扩展，随 Linux 包发行 |
| scripts/ | 构建与工具 | Node、Python | 打包、安装、迁移、手册自查；文件清单见 scripts/CODEMAP.md |
| packaging/ | 发布 | AUR | 发行打包模板 |
| .github/ | 构建 | GitHub Actions | CI 与发布工作流 |
| docs/ | 契约与手册 | — | 计划/备份字段、设计理念、实现手册、MCP 接入；文件清单见 docs/CODEMAP.md |
| MIGRATION.md / API.md | 重写台账与契约 | — | 迁移阶段记录；进程间契约（HTTP/MCP/guard） |
