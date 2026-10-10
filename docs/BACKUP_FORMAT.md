# 完整备份文件 v3

入口：**偏好设置 → 数据与备份 → 导出备份 / 导入备份**。文件采用 UTF-8 JSON，建议文件名 `tomato-todo-backup.json`，上限 20 MiB。备份覆盖项目、任务完成进度、计时状态、专注历史、设置和定时锁机规则。只交换待办安排时应使用 [学习计划文件](PLAN_FORMAT.md)，避免替换现有数据。

机器定义见 [backup.schema.json](backup.schema.json)，通用示例见 [backup.example.json](backup.example.json)。Schema 校验结构，Rust 核心检查引用、日期、时间和跨字段约束。当前数据/备份版本为 `3`；模型采用破坏性升级，不自动迁移旧本机数据库或备份。旧学习计划 v1/v2 仍可转换导入。

## 顶层字段

| 字段           | 内容                       | 要求                                                                                                                          |
| -------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `version`      | 数据版本                   | 固定 `3`                                                                                                                      |
| `projects`     | 项目数组                   | 最多 500 项，`id/name/color/appWhitelist` 同计划格式；`appWhitelist` 可选；提供时专注该项目的任务用这份专属清单替代通用白名单 |
| `goals`        | 主线任务组                 | 最多 500 项；`id/name/nodes`，每个节点含 `spec/confirmed/emitted/result`，没有统一产出单位                                    |
| `nodeBindings` | 实例配对历史               | 最多 200000 项，`taskId/goalId/nodeId/completed/boundAt`；删除实例仍保留其完成事实                                            |
| `signalEvents` | 信号及裁定依据             | 最多 200000 项，保留来源、方向、内容、接收顺序及阻断时的规则和完成情况                                                        |
| `identities`   | 永久 ID 登记               | 最多 1000000 项；`id/kind/retired/restoreTask`；历史 ID 不能用于新实体                                                        |
| `habits`       | 习惯组数组                 | 最多 500 项，只保存 `id/name`；形状和安排由模板管理                                                                           |
| `templates`    | 模板与印刷规则             | 最多 5000 项，结构同计划 v4；不含完成和统计                                                                                   |
| `prints`       | 已印日期记录               | 最多 200000 项，删除实例后仍保留，恢复后防止重新生成                                                                          |
| `visions`      | 愿景数组                   | 最多 500 项；含 `name`、可选 `notes`，可归 `projectId` 或 `goalId`（至多一个，都为 null 即顶层总愿景）；旧文件省略时为空      |
| `tasks`        | 全部任务，包括已完成任务   | 最多 50,000 项                                                                                                                |
| `settings`     | 番茄钟、主题与专注保护设置 | 必填                                                                                                                          |
| `timer`        | 当前计时器                 | 必填                                                                                                                          |
| `sessions`     | 专注历史数组               | 最多 200,000 项                                                                                                               |
| `lock`         | 定时锁机规则和当前状态     | 旧文件省略时默认无规则、未锁机                                                                                                |

完整备份没有 `format: "tomato-todo-plan"` 标记。两个文件各有独立的导入入口，不能只改后缀互换。

## 任务与历史

任务包含计划 v4 的实例字段，另有 `completed`、`completedAt`（Unix 秒/null）、`createdAt`（Unix 秒）、子任务 `done` 与提醒送达状态。`completed` 必须与 `completedAt` 是否存在一致。实例的日期、完成、步骤进度与专注历史均属于实例；`templateId` 只指向来源，修改模板不会改历史。`recurring` 是生成时冻结的重复属性，不能从当前模板反向计算。实例不保存 `repeat/nextTaskId`。

