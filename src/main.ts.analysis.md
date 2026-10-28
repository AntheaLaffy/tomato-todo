---
source: main.ts
lines: 3491
generated_at: 2026-10-28
---

## 功能索引

| 用途 | Lines | Notes |
| --- | --- | --- |
| 导入、状态、格式化与派发 | 1–510 | 接口改动核对共享核心与适配层 |
| 导航、提醒与今日待办 | 511–788 | 接口改动核对共享核心与适配层 |
| 本周日历、阻塞时段与任务列表 | 789–1073 | 接口改动核对共享核心与适配层 |
| 习惯、愿景与统计 | 1074–1263 | 接口改动核对共享核心与适配层 |
| 偏好、保护、锁机与沉浸 | 1264–1607 | 接口改动核对共享核心与适配层 |
| 弹窗、模板印刷与任务编辑 | 1608–2228 | 接口改动核对共享核心与适配层 |
| 项目、搜索、声音与表单绑定 | 2229–2639 | 接口改动核对共享核心与适配层 |
| 文件导入与页面事件 | 2640–3300 | 接口改动核对共享核心与适配层 |
| 批量操作、拖拽与快捷键 | 3301–3386 | 接口改动核对共享核心与适配层 |
| 启动、讲解挂载与轮询 | 3387–3491 | 接口改动核对共享核心与适配层 |

## Symbols

| Symbol | Type | Line |
| --- | --- | --- |
| focusPage | function | 681 |
| todayTaskGroup | function | 724 |
| compareTaskTime | function | 758 |
| isCatchUp | function | 742 |
| taskList | function | 765 |
| isoDate | const | 789 |
| resizeCalendar | function | 842 |
| schedulePage | function | 859 |
| tasksPage | function | 1017 |
| collectionsPage | function | 1074 |
| habitsTab | function | 1080 |
| visionDialog | function | 1143 |
| activityCard | function | 1196 |
| statsPage | function | 1200 |
| savePreferences | function | 1264 |
| settingsPage | function | 1354 |
| projectWhitelistCard | function | 1368 |
| guardPage | function | 1408 |
| templatesCard | function | 1660 |
| datesForPrinting | function | 1671 |
| printDialog | function | 1698 |
| templateDialog | function | 1754 |
| taskDialog | function | 2115 |
| importPlan | function | 2657 |
| selectControls | function | 3301 |
| detachSelected | function | 3306 |
| deleteSelectedTasks | function | 3316 |
| sortProjects | function | 3341 |
| boot | function | 3408 |

全部任务页用与待完成、已完成、全部同级的「模板」标签切换独立模板目录，避免模板被长任务列表推到页面底部；项目页仍在项目任务后显示本项目模板。模板修改默认只影响未来；syncTemplate 只同步形状，保留实例的日期/管辖/进度。自动预印 0–90 天，手动一次印完选定范围；过期过滤由核心执行，isCatchUp 负责普通任务待补呈现。

实例管辖（普通/习惯）由 Rust 核心定义并随 Snapshot.taskKinds 下发，前端 isHabit 直接读取，不再自行推导；从习惯组移出或删除习惯组只清 habitId，不改写冻结的 recurring，历史缺勤不变。

本周日程：resizeCalendar 默认按时间轴上方的实际空间计算可用高度并增加 160px，保持 384–1040px，render、窗口 resize 与字体就绪时重算；mountCalendarResize 支持拖动和方向键调整至 224–2400px，本机 localStorage 保存高度，可恢复自动；滚动不改变比例；schedulePage 是二维日历（横轴周一到周日，纵轴 07:00–23:00），任务块按 `reminderTime` 定位、按 `estimate × 单次时长 + 休息` 给高度，不吸附整点；weekOffset 翻周，点击块打开任务。只用 `state.data.tasks` 的 `dueDate/reminderTime`，不依赖核心新接口。

统计页：activityCard 读取核心 `stats.days` 的每日完成、缺勤和作废数量。statsPage 的历史按 Session.source 区分实际计时与「按预计补足」；两者均纳入时长与项目分布，补足不增加番茄数。

