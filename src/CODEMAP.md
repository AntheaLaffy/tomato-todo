---
mode: maintenance
generated_at: 2026-10-10
---

奶油白与番茄红的桌面界面；业务状态通过 Rust 命令更新。

## 任务指南

| 任务                             | Domain    | Target                                                                                                                      | Also Check                                                                                                           |
| -------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 偏好布局与保存时机               | 界面      | main.ts 的 settingsPage/savePreferences/navigate、style.css 的 settings-grid                                                | tests/integration.mjs 的失焦/离页/手动/失败与布局检查                                                                |
| 简洁模式与说明显隐 | 界面 | compact.ts、main.ts 的 settingsPage/bindForms/ponderChip、style.css 的 data-explanation | agent.ts 的输入提示、ponder.ts 的偏好讲解、tests/integration.mjs 的 compact mode、docs/DESIGN.md |
| 调整页面布局                     | 界面      | main.ts.analysis.md、style.css.analysis.md                                                                                  | —                                                                                                                    |
| 任务到点提醒                     | 界面      | main.ts 的 pendingReminder/reminderBanner/taskDialog                                                                        | Rust reminders.rs、桌面轮询                                                                                          |
| 模板编辑、独立标签、自动预印与手动整批印刷 | 界面/契约 | main.ts 的 tasksPage/templateDialog/focusBudget/printDialog/templatesCard（临时 / 手动 / 自动渐进披露）、types.ts 的 Template | crates/core/src/templates.rs、plan.rs、docs/CODEMAP.md |
| 修改任务字段                     | 契约      | types.ts、main.ts 的 taskDialog                                                                                             | crates/core/src/lib.rs                                                                                               |
| 修改备份流程                     | 桥接      | api.ts                                                                                                                      | main.ts 的 importBackup、Rust Import Action                                                                          |
| 修改计划文件流程                 | 桥接      | api.ts、types.ts、main.ts 的 importPlan                                                                                     | crates/core/src/plan.rs、docs/CODEMAP.md、桌面/预览适配层                                                            |
| 修改桌面设置                     | 桥接      | api.ts、main.ts 的 desktopSettingsCard                                                                                      | src-tauri/src/desktop.rs；浏览器隐藏这些设置                                                                         |
| 项目专属应用白名单               | 界面/桥接 | main.ts 的 projectWhitelistCard/addProjectWhitelist、types.ts 的 PlanProject                                                | crates/core/src/plan.rs、src-tauri/src/desktop_app.rs 的保护循环、docs/CODEMAP.md；项目页承载编辑，专注保护页只管通用白名单 |
| 目标容器与待补                   | 界面      | main.ts 的 goalDialog/focusPage/todayTaskGroup/isCatchUp/taskList、types.ts 的 Goal                                                        | crates/core/src/lib.rs 的 Goal 与 nodes.rs、docs/BACKUP_FORMAT.md                                                    |
| 习惯分组与周期印刷               | 界面      | main.ts 的 goalsPage/habitsTab/templateDialog、types.ts 的 Habit                                                            | crates/core/src/templates.rs、lib.rs 的 TaskKind 与 Snapshot.taskKinds、docs/BACKUP_FORMAT.md                        |
| 愿景标记                         | 界面      | main.ts 的 visionsTab/visionDialog/projectVisionCard、types.ts 的 Vision                                                    | crates/core/src/lib.rs 的 Vision、docs/BACKUP_FORMAT.md                                                              |
| 定时锁机/严格模式界面            | 界面      | main.ts 的 lockPage/lockDialog/bindForms/guardPage/renderImmersive/tomorrowScheduleDialog（时段严格开关与锁机只读明日日程） | types.ts、crates/core/src/lock.rs、桌面桥接                                                                          |
| 数据统计与纵切面                 | 界面      | main.ts 的 statsPage/goalStatsCard/crossSectionCard、types.ts 的 GoalStat/NodeStat/LineOutcome                              | crates/core/src/lib.rs 的 stats/GoalStat/NodeStat/DayStat、docs/BACKUP_FORMAT.md                                     |
| 本周日程表与课表阻塞时段         | 界面      | main.ts 的 schedulePage/resizeCalendar/mountCalendarResize/weekOffset/blocksCard/blockDialog、style.css 的 calendar-body/calendar-block/calendar-band | types.ts 的 Task、Block（dueDate/reminderTime/attention）、crates/core/src/blocks.rs、docs/PLAN_FORMAT.md、tests/integration.mjs 的窗口/显示缩放/拉伸检查 |
| 写作业 BGM 导入与播放 | 声音 | bgm.ts、main.ts 的 backgroundSoundButton/soundDialog/renderImmersive | tests/audio.mjs、tests/integration.mjs；至少 3600 秒，本机 IndexedDB 保存，不随备份导出 |
| 关键节点音效与音量               | 声音/契约 | audio.ts、sound-events.ts、main.ts 的 accept/soundPreviewControls                                                           | types.ts、Rust Settings、备份契约、tests/audio.mjs                                                                   |
| 侧栏项目排序与右键菜单           | 界面      | main.ts 的 showContextMenu/hideContextMenu/sortProjects 与捕获阶段的外部点击关闭                                            | tests/integration.mjs 的打开/排序/保存/关闭回归                                                                      |
| 学习助手界面                     | 界面/桥接 | agent.ts 的 agentPage/mountAgent/setupAgent/refreshAgent/thinkingSelectHtml/questionHtml/renderSessions（分组/归档侧栏）、focusSearch/resizeComposer（快捷键与输入）                                            | api.ts 的 agentCall、main.ts 的 revealAgent/轮询、style.css 的 agent-proposal/agent-option、docs/AGENT.md、tests/agent.mjs |
| 助手的「手」（动画演示层）        | 界面      | hand.ts 的 runHandScript/handStep/moveTo/typeInto/say、main.ts 的 installHand                                              | hand-demo.ts 的 blocksTour、style.css 的 #hand-layer/hand-keyboard、docs/AGENT.md、tests/integration.mjs             |
| 概念讲解（思索）                 | 界面/引导 | ponder.ts 的 PONDER_TARGETS/initPonder/openPonderList                                                                       | main.ts 的 data-ponder 与 data-action="ponder-list"、style.css、tests/integration.mjs                                |

