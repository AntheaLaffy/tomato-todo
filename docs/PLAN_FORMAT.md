# 学习计划文件 v6

入口：**偏好设置 → 学习计划 → 导入计划 / 导出计划**。UTF-8 JSON，上限 20 MiB。机器定义见 [plan.schema.json](plan.schema.json)，通用示例见 [plan.example.json](plan.example.json)。计划交换安排配置，不交换完成进度、专注历史、计时器或本机设置。

## 日期与提醒时刻

任务实例必须有有效的 `dueDate: "YYYY-MM-DD"`，不能省略、留空或设为 null。模板要么指定具体日期，要么指定每周周期中的星期；印刷时把星期展开成具体日期。提醒时刻是另一个维度：`reminderTime` 和规则中的 `time` 可省略或为 null，有日期不代表必须定时。

v6 已删除目标组、主线节点、配对和信号裁定字段。只接受 v6；旧计划须按本规范转换，或从升级后的应用重新导出。未知字段会被拒绝，不会默默忽略旧规则。完整恢复使用 [备份 v4](BACKUP_FORMAT.md)。

## 顶层与实例

顶层包含 `format: "tomato-todo-plan"`、`version: 6`、`pomodoroMinutes`（1–180）、`projects`、`tasks`。`blocks`、`templates`、`prints`、`habits` 省略时为空；`replace` 默认 false。

实例字段：`id/title/dueDate` 必填；其余包括 `notes`、`projectId`、`templateId`、`habitId`、`recurring`、`reminderTime`、`focusMinutes`、`scrapMinutes`、`priority`、`estimate`、`tags`、`subtasks`。子步骤只有 `id/title`，导入新实例时从未完成开始。实例不拥有重复规则，`repeat` 只允许省略或 `none`。

- `estimate` 默认 1，范围 1–99；`focusMinutes` 可空，范围 1–180。未指定单次时长时，导入按文件 `pomodoroMinutes` 换算为本机番茄段数并向上取整，超过 99 则整体拒绝。
- `priority` 为 0–3；`scrapMinutes` 为 0–10080。标签最多 20 个、每个最多 40 字；子步骤最多 200 项。
- ID 全局唯一，最多 200 个 UTF-8 字节；删除后永久保留，计划不能复用历史 ID。子步骤 ID 是局部编号。

## 模板、印刷与实例

模板为 `{ id, shape, printing, automatic, printAheadDays }`。`shape` 保存标题、备注、项目/习惯组引用、单次时长、预计番茄数、标签、优先级、重修窗口和子步骤文本，不保存日期、完成或统计。规则有三种：

- 单次：`{ kind: "once", date: "2026-10-12", time: null }`。手动模板也必须指定日期，之后可选其他日期复用。
- 日程：`{ kind: "calendar", slots: [{ time: "09:00", dates: ["2026-10-12", "2026-10-14"] }] }`。每个开始时间对应多个日期；同一开始时间的日期须合并。最多 49 个时段、合计 366 项。
- 周期：`{ kind: "weekly", slots: [{ time: null, days: [1,3,5] }] }`。1–7 代表周一至周日，每个时段必须选至少一天，最多 49 个时段；同一星期与时刻不能重复。周期内不混用定时与不定时单元。时间全部留空时仍是有效的普通任务周期。

`automatic` 默认 false；`printAheadDays` 默认 7、范围 0–90。自动印刷在启动/轮询时补齐近期遗漏，不依赖日期首次进入窗口。非重复规则处理截至今天加预印天数的日程；周期规则印完涉及的完整周。0 表示本周或截至今天的非重复安排。程序关闭期间不执行。

手动印刷必须指定日期，周期内任意一天代表印出该完整周；跨多周逐周展开。日程表按所选范围印刷，保存时一起印刷则印完整份日程。已过静态时间窗口的定时实例跳过，仍在重修窗口内的实例可印刷。

`prints: [{ templateId, date }]` 是独立防重账本，`date` 必须是具体日期。一天一旦产生实例便记为已印，删除实例或改模板也不会自动补满。同模板同日期不重复印刷。临时任务可印一条或整份非重复日程，不保留模板。

界面按预计分钟数换算 `estimate`，短任务可自动缩短单次专注；预览包含段间休息。实例冻结 `recurring`，编辑或删除模板不重写其来源分类。完成实例不会生成下一条。

## 普通任务、习惯与项目

有提醒时刻且属于习惯组或 `recurring: true` 的实例是习惯，其余是普通任务。习惯漏做计缺勤，不重修；普通定时任务在计划块结束后可在 `scrapMinutes` 内补做，跨午夜作废。没有提醒时刻的任务不会因缺少精确时间作废。

计划块为全部专注段加段间短/长休息。重修窗口默认 0，边界时刻即作废。印刷跳过已作废候选，已经生成的任务保留完成和专注历史。

习惯组为 `{ id, name }`；定时周期模板可自动建立习惯组。项目提供独立的学习环境：`{ id, name, color, appWhitelist? }`，`appWhitelist` 提供时替代通用白名单，省略时保留本机配置。最多 100 项，每项非空、无控制字符、最多 32768 字符。愿景不参与计划印刷。

## 课表阻塞时段

`blocks` 是计划之外的每周课程/实验占用，最多 60 项，结构为 `{ id, title, days, start, end, attention, notes }`。星期 1–7 不重复；`start/end` 为本机 `HH:MM`，结束不晚于开始表示跨午夜。`attention` 为 `required`（默认，需专心）或 `light`（可并行写作业）。诊断只对需专心时段里的任务冲突报警。它不带进度、不锁机。

## 修改、删除与合并

导入先完整校验候选，再原子提交。相同 ID 按文件更新配置，保留任务 `completed/completedAt/createdAt`、匹配步骤的完成状态、专注历史；日期与提醒不变时保留提醒送达状态。模板、项目、习惯组和课表时段同 ID 更新；项目白名单省略时保留。

默认不删除文件未提及的实体。`replace: true` 则移除未列出的未完成任务、模板、习惯组和课表时段；已完成任务、专注历史、永久 ID 历史保留，项目作为学习环境也保留。应用前自动备份。自动模板在导出后新生成的任务也会被视为未提及，编辑期间应留意印刷安排。

模板编辑默认影响未来。显式 `syncTemplate` 只更新未完成、未作废实例的形状，保留日期、习惯归属、来源分类和步骤完成状态。删除模板保留实例并清空 `templateId`；删除习惯组停止相关模板并清引用，保留 `recurring` 和历史缺勤。删除项目清任务/模板引用并删除其愿景。

导出包含全部模板、印刷记录、习惯组、未完成实例、课表时段和引用的项目；不导出步骤完成状态。

## 接口

预览服务 `GET /api/plan` 导出；`POST /api/action` 接收核心 Action。相关动作包括 `importPlan`、`printInstances`、`saveTemplate`（可带 `printDates`，保存印刷原子执行）、`printTemplate`（`id/dates`）、`syncTemplate`、`deleteTemplate`、`saveHabitGroup`、`saveBlock` 与 `deleteBlock`。桌面 IPC 使用相同模型与校验。

## 与应试教学的边界

本格式只交换普通任务、模板与固定占用；正式学期计划、45分钟课程、作业、考试和批改通过助手的 education 工具维护，随完整备份v4保存。计划导入保留本地教学记录，导入项目的路径信息不能授予本机目录访问权，须在项目页绑定。见 [应试教学](EDUCATION.md)。
