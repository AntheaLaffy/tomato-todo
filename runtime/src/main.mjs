// runtime 入口：--serve（HTTP + 引擎 + 计时循环）或 --mcp（stdio 转发桥）。
// 用法见 --help；默认数据目录 ~/.local/share/studio.tomato.todo/。
import { homedir } from "node:os";
import { join } from "node:path";
import { Engine } from "./engine.ts";
import { startServer, DEFAULT_PORT } from "./server.mjs";
import { runMcpStdio } from "./mcp-stdio.mjs";
import { ensureGuardToken, runGuardStatus } from "./guard-client.ts";
import { startGuardSupervisor } from "./supervise.mjs";
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
  const base =
    process.env.XDG_DATA_HOME ||
    join(process.env.HOME || homedir(), ".local", "share");
  return join(base, "studio.tomato.todo");
}

export function parseArgs(argv) {
  const opts = {
    mode: null,
    dataDir: null,
    host: "127.0.0.1",
    port: DEFAULT_PORT,
    connectionFile: null,
  };
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
        if (!Number.isInteger(port) || port < 0 || port > 65535)
          throw new Error("--port 需为 0–65535");
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
  if (opts.mode === null)
    throw new Error(`需要 --serve、--mcp 或 --guard-status\n${USAGE}`);
  if (opts.mode === "serve" && opts.connectionFile !== null) {
    throw new Error("--connection 只与 --mcp 一起使用");
  }
  opts.dataDir = opts.dataDir ?? defaultDataDir();
  return opts;
}

export async function main(argv) {
  const opts = parseArgs(argv);

  if (opts.mode === "mcp") {
    const connectionFile =
      opts.connectionFile ?? join(opts.dataDir, "agent", "connection.json");
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
  const { server, port, syncGuard, guard } = await startServer({
    engine,
    dataDir: opts.dataDir,
    host: opts.host,
    port: opts.port,
    token: connection.token,
    version: VERSION,
  });
  if (port !== opts.port) connection.mcpUrl = `http://${opts.host}:${port}/mcp`;
  writeConnection(opts.dataDir, connection);

  // 提醒/一轮计时结束 → 让原生 guard 把 DSH 窗口拉到前台。前端只能切面板，
  // 抢系统焦点必须由 native 侧做（见 crates/guard 的 focus 命令）。
  let lastFocusError = null;
  const focusDsh = () => {
    void guard.focus().then((result) => {
      if (result.ok) {
        lastFocusError = null;
        return;
      }
      const message = result.error ?? `HTTP ${result.status}`;
      if (message !== lastFocusError) {
        lastFocusError = message;
        console.error(`guard focus 失败：${message}（提醒仍会显示，只是窗口不会被拉到前台）`);
      }
    });
  };
  const pendingReminders = () =>
    engine.data.tasks.filter((task) => task && task.reminderPending).length;

  // 桌面系统通知也走 guard：浏览器里的 Web Notification 在窗口失焦/权限未授予时
  // 不可靠，而 guard 已经能调系统通知中心。只在设置开着时发；失败不重试——
  // 到点这件事本身已经由前端提醒条与抢焦兜住了。
  const notifyDesktop = (title, body) => {
    if (!engine.data.settings.notifications) return;
    void guard.notify({ title, body }).then((result) => {
      if (!result.ok) {
        console.error(`guard notify 失败：${result.error ?? `HTTP ${result.status}`}`);
      }
    });
  };
  const newlyPending = (beforeIds, afterIds) => {
    const before = new Set(beforeIds);
    return afterIds.filter((id) => !before.has(id));
  };
  const reminderIds = () =>
    engine.data.tasks.filter((task) => task && task.reminderPending).map((task) => task.id);
  let prev = {
    serial: Number(engine.data.timer.completionSerial) || 0,
    reminders: pendingReminders(),
    reminderIds: reminderIds(),
  };

  // 每秒 tick：计时到点、提醒送达、自动开工、锁机时段（都在 core.tick）+ guard
  // 状态跟随。core 只在数据真的变化时落盘，安静时这一拍只是内存克隆。
  const interval = setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    engine.tick(now);
    syncGuard();
    const next = {
      serial: Number(engine.data.timer.completionSerial) || 0,
      reminders: pendingReminders(),
      reminderIds: reminderIds(),
    };
    // 首次 tick 只建立基线：启动时已有的 pending 提醒不抢焦点、也不补发通知。
    const fresh = newlyPending(prev.reminderIds, next.reminderIds);
    if (next.serial > prev.serial || fresh.length > 0) {
      focusDsh();
      if (next.serial > prev.serial) {
        notifyDesktop("番茄 Todo", "这一轮专注结束了，起来动一动。");
      }
      for (const id of fresh) {
        const task = engine.data.tasks.find((item) => item.id === id);
        notifyDesktop("番茄 Todo", task ? `到点了：${task.title}` : "有一项任务到点了。");
      }
    }
    prev = next;
  }, 1000);

  console.error(
    `tomato-runtime ${VERSION} 已启动：http://${opts.host}:${port}（数据目录 ${opts.dataDir}）`,
  );
  // 按 API.md：runtime 监督 guard——不可达时拉起、退出后带退避重启；已有
  // 别的 guard 在跑就只旁观（不抢端口）。
  const guardSupervisor = startGuardSupervisor({ dataDir: opts.dataDir });
  const shutdown = () => {
    clearInterval(interval);
    guardSupervisor.stop();
    engine.flushNow();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
