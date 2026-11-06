// MCP 工具定义：名称与描述沿用旧 crates/agent/src/tools.rs 的外部工具语义，
// 实现全部落到 runtime 引擎桩（Engine.dispatch / 任务方法 / 导出）。
// 旧 tools.rs 用 `tool(name, description, properties, required, readOnly)` 生成：
// inputSchema { type: object, properties, required, additionalProperties: false }，
// annotations { readOnlyHint, destructiveHint, openWorldHint: false }。

function tool(name, description, properties, required, readOnly) {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: readOnly,
      destructiveHint: !readOnly,
      openWorldHint: false,
    },
  };
}

const exportName = {
  type: "string",
  description: "工作区内的 .json 文件名；不接受目录或绝对路径",
};

export const TOOLS = [
  tool(
    "get_context",
    "获取当前学情摘要、愿景、近期统计、本地异常证据与记忆。首次分析先调用；空记录不代表未学习。",
    {},
    [],
    true,
  ),
  tool(
    "create_task",
    "按用户明确要求创建任务。不要臆测可用时间或估时。",
    {
      title: { type: "string" },
      notes: { type: "string" },
      projectId: { type: ["string", "null"] },
      dueDate: {
        type: "string",
        description: "必填的计划日期，YYYY-MM-DD；提醒时刻另填",
      },
      reminderTime: { type: ["string", "null"] },
      focusMinutes: { type: ["integer", "null"] },
      estimate: { type: "integer", minimum: 1 },
      priority: { type: "integer", minimum: 0, maximum: 3 },
      tags: { type: "array", items: { type: "string" } },
    },
    ["title", "dueDate"],
    false,
  ),
  tool(
    "update_task",
    "按稳定 ID 仅修改指定字段，保留其他配置与完成历史；结构调整使用文件流程。",
    {
      id: { type: "string" },
      changes: {
        type: "object",
        properties: {
          title: { type: "string" },
          notes: { type: "string" },
          projectId: { type: ["string", "null"] },
          dueDate: {
            type: "string",
            description: "必填的计划日期，YYYY-MM-DD；提醒时刻另填",
          },
          reminderTime: { type: ["string", "null"] },
          focusMinutes: { type: ["integer", "null"] },
          estimate: { type: "integer" },
          priority: { type: "integer" },
          tags: { type: "array", items: { type: "string" } },
          scrapMinutes: { type: "integer" },
        },
        additionalProperties: false,
      },
    },
    ["id", "changes"],
    false,
  ),
  tool(
    "move_tasks",
    "将1–100个未完成任务移动到指定日期。可选提醒时间，不指定则保留；整批原子执行。",
    {
      ids: {
        type: "array",
        minItems: 1,
        maxItems: 100,
        items: { type: "string" },
      },
      dueDate: { type: "string" },
      reminderTime: { type: ["string", "null"] },
    },
    ["ids", "dueDate"],
    false,
  ),
  tool(
    "complete_task",
    "按用户明确说明标记完成，已完成时不反复切换，不伪造专注记录。",
    { id: { type: "string" } },
    ["id"],
    false,
  ),
  tool(
    "dispatch",
    '直接执行软件 Action，适合单项操作。用户要求开关角色背景板时，先 get_snapshot 读取完整 data.settings，保留其他字段，设置 personaBackdrop 为布尔值，再提交 {type:"saveSettings",settings:完整设置}。禁止 emergencyUnlock，核心保护/严格规则及原生能力预检仍生效。批量操作优先文件工作流。',
    {
      action: {
        type: "object",
        required: ["type"],
        properties: { type: { type: "string" } },
      },
    },
    ["action"],
    false,
  ),
  tool(
    "export_plan",
    "导出计划 v6；仅改安排时可用，导入保留进度和历史。",
    { name: exportName },
    ["name"],
    false,
  ),
  tool(
    "export_backup",
    "把最新完整备份导出为私有工作文件，返回来源指纹和文件哈希。批量修改优先导出、分段读取、JSON Patch、审阅，再由用户应用。",
    { name: exportName },
    ["name"],
    false,
  ),
];

/** tools/call 落到引擎桩；抛错由上层包装成 isError 结果。 */
export function callTool(engine, name, args) {
  switch (name) {
    case "get_context":
      return engine.getContext();
    case "create_task":
      return engine.createTask(args ?? {});
    case "update_task": {
      const { id, changes } = args ?? {};
      if (typeof id !== "string" || !changes || typeof changes !== "object") {
        throw new Error("需要 id 与 changes");
      }
      return engine.updateTask(id, changes);
    }
    case "move_tasks": {
      const { ids, dueDate, reminderTime } = args ?? {};
      return engine.moveTasks(ids, dueDate, reminderTime);
    }
    case "complete_task": {
      const { id } = args ?? {};
      return engine.completeTask(id);
    }
    case "dispatch":
      return engine.dispatch(args?.action);
    case "export_plan":
      return engine.exportToFile("plan", args?.name);
    case "export_backup":
      return engine.exportToFile("backup", args?.name);
    default:
      throw new Error(`未知工具：${name}`);
  }
}
