# 番茄 Todo 重写：进程间契约（API.md）

这是四个并行工作流的接口约定。改任何一行前先在本文件留下变更，或给 lead 发消息。

## 进程与入口

| 进程 | 入口 | 职责 |
| --- | --- | --- |
| tomato-runtime | `runtime/bin/tomato-runtime`（Node，随插件分发） | 域 + 数据 + 计时/提醒 + HTTP API + MCP |
| tomato-guard | `crates/guard`（Rust 二进制） | 专注保护/窗口激活/系统通知/显式全屏，无域无状态，被 runtime 指挥 |
| DSH 插件 host/client | `plugin/` | `tomato_*` Host 工具、随包技能、client UI |

- runtime 数据目录：`~/.local/share/studio.tomato.todo/`（沿用），计划文件 `plan.json` 为唯一数据源（原子写）。
- runtime 启动参数：`--serve`（HTTP 服务，默认 127.0.0.1:43987）、`--mcp`（stdio MCP，新进程转发到运行中的 runtime，语义同旧 mcp.mjs）、`--data <dir>`；`--mcp` 另接受 `--connection <file>` 覆盖连接文件路径。
- `agent/connection.json` 保存当前实例的 `mcpUrl` 与 token（0600，原子替换）。token 跨重启复用；短命的第二个 runtime 不会覆盖仍在运行实例的地址，runtime 每 15 秒把被外部改写的连接文件恢复回自己。stdio 入口每次调用重读该文件。
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
- `GET /api/apps` — 当前有窗口的应用（白名单建议用）：`{"apps":[{"id":"code","name":"Visual Studio Code"}],"count":1,"cached":false}`。
  `id` 来自 guard 实际窗口的 `app_id`；桌面入口仅补充可读名称，缓存 30 秒。guard 不可达时返回 503，不退回全机安装列表
- `GET /api/file-token` — 资料库文件读取令牌：`{"access":"…"}`。带 `Origin` 时只放行 UI Origin；令牌随 runtime 进程生成，只用于本机 `?access=` 查询参数
- `GET /api/resources/:id/info` — 资源元数据 `{sizeBytes, name, mimeType, canPreview}`；`canPreview` 要求已知 MIME 且 ≤20 MiB
- `GET /api/resources/:id/file?access=<token>[&download=1]` — 流式返回授权目录里的原件，支持单段 `Range`（206/416）；非预览类型或超过 20 MiB 时预览返回 413，`download=1` 仍可下载
- `GET /api/projects/:id/grant` — `{projectId, authorized, directory, reason?}`：项目绑定目录与本机授权是否一致
- `GET /api/projects/:id/resources` — 资料库分页：`?q=&kind=&status=&offset=&limit=`（limit 1–100，默认 40），返回 `{projectId,total,offset,limit,resources}`；`status` 取 `available`/`missing`/`unavailable`
- `GET /api/projects/:id/resources/scan` — 只读核查登记文件：`{projectId,checkedAt,resources:[{id,state,sizeBytes,detail,references}]}`
- `GET /api/state`、`GET /api/export/plan`、`GET /api/export/backup` — 见下节（UI 数据面与导出）
- `GET /api/library/grant` — 共享资料库授权状态（见「资料目录授权」）

浏览器写端点（同 Origin 白名单；写路径也必须经 @tomato/core 的校验与保护规则）：
- `POST /api/tasks`、`PATCH /api/tasks/:id`、`POST /api/tasks/:id/complete`、`POST /api/tasks/move`
- `POST /api/focus/start`、`POST /api/focus/stop`、`POST /api/focus/pause`
- `POST /api/projects` `{name,color,directory}` → 201 `{projectId,directory}`（目录校验见「项目资料库」）
- `POST /api/projects/:id/authorize` `{directory}` → `{projectId,authorized,directory}`；同时写 `project-grants.json` 与项目 `education.directory`
- `POST /api/projects/:id/rename` `{name,color}` → 目录改名并回写授权/项目记录
- `POST /api/projects/:id/resources` `{resource}` → 201 登记后的资源；文件必须已在授权目录内
- `POST /api/projects/:id/resources/:rid/repair` `{path}` → 验证新路径后保留资源 ID
- `POST /api/projects/:id/resources/cleanup` `{ids?}` → 清理仍缺失且无教学引用的登记；只删索引，不删磁盘文件
- `POST /api/library/authorize` `{directory}`、`DELETE /api/library/grant` — 共享资料库的一次性授权与取消，只给界面上的用户操作，见「资料目录授权」
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
- `POST /api/desktop/fullscreen` `{ "enabled": true|false }`：沉浸层进入/退出时控制 DSH 原生全屏；沿用 UI Origin 校验，失败返回 503 与可读 `error`。仅改变视图，不修改计时与保护规则；保护期间退出沉浸不会解除全屏。

**资料目录授权（共享资料库 / 项目目录，只能由用户设置）**：

