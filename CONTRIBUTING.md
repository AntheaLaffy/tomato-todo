# 贡献指南

感谢你愿意一起做番茄 Todo。这份文档写给要改代码、跑测试、提 PR 的人；使用与安装见 [README](README.md)，产品设计取舍见 [docs/DESIGN.md](docs/DESIGN.md)。

番茄 Todo 是「DSH 插件 + 本地 runtime + 原生守卫」的 monorepo。改动任何一个部件前，先读仓库根的 [API.md](API.md)（进程间契约）与 [MIGRATION.md](MIGRATION.md)（重写方向）；改公开接口必须先在 API.md 留下变更，或给对应工作流的 lead 发消息。

## 开发环境

Node.js 22.12+ 与 pnpm；Rust stable 只在 `crates/guard/` 需要（守卫的 X11/Wayland 绑定生态只有 Rust 完整，TS 侧靠秒级测试循环）。专注保护相关测试另需独立嵌套桌面，见「测试与验证」。

```sh
pnpm install
```

## 常用命令

```sh
pnpm core:test     # packages/core 的 vitest 测试（零依赖、全量语义覆盖）
pnpm runtime:test  # runtime 的 node --test 测试
pnpm check         # core:test + runtime:test
pnpm build:runtime # esbuild 把 @tomato/core 打进 runtime 产物（随插件分发）
pnpm format        # Prettier（packages/ runtime/ plugin/ scripts tests）

cargo build --manifest-path crates/guard/Cargo.toml   # 守卫二进制
```

- runtime 启动参数、HTTP API（127.0.0.1:43987）与 guard 命令协议见 [API.md](API.md)；插件 UI 直连 runtime 只读端点，数据目录默认 `~/.local/share/studio.tomato.todo/`。
- 手册自查：`python3 scripts/check-handbook.py`（结构、页眉、出处、措辞、隐私），生成物由 `scripts/handbook-stats.py` / `handbook-tests.py` / `handbook-paths.py` / `handbook-backlog.py` 重新采集。

## worktree 约定

每条工作流一个 git worktree：core 移植、runtime、插件 UI、守卫、文档等并行工作流各占一个 worktree，互不干扰、各自提交，合并由该工作流的 lead 收口。

```sh
git worktree add ../tomato-ts-<workflow> -b tomato-ts-<workflow>
```

- 每个 worktree **只写自己工作流的文件**；需要跨工作流改文件时，先在 [API.md](API.md) 留变更或给 lead 发消息。
- 各 worktree 从同一条基线创建；lead 合并后再通读一遍改动，核对文档与契约一致。

## 架构

- **`packages/core/`**：TypeScript 领域核心——状态机、任务规则、模板印刷、诊断、统计、数据校验。零依赖、vitest 全覆盖；对外 JSON 形状 camelCase，是唯一权威实现。
- **`runtime/`**：Node runtime（`tomato-runtime`），随插件分发。用 @tomato/core 持域与数据（`plan.json` 原子写）、番茄计时与提醒调度、项目资料库授权、127.0.0.1 HTTP API（面板数据面 + `/mcp` streamable HTTP）与 `--mcp` stdio 入口。
- **`crates/guard/`**：Rust 原生守卫（`tomato-guard`）。专注保护（X11/Wayland/Windows 白名单与锁屏；niri 直接全屏 DSH）、窗口激活、通知、自启。无域无状态，由 runtime 经 HTTP 指挥。
- **`plugin/`**：DSH 插件包 `@local/tomato-dsh` 源码。host 半：15 个 `tomato_*` Host 工具（每次一次性 `tomato-runtime --mcp`，经连接文件转发到运行中实例）、随包技能提供者与跨 agent 软链；client 半：九页主视图、composer.dock 入口卡、常驻 HUD/沉浸层，数据直连 runtime。DSH 插件配置不再注册 `tomato-mcp` 客户端。
- **`desktop-integrations/`**：GNOME Shell 桥接扩展（保留原实现）。
- **`packaging/` 与 `scripts/`**：安装与发布（systemd user service / autostart、AUR 模板、安装脚本）。

