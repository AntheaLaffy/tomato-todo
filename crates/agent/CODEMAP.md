---
mode: maintenance
generated_at: 2026-10-14
---

应用自有的 Pi 编排层：Rust 决定权限与数据边界，Node 只执行分析与工具调用。

## 任务指南

| 任务 | Domain | Target | Also Check |
| --- | --- | --- | --- |
| 权限、工具白名单与自动唤醒 | 智能体 | src/lib.rs、src/tools.rs | docs/AGENT.md、tests/agent.mjs |
| 对话搜索、分支与附件 | 对话 | src/conversations.rs、src/attachments.rs、src/state.rs | agent/session.mjs、agent/worker.mjs、src/agent.ts、tests/agent.mjs |
| 导出/审阅/应用与来源指纹 | 文件契约 | src/files.rs | docs/PLAN_FORMAT.md、docs/BACKUP_FORMAT.md、src/tests.rs |
| 本机 MCP 桥接与令牌 | 桥接 | src/bridge.rs | agent/mcp.mjs、tests/agent.mjs |
| 启动/重启 Node 工作进程 | 运行时 | src/worker.rs | agent/worker.mjs、scripts/build-agent.mjs |
| 配置、记忆与唤醒记录 | 状态 | src/state.rs | crates/core/src/diagnostics.rs、src/tests.rs |

## 子目录

| Dir | Domain | Depends On | Purpose |
| --- | --- | --- | --- |
| src/ | 智能体 | core、Pi 工作进程 | 生命周期、权限、会话状态、附件与文件审阅；见 src/CODEMAP.md |

## 文件

| File | Domain | Function |
| --- | --- | --- |
| Cargo.toml | 构建 | Rust 助手包依赖，含 Base64 附件传输与私有状态保存 |
