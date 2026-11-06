# 番茄 Todo 重写：进程间契约（API.md）

这是四个并行工作流的接口约定。改任何一行前先在本文件留下变更，或给 lead 发消息。

## 进程与入口

| 进程 | 入口 | 职责 |
| --- | --- | --- |
| tomato-runtime | `runtime/bin/tomato-runtime`（Node，随插件分发） | 域 + 数据 + 计时/提醒 + HTTP API + MCP |
| tomato-guard | `crates/guard`（Rust 二进制） | 专注保护/通知/托盘，无域无状态，被 runtime 指挥 |
| DSH 插件 host/client | `plugin/` | MCP 行、agent 工具、UI |

- runtime 数据目录：`~/.local/share/studio.tomato.todo/`（沿用），计划文件 `plan.json` 为唯一数据源（原子写）。
- runtime 启动参数：`--serve`（HTTP 服务，默认 127.0.0.1:43987）、`--mcp`（stdio MCP，新进程转发到运行中的 runtime，语义同旧 mcp.mjs）、`--data <dir>`。
另有一次性参数（插件 host 经 subprocess 调用，无 fetch 环境）：
- `--guard-status`：stdout 打一行 JSON 后退出。成功 `{"ok":true,"guard":{"available":true,"backend":"x11","locked":false,"whitelist":[],"pid":1234}}`；
  guard 不可达也退出 0 但 `{"ok":false,"error":"…"}`；runtime 本身不可达 = 无输出或非零退出。
- guard 启动参数：`--serve`（127.0.0.1:43988，token 由 runtime 生成写入 guard 数据目录）、`--lock`/`--unlock` 等一次性命令。
- guard 数据目录 = runtime 数据目录下的 `guard/` 子目录（默认 `~/.local/share/studio.tomato.todo/guard/`，
  token 文件 `guard/token`，0600；tooling 注释里的 XDG_STATE_HOME 假设作废，以本条为准）。

## runtime HTTP API（127.0.0.1:43987）

浏览器只读端点（允许 `Origin: http://127.0.0.1:3080` 的 CORS，供插件 UI）：
- `GET /api/snapshot` — 全量只读快照（形状对齐旧 src/types.ts 的 Snapshot，camelCase），附带 `guard` 摘要
- `GET /api/today` — `{ "today": "YYYY-MM-DD", "dueCount": number, "focusMinutes": number }`
- `GET /api/stats`、`GET /health` — health 附带可选 `guard` 摘要字段
  `{"ok":true,"runtime":{"pid":…},"guard":{"available":true,"backend":"x11","locked":false,"whitelist":[],"pid":1234}}`（guard 摘要在 guard 不可达时给 `{"available":false}`，不得整体报错）
- `GET /api/state`、`GET /api/export/plan`、`GET /api/export/backup` — 见下节（UI 数据面与导出）

浏览器写端点（同 Origin 白名单；写路径也必须经 @tomato/core 的校验与保护规则）：
- `POST /api/tasks`、`PATCH /api/tasks/:id`、`POST /api/tasks/:id/complete`、`POST /api/tasks/move`
- `POST /api/focus/start`、`POST /api/focus/stop`、`POST /api/focus/pause`
- 其余写操作走 MCP（助手代劳），UI 不直接暴露

### UI 数据面（插件 UI 的唯一数据入口）

UI 不再按页面堆端点，而是「取一份全量状态 + 提交 Action」：

- `GET /api/state` — 全量状态快照（一次拿全，UI 轮询；形状 = `engine.snapshot(now)` 的
  JSON 序列化 + `guard` 摘要 + `education` 摘要）：

  ```jsonc
  {
    "serverTime": 1793986227,          // Unix 秒
    "today": "2026-11-07",
    "taskKinds": { "<taskId>": "plain" },   // plain | habit | class | exam | reserved | teaching
    "remainingSecs": 2700,             // 当前计时器剩余秒（不依赖 data.timer 的 deadline）
    "data": { /* AppData：version identities tasks blocks templates prints projects
                 habits visions settings timer sessions lock education */ },
    "stats": { /* Stats：todaySeconds/…/days[] */ },
    "guard": { "available": true, "backend": "niri / Wayland", "locked": false,
               "whitelist": [], "pid": 1234 }   // guard 不可达时 {"available": false}
  }
  ```

- `POST /api/dispatch` — body `{ "action": Action }`，`Action` 定义见
  `packages/core/src/lib.ts` 的 union（`saveTask`/`toggleTask`/`deleteTask`/`saveHabitGroup`/
  `saveProject`/`selectTask`/`startTimer`/`pauseTimer`/`skipTimer`/`resetTimer`/`setMode`/
  `saveSettings`/`saveLockSchedule`/`startQuickLock`/`emergencyUnlock`/`importPlan`/…）。
  返回 `{ "changed": bool, "snapshot": <与 GET /api/state 同形> }`；Action 校验失败返回
  `400` + `{ "error": "…" }`（错误信息来自 @tomato/core 的 AppError，中文可读）。
  写路径同样经过 core 的校验与保护规则；`emergencyUnlock` 在严格模式下仍被拒绝。
- 写端点在保护生效时同步驱动 guard（lock/unlock/whitelist），并每秒 tick 计时器。

**导出端点（偏好设置页用）**：

