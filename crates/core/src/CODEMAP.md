---
mode: maintenance
generated_at: 2026-10-10
---

以验证后的状态替换和 SQLite 原子持久化保存用户操作。

## 任务指南

| 任务 | Domain | Target | Also Check |
| --- | --- | --- | --- |
| 模板、自动预印与手动整批印刷 | 业务核心 | templates.rs 的 Printing/print_template/materialize_templates | template_tests.rs、src/main.ts 的 templateDialog/printDialog、plan.rs |
| 主线信号与实例配对 | 业务核心 | nodes.rs；功能索引见 nodes.rs.analysis.md | node_tests.rs、lib.rs、reminders.rs、src/main.ts、docs/NODE_DESIGN.md |
| ID 全局唯一及历史保留 | 持久化 | identities.rs 的 reconcile/validate、Engine | node_tests.rs、备份 v3、计划导入/任务恢复 |
| 修改任务/重复规则 | 业务核心 | lib.rs 的 AppData::apply | tests.rs、src/types.ts |
| 目标容器与待补 | 业务核心 | nodes.rs 的 bind_nodes/tick_nodes、lib.rs 的 Goal | src/main.ts 的 goalDialog/taskList、docs/BACKUP_FORMAT.md |
| 过期习惯与缺勤统计 | 业务核心 | lib.rs 的 TaskKind/is_habit 与 stats/DayStat.missed、reminders.rs 的 tick_reminders | src/main.ts 的 isHabit/isCatchUp、docs/BACKUP_FORMAT.md |
| 习惯分组与周期印刷 | 业务核心 | templates.rs 的 materialize_templates | src/main.ts 的 templateDialog/habitsTab、docs/BACKUP_FORMAT.md |
| 愿景标记 | 业务核心 | lib.rs 的 Vision/SaveVision | src/main.ts 的 visionDialog/visionsTab、docs/BACKUP_FORMAT.md |
| 项目排序 | 业务核心 | lib.rs 的 Action::ReorderProjects | src/main.ts 的侧栏拖拽/sortProjects |
| 批量删除/移出 | 业务核心 | lib.rs 的 Action::DetachTasks/DetachTarget | src/main.ts 的 selectControls/detachSelected |
| 计划更新/整份同步/导出与文件校验 | 文件契约 | plan.rs（按 ID 更新配置、`replace` 剪除） | docs/CODEMAP.md、tests.rs、桌面/预览与 TypeScript 消费方 |
| 修复倒计时与统计 | 业务核心 | lib.rs 的 tick/stats/Engine | tests.rs、桌面后台线程 |
| 主线统计与纵切面 | 业务核心 | lib.rs 的 stats/GoalStat/NodeStat/DayStat | node_tests.rs、src/main.ts 的 statsPage/goalStatsCard/crossSectionCard |
| 定时锁机/严格执行 | 业务核心 | lock.rs、lib.rs 的 protected/strict_protected/tick/apply | 桌面后台线程、src 的 lockPage/guardPage、docs/BACKUP_FORMAT.md |
| 扩展桌面白名单 | 桌面保护 | guard.rs | src-tauri/src/main.rs、tests/native.mjs |

## 主要接口

| Symbol | Source | Line |
| --- | --- | --- |
| AppData / Action | nodes.rs | 主线 | 时间配对、完成条件、不可逆裁定、局域阻断、信号防重/追溯、冻结配置 |
| identities.rs | 标识符 | 跨实体类型唯一、删除与历史引用永久保留、原任务恢复校验、导入历史合并 |
| node_tests.rs | 验证 | 主线配对/信号/阻断/检查/裁定/删除/重启/备份/历史 ID 与专注收尾；见 node_tests.rs.analysis.md |
| lib.rs | L:318 / L:400 |
| Engine | lib.rs | L:1578 |
| guard | guard.rs | L:1 |

## 文件

| File | Domain | Function |
| --- | --- | --- |
| lib.rs | 业务核心 | 备份 v3 数据模型、Action、计时、静态实例、无自定义单位的目标、习惯、愿景、按冻结字段推导的管辖分类（TaskKind）、统计（整条主线成败与逐日纵切面）、Engine 持久化 |
| plan.rs | 文件契约 | v1/v2 转换与 v4 主线配置 DTO、导出未完成任务、按 ID 更新配置与保留进度、`replace` 整份同步、稳定 ID 去重、番茄时长换算 |
| lock.rs | 定时保护 | 锁机规则/执行状态、跨午夜本地周历、重叠检查与本轮抑制 |
| guard.rs | 桌面保护 | niri IPC 能力检测、精确应用匹配和回焦 |
| tests.rs | 验证 | 状态、持久化、保护与计划往返/失败原子性回归测试 |
| reminders.rs | 时间安排 | 日期/时间与单次时长校验、当天待处理队列、计时/锁机延后、跨日清理 |
| templates.rs | 模板/印刷 | 形状与日程/周期分时校验、按日期防重、0–90 天滚动整周期预印、临时/手动批量、逾期/报废过滤、显式形状同步 |
| template_tests.rs | 验证 | 一时段多日期/多单元、整周期/临时印刷、分组、防重/删除/重启、手动复用、预印遗漏、原子失败、重修/目标/习惯及文件往返 |
| habits.rs | 习惯 | 习惯组名称校验；形状与印刷规则由 templates.rs 管理 |
