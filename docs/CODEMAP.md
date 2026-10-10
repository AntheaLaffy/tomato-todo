---
mode: maintenance
generated_at: 2026-10-10
---

学习计划的可移植文件契约；私人资料不纳入此目录。

## 文件

| File | Domain | Function |
| --- | --- | --- |
| PLAN_FORMAT.md | 文件契约 | v1/v2 时间字段、合并/导出语义、换算和备份边界 |
| plan.schema.json | 文件契约 | JSON Schema 2020-12 结构、时间字段与单项范围校验 |
| plan.example.json | 示例 | 通用可导入计划，不作为默认种子 |
| BACKUP_FORMAT.md | 文件契约 | 完整备份 v1、严格模式/定时锁机字段和恢复时停用规则 |
| backup.schema.json | 文件契约 | 完整备份与旧文件缺省兼容的 JSON Schema |
| backup.example.json | 示例 | 无私人数据、包含停用锁机规则的备份示例 |
