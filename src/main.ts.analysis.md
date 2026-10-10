---
source: main.ts
lines: 1720
generated_at: 2026-10-10
---

## 功能索引

| 用途 | Lines | Notes |
| --- | --- | --- |
| 导入、视图状态与格式化 | 1–237 | 接口改动核对 Rust 核心与适配层 |
| 命令分发、快照与导航 | 238–377 | 接口改动核对 Rust 核心与适配层 |
| 提醒、专注、任务、目标、统计与设置 | 378–611 | 接口改动核对 Rust 核心与适配层 |
| 项目白名单、专注保护与定时锁机 | 612–744 | 接口改动核对 Rust 核心与适配层 |
| 沉浸界面、时钟与弹窗基础 | 745–813 | 接口改动核对 Rust 核心与适配层 |
| 任务、项目、目标与辅助弹窗 | 814–1077 | 接口改动核对 Rust 核心与适配层 |
| 表单、保护与导入 | 1078–1325 | 接口改动核对 Rust 核心与适配层 |
| 全局事件 | 1326–1680 | 接口改动核对 Rust 核心与适配层 |
| 启动与轮询 | 1681–1720 | 接口改动核对 Rust 核心与适配层 |

## Symbols

| Symbol | Type | Line |
| --- | --- | --- |
| goalProgress | const | 197 |
| progressLabel | const | 210 |
| toast | function | 238 |
| act | function | 250 |
| accept | function | 267 |
| applyTheme | function | 308 |
| navigate | function | 317 |
| render | function | 344 |
| heading | function | 378 |
| metric | function | 386 |
| pendingReminder | function | 396 |
| reminderBanner | function | 413 |
| focusPage | function | 418 |
| timerContent | function | 436 |
| taskList | function | 445 |
| tasksPage | function | 475 |
| goalsPage | function | 522 |
| weekChart | function | 540 |
| statsPage | function | 545 |
| settingNumber | function | 585 |
| settingSwitch | function | 595 |
| settingsPage | function | 598 |
| desktopSettingsCard | function | 602 |
| projectWhitelistCard | function | 612 |
| guardPage | function | 652 |
| refreshGuard | function | 682 |
| lockPage | function | 691 |
| saveLockSchedule | function | 702 |
| lockDialog | function | 715 |
| renderImmersive | function | 745 |
| updateClock | function | 757 |
| modal | function | 778 |
| closeModal | function | 792 |
| confirmDialog | function | 799 |
| taskDialog | function | 814 |
| projectDialog | function | 922 |
| goalDialog | function | 957 |
| chooseTask | function | 994 |
| searchDialog | function | 1000 |
| helpDialog | function | 1023 |
| soundDialog | function | 1039 |
| emergencyDialog | function | 1058 |
| bindForms | function | 1078 |
| updateTaskResults | function | 1204 |
| addWhitelist | function | 1218 |
| saveProjectWhitelist | function | 1233 |
| addProjectWhitelist | function | 1240 |
| removeProjectWhitelist | function | 1249 |
| toggleTimer | function | 1257 |
| importBackup | function | 1278 |
| importPlan | function | 1295 |
| boot | function | 1681 |
