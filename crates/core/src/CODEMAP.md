---
mode: maintenance
generated_at: 2026-10-10
---

以验证后的状态替换和 SQLite 原子持久化保存用户操作。

## 任务指南

| 任务 | Domain | Target | Also Check |
| --- | --- | --- | --- |
| 修改任务/重复规则 | 业务核心 | lib.rs 的 AppData::apply | tests.rs、src/types.ts |
| 计划合并/导出与文件校验 | 文件契约 | plan.rs | docs/CODEMAP.md、tests.rs、桌面/预览与 TypeScript 消费方 |
| 修复倒计时与统计 | 业务核心 | lib.rs 的 tick/stats/Engine | tests.rs、桌面后台线程 |
| 定时锁机/严格执行 | 业务核心 | lock.rs、lib.rs 的 protected/strict_protected/tick/apply | 桌面后台线程、src 的 lockPage/guardPage、docs/BACKUP_FORMAT.md |
| 扩展桌面白名单 | 桌面保护 | guard.rs | src-tauri/src/main.rs、tests/native.mjs |

## 主要接口

| Symbol | Source | Line |
| --- | --- | --- |
| AppData / Action | lib.rs | L:243 / L:292 |
| Engine | lib.rs | L:1041 |
| guard | guard.rs | L:1 |

## 文件

| File | Domain | Function |
| --- | --- | --- |
| lib.rs | 业务核心 | 数据模型、Action、计时、重复任务、统计、Engine 持久化 |
| plan.rs | 文件契约 | v1/v2 计划 DTO、导出未完成任务、原子合并、稳定 ID 去重、番茄时长换算 |
| lock.rs | 定时保护 | 锁机规则/执行状态、跨午夜本地周历、重叠检查与本轮抑制 |
| guard.rs | 桌面保护 | niri IPC 能力检测、精确应用匹配和回焦 |
| tests.rs | 验证 | 状态、持久化、保护与计划往返/失败原子性回归测试 |
| reminders.rs | 时间安排 | 日期/时间与单次时长校验、当天待处理队列、计时/锁机延后、跨日清理 |
