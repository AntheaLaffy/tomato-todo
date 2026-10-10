---
mode: maintenance
generated_at: 2026-10-09
---

Rust 领域模型与浏览器预览适配层。

## 任务指南

| 任务 | Domain | Target | Also Check |
| --- | --- | --- | --- |
| 修改任务或计时规则 | 业务核心 | core/CODEMAP.md | preview/ 与 src-tauri/ |
| 修改学习助手、诊断与联网 | 智能体 | agent/CODEMAP.md | core/src/diagnostics.rs、preview、src-tauri、agent/、docs/AGENT.md |

## 子目录

| Dir | Domain | Depends On | Purpose |
| --- | --- | --- | --- |
| core/ | 业务核心 | serde、chrono、rusqlite | 状态机、存储、统计、诊断与保护 |
| agent/ | 智能体 | core、Axum | Pi 编排、MCP 桥接、文件审阅与网络工具转发 |
| preview/ | 预览 | core、Axum | 本地 HTTP 服务 |