`goalId/habitId` 引用所属管辖组；目标实例按组 ID 与执行时间配对节点，可重复，提醒时刻可选。`nodeId` 保存配对；节点裁定后所有配对实例报废，包括已完成记录。普通定时实例的 `scrapMinutes` 默认 0，单位分钟，从计划块结束起算，仅当天有效；仍可重修的普通/目标实例进入待补队列。习惯不重修，只对已经生成而漏做的实例记缺勤。普通/习惯已过静态窗口的候选不再印刷；主线不控制模板印刷，后来配对到已裁定节点的实例立即报废。

`reminderFired/reminderPending/reminderExpired` 保存本机提醒状态，缺省 false。目标的最终报废由配对节点的不可逆信号裁定决定，不能仅从 `reminderExpired` 推断。`templates` 和 `prints` 的完整规则见 [计划 v4](PLAN_FORMAT.md)。`automatic`、`printAheadDays` 和独立印刷记录随备份保存；恢复时保持模板自动预印设置，在后续轮询中只补齐未印且尚未报废的候选实例。

节点 `spec` 的配置见 [主线设计](NODE_DESIGN.md) 与计划 v4。节点 `result` 为 null 或 `{ verdict: success|failure, at, signalId }`；必须对应真实信号记录。结果和配对属于运行状态，不以节点时间自动生成过期状态。信号记录的 `deliveries` 包含 `nodeId/blocked/blockRule/before/after/pairedCount/completedCount/completed`，可解释传播和裁定。

备份保留全部配对、确认、裁定、已发标记和 ID 历史。本机导入时合并已有 ID 历史，不能删除或改写本机已有的节点裁定。恢复更旧的文件若会倒退裁定则整体拒绝；恢复原文件到新数据库可完整保留其历史。删除任务时保存原任务恢复内容，撤销只恢复同一实体，不能借原 ID 创建另一条任务。节点已有配对、信号或裁定时不能删除；已有裁定节点只能改名。开始新一轮应创建新的任务组和节点。

`visions` 是纯标记：愿景不参与任务、进度与缺勤，删除所属项目或目标时其愿景一并删除。

历史记录包含 `id`、`taskId`（可空）、`taskTitle`、`projectName`、`startedAt`、`endedAt`、`durationSecs`（1—10800）、`completed`。开始和结束均为 Unix 秒，结束不能早于开始，ID 在历史中唯一。已删除任务可保留历史，故历史任务 ID 不强制要求仍在当前列表里。睡眠/小憩锁机不生成专注记录。

任务可带 `reminderTime`（HH:MM/null，非空需要日期）、`focusMinutes`（1—180/null）、`reminderFired` 和 `reminderPending`（布尔值，缺省 false）。旧备份缺失时间字段时默认不提醒、使用全局时长；任务仍为统一类型。提醒状态随备份保存；当天未处理提醒在空闲后显示，过期提醒在下次轮询清除。

## 设置与严格模式

`settings` 包含：

- `focusMinutes`：1—180；`shortBreakMinutes`：1—60；`longBreakMinutes`：1—120。
- `longBreakEvery`：2—12；`dailyGoal`：1—30，以上均为整数。
- `autoBreak`、`autoFocus`、`sound`、`notifications`、`alwaysOnTop`：布尔值。
- `theme`：`light`、`dark`、`system`。
- `protection`：见下表；旧文件可省略，默认关闭。

| `protection` 字段 | 含义                                                               | 旧文件默认值 |
| ----------------- | ------------------------------------------------------------------ | ------------ |
| `mode`            | `off` 自由专注、`lock` 界面锁定、`whitelist` 应用白名单            | `off`        |
| `whitelist`       | 应用 ID 字符串数组，精确匹配，最多 100 个                          | `[]`         |
| `strict`          | 界面锁定或白名单专注中禁止应用内提前退出、暂停和规则修改；到时解除 | `false`      |

白名单 ID 不能全为空白或含控制字符，每个不超过 200 个 UTF-8 字节。`strict` 在 `mode: off` 时不产生锁定；严格设置保留在备份中，但不会因为恢复文件而开始计时。窗口接口故障时会释放保护并报错；严格模式不承诺阻止系统快捷键或从系统外部结束进程。

