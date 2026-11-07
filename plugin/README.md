# dsh-plugin-tomato-todo — 番茄 Todo 的 DeepSeek Harness 插件包

番茄 Todo 整体插件化的 DSH 插件包。源码就在本仓库的 `plugin/` 目录，版本随仓库
（根 `package.json` 与 CHANGELOG 的 `0.x`）一起走；不再对应独立的 tomato-dsh 仓库。

## 提供什么

- **host 半**（`index.js`）：首选的 `tomato_*` Agent 工具覆盖 runtime 的全部
  13 个 MCP 操作；另有 `tomato_today` 与 `tomato_guard_status`。每次经
  `tomato-runtime --mcp` 的一次性子进程调用同一运行实例，独立于 DSH 的 MCP
  客户端连接。工具 schema 来自 `runtime/src/tools.mjs`，由
  `scripts/build-host-tools.mjs` 生成 `host-tool-specs.js`。
- **runtime MCP**：`tomato-runtime --mcp` 仍可供 Codex 等独立客户端接入；
  DSH 插件配置不额外启动 `tomato-mcp` 客户端。
- **client 半**（`client.js`）：DSH 左侧导航、主区域九页、专注 HUD 与输入框
  入口卡。数据面直连运行时 `GET /api/state`、`POST /api/dispatch`，与 DSH
  语言同步支持中文、英语、日语。作业操作会把稳定记录 ID 与请求写入学习助手草稿。
- **内置技能**（`skills/` + `skills.js`）：`tomato-todo`、`exam-teaching`、
  `exam-authoring`、`study-planning`、`study-diagnosis`、`study-memory` 随包发布。
  插件挂载时 `skills.js` 把它们注册成 DSH 技能提供者（rank 350：高于用户目录、
  低于项目目录），**插件更新即技能更新**，用户不用另外安装或同步一套技能。
  `references/local-context.md` 与 `references/local-library.md` 是本机导航，
  已 gitignore，不随包分发。
- **跨 agent 链接**（`link-skills.js`）：插件挂载时把 `skills/` 软链进已经存在的
  agent 技能目录（优先 `~/.agents/skills` 这个共享根，没有就退到
  `~/.codex`、`~/.claude`、`~/.gemini`、opencode），所以 Codex / Claude Code 读到的
  也是同一份文件，插件更新后一起更新。只建符号链接，绝不删真实目录或文件。

## 安装

1. 确保 `tomato-runtime` 已构建，并软链到 `/home/fuurin/.local/bin/tomato-runtime`
   （默认路径）。换机器时改 `cordis.patch.yml` 的 `config.tomatoBin`。
2. 用 DSH 的 `plugin_manager` → `install_bundle` 安装本目录（绝对路径）。
   补丁会插入 `dsh-plugin-tomato-todo` 插件行。更新 Host 工具后
   重启 DSH Web 服务，让现有进程重新注册工具。
3. 其他 agent 的技能目录**不用手动处理**：插件挂载时会自动软链（见上）。
   想指定目录或先看看结果，再用命令：

   ```bash
   node link-skills.mjs --dir ~/.codex/skills   # 指定目录
   node link-skills.mjs --check                 # 只检查，缺失/过期退出码 1
   node link-skills.mjs --remove                # 撤销本包创建的链接
   ```

   不想要自动链接就在补丁里设 `linkSkills: false`（或给一个目录数组）。

4. 面板 UI 需要 runtime 的 HTTP 服务在运行（见下）；host 工具与 MCP 用
   一次性子进程，也需要 runtime 可执行（失败时按返回文案引导用户）。

## 运行时要求

- **`tomato-runtime --serve` 必须在运行**（监听 127.0.0.1:43987），否则入口卡
  显示离线、面板只显示连接错误。启动方式：`tomato-runtime --serve`
  （systemd user service / autostart 由 packaging 阶段安装）。
- **guard（tomato-guard）可选**：未接入时设置页显示「未接入 guard」、
  专注锁定不可用；`tomato_guard_status` 工具如实报告 `guard.available`。
- 插件本身不负责拉起或保活 runtime（安装/打包脚本负责常驻）。若 MCP 客户端
  提示 disconnected，先用插件的 `tomato_get_context` 或 `tomato_get_education`
  核对数据，不让学习助手要求用户手工转录作业。

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

### client UI 契约

九页界面从 `GET /api/state` 读取全量快照，用 `POST /api/dispatch` 提交
`@tomato/core` Action；健康状态使用 `GET /health`。浏览器操作与 Agent
工具都落到同一个运行时及其校验规则。

## 开发

- `client.js` 是**构建产物**：源码在 `src/client/`（`skin/` 皮肤、`app/` 框架与常驻
  组件、`pages/` 九个页面、`shared/` 组件库与数据层），由 `pnpm build:client`
  （esbuild）打成单入口 IIFE。**不要手改 client.js**。
- 自检：`pnpm check:host-tools`（Host schema 与 runtime 一致）、
  `LIVE_TOMATO=1 node --test scripts/plugin-host.test.mjs`（当前运行实例只读冒烟）、
  `pnpm check:client`（构建 + 无浏览器冒烟）；
  `node --check plugin/client.js plugin/index.js`；locale/package JSON 合法；
  `exports` 与 `files` 一一对应。
- 视觉与交互规范见 [docs/SKIN.md](../docs/SKIN.md)，功能面见
  [docs/LEGACY_FEATURES.md](../docs/LEGACY_FEATURES.md)。

## 已知局限

- Host 工具要求正在运行的 runtime；它消除 MCP 客户端断线依赖，不在 runtime
  关闭时伪造操作成功。
