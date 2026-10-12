---
name: agent-context-management
description: >
  智能体上下文与编排：清空/回退/压缩上下文、llms.txt、AGENTS.md/CLAUDE.md、Skills 按需加载、
  子智能体、并行智能体与 git worktrees、MCP。Use when the user asks to write an AGENTS.md or
  CLAUDE.md, create a skill or subagent, or manage agent context. 触发于「写 AGENTS.md/建 skill/子智能体/管上下文/MCP」。
---

# 智能体上下文管理

主线：LLM 上下文窗口有限，且上下文越大性能往往越差（即使没溢出）。框架会自动提供并管理一部分上下文，但大头在你：给智能体它需要的、砍掉不需要的。Skills、子智能体这些机制本质都是「上下文经济」——本仓库本身就是一组 skills 的实践。

## 上下文六件套

- **清空窗口**：不相关的查询开新对话——最基本的控制。
- **回退**：撤销对话历史里的步骤；有时比发消息引导转向更省上下文。
- **压缩（compaction）**：对话过长时自动用 LLM 总结前半段、以摘要替换；部分工具可手动触发。
- **llms.txt**：给 LLM 读的文档标准（如 cursor.com/llms.txt、ai.pydantic.dev/llms.txt）——每 token 信息密度远高于抓 HTML；依赖在模型知识截止日期之后发布时尤其有用。
- **AGENTS.md**：智能体启动时整份预填进上下文的说明文件（Claude Code 找 CLAUDE.md）。放跨会话的通用建议：改代码后跑类型检查、怎么跑单测、可浏览的三方文档链接；可用 `/init` 类命令自动生成。
- **Skills**：AGENTS.md 永远整份加载，Skills 加了一层间接性避免膨胀——给智能体「技能名 + 描述」，它按需打开才占上下文。三者取舍：AGENTS.md 放「永远该知道」的少数规则；Skill 放「按任务才需要」的知识；子智能体隔离「大量中间过程」。

## 子智能体与并行

- 子智能体：为特定工作流定义的智能体。顶层调用子智能体——顶层上下文不被子智能体看到的一切撑爆，子智能体也只拿自己任务需要的上下文。例：网页研究做成子智能体（查询、搜索、检索、分析、回答案），顶层上下文不被所有检索页膨胀。Claude Code 用 `/agents` 从简短提示生成；dsh 同样有 subagents 机制。
- 并行智能体：智能体可能在一个问题上干几十分钟——同时跑多个实例：同一任务多跑几次取最佳（LLM 有随机性），或分头做互不重叠的功能；用 git worktrees（见 `git-cli`）隔离彼此的改动。
- MCP（Model Context Protocol）：连接智能体与工具的开放协议——Notion MCP 服务器让「读 {Notion 文档} 里的规范、起草实现计划、实现原型」成为可能；用 Pulse、Glama 等目录发现 MCP。
- 可复用提示词：曾作为独立功能存在；在 Codex、Claude Code 中已被 Skills 覆盖——直接写成 skill 即可。

## 练习

学习材料在 `exercises.md`；用 DeepSeek Harness（dsh）实操的专属练习见 `exercises-dsh.md`。

> 改编自 MIT The Missing Semester 课程 Lecture 7: Agentic Coding（讲义 + 口播稿，CC BY-NC-SA 4.0）：https://creativecommons.org/licenses/by-nc-sa/4.0/ · 课程站点：https://missing.csail.mit.edu/ · 讲座视频：https://www.youtube.com/watch?v=sTdz6PZoAnw
