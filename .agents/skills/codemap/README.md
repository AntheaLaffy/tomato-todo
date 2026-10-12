# codemap-skill

**中文** | [English](README_EN.md)

生成和维护层级化 `CODEMAP.md`，让 agent 通过任务和功能域定位代码。超过 1000 行的文件可配套 `<filename>.analysis.md`，按功能定位行范围。

## 使用

在支持 skills 的 agent 中请求“索引这个项目”或“更新受影响的 CODEMAP”。学习模式保持源码只读；维护模式沿用已有范围与格式，增量更新地图。仅在需求无法确定模式或范围时询问；并行 agent 按授权和实际收益选用。

从本仓库根目录安装完整目录，例如：

```bash
mkdir -p ~/.claude/skills
cp -a codemap ~/.claude/skills/
```

安装到 Codex 时可将目的目录换为 `~/.codex/skills/`。保留 `references/`，技能正文会按需引用格式和协议说明。

## 导航与维护

- 先匹配 Task Guide 的 Target；Also Check 仅在任务、当前代码证据或公开契约影响需要时读取。
- 未命中任务时按 Domain 逐层进入；大文件先定位 Feature Index 的行范围。
- 接口契约需要时读 imports，公开签名或语义改变时查 consumers；批量读取前去重、筛选。
- 根地图声明范围、排除项和仅保留边界的目录。范围内源码与本层权威条目一一对应，包括重导出文件。
- 变更后评估增删改，核对职责、接口、依赖和行范围；纯内部等价修改须确认索引仍准确。退役依据来自当前需求、替代实现和消费者迁移。

Git、rg 提供差异和文本候选，ast-grep 按需提取结构或预览批量改写，语言服务器查询真实符号关系；agent 判断职责与影响。完整结果留在工具侧，优先返回路径、行号与必要片段。

## 与 project-maintenance 协作

codemap 负责地图结构、范围和导航；project-maintenance 负责实现、测试、文档和构建路线的退役、产品验证及审查状态。日常维护沿用现有地图，只加载当前任务需要的说明。

- [技能入口](SKILL.md)
- [地图与大文件格式](references/format.md)
- [项目导航协议](references/protocol.md)

[MIT License](LICENSE)
