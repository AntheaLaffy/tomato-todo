---
mode: maintenance
generated_at: 2026-10-10
---

奶油白与番茄红的桌面界面；业务状态通过 Rust 命令更新。

## 任务指南

| 任务                             | Domain    | Target                                                                                                              | Also Check                                                                                                           |
| -------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 调整页面布局                     | 界面      | main.ts.analysis.md、style.css.analysis.md                                                                          | —                                                                                                                    |
| 任务到点提醒                     | 界面      | main.ts 的 pendingReminder/reminderBanner/taskDialog                                                                | Rust reminders.rs、桌面轮询                                                                                          |
| 模板编辑、自动预印与手动整批印刷 | 界面/契约 | main.ts 的 templateDialog/focusBudget/printDialog/templatesCard（临时 / 手动 / 自动渐进披露）、types.ts 的 Template | crates/core/src/templates.rs、plan.rs、docs/CODEMAP.md                                                               |
| 修改任务字段                     | 契约      | types.ts、main.ts 的 taskDialog                                                                                     | crates/core/src/lib.rs                                                                                               |
| 修改备份流程                     | 桥接      | api.ts                                                                                                              | main.ts 的 importBackup、Rust Import Action                                                                          |
| 修改计划文件流程                 | 桥接      | api.ts、types.ts、main.ts 的 importPlan                                                                             | crates/core/src/plan.rs、docs/CODEMAP.md、桌面/预览适配层                                                            |
| 修改桌面设置                     | 桥接      | api.ts、main.ts 的 desktopSettingsCard                                                                              | src-tauri/src/desktop.rs；浏览器隐藏这些设置                                                                         |
| 项目专属应用白名单               | 界面/桥接 | main.ts 的 projectWhitelistCard/addProjectWhitelist、types.ts 的 PlanProject                                        | crates/core/src/plan.rs、src-tauri/src/main.rs 的保护循环、docs/CODEMAP.md；项目页承载编辑，专注保护页只管通用白名单 |
| 目标容器与待补                   | 界面      | main.ts 的 goalDialog/focusPage/isCatchUp/taskList、types.ts 的 Goal                                                | crates/core/src/lib.rs 的 Goal 与 nodes.rs、docs/BACKUP_FORMAT.md                                                    |
| 习惯分组与周期印刷               | 界面      | main.ts 的 goalsPage/habitsTab/templateDialog、types.ts 的 Habit                                                    | crates/core/src/templates.rs、lib.rs 的 TaskKind 与 Snapshot.taskKinds、docs/BACKUP_FORMAT.md                        |
| 愿景标记                         | 界面      | main.ts 的 visionsTab/visionDialog/projectVisionCard、types.ts 的 Vision                                            | crates/core/src/lib.rs 的 Vision、docs/BACKUP_FORMAT.md                                                              |
| 定时锁机/严格模式界面            | 界面      | main.ts 的 lockPage/lockDialog/bindForms/guardPage/renderImmersive（时段列表独立严格开关）                          | types.ts、crates/core/src/lock.rs、桌面桥接                                                                          |
| 数据统计与纵切面                 | 界面      | main.ts 的 statsPage/goalStatsCard/crossSectionCard、types.ts 的 GoalStat/NodeStat/LineOutcome                     | crates/core/src/lib.rs 的 stats/GoalStat/NodeStat/DayStat、docs/BACKUP_FORMAT.md                                      |
| 本周日程表                       | 界面      | main.ts 的 schedulePage/weekOffset、style.css 的 schedule-grid                                                     | types.ts 的 Task（dueDate/reminderTime）、main.ts.analysis.md                                                         |

## 文件

| File      | Domain | Function                                                                            |
| --------- | ------ | ----------------------------------------------------------------------------------- |
| main.ts   | 界面   | 页面、弹窗、事件与刷新；见 main.ts.analysis.md                                      |
| style.css | 视觉   | 设计变量、页面布局、明暗主题与响应式；见 style.css.analysis.md                      |
| api.ts    | 桥接   | 选择 Tauri IPC 或本地 HTTP，处理计划/备份文件及桌面独有命令                         |
| types.ts  | 契约   | 实例、Template/Printing/PrintRecord、计划 v4 与备份 v3 的 Rust serde camelCase 类型 |
| audio.ts  | 声音   | 本地噪声合成与完成提示音                                                            |

主线入口：main.ts 的 goalsTabContent/nodeEditorHtml/goalDialog，Snapshot.nodeProgress 为核心计算结果。成功/失败实例只读；删除配对任务可从组内恢复原实体；条件阻断分别针对成功与失败。
