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
   - [runtime-port 进度 2026-11-06] 骨架已落地（分支 tomato-ts-runtime，工作树
     .agents/worktrees/tomato-ts-runtime）：`runtime/bin/tomato-runtime`（--serve/--mcp/--data）、
     `runtime/src/types.ts`（旧 src/types.ts 形状 + education 桩）、`runtime/src/engine.ts`
     （内存引擎桩：plan.json 原子写 + state.json 防抖原子写、任务增删改查/完成/move、
     番茄状态机 start/pause/resume/stop/discard、tick 每秒只更新内存、提醒到点标记桩、
     当日快照/今日/统计、export_plan/export_backup 到 dataDir/exports/）、HTTP API
     （/health、/api/snapshot|today|stats 只读 CORS 127.0.0.1:3080；写端点同 Origin 白名单；
     /mcp streamable HTTP 桩：Bearer token 认证、拒 Origin、initialize/ping/tools/list/tools/call）、
     --mcp stdio 转发桥（读 agent/connection.json 的 mcpUrl+token，未运行报中文错误）、
     `runtime/src/guard-client.ts`（127.0.0.1:43988，未跑时优雅返回）、
     `runtime/scripts/bundle-core.mjs`（esbuild 打包 @tomato/core 的 TODO 脚本）。
     测试 `node --test`（runtime/ 内）38 条全绿；Node 24 原生 TS 剥离直接跑 .ts。
   - [偏离] `node --test runtime/test/` 在 Node 24 不接受裸目录参数，脚本用 `node --test`
     （默认发现 test/*.test.mjs）。
   - [偏离] 数据布局为 plan.json（计划 v6，tasks 携带运行进度字段）+ state.json
     （settings/timer/sessions/visions/lock/education）；engine 桩接口方法级干净，
     @tomato/core 落地后由 lead 整体替换 engine.ts 实现、types.ts 换权威类型。
   - [遗留] 提醒调度仅「到点把 reminderFired 写进任务/快照」桩；SSE（/mcp GET）未实现；
     export_backup 为桩形状（format/version/exportedAt/plan/state），备份 v4 全量字段待 core；
     MCP 工具按任务书先实现 get_context/create_task/update_task/move_tasks/complete_task/
     dispatch/export_plan/export_backup 8 个，其余（get_control_status 等）等 core 后补。
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
- 已收尾：与 runtime 契约核对完成（/health.guard、/api/today dueCount/focusMinutes
  已对齐）；真实 DSH 安装验证通过——host 工具注册、composer.dock 与 shell.overlay
  双槽位 active（client 半 `timer` inject 已补）；guard 锁定状态展示待真实硬件验证。

## 阶段 4 记录（guard 守护进程，tomato-ts-guard）

移植完成：`crates/guard` 独立二进制 tomato-guard（无域无状态，HTTP 指挥），
全部后端自旧 crates/core 的 guard_*.rs 移植，接口统一为 `Window{id,app_id,title,pid,is_focused}`
+ `windows()/focus(id)/lock_window()` + `Result<_, String>`：

- **X11**（x11.rs）：EWMH 只读枚举 + _NET_ACTIVE_WINDOW 激活 + 自建全屏锁窗（番茄红、
  WM_CLASS "tomato-guard"/_NET_WM_PID，RAII 销毁）。
- **Wayland**（wayland.rs + wayland_surface.rs + shell.rs）：niri/Sway/Hyprland 走各自 IPC
  socket；GNOME 走 desktop-integrations 的 Shell 扩展 studio.tomato.Guard1（保持原接口）；
  KWin 走 /Scripting 脚本 + 唯一回调；其余 Wayland 桌面明确报不支持，绝不把 Xwayland
  当完整保护。锁窗统一为 guard 自建的 xdg_toplevel 全屏锁面（memfd shm、番茄红、无输入
  抓取，初始化失败经 mpsc 握手同步回报，3s 超时）。
- **Windows**（win32.rs）：旧 guard_windows 全量 + WS_POPUP 全屏锁窗（UWP AUMID/Wine
  回退、ApplicationFrameHost 子进程识别、ALT 激活技巧保留）。
- **macOS**（macos.rs，tomato-ts-guard-mac 合入）：Quartz 列举 + Accessibility 激活（仅限
  本进程）；guard 无宿主窗口，锁机不可用、专注保护降级白名单模式。

HTTP 契约（API.md 已同步）：`GET /guard/status` 增 `backend` 字段（实际后端名）。
白名单语义照旧：own pid 永远放行，其余按 app_id 精确匹配，600ms enforce tick。

验证：Linux `cargo build` + `cargo test` 22 全绿；`cargo check --target x86_64-pc-windows-gnu`
与 macos.rs 对 aarch64-apple-darwin 的编译检查零告警；Xvfb+openbox 隔离桌面冒烟通过
（lock 200 → 全屏锁窗入 _NET_CLIENT_LIST → re-lock 替换白名单 → notify/401/unlock 全对，
未触碰用户桌面）。留待收尾：真实硬件上的 Wayland/Windows/macOS 运行验证、GNOME 扩展
随包安装、systemd user service / 自启（阶段 5 打包）。

## 阶段 5 记录（收尾，tomato-ts-rewrite 集成线）

- 旧栈删除：agent/、crates/{agent,preview,core}、旧 src/、src-tauri/、旧 tests/、
  根 Cargo.toml/Cargo.lock、tsconfig/vite/index.html、assets 旧截图、旧脚本
  （install.py/build-agent.mjs/dev.mjs/agent-runtime.mjs/check-android-apk.py）。
- 根 CODEMAP.md 按新结构重写；docs/CROSS_PLATFORM.md 改写为 guard 后端矩阵；
  根 AGENTS.md 换为插件架构与「助手与 MCP 实现规范」。
- scripts/handbook-paths.py 删除 18/19/26 死条目，04 附录重建，check-handbook 通过。
- 根 package.json：移除旧 UI 依赖、版本 0.13.0、runtime:test 修正为
  `cd runtime && node --test`、pnpm-lock 重新生成。
- 集成验证：core 109/109 + tsc 全绿；runtime 60/60；工具脚本 18/18；guard 22/22；
  插件 v2 已在 DSH 上线（host 双工具 + 双槽位 active）。

## 上线步骤（用户侧）

1. 关闭旧版番茄 Todo；跑 `node scripts/export-sqlite.mjs`（一次性迁移出 plan.json/backup-v4.json）。
2. `node scripts/install.mjs`（装 runtime+guard 到 ~/.local/lib/tomato/ 并启用 systemd user service）。
3. DSH 里刷新页面：入口卡出现，面板数据自动接通；对话直接说「看看我今天的安排」即可。

## 语言问题结论（已与用户确认）

- 原生只留 crates/guard 一个 Rust 小二进制（guard 的 X11/Wayland 绑定生态只有 Rust 完整）。
- 不用 Zig/Go；开发速度来自 TS 侧秒级测试循环，guard 稳定后几乎不重编。
- 壳开发期可开 incremental + mold（如需），但壳很小，已不重要。
