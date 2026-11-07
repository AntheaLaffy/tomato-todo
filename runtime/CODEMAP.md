# runtime — 随包 Node 本地服务

入口 `bin/tomato-runtime` → `src/main.mjs`。HTTP 与 MCP 契约以 [API.md](../API.md) 为准，
测试用 `cd runtime && node --test`。本目录只索引源码、入口与测试；`vendor/` 是
`pnpm build:runtime` 打出的 core 产物，`node_modules/` 是依赖，均不纳入。

## 文件（src/）

| File | Domain | Function |
| --- | --- | --- |
| main.mjs | 入口 | `--serve` / `--mcp` / `--guard-status` 参数解析与装配；启动每秒 tick（计时、提醒、系统通知）与 guard 监督 |
| server.mjs | HTTP | 127.0.0.1:43987 路由：只读/写 API、`/mcp`、gzip、CORS；项目资料库与文件流端点；`desiredGuard()` / `createGuardSync()` |
| engine.ts | 适配层 | 把 `@tomato/core` 的 AppData/Snapshot 适配成 CLI/HTTP/MCP 形状；Action 校验前调用 `validateResourceAction` |
| project-library.mjs | 资料库 | 项目目录授权（`project-grants.json`）、共享库路径/文件校验（`resolveLibraryPath`、`libraryFileMetadata`）、资源登记/扫描/修复/清理、文件元数据；导出 `validateResourceAction`、`mimeTypeFor` |
| library-index.mjs | 资料索引 | 共享库递归扫描（跳过隐藏项/符号链接/`node_modules`/.git，条目/耗时上限）、`library-index.json` 0600 原子读写、`searchIndex`/`summarize`、顶层目录→项目映射；只服务浏览，不写 `education.resources` |
| apps.mjs | 桌面 | 解析 XDG 桌面入口，为 guard 报上来的运行中 app_id 补充可读名称（名称缓存 30 秒） |
| connection.mjs | MCP | `agent/connection.json` 的读写：token 跨重启复用、0600 原子替换；短命第二实例不覆盖仍在运行的实例 |
| mcp.mjs | MCP | `/mcp` 与 `--mcp` 共用的 JSON-RPC 骨架：initialize / ping / tools/list / tools/call |
| mcp-stdio.mjs | MCP | stdio 转发桥：按行读 JSON-RPC，每次请求重读连接文件并转发到运行中 runtime 的 `/mcp` |
| tools.mjs | 工具契约 | 13 个 MCP 工具的 schema 与 `callTool` 分派；`scripts/build-host-tools.mjs` 以它为源生成插件 Host 工具 |
| guard-client.ts | guard 客户端 | 按 API.md 向 127.0.0.1:43988 发 lock/unlock/notify/focus/fullscreen/status/apps；失败返回结构化结果，不抛异常 |
| supervise.mjs | guard 监督 | 启动时拉起 guard、退出后退避重启；已有 guard 在跑时只旁观 |
| data-files.mjs | 存储 | `plan.json` + `state.json` 的读写、默认值补齐与原子替换 |
| types.ts | 契约类型 | runtime 对外 JSON 形状（camelCase、日期/时间/时间戳） |
| version.mjs | 版本 | 从 `package.json` 读版本号，供 `/health` 与 MCP `serverInfo` 使用 |

## 文件（test/）

| File | Domain | Function |
| --- | --- | --- |
| api-state.test.mjs | 验证 | `/api/state`、`/api/apps`、`/api/desktop/fullscreen`、`desiredGuard`、guard 重发锁定 |
| engine.test.mjs | 验证 | 引擎计时、任务、导入导出与数据落盘 |
| http.test.mjs | 验证 | HTTP 鉴权/CORS/错误、导出端点、`/mcp` 传输边界 |
| library.test.mjs | 验证 | 共享库授权/项目授权/路径安全与 `/api/library/*`、`/api/resources/:id/file` 流式读取 |
| library-index.test.mjs | 验证 | 索引扫描跳过规则/排序/0600 原子写、搜索分页/类型组、顶层目录→项目映射、`/api/library/{scan,items,stats,file}` 与并发扫描 |
| mcp-stdio.test.mjs | 验证 | `--mcp` 转发 initialize/ping/tools/call、未启动与连接文件错误的文案 |
| guard-client.test.mjs | 验证 | guard 命令协议、guard 不可达/超时、token 文件 |
| guard-client.mjs | 验证 | guard 客户端更细的命令与错误路径（文件名为历史遗留，仍被 `node --test` 发现） |
| connection.test.mjs | 验证 | 连接文件：短命第二实例不可覆盖运行中实例、死实例可替换、0600 原子写 |
| supervise.test.mjs | 验证 | guard 拉起、退避重启、已有 guard 时旁观 |

## 子目录

| Dir | Domain | Purpose |
| --- | --- | --- |
| bin/ | 入口 | `tomato-runtime` 可执行入口，只转调 `src/main.mjs` |
| scripts/ | 构建 | `bundle-core.mjs`：把 `@tomato/core` 打进 `vendor/` |
| vendor/ | 构建产物 | `build:runtime` 生成的 core 单文件，产物入库；不手改 |
| test/ | 验证 | 上表所列 node:test 用例 |
