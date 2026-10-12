## 项目速览与入口

番茄 Todo 是 Rust + Tauri + TypeScript 的 Linux 桌面专注工具，附带随包的 Pi SDK 学习助手。工作从 [CODEMAP.md](CODEMAP.md) 开始：先匹配任务指南的 Target，再沿 Domain 与子目录地图定向读取。

| 需要什么 | 去哪里 |
| --- | --- |
| 人用的贡献说明：环境、命令、架构、提交流程 | [CONTRIBUTING.md](CONTRIBUTING.md) |
| 产品设计取舍：任务/目标/习惯/项目/愿景、模板印刷 | [docs/DESIGN.md](docs/DESIGN.md) |
| 主线与节点的完整语义 | [docs/NODE_DESIGN.md](docs/NODE_DESIGN.md) |
| 学习助手的后端、权限、唤醒与 MCP | [docs/AGENT.md](docs/AGENT.md) |
| 计划 / 备份文件字段 | [docs/PLAN_FORMAT.md](docs/PLAN_FORMAT.md)、[docs/BACKUP_FORMAT.md](docs/BACKUP_FORMAT.md) |

## 维护者技能（.agents/skills/）

仓库自带 22 个维护者技能，编码智能体从仓库根自动发现；与应用随包的 `agent/skills/`（给用户桌上的学习助手）无关。按 `description` 自动匹配，或用 `/skill:<name>` 强制加载。与项目协议直接相关的几个：

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
- 修改公开接口时核对 Rust 核心、桌面/预览适配层和 TypeScript 消费方。
- 批量读取独立目标，核对过期路径与行号；新增、删除和改动后同步局部地图。
- 地图范围遵循根 Scope and Exclusions；每个纳入的文件或目录只有一个局部所有者。
- 专注保护测试必须使用独立嵌套桌面，不得在用户当前桌面自动启用保护。
- 不把私人课表、备考资料或测试数据库写入默认种子和安装包。
- 个人学习计划、课表与作息在 `/home/fuurin/study/考研时间规划/`（不入库）；规划学习任务前先读该目录的 `我的情况-给智能体.md` 与 `课表补充-时间说明.md`。
- **允许破坏性变更**：本项目以更好的设计迭代为先，不为兼容旧数据、旧接口或旧文件格式牺牲设计。改数据模型、文件格式或语义时，同步更新文档、schema、示例、测试与 `CHANGELOG`；旧版本按需要提供一次性转换或明确拒绝。

## Agent 与学习助手实现规范

助手运行时就是随包的 Pi SDK（上游源码在 `agent/node_modules/@earendil-works/pi-coding-agent/dist`，`agent/*.mjs` 是应用侧的薄封装）。这里的规矩是**照抄成熟实现，不自作聪明**：要加行为先看 Pi（`runPrintMode`、`agent-session`）和 Codex 怎么做，跟着它们的语义走，别发明自己的调度层、保险丝或重试策略。

- **不给长任务设人为上限**：一轮请求跑到完成，只有用户停止、供应商报错或 SDK 自身策略才结束。不要加 wall-clock 截止、轮次上限这类"保险"——它们分辨不出"正常的长任务"和"跑飞"，只会把前者掐断。沙箱终端同样保持 Pi 的语义：默认不超时，只有模型显式传 `timeout` 才限时；输出过多只截断呈现，不杀命令。
- **停止是停止，不是故障**：SDK 会把落在工具执行中的 cancel 报成 `stopReason: error` + abort 文案（见 `agent/worker.mjs` 的 `cancelRequested`），界面要按「已停止」呈现，不要把用户自己按的停止显示成操作失败。
- **按上游的方式报告结果**：单次运行照 Pi 的 `runPrintMode`——`error`/`aborted` 才算失败，其余按 `getLastAssistantText()` 汇报。
- **改动小而对齐**：`agent/*.mjs` 不在 `pnpm format` 范围内（保持既有紧凑风格），改哪一行就只动哪一行，不要顺手格式化整文件、也不要为了"顺手"重构。
- **验证走本地**：`node --test tests/agent.mjs` 用本机 mock 模型覆盖真实 SDK 的流式工具调用与会话恢复，不花用户额度；真实账号、联网与桌面行为由用户自测，写清怎么复现。
