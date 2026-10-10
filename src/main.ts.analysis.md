---
source: main.ts
lines: 3079
generated_at: 2026-10-11
---

## 功能索引

| 用途                                                | Lines     | Notes                                       |
| --------------------------------------------------- | --------- | ------------------------------------------- |
| 导入、状态、管辖与格式化                            | 1–284     | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 分发、快照、导航与提醒                              | 285–455   | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 今日待办、本周日程日历、待补队列与静态实例列表      | 456–598   | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 任务、目标、习惯模板、愿景与统计设置                | 599–1008  | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 保护、定时锁机、沉浸与刷新                          | 1009–1134 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 渐进创建、日程/周期印刷、只读实例记录与主线节点编辑 | 1135–1796 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 容器、搜索与设置操作                                | 1797–2352 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 文件导入、模板动作与页面事件                        | 2353–2928 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 右键菜单、批量删除/移出、拖拽与快捷键               | 2929–3039 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 启动与轮询                                          | 3040–3079 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |

## Symbols

| Symbol               | Type     | Line |
| -------------------- | -------- | ---- |
| focusPage            | function | 456  |
| isCatchUp            | function | 486  |
| taskList             | function | 503  |
| isoDate              | const    | 532  |
| schedulePage         | function | 534  |
| tasksPage            | function | 599  |
| goalsPage            | function | 649  |
| habitsTab            | function | 706  |
| visionDialog         | function | 732  |
| lineOutcomeLabel     | const    | 840  |
| spanLabel            | const    | 855  |
| goalStatsCard        | function | 857  |
| crossSectionCard     | function | 877  |
| statsPage            | function | 895  |
| projectWhitelistCard | function | 969  |
| guardPage            | function | 1009 |
| templatesCard        | function | 1186 |
| datesForPrinting     | function | 1197 |
| printDialog          | function | 1225 |
| templateDialog       | function | 1281 |
| taskDialog           | function | 1675 |
| goalDialog           | function | 1872 |
| importPlan           | function | 2370 |
| selectControls       | function | 2963 |
| detachSelected       | function | 2968 |
| deleteSelectedTasks  | function | 2978 |
| sortProjects         | function | 3003 |
| boot                 | function | 3040 |

模板修改默认只影响未来；syncTemplate 只同步形状，保留实例的日期/管辖/进度。自动预印 0–90 天，手动一次印完选定范围；过期过滤由核心执行，isCatchUp 负责普通/目标待补呈现。

实例管辖（普通/习惯/目标）由 Rust 核心定义并随 Snapshot.taskKinds 下发，前端 isHabit 直接读取，不再自行推导；从习惯组移出或删除习惯组只清 habitId，不改写冻结的 recurring，历史缺勤不变。

本周日程：schedulePage 是二维日历（横轴周一到周日，纵轴 07:00–23:00），任务块按 `reminderTime` 定位、按 `estimate × 单次时长 + 休息` 给高度，不吸附整点；weekOffset 翻周，点击块打开任务。只用 `state.data.tasks` 的 `dueDate/reminderTime`，不依赖核心新接口。

统计页：goalStatsCard 读 `stats.goals`（整线裁定 Success/Failure/Pending 与逐节点时序），crossSectionCard 读 `stats.days` 的每日完成/缺勤/作废/主线裁定与报废，把同一时段的主线与其它任务并排看；两者都由核心计算，前端不重算成败。

主线：goalsTabContent 显示节点进度、配对与信号追溯，nodeEditorHtml/goalDialog 编辑配置，confirmNode 保存人工确认。Task.nodeId 与 Snapshot.nodeProgress 由核心计算；成功/失败实例只读，历史 ID 不复用，恢复只还原登记的原任务。
