---
mode: maintenance
generated_at: 2026-10-10
---

让窗口行为、计时事件与 Rust 状态保持一致。

## 文件

| File | Domain | Function |
| --- | --- | --- |
| main.rs | 桌面 | 命令桥接、备份/计划文件校验、通知、单实例、任务提醒唤回、计时阶段结束唤回窗口、高亮、定时唤回锁机、严格保护与故障释放；学习助手 IPC（agent_call/agent_open_login）与 agent-wake 事件，应用待审阅文件前校验来源指纹 |
| desktop.rs | 桌面 | 托盘菜单、桌面偏好、XDG 自启动、隐藏/唤回及无托盘回退 |

共享核心接口核对：Action/Snapshot 直接序列化模板、印刷记录、静态实例；计划导出为 v4，完整备份为 v3，Snapshot 携带节点进度；新 Action 仍由通用桥接传递。新增学习助手 IPC 与 agent-wake 桌面事件；应用审阅文件时在 Engine 锁内复核来源指纹与空闲状态；原生保护与白名单循环未改。
