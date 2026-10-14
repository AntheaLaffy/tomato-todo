---
mode: maintenance
generated_at: 2026-10-14
---

随包 Pi SDK 的薄封装；会话、模型和工具循环遵循上游语义。

## 任务指南

| 任务 | Domain | Target | Also Check |
| --- | --- | --- | --- |
| 流式回答、停止与会话节点 | 对话 | worker.mjs 的 runPrompt、session.mjs 的 forkStudySession | crates/agent/src/conversations.rs、state.rs、tests/agent.mjs |
| 工具、沙箱与附件读取 | 工具 | session.mjs、coding.mjs | system-prompt.md、crates/agent/src/attachments.rs |
| 联网与模型连接 | 联网 | web.mjs、codex-config.mjs | worker.mjs、tests/agent.mjs |
| MCP 配置与生命周期 | 桥接 | mcp-config.mjs、session.mjs、mcp.mjs | docs/MCP.md、tests/agent.mjs |

## 子目录

| Dir | Domain | Depends On | Purpose |
| --- | --- | --- | --- |
| skills/ | 助手指导 | 工具、规范文档 | Internals not indexed：给桌上学习助手按需读取的技能与练习，独立于 .agents/skills/ |

## 文件

| File | Domain | Function |
| --- | --- | --- |
| package.json | 构建 | 固定 Pi SDK 与 TypeBox 版本，构建由 scripts/build-agent.mjs 执行 |
| worker.mjs | 对话 | 行协议、认证/用量、prompt 与流式文本、Pi 节点/分支结果、取消及会话关闭 |
| session.mjs | 对话 | Pi 会话加载、createBranchedSession 分支、工具允许集合、思考强度与 MCP 生命周期 |
| coding.mjs | 工具 | Pi 编程工具、仅工作区文件访问与持久沙箱终端、完整访问模式 |
| web.mjs | 联网 | Exa 搜索、公开网页读取、地址边界与账号服务端搜索 |
| codex-config.mjs | 联网 | 读取 Codex CLI 模型供应商、认证与第三方端点映射 |
| mcp-config.mjs | 桥接 | MCP 配置读取、校验、增删与服务器视图 |
| mcp.mjs | 桥接 | 外部 MCP stdio 客户端入口，连接应用的认证桥 |
| system-prompt.md | 助手指导 | 当前学习助手机制、工具使用与证据/权限约定 |
