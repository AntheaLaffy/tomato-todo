---
source: agent.ts
lines: 1053
generated_at: 2026-10-13
---

## 功能索引

| 用途 | Lines | Notes |
| --- | --- | --- |
| 状态契约、偏好默认值与编辑草稿 | 1–197 | Preferences.thinkingLevel 与 Rust state.rs 同步 |
| 页面入口、聊天、会话与问题卡片 | 198–372 | mountAgent 接线；消息仅展示最近 60 条 |
| 登录、用量、模型与思考强度 | 373–504 | thinkingSelectHtml；强度保存到偏好，Pi SDK 适配模型能力 |
| 设置/记忆/方案/信号/定时浮层 | 505–610 | 保留输入草稿、批准应用文件 |
| 演示、刷新、挂载与事件监听 | 611–753 | refreshAgent 每 2.5 秒轮询；mountAgent 查询用量，后端 IPC 不阻塞窗口 |
| 表单提交与工具/按钮动作 | 754–1053 | 配置保存保留 thinkingLevel；运行中禁止切换强度 |
