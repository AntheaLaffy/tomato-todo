---
source: main.ts
lines: 3115
generated_at: 2026-10-11
---

## 功能索引

| 用途                                                | Lines     | Notes                                       |
| --------------------------------------------------- | --------- | ------------------------------------------- |
| 导入、状态、管辖与格式化                            | 1–293     | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 分发、快照、导航与提醒                              | 294–454   | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 今日待办、本周日程日历、待补队列与静态实例列表      | 455–597   | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 任务、目标、习惯模板、愿景与统计设置                | 598–1023  | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 保护、定时锁机、沉浸与刷新                          | 1024–1149 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 渐进创建、日程/周期印刷、只读实例记录与主线节点编辑 | 1150–1811 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 容器、搜索与设置操作                                | 1812–2368 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 文件导入、模板动作与页面事件                        | 2369–2947 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 右键菜单、批量删除/移出、拖拽与快捷键               | 2948–3066 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 启动与轮询                                          | 3067–3115 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |

## Symbols

| Symbol               | Type     | Line |
| -------------------- | -------- | ---- |
| focusPage            | function | 455  |
| isCatchUp            | function | 485  |
| taskList             | function | 502  |
| isoDate              | const    | 531  |
| schedulePage         | function | 533  |
| tasksPage            | function | 598  |
| goalsPage            | function | 648  |
| habitsTab            | function | 705  |
| visionDialog         | function | 779  |
| lineOutcomeLabel     | const    | 839  |
| spanLabel            | const    | 854  |
| goalStatsCard        | function | 856  |
| crossSectionCard     | function | 876  |
| statsPage            | function | 894  |
| projectWhitelistCard | function | 984  |
| guardPage            | function | 1024 |
| templatesCard        | function | 1201 |
| datesForPrinting     | function | 1212 |
| printDialog          | function | 1240 |
| templateDialog       | function | 1296 |
| taskDialog           | function | 1690 |
| goalDialog           | function | 1887 |
| importPlan           | function | 2386 |
| selectControls       | function | 2990 |
| detachSelected       | function | 2995 |
| deleteSelectedTasks  | function | 3005 |
| sortProjects         | function | 3030 |
| boot                 | function | 3072 |

模板修改默认只影响未来；syncTemplate 只同步形状，保留实例的日期/管辖/进度。自动预印 0–90 天，手动一次印完选定范围；过期过滤由核心执行，isCatchUp 负责普通/目标待补呈现。

实例管辖（普通/习惯/目标）由 Rust 核心定义并随 Snapshot.taskKinds 下发，前端 isHabit 直接读取，不再自行推导；从习惯组移出或删除习惯组只清 habitId，不改写冻结的 recurring，历史缺勤不变。

本周日程：schedulePage 是二维日历（横轴周一到周日，纵轴 07:00–23:00），任务块按 `reminderTime` 定位、按 `estimate × 单次时长 + 休息` 给高度，不吸附整点；weekOffset 翻周，点击块打开任务。只用 `state.data.tasks` 的 `dueDate/reminderTime`，不依赖核心新接口。

统计页：goalStatsCard 读 `stats.goals`（整线裁定 Success/Failure/Pending 与逐节点时序），crossSectionCard 读 `stats.days` 的每日完成/缺勤/作废/主线裁定与报废，把同一时段的主线与其它任务并排看；两者都由核心计算，前端不重算成败。

主线：goalsTabContent 显示节点进度、配对与信号追溯，nodeEditorHtml/goalDialog 编辑配置，confirmNode 保存人工确认。Task.nodeId 与 Snapshot.nodeProgress 由核心计算；成功/失败实例只读，历史 ID 不复用，恢复只还原登记的原任务。

音效：accept 按旧/新 Snapshot 与成功 Action 选择一次音效；sound-events.ts 同时供提醒横幅选队列。soundPreviewControls 与设置保存共享 soundVolume；轮询使用快照版本丢弃操作期间的旧响应。

侧栏排序：sort-projects 使用 showContextMenu；外部点击在捕获阶段关闭旧菜单，避免打开菜单的同次点击在冒泡阶段将其关闭。排序持久化仍使用 reorderProjects；项目右键菜单共享关闭逻辑。