- `GET /api/library/grant` — `{"authorized":true,"directory":"/home/fuurin/exam","projects":6,"sharedProjects":["..."]}`；
  未授权时 `{"authorized":false,"directory":null,"projects":0,"sharedProjects":[]}`。授权目录已失联或不再安全时
  仍返回 200，但 `authorized:false` 并带 `reason`，让界面提示重新授权。`projects` 是应试项目数，
  `sharedProjects` 是没有单独授权、直接使用共享库的项目 ID。
- `POST /api/library/authorize` — body `{"directory":"/home/fuurin/exam"}`，返回同形状态。目录必须是已存在的
  绝对路径、不经过符号链接，且不是根目录、整个主目录或 runtime 数据目录（400）。已有项目单独授权的目录
  必须都在新共享库内，否则 400 并点名项目。授权后所有应试项目默认挂载共享库；项目单独授权只能收窄到
  它内部的子目录（`POST /api/projects/:id/authorize` 越界 → 400）。
- `DELETE /api/library/grant` — 返回 `{"authorized":false,...}`。只删除共享授权；`project-grants.json` 里的
  项目单独授权原样保留，没有单独授权的项目立即回落到 403「项目目录尚未由用户授权」。
- 三个端点只服务插件界面「应试教育 → 资料库」卡片；**不映射成 MCP 工具，也不接进 `/api/dispatch` 的
  Action union**，保持「目录授权只能由用户设置」这条不变量。授权存 `dataDir/library-grant.json`
  （0600、同目录临时文件 + rename 原子写，内容 `{directory, grantedAt}`），不进入计划/备份；
  导入备份也不会扩大本机授权。

**导出端点（偏好设置页用）**：

- `GET /api/export/plan` — `application/json`，body 为计划 v6（与 MCP `export_plan` 同内容），
  带 `Content-Disposition: attachment; filename="tomato-plan-<today>.json"`；浏览器直接下载。
- `GET /api/export/backup` — `application/json`，body 为完整备份 v4（`docs/BACKUP_FORMAT.md`，
  顶层就是数据、无 `format` 标记，与 MCP `export_backup` 同内容），
  带 `Content-Disposition: attachment; filename="tomato-backup-<today>.json"`。
- 导入不需要新端点：UI 直接 dispatch `{type:"importPlan", plan}`（计划）或
  `{type:"import", data}`（完整备份）。

**项目资料库（本机授权目录）**：

项目资料只通过用户显式授权的目录读取，授权独立于计划/备份：

- `project-grants.json` 单独存放在数据目录（0600），记录 `[{projectId, directory}]`；备份与计划都不包含它，换机/导入后必须重新授权。
- 授权目录必须是已存在、绝对、非符号链接的专用目录；根目录、整个主目录、runtime 数据目录及其子目录、不同项目之间互相包含的目录都会被拒绝。
- 资源 `path` 必须是安全的项目相对路径（无 `..`、绝对路径、反斜杠或 NUL），解析后不得越出项目根、不得经过符号链接，且必须是普通文件。
- **写入校验**：任何路径上的 `education.saveResource`（MCP `education`、`/api/dispatch`、`/api/projects/:id/resources` 与修复）在进入 @tomato/core 前都会经 `validateResourceAction` 重新核对「绑定目录 = 本机授权」与上述路径规则；未授权、目录失联、文件不存在或变成符号链接时直接拒绝，不会落一条指向宿主任意位置的登记。
- 文件读取走 `/api/file-token` + `/api/resources/:id/file`：令牌随 runtime 进程生成，不写盘；预览上限 20 MiB，超出时仍可 `download=1` 流式下载，不把整份大文件塞进 JSON 或前端内存。
- 清理只移除「文件仍缺失且没有教学引用」的登记；`removeResources` 本身不删除磁盘文件。

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

沿用旧版外部工具清单的语义（名称不变），实现全部在 `runtime/src/tools.mjs` 里重写为 @tomato/core 之上的调用。当前暴露 13 个：

- 读取：`get_context`（今日/学情摘要/统计/诊断）、`get_tasks`（按项目/完成状态分页）、`get_study_progress`（按科目摘要 + 进度历史）、`get_education`（按 `collection/projectId/id` 分页读教学记录）。
- 写入：`create_task` / `update_task` / `move_tasks` / `complete_task`（普通任务）、`dispatch`（番茄/设置/愿景/课表等单项 Action）、`education`（学期/课程/作业/考试/答卷/批改/订正/学情，`command.op`）、`apply_file`（应用导出的计划/备份，带哈希校验）。
- 批量改动：`export_plan` / `export_backup` → 客户端自行编辑 → `apply_file`。

初始化返回 `serverInfo.name = tomato-todo`，instructions 简述接管入口（不再有 Pi 提示词与技能资源）。旧清单里的 `get_control_status` / `set_external_control` / `review_file` / `read_file` / `patch_file` 等不再暴露：内置自动执行与外部接管已随旧助手一起移除，文件读写由客户端（DSH）自带工具完成。

