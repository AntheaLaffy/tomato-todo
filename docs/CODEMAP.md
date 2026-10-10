---
mode: maintenance
generated_at: 2026-10-10
---

学习计划的可移植文件契约及领域设计记录；私人资料不纳入此目录。

## 文件

| File | Domain | Function |
| --- | --- | --- |
| NODE_DESIGN.md | 设计记录 | 已实现的主线/节点语义：稳定标识符与执行时间配对、信号裁定、按语义阻断、不可逆结果和当前实现边界 |
| PLAN_FORMAT.md | 文件契约 | v4 主线配置、模板/规则/印刷/实例、滚动预印/手动批次、报废/待补、旧 v1/v2 转换、按 ID 更新配置与 `replace` 整份同步 |
| plan.schema.json | 文件契约 | JSON Schema 2020-12 结构、时间字段与单项范围校验 |
| plan.example.json | 示例 | 通用可导入计划，不作为默认种子 |
| BACKUP_FORMAT.md | 文件契约 | 完整备份 v3、节点裁定、配对、信号、ID 历史、音效开关/音量及严格模式/定时锁机字段和恢复时停用规则 |
| backup.schema.json | 文件契约 | 完整备份与旧文件缺省兼容的 JSON Schema |
| backup.example.json | 示例 | 无私人数据、包含静态模板与停用锁机规则的备份示例 |
| AGENT.md | 设计记录 | 学习助手的后端/登录、异常自动唤醒阈值、权限与记忆、导出→审阅→应用流程、外部 MCP 与隐私边界；联网工具免密钥 |
