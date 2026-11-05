---
source: lib.rs
lines: 1904
generated_at: 2026-11-02
---

## 功能索引

本次应试学情扩展：`get_context`内嵌短项目摘要，`get_study_progress`按项目分页返回动态摘要及带来源进度历史；`education`与`dispatch`的助手写入路径均把进度来源固定为assistant/待确认，用户在对话明确确认后可单独confirmProgress。教学事件提示要求taskHomework读取完成任务快照、保守选择已学范围并关联taskId。考试运行期间拒绝发信、编辑和重试。

| 用途 | Lines | Notes |
| --- | --- | --- |
| Agent生命周期、私有目录与工作进程 | 1–144 | 工作进程细节在worker.rs |
| 记录助手改动与工作进程请求 | 145–192 | 管理请求复用回包 |
| UI请求、配置与会话切换 | 193–498 | 外部自动执行归还复用状态接口 |
| 创建请求、模型图片能力与失败 | 499–613 | 沿用Pi会话与本轮人格 |
| 技能、SDK事件、消息与状态 | 614–777 | 状态带作业唤醒事件ID，供输入框预填来源辨识 |
| 教学/定时与异常唤醒 | 778–1011 | 外部接管暂停后续自动请求；作业事件领取时记录事件ID并唤醒界面，其余教学事件不抢页、清除非作业唤醒ID |
| 工具授权与领域操作 | 1012–1814 | 技能目录/教学分页/接管委托external.rs；保护仍由核心决定 |
| 退出、图片校验与运行包路径 | 1815–1904 | 安装资源优先；标准stdio不另开数据库 |

应试教学：request处理用户目录授权与聊天归档，并阻止考试中发信、编辑和重试；prompt_command附加本轮实际projectMounts；observe领取持久化教学事件并复用scheduled会话，领取homework/taskHomework时发出界面唤醒信号；education工具保存正式领域记录。目录与文件操作委托projects.rs和resources.rs。