除上述通用白名单外，每个项目还可带 `appWhitelist`：提供后专注该项目的任务时，实际允许的应用就是这份专属清单，**替代**通用白名单（可更窄，也可包含通用里没有的应用）；未提供的项目继续用通用白名单。它同样要求每个 ID 有效且最多 100 个，只在 `mode: whitelist` 下生效；界面锁定模式忽略白名单。学习计划导入可单独启用/覆盖该字段，恢复备份则整体替换。

登录自启动、关闭到托盘等机器相关偏好仍在 `desktop.json`，不随备份迁移。

## 定时锁机

```json
{
  "schedules": [
    {
      "id": "example-night-rest",
      "name": "晚间休息",
      "start": "23:00",
      "end": "07:00",
      "days": [1, 2, 3, 4, 5, 6, 7],
      "enabled": false,
      "strict": true
    }
  ],
  "active": null,
  "suppressedUntil": 0
}
```

该对象对应顶层 `lock`。`schedules` 最多 20 项，各规则字段如下：

| 字段            | 规则                                               |
| --------------- | -------------------------------------------------- |
| `id`            | 非空且在规则中唯一                                 |
| `name`          | 1—40 个字符，不能全为空白                          |
| `start` / `end` | 本机当地时间 `HH:MM`，必须有效且不相同             |
| `days`          | 1—7 的不重复整数数组，至少一天；1 为周一，7 为周日 |
| `enabled`       | 是否启用                                           |
| `strict`        | 生效期间不允许从应用提前退出；省略为 false         |

结束早于开始时跨午夜。星期归属**开始日期**，例如只选周五的 23:00—07:00，持续到周六早上。启用的规则不能重叠，跨周日/周一的重叠也会被拒绝。规则使用接收电脑的本地时区，不把导出机器的时区固定在文件内；夏令时重复的起点取较早时刻、终点取较晚时刻，不存在的本地时刻跳过当次。

`active` 是当前执行状态：null 或 `{ "name", "startedAt", "endsAt", "strict" }`；时间为 Unix 秒，结束必须晚于开始。`suppressedUntil` 是普通模式提前结束后避免本轮再次触发的 Unix 秒，默认为 0。这两项用于本机持续运行和重启恢复，**不是计划模板**。

快速锁机接受 1—720 分钟，执行时也写入 `active`，不新增重复规则。如果已有定时规则在小憩期间开始，按定时规则继续锁机，结束取较晚时间；任一严格模式生效则本轮严格执行。

## 计时器与恢复行为

`timer` 包含 `mode`（`focus/shortBreak/longBreak`）、`running`、`taskId`、`durationSecs`、`remainingSecs`、`deadline`、`startedAt`、`cycle`、`completionSerial`、`lastFinishedMode`。秒数非负，持续时间 1—10800，剩余不得超过持续时间；`running` 必须与 `deadline` 是否存在一致。可空的时间字段用 Unix 秒。`taskId` 非空时必须引用当前任务；最后完成的阶段可为 null。

导入先完整校验，再一次性替换数据；当前处于保护状态时不能恢复备份。确认框会说明替换范围。导入后：

1. 项目、任务与历史恢复为文件内容。
2. 计时器暂停，清除 deadline，按导入时刻计算剩余秒数（至少 1 秒）；完成事件序号沿用本机，避免重放旧提醒。
3. **定时规则保留，但全部设为 `enabled: false`。**需要在定时锁机页重新启用。
4. **清除 `lock.active` 和 `suppressedUntil`。**导入文件不会立即锁住接收电脑。
5. 严格模式及白名单配置保留，下次主动开始相应专注或启用时段后才生效。

这里与直接重新打开本机数据库不同：本机重启继续按原截止时刻恢复严格专注/小憩；当前仍在已启用定时时段内时恢复锁机，已过去的时段不会补锁。程序关闭或电脑休眠时无法执行桌面拦截，也不会唤醒设备。
