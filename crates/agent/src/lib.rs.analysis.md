---
source: lib.rs
lines: 1843
generated_at: 2026-11-01
---

## 功能索引

本次应试学情扩展：`get_context`内嵌短项目摘要，`get_study_progress`按项目分页返回动态摘要及带来源进度历史；`education`与`dispatch`的助手写入路径均把进度来源固定为assistant/待确认，用户在对话明确确认后可单独confirmProgress。教学事件提示要求taskHomework读取完成任务快照、保守选择已学范围并关联taskId。考试运行期间拒绝发信、编辑和重试。

| 用途 | Lines | Notes |
| --- | --- | --- |
| Agent 生命周期、私有目录与工作进程 | 1–141 | 跨平台启动在 worker.rs |
| 记录助手改动与工作进程请求 | 142–189 | 管理请求复用 network_result 回包 |
| UI 请求、作者模式退出、连接配置与会话切换 | 190–463 | 分支/搜索委托 conversations.rs，Canvas 委托 canvas.rs，附件委托 attachments.rs |
| 创建本轮请求、模型图片能力与失败 | 464–578 | prompt_command 计算已开启作者模式的本轮访问、提供语义开启工具、解析当前人格注入本轮、保存用户消息并占用本轮 |
| 技能发现、SDK 事件、消息节点、思考内容与状态 | 579–742 | userMessageId/entryId 保存 UI 消息与 Pi 节点关系；停止标记独立于错误 |
| 定时任务与异常唤醒 | 743–954 | 空闲、冷却与已授权定时任务语义 |
| 工具授权与领域操作 | 955–1753 | call_job 校验本轮身份、处理模型开启作者彩蛋/一次入场事件并保存生成图片，拒绝非 Codex 图片工具；call 处理人格切换/新建/删除；核心保护规则仍由 apply 决定 |
| 退出、图片校验与运行包路径 | 1754–1843 | 安装位置优先，源码运行包作为回退；MCP 入口 |

应试教学：request处理用户目录授权与聊天归档，并阻止考试中发信、编辑和重试；prompt_command附加本轮实际projectMounts；observe领取持久化教学事件并复用scheduled会话；education工具保存正式领域记录。目录与文件操作委托projects.rs和resources.rs。
