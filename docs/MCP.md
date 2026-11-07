# 把 tomato-runtime 的 MCP 接入任意客户端

`tomato-runtime` 自带一个 MCP 服务器。DSH 插件自带的 `tomato_*` Host 工具经一次性 `--mcp` 调用它，作为 DSH 对话入口；独立 MCP 客户端（Claude Desktop、Codex 等）也能接入。两条路径都连接**正在运行的 runtime**，共享同一份计划数据，不另开数据库；runtime 关闭后不可操作。初始化返回 `serverInfo.name = tomato-todo`，`instructions` 简述接管入口。

两条入口，同一份工具：

- **stdio**：`tomato-runtime --mcp`——spawn 即代理到运行中 runtime 的 `/mcp`，换行分隔 JSON-RPC，每次调用重读连接文件。
- **streamable HTTP**：`http://127.0.0.1:43987/mcp`，Bearer token 认证，拒绝浏览器 Origin；无会话的 JSON 响应实现，通知返回 202，不提供 SSE，GET 返回 405。

## 配置示例

stdio（多数桌面客户端的 `mcpServers` 形状）：

```json
{
  "mcpServers": {
    "tomato": {
      "command": "/path/to/runtime/bin/tomato-runtime",
      "args": ["--mcp"]
    }
  }
}
```

streamable HTTP：从连接文件读出 `mcpUrl` 与令牌后：

```json
{
  "mcpServers": {
    "tomato": {
      "type": "streamable-http",
      "url": "http://127.0.0.1:43987/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

## token 与连接文件

- **位置**：数据目录下的 `agent/connection.json`，默认 `~/.local/share/studio.tomato.todo/agent/connection.json`；runtime 用 `--data` 指定数据目录时跟着走。
- **内容**：当前实例的本机 MCP 地址（`mcpUrl`）与认证令牌；runtime 重启会复用已有令牌并更新进程与地址，stdio 入口每次调用重读该文件，适合稳定的本机客户端配置。
- **边界**：只监听 127.0.0.1；HTTP 端点要求 `Authorization: Bearer <token>`，并拒绝浏览器 Origin——浏览器侧请走面板只读 API（见 [API.md](../API.md)）。
- 令牌不要写进客户端配置的描述、日志或版本库；能读到连接文件的人才能连上 runtime。

## 工具清单语义

工具语义沿用旧番茄 Todo 的外部清单（名称不变，实现在 @tomato/core 之上全部重写）：

| 工具 | 语义 |
| --- | --- |
| `get_context` | 当前实例上下文：今日待办、课表阻塞时段、学情摘要、统计与诊断，接管入口 |
| `get_tasks` | 按 `projectId`/`completed` 分页读任务 |
| `get_study_progress` | 按科目读学情摘要与分页进度历史 |
| `get_education` | 按 `collection/projectId/id` 分页读完整教学记录 |
| `education` | `command.op` 保存学期、课程、作业、考试、答卷、批改、订正与学情 |
| `create_task` / `update_task` / `move_tasks` / `complete_task` | 普通任务的增、改、移、完成 |
| `dispatch` | 番茄、设置、愿景、课表等单项 Action |
| `export_plan` / `export_backup` | 把计划/备份导出为文件，大批改动的起点 |
| `apply_file` | 按 `fileHash` 应用导出的计划 v6 / 备份 v4，带来源与哈希校验 |

接管顺序：先 `get_context`；普通任务用 create/update/move/complete；单项动作走 `dispatch`；大批改动走 `export_plan` / `export_backup` → 客户端自行编辑 → `apply_file`；教学先 `get_education` 再 `education` 写工具。文件读写、网页搜索、定时等能力由客户端（DSH）自带工具完成，runtime 不重复暴露；旧清单的 `get_control_status` / `set_external_control` / `review_file` / `read_file` / `patch_file` 已随旧助手一起移除。

## 安全与边界

- 传输只在本机：127.0.0.1 + token + 拒绝浏览器 Origin。
- 所有写入仍经 @tomato/core 的校验与保护规则（严格模式、来源与文件哈希校验），客户端绕不开。
- 外部客户端不能紧急解锁或提前完成番茄：紧急退出与提前完成由用户在界面操作。
- 客户端以你的本机身份执行写操作，只接你信任的客户端。

给 DSH 接外部 MCP 服务器（座位、图书馆这类系统）是 DSH 自身的 MCP 配置；一个真实服务器的结构与读图实验见 [LIBSEAT_MCP.md](LIBSEAT_MCP.md)。
