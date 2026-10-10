---
mode: maintenance
generated_at: 2026-10-10
---

奶油白与番茄红的桌面界面；业务状态通过 Rust 命令更新。

## 任务指南

| 任务 | Domain | Target | Also Check |
| --- | --- | --- | --- |
| 调整页面布局 | 界面 | main.ts.analysis.md、style.css.analysis.md | — |
| 任务到点提醒 | 界面 | main.ts 的 pendingReminder/reminderBanner/taskDialog | Rust reminders.rs、桌面轮询 |
| 修改任务字段 | 契约 | types.ts、main.ts 的 taskDialog | crates/core/src/lib.rs |
| 修改备份流程 | 桥接 | api.ts | main.ts 的 importBackup、Rust Import Action |
| 修改计划文件流程 | 桥接 | api.ts、types.ts、main.ts 的 importPlan | crates/core/src/plan.rs、docs/CODEMAP.md、桌面/预览适配层 |
| 修改桌面设置 | 桥接 | api.ts、main.ts 的 desktopSettingsCard | src-tauri/src/desktop.rs；浏览器隐藏这些设置 |
| 项目专属应用白名单 | 界面/桥接 | main.ts 的 projectWhitelistCard/addProjectWhitelist、types.ts 的 PlanProject | crates/core/src/plan.rs、src-tauri/src/main.rs 的保护循环、docs/CODEMAP.md；项目页承载编辑，专注保护页只管通用白名单 |
| 目标容器与待补 | 界面 | main.ts 的 goalDialog/tasksPage/taskList、types.ts 的 Goal | crates/core/src/lib.rs 的 Goal/goal_progress、docs/BACKUP_FORMAT.md |
| 定时锁机/严格模式界面 | 界面 | main.ts 的 lockPage/lockDialog/guardPage/renderImmersive | types.ts、crates/core/src/lock.rs、桌面桥接 |

## 文件

| File | Domain | Function |
| --- | --- | --- |
| main.ts | 界面 | 页面、弹窗、事件与刷新；见 main.ts.analysis.md |
| style.css | 视觉 | 设计变量、页面布局、明暗主题与响应式；见 style.css.analysis.md |
| api.ts | 桥接 | 选择 Tauri IPC 或本地 HTTP，处理计划/备份文件及桌面独有命令 |
| types.ts | 契约 | 与 Rust serde camelCase 对应的前端类型 |
| audio.ts | 声音 | 本地噪声合成与完成提示音 |
