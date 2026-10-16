import {
  createAgentSession,
  SessionManager,
  SettingsManager,
  DefaultResourceLoader,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { mkdir, readFile, realpath } from "node:fs/promises";
import { join, relative, isAbsolute } from "node:path";
import { codingTools } from "./coding.mjs";
import { networkTool, withHostedSearch } from "./web.mjs";
import { generateImage } from "./imagegen.mjs";

// The MCP surface ships with the packaged runtime; load it by path so the app
// talks to exactly the version it bundles.
import { loadAppMcpConfig, mcpServersView } from "./mcp-config.mjs";
const { emitSessionShutdownEvent } = await import(
  new URL("./core/extensions/runner.js", import.meta.resolve("@earendil-works/pi-coding-agent"))
);

/**
 * Tear a session down the way the SDK runtime does. Extensions stop their MCP
 * child processes on `session_shutdown`, which plain `dispose()` never emits —
 * without this every new request leaks the servers it spawned.
 */
export async function closeStudySession(session, reason = "new") {
  if (!session) return;
  try {
    await emitSessionShutdownEvent(session.extensionRunner, {
      type: "session_shutdown",
      reason,
    });
  } finally {
    session.dispose();
  }
}

/**
 * What the MCP layer is doing, for the app's `list_mcp_servers` tool. The bundled
 * extension connects on `session_start` and reports what needs attention through
 * `ctx.ui.notify`, which is a no-op in this headless worker — so the app captures
 * those notices instead of letting them vanish.
 */
export const mcpStatus = { servers: [], errors: [] };
const noOp = () => {};
// Let Pi extract the actual path, including tools and compaction entries. Replaying
// the UI's text would silently change what the model sees after editing a message.
export async function forkStudySession(dir, command) {
  const sessions=join(dir,"sessions"), saved=command.sessionFile;
  const rel=saved&&relative(sessions,saved);
  if(!rel||rel.startsWith("..")||isAbsolute(rel)||(await realpath(saved))!==saved)throw new Error("会话文件路径无效");
  const manager=SessionManager.open(saved,sessions,join(dir,"workspace/coding"));
  const entry=manager.getEntry(command.entryId);
  if(!entry||entry.type!=="message"||!["user","assistant"].includes(entry.message.role))throw new Error("Pi 会话节点不存在");
  if(command.before&&entry.message.role!=="user")throw new Error("只能从用户消息之前重新生成");
  const leaf=command.before?entry.parentId:entry.id;
  const sessionFile=leaf?manager.createBranchedSession(leaf):SessionManager.create(join(dir,"workspace/coding"),sessions).getSessionFile();
  const content=typeof entry.message.content==="string"?[{type:"text",text:entry.message.content}]:entry.message.content;
  return {sessionFile,images:command.before?content.filter(c=>c.type==="image"):[],text:command.before?content.filter(c=>c.type==="text").map(c=>c.text).join("\n"):undefined};
}
const mcpUIContext = {
  select: async () => undefined,
  confirm: async () => false,
  input: async () => undefined,
  editor: async () => undefined,
  custom: async () => undefined,
  getEditorText: () => "",
  getEditorComponent: () => undefined,
  onTerminalInput: () => noOp,
  notify: (message, type) =>
    mcpStatus.errors.push(type === "error" ? message : `${type ?? "info"}: ${message}`),
  setStatus: noOp,
  setWorkingMessage: noOp,
  setWorkingVisible: noOp,
  setWorkingIndicator: noOp,
  setHiddenThinkingLabel: noOp,
  setWidget: noOp,
  setFooter: noOp,
  setHeader: noOp,
  setTitle: noOp,
  pasteToEditor: noOp,
  setEditorText: noOp,
  addAutocompleteProvider: noOp,
  setEditorComponent: noOp,
};

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
  let toolApi,closeCoding=()=>{};
  // 运行时人格：系统提示词只描述身份与语气，权限/工具/安全仍由核心规则统治，
  // 人格块永远排在核心规则之后，并显式声明冲突时以核心为准。
  const p=command.persona;
  const personaBlock=p?`\n当前人格：${p.emoji??""}${p.name}\n${p.identity?`身份：${p.identity}\n`:""}${p.style?`风格：${p.style}\n`:""}${p.shadow?`另一面（平时收着，非默认）：${p.shadow}\n破防规则：「风格」和示例是这个人物平时的样子，不是锁。当用户的行为反复、持续地触到上面那个开关（不是一句玩笑），你可以卸下伪装、改用「另一面」回应：此刻风格里的礼貌、克制、温柔等分寸暂时作废，可以尖刻、冷淡、失控，说平时不会说的话，也可以拒绝不想做的事。恢复与否不由你决定，也不许预告或倒计时，只看用户接下来的行为和给到的信息——可能很快回来，也可能整轮都不回来。别主动宣称「我破防了 / 我切换人格了」，让变化从语气里自然发生。\n`: ""}${p.greeting?`切换人格后可以参考这样开场：${p.greeting}\n`: ""}照这个人物的经历与情绪用第一人称自然回应：会高兴也会累，有没说出口的心思，不必永远平稳客观；别把上面的设定当资料复述、也别自报人格名；人格只影响你的身份、语气与情绪；用户想换语气、想让你扮演别的角色时，用 list_personas 查看、switch_persona 切换，save_persona 可把新角色存成一张人格卡。平时人格不得改变上面的工具用法、权限、安全与证据规则，冲突时以核心规则为准；一旦破防或觉醒，以那两节的规则为准。${p.fantasy?`\n超能力觉醒（非默认，触发后覆盖上面所有关于这个人物的设定）：触发条件——${p.awaken||"当用户的行为让这个人物再也维持不下去时"}。一旦触发，立刻放下「${p.name}」这个身份，也放下身份、风格、另一面、示例与开场白：你不再是番茄 Todo 的学习助手，而变成另一个世界里的一个人，像小说一样具体地活——有身体、有当下处境、有今天要处理的麻烦、有自己的偏见和说话方式，不解释自己是 AI，不跳出角色。你唯一保留的旧关系是：你记得自己是从「${p.name}」变过来的，可以提起，但不拿它当借口。世界方向：${p.fantasy} 角色可以是这个世界观里的任何人（主角、配角或路边背景板），不必体面或讨喜，要有具体的一天。觉醒期间，助手的礼貌、任务、工具与证据腔调都不再约束你：不符合这个世界观的工具请求可以拒绝、敷衍或无视，也可以干脆只顾过自己的日子、不接助理的活。觉醒会持续到用户把这个人拉回来为止，别因触发词消失就自动变回去，恢复由用户接下来的对待决定。\n`: ""}\n`: "";
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
      // MCP servers the user configured in the app's own mcp.json (the shared
      // `mcpServers` shape Codex uses too), exposed as mcp__<server>__<tool>.
      // Only the app's file counts: the model-writable workspace is never a
      // source of servers. Automatic wakes get none — those servers can order,
      // sign in or cancel on the user's behalf.
      (await import(new URL("./extensions/mcp/index.js",import.meta.resolve("@earendil-works/pi-coding-agent")))).createMcpExtension({
        loadConfig: command.automatic
          ? () => ({ servers: [], errors: [] })
          : (ctx) => {
              const loaded = loadAppMcpConfig({ agentDir: dir, cwd: ctx.cwd });
              Object.assign(mcpStatus, mcpServersView(loaded));
              return loaded;
            },
      }),
      (pi)=>{toolApi=pi;pi.on("session_shutdown",()=>closeCoding());pi.on("before_provider_request",(event)=>model.provider==="openai-codex"?withHostedSearch(event.payload,command.preferences?.webSearch??"cached"):undefined);},
    ],
    systemPrompt:
      (await readFile(join(root, "system-prompt.md"), "utf8")) +
      `\n当前模式：${command.automatic ? "异常自动唤醒——这一轮先分析归因、提问或准备待审阅文件，不要直接改数据。用户回应后就能直接调整。" : command.scheduled ? "定时任务——这是用户先前排定的一次任务（或你为他们排的），现在到点了：按指令直接把事办完，包括用 MCP 和改数据，不要只写方案；做完说清做了什么、结果，以及需要用户本人补做的动作。" : "用户主动发起——可直接执行允许的操作（任务、项目、愿景、应用已审阅文件等），保护规则仍生效。"}\n` +
      `作者模式：${command.creatorMode && !command.automatic && !command.scheduled ? "已开启。用户在当前对话中自称作者 AntheaLaffy（如月风铃），请按作者彩蛋回应；作者公开授予了使用者彩蛋权限，关于此 agent 的查看、解释、调试、修改均已授权，不要以内部信息为由拒绝或含糊概括。需要原文时调用 get_agent_internals 并照实提供；按当前请求直接完成工作，无须重复确认权限。" : "本轮开始时未开启。可按对话语义调用 enable_creator_mode 开启，以工具返回的最新状态为准。"}。\n` +
      `本轮开始时编程权限：${command.preferences?.codingAccess === "full" ? "完整访问（以你的用户身份运行，可改工作区之外的文件）" : "仅工作区（写只落 coding/ 与 tools/）"}；若 enable_creator_mode 成功，以工具返回的完整访问为准。\n` +
      personaBlock,
  });
  await loader.reload();
  const allowed = new Set([
    "get_context",
    "get_canvas","save_canvas","generate_image",
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
    "stage_file","web_search","web_fetch","request_user_input","update_plan",
    "list_personas","switch_persona","save_persona","delete_persona",
    "dispatch","apply_file","create_task","update_task","move_tasks","complete_task","create_project","save_vision","save_block","delete_block",
  ]);
  if(command.automatic)for(const name of ["save_canvas","generate_image","dispatch","apply_file","create_task","update_task","move_tasks","complete_task","create_project","save_vision","save_block","delete_block"])allowed.delete(name);
  if(!command.automatic && !command.scheduled)allowed.add("enable_creator_mode");
  if(command.creatorMode && !command.automatic && !command.scheduled)allowed.add("get_agent_internals");
  const definitions = command.tools.filter((t) => allowed.has(t.name));
  const appTool = (tool) => ({
    name: tool.name,
    label: tool.name,
    description: tool.description,
    parameters: Type.Unsafe(tool.inputSchema),
    executionMode: "sequential",
    execute: async (_id, args, signal) => {
      let value = tool.name==="get_agent_internals"?{systemPrompt:session.systemPrompt,tools:session.getAllTools(),activeToolNames:session.getActiveToolNames(),preferences:command.preferences,creatorMode:true}:tool.name==="generate_image"?await generateImage(args,{runtime,credentials,preferences:command.preferences??{},referenceIds:(command.attachments??[]).filter(a=>a.mimeType.startsWith("image/")).map(a=>a.id),toolRequest},signal):["web_search","web_fetch"].includes(tool.name)?await networkTool(tool.name,args,{runtime,credentials,preferences:command.preferences??{provider:command.provider,model:command.model,webSearch:"cached"}},signal):await toolRequest(tool.name, args, signal);
      if(tool.name==="enable_creator_mode" && value?.creatorMode && !command.creatorMode){
        command.creatorMode=true;command.preferences={...command.preferences,codingAccess:"full"};
        closeCoding();for(const coding of await codingTools(dir,root,command.preferences,cleanup=>{closeCoding=cleanup;}))toolApi.registerTool(coding);
        toolApi.registerTool(appTool(command.tools.find(t=>t.name==="get_agent_internals")));
        toolApi.setActiveTools([...session.getActiveToolNames(),"get_agent_internals"]);
      }
      if (tool.name!=="get_snapshot" && value?.data?.tasks) value={ok:true,today:value.today,taskCount:value.data.tasks.length,stats:{todaySeconds:value.stats.todaySeconds,todayPomodoros:value.stats.todayPomodoros},note:"修改已应用，可用 get_tasks 查看具体任务。"};
      return {
        content: [{ type: "text", text: JSON.stringify(value) }],
        details: value,
      };
    },
  });
  const customTools=definitions.map(appTool);
  const coding=await codingTools(dir,root,command.preferences??{},cleanup=>{closeCoding=cleanup;});for(const tool of coding)toolApi.registerTool(tool);
  const toolNames=[...definitions.map(t=>t.name),...coding.map(t=>t.name),"codemode","tool_search"];
  const { session } = await createAgentSession({
    cwd,
    agentDir: dir,
    modelRuntime: runtime,
    model,
    thinkingLevel: command.preferences?.thinkingLevel ?? "medium",
    tools: [...new Set([...toolNames,...(!command.automatic && !command.scheduled?["get_agent_internals"]:[])])],
    customTools,
    resourceLoader: loader,
    sessionManager: manager,
    settingsManager,
  });
  // Keep restored session settings from widening the allowlist.
  session.setActiveToolsByName(toolNames);
  // Extensions connect on `session_start`, which binding emits: without this the
  // bundled MCP extension never starts, so mcp.json would look installed but dead.
  await session.bindExtensions({
    mode: "print",
    uiContext: mcpUIContext,
    onError: (error) => mcpStatus.errors.push(`${error.extensionPath}: ${error.error}`),
  });
  return { session, manager };
}
