---
mode: maintenance
generated_at: 2026-10-10
---

真实后端、浏览器和隔离的原生桌面验证。

## 任务指南

| 任务 | Domain | Target | Also Check |
| --- | --- | --- | --- |
| 验证偏好页 | 验证 | integration.mjs | 保存时机、失败保留输入、左右分列与 360/700/1280px 防外溢 |
| 验证前端业务 | 验证 | integration.mjs | package.json |
| 验证侧栏排序菜单 | 验证 | integration.mjs 的项目排序 | src/main.ts 的菜单捕获阶段关闭与 sortProjects |
| 验证音效与静音 | 验证 | audio.mjs、integration.mjs | src/audio.ts、src/sound-events.ts、native.mjs |
| 验证白名单与全屏 | 验证 | native.mjs | fixtures/guard_window.py、crates/core/src/guard.rs |
| 验证桌面集成 | 验证 | native.mjs、install.mjs | fixtures/tray_bus.py、src-tauri/src/desktop.rs、scripts/install.py |

## 子目录

| Dir | Domain | Depends On | Purpose |
| --- | --- | --- | --- |
| fixtures/ | 验证 | Python GTK | 受控的允许/不允许测试窗口 |

## 文件

| File | Domain | Function |
| --- | --- | --- |
| audio.mjs | 验证 | 学习状态音效防重/优先级、静音与导入抑制、真实 Web Audio 离线渲染的峰值/拖尾/音量比例和音频不可用降级 |
| integration.mjs | 验证 | 渐进式临时/手动/自动创建与字段保留、分钟输入自动安排、多时间各选多日期/多周期单元、临时批量、主线编辑/配对/条件阻断/人工确认/不可逆裁定/末检查、小屏布局、无目标单位、模板手动整周期/分时预印/显式同步/静态重修窗口、规则显隐、定时严格模式保存与 360/700/1280px 防外溢验证、时间提醒、计时、计划 v4/备份 v3 往返与截图 |
| native.mjs | 验证 | 私有 D-Bus、托盘宿主、嵌套 niri + WebKitWebDriver 验证真实手势音频激活与开始音效防重、计划合并、严格到期、睡眠锁机与托盘定时唤回与任务提醒 |
| install.mjs | 验证 | 临时用户目录验证安装入口、DMS 配置保留及幂等性 |
