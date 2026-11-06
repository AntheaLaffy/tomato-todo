//! Engine：预检/提交/持久化/快照。对应 crates/core/src/lib.rs 的 Engine。
//!
//! 持久化：旧引擎用 SQLite；新架构（MIGRATION.md/API.md）以计划 JSON 文件为唯一数据源。
//! 本实现按「单 JSON 文件 + 原子写（临时文件 + rename）」持久化：
//! - `":memory:"` 仅内存（对应旧 Engine::open(":memory:")）；
//! - 其它路径先读文件（经 v3→v4 迁移），写入时原子替换；
//! - 损坏的文件原样保留（读取失败绝不写回）。

import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { AppError, clone } from "./errors";
import type { Action } from "./lib";
import { AppData } from "./lib";
import { dateAt } from "./time";
import { reconcileIdentities } from "./identities";
import { readLocalData } from "./migration";
import { summaries } from "./learning";
import { validateEducationTransition } from "./education";
import { releaseLock } from "./lock";
import type { Snapshot, TaskKind } from "./model";
import { kindOf } from "./model";
import { timerRemaining } from "./reminders";
import { parseAppData, serializeAppData, serializeTask } from "./lib";

export class Engine {
  path: string;
  data: AppData;

  private constructor(path: string, data: AppData) {
    this.path = path;
    this.data = data;
  }

  /** 桌面适配层专用：合成器故障后强制解除保护；不是对外 Action。 */
  releaseFailedProtection(at: number): void {
    const next = clone(this.data);
    next.record(at, false);
    next.resetTo("focus");
    releaseLock(next.lock, at);
    next.validate();
    this.persist(next);
    this.data = next;
  }

  static open(path: string): Engine {
    let raw: string | null = null;
    if (path !== ":memory:") {
      const parent = dirname(path);
      if (parent !== "." && parent !== "") {
        try {
          mkdirSync(parent, { recursive: true });
        } catch (e) {
          throw new AppError(String(e));
        }
      }
      try {
        raw = readFileSync(path, "utf8");
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
          throw new AppError(String(e));
        }
        raw = null;
      }
    }
    let data: AppData;
    if (raw !== null) {
      data = readLocalData(raw);
    } else {
      data = new AppData();
    }
    reconcileIdentities(clone(data), data, null);
    data.validate();
    const engine = new Engine(path, data);
    engine.persist(engine.data);
    return engine;
  }

  private persist(data: AppData): void {
    if (this.path === ":memory:") return;
    const raw = JSON.stringify(serializeAppData(data), null, 2);
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, raw, "utf8");
    renameSync(tmp, this.path);
  }

  /** 与 dispatch 相同的身份/历史规则，但不持久化：用于审阅文件。 */
  previewAction(action: Action, at: number): AppData {
    const restoreId = (() => {
      if (action.type === "restoreTask") {
        const record = this.data.identities.find(
          (r) => r.id === action.task.id && r.retired && r.kind === "task",
        );
        if (record === undefined) {
          throw new AppError("没有对应的原任务恢复记录");
        }
        if (record.restoreTask !== JSON.stringify(serializeTask(action.task))) {
          throw new AppError("恢复内容与原任务不一致，历史 ID 不能复用");
        }
        return action.task.id;
      }
      return null;
    })();
    const next = clone(this.data);
    next.apply(action, at);
    validateEducationTransition(this.data.education, next.education);
    reconcileIdentities(this.data, next, restoreId);
    next.validate();
    return next;
  }

  dispatch(action: Action, at: number): Snapshot {
    const next = this.previewAction(action, at);
    this.persist(next);
    this.data = next;
    return this.snapshot(at);
  }

  snapshot(at: number): Snapshot {
    const next = clone(this.data);
    if (next.tick(at)) {
      reconcileIdentities(this.data, next, null);
      next.validate();
      this.persist(next);
      // 只有真正变化才进这个分支：热路径每秒一次克隆。
      this.data = clone(next);
    }
    const kinds: Record<string, TaskKind> = {};
    for (const t of this.data.tasks) {
      kinds[t.id] = kindOf(t);
    }
    return {
      taskKinds: kinds,
      remainingSecs: timerRemaining(this.data.timer, at),
      stats: this.data.stats(at),
      studyProgress: summaries(next, at),
      data: next,
      today: dateAt(at),
      serverTime: at,
    };
  }

  export(at: number): string {
    this.snapshot(at);
    return JSON.stringify(serializeAppData(this.data), null, 2);
  }
}

// parseAppData 供运行时从 JSON 直接构造数据（校验入口见 lib.ts 与 index.ts）。
export { parseAppData };
