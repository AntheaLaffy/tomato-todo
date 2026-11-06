# @local/tomato-dsh — 番茄 Todo 的 DeepSeek Harness 插件包

番茄 Todo 整体插件化的 DSH 插件包（v2）。源码在 tomato 仓库的 `plugin/` 目录
（与 `/home/fuurin/code/tomato-dsh` 同步分发）。

## 提供什么

- **host 半**（`index.js`）：agent 工具 `tomato_today`、`tomato_guard_status`。
  两者都经 `tomato-runtime` 的一次性子进程探询（`--mcp` 一行 JSON-RPC /
  `--guard-status` 一行 JSON），不常驻、不持有进程。
- **MCP 行**（`cordis.patch.yml` 的 `tomato-mcp` 行）：assistant 直连
  `tomato-runtime --mcp`（stdio），工具语义沿用旧 external.rs（get_context、
  create_task、complete_task 等）。
- **client 半**（`client.js`）：`conversation.composer.dock` 入口卡
  （运行时健康点 + 今日待办/投入分钟，30s 轮询，点按钮开面板）+
  `shell.overlay` 全屏四页签面板（今日专注 / 全部任务 / 统计 / 设置），
  数据直连 `http://127.0.0.1:43987`。样式全部走 `--dsw-alias-*` 主题 token，
  奶油白 `#faf8f4` + 番茄红 `#d96d55` 只作作品图形色（番茄标志、计时环、统计条形），
  深色主题下同样协调。

## 安装

1. 确保 `tomato-runtime` 已构建，并软链到 `/home/fuurin/.local/bin/tomato-runtime`
   （默认路径）。换机器时改 `cordis.patch.yml` 两处路径：`tomato-mcp` 行的
   `command` 与 `tomato-dsh` 行的 `config.tomatoBin`。
2. 用 DSH 的 `plugin_manager` → `install_bundle` 安装本目录（绝对路径）。
   补丁会插入 `tomato-mcp` 行与 `@local/tomato-dsh` 插件行。
3. 面板 UI 需要 runtime 的 HTTP 服务在运行（见下）；host 工具与 MCP 用
   一次性子进程，也需要 runtime 可执行（失败时按返回文案引导用户）。

## 运行时要求

- **`tomato-runtime --serve` 必须在运行**（监听 127.0.0.1:43987），否则入口卡
  显示离线、面板只显示连接错误。启动方式：`tomato-runtime --serve`
  （systemd user service / autostart 由 packaging 阶段安装）。
- **guard（tomato-guard）可选**：未接入时设置页显示「未接入 guard」、
  专注锁定不可用；`tomato_guard_status` 工具如实报告 `guard.available`。
- 插件本身不负责拉起或保活 runtime（安装/打包脚本负责常驻）。

## 依赖的 runtime 契约

### host 工具契约

- `tomato-runtime --mcp`（stdio）：newline-delimited JSON-RPC。host 每次调用
  发送一行 `tools/call` 请求、stdin 关闭后进程退出，回复取 stdout 最后一行
  JSON。`result.isError` 或 `reply.error` 视为拒绝。
- `tomato-runtime --guard-status`（一次性，无 stdin）：stdout 打印**一行** JSON
  后退出（有回复时 exit 0）：

  ```json
  {"ok":true,"guard":{"available":true,"backend":"x11","locked":false,"whitelist":[],"pid":1234}}
  {"ok":false,"error":"..."}
  ```

  非零退出或无输出 = runtime 本身不可达。

### client UI 契约（面板直连 127.0.0.1:43987，全部容忍式读取）

| 端点 | 用途 | 形状（以 runtime 工作流为准，此处为 UI 假设） |
| --- | --- | --- |
| `GET /health` | 设置页 | `{ ok, service, version, dataDir, guard:{available,backend,message?,locked,whitelist,pid} \| null }` |
| `GET /api/today` | 今日专注页 | `{ today, dueCount, focusMinutes, tasks:[{id,title,completed,dueDate?,reminderTime?}], timer:{status:'running'\|'paused'\|'idle', mode, remainingSeconds, totalSeconds, cycle?} }` |
| `GET /api/stats` | 统计页 | `{ todaySeconds, todayPomodoros, todayCompleted, streakDays, totalSeconds, days:[{date,seconds}×7] }` |
| `POST /api/focus/start` `/pause` `/stop` | 计时控制（骨架） | 体 `{}` |
| `POST /api/tasks` | 新建任务 | 体 `{ title }` |
| `POST /api/tasks/:id/complete` | 勾选完成 | 体 `{}` |

字段形状由 runtime 工作流定稿；client 侧所有 normalizer 都是容忍式收窄
（多字段名回退），形状微调不会破坏 UI。写端点走 runtime 的 Origin 白名单，
UI 之外的写操作走 MCP。

## 开发

- `client.js` 是**构建产物**：源码在 `src/client/`（`skin/` 皮肤、`app/` 框架与常驻
  组件、`pages/` 九个页面、`shared/` 组件库与数据层），由 `pnpm build:client`
  （esbuild）打成单入口 IIFE。**不要手改 client.js**。
- 自检：`pnpm check:client`（构建 + 无浏览器冒烟：假 DOM + 真 React 渲染全部 slot）；
  `node --check plugin/client.js plugin/index.js`；locale/package JSON 合法；
  `exports` 与 `files` 一一对应。
- 视觉与交互规范见 [docs/SKIN.md](../docs/SKIN.md)，功能面见
  [docs/LEGACY_FEATURES.md](../docs/LEGACY_FEATURES.md)。

## 已知局限

- 面板交互尚未在真实 DSH 里做视觉验收（本阶段以组装与语法复验为准）。
- `/api/today`、`/api/stats`、`/health` 的字段形状待 runtime 工作流定稿后核对。
