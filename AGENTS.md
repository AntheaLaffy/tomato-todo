## 项目速览与入口

番茄 Todo 是 DSH 插件（@local/tomato-dsh）+ TypeScript 领域核心（packages/core）+ 随包 Node runtime + Rust 原生守卫（crates/guard）的专注工具；学习助手的界面与能力完全由 DSH 对话提供。工作从 [CODEMAP.md](CODEMAP.md) 开始：先匹配任务指南的 Target，再沿 Domain 与子目录地图定向读取。

| 需要什么 | 去哪里 |
| --- | --- |
| 人用的贡献说明：环境、命令、架构、提交流程 | [CONTRIBUTING.md](CONTRIBUTING.md) |
| 客户端改动：构建与无浏览器冒烟 | `pnpm build:client`、`pnpm check:client`（源码在 `plugin/src/client/`，`plugin/client.js` 是产物） |
| 产品设计取舍：任务/习惯/项目/愿景、模板印刷 | [docs/DESIGN.md](docs/DESIGN.md) |
| 进程间契约：入口、HTTP API、MCP 工具、guard 命令 | [API.md](API.md) |
| 把 tomato-runtime 的 MCP 接入任意客户端 | [docs/MCP.md](docs/MCP.md) |
| 读代码前的参考手册：事实、取舍理由、机制说明、语义规则与不变量、边界 | [docs/HANDBOOK/](docs/HANDBOOK/README.md)（找文件与阅读顺序看附录 [04-导航对照](docs/HANDBOOK/04-导航对照.md) 或 CODEMAP；自查：`python3 scripts/check-handbook.py`） |
| 界面与皮肤规范：配色、氛围、九页布局、DSH 集成点 | [docs/SKIN.md](docs/SKIN.md) |
| 计划 / 备份文件字段 | [docs/PLAN_FORMAT.md](docs/PLAN_FORMAT.md)、[docs/BACKUP_FORMAT.md](docs/BACKUP_FORMAT.md) |

## 维护者技能（.agents/skills/）

仓库自带 22 个维护者技能，编码智能体从仓库根自动发现。按 `description` 自动匹配，或用 `/skill:<name>` 强制加载。与项目协议直接相关的几个：

| 技能 | 什么时候加载 |
| --- | --- |
| `codemap` | 定位代码、生成或刷新 CODEMAP.md 之前——导航协议的基础 |
| `project-maintenance` | 收尾一次改动：同步地图、退役被替代实现、验证当前契约 |
| `writing-for-readers` | 写提交信息、注释、README 或 PR 描述之前 |
| `testing` | 写测试、提覆盖率、选测试策略 |
| `ci-cd` | 改 `.github/workflows`、发布流程、命令入口 |

其余为通用开发技能（debugging、profiling、performance-gradient-optimization、code-review、code-quality-tooling、git-cli、git-data-model、regex、shell-scripting/-conventions/-data-wrangling/-job-control、agent-context-management、agentic-coding、dev-environment、contributing-upstream、versioning-reproducibility），完整清单与许可见 [.agents/skills/README.md](.agents/skills/README.md)。

技能与本文或 [CODEMAP.md](CODEMAP.md) 冲突时，以本文和 CODEMAP 为准。

## CODEMAP Navigation Protocol

Mode: maintenance. 从 [CODEMAP.md](CODEMAP.md) 开始导航。

- 先匹配任务指南中的 Target；仅在任务相关或接口影响明确时读 Also Check。
- 无匹配时沿 Domain 和子目录地图定位；大文件使用 `.analysis.md` 的功能索引。
- 修改公开接口时核对 TS 核心（packages/core）、runtime（runtime/）与插件（plugin/）的消费方，以及 crates/guard 的命令协议。
- 批量读取独立目标，核对过期路径与行号；新增、删除和改动后同步局部地图。
- 地图范围遵循根 Scope and Exclusions；每个纳入的文件或目录只有一个局部所有者。
- 专注保护测试必须使用独立嵌套桌面，不得在用户当前桌面自动启用保护。
- 不把私人课表、备考资料或测试数据库写入默认种子和安装包。
- 个人学习计划、课表与作息在 `/home/fuurin/study/考研时间规划/`（不入库）；规划学习任务前先读该目录的 `我的情况-给智能体.md` 与 `课表补充-时间说明.md`。
- **允许破坏性变更**：本项目以更好的设计迭代为先，不为兼容旧数据、旧接口或旧文件格式牺牲设计。改数据模型、文件格式或语义时，同步更新文档、schema、示例、测试与 `CHANGELOG`；旧版本按需要提供一次性转换或明确拒绝。

## 助手与 MCP 实现规范

学习助手的界面与能力完全在 DSH 侧；本仓库只提供接口：runtime 的 MCP 工具（stdio `--mcp` 与 `/mcp` streamable HTTP）是 DSH 对话与软件的桥。语义以 [API.md](API.md) 与 [docs/MCP.md](docs/MCP.md) 为准，实现时遵守：

- **不给长任务设人为上限**：工具调用跑到完成，只有传输层/调用方超时才结束；不要加 wall-clock 截止、轮次上限这类"保险"。
- **错误按 MCP 语义报告**：工具失败返回 `isError: true` 与可读信息，不把用户停止等正常中止描述成故障。
- **保护规则不可绕开**：工具必须走 @tomato/core 的校验与保护规则（严格模式、来源与文件校验），不能通过 MCP 紧急解锁或伪造专注记录。
- **验证走本地**：`node --test runtime/test/`、`pnpm --filter @tomato/core test`；真实桌面行为（guard 锁定）只在隔离嵌套桌面由用户自测，写清怎么复现。