音效：accept 按旧/新 Snapshot 与成功 Action 选择一次音效；sound-events.ts 同时供提醒横幅选队列。soundPreviewControls 与设置保存共享 soundVolume；轮询使用快照版本丢弃操作期间的旧响应。

性能：ensureDerived() 按当前 Snapshot 缓存项目/番茄数与各项目待办计数，accept 换入新对象时失效，避免 taskList 每行重扫 sessions 与 projects。icon() 直接输出 `<svg>`（data-lucide 仅作标记），不再依赖 createIcons 二次遍历占位符；accept 只用一次 JSON.stringify 作为数据签名，减少每秒轮询开销。

侧栏排序：sort-projects 使用 showContextMenu；外部点击在捕获阶段关闭旧菜单，避免打开菜单的同次点击在冒泡阶段将其关闭。排序持久化仍使用 reorderProjects；项目右键菜单共享关闭逻辑。

背景音：backgroundSoundButton 在普通专注、沉浸与专注保护（含严格模式）界面共用入口；休息锁机不提供声音入口。soundDialog 调用 bgm.ts 导入并保存至少 1 小时的音频，手动循环播放/暂停/移除，与合成噪音互斥；雨声使用随包真实录音，异步解码期间后续选择可取消旧请求；boot 恢复保存文件，不自动播放。

偏好页：settingsPage 按内容高度分列，左列专注/学习计划，右列体验/桌面集成/备份。长休息间隔说明按当天完成的番茄累计，跨日重置由 Rust 核心负责。savePreferences 合并手动保存与离页保存；输入仅标记 dirty，窗口失焦不保存；无效或保存失败时保留表单并阻止离页。

锁机日程：focusSchedule / focusScheduleDialog白天取 state.today；当天启用且星期匹配的跨夜锁机开始后取次日，午夜后继续显示这一天（改称今天）。午间小憩、停用时段和未安排跨夜锁机均显示今日；updateClock 在时间边界同步入口和已打开的弹窗。时间排序、无时间排末尾，排除已报废实例。展示任务/项目/备注/步骤，无修改和计时入口；renderImmersive 在保护期间提供入口，严格模式可用，休息锁机使用深色弹窗。

Android 导航：setMobileNav控制抽屉和工作区 inert；平台身份由原生 platform_kind 报告，boot 安装 tomatoBack 供 Kotlin 返回键处理。桌面专属偏好只在 desktop 为 true 时显示。

首页待完成：focusPage 固定分为今日定时、待补、今日未定时，待补全部显示。任务必须有日期；模板按具体日期或周期星期印刷，精确时间可选。taskList 接受独立排序参数，compareTaskTime 按日期、提醒时间与创建顺序比较；全部任务页继续使用用户选择的排序。

简洁模式：compact.ts 保存本机开关并设置根元素 data-compact-mode；settingsPage 的无 name 开关由 bindForms 立即保存，不标记业务配置 dirty、不重建正在编辑的表单。说明按用途显式标记 data-explanation；日程拖动提示和空状态建议同样隐藏，空状态与按钮仍保留。模板可选/周期辅助提示、实例与声音弹窗副标题、统计口径介绍、白名单建议与沉浸鼓励语同样隐藏；创建方式、时长预览、整周印刷/重修后果、统计范围/截断数量/来源标签继续显示。blocked-count 只在零次时标记为说明，boot 的拦截事件更新先移除标记，避免真实次数被隐藏。日期、进度、错误、权限及保护后果不隐藏。ponderChip 改为灯泡图标，保留无障碍名称。

角色背景板：settingsPage 的「体验与提醒」保存 settings.personaBackdrop（默认关闭）；render 与 setupAgent.backdrop 在普通页面允许显示，沉浸或专注保护时交给 syncPersonaBackdrop 隐藏。

项目页挂载education.ts：资料目录授权、教学配置和只读教学记录；新项目必选目录，考试停笔状态变化提示上传答题卡。