- `GET /api/export/plan` — `application/json`，body 为计划 v6（与 MCP `export_plan` 同内容），
  带 `Content-Disposition: attachment; filename="tomato-plan-<today>.json"`；浏览器直接下载。
- `GET /api/export/backup` — `application/json`，body 为完整备份 v4（`docs/BACKUP_FORMAT.md`，
  顶层就是数据、无 `format` 标记，与 MCP `export_backup` 同内容），
  带 `Content-Disposition: attachment; filename="tomato-backup-<today>.json"`。
- 导入不需要新端点：UI 直接 dispatch `{type:"importPlan", plan}`（计划）或
  `{type:"import", data}`（完整备份）。

**实现备注（非契约变更）**：

- `/api/state` 的 `education` 与 `studyProgress` 同源（`packages/core` 的 `summaries`），
  是学情摘要数组；`data.education` 是全量教学记录。
- `POST /api/dispatch` 严格按 `parseAction` 解析（未知字段/未知 type → 400），
  返回的 `changed` 表示 core 应用后 `AppData` 序列化是否变化；无操作（如空闲时
  `emergencyUnlock`）可为 `false`，`snapshot` 仍是最新全量状态。
- `/api/state` 与 `/api/dispatch` 的响应体较大（导入教学记录后可到数 MB）；请求带
  `Accept-Encoding: gzip` 时按需 gzip，形状不变。
- UI 数据面默认**省略 `data.identities`**（永久 ID 登记，插件 UI 不读；完整导入后约 1MB）。
  需要完整数据时加 `?full=1`（MCP/助手侧要核对 ID 历史时用），它同时作用于
  `/api/state` 与 `/api/dispatch` 返回的 `snapshot`（两者保持同形）。
- 教学资源按层级返回（完整导入后资源明细约 1.4MB，UI 默认不需要）：
  - 默认：`data.education.resources` 为空数组（课程/试卷/学期等其它教学字段仍完整）；
  - `?education=lite`：`resources` 只保留 `{id, projectId, title, kind, path}`；
  - `?education=full`：完整 `topics`/`source`/`edition`。
  统计/目录页需要资源清单时用 `lite`，需要完整记录时用 `full`。
  默认 `/api/state` 未压缩约 0.2MB（完整导入后）；`?full=1&education=full` 才返回完整数据。
- MCP `dispatch` 工具保留旧 runtime Action 名（`focusStart`/`focusPause`/…）并返回
  紧凑结果（`{changed,today,serverTime,remainingSecs,stats}`），避免把全量快照当对话文本。

`GET /api/today`、`GET /api/stats`、`GET /health` 保留（MCP / 轻量探活使用）。

MCP 端点：`/mcp` streamable HTTP，Bearer token（数据目录 `agent/connection.json`，同旧桥接形状），拒绝浏览器 Origin。

## MCP 工具（--mcp 与 /mcp 同源）

沿用旧 crates/agent/src/external.rs 的工具语义（名称不变），实现全部重写为 @tomato/core 之上的调用：
`get_context`、`get_control_status`、`set_external_control`、`create_task`、`update_task`、
`move_tasks`、`complete_task`、`dispatch`、`export_plan`、`export_backup`、`review_file`、
`apply_file`、`get_education` 及 education 写工具。初始化返回 serverInfo name=tomato-todo，
instructions 简述接管入口（不再有 Pi 提示词与技能资源）。

## guard 命令协议（runtime → guard，127.0.0.1:43988，Bearer token）

- `POST /guard`，body `{ "command": "lock", "whitelist": ["app-id", ...] }` → 全屏锁定 + 白名单
- `POST /guard` `{ "command": "unlock" }`
- `POST /guard` `{ "command": "notify", "title": ..., "body": ... }`
- `GET /guard/status` → `{ "locked": bool, "whitelist": [...], "pid": ..., "backend": "<实际后端名>" }`
  （backend 取 guard 实际检测到的后端显示名，如 "Sway / Wayland"、"EWMH / X11"，供 runtime 诊断）
- guard 无长期状态；runtime 每次专注会话重发锁屏命令（guard 崩溃由 runtime 重启并重发）。

## 数据形状

- 计划/任务/习惯/模板/阻塞时段：语义以 docs/PLAN_FORMAT.md、docs/BACKUP_FORMAT.md 与
  docs/HANDBOOK/ 为准；JSON 字段名 camelCase，形状以旧 src/types.ts 为起点，
  @tomato/core（packages/core/src/index.ts）是唯一权威实现。
- 日期 `YYYY-MM-DD`、时间 `HH:MM`、时间戳 Unix 秒。

## 插件（plugin/）契约

- MCP 行：`@deepseek-ai/dsh-mcp-client`，stdio，`command: runtime/bin/tomato-runtime`，
  `args: ['--mcp']`，`serverName: tomato`。
- host 半负责：拉起/保活 runtime 子进程（subprocess）、`tomato_today` 等 agent 工具、
  UI 数据代理（如需要）。
- client 半：composer.dock 入口卡 + shell.overlay 面板（今日专注/任务/统计/设置），
  数据直连 `http://127.0.0.1:43987` 只读端点；全部样式走 `--dsw-alias-*` token，
  配色沿用奶油白 `#faf8f4` + 番茄红 `#d96d55` 设计语言。
