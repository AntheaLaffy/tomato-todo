//! Engine：预检/提交/持久化/快照。对应 crates/core/src/lib.rs 的 Engine。
//!
//! 持久化：旧引擎用 SQLite；新架构（MIGRATION.md/API.md）以 JSON 文件为唯一数据源。
//! 本实现有两种存储入口：
//! - `Engine.open(path)`：单 JSON 文件（原子写），对应旧 Engine::open(path)；
//! - `Engine.fromData(data, save)`：调用方自带存储（runtime 用它把同一份 AppData
//!   拆成 plan.json/state.json 两个文件）。存储策略只影响落盘方式，校验、身份登记、
//!   教学转移与保护规则完全共用。

import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { AppError, clone } from "./errors";
import type { Action } from "./lib";
import { AppData } from "./lib";
import { dateAt } from "./time";
import { reconcileIdentities, validateIdentities } from "./identities";
import { readLocalData } from "./migration";
import { summaries } from "./learning";
import { validateEducationTransition } from "./education";
import { releaseLock } from "./lock";
import type { Snapshot, TaskKind } from "./model";
import { kindOf } from "./model";
import { timerRemaining } from "./reminders";
import { parseAppData, serializeAppData, serializeTask } from "./lib";

/** 落盘回调：收到的是已经过校验的 AppData；回调必须原子替换自己的存储。 */
export type EnginePersist = (data: AppData) => void;

/** 单文件存储：临时文件 + rename，保证读者只看到旧内容或新内容。 */
function writeAtomic(path: string, data: AppData): void {
  const raw = JSON.stringify(serializeAppData(data), null, 2);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, raw, "utf8");
  renameSync(tmp, path);
}

export class Engine {
  path: string;
  data: AppData;
  private readonly save: EnginePersist;

  private constructor(path: string, data: AppData, save: EnginePersist) {
    this.path = path;
    this.data = data;
    this.save = save;
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

  /**
   * 旧 runtime 的「放弃当前番茄」：不写专注记录，只回到空闲专注。
   * 保护生效时拒绝（与其它写动作同一规则：不能借放弃绕开锁定）。
   */
  discardTimer(): void {
    if (this.data.strictProtected()) {
      throw new AppError("严格模式生效中，不能提前结束或修改；到时自动解除");
    }
    if (this.data.protected()) {
      throw new AppError(
        "专注保护中，结束前不能修改任务或计时；可提前完成番茄或紧急退出",
      );
    }
    const next = clone(this.data);
    next.resetTo("focus");
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
    const engine = new Engine(
      path,
      data,
      path === ":memory:"
        ? () => {}
        : (next: AppData) => writeAtomic(path, next),
    );
    engine.persist(engine.data);
    return engine;
  }

  /**
   * 用调用方加载好的数据建引擎，并以调用方给的 `save` 落盘。
   * 数据仍走同一套身份登记与全量校验；`save` 抛错会原样传出，加载失败时
   * 调用方因此不会覆盖旧文件。
   */
  static fromData(
    data: AppData,
    save: EnginePersist,
    path = ":memory:",
  ): Engine {
    const next = clone(data);
    reconcileIdentities(clone(data), next, null);
    next.validate();
    const engine = new Engine(path, next, save);
    engine.persist(engine.data);
    return engine;
  }

  private persist(data: AppData): void {
    this.save(data);
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
    // apply 内部已做全量校验；reconcile 只改 identities，再验身份即可，
    // 避免对教学记录很多的库每次动作重复跑一遍昂贵校验。
    next.apply(action, at);
    validateEducationTransition(this.data.education, next.education);
    reconcileIdentities(this.data, next, restoreId);
    validateIdentities(next);
    return next;
  }

  /** 只推进时间（计时/提醒/锁机/自动开工），不生成快照统计；每秒 tick 用。 */
  tick(at: number): boolean {
    const next = clone(this.data);
    if (!next.tick(at)) return false;
    reconcileIdentities(this.data, next, null);
    next.validate();
    this.persist(next);
    this.data = clone(next);
    return true;
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
