// Reading and editing the app's mcp.json — the same file the bundled MCP client
// loads when a session starts. Entries go through the SDK's own validator, so a
// bad server fails here with the reason instead of silently never connecting.
import { join } from "node:path";

const packageUrl = import.meta.resolve("@earendil-works/pi-coding-agent");
const configUrl = new URL("./extensions/mcp/config.js", packageUrl);
const serversUrl = new URL("./core/mcp-servers.js", packageUrl);
// The MCP extension reads its config synchronously at session start, so the
// modules are loaded once here instead of per call.
const { loadMcpConfig, addMcpServerConfig, removeMcpServerConfig } = await import(configUrl);
const { validateMcpServerConfig } = await import(serversUrl);

/** Compact, model-facing view of what a loaded config defines. */
export function mcpServersView(loaded) {
  return {
    servers: loaded.servers.map((entry) => ({
      name: entry.name,
      enabled: entry.config.enabled !== false,
      exposure: entry.config.exposure ?? "codemode",
      transport: "command" in entry.config ? "stdio" : "http",
      target:
        "command" in entry.config
          ? [entry.config.command, ...(entry.config.args ?? [])].join(" ")
          : entry.config.url,
      description: entry.config.description,
      source: entry.source,
    })),
    errors: loaded.errors,
  };
}

/**
 * The app's own MCP configuration. Only the global `mcp.json` next to the agent
 * state counts: the workspace is model-writable and must never define servers.
 */
export function loadAppMcpConfig({ agentDir, cwd }) {
  return loadMcpConfig({ agentDir, cwd, projectTrusted: false });
}

/** Manage the app's MCP servers the way `codex mcp add/list/remove` does. */
export async function mcpCommand({ agentDir, cwd, action, server }) {
  const file = join(agentDir, "mcp.json");
  const view = () => mcpServersView(loadAppMcpConfig({ agentDir, cwd }));
  if (action === "list") return view();
  const name = String(server?.name ?? "").trim();
  if (!name) throw new Error("缺少服务器名称");
  if (action === "add") {
    const { name: _name, ...rest } = server;
    const invalid = validateMcpServerConfig(name, rest);
    if (typeof invalid === "string") throw new Error(invalid);
    const replaced = addMcpServerConfig(file, name, invalid);
    return { ...view(), [replaced ? "replaced" : "added"]: name };
  }
  if (action === "remove") {
    if (!removeMcpServerConfig(file, name)) throw new Error(`没有名为 ${name} 的服务器`);
    return { ...view(), removed: name };
  }
  throw new Error(`未知的 MCP 操作：${action}`);
}
