//! 实体身份：删除后仍保留登记；撤销恢复同一任务；跨类型唯一。
//! 对应 crates/core/src/identities.rs。

import { AppError, ensure, utf8Len } from "./errors";
import { asOpt, asStr, field, isObject, rejectUnknown, requiredField } from "./json";
import type { AppData } from "./lib";
import type { Identity } from "./model";
import { parseTask, serializeTask } from "./lib";

const IDENTITY_KEYS = ["id", "kind", "retired", "restoreTask"] as const;

export function parseIdentity(raw: unknown): Identity {
  if (!isObject(raw)) throw new AppError("ID 登记必须是对象");
  rejectUnknown(raw, [...IDENTITY_KEYS], "ID 登记");
  return {
    id: requiredField(raw, "id", "ID 登记", asStr),
    kind: requiredField(raw, "kind", "ID 登记", asStr),
    retired: requiredField(raw, "retired", "ID 登记", (v) => {
      if (typeof v !== "boolean") throw new AppError("retired 必须是布尔值");
      return v;
    }),
    restoreTask: field(raw, "restoreTask", "ID 登记", (v) => asOpt(v, "restoreTask", asStr), null) as string | null,
  };
}

export function serializeIdentity(i: Identity): Record<string, unknown> {
  return { id: i.id, kind: i.kind, retired: i.retired, restoreTask: i.restoreTask };
}

/** 当前活跃实体 ID → 类型。 */
function activeIdentities(data: AppData): Map<string, string> {
  const ids = new Map<string, string>();
  const add = (id: string, kind: string): void => {
    if (id.trim().length === 0 || utf8Len(id) > 200 || ids.has(id)) {
      throw new AppError("独立实体 ID 为空、过长或重复");
    }
    ids.set(id, kind);
  };
  for (const x of data.projects) add(x.id, "project");
  for (const x of data.habits) add(x.id, "habit");
  for (const x of data.visions) add(x.id, "vision");
  for (const x of data.blocks) add(x.id, "block");
  for (const x of data.tasks) add(x.id, "task");
  for (const x of data.templates) add(x.id, "template");
  for (const x of data.sessions) add(x.id, "session");
  for (const x of data.education.resources) add(x.id, "resource");
  for (const x of data.education.semesters) add(x.id, "semester");
  for (const x of data.education.lessons) add(x.id, "lesson");
  for (const x of data.education.assessments) add(x.id, "assessment");
  for (const x of data.education.submissions) add(x.id, "submission");
  for (const x of data.education.grades) add(x.id, "grade");
  for (const x of data.education.reviews) add(x.id, "review");
  for (const x of data.education.progress) add(x.id, "progress");
  for (const x of data.education.corrections) add(x.id, "correction");
  return ids;
}

const ALLOWED_KINDS = [
  "project",
  "habit",
  "vision",
  "task",
  "template",
  "session",
  "block",
  "resource",
  "semester",
  "lesson",
  "assessment",
  "submission",
  "grade",
  "review",
  "progress",
  "correction",
];

/**
 * 提交前核对身份历史：删除的 ID 永久保留，恢复只能恢复登记中的原任务。
 * `restore_id` 是本次动作里正在恢复的任务 ID。
 */
export function reconcileIdentities(before: AppData, after: AppData, restoreId: string | null): void {
  const oldActive = activeIdentities(before);
  const newActive = activeIdentities(after);
  const entries = new Map<string, Identity>();
  for (const record of [...before.identities, ...after.identities]) {
    const old = entries.get(record.id);
    if (old !== undefined) {
      if (old.kind !== record.kind) {
        throw new AppError("历史 ID 不能转用于另一种实体");
      }
      old.retired = old.retired || record.retired;
      if (old.restoreTask === null) {
        old.restoreTask = record.restoreTask;
      }
    } else {
      entries.set(record.id, { ...record, restoreTask: record.restoreTask });
    }
  }
  for (const [id, kind] of oldActive) {
    if (!entries.has(id)) {
      entries.set(id, { id, kind, retired: false, restoreTask: null });
    }
  }
  // 已删除任务只能通过历史专注记录可见。
  const visit = (source: AppData, live: Map<string, string>): void => {
    for (const session of source.sessions) {
      const taskId = session.taskId;
      if (taskId === null) continue;
      const record = entries.get(taskId);
      if (record !== undefined) {
        if (record.kind !== "task") {
          throw new AppError("历史任务引用的 ID 与其他实体冲突");
        }
      } else {
        entries.set(taskId, {
          id: taskId,
          kind: "task",
          retired: !live.has(taskId),
          restoreTask: null,
        });
      }
    }
  };
  visit(before, oldActive);
  visit(after, newActive);
  for (const [id, kind] of newActive) {
    const record = entries.get(id);
    if (record !== undefined) {
      if (record.kind !== kind) {
        throw new AppError("历史 ID 不能被其他实体复用");
      }
      if (record.retired) {
        const sameTask = restoreId === id && kind === "task";
        if (!sameTask) {
          throw new AppError("历史 ID 已被永久保留，不能用于新建或导入其他实体");
        }
        record.retired = false;
        record.restoreTask = null;
      }
    } else {
      entries.set(id, { id, kind, retired: false, restoreTask: null });
    }
  }
  for (const record of entries.values()) {
    if (!newActive.has(record.id)) {
      record.retired = true;
      if (record.kind === "task") {
        const task = before.tasks.find((t) => t.id === record.id);
        if (task !== undefined) {
          record.restoreTask = JSON.stringify(serializeTask(task));
        }
      }
    }
  }
  const records = [...entries.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  after.identities = records;
}

export function validateIdentities(data: AppData): void {
  const current = activeIdentities(data);
  const seen = new Map<string, true>();
  if (data.identities.length > 1000000) {
    throw new AppError("ID 历史数量超出限制");
  }
  for (const record of data.identities) {
    if (
      record.id.trim().length === 0 ||
      utf8Len(record.id) > 200 ||
      seen.has(record.id) ||
      !ALLOWED_KINDS.includes(record.kind)
    ) {
      throw new AppError("无效的 ID 历史登记");
    }
    seen.set(record.id, true);
    // 退休状态由 reconcile 检查，允许已验证的撤销候选存在。
    if (current.has(record.id) && current.get(record.id) !== record.kind) {
      throw new AppError("历史 ID 类型冲突");
    }
    if (record.restoreTask !== null) {
      let task;
      try {
        task = parseTask(JSON.parse(record.restoreTask));
      } catch {
        throw new AppError("无效的任务恢复记录");
      }
      if (record.kind !== "task" || task.id !== record.id || !record.retired) {
        throw new AppError("任务恢复记录与 ID 登记不一致");
      }
    }
  }
}
