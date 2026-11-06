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

## 阶段 6（「整个 DSH 装番茄皮肤」）——lead 记录

- 目标：插件加载后 DSH 本体就是番茄 Todo（皮肤 + 氛围 + 九页主视图 + 沉浸专注），而非打开面板。
- 架构：`plugin/src/client/`（entry→plugin→skin/app/pages/shared），esbuild 出 `plugin/client.js`；
  `pnpm build:client` / `pnpm check:client`（假 DOM + 真 React 逐页渲染）/ `check:client:live`（真实 state）。
- 皮肤：`skin/theme.js` 覆盖 134 个 `--dsw-alias-*`（overrideTokens，不动用户明暗偏好）；
  `skin/ambient.js` 两层氛围（body 地面层 + `shell.overlay` order −1000 天空层，因 AppFrame 不透明）；
  品牌位（sidebar.brand.mark/name、hero.mark）番茄化。
- 主视图：`main` panel key `tomato`（`app/frame.js` 九页导航）+ `sidebar.panellist` 入口 +
  `shell.overlay` HUD/沉浸（order 900）+ `conversation.composer.dock` 入口卡。
- 数据面：`GET /api/state`（默认裁剪 identities/资源明细，228KB/gzip52KB；`?full=1` 全量）+
  `POST /api/dispatch`（core Action）+ `GET /api/export/{plan,backup}`；runtime engine 换成 core 适配层。
- 数据：真实导入 70 任务/110 会话/6105 身份/6 项目/13 课表/教育域；旧 sqlite 未动，备份在
  `~/.local/share/studio.tomato.todo/backups/import-*`。
- 并行：6 个 depth-1（data-runtime / skin-art / pages-focus / pages-time / pages-sys / immersive-ui），
  各自开 depth-2；共享工作区 + 写作用域隔离；lead 负责 shared/app 装配、derive、冒烟门禁与集成构建。
- 待办：用户在真实 GUI 验收观感（天空层水印感、两档红、HUD 与 DSH 右上角间距、暗色）；
  旧版遗留：模板/印刷对话框、应用枚举端点、personaBackdrop 开关接线、多时段习惯编辑、托盘/代理不迁移。
