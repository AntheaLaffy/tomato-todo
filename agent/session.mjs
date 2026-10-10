import {
  createAgentSession,
  SessionManager,
  SettingsManager,
  DefaultResourceLoader,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { mkdir, readFile } from "node:fs/promises";
import { join, relative, isAbsolute } from "node:path";
import { codingTools } from "./coding.mjs";
import { networkTool, withHostedSearch } from "./web.mjs";

export async function createStudySession({
  runtime,
  dir,
  root,
  command,
  toolRequest,
  credentials,
}) {
  const models = runtime.getModels(command.provider);
  const model = command.model
    ? runtime.getModel(command.provider, command.model)
    : (models.find((m) => m.id === "deepseek-chat") ??
      models.find((m) => !m.id.includes("spark")) ??
      models[0]);
  if (!model) throw new Error("此后端没有可用模型，请在连接配置中选择有效模型");
  if ((command.images?.length ?? 0)>0 && !model.input.includes("image")) throw new Error("所选模型不支持图片，请在连接配置选择支持视觉的模型");
  const cwd = join(dir, "workspace/coding"),
    sessions = join(dir, "sessions");
  await mkdir(cwd, { recursive: true, mode: 0o700 });
  await mkdir(sessions, { recursive: true, mode: 0o700 });
  const saved = command.sessionFile;
  const safe =
    saved &&
    relative(sessions, saved) &&
    !relative(sessions, saved).startsWith("..") &&
    !isAbsolute(relative(sessions, saved));
  const manager = safe
    ? SessionManager.open(saved, sessions, cwd)
    : SessionManager.create(cwd, sessions);
  const settingsManager = SettingsManager.inMemory({
    compaction: { enabled: true },
    retry: { enabled: true, maxRetries: 2 },
    defaultThinkingLevel: "medium",
    cacheWarming: "off",
  });
  const loader = new DefaultResourceLoader({
    cwd,
    agentDir: dir,
    settingsManager,
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    extensionFactories: [
      (await import(new URL("./extensions/codemode/index.js",import.meta.resolve("@earendil-works/pi-coding-agent")))).createCodemodeExtension({models:false,mode:"on",inlineBudget:1500}),
      (await import(new URL("./extensions/tool-search/index.js",import.meta.resolve("@earendil-works/pi-coding-agent")))).createToolSearchExtension(),
      (pi)=>{pi.on("before_provider_request",(event)=>model.provider==="openai-codex"?withHostedSearch(event.payload,command.preferences?.webSearch??"cached"):undefined);},
    ],
    systemPrompt: await readFile(join(root, "system-prompt.md"), "utf8"),
  });
  await loader.reload();
  const allowed = new Set([
    "get_context",
    "get_snapshot",
    "get_tasks",
    "get_memories",
    "remember",
    "read_skill",
    "export_backup",
    "export_plan",
    "read_file",
    "patch_file",
    "review_file",
    "list_files",
    "stage_file","web_search","web_fetch",
    "dispatch","apply_file","create_task","update_task","move_tasks","complete_task","create_project","save_vision",
  ]);
  if(command.automatic)for(const name of ["dispatch","apply_file","create_task","update_task","move_tasks","complete_task","create_project","save_vision"])allowed.delete(name);
  const definitions = command.tools.filter((t) => allowed.has(t.name));
  const customTools = definitions.map((tool) => ({
    name: tool.name,
    label: tool.name,
    description: tool.description,
    parameters: Type.Unsafe(tool.inputSchema),
    executionMode: "sequential",
    execute: async (_id, args, signal) => {
      let value = ["web_search","web_fetch"].includes(tool.name)?await networkTool(tool.name,args,{runtime,credentials,preferences:command.preferences??{provider:command.provider,model:command.model,webSearch:"cached"}},signal):await toolRequest(tool.name, args, signal);
      if (tool.name!=="get_snapshot" && value?.data?.tasks) value={ok:true,today:value.today,taskCount:value.data.tasks.length,stats:{todaySeconds:value.stats.todaySeconds,todayPomodoros:value.stats.todayPomodoros},note:"修改已应用，可用 get_tasks 查看具体任务。"};
      return {
        content: [{ type: "text", text: JSON.stringify(value) }],
        details: value,
      };
    },
  }));
  const coding=await codingTools(dir,root,command.preferences??{});customTools.push(...coding);
  const toolNames=[...definitions.map(t=>t.name),...coding.map(t=>t.name),"codemode","tool_search"];
  const { session } = await createAgentSession({
    cwd,
    agentDir: dir,
    modelRuntime: runtime,
    model,
    tools: toolNames,
    customTools,
    resourceLoader: loader,
    sessionManager: manager,
    settingsManager,
  });
  // Keep restored session settings from widening the allowlist.
  session.setActiveToolsByName(toolNames);
  return { session, manager };
}
