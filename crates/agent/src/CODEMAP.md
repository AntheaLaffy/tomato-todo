---
mode: maintenance
generated_at: 2026-10-14
---

Rust 保持应用权限与文件边界，Pi 工作进程负责会话与模型调用。

## 任务指南

| 任务 | Domain | Target | Also Check |
| --- | --- | --- | --- |
| 对话编辑、重试与 Pi 分支 | 对话 | conversations.rs、state.rs、lib.rs.analysis.md | agent/session.mjs、agent/worker.mjs、src/agent.ts、tests/agent.mjs |
| 运行时人格与切换 | 智能体 | state.rs 的 Persona、lib.rs 的 prompt_command/call | tools.rs 的人格工具、agent/session.mjs 的 personaBlock、src/agent.ts 的 personas sheet、docs/AGENT.md |
| 附件上传、下载与文件权限 | 对话 | attachments.rs、lib.rs 的 validated_images | src/agent-chat.ts、src-tauri/src/files.rs、tests.rs |
| 工具与唤醒 | 智能体 | lib.rs.analysis.md、tools.rs | docs/AGENT.md、tests.rs |

## 文件

| File | Domain | Function |
| --- | --- | --- |
| lib.rs | 智能体 | 生命周期、配置与登录、请求/状态/事件、工具授权、生成图片附件保存、唤醒与工作区锁；见 lib.rs.analysis.md |
| creator.rs | 作者彩蛋 | 模型按语义开启彩蛋与运行时提示词读取的工具声明；不做固定句式识别或身份认证 |
| canvas.rs | 文档 | 每会话 Canvas 正文/版本持久化、版本比较防覆盖、恢复/删除/分支副本；get_canvas/save_canvas 与界面操作共用 |
| conversations.rs | 对话 | 全文/标题/附件名搜索、重命名/置顶/归档恢复，调用 Pi 从真实节点创建分支并重发编辑或重试请求 |
| attachments.rs | 对话 | 私有文件上传/下载、大小/文件名/签名/符号链接校验，以及消息附件到模型图片的转换 |
| state.rs | 状态 | Preferences、Persona 人格卡与预设、Memory、完整消息/思考内容/附件引用/Canvas 文档版本/置顶/归档/作者模式/分支来源/对话人格、Schedule 与原子私有写入 |
| bridge.rs | 桥接 | 仅监听 127.0.0.1 的 MCP JSON-RPC，校验私有令牌并拒绝浏览器 Origin |
| files.rs | 文件契约 | 工作区导出/分段读取/补丁/审阅/应用，来源与文件哈希并发校验 |
| tools.rs | 契约 | 内嵌与外部工具定义及允许集合，自动唤醒不暴露直接改数据的工具 |
| worker.rs | 运行时 | Node 启动与原生代理、平台可执行文件、行协议收发与重启 |
| tests.rs | 验证 | 权限、记忆、文件原子性/来源冲突、唤醒、附件私有保存、完整历史与分支、SDK 节点与停止状态 |
