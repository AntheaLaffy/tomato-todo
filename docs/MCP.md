# 自建 MCP 服务器指南

学习助手可以通过 [MCP](https://modelcontextprotocol.io/) 调用**你自己写的服务器**，把座位预约、图书馆、教务、订阅这类外部系统接进对话。本文讲怎么写一个服务器并挂进来；应用侧的字段与行为以随包 MCP 客户端的校验器为准，助手如何调度见 [AGENT.md](AGENT.md)。

先分清两个方向，别搞混：

- **把番茄 Todo 当 MCP 服务器**（外部客户端连正在运行的软件）：见 [AGENT.md](AGENT.md) 的「外部 MCP」。
- **给助手接一个 MCP 服务器**（本文）：助手作为客户端，连接你配置的程序。

## 最小可用服务器

stdio 传输，一个工具就够跑通。用官方 SDK（Node 版，例子见 [modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)）：

```js
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "demo", version: "0.1.0" });

server.registerTool(
  "demo_add",
  {
    title: "两数相加",
    description: "返回 a + b。说明输入 schema 与返回形状的最小示例。",
    inputSchema: { a: z.number(), b: z.number() },
  },
  async ({ a, b }) => ({ content: [{ type: "text", text: String(a + b) }] }),
);

await server.connect(new StdioServerTransport());
```

三条硬规矩：

- **stdout 只准写 JSON-RPC**（换行分隔）。日志、调试、进度一律走 stderr 或文件；往 stdout 打一行就会让协议解析失败。
- 工具的 `description` 会被模型读到，写清**做什么、什么时候用**；`inputSchema` 用 zod，参数名和描述尽量具体。
- 出错返回 `{ isError: true, content: [{ type: "text", text: "..." }] }`，别把异常直接抛到传输层。长任务就跑到完成，不要自己加超时（应用会按配置的 `timeout` 处理）。

## 挂进应用

配置写在**数据目录下 `agent/mcp.json`**（和 `state.json`、`connection.json` 同目录），用的是各家客户端通用、Codex 同款的 `mcpServers` 形状，现成配置可以直接抄：

```json
{
  "mcpServers": {
    "demo": {
      "command": "/usr/bin/node",
      "args": ["/home/me/demo-mcp/server.mjs"],
      "env": { "DEMO_TOKEN": "..." },
      "exposure": "codemode",
      "description": "演示服务器：两数相加"
    }
  }
}
```

也可以让助手代劳，不用手改文件：

- `add_mcp_server { name, command, args, env, exposure, description }`，语义同 `codex mcp add`；`url` 换成 streamable HTTP 时同理。
- `remove_mcp_server { name }`、`list_mcp_servers`（列出名称、启用状态、exposure、启动命令/URL、来源，以及校验和连接错误）。

只有这份 `mcp.json` 会被加载：工作区是可被模型写入的，绝不能在那里定义服务器，所以项目级 `.pi/mcp.json` 被忽略。**配置在每次用户对话新建会话时读取**——改完文件后开一轮新对话（或直接用 `add_mcp_server`）即生效。

## 字段

校验器接受的字段（`SERVER_NAME` = 字母、数字、`_`、`-`）：

| 字段 | 说明 |
| --- | --- |
| `command` / `args` / `env` / `cwd` | stdio 传输：启动哪个程序、参数、环境变量、工作目录。`command` 与 `args` 力求绝对路径。 |
| `url` / `headers` / `oauth` / `auth` | streamable HTTP：`headers` 支持 `${ENV}` 占位；服务器回 401 且没有 `Authorization` 时走 OAuth；`auth: { provider }` 改用某个 `/login` provider 的令牌。 |
| `type` | `stdio` / `http` / `streamable-http`；旧的 `sse` 已不支持。 |
| `exposure` | `codemode`（默认）、`deferred`、`direct`、`hidden`；旧名 `codemode-deferred` 等同于 `codemode`。 |
| `toolExposure` | 按工具名单独覆盖 exposure，例如把某个危险工具降成 `deferred`。 |
| `enabled` | 默认 `true`；`false` 单独停用，不用删配置。 |
| `timeout` | 正数秒。 |
| `description` | 一句话说明，会出现在 `list_mcp_servers` 里，帮助模型判断该不该用。 |

**exposure 怎么选**：应用用的是策展过的工具清单，默认的 `codemode` 只在代码里调用，`deferred` 由 `tool_search` 按需加载——两者都不会撑大工具声明，也不会让只读轮次凭空多出外部能力；`direct` 必须把工具名显式写进工具清单才会声明，这里一般用不到。配成 `hidden` 的工具不暴露给模型。

## 工具名、资源与调试

- 工具的完整名是 `mcp__<服务器>__<工具>`，其中服务器名里的 `-` 会变成 `_`。上面的例子即 `mcp__demo__demo_add`。
- 服务器暴露的 resource 用 Codex 同款工具读取：`list_mcp_resources` / `list_mcp_resource_templates` / `read_mcp_resource`。
- 配置坏了不会静默失败：`list_mcp_servers` 会把校验错误一起报出来；服务器自己发的 `notifications/message` 追加到同目录的 `mcp.log`。
- 传输由随包运行时自带的 MCP 客户端处理，你不需要在服务器里关心连接管理。

## 安全与边界

- **服务器以你的身份、在编程沙箱之外运行**。`command` 会执行任意程序，`add_mcp_server` 因而只在用户明确要求时使用——只挂你自己信任的服务器。
- **只在用户主动发起的对话里连接**。异常自动唤醒不加载任何 MCP 服务器（座位、下单这类不该在无人确认时被唤醒）。
- 密钥放 `env`，或让服务器读自己拥有的文件；不要写进 `description`（会进模型上下文）或日志。HTTP 的 `headers` 可以用 `${ENV}` 从环境变量取。
- 会话生命周期：每次请求新建会话时连接服务器，会话结束（含应用退出）时一起关闭，不残留后台进程。别指望服务器跨调用保留内存状态，要持久化就落盘。
- 工具对番茄 Todo 数据做的事仍受应用的保护规则约束（严格模式、不可逆裁定、来源与文件哈希校验），服务器绕不开。

## 一个真实例子：图书馆座位预约

随实验一起写的 `libseat` 服务器（华南农业大学图书馆座位预约）展示了几个值得复用的模式：CAS 登录后拿业务会话、验证码图片**内联回给模型/人**再带 `captcha` 参数重试、按「会话/查询/预约/站点功能」分组的工具命名、以及可插拔的验证码求解器。接口还原、失败重试数学与求解器契约见 [LIBSEAT_MCP.md](LIBSEAT_MCP.md)。它运行时安装、不入库（含账号凭据），可作为你自己项目的结构参考。

## 排错

- 连不上：先 `list_mcp_servers` 看校验/连接错误，再查同目录 `mcp.log`。
- 工具不出现：确认 `enabled` 没关、服务器名合法、`exposure` 不是 `hidden`；`direct` 需要显式声明工具名。
- 协议报错：检查服务器有没有往 stdout 写了非 JSON 的内容（最常见的原因）。
- 找不到 `node`：`command` 用绝对路径；应用的随包运行时在 `agent/bin/node`，自建服务器建议指向你自己控制的 Node。
