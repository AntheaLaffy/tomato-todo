---
source: main.ts
lines: 2994
generated_at: 2026-10-10
---

## 功能索引

| 用途                                                | Lines     | Notes                                       |
| --------------------------------------------------- | --------- | ------------------------------------------- |
| 导入、状态、管辖与格式化                            | 1–283     | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 分发、快照、导航与提醒                              | 284–453   | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 今日待办、待补队列、静态实例列表                    | 454–528   | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 任务、目标、习惯模板、愿景与统计设置                | 529–938   | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 保护、定时锁机、沉浸与刷新                          | 939–1064  | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 渐进创建、日程/周期印刷、只读实例记录与主线节点编辑 | 1065–1726 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 容器、搜索与设置操作                                | 1727–2282 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 文件导入、模板动作与页面事件                        | 2283–2843 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 右键菜单、批量删除/移出、拖拽与快捷键               | 2844–2954 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 启动与轮询                                          | 2955–2994 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |

## Symbols

| Symbol               | Type     | Line |
| -------------------- | -------- | ---- |
| focusPage            | function | 454  |
| isCatchUp            | function | 484  |
| taskList             | function | 501  |
| tasksPage            | function | 529  |
| goalsPage            | function | 579  |
| habitsTab            | function | 636  |
| visionDialog         | function | 710  |
| goalStatsCard        | function | 787  |
| crossSectionCard     | function | 807  |
| statsPage            | function | 825  |
| projectWhitelistCard | function | 899  |
| guardPage            | function | 939  |
| templatesCard        | function | 1116 |
| datesForPrinting     | function | 1127 |
| printDialog          | function | 1155 |
| templateDialog       | function | 1211 |
| taskDialog           | function | 1605 |
| goalDialog           | function | 1802 |
| importPlan           | function | 2300 |
| selectControls       | function | 2878 |
| detachSelected       | function | 2883 |
| deleteSelectedTasks  | function | 2893 |
| sortProjects         | function | 2918 |
| boot                 | function | 2955 |

模板修改默认只影响未来；syncTemplate 只同步形状，保留实例的日期/管辖/进度。自动预印 0–90 天，手动一次印完选定范围；过期过滤由核心执行，isCatchUp 负责普通/目标待补呈现。

实例管辖（普通/习惯/目标）由 Rust 核心定义并随 Snapshot.taskKinds 下发，前端 isHabit 直接读取，不再自行推导；从习惯组移出或删除习惯组只清 habitId，不改写冻结的 recurring，历史缺勤不变。

统计页：goalStatsCard 读 `stats.goals`（整线裁定 Success/Failure/Pending 与逐节点时序），crossSectionCard 读 `stats.days` 的每日完成/缺勤/作废/主线裁定与报废，把同一时段的主线与其它任务并排看；两者都由核心计算，前端不重算成败。

主线：goalsTabContent 显示节点进度、配对与信号追溯，nodeEditorHtml/goalDialog 编辑配置，confirmNode 保存人工确认。Task.nodeId 与 Snapshot.nodeProgress 由核心计算；成功/失败实例只读，历史 ID 不复用，恢复只还原登记的原任务。
