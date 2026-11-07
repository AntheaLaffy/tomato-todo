# plugin — DSH 插件包（host + client + 随包技能）

`dsh-plugin-tomato-todo` 的包根。host 半在 Node 里注册 `tomato_*` 工具与技能提供者，
client 半由 esbuild 打成 `client.js`。契约见 [API.md](../API.md)「插件契约」与
[docs/MCP.md](../docs/MCP.md)；使用说明见 [README](README.md)。

## 文件

| File | Domain | Function |
| --- | --- | --- |
| index.js | host 装配 | 插件入口：注册随包技能、把技能软链给其他 agent、注册 13 个转发 Host 工具 + `tomato_today` + `tomato_guard_status` |
| host-tool-specs.js | 工具契约 | **生成物**（`scripts/build-host-tools.mjs`）：从 `runtime/src/tools.mjs` 复制的工具 schema，`pnpm check:host-tools` 检查漂移 |
| skills.js | 技能 | 技能提供者 `tomato-bundled`：读 `skills/` 的 SKILL.md frontmatter，rank 350，插件挂载即可用 |
| link-skills.js | 技能分发 | 把 `skills/` 软链进已存在的 agent 技能根（优先 `~/.agents/skills`）；只操作符号链接，不删真实文件；挂载时调用 |
| link-skills.mjs | 技能分发 CLI | 人工入口：`--dir`/`--all`/`--check`/`--remove`/`--force`/`--relative`/`--dry-run` |
| cordis.patch.yml | 装载 | DSH 插件补丁：只插入 `tomato-dsh` 一行，`tomatoBin` 指向 runtime 可执行文件 |
| package.json | 包契约 | 版本 2.0.0、exports、`files`（含 skills/ 与 locale/*.json）、`dsh.bundle`/`dsh.client` |
| client.js | 构建产物 | **生成物**（`pnpm build:client`）：client 半单文件 IIFE，不手改 |
| icon.svg | 静态资源 | 插件图标（boundary） |
| README.md | 使用说明 | 安装、Host/MCP 分工、技能链接、开发自检与已知局限 |

## 子目录

| Dir | Domain | Purpose |
| --- | --- | --- |
| src/client/ | UI 源码 | 插件 client 半源码（entry/plugin/runtime、skin、app、pages、shared）；局部地图 [src/client/CODEMAP.md](src/client/CODEMAP.md)；`client.js` 由它构建 |
| skills/ | 随包技能 | 六个教学技能的 SKILL.md 与引用/脚本；文件清单见下方「技能文件」 |
| locale/ | 展示语言 | DSH 里的插件标题/描述；文件清单见下方「语言文件」 |
| assets/personas/ | 静态资源 | 角色背景板立绘，随包分发；binary boundary，不在源码导航范围 |

## 语言文件（locale/）

| File | Function |
| --- | --- |
| locale/en.json | 插件标题/描述的英文 `meta.title`/`meta.description`（DSH 读取语言文件的锚点） |
| locale/zh.json | 插件标题/描述的中文 |
| locale/ja.json | 插件标题/描述的日文 |

## 技能文件（skills/）

| File | Skill | Function |
| --- | --- | --- |
| skills/exam-authoring/SKILL.md | exam-authoring | 命题入口：真题质量基准、资料贡献、蓝图、逐题取证、复解与固定评分 |
| skills/exam-authoring/agents/openai.yaml | exam-authoring | Codex 显示名/简介/默认提示，声明 `tomato` MCP 依赖 |
| skills/exam-authoring/references/material-roles.md | exam-authoring | 考纲/真题/教材/讲义/题册/笔记/错题等各类资料的命题价值与核对点 |
| skills/exam-authoring/references/runtime.md | exam-authoring | 番茄 Todo 与独立 Codex 两种环境的取材、工具、保存位置与发布时序 |
| skills/exam-authoring/references/subject-checks.md | exam-authoring | 数学与计算机 408 等分科审校清单 |
| skills/exam-authoring/references/work-products.md | exam-authoring | 蓝图、逐题证据、答案/评分与发布前检查的记录格式 |
| skills/exam-authoring/scripts/check_paper.py | exam-authoring | 结构检查器：题型/数量/总分/来源 ID/时间窗口，不判断答案正确性 |
| skills/exam-teaching/SKILL.md | exam-teaching | 备课、讲解、正式课程与作业、批改、订正与复盘的教学流程 |
| skills/exam-teaching/agents/openai.yaml | exam-teaching | Codex 显示名/简介，声明 `tomato` MCP 依赖 |
| skills/study-diagnosis/SKILL.md | study-diagnosis | 用课程/作业/测验/订正/复测/用时证据诊断困难与超量，提出小步调整 |
| skills/study-diagnosis/agents/openai.yaml | study-diagnosis | Codex 显示名/简介，声明 `tomato` MCP 依赖 |
| skills/study-memory/SKILL.md | study-memory | 把长期学情、目标、偏好与复盘结论写成有来源/确认状态的 progress |
| skills/study-memory/agents/openai.yaml | study-memory | Codex 显示名/简介，声明 `tomato` MCP 依赖 |
| skills/study-planning/SKILL.md | study-planning | 按已确认目标、学情、课表与作息安排/减量/挪动任务并写回同一实例 |
| skills/study-planning/agents/openai.yaml | study-planning | Codex 显示名/简介，声明 `tomato` MCP 依赖 |
| skills/tomato-todo/SKILL.md | tomato-todo | 对话入口：优先 `tomato_*` Host 工具，MCP 断线时的替代与分页读取约定 |
| skills/tomato-todo/agents/openai.yaml | tomato-todo | Codex 显示名/简介，声明 `tomato` MCP 依赖 |
| skills/tomato-todo/references/teaching-contract.md | tomato-todo | `tomato_education` 的 `command.op` 与 @tomato/core 字段快照（含来源/确认规则） |

`references/local-*.md` 是本机私有导航，已被 `.gitignore` 忽略，不随包发布，也不在本表内。
