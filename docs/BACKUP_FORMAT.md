# 完整备份文件 v1

入口：**偏好设置 → 数据与备份 → 导出备份 / 导入备份**。文件采用 UTF-8 JSON，建议文件名 `tomato-todo-backup.json`，上限 20 MiB。备份覆盖项目、任务完成进度、计时状态、专注历史、设置和定时锁机规则。只交换待办安排时应使用 [学习计划文件](PLAN_FORMAT.md)，避免替换现有数据。

机器定义见 [backup.schema.json](backup.schema.json)，通用示例见 [backup.example.json](backup.example.json)。Schema 校验结构，Rust 核心检查引用、日期、时间和跨字段约束。旧版备份缺少新增字段时按下表补默认值；`version` 仍为 `1`，不改变既有字段语义。

## 顶层字段

| 字段 | 内容 | 要求 |
| --- | --- | --- |
| `version` | 数据版本 | 固定 `1` |
| `projects` | 项目数组 | 最多 500 项，`id/name/color/appWhitelist` 同计划格式；`appWhitelist` 可选；提供时专注该项目的任务用这份专属清单替代通用白名单 |
| `goals` | 目标数组 | 最多 500 项；含 `name`、`target`(>0)、`unit`、`measure`(`count` 按已完成任务数 / `time` 按累计专注小时)，可选 `dueDate`；旧文件省略时为空 |
| `habits` | 习惯数组 | 最多 500 项；含 `name`、`slots`(`days` 1—7 与 `time` HH:MM，同一个星期只能出现一次)，可选 `projectId`、`focusMinutes`；旧文件省略时为空 |
| `tasks` | 全部任务，包括已完成任务 | 最多 50,000 项 |
| `settings` | 番茄钟、主题与专注保护设置 | 必填 |
| `timer` | 当前计时器 | 必填 |
| `sessions` | 专注历史数组 | 最多 200,000 项 |
| `lock` | 定时锁机规则和当前状态 | 旧文件省略时默认无规则、未锁机 |

完整备份没有 `format: "tomato-todo-plan"` 标记。两个文件各有独立的导入入口，不能只改后缀互换。

## 任务与历史

任务包含学习计划中的全部字段，另有 `completed`（布尔值）、`completedAt`（Unix 秒或 null）、`createdAt`（Unix 秒）、`nextTaskId`（下一次重复任务 ID 或 null）。子任务另有 `done` 布尔值。`completed` 必须与 `completedAt` 是否存在一致。完整备份中的 `notes`、`priority`、`estimate`、`tags`、`subtasks`、`completed`、`createdAt` 不能省略；`repeat` 默认为 `none`。

任务带可选的 `goalId`（所属目标）与 `habitId`（所属习惯）。属于目标的过期未完成任务会在今日专注里标为「待补」；习惯按 `slots` 的星期生成当天任务（`habitId` 指向习惯，`reminderTime` 取该时段）。旧备份缺少 `goals`、`habits`、`goalId` 或 `habitId` 时按空处理。

提醒的送达状态 `reminderFired` / `reminderPending` / `reminderExpired` 属于本机执行记录：`reminderExpired` 表示该定时任务的当日已过或计划块已结束。无 `goalId` 的定时任务（养习惯）过期后不再进入今日待办，但会计入每日缺勤统计；旧备份缺这些字段时默认为 `false`。

历史记录包含 `id`、`taskId`（可空）、`taskTitle`、`projectName`、`startedAt`、`endedAt`、`durationSecs`（1—10800）、`completed`。开始和结束均为 Unix 秒，结束不能早于开始，ID 在历史中唯一。已删除任务可保留历史，故历史任务 ID 不强制要求仍在当前列表里。睡眠/小憩锁机不生成专注记录。

任务可带 `reminderTime`（HH:MM/null，非空需要日期）、`focusMinutes`（1—180/null）、`reminderFired` 和 `reminderPending`（布尔值，缺省 false）。旧备份缺失时间字段时默认不提醒、使用全局时长；任务仍为统一类型。提醒状态随备份保存；当天未处理提醒在空闲后显示，过期提醒在下次轮询清除。

## 设置与严格模式

`settings` 包含：

- `focusMinutes`：1—180；`shortBreakMinutes`：1—60；`longBreakMinutes`：1—120。
- `longBreakEvery`：2—12；`dailyGoal`：1—30，以上均为整数。
- `autoBreak`、`autoFocus`、`sound`、`notifications`、`alwaysOnTop`：布尔值。
- `theme`：`light`、`dark`、`system`。
- `protection`：见下表；旧文件可省略，默认关闭。

| `protection` 字段 | 含义 | 旧文件默认值 |
| --- | --- | --- |
| `mode` | `off` 自由专注、`lock` 界面锁定、`whitelist` 应用白名单 | `off` |
| `whitelist` | 应用 ID 字符串数组，精确匹配，最多 100 个 | `[]` |
| `strict` | 界面锁定或白名单专注中禁止应用内提前退出、暂停和规则修改；到时解除 | `false` |

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

| 字段 | 规则 |
| --- | --- |
| `id` | 非空且在规则中唯一 |
| `name` | 1—40 个字符，不能全为空白 |
| `start` / `end` | 本机当地时间 `HH:MM`，必须有效且不相同 |
| `days` | 1—7 的不重复整数数组，至少一天；1 为周一，7 为周日 |
| `enabled` | 是否启用 |
| `strict` | 生效期间不允许从应用提前退出；省略为 false |

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
