# LEAD 台账（lead 自用，代理不要读写）

## 活跃子代理（上限 8）
| 流 | 代理 | 工作区/分支 | 状态 |
| --- | --- | --- | --- |
| core 父 | 1bdc3e97 | tomato-ts-core | 运行中（基础契约层→其余模块） |
| core-education 兄弟 | 0080b119 | tomato-ts-core-edu | 运行中（education/learning/teaching_tasks） |
| runtime 父 | d9199169 | tomato-ts-runtime | 运行中（types/engine/storage/timer/bin） |
| runtime-http 兄弟 | 73a9a521 | tomato-ts-runtime-http | 运行中（server/api/mcp） |
| runtime-guard 兄弟 | 81b3f7f7 | tomato-ts-runtime-guard | 运行中（guard-client/--guard-status） |
| guard 父 | 311ea59e | tomato-ts-guard | 运行中（spine/x11/http/notify） |
| guard-wayland 兄弟 | 6b28430f | tomato-ts-guard-wayland | 运行中（wayland/wayland_surface/shell） |
| guard-win 兄弟 | 00fffce3 | tomato-ts-guard-win | 运行中（win32） |
| plugin 父 | aed3cf66 | tomato-ts-plugin | 已结束（host 半 + 面板框架已完成，无法唤醒） |

## 排队待派（有子代理结束即补派）
1. guard-mac 兄弟 → tomato-ts-guard-mac（crates/guard/src/macos.rs，check aarch64-apple-darwin）
2. docs → tomato-ts-docs（README/CONTRIBUTING/docs/CHANGELOG 改写，删 docs/AGENT.md）
3. tooling → tomato-ts-tooling（scripts/export-sqlite.mjs、scripts/install.mjs、packaging/aur、.github/ci）
4. plugin-fin → tomato-ts-plugin-fin（从 tomato-ts-plugin 磁盘状态续写 client.js 四页签 + README + 阶段3）

## 关键事实
- send_message 无法到达任何子代理（运行中/已结束都不行），只能靠子代理主动汇报；已用 LEAD.md 协调文件（core/runtime/guard 父工作区各一份）传达拆包决定。
- 子代理 delegation depth 1/1 已耗尽，它们不能自己再派子代理；所有并行都走 lead 派发。
- 已派兄弟的写入范围与父代理文件不相交；合并顺序：先 merge 兄弟分支再全量测试。

## 合并检查清单（tomato-ts-rewrite）
- [ ] git merge tomato-ts-core、tomato-ts-core-edu → core 全量 vitest + tsc
- [ ] git merge tomato-ts-runtime、tomato-ts-runtime-http、tomato-ts-runtime-guard → node --test 全量
- [ ] git merge tomato-ts-guard、tomato-ts-guard-wayland/-win/-mac → cargo check --workspace?（guard 独立 crate）+ 单测
- [ ] git merge tomato-ts-plugin、tomato-ts-plugin-fin → node --check；lead 用 plugin_manager install_bundle 装 plugin/ 验证（MCP 行指向 runtime）
- [ ] docs/tooling 合并；删旧栈（agent/ crates/agent crates/preview src/ src-tauri/ tests/agent*）；根 CODEMAP 更新
- [ ] pnpm build:runtime（esbuild 打 core 进 runtime/vendor）；scripts/export-sqlite.mjs 在副本上演练
