---
mode: maintenance
generated_at: 2026-11-07
---

安装、构建、迁移、发布与手册自查脚本；测试入口见 `pnpm test:tools`。

## 文件

| File | Domain | Function |
| --- | --- | --- |
| build-client.mjs | 构建 | esbuild 把 `plugin/src/client/entry.js` 打成 `plugin/client.js`（IIFE，产物入库） |
| build-runtime.mjs | 构建 | esbuild 把 `@tomato/core` 打成 `runtime/vendor/core.mjs`（随包分发的单文件产物） |
| build-host-tools.mjs | 构建 | 从 `runtime/src/tools.mjs` 生成插件自带 Host 工具 schema；`--check` 拒绝与运行时漂移 |
| smoke-client.mjs | 验证 | 假 DOM + 真 React 逐页渲染客户端产物，核对 slot、主题、皮肤与九页标记；`SMOKE_LIVE=1` 连真实 `/api/state` |
| attention.test.mjs | 验证 | HUD 音效跃迁与提醒条：开始/暂停/完成/提醒只取第一个 cue，不抢页面 |
| modal-ssr.test.mjs | 验证 | 无 `react-dom` 时对话框退回内联渲染、`open:false` 不渲染 |
| navigation-filter.test.mjs | 验证 | 项目筛选信号：切页、取走清空、取消订阅不再收广播 |
| persona-switch.test.mjs | 验证 | 角色切换列渲染/高亮、换人写入与通知、抬升避让输入区 |
| plugin-host.test.mjs | 验证 | 全部 Host 工具注册、schema 与 runtime 一致、教学读取转发；`LIVE_TOMATO=1` 时只读联通当前实例 |
| niri-guard.test.mjs | 验证 | 独立 Xvfb+niri 与真实 GTK 窗口：运行中应用枚举、全屏/退出、白名单、锁机忽略白名单、释放与确认抢焦；仅连接临时桌面 |
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
