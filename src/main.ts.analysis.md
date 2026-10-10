---
source: main.ts
lines: 3252
generated_at: 2026-10-11
---

## 功能索引

| 用途                                                | Lines     | Notes                                       |
| --------------------------------------------------- | --------- | ------------------------------------------- |
| 导入、状态、管辖与格式化                            | 1–348     | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 分发、快照、导航与提醒                              | 349–488   | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 今日待办、本周日程日历、待补队列与静态实例列表      | 489–631   | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 任务、目标、习惯模板、愿景与统计设置                | 632–1134  | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 保护、定时锁机、沉浸与刷新                          | 1135–1263 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 渐进创建、日程/周期印刷、只读实例记录与主线节点编辑 | 1264–2033 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 容器、搜索与设置操作                                | 2034–2501 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 文件导入、模板动作与页面事件                        | 2502–3111 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 右键菜单、批量删除/移出、拖拽与快捷键               | 3112–3193 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 启动、概念讲解挂载与轮询                            | 3194–3252 | 概念目标与讲解内容在 src/ponder.ts          |

## Symbols

| Symbol               | Type     | Line |
| -------------------- | -------- | ---- |
| focusPage            | function | 489  |
| isCatchUp            | function | 519  |
| taskList             | function | 536  |
| isoDate              | const    | 565  |
| schedulePage         | function | 567  |
| tasksPage            | function | 632  |
| goalsPage            | function | 682  |
| habitsTab            | function | 739  |
| visionDialog         | function | 813  |
| lineOutcomeLabel     | const    | 873  |
| spanLabel            | const    | 888  |
| goalStatsCard        | function | 890  |
| crossSectionCard     | function | 910  |
| statsPage            | function | 928  |
| savePreferences      | function | 992  |
| settingsPage         | function | 1081 |
| projectWhitelistCard | function | 1095 |
| guardPage            | function | 1135 |
| templatesCard        | function | 1348 |
| datesForPrinting     | function | 1359 |
| printDialog          | function | 1387 |
| templateDialog       | function | 1443 |
| taskDialog           | function | 1837 |
| goalDialog           | function | 2034 |
| importPlan           | function | 2502 |
| selectControls       | function | 3112 |
| detachSelected       | function | 3117 |
| deleteSelectedTasks  | function | 3127 |
| sortProjects         | function | 3152 |
| boot                 | function | 3194 |

模板修改默认只影响未来；syncTemplate 只同步形状，保留实例的日期/管辖/进度。自动预印 0–90 天，手动一次印完选定范围；过期过滤由核心执行，isCatchUp 负责普通/目标待补呈现。

实例管辖（普通/习惯/目标）由 Rust 核心定义并随 Snapshot.taskKinds 下发，前端 isHabit 直接读取，不再自行推导；从习惯组移出或删除习惯组只清 habitId，不改写冻结的 recurring，历史缺勤不变。

本周日程：schedulePage 是二维日历（横轴周一到周日，纵轴 07:00–23:00），任务块按 `reminderTime` 定位、按 `estimate × 单次时长 + 休息` 给高度，不吸附整点；weekOffset 翻周，点击块打开任务。只用 `state.data.tasks` 的 `dueDate/reminderTime`，不依赖核心新接口。

统计页：goalStatsCard 读 `stats.goals`（整线裁定 Success/Failure/Pending 与逐节点时序），crossSectionCard 读 `stats.days` 的每日完成/缺勤/作废/主线裁定与报废，把同一时段的主线与其它任务并排看；两者都由核心计算，前端不重算成败。

主线：goalsTabContent 显示节点进度、配对与信号追溯，nodeEditorHtml/goalDialog 编辑配置，confirmNode 保存人工确认。Task.nodeId 与 Snapshot.nodeProgress 由核心计算；成功/失败实例只读，历史 ID 不复用，恢复只还原登记的原任务。

音效：accept 按旧/新 Snapshot 与成功 Action 选择一次音效；sound-events.ts 同时供提醒横幅选队列。soundPreviewControls 与设置保存共享 soundVolume；轮询使用快照版本丢弃操作期间的旧响应。

侧栏排序：sort-projects 使用 showContextMenu；外部点击在捕获阶段关闭旧菜单，避免打开菜单的同次点击在冒泡阶段将其关闭。排序持久化仍使用 reorderProjects；项目右键菜单共享关闭逻辑。

偏好页：settingsPage 按内容高度分列，左列专注/学习计划，右列体验/桌面集成/备份。savePreferences 合并手动保存与离页保存；输入仅标记 dirty，窗口失焦不保存；无效或保存失败时保留表单并阻止离页。

锁机日程：tomorrowScheduleDialog（L:1190）按 state.today 的本地日期取次日，时间排序、无时间排末尾，排除已报废实例。展示任务/项目/备注/步骤，无修改和计时入口；renderImmersive 在保护期间提供入口，严格模式可用，休息锁机使用深色弹窗。
