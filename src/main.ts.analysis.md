---
source: main.ts
lines: 2938
generated_at: 2026-10-10
---

## 功能索引

| 用途                                                | Lines     | Notes                                       |
| --------------------------------------------------- | --------- | ------------------------------------------- |
| 导入、状态、管辖与格式化                            | 1–282     | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 分发、快照、导航与提醒                              | 283–452   | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 今日待办、待补队列、静态实例列表                    | 453–527   | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 任务、目标、习惯模板、愿景与统计设置                | 528–882   | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 保护、定时锁机、沉浸与刷新                          | 883–1008  | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 渐进创建、日程/周期印刷、只读实例记录与主线节点编辑 | 1009–1670 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 容器、搜索与设置操作                                | 1671–2226 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 文件导入、模板动作与页面事件                        | 2227–2787 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 右键菜单、批量删除/移出、拖拽与快捷键               | 2788–2898 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 启动与轮询                                          | 2899–2938 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |

## Symbols

| Symbol               | Type     | Line |
| -------------------- | -------- | ---- |
| focusPage            | function | 453  |
| isCatchUp            | function | 483  |
| taskList             | function | 500  |
| tasksPage            | function | 528  |
| goalsPage            | function | 578  |
| habitsTab            | function | 635  |
| templateDialog       | function | 1155 |
| templatesCard        | function | 1060 |
| datesForPrinting     | function | 1071 |
| printDialog          | function | 1099 |
| taskDialog           | function | 1549 |
| goalDialog           | function | 1746 |
| visionDialog         | function | 709  |
| projectWhitelistCard | function | 843  |
| guardPage            | function | 883  |
| importPlan           | function | 2244 |
| selectControls       | function | 2822 |
| detachSelected       | function | 2827 |
| deleteSelectedTasks  | function | 2837 |
| sortProjects         | function | 2862 |
| boot                 | function | 2899 |

模板修改默认只影响未来；syncTemplate 只同步形状，保留实例的日期/管辖/进度。自动预印 0–90 天，手动一次印完选定范围；过期过滤由核心执行，isCatchUp 负责普通/目标待补呈现。

实例管辖（普通/习惯/目标）由 Rust 核心定义并随 Snapshot.taskKinds 下发，前端 isHabit 直接读取，不再自行推导；从习惯组移出或删除习惯组只清 habitId，不改写冻结的 recurring，历史缺勤不变。

主线：goalsTabContent 显示节点进度、配对与信号追溯，nodeEditorHtml/goalDialog 编辑配置，confirmNode 保存人工确认。Task.nodeId 与 Snapshot.nodeProgress 由核心计算；成功/失败实例只读，历史 ID 不复用，恢复只还原登记的原任务。
