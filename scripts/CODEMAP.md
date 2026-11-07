---
mode: maintenance
generated_at: 2026-11-07
---

安装、构建、迁移、发布与手册自查脚本；测试入口见 `pnpm test:tools`。每个脚本都自带解释
「为什么存在」的头注释，新增脚本时按同一格式补一行。

## 文件

| File | Domain | Function |
| --- | --- | --- |
| build-client.mjs | 构建 | esbuild 把 `plugin/src/client/**` 打成单入口 `plugin/client.js`（DSH 客户端半只认一个入口） |
| build-host-tools.mjs | 构建 | 从 `runtime/src/tools.mjs` 生成插件自带的 Host 工具 schema（`plugin/host-tool-specs.js`）；`--check` 拒绝与运行时漂移 |
| build-runtime.mjs | 构建 | 把 `@tomato/core` 打进 `runtime/vendor/core.mjs`，让随插件分发的 runtime 不依赖 node_modules |
| smoke-client.mjs | 验证 | 假 DOM + 真 React 把 `plugin/client.js` 跑一遍：slot 注册、主题覆盖、九页渲染 |
| install.mjs | 安装 | Linux 单用户安装 runtime+guard 到 `~/.local/lib/tomato/`，写 systemd user unit 并启用 runtime；`--dry-run`/`--uninstall`，manifest 记录路径以安全卸载 |
| install-desktop-integration.py | 桌面集成 | 安装 GNOME Shell 桥接扩展到用户 XDG 目录，提供启用命令而不自动启用，支持临时 home 与 dry-run |
| export-sqlite.mjs | 迁移 | 一次性把旧 sqlite 库导出为 plan.json 与 backup-v4.json（v3 先按 core 的迁移语义升级；只读打开、原子写、`--force` 覆盖） |
| import-backup.mjs | 迁移 | 把旧完整备份 v4 与现有 plan.json 合并进 runtime 数据目录；幂等、失败不写坏原文件 |
| publish-aur.mjs | 发布 | 下载发行 tarball、从文件动态计算 sha256、由 `packaging/aur` 模板渲染 PKGBUILD/.SRCINFO；`--push` 时提交并推送到 AUR |
| handbook-stats.py | 维护 | 采集源码/文档规模、版本与测试入口，生成 `docs/HANDBOOK/01-规模盘点.md` |
| handbook-tests.py | 维护 | 采集 vitest/node/Rust 用例与脚本断言，生成 `docs/HANDBOOK/95-测试索引.md` |
| handbook-paths.py | 维护 | 汇总关键文件与事实出处，生成 `docs/HANDBOOK/04-导航对照.md` 的附录区块 |
| handbook-backlog.py | 维护 | 从各章 F 段采集待补项，生成 `docs/HANDBOOK/90-待补清单.md` |
| handbook_chapters.py | 维护 | 手册章节文件名的唯一正则，供采集与校验脚本共享 |
| check-handbook.py | 维护 | 检查手册结构、版本页眉、出处、措辞、隐私与章节体量 |
| attention.test.mjs | 验证 | 到点音效只看状态跃迁；后台提醒不切走 DSH 对话 |
| modal-ssr.test.mjs | 验证 | 拿不到 react-dom 时对话框退回内联渲染而不抛错（无浏览器冒烟依赖它） |
| navigation-filter.test.mjs | 验证 | 侧栏项目筛选信号只被消费一次，切页与筛选值分离 |
| persona-switch.test.mjs | 验证 | 角色背景板切换列：四个角色、高亮、订阅广播 |
| niri-guard.test.mjs | 验证 | 独立 Xvfb+niri 与真实 GTK 窗口：运行中应用枚举、全屏/退出、白名单、锁机忽略白名单、释放与确认抢焦；仅连接临时桌面 |
| plugin-host.test.mjs | 验证 | 全部 Host 工具注册与教学读取转发；`LIVE_TOMATO=1` 时只读联通当前实例 |
| export-sqlite.test.mjs | 验证 | 旧库导出：迁移规则、计划形状、备份完整性、幂等、不改原库（临时目录自建库） |
| import-backup.test.mjs | 验证 | 备份导入：合并结果、重复运行幂等、坏输入不写坏原文件 |
| install.test.mjs | 验证 | 安装/卸载：布局、权限、manifest、systemd 调用序列、拒绝覆盖非托管文件（隔离 home） |
| build-client.mjs | 构建 | esbuild 把 `plugin/src/client/entry.js` 打成 `plugin/client.js`（IIFE，产物入库） |
| build-runtime.mjs | 构建 | esbuild 把 `@tomato/core` 打成 `runtime/vendor/core.mjs`（随包分发的单文件产物） |
| build-host-tools.mjs | 构建 | 从 `runtime/src/tools.mjs` 生成插件自带 Host 工具 schema；`--check` 拒绝与运行时漂移 |
| smoke-client.mjs | 验证 | 假 DOM + 真 React 逐页渲染客户端产物，核对 slot、主题、皮肤与九页标记；`SMOKE_LIVE=1` 连真实 `/api/state` |
| attention.test.mjs | 验证 | HUD 音效跃迁与提醒条：开始/暂停/完成/提醒只取第一个 cue，不抢页面 |
| modal-ssr.test.mjs | 验证 | 无 `react-dom` 时对话框退回内联渲染、`open:false` 不渲染 |
| navigation-filter.test.mjs | 验证 | 项目筛选信号：切页、取走清空、取消订阅不再收广播 |
| persona-switch.test.mjs | 验证 | 角色切换列渲染/高亮、换人写入与通知、抬升避让输入区 |
| plugin-host.test.mjs | 验证 | 全部 Host 工具注册、schema 与 runtime 一致、教学读取转发；`LIVE_TOMATO=1` 时只读联通当前实例 |
| export-sqlite.mjs | 迁移 | 一次性把旧 sqlite 库导出为 plan.json 与 backup-v4.json（只读打开、原子写、`--force` 覆盖） |
| export-sqlite.test.mjs | 验证 | 旧库 v3/v4 导出、已存在输出拒绝覆盖、WAL 警告、错误输入不落盘 |
| import-backup.mjs | 迁移 | 把备份 v4/计划合并进数据目录；导入后停表、清锁机、停用定时规则 |
| import-backup.test.mjs | 验证 | 合并保留条数/进度/配置、重复运行幂等、坏文件不写坏原文件 |
| install-desktop-integration.py | 桌面集成 | 安装 GNOME 扩展到用户 XDG 目录，提供启用命令而不自动启用，支持临时 home 与 dry-run |
| install.mjs | 安装 | 安装 runtime+guard 到 `~/.local/lib/tomato/`，写 systemd user unit 并 enable runtime 自启；`--dry-run`/`--uninstall`，manifest 记录路径以安全卸载 |
| install.test.mjs | 验证 | 安装布局/权限/manifest、unit 内容、systemctl 序列、卸载与拒绝覆盖无关文件 |
| publish-aur.mjs | 发布 | 下载发行 tarball、计算 sha256、由 `packaging/aur` 模板渲染 PKGBUILD/.SRCINFO；`--push` 时提交并推送到 AUR |
| handbook-tests.py | 维护 | 人工章节→测试映射，采集 Rust/Node 用例与断言，生成 95 测试索引并同步章节页眉 |
| handbook-paths.py | 维护 | 汇总关键文件与事实出处，生成 04 导航附录的阅读入口和调用链；排除本机维护记录及构建目录 |
| handbook-stats.py | 维护 | 采集源码/文档规模、版本、Git 状态与测试入口，生成 01 规模盘点 |
| handbook-backlog.py | 维护 | 从各章节 F 段采集待补项，生成 90 待补清单 |
| handbook_chapters.py | 维护 | 手册章节名匹配规则，供采集与校验脚本共享 |
| check-handbook.py | 维护 | 检查手册结构、版本、出处、措辞、隐私与章节体量 |
