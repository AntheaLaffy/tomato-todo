# 维护者技能（`.agents/skills/`）

这里的技能是给**在一个 checkout 里维护本项目的人（或编码智能体）**用的，不是应用随包的学习助手技能。后者的位置是 [`agent/skills/`](../../agent/skills/)，两者互不相干：`agent/skills/` 会打进运行包交给用户桌上的助手，这里只在开发/维护仓库时被编码智能体发现。

## 为什么放在仓库里

Pi（以及兼容 Agent Skills 规范的工具）会从工作目录向仓库根扫描 `.agents/skills/`。把它们提交进仓库，任何机器、任何协作者 clone 下来就自带这套开发工作流，不必依赖某个人 `~/.agents/skills/` 里的全局副本。内容随项目一起评审、升级、追责。

## 包含哪些

编码智能体按 frontmatter 的 `description` 自动路由；下表按用途分组，列出这个仓库里对应的活动。

### 导航与维护

| 技能 | 用途 |
| --- | --- |
| `codemap` | 分层代码导航地图（`CODEMAP.md` / `*.analysis.md`）的生成与刷新；本项目所有维护任务都从这里开始 |
| `project-maintenance` | 把「维护」当成本次改动的完成条件：同步受影响的地图、退役被替代实现与资源、验证当前契约 |

### 提交、评审与文档

| 技能 | 用途 |
| --- | --- |
| `writing-for-readers` | why-not-what：注释、README、提交信息只记录「为什么」 |
| `code-review` | 评审 PR / diff：给可操作建议、区分阻断与建议、解释为什么 |
| `contributing-upstream` | 向上游（Pi SDK、Codex）报 bug、提 PR、写最小复现 |
| `versioning-reproducibility` | 版本号、发布标签与可复现构建的一致性 |

### 测试与性能

| 技能 | 用途 |
| --- | --- |
| `testing` | 单元/集成/回归/性质测试、覆盖率与 mock 外部依赖的取舍 |
| `debugging` | 崩溃、段错误、内存错误、偶发失败与竞态的排查阶梯 |
| `profiling` | time 三值、资源监控、CPU/内存 profiler、hyperfine 基准 |
| `performance-gradient-optimization` | 用受控实验优化延迟/吞吐/内存，并为 1.0 的性能验收校准模型 |
| `code-quality-tooling` | 格式化器、linter 规则、semgrep 自定义规则 |

### Git、Shell 与文本

| 技能 | 用途 |
| --- | --- |
| `git-cli` | 提交、分支、合并、撤销、blame/bisect、worktree |
| `git-data-model` | 理解对象、引用与提交图，处理非日常的 Git 操作 |
| `regex` | 正则的写法与陷阱 |
| `shell-scripting` | `scripts/*.mjs`、`install.py`、`dev.mjs` 等脚本语言基础 |
| `shell-conventions` | 脚本的引号、退出码与可移植约定 |
| `shell-data-wrangling` | 用管道/awk/jq 把日志、CSV、文件列表加工成答案 |
| `shell-job-control` | 前后台、信号、`trap` 清理、等待与杀进程 |

### 智能体与上下文

| 技能 | 用途 |
| --- | --- |
| `agent-context-management` | 本项目的 `AGENTS.md`、Skills、MCP、子智能体与上下文管理本身 |
| `agentic-coding` | 用编码智能体实现/修复/重构/审查/理解代码的方法与反馈循环 |
| `dev-environment` | 语言服务器、补全、编辑器扩展与远程开发 |

### CI/CD

| 技能 | 用途 |
| --- | --- |
| `ci-cd` | pre-commit、GitHub Actions（push/PR/定时、矩阵、状态徽章）、发布与命令运行器 |

## 许可

- `codemap`：MIT（Copyright © 2026 htdxd），随附 `codemap/LICENSE`。
- `project-maintenance`、`performance-gradient-optimization`：随原目录收录，未附独立许可声明。
- 其余技能改编自 MIT《The Missing Semester》（CC BY-NC-SA 4.0），与应用自身的 MIT 不同；如需纯 MIT 分发，替换为自写版本。

## 未收录

系统里其余技能与本项目无关或重合，未纳入：`dotfiles`、`tmux`、`vim-editing`、`ssh-remote`、`python-packaging`、`containers-deployment`、`ai-etiquette`、`asking-good-questions`、`learn-missing-semester`，以及非开发向的 `fframes-video`。需要哪个再说。`project-maintenance` 原目录里一份 375KB 的历史会话转储（`project.md`）不属于技能本身，未收录。
