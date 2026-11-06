// guard 监督器：runtime 按 API.md 的约定监督 guard 进程——启动时若 guard
// 不可达则代为拉起（--serve --data <dataDir>），guard 退出后带退避重启，
// 专注会话重发锁屏命令的语义由 guard-client 的调用方负责。
//
// 为什么由 runtime 监督而不是两个 systemd unit 各自 Restart=：
// 双重监督会在 43988 端口上互相打架（一个拉起、一个以为端口被占退出、再被
// 另一个拉起……），单点监督让「谁拥有 guard 进程」这件事只有一个答案。
// 若已有别的 guard 在跑（例如手动启的 unit），监督器检测到可用就只旁观，
// 不抢端口；它死了再接手。
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { GuardClient } from "./guard-client.ts";

const DEFAULT_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const BACKOFF_RESET_UPTIME_MS = 60000;

function candidateBins(env) {
  const home = env.HOME || "";
  const list = [
    env.TOMATO_GUARD_BIN,
    home ? join(home, ".local/lib/tomato/guard/tomato-guard") : "",
    "tomato-guard",
  ];
  return list.filter((bin) => typeof bin === "string" && bin.length > 0);
}

/**
 * 启动 guard 监督循环。返回 { status: () => Promise<object|null>, stop: () => void }。
 * status() 返回最近一次成功的 /guard/status 数据，不可达时为 null。
 */
export function startGuardSupervisor({ dataDir, token, logger = console, backoffMs = DEFAULT_BACKOFF_MS, client = null }) {
  const guard = client ?? GuardClient.fromDataDir(dataDir);
  let child = null;
  let stopped = false;
  let attempts = 0;
  let currentBackoff = backoffMs;
  let lastSpawnAt = 0;
  let lastStatus = null;
  let timer = null;

  async function probe() {
    const result = await guard.status();
    if (result.ok && result.status === 200) {
      lastStatus = result.data ?? {};
      return true;
    }
    lastStatus = null;
    return false;
  }

  function trySpawn(bins) {
    // guard 的 --data 是「guard 数据目录」（token 在其下，默认 .../guard），
    // 与 runtime 数据目录不同，这里显式传子目录（API.md 已定）。
    const guardData = join(dataDir, "guard");
    for (const bin of bins) {
      const candidate = spawn(bin, ["--serve", "--data", guardData], {
        stdio: ["ignore", "ignore", "pipe"],
      });
      let spawned = true;
      candidate.once("error", () => {
        spawned = false;
        child = null;
      });
      candidate.stderr.on("data", (chunk) => {
        logger.error(`tomato-guard: ${String(chunk).trim()}`);
      });
      candidate.once("exit", (code) => {
        if (child === candidate) child = null;
        if (!stopped && spawned) {
          logger.error(`tomato-guard 退出（code ${code}），${currentBackoff}ms 后重启`);
          schedule(currentBackoff);
        }
      });
      child = candidate;
      lastSpawnAt = Date.now();
      return;
    }
    schedule(MAX_BACKOFF_MS);
  }

  function schedule(delay) {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(ensure, delay);
    timer.unref?.();
  }

  async function ensure() {
    if (stopped) return;
    if (await probe()) {
      // 长时间稳定运行后重置退避预算。
      if (Date.now() - lastSpawnAt > BACKOFF_RESET_UPTIME_MS) {
        attempts = 0;
        currentBackoff = backoffMs;
      }
      schedule(1000);
      return;
    }
    if (child !== null) {
      schedule(currentBackoff);
      return;
    }
    attempts += 1;
    currentBackoff = Math.min(backoffMs * 2 ** (attempts - 1), MAX_BACKOFF_MS);
    const bins = candidateBins(process.env);
    logger.error(
      `guard 不可达，尝试拉起（第 ${attempts} 次）：${bins.join(" 或 ")}`,
    );
    trySpawn(bins);
    schedule(currentBackoff);
  }

  ensure();

  return {
    async status() {
      await probe();
      return lastStatus;
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      if (child !== null) {
        child.kill("SIGTERM");
        child = null;
      }
    },
  };
}