## guard 命令协议（runtime → guard，127.0.0.1:43988，Bearer token）

- `POST /guard`，body `{ "command": "lock", "whitelist": ["app-id", ...] }` → 全屏锁定 + 白名单
- `POST /guard` `{ "command": "unlock" }`
- `POST /guard` `{ "command": "fullscreen", "enabled": true|false }`：显式设置 DSH 全屏（当前接入 niri 的 Wayland foreign-toplevel 接口），重复调用不反转状态。保护期间保持全屏；解锁后跟随沉浸层的状态。
- `POST /guard` `{ "command": "notify", "title": ..., "body": ... }`
- `POST /guard` `{ "command": "focus" }` → 把 DeepSeek Harness 窗口切到前台。响应 `{ "ok": true, "focused": bool, "window": string|null }`。
  提醒到点或一轮结束**不再**由 runtime 自动调用它（只发系统通知与前端音效）；`focus` 保留给显式调用与桌面冒烟。niri 锁机期间仍可激活保护目标 DSH，其他后端的自建锁窗期间返回 `focused=false`。
  窗口识别：应用 ID `dsh-desktop`（桌面窗口）或标题含 `DeepSeek Harness`（浏览器标签）；
  没有 DSH 窗口时 `focused=false`，不是错误。
- `GET /guard/status` → `{ "locked": bool, "whitelist": [...], "pid": ..., "backend": "<实际后端名>" }`
  （backend 取 guard 实际检测到的后端显示名，如 "Sway / Wayland"、"EWMH / X11"，供 runtime 诊断）
- `GET /guard/apps` → `{ "apps": ["app-id", ...] }`：当前有窗口的应用 ID，去重；同样需要 Bearer token，不返回窗口标题或 PID
- guard 无长期状态；runtime 每次专注会话重发锁屏命令（guard 崩溃由 runtime 重启并重发）。
- niri 的保护目标是实际 DSH 窗口，不另建空白锁窗。锁机模式、快速锁机与定时锁机始终发送空白名单，只允许该 DSH 窗口；白名单专注模式才传递有效白名单。守卫每 600ms 检查焦点，切回 DSH 时再次请求全屏。runtime 每秒核对守卫实际锁定状态，进程重启或保护线程退出后重新预检/锁定。

## 数据形状

- 计划/任务/习惯/模板/阻塞时段：语义以 docs/PLAN_FORMAT.md、docs/BACKUP_FORMAT.md 与
  docs/HANDBOOK/ 为准；JSON 字段名 camelCase，`@tomato/core`
  （`packages/core/src/index.ts`）是唯一权威实现。
- 日期 `YYYY-MM-DD`、时间 `HH:MM`、时间戳 Unix 秒。

## 插件（plugin/）契约

- host 半首选：`tomato_*` Agent 工具覆盖 runtime 的 13 个 MCP 操作，
  另有 `tomato_today` 与 `tomato_guard_status`。每次以一次性 subprocess 调用
  正在运行的 runtime；插件不另开数据库，也不负责保活服务。工具 schema 从
  `runtime/src/tools.mjs` 生成，DSH 的 MCP 客户端断线不影响这些 Host 工具。
- runtime MCP 入口保留给独立客户端：`tomato-runtime --mcp` 或带令牌的
  `http://127.0.0.1:43987/mcp`；`cordis.patch.yml` 只插入 `tomato-dsh` 一行，
  不注册第二个 Tomato MCP 客户端。
- 随包技能优先调用上述 `tomato_*` Host 工具；在 Codex 等外部客户端里走 `tomato` MCP，`plugin/skills/*/agents/openai.yaml` 声明该 MCP 依赖。
- 随包技能：`plugin/skills/` 由 `plugin/skills.js` 注册成 DSH 技能提供者
  （provider `tomato-bundled`，rank 350：优先于用户技能目录、让位于项目技能
  目录）；`plugin/link-skills.js` 在挂载时把同一份 `skills/` 软链进已存在的
  agent 技能根（优先 `~/.agents/skills`），`plugin/link-skills.mjs` 提供
  `--check`/`--remove`/`--dir`。`linkSkills: false` 或目录数组可关闭/指定。
- client 半：DSH 左侧入口、main 九页、专注 HUD 和 composer.dock 入口卡；
  UI 数据直连 `http://127.0.0.1:43987/api/state`，动作走 `/api/dispatch`，
  布置/提交/批改按钮向学习助手草稿注入稳定记录 ID。界面语言跟随 DSH locale
  （`zh`/`ja`/其余回退 `en`），文案在 `plugin/src/client/shared/copy.js` 与
  `plugin/src/client/shared/ja.js`；`plugin/locale/{en,zh,ja}.json` 是 DSH 中
  插件标题/描述的多语言元数据。
