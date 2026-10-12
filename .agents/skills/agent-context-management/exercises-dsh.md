# 练习：智能体上下文管理（dsh 实操）

对应课程第 7 讲的练习，用 DeepSeek Harness（dsh）完成。通用版练习见 `exercises.md`。

1. **清空窗口**。连续问两个不相关的问题，观察第一个问题的上下文如何影响第二个的表现；开一个新会话再问第二个，对比体验——讲义「上下文越大性能越差」。
2. **回退 / 恢复 / 分叉**。dsh 的会话是 append-only 事件流，支持恢复、分叉与回放（Trajectory 视图里按来源查看模型看到的一切）。恢复一个旧会话、或把当前会话分叉（`subagent_fork` 就是让子智能体继承本会话），观察上下文从哪一点接续——对照讲义的「回退对话历史中的步骤」。
3. **压缩（compaction）**。跑一段足够长的对话，观察 dsh 的压缩何时触发、用摘要替换了什么（Trajectory 视图里按来源查看）。思考哪些信息被压缩后仍然够用、哪些丢了。
4. **AGENTS.md ↔ dsh 的 Skill 机制**。给一个项目定一条「永远该知道」的规则（如「改代码后必须跑类型检查」），用 dsh 的 skill/说明机制承载它。本仓库每个 skill 目录就是实例：SKILL.md 的 `description` 控制自动触发，`disable-model-invocation: true` 实现手动点名、零上下文成本。对照讲义里 AGENTS.md（永远整份加载）与 Skills（按需打开）的取舍。
5. **Skills 按需加载**。在一个 dsh 会话里观察：写 shell 命令时 `shell-scripting` 这类 skill 自动加载，而 `shell-basics` 需要手动点名才加载——验证「技能名 + 描述 → 按需打开」的上下文经济。
6. **子智能体**。用 dsh 的 `subagent`（独立上下文）或 `subagent_fork`（继承本会话）把「调研某个话题」外包出去，观察顶层上下文不被调研内容膨胀；调研没做完时用 `send_message` 让它继续，方向错了用 `interrupt_agent` 打断。
7. **并行与编排**。用 dsh 的 `workflow` 脚本（`pipeline` / `parallel`）把「多个文件各自独立分析」的任务并行化，对比串行逐个 subagent 的体验与耗时——对照讲义的「并行智能体 + git worktrees」。
8. **长期目标**。用 dsh 的 goal 机制（`create_goal`）挂一个跨多轮的长任务，观察它自动续跑多轮直到完成——体会「自主迭代」与「实习生需要指导」的边界在哪。
9. **MCP 与插件**。dsh 自带 mcp-client 插件（对应讲义的 MCP 协议）；而 dsh 本身「一切皆插件」——模型、工具、技能、会话、沙箱、循环、调度、UI 都由插件组合。逛 [DeepSeek Harness 官方文档](https://www.deepseek.com/harness/) 与社区插件目录，找一个插件装上试试。
10. **llms.txt**。挑一个 dsh 训练知识截止之后发布的库，先让 dsh 直接解答关于它的 API 问题（观察是否答错或编造），再把该库的文档/llms.txt 喂给它重问——对比每 token 信息密度带来的差异。

> 改编自 MIT The Missing Semester 课程 Lecture 7: Agentic Coding（讲义 + 口播稿，CC BY-NC-SA 4.0）：https://creativecommons.org/licenses/by-nc-sa/4.0/ · 课程站点：https://missing.csail.mit.edu/ · 讲座视频：https://www.youtube.com/watch?v=sTdz6PZoAnw · dsh 官方文档：https://www.deepseek.com/harness/
