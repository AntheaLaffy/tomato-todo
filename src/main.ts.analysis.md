---
source: main.ts
lines: 2000
generated_at: 2026-10-10
---

## 功能索引

| 用途 | Lines | Notes |
| --- | --- | --- |
| 导入、视图状态与格式化 | 1–272 | 接口改动核对 Rust 核心与适配层 |
| 命令分发、快照与导航 | 273–412 | 接口改动核对 Rust 核心与适配层 |
| 提醒、专注、任务、统计与设置 | 413–511 | 接口改动核对 Rust 核心与适配层 |
| 任务、目标、习惯、愿景页与对话框 | 512–776 | 接口改动核对 Rust 核心与适配层 |
| 统计、设置与项目白名单 | 777–895 | 接口改动核对 Rust 核心与适配层 |
| 专注保护、定时锁机、沉浸与弹窗基础 | 896–1057 | 接口改动核对 Rust 核心与适配层 |
| 任务、项目、目标等弹窗 | 1058–1337 | 接口改动核对 Rust 核心与适配层 |
| 表单、保护与导入 | 1338–1585 | 接口改动核对 Rust 核心与适配层 |
| 全局事件 | 1586–1960 | 接口改动核对 Rust 核心与适配层 |
| 启动与轮询 | 1961–2000 | 接口改动核对 Rust 核心与适配层 |

## Symbols

| Symbol | Type | Line |
| --- | --- | --- |
| projectOf | const | 198 |
| isHabit | const | 202 |
| dayLabel | const | 206 |
| daysLabel | const | 207 |
| isTimed | const | 214 |
| goalProgress | const | 215 |
| progressLabel | const | 228 |
| goalOf | const | 232 |
| goalState | const | 236 |
| isVoid | const | 241 |
| toast | function | 273 |
| act | function | 285 |
| accept | function | 302 |
| applyTheme | function | 343 |
| navigate | function | 352 |
| render | function | 379 |
| heading | function | 413 |
| metric | function | 421 |
| pendingReminder | function | 431 |
| reminderBanner | function | 448 |
| focusPage | function | 453 |
| timerContent | function | 472 |
| taskList | function | 481 |
| tasksPage | function | 512 |
| goalsPage | function | 559 |
| goalsTabContent | function | 573 |
| habitsTab | function | 596 |
| habitDialog | function | 619 |
| goalVisions | function | 676 |
| visionCard | function | 685 |
| visionsTab | function | 693 |
| projectVisionCard | function | 709 |
| visionDialog | function | 722 |
| weekChart | function | 777 |
| statsPage | function | 782 |
| settingNumber | function | 829 |
| settingSwitch | function | 839 |
| settingsPage | function | 842 |
| desktopSettingsCard | function | 846 |
| projectWhitelistCard | function | 856 |
| guardPage | function | 896 |
| refreshGuard | function | 926 |
| lockPage | function | 935 |
| saveLockSchedule | function | 946 |
| lockDialog | function | 959 |
| renderImmersive | function | 989 |
| updateClock | function | 1001 |
| modal | function | 1022 |
| closeModal | function | 1036 |
| confirmDialog | function | 1043 |
| taskDialog | function | 1058 |
| projectDialog | function | 1182 |
| goalDialog | function | 1217 |
| chooseTask | function | 1254 |
| searchDialog | function | 1260 |
| helpDialog | function | 1283 |
| soundDialog | function | 1299 |
| emergencyDialog | function | 1318 |
| bindForms | function | 1338 |
| updateTaskResults | function | 1464 |
| addWhitelist | function | 1478 |
| saveProjectWhitelist | function | 1493 |
| addProjectWhitelist | function | 1500 |
| removeProjectWhitelist | function | 1509 |
| toggleTimer | function | 1517 |
| importBackup | function | 1538 |
| importPlan | function | 1555 |
| boot | function | 1961 |
