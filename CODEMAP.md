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
| HTTP API 与 MCP 入口 | runtime | runtime/src/server.mjs、mcp.mjs、mcp-stdio.mjs | API.md、docs/MCP.md、runtime/test/ |
| guard 客户端与 --guard-status | runtime | runtime/src/guard-client.ts | API.md guard 命令协议、runtime/test/ |
| DSH 插件 host 工具 | 插件 | plugin/index.js | API.md、docs/MCP.md |
| DSH 插件 UI（入口卡/四页签面板） | 插件 | plugin/client.js（部件源在 plugin/src-client/，不随包分发） | plugin/README.md、API.md 只读端点 |
| 专注保护与锁屏（各桌面后端） | 原生 | crates/guard/src/（guard.rs 后端选择、x11/wayland/wayland_surface/shell/win32/macos 各后端） | API.md guard 命令协议、crates/guard/README.md |
| GNOME Shell 桥接扩展 | 桌面集成 | desktop-integrations/ | crates/guard/src/shell.rs |
| 数据迁移（旧 sqlite → plan.json） | 工具 | scripts/export-sqlite.mjs | scripts/export-sqlite.test.mjs |
| 安装与自启 | 工具 | scripts/install.mjs | scripts/install.test.mjs |
| 发布与 CI | 构建 | .github/workflows/ci.yml、packaging/aur/ | scripts/publish-aur.mjs |
| 手册自查 | 文档 | scripts/check-handbook.py、handbook-paths.py | docs/HANDBOOK/README.md |

## 子目录

| Dir | Domain | Depends On | Purpose |
| --- | --- | --- | --- |
| packages/core/ | 业务核心 | 无（零依赖 TS） | 领域模型与规则引擎，vitest 全覆盖 |
| runtime/ | 服务 | packages/core（合并时经 esbuild 打入 vendor/） | 数据落盘、计时/提醒、HTTP API、MCP 入口 |
| plugin/ | DSH 插件 | runtime HTTP/MCP 契约 | host 工具 + client UI（入口卡与四页签面板） |
| crates/guard/ | 原生守卫 | 系统库 | 专注保护/锁屏/通知，受 runtime 指挥 |
| desktop-integrations/ | 桌面集成 | GNOME Shell | 可选原生窗口桥接扩展，随 Linux 包发行 |
| scripts/ | 构建与工具 | Node、Python | 打包、安装、迁移、手册自查 |
| packaging/ | 发布 | AUR | 发行打包模板 |
| .github/ | 构建 | GitHub Actions | CI 与发布工作流 |
| docs/ | 契约与手册 | — | 计划/备份字段、设计理念、实现手册、MCP 接入 |
| MIGRATION.md / API.md | 重写台账与契约 | — | 迁移阶段记录；进程间契约（HTTP/MCP/guard） |
