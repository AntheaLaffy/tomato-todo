---
mode: maintenance
generated_at: 2026-10-09
---

Rust 领域模型与浏览器预览适配层。

## 任务指南

| 任务 | Domain | Target | Also Check |
| --- | --- | --- | --- |
| 修改任务或计时规则 | 业务核心 | core/CODEMAP.md | preview/ 与 src-tauri/ |

## 子目录

| Dir | Domain | Depends On | Purpose |
| --- | --- | --- | --- |
| core/ | 业务核心 | serde、chrono、rusqlite | 状态机、存储、统计与保护 |
| preview/ | 预览 | core、Axum | 本地 HTTP 服务 |
