---
name: tomato-todo
description: 在 DSH 对话中通过番茄插件自带工具使用任务、课表、资料、教学记录和记忆。用户把对话助手当作番茄 Todo 的教学入口，或要求读取学情、回写作业批改、调整学习安排时使用。
---

# 番茄 Todo 的对话入口

对话助手承担对话、阅读资料、备课、命题与批改，番茄 Todo 保存任务、课程、正式测评、学情和记忆。两边使用同一个运行实例的数据；不要另建一套平行成绩册或假装聊天结果已经入库。

## 连接与数据入口

- 优先使用番茄插件自带的 `tomato_*` Host 工具，它们每次调用都连接当前运行实例，不依赖 DSH 的 MCP 客户端会话。首次处理本轮学习事项先 `tomato_get_context`；按需再用 `tomato_get_tasks`、`tomato_get_study_progress(projectId, offset, limit)`、`tomato_get_education(collection, …)` 分页读取。空记录表示未知，摘要中的数量不能替代完整记录。
- 需要完整教学历史时用 `tomato_get_education` 按集合分页读（projects/resources/semesters/semesterHistory/lessons/assessments/submissions/grades/reviews/events/completedTasks/progress/corrections/focusTasks）；或 `tomato_export_backup` 导出后用 DSH 自带 `read` 分段读。不要为一个问题把整个备份灌入上下文。
- 运行时必须保持运行。若旧 `mcp__tomato__*` 工具报 `server is disconnected`，立即改用同名 `tomato_*` Host 工具，不要仅因 MCP 断线就要求用户手工抄作业。若 Host 工具也失败，再核对运行实例和连接文件；不启动另一个数据库，不直接改 SQLite、私有 `state.json` 或授权文件。无法接通时可继续完成不依赖实时数据的草稿，明确哪些尚未写回。
- 若本机另有 `references/local-context.md`，只在查找资料、个人排期或排查连接时读取；该本机导航不随技能仓库发布。

## 按任务使用技能

| 工作 | 使用的技能 |
| --- | --- |
| 应试配置、学期、45 分钟课程、作业、批改、订正 | `exam-teaching` |
| 出题、组卷、复测、答案与评分标准、试卷审校 | 同时使用 `exam-authoring` |
| 根据课表与学情排任务、减量、挪动和拆分 | `study-planning` |
| 知识困难、投入变化、冲突和复盘 | `study-diagnosis` |
| 跨对话背景、偏好、来源与确认状态 | `study-memory` |

正式教学写入使用 `tomato_education`（`command.op` 见下）。操作前读本技能仓库的 [教学字段快照](references/teaching-contract.md)，它记录当前运行版本的字段；正式写入前可再 `tomato_get_education` 核对现有记录，不能猜字段。未连接时可用该快照准备草稿，恢复连接后重读数据再提交。

## 资料与教学产物

资料原文和备课产物保存在实际项目目录，应用资源登记保存相对路径。文件先落盘，再 `tomato_education` 的 `saveResource` op；更新路径沿用资源 ID。对话助手能访问某个目录不表示番茄 Todo 已获授权，项目绑定与目录授权仍由用户在项目页设置。

资源登记、文件名、索引、课程到点结束、任务勾选和订正通过都不能单独证明已读或掌握。读取原文后才引用；掌握需要独立复测。正式教学记录、来源与确认状态保留在应用内。

## 调整任务与课表

单项使用 `tomato_create_task` / `tomato_update_task` / `tomato_move_tasks` / `tomato_complete_task` 或 `tomato_dispatch`；正式教学使用 `tomato_education`，不能用普通 Action 或备份补丁伪造已发布题目与成绩。

批量调整：`tomato_export_plan` / `tomato_export_backup` 导出 → 用 DSH 自带 `read`/`edit` 编辑导出的 JSON → `tomato_apply_file(name, fileHash)` 应用（带哈希校验与导入校验）。只改普通安排优先计划 v6；它不承载正式学期、课程、作业或批改。完整备份含历史与状态，不能用它做普通排期来回覆盖。

每批改动保留稳定 ID、完成记录、实际用时和原有引用；不重复安排已完成或作废实例，不把漏做自动变成次日欠账。来源或哈希冲突时重新导出并重放变更意图，不覆盖新进度，不伪造 `.origin`。保护中被拒绝时遵守软件约束，不解除保护或修改保护配置来应用学习计划。

## 报告结果

分别说明实际文件位置、成功写入的记录及未完成部分。只在工具返回成功后说已发布、已保存或已应用；重试前查已有 ID 与状态，避免重复发布。对话不接管应用的自动教学事件，不承诺关闭软件后执行或到点自动回复。
