---
mode: maintenance
generated_at: 2026-10-09
---

把浏览器操作接入相同 Rust 核心。

## 文件

| File | Domain | Function |
| --- | --- | --- |
| main.rs | 预览 | 本地端口、来源检查、20 MB JSON请求限制、大文件Range下载与禁止跨站访问、快照/计划导出/Action API、学习助手路由（agent 请求在线程池执行，agent_open_login/MCP 入口）与 dist 静态文件 |

共享核心接口核对：Action/Snapshot承载普通任务、学情摘要及独立education教学记录；计划导出为v6，完整备份为v4。助手HTTP桥接复用Rust Agent工具、身份和项目授权；桌面/预览保护预检均拒绝为自动开始选项开启保护。新Action仍由通用桥接传递。新增学习助手 HTTP 路由并复用同一 Engine；应用审阅文件时在锁内复核来源指纹；原生保护与白名单循环未改。
