---
mode: maintenance
generated_at: 2026-10-10
---

真实后端、浏览器和隔离的原生桌面验证。

## 任务指南

| 任务 | Domain | Target | Also Check |
| --- | --- | --- | --- |
| 验证前端业务 | 验证 | integration.mjs | package.json |
| 验证白名单与全屏 | 验证 | native.mjs | fixtures/guard_window.py、crates/core/src/guard.rs |
| 验证桌面集成 | 验证 | native.mjs、install.mjs | fixtures/tray_bus.py、src-tauri/src/desktop.rs、scripts/install.py |

## 子目录

| Dir | Domain | Depends On | Purpose |
| --- | --- | --- | --- |
| fixtures/ | 验证 | Python GTK | 受控的允许/不允许测试窗口 |

## 文件

| File | Domain | Function |
| --- | --- | --- |
| integration.mjs | 验证 | 时间提醒、高亮、一键开始和浏览器端到端覆盖、计划导出/文件导入/重复导入与截图 |
| native.mjs | 验证 | 私有 D-Bus、托盘宿主、嵌套 niri + WebKitWebDriver 验证计划合并、严格到期、睡眠锁机与托盘定时唤回与任务提醒 |
| install.mjs | 验证 | 临时用户目录验证安装入口、DMS 配置保留及幂等性 |
