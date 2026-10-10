---
source: main.ts
lines: 1843
generated_at: 2026-10-10
---

## 功能索引

| 用途 | Lines | Notes |
| --- | --- | --- |
| 导入、视图状态与格式化 | 1–252 | 接口改动核对 Rust 核心与适配层 |
| 命令分发、快照与导航 | 253–392 | 接口改动核对 Rust 核心与适配层 |
| 提醒、专注、任务、目标、习惯、统计与设置 | 393–722 | 接口改动核对 Rust 核心与适配层 |
| 项目白名单、专注保护与定时锁机 | 723–855 | 接口改动核对 Rust 核心与适配层 |
| 沉浸界面、时钟与弹窗基础 | 856–924 | 接口改动核对 Rust 核心与适配层 |
| 任务、项目、目标、习惯与辅助弹窗 | 925–1188 | 接口改动核对 Rust 核心与适配层 |
| 表单、保护与导入 | 1189–1436 | 接口改动核对 Rust 核心与适配层 |
| 全局事件 | 1437–1803 | 接口改动核对 Rust 核心与适配层 |
| 启动与轮询 | 1804–1843 | 接口改动核对 Rust 核心与适配层 |

## Symbols

| Symbol | Type | Line |
| --- | --- | --- |
| isHabit | const | 201 |
| dayLabel | const | 202 |
| daysLabel | const | 203 |
| goalProgress | const | 212 |
| progressLabel | const | 225 |
| toast | function | 253 |
| act | function | 265 |
| accept | function | 282 |
| applyTheme | function | 323 |
| navigate | function | 332 |
| render | function | 359 |
| heading | function | 393 |
| metric | function | 401 |
| pendingReminder | function | 411 |
| reminderBanner | function | 428 |
| focusPage | function | 433 |
| timerContent | function | 454 |
| taskList | function | 463 |
| tasksPage | function | 493 |
| goalsPage | function | 540 |
| goalsTabContent | function | 552 |
| habitsTab | function | 564 |
| habitDialog | function | 587 |
| weekChart | function | 644 |
| statsPage | function | 649 |
| settingNumber | function | 696 |
| settingSwitch | function | 706 |
| settingsPage | function | 709 |
| desktopSettingsCard | function | 713 |
| projectWhitelistCard | function | 723 |
| guardPage | function | 763 |
| refreshGuard | function | 793 |
| lockPage | function | 802 |
| saveLockSchedule | function | 813 |
| lockDialog | function | 826 |
| renderImmersive | function | 856 |
| updateClock | function | 868 |
| modal | function | 889 |
| closeModal | function | 903 |
| confirmDialog | function | 910 |
| taskDialog | function | 925 |
| projectDialog | function | 1033 |
| goalDialog | function | 1068 |
| chooseTask | function | 1105 |
| searchDialog | function | 1111 |
| helpDialog | function | 1134 |
| soundDialog | function | 1150 |
| emergencyDialog | function | 1169 |
| bindForms | function | 1189 |
| updateTaskResults | function | 1315 |
| addWhitelist | function | 1329 |
| saveProjectWhitelist | function | 1344 |
| addProjectWhitelist | function | 1351 |
| removeProjectWhitelist | function | 1360 |
| toggleTimer | function | 1368 |
| importBackup | function | 1389 |
| importPlan | function | 1406 |
| boot | function | 1804 |
