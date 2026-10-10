---
source: main.ts
lines: 3348
generated_at: 2026-10-11
---

## 功能索引

| 用途                                                | Lines     | Notes                                       |
| --------------------------------------------------- | --------- | ------------------------------------------- |
| 导入、状态、管辖与格式化                            | 1–438     | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 分发、快照、导航与提醒                              | 439–581   | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 今日待办、本周日程日历、待补队列与静态实例列表      | 582–727   | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 任务、目标、习惯模板、愿景与统计设置                | 728–1230  | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 保护、定时锁机、沉浸与刷新                          | 1231–1359 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 渐进创建、日程/周期印刷、只读实例记录与主线节点编辑 | 1360–2129 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 容器、搜索与设置操作                                | 2130–2597 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 文件导入、模板动作与页面事件                        | 2598–3207 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 右键菜单、批量删除/移出、拖拽与快捷键               | 3208–3289 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 启动、概念讲解挂载与轮询                            | 3290–3348 | 概念目标与讲解内容在 src/ponder.ts          |

## Symbols

| Symbol               | Type     | Line |
| -------------------- | -------- | ---- |
| focusPage            | function | 582  |
| isCatchUp            | function | 612  |
| taskList             | function | 629  |
| isoDate              | const    | 661  |
| schedulePage         | function | 663  |
| tasksPage            | function | 728  |
| goalsPage            | function | 778  |
| habitsTab            | function | 835  |
| visionDialog         | function | 909  |
| lineOutcomeLabel     | const    | 969  |
| spanLabel            | const    | 984  |
| goalStatsCard        | function | 986  |
| crossSectionCard     | function | 1006 |
| statsPage            | function | 1024 |
| savePreferences      | function | 1088 |
| settingsPage         | function | 1177 |
| projectWhitelistCard | function | 1191 |
| guardPage            | function | 1231 |
| templatesCard        | function | 1444 |
| datesForPrinting     | function | 1455 |
| printDialog          | function | 1483 |
| templateDialog       | function | 1539 |
| taskDialog           | function | 1933 |
| goalDialog           | function | 2130 |
| importPlan           | function | 2598 |
| selectControls       | function | 3208 |
| detachSelected       | function | 3213 |
| deleteSelectedTasks  | function | 3223 |
| sortProjects         | function | 3248 |
| boot                 | function | 3290 |

模板修改默认只影响未来；syncTemplate 只同步形状，保留实例的日期/管辖/进度。自动预印 0–90 天，手动一次印完选定范围；过期过滤由核心执行，isCatchUp 负责普通/目标待补呈现。

实例管辖（普通/习惯/目标）由 Rust 核心定义并随 Snapshot.taskKinds 下发，前端 isHabit 直接读取，不再自行推导；从习惯组移出或删除习惯组只清 habitId，不改写冻结的 recurring，历史缺勤不变。

本周日程：schedulePage 是二维日历（横轴周一到周日，纵轴 07:00–23:00），任务块按 `reminderTime` 定位、按 `estimate × 单次时长 + 休息` 给高度，不吸附整点；weekOffset 翻周，点击块打开任务。只用 `state.data.tasks` 的 `dueDate/reminderTime`，不依赖核心新接口。

统计页：goalStatsCard 读 `stats.goals`（整线裁定 Success/Failure/Pending 与逐节点时序），crossSectionCard 读 `stats.days` 的每日完成/缺勤/作废/主线裁定与报废，把同一时段的主线与其它任务并排看；两者都由核心计算，前端不重算成败。

主线：goalsTabContent 显示节点进度、配对与信号追溯，nodeEditorHtml/goalDialog 编辑配置，confirmNode 保存人工确认。Task.nodeId 与 Snapshot.nodeProgress 由核心计算；成功/失败实例只读，历史 ID 不复用，恢复只还原登记的原任务。

音效：accept 按旧/新 Snapshot 与成功 Action 选择一次音效；sound-events.ts 同时供提醒横幅选队列。soundPreviewControls 与设置保存共享 soundVolume；轮询使用快照版本丢弃操作期间的旧响应。

性能：ensureDerived() 按当前 Snapshot 缓存项目/目标/节点/番茄数与各项目待办计数，accept 换入新对象时失效，避免 taskList 每行重扫 sessions 与 goals。icon() 直接输出 `<svg>`（data-lucide 仅作标记），不再依赖 createIcons 二次遍历占位符；accept 只用一次 JSON.stringify 作为数据签名，减少每秒轮询开销。

侧栏排序：sort-projects 使用 showContextMenu；外部点击在捕获阶段关闭旧菜单，避免打开菜单的同次点击在冒泡阶段将其关闭。排序持久化仍使用 reorderProjects；项目右键菜单共享关闭逻辑。

偏好页：settingsPage 按内容高度分列，左列专注/学习计划，右列体验/桌面集成/备份。savePreferences 合并手动保存与离页保存；输入仅标记 dirty，窗口失焦不保存；无效或保存失败时保留表单并阻止离页。

锁机日程：tomorrowScheduleDialog（L:1324）按 state.today 的本地日期取次日，时间排序、无时间排末尾，排除已报废实例。展示任务/项目/备注/步骤，无修改和计时入口；renderImmersive 在保护期间提供入口，严格模式可用，休息锁机使用深色弹窗。
