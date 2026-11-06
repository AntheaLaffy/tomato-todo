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
- guard 启动参数：`--serve`（127.0.0.1:43988，token 由 runtime 生成写入 guard 数据目录）、`--lock`/`--unlock` 等一次性命令。

## runtime HTTP API（127.0.0.1:43987）

浏览器只读端点（允许 `Origin: http://127.0.0.1:3080` 的 CORS，供插件 UI）：
- `GET /api/snapshot` — 全量只读快照（形状对齐旧 src/types.ts 的 Snapshot，camelCase）
- `GET /api/today`、`GET /api/stats`、`GET /health`

浏览器写端点（同 Origin 白名单；写路径也必须经 @tomato/core 的校验与保护规则）：
- `POST /api/tasks`、`PATCH /api/tasks/:id`、`POST /api/tasks/:id/complete`、`POST /api/tasks/move`
- `POST /api/focus/start`、`POST /api/focus/stop`、`POST /api/focus/pause`
- 其余写操作走 MCP（助手代劳），UI 不直接暴露

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
