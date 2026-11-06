# 番茄 Todo → DSH 插件重写（最终方向：全插件化）

分支：`tomato-ts-rewrite`。目标：番茄 Todo 整体变成 DeepSeek Harness 的插件
`@local/tomato-dsh`；学习助手的界面与能力 100% 交给 DSH；UI 在 DSH 内重做
（沿用奶油白 + 番茄红设计语言），原生只留浏览器做不到的专注保护、通知与托盘。

## 用户决策记录

- 2026-11-06 第一版：Pi 学习助手不好用 → 先把 todo 做成 DSH 插件。
- 2026-11-06 定稿 1：不兼容旧协议；方向 B（分阶段 TS 化，原生只留守护进程）；
  保留原软件 UI 页面、删除全部 agent 相关内容。
- 2026-11-06 定稿 2（最终）：**不再保留桌面 UI，整体作为插件集成进 DSH**；
  UI 怎么设计由实现者决定，要求是好看。旧 Tauri UI 与旧壳删除。

## 目标架构

```
packages/core/      TS 领域核心（crates/core 语义移植，core-port 负责）
                    —— 零依赖、vitest 全覆盖、外部 JSON 形状保持 camelCase
runtime/            tomato-runtime（Node，随插件分发，由插件 host 经 subprocess 拉起）
                    —— 用 @tomato/core 持域与数据（计划 JSON 文件，原子写）
                    —— 番茄计时/提醒调度
                    —— 127.0.0.1 固定端口 HTTP API：
                       * GET /api/snapshot 等只读端点：允许 DSH origin（127.0.0.1:3080）跨域，供插件 UI
                       * POST 写操作：Origin 白名单（浏览器侧不做鉴权之外的写）
                       * /mcp：标准 Streamable HTTP，token 认证，拒绝浏览器 Origin
                    —— --mcp stdio 入口：spawn 即代理到 /mcp（供 DSH MCP 行使用）
crates/guard/       tomato-guard（Rust，小）：专注保护（X11/Wayland/Windows 白名单与锁屏）、
                    通知、托盘、自启。无域无状态，由 runtime 经 HTTP 指挥。
desktop-integrations/  GNOME Shell 桥接扩展（保留原实现）
plugin/             DSH 插件包 @local/tomato-dsh 的源码（与 /home/fuurin/code/tomato-dsh 同步）
                    —— host 半：MCP 行（stdio → runtime --mcp）、tomato_today 等工具、
                      通过 subprocess 常驻 runtime 子进程、UI 数据的宿主代理
                    —— client 半：composer.dock 入口卡片 + shell.overlay 全屏面板
                      （今日专注 / 全部任务 / 统计 / 设置），数据直连 runtime 只读 API
packaging/ scripts/ 安装与发布：runtime+guard 的自启（systemd user service / autostart）、
                    AUR 模板、install.py 改写
（删除）agent/ crates/agent crates/preview src/ src-tauri/
        docs/AGENT.md docs/MCP.md tests/agent*.mjs 等助手与旧壳相关文件
```

存储：计划 JSON 文件为唯一数据源（沿用 docs/PLAN_FORMAT.md 与 BACKUP_FORMAT.md 的字段语义，
schema 以 @tomato/core 新实现为准）；旧 sqlite 提供一次性导出脚本。

DSH MCP 行契约（/home/fuurin/code/tomato-dsh 的 cordis.patch.yml）：
`command: <runtime>/bin/tomato-runtime`、`args: ['--mcp']`，stdio、newline-delimited JSON-RPC；
工具名沿用 create_task/update_task/complete_task/dispatch/get_context 等语义（见旧
crates/agent/src/external.rs 的工具清单，语义保留、实现全部重写）。

## 阶段

1. **core 移植**（packages/core）：crates/core 全量语义移植 + Rust 测试逐条移植为 vitest。
   （core-port 进行中；基准：crates/core/src/tests.rs、education_tests.rs、template_tests.rs。）
2. **runtime**：计划文件读写、域引擎接线、计时/提醒、HTTP API + /mcp + --mcp 入口；
   用 esbuild 把 @tomato/core 打进 runtime 产物（零外部依赖，随插件分发）。
3. **插件 UI**：composer.dock 卡片 → shell.overlay 面板（今日专注/任务/统计/设置），
   主题 token + 奶油白/番茄红设计；直连 runtime 只读 API。
4. **guard 守护进程**：crates/guard（guard_*.rs 移植为独立二进制），runtime 指挥；
   systemd/自启安装。
5. **收尾**：删除旧 agent/Tauri 栈；文档（README/CONTRIBUTING/CODEMAP/HANDBOOK）同步；
   CI 与打包脚本更新；sqlite 导出脚本。

### 阶段 3 进度（tomato-ts-plugin 分支，2026-11-07）

- `plugin/` 骨架已入库：package.json（@local/tomato-dsh v2）、cordis.patch.yml
  （tomato-mcp MCP 行 + 插件行）、host index.js（tomato_today / tomato_guard_status
  工具，经 `tomato-runtime --mcp` / `--guard-status` 一次性子进程探询，不常驻）、
  client.js 单入口（composer.dock 入口卡 + shell.overlay 四页签面板）、
  locale、icon、README。
- 四页签完成：FocusTab（番茄计时环 UI，GET /api/today 3s 轮询，POST
  /api/focus/start|pause|stop 骨架）、TasksTab（任务列表 + 完成勾选 POST
  /api/tasks/:id/complete + 新建 POST /api/tasks）、StatsTab（五张数字卡 + 近七天
  条形图，GET /api/stats）、SettingsTab（GET /health 只读展示 runtime/guard/dataDir）。
  全部 React.createElement、样式走 `--dsw-alias-*` token、奶油白/番茄红仅作作品
  图形色，中英双语文案。
- 页签由两个并行 worktree 的部件源（plugin/src-client/tabs-a.js、tabs-b.js）拼进
  client.js 单入口；拼接契约见 plugin/src-client/README.md，src-client 不随包分发。
- 待办：与 runtime 工作流核对 /api/today、/api/stats、/health 字段形状（client 侧
  已做容忍式收窄）；在真实 DSH 里做面板视觉验收；guard 可用后核对锁定状态展示。

## 语言问题结论（已与用户确认）

- 原生只留 crates/guard 一个 Rust 小二进制（guard 的 X11/Wayland 绑定生态只有 Rust 完整）。
- 不用 Zig/Go；开发速度来自 TS 侧秒级测试循环，guard 稳定后几乎不重编。
- 壳开发期可开 incremental + mold（如需），但壳很小，已不重要。
