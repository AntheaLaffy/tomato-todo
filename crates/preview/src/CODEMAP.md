---
mode: maintenance
generated_at: 2026-10-09
---

把浏览器操作接入相同 Rust 核心。

## 文件

| File | Domain | Function |
| --- | --- | --- |
| main.rs | 预览 | 本地端口、来源检查、20 MB 限制、快照/计划导出/Action API、学习助手路由（agent/agent_open_login/MCP 入口）与 dist 静态文件 |

共享核心接口核对：Action/Snapshot 直接序列化模板、印刷记录、静态实例；计划导出为 v4，完整备份为 v3，Snapshot 携带节点进度；新 Action 仍由通用桥接传递。新增学习助手 HTTP 路由并复用同一 Engine；应用审阅文件时在锁内复核来源指纹；原生保护与白名单循环未改。
