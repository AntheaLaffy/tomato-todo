---
mode: maintenance
generated_at: 2026-10-11
---

应用自有的 Pi 编排层：Rust 决定权限与数据边界，Node 只执行分析与工具调用。

## 任务指南

| 任务 | Domain | Target | Also Check |
| --- | --- | --- | --- |
| 权限、工具白名单与自动唤醒 | 智能体 | lib.rs、tools.rs | docs/AGENT.md、tests/agent.mjs |
| 导出/审阅/应用与来源指纹 | 文件契约 | files.rs | docs/PLAN_FORMAT.md、docs/BACKUP_FORMAT.md、tests.rs |
| 本机 MCP 桥接与令牌 | 桥接 | bridge.rs | agent/mcp.mjs、tests/agent.mjs |
| 启动/重启 Node 工作进程 | 运行时 | worker.rs | agent/worker.mjs、scripts/build-agent.mjs |
| 配置、记忆与唤醒记录 | 状态 | state.rs | crates/core/src/diagnostics.rs、tests.rs |

## 文件

| File | Domain | Function |
| --- | --- | --- |
| lib.rs | 智能体 | Agent 生命周期、配置/登录/状态、工具授权、网络转发、唤醒排队与工作区锁 |
| bridge.rs | 桥接 | 仅监听 127.0.0.1 的 MCP JSON-RPC，校验私有令牌并拒绝浏览器 Origin |
| files.rs | 文件契约 | 私有工作区的导出/分段读取/补丁/审阅/应用，来源与文件哈希并发校验 |
| state.rs | 状态 | Preferences（含联网模式）、Memory、Store 与原子写入的私有文件 |
| tools.rs | 契约 | 内嵌与外部的工具定义及允许集合（内嵌无 dispatch/apply_file） |
| worker.rs | 运行时 | 子进程管理：启动、行协议收发与重启 |
| tests.rs | 验证 | 权限、记忆确认、补丁原子性、来源冲突、空闲排队与重启冷却 |
