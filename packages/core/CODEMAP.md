# packages/core — 领域核心地图

`crates/core` 的语义级 TypeScript 移植，零运行时依赖、纯 ESM。外部 JSON 形状（camelCase、
`YYYY-MM-DD`、`HH:MM`、Unix 秒）见 [docs/PLAN_FORMAT.md](../../docs/PLAN_FORMAT.md)、
[docs/BACKUP_FORMAT.md](../../docs/BACKUP_FORMAT.md)；进程间消费方见 [API.md](../../API.md)。

## 读代码顺序

| 想了解 | 先读 | 再看 |
| --- | --- | --- |
| 数据模型与字段语义 | `model.ts`（Task/Project/Habit/Vision/Block/Template/Settings/Timer/Session/Lock/Stats） | `lib.ts` 的解析/序列化/校验 |
| 提交动作与不变量 | `engine.ts`（`Engine.open/fromData/dispatch/apply`、持久化与快照） | `lib.ts` 的 `Action` union 与 `AppData` 方法 |
| 校验/保护规则 | `lib.ts`（`parseAppData`/`validate`/严格模式） | `errors.ts`、`guard.ts` |
| 计时/提醒/自动开始 | `reminders.ts` | `engine.ts` 的 tick 调用方（runtime） |
| 模板与印刷 | `templates.ts` | `plan.ts` |
| 计划文件 v6 | `plan.ts` | `docs/PLAN_FORMAT.md` |
| 习惯/愿景/身份 | `habits.ts`、`identities.ts` | `lib.ts` 的 `reconcileIdentities` |
| 课表/阻塞时段/并行判定 | `blocks.ts` | `diagnostics.ts`（冲突/容量信号） |
| 定时锁机 | `lock.ts` | `guard.ts`（白名单匹配） |
| 教学域（项目/课程/作业/批改/复盘/学情） | `education.ts`、`teaching_tasks.ts`、`learning.ts` | `docs/EDUCATION.md` |
| 统计/诊断 | `diagnostics.ts`、`learning.ts` | `model.ts` 的 `Stats`/`DayStat` |
| 旧数据迁移 | `migration.ts` | `scripts/export-sqlite.mjs` |

## 目录

| 路径 | 内容 |
| --- | --- |
| `src/` | 21 个模块，`index.ts` 是唯一公开入口；模块间只允许单向依赖（index 汇总导出） |
| `test/` | vitest：逐条移植 crates/core 的测试（core/education/templates/engine-store），`pnpm core:test` |

## 约定

- 时间只进不出：函数参数用 `at: number`（Unix 秒），日期字符串只做边界表示。
- 校验失败抛 `AppError`（中文可读信息）；禁止静默修正用户数据。
- 保护/严格规则集中在 `lib.ts` 的 `apply` 前置判断，任何入口（HTTP/MCP/UI dispatch）共用。
- 改模型或 JSON 形状：同步 `docs/*.schema.json`、`docs/plan.example.json`、`scripts/export-sqlite`、
  runtime `data-files.mjs` 与测试；`deny_unknown_fields` 等价行为由 `rejectUnknown` 保证。
