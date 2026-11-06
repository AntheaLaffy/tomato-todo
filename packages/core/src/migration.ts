//! 仅本地 v3→v4 转换：交换文件按当前版本严格校验，不走迁移路径。
//! 对应 crates/core/src/migration.rs（仅文件格式语义）。

import { AppError } from "./errors";
import { dateAt, now } from "./time";
import { parseAppData, parseTask, serializeTask } from "./lib";

function upgradeTaskValue(task: Record<string, unknown>, today: string): void {
  const date =
    typeof task["createdAt"] === "number"
      ? dateAt(task["createdAt"] as number)
      : today;
  delete task["goalId"];
  delete task["nodeId"];
  if (task["dueDate"] === undefined || task["dueDate"] === null) {
    task["dueDate"] = date;
  }
}

/**
 * 读取本地存储：v3 一次性转换（移除目标主线、补齐日期），v4 直接严格解析。
 * 转换失败原文件保留（由调用方保证不写回）。
 */
export function readLocalData(raw: string): import("./lib").AppData {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (e) {
    throw new AppError(`数据读取失败，原文件已保留：${String(e)}`);
  }
  if (!isObject(value)) {
    throw new AppError("数据读取失败，原文件已保留：无效的本地数据");
  }
  if (value["version"] === 3) {
    const today = dateAt(now());
    value["version"] = 4;
    delete value["goals"];
    delete value["nodeBindings"];
    delete value["signalEvents"];
    const tasks = value["tasks"];
    if (Array.isArray(tasks)) {
      for (const task of tasks) {
        if (isObject(task)) upgradeTaskValue(task, today);
      }
    }
    const templates = value["templates"];
    if (Array.isArray(templates)) {
      for (const template of templates) {
        if (!isObject(template)) continue;
        const shape = template["shape"];
        if (isObject(shape)) delete shape["goalId"];
        const printing = template["printing"];
        if (
          isObject(printing) &&
          printing["kind"] === "once" &&
          (printing["date"] === null || printing["date"] === undefined)
        ) {
          printing["date"] = today;
        }
      }
    }
    const prints = value["prints"];
    if (Array.isArray(prints)) {
      value["prints"] = prints.filter((p) => isObject(p) && p["date"] !== null);
    }
    const visions = value["visions"];
    if (Array.isArray(visions)) {
      for (const vision of visions) {
        if (isObject(vision)) delete vision["goalId"];
      }
    }
    const ids = value["identities"];
    if (Array.isArray(ids)) {
      value["identities"] = ids.filter(
        (r) =>
          isObject(r) &&
          !["goal", "node", "signal"].includes(r["kind"] as string),
      );
      for (const record of value["identities"] as Record<string, unknown>[]) {
        if (typeof record["restoreTask"] === "string") {
          let task: unknown;
          try {
            task = JSON.parse(record["restoreTask"] as string);
          } catch (e) {
            throw new AppError(`数据读取失败，原文件已保留：${String(e)}`);
          }
          if (!isObject(task)) {
            throw new AppError(
              "数据读取失败，原文件已保留：无效的任务恢复记录",
            );
          }
          upgradeTaskValue(task, today);
          // 撤销恢复比较登记 DTO 的序列化（含键序）。
          record["restoreTask"] = JSON.stringify(
            serializeTask(parseTask(task)),
          );
        }
      }
    }
  }
  try {
    return parseAppData(value);
  } catch (e) {
    throw new AppError(
      `数据读取失败，原文件已保留：${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
