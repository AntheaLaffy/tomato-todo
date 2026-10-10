---
mode: maintenance
generated_at: 2026-10-09
---

把浏览器操作接入相同 Rust 核心。

## 文件

| File | Domain | Function |
| --- | --- | --- |
| main.rs | 预览 | 本地端口、来源检查、20 MB 限制、快照/计划导出/Action API 与 dist 静态文件 |

共享核心接口核对：Action/Snapshot 直接序列化模板、印刷记录、静态实例；计划导出为 v4，完整备份为 v3，Snapshot 携带节点进度；新 Action 仍由通用桥接传递。无新增 IPC/HTTP 路由，原生保护与白名单循环未改。
