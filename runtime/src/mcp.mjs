// /mcp 与 --mcp 共用的 JSON-RPC 方法骨架：只做 initialize/ping/tools/list/tools/call，
// tools/call 落到引擎桩。拒绝浏览器 Origin 的检查在 HTTP 层（server.mjs）。
import { createHash, timingSafeEqual } from "node:crypto";
import { TOOLS, callTool } from "./tools.mjs";
import { VERSION } from "./version.mjs";

export const SERVER_INFO = { name: "tomato-todo", version: VERSION };

// 中文接管说明：简述接管入口（不再有 Pi 提示词与技能资源）。
export const INSTRUCTIONS =
  "番茄 Todo 接管入口：连接的是运行中的 runtime，共享同一份计划数据（plan.json），不另开数据库。先 get_context 查看今日任务、番茄计时、近期统计与设置。普通任务用 create_task/update_task/move_tasks/complete_task；番茄计时、设置、愿景、课表等单项动作走 dispatch；大批改动走 export_plan/export_backup 导出后在私有工作区编辑。写入同样受计划校验与保护规则约束，不能通过 MCP 紧急解锁或伪造专注记录。";

const SUPPORTED_PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26"];

export function safeEqual(a, b) {
  const ha = createHash("sha256").update(String(a)).digest();
  const hb = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * 执行一个 JSON-RPC 方法。
 * 返回 { ok: true, result } 或 { ok: false, code, message }。
 * tools/call 的工具错误按旧 external.rs 语义包装成 isError 结果（仍属 ok）。
 */
export function mcpMethod(engine, method, params = {}) {
  switch (method) {
    case "initialize":
      return {
        ok: true,
        result: {
          protocolVersion: SUPPORTED_PROTOCOLS.includes(params?.protocolVersion)
            ? params.protocolVersion
            : SUPPORTED_PROTOCOLS[0],
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        },
      };
    case "ping":
      return { ok: true, result: {} };
    case "tools/list":
      return { ok: true, result: { tools: TOOLS } };
    case "tools/call": {
      const name = params?.name;
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) {
        return {
          ok: true,
          result: {
            isError: true,
            content: [{ type: "text", text: `未知 MCP 工具：${String(name)}` }],
          },
        };
      }
      try {
        const value = callTool(engine, name, params?.arguments ?? {});
        const result = {
          content: [{ type: "text", text: JSON.stringify(value) }],
        };
        if (value && typeof value === "object" && !Array.isArray(value)) {
          result.structuredContent = value;
        }
        return { ok: true, result };
      } catch (error) {
        return {
          ok: true,
          result: {
            isError: true,
            content: [{ type: "text", text: String(error?.message ?? error) }],
          },
        };
      }
    }
    default:
      return { ok: false, code: -32601, message: "Method not found" };
  }
}
