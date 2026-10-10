---
name: tomato-workspace
description: 在私有 coding 工作区用脚本批量处理导出的计划或备份；适合重排、按规则生成或跨引用计算的大改动，用 read/write/edit/bash/grep/find 与 codemode/tool_search，再 stage_file 挂接来源并审阅。
---

patch_file 适合已知路径、一次不超过 200 项的精确改动。需要重排、按规则生成、跨引用计算或反复试错时，改用工作区脚本；不管走哪条路，都以「挂接来源 → 审阅 → 用户应用」收尾，你没有直接修改软件的工具。

工作区边界（脚本和工具都在其中）：
- 写只能落在 workspace/coding，工具链与依赖装在持久的 `/tools`（跨调用保留，`/tmp` 不保留）；`/workspace` 只读，导出文件在那里。终端已放开网络：需要依赖或工具链时直接装（npm / pip / rustup / cargo），不要在缺库时硬凑或绕过，安装后把可复现命令写进交付。
- 权限由用户在设置里决定：「仅工作区」（默认）写入只落 `coding/` 与 `/tools`；「完整访问」不套沙箱、以用户身份运行，可改工作区之外的文件。完整访问下要改项目之外的东西时先向用户确认，不把“能改”当成“应该改”。
- 不把私人课表、备考资料、密钥或令牌写进脚本或临时文件；脚本只服务于这一次改动，用完可以丢弃。
- 不要尝试把软件数据库或工作区之外的文件读进来；要新工具链就装进 `/tools`，不要污染 `/workspace`。安装和构建可能耗时，分步进行，并在交付里写清可复现的命令。

流程：
1. export_plan（只改安排，保留进度与裁定）或 export_backup（需要历史、设置或完整重建时）。用新的 ASCII `.json` 文件名。
2. read_skill tomato-files，读 references/PLAN_FORMAT.md 或 references/BACKUP_FORMAT.md，必要时读对应 schema；节点调整读 references/NODE_DESIGN.md。按规范生成，不凭记忆猜字段。
3. 在 coding/ 读 `/workspace/<导出名>.json`，用 node 或脚本生成候选 JSON。保持稳定 ID：匹配 ID、不重新编号、不回收已删除 ID、不改写完成记录、专注时长或成功/失败裁定。
4. stage_file(name, source, originName) 把候选挂到真实来源；不要手工伪造 `.origin` 或来源指纹。
5. review_file 校验并给出具体差异与导入影响；来源冲突就重新导出，把“变更意图”重放到最新文件，而不是恢复旧状态。
6. 向用户交代：文件名、具体变化、理由、未确认假设与导入影响。应用由界面「应用修改」按钮完成。

工具选择：
- 小改动：read_file + patch_file，原子、易回滚。
- 大改动：写出候选文件再 stage_file；用 grep/find 在 `/workspace` 里定位，用 codemode 批量调用只读工具，用 tool_search 找不熟悉工具的正确名字与参数。
- 只读类工具可以多用；写类工具只在 coding/，一次推进一件事，改完先自查再交给 review_file。

话术：给出可复核的差异与理由，不用“已经帮你改好”这类说法；把事实、推断和待确认分开。
