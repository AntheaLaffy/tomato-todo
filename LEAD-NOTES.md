# LEAD 台账（lead 自用，代理不要读写）——三级并行版

## 二级领导架构（depth 1 组长 → depth 2 工人，全树预算 ≤128）
| 组长 | id | 工作区 | 负责 | 计划 depth-2 |
| --- | --- | --- | --- | --- |
| core-lead | 965a8d75 | tomato-ts-core | tsc 修绿 + 3 份测试移植 + 语义核对 | 测试A(core.test.ts)/B(education)/C(templates) |
| guard-lead | 067682a6 | tomato-ts-guard | spine 修绿 + 平台真移植 + merge macos | W(wayland+shell)/WIN(win32) |
| plugin-lead | 7c79591b | tomato-ts-plugin | 四页签 + 组装 client.js + README + 复验 | tabs-a(Focus/Tasks)/tabs-b(Stats/Settings) |
| docs-lead | 2b6145bb | tomato-ts-docs | README/CONTRIBUTING/docs/CHANGELOG 改写 | H(HANDBOOK 助手章删除) |
| tooling-lead | 7b5ec1a2 | tomato-ts-tooling | export-sqlite/install/packaging/CI | E/I/C 三子 |

## 已完成（集成分支 tomato-ts-rewrite）
- runtime 全量（38 测试父版 + 22 测试 guard-client 兄弟版，合并后 60/60 绿；--guard-status、/health.guard、/api/today dueCount/focusMinutes 已接线）commit a20f2f9
- guard-mac 移植（tomato-ts-guard-mac 分支）
- 基础契约：MIGRATION.md / API.md / LEAD-NOTES.md / scripts/build-runtime.mjs / 根 package.json

## 合并检查清单（组长汇报完成后）
- [ ] core：merge 三个测试分支 → 全量 vitest + tsc → merge tomato-ts-core
- [ ] guard：merge macos/w2/win2 → cargo build+test → merge tomato-ts-guard
- [ ] plugin：组装复验 → merge tomato-ts-plugin → lead 安装验证（plugin_manager install_bundle）
- [ ] docs / tooling 合并
- [ ] 删旧栈（agent/ crates/agent crates/preview src/ src-tauri/ tests/agent*）→ 根 CODEMAP
- [ ] pnpm build:runtime；export-sqlite 副本演练；旧版本分支 worktree 清理

## 关键机制
- 通信：agent_message（子→root 汇报；组长→工人同样用 agent_message）
- 深度：depth 1 可开 depth 2；depth 2 是尽头
- 隔离：每个 depth-2 工人一个嵌套 worktree（组长先 commit 基线再 git worktree add）
