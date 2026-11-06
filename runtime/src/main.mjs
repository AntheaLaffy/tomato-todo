// runtime 入口：--serve（HTTP + 引擎 + 计时循环）或 --mcp（stdio 转发桥）。
// 用法见 --help；默认数据目录 ~/.local/share/studio.tomato.todo/。
import { homedir } from "node:os";
import { join } from "node:path";
import { Engine } from "./engine.ts";
import { startServer, DEFAULT_PORT } from "./server.mjs";
import { runMcpStdio } from "./mcp-stdio.mjs";
import { ensureGuardToken, runGuardStatus } from "./guard-client.ts";
import { loadOrCreateConnection, writeConnection } from "./connection.mjs";
import { VERSION } from "./version.mjs";

const USAGE = `番茄 Todo runtime ${VERSION}（随 DSH 插件分发）
用法:
  tomato-runtime --serve [--data <dir>] [--host 127.0.0.1] [--port 43987]
  tomato-runtime --mcp   [--data <dir>] [--connection <file>]
  tomato-runtime --guard-status [--data <dir>]
  --serve        启动 HTTP 服务（只读 API + 写 API + /mcp）
  --mcp          stdio MCP，转发到运行中 runtime 的 /mcp
  --guard-status 一次性探测 guard，stdout 一行 JSON 后退出（退出码恒 0）
  --data         数据目录，默认 ~/.local/share/studio.tomato.todo/
`;

export function defaultDataDir() {
  const base = process.env.XDG_DATA_HOME || join(process.env.HOME || homedir(), ".local", "share");
  return join(base, "studio.tomato.todo");
}

export function parseArgs(argv) {
  const opts = { mode: null, dataDir: null, host: "127.0.0.1", port: DEFAULT_PORT, connectionFile: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[i + 1];
      if (next === undefined) throw new Error(`参数 ${arg} 缺少值`);
      i++;
      return next;
    };
    switch (arg) {
      case "--serve":
        opts.mode = "serve";
        break;
      case "--mcp":
        opts.mode = "mcp";
        break;
      case "--guard-status":
        opts.mode = "guard-status";
        break;
      case "--data":
        opts.dataDir = value();
        break;
      case "--host":
        opts.host = value();
        break;
      case "--port": {
        const port = Number(value());
        if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("--port 需为 0–65535");
        opts.port = port;
        break;
      }
      case "--connection":
        opts.connectionFile = value();
        break;
      case "--help":
      case "-h":
        console.error(USAGE);
        process.exit(0);
        break;
      default:
        throw new Error(`未知参数：${arg}\n${USAGE}`);
    }
  }
  if (opts.mode === null) throw new Error(`需要 --serve、--mcp 或 --guard-status\n${USAGE}`);
  if (opts.mode === "serve" && opts.connectionFile !== null) {
    throw new Error("--connection 只与 --mcp 一起使用");
  }
  opts.dataDir = opts.dataDir ?? defaultDataDir();
  return opts;
}

export async function main(argv) {
  const opts = parseArgs(argv);

  if (opts.mode === "mcp") {
    const connectionFile = opts.connectionFile ?? join(opts.dataDir, "agent", "connection.json");
    return runMcpStdio({ connectionFile });
  }

  if (opts.mode === "guard-status") {
    // 契约：guard 不可达也打 JSON 并退出 0；只有进程自身故障才非零退出。
    // runGuardStatus 自身按契约向 stdout 打印单行 JSON，这里不再重复打印。
    await runGuardStatus(opts.dataDir);
    process.exit(0);
  }

  // --serve
  const engine = Engine.open(opts.dataDir);
  ensureGuardToken(opts.dataDir);
  const connection = loadOrCreateConnection(opts.dataDir, opts.host, opts.port);
  const { server, port } = await startServer({
    engine,
    dataDir: opts.dataDir,
    host: opts.host,
    port: opts.port,
    token: connection.token,
    version: VERSION,
  });
  if (port !== opts.port) connection.mcpUrl = `http://${opts.host}:${port}/mcp`;
  writeConnection(opts.dataDir, connection);

  // 每秒 tick：计时状态机只更新内存（落盘防抖）+ 提醒到点桩。
  const interval = setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    engine.tick(now);
    engine.tickReminders(now);
  }, 1000);

  console.error(`tomato-runtime ${VERSION} 已启动：http://${opts.host}:${port}（数据目录 ${opts.dataDir}）`);
  const shutdown = () => {
    clearInterval(interval);
    engine.flushNow();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
