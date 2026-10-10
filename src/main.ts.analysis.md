---
source: main.ts
lines: 2939
generated_at: 2026-10-10
---

## 功能索引

| 用途 | Lines | Notes |
| --- | --- | --- |
| 导入、状态、管辖与格式化 | 1–283 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 分发、快照、导航与提醒 | 284–453 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 今日待办、待补队列、静态实例列表 | 454–528 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 任务、目标、习惯模板、愿景与统计设置 | 529–883 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 保护、定时锁机、沉浸与刷新 | 884–1009 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 渐进创建、日程/周期印刷、只读实例记录与主线节点编辑 | 1010–1671 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 容器、搜索与设置操作 | 1672–2227 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 文件导入、模板动作与页面事件 | 2228–2788 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 右键菜单、批量删除/移出、拖拽与快捷键 | 2789–2899 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 启动与轮询 | 2900–2939 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |

## Symbols

| Symbol | Type | Line |
| --- | --- | --- |
| focusPage | function | 454 |
| isCatchUp | function | 484 |
| taskList | function | 501 |
| tasksPage | function | 529 |
| goalsPage | function | 579 |
| habitsTab | function | 636 |
| templateDialog | function | 1156 |
| templatesCard | function | 1061 |
| datesForPrinting | function | 1072 |
| printDialog | function | 1100 |
| taskDialog | function | 1550 |
| goalDialog | function | 1747 |
| visionDialog | function | 710 |
| projectWhitelistCard | function | 844 |
| guardPage | function | 884 |
| importPlan | function | 2245 |
| selectControls | function | 2823 |
| detachSelected | function | 2828 |
| deleteSelectedTasks | function | 2838 |
| sortProjects | function | 2863 |
| boot | function | 2900 |

模板修改默认只影响未来；syncTemplate 只同步形状，保留实例的日期/管辖/进度。自动预印 0–90 天，手动一次印完选定范围；过期过滤由核心执行，isCatchUp 负责普通/目标待补呈现。

主线：goalsTabContent 显示节点进度、配对与信号追溯，nodeEditorHtml/goalDialog 编辑配置，confirmNode 保存人工确认。Task.nodeId 与 Snapshot.nodeProgress 由核心计算；成功/失败实例只读，历史 ID 不复用，恢复只还原登记的原任务。