## 文件

| File            | Domain | Function                                                                            |
| --------------- | ------ | ----------------------------------------------------------------------------------- |
| compact.ts | 界面偏好 | 简洁模式的本机保存与根元素标记，默认展示完整说明；全局按 data-explanation 隐藏解释文字 |
| main.ts         | 界面   | 页面、弹窗、事件与刷新；见 main.ts.analysis.md                                      |
| style.css       | 视觉   | 设计变量、页面布局、明暗主题与响应式；见 style.css.analysis.md                      |
| api.ts          | 桥接   | 原生入口报告桌面/Android 身份，选择 Tauri IPC 或本地 HTTP；计划/备份、助手附件和 Markdown 的系统保存与浏览器下载 |
| types.ts        | 契约   | 实例、Template/Printing/PrintRecord、计划 v4 与备份 v3 的 Rust serde camelCase 类型 |
| bgm.ts          | 声音   | 本地长音频元数据校验、IndexedDB 持久化、循环播放/暂停与背景音量 |
| audio.ts        | 声音   | 本地真实雨声解码/缓存与加载取消、棕噪音循环、11 种关键节点短音效、独立音量与安全音频激活；雨声及许可在 public/audio/ |
| sound-events.ts | 声音   | 按已接受快照选择一次音效，共享提醒队列排序、静音/导入抑制与同时事件优先级           |
| agent.ts        | 桥接   | 对话页与状态轮询、设置/记忆/信号浮层、登录、对话批准与自动唤醒切页；见 agent.ts.analysis.md |
| agent-canvas.ts | 文档工作区 | Canvas 编辑/选段草稿、版本读取/恢复、冲突保留、格式导出与隔离 HTML 预览；所有文本模型共用 |
| agent-media.ts | 图片 | 私有图片预览加载、大图对话框、下载与继续编辑入口；账号能力由 agent.ts 检查 |
| agent-chat.ts   | 对话   | 消息/会话/附件契约、思考折叠、消息与附件卡片、上传编码、消息和代码复制 |
| agent-markdown.ts | 对话 | Marked + KaTeX + DOMPurify，回答排版、公式、代码复制按钮与安全链接 |
| hand.ts         | 引导 | 助手手势、讲稿与键盘演示；脚本结束/出错自动收起，失败不阻断后续队列 |
| hand-demo.ts    | 引导 | blocksTour 课表阻塞时段演示脚本 |
| nodegraph.ts    | 界面   | 主线节点图：横向节点卡、信号横条、缩略图与节点检查器，拖拽重排                      |
| ponder.ts       | 引导   | 概念登记表与讲解机制：悬停胶囊、长按 G 打开讲解面、全部概念列表                     |

主线入口：main.ts 的 goalsTabContent/goalDialog 与 src/nodegraph.ts 的节点图，Snapshot.nodeProgress 为核心计算结果。成功/失败实例只读；删除配对任务可从组内恢复原实体；条件阻断分别针对成功与失败。
