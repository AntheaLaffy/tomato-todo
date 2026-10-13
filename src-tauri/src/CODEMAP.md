---
mode: maintenance
generated_at: 2026-10-10
---

桌面与 Android 原生入口复用 Rust 核心和系统文件校验。

## 文件

| File | Domain | Function |
| --- | --- | --- |
| main.rs | 构建 | 桌面二进制薄入口，调用 tomato_todo_lib::run |
| lib.rs | 原生入口 | Tauri 库/Android JNI 入口、平台标识与共享 Engine 状态/保护预检，按目标选择桌面或 Android 宿主 |
| desktop_app.rs | 桌面 | 命令桥接、通知、单实例、任务提醒唤回、计时阶段结束唤回窗口、高亮、定时唤回锁机、严格保护与故障释放；学习助手 IPC 与 agent-wake 事件，应用待审阅文件前校验来源指纹 |
| desktop.rs | 桌面 | 托盘菜单、桌面偏好、Linux XDG 与 Windows/macOS 原生自启动、平台配置目录、隐藏/唤回及 Linux 无托盘回退 |
| files.rs | 文件桥接 | 系统选择器导入/导出计划与备份，阻塞线程池等待用户选择；桌面路径和 Android SAF URI 共用大小限制、核心格式校验 |
| mobile.rs | Android | 本地核心 IPC、SQLite 恢复与计时轮询；尚未接入系统保护、后台服务和 Pi 运行时，开启保护前明确失败 |

共享核心接口核对：Action/Snapshot 直接序列化模板、印刷记录、静态实例；计划导出为 v4，完整备份为 v3，Snapshot 携带节点进度；新 Action 仍由通用桥接传递。新增学习助手 IPC 与 agent-wake 桌面事件；应用审阅文件时在 Engine 锁内复核来源指纹与空闲状态；原生保护与白名单循环未改。
