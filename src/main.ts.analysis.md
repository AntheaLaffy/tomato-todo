---
source: main.ts
lines: 3653
generated_at: 2026-10-14
---

## 功能索引

| 用途                                                | Lines     | Notes                                       |
| --------------------------------------------------- | --------- | ------------------------------------------- |
| 导入、状态、管辖与格式化                            | 1–453 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 分发、快照、导航与提醒                              | 454–680 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 今日待办、本周日程日历、待补队列与静态实例列表      | 681–1007 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 任务、目标、习惯模板、愿景与统计设置                | 1008–1517 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 保护、定时锁机、沉浸与刷新                          | 1518–1731 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 渐进创建、日程/周期印刷、只读实例记录与主线节点编辑 | 1732–2435 | 节点图在 src/nodegraph.ts                   |
| 搜索、声音、紧急操作与表单绑定                      | 2436–2788 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 文件导入、模板动作与页面事件                        | 2789–3425 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 右键菜单、批量删除/移出、拖拽与快捷键               | 3426–3549 | 接口改动核对共享 Rust 核心、桌面/预览适配层 |
| 启动、概念讲解挂载与轮询                            | 3550–3653 | 概念目标与讲解内容在 src/ponder.ts          |

## Symbols

| Symbol               | Type     | Line |
| -------------------- | -------- | ---- |
| focusPage            | function | 684 |
| todayTaskGroup       | function | 730 |
| compareTaskTime      | function | 768 |
| isCatchUp            | function | 751 |
| taskList             | function | 775 |
| isoDate              | const    | 801 |
| resizeCalendar       | function | 854 |
| schedulePage         | function | 871 |
| tasksPage            | function | 1008 |
| goalsPage            | function | 1065 |
| habitsTab            | function | 1122 |
| visionDialog         | function | 1196 |
| lineOutcomeLabel     | const    | 1256 |
| spanLabel            | const    | 1271 |
| goalStatsCard        | function | 1273 |
| crossSectionCard     | function | 1293 |
| statsPage            | function | 1311 |
| savePreferences      | function | 1375 |
| settingsPage         | function | 1464 |
| projectWhitelistCard | function | 1478 |
| guardPage            | function | 1518 |
| templatesCard        | function | 1732 |
| datesForPrinting     | function | 1743 |
| printDialog          | function | 1771 |
| templateDialog       | function | 1827 |
| taskDialog           | function | 2221 |
| goalDialog           | function | 2378 |
| importPlan           | function | 2789 |
| selectControls       | function | 3468 |
| detachSelected       | function | 3473 |
| deleteSelectedTasks  | function | 3483 |
| sortProjects         | function | 3508 |
| boot                 | function | 3575 |

全部任务页用与待完成、已完成、全部同级的「模板」标签切换独立模板目录，避免模板被长任务列表推到页面底部；项目页仍在项目任务后显示本项目模板。模板修改默认只影响未来；syncTemplate 只同步形状，保留实例的日期/管辖/进度。自动预印 0–90 天，手动一次印完选定范围；过期过滤由核心执行，isCatchUp 负责普通/目标待补呈现。

实例管辖（普通/习惯/目标）由 Rust 核心定义并随 Snapshot.taskKinds 下发，前端 isHabit 直接读取，不再自行推导；从习惯组移出或删除习惯组只清 habitId，不改写冻结的 recurring，历史缺勤不变。

本周日程：resizeCalendar 默认按时间轴上方的实际空间计算可用高度并增加 160px，保持 384–1040px，render、窗口 resize 与字体就绪时重算；mountCalendarResize 支持拖动和方向键调整至 224–2400px，本机 localStorage 保存高度，可恢复自动；滚动不改变比例；schedulePage 是二维日历（横轴周一到周日，纵轴 07:00–23:00），任务块按 `reminderTime` 定位、按 `estimate × 单次时长 + 休息` 给高度，不吸附整点；weekOffset 翻周，点击块打开任务。只用 `state.data.tasks` 的 `dueDate/reminderTime`，不依赖核心新接口。

统计页：goalStatsCard 读 `stats.goals`（整线裁定 Success/Failure/Pending 与逐节点时序），crossSectionCard 读 `stats.days` 的每日完成/缺勤/作废/主线裁定与报废，把同一时段的主线与其它任务并排看；两者都由核心计算，前端不重算成败。

主线：goalsTabContent 显示节点进度、配对与信号追溯，goalDialog 挂载 src/nodegraph.ts 的节点图编辑配置，confirmNode 保存人工确认。Task.nodeId 与 Snapshot.nodeProgress 由核心计算；成功/失败实例只读，历史 ID 不复用，恢复只还原登记的原任务。

音效：accept 按旧/新 Snapshot 与成功 Action 选择一次音效；sound-events.ts 同时供提醒横幅选队列。soundPreviewControls 与设置保存共享 soundVolume；轮询使用快照版本丢弃操作期间的旧响应。

性能：ensureDerived() 按当前 Snapshot 缓存项目/目标/节点/番茄数与各项目待办计数，accept 换入新对象时失效，避免 taskList 每行重扫 sessions 与 goals。icon() 直接输出 `<svg>`（data-lucide 仅作标记），不再依赖 createIcons 二次遍历占位符；accept 只用一次 JSON.stringify 作为数据签名，减少每秒轮询开销。

侧栏排序：sort-projects 使用 showContextMenu；外部点击在捕获阶段关闭旧菜单，避免打开菜单的同次点击在冒泡阶段将其关闭。排序持久化仍使用 reorderProjects；项目右键菜单共享关闭逻辑。

背景音：backgroundSoundButton 在普通专注、沉浸与专注保护（含严格模式）界面共用入口；休息锁机不提供声音入口。soundDialog 调用 bgm.ts 导入并保存至少 1 小时的音频，手动循环播放/暂停/移除，与合成噪音互斥；雨声使用随包真实录音，异步解码期间后续选择可取消旧请求；boot 恢复保存文件，不自动播放。

偏好页：settingsPage 按内容高度分列，左列专注/学习计划，右列体验/桌面集成/备份。savePreferences 合并手动保存与离页保存；输入仅标记 dirty，窗口失焦不保存；无效或保存失败时保留表单并阻止离页。

锁机日程：tomorrowScheduleDialog（L:1603）按 state.today 的本地日期取次日，时间排序、无时间排末尾，排除已报废实例。展示任务/项目/备注/步骤，无修改和计时入口；renderImmersive 在保护期间提供入口，严格模式可用，休息锁机使用深色弹窗。

Android 导航：setMobileNav（L:553）控制抽屉和工作区 inert；平台身份由原生 platform_kind 报告，boot 安装 tomatoBack 供 Kotlin 返回键处理。桌面专属偏好只在 desktop 为 true 时显示。

首页待完成：focusPage 固定分为今日定时、待补、今日未定时、无日期；todayTaskGroup 控制待补全部显示与无日期默认折叠，展开状态在应用会话内保留；今日待办总数与待完成标签排除无日期任务。taskList 接受独立排序参数，compareTaskTime 为日期/提醒时间/创建顺序比较器；全部任务页继续使用用户选择的排序。

简洁模式：compact.ts 保存本机开关并设置根元素 data-compact-mode；settingsPage 的无 name 开关由 bindForms 立即保存，不标记业务配置 dirty、不重建正在编辑的表单。说明按用途显式标记 data-explanation；日程拖动提示、节点编辑副标题和空状态建议同样隐藏，空状态与按钮仍保留。日期、进度、错误、权限及保护后果不隐藏。ponderChip 改为灯泡图标，保留无障碍名称。