文件级导航从 [CODEMAP.md](CODEMAP.md) 开始，改完结构后同步局部地图。

## 测试与验证

- **领域核心**：crates/core 的 Rust 测试逐条移植为 vitest，语义以旧测试为基准（`crates/core/src/tests.rs`、`education_tests.rs`、`template_tests.rs`），不做缩水。
- **runtime**：`node --test runtime/test/` 覆盖计划文件读写、域引擎接线、计时/提醒、HTTP API 与 MCP 契约；端到端使用独立临时数据目录，不碰用户数据。
- **守卫**：构建后用独立嵌套桌面验证——白名单放行、非白名单回焦、全屏锁定与通知。安装脚本验证同样使用临时用户目录。
- **学习助手 = DSH 对话**：验证走插件 `tomato_*` Host 工具（每次一次性 `--mcp`）与外部 MCP 两种入口，不花用户模型额度；真实账号、联网与桌面行为由你自测，写清怎么复现。

> **专注保护测试必须在独立的嵌套桌面里跑，不得在用户当前桌面自动启用保护**——它会真锁屏、真切窗口。运行前确认测试脚本自建的 niri/Xvfb 会话与你的桌面是隔离的。

## 提交与 PR

- **一个提交 = 一个可独立理解、独立评审的连贯改动**（用 `git add -p` 拆）。重构不与新功能混提，无关修复不塞进同一个提交。这样 `git bisect` 才有意义。
- **提交信息写「为什么」，不复述「做了什么」**。读过 diff 就知道改了什么；值得留下的是：什么问题或约束迫使这次改动、考虑过哪些备选、取舍与影响是什么、有哪些读者会意外的点。复杂改动用「问题 → 解决方案 → 影响」结构；说不清的动机不要编，标注未定。
- **改数据模型、文件格式或语义时**，同步更新文档、schema、示例、测试与 [CHANGELOG.md](CHANGELOG.md)。本项目以更好的设计迭代为先，**允许破坏性变更**——不为兼容旧数据、旧接口或旧文件格式牺牲设计；旧版本按需要提供一次性转换或明确拒绝。

## 文档与素材

- 学习计划格式：[docs/PLAN_FORMAT.md](docs/PLAN_FORMAT.md)；完整备份：[docs/BACKUP_FORMAT.md](docs/BACKUP_FORMAT.md)；MCP 接入：[docs/MCP.md](docs/MCP.md)。
- 读代码前的参考手册：[docs/HANDBOOK/](docs/HANDBOOK/README.md)——按域记录事实、取舍理由、机制与语义规则，**面向人读**；改哪动哪、文件与符号在哪看 [CODEMAP](CODEMAP.md)。改动某章涉及的实现后，同步那一章并跑 `python3 scripts/check-handbook.py`（结构、页眉版本、出处、对外措辞与隐私红线）；规模数字、测试索引与待补清单是生成物（`scripts/handbook-stats.py` / `handbook-tests.py` / `handbook-backlog.py`），不要手改；CI 只跑校验脚本。
- 用户提供的课表与私人备考分析放在忽略版本管理的 `artifacts/planning/`，**不要**写进默认种子、安装包或示例文件。
- 维护者技能在 [.agents/skills/](.agents/skills/README.md)：编码智能体从仓库根自动发现，覆盖导航、维护收尾、提交与文档、测试与性能、Git/Shell、智能体上下文与 CI/CD。
- **发布到 AUR**：`v*` 标签触发 Release 工作流产出 runtime+guard 的发行包后，用 `node scripts/publish-aur.mjs --push` 生成并推送 `tomato-todo-bin`。校验和由脚本从发行包**动态计算**，模板在 [packaging/aur/](packaging/aur/PKGBUILD.in)；不要把生成的 PKGBUILD 当手写文件改。

## 许可

贡献即同意以 [MIT](LICENSE) 许可发布。
