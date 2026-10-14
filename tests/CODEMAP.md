---
mode: maintenance
generated_at: 2026-10-10
---

真实后端、浏览器和隔离的原生桌面验证。

## 任务指南

| 任务                 | Domain | Target                         | Also Check                                                                              |
| -------------------- | ------ | ------------------------------ | --------------------------------------------------------------------------------------- |
| 验证偏好页           | 验证   | integration.mjs                | 保存时机、失败保留输入、左右分列与 360/700/1280px 防外溢                                |
| 验证前端业务         | 验证   | integration.mjs                | package.json                                                                            |
| 验证本周日程布局     | 验证   | integration.mjs 的周历检查      | 物理分辨率与 125%/约 133%/150% 缩放、完整小时标签、短任务标题、滚动时比例不变、窗口拉伸；src/main.ts 的 resizeCalendar |
| 验证侧栏排序菜单     | 验证   | integration.mjs 的项目排序     | src/main.ts 的菜单捕获阶段关闭与 sortProjects                                           |
| 验证音效与静音       | 验证   | audio.mjs、integration.mjs     | src/audio.ts、src/sound-events.ts、native.mjs                                           |
| 验证锁机只读明日日程 | 验证   | integration.mjs 的合成锁机快照 | 跨年/闰日、时间排序、备注/步骤、严格/普通、空日程、360/1280px、零写请求；不启用原生保护 |
| 验证概念讲解         | 验证   | integration.mjs 的 Ponder 用例 | src/ponder.ts、main.ts 的 data-ponder；悬停胶囊、长按 G、列表入口与 Esc 关闭            |
| 验证白名单与全屏     | 验证   | native.mjs                     | fixtures/guard_window.py、crates/core/src/guard.rs                                      |
| 验证桌面集成         | 验证   | native.mjs、install.mjs        | fixtures/tray_bus.py、src-tauri/src/desktop.rs、scripts/install.py                      |
| 验证学习助手与联网   | 验证   | agent.mjs                      | agent/、crates/agent/、docs/AGENT.md、模拟模型与 MCP stdio                              |
| 验证对话编辑/重试/分支与附件 | 验证 | agent.mjs.analysis.md | 临时可执行文件 + 本机模型 + 浏览器，校验实际文件读取、原会话保留、流式停止、渲染与复制 |

## 子目录

| Dir       | Domain | Depends On | Purpose                   |
| --------- | ------ | ---------- | ------------------------- |
| fixtures/ | 验证   | Python GTK | 受控的允许/不允许测试窗口 |

## 文件

| File            | Domain | Function                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| audio.mjs       | 验证   | 学习状态音效防重/优先级、静音与导入抑制、真实 Web Audio 离线渲染的峰值/拖尾/音量比例和音频不可用降级；写作业 BGM 真实时长边界、无效导入保留原文件、持久化、播放与音量                                                                                                                                                                                                                                                                                                |
| integration.mjs | 验证   | 简洁模式全局显隐、本机重载恢复、编辑中切换、键盘/小屏、状态/日期/权限保留与保存失败回退、 首页定时/待补/未定时/无日期固定分组、独立排序、待补全部显示、无日期展开保留与小屏防外溢、 BGM 文件导入/播放/噪音切换/重载恢复/移除、沉浸与普通/严格专注保护中的声音选择和音量、渐进式临时/手动/自动创建与字段保留、分钟输入自动安排、多时间各选多日期/多周期单元、临时批量、节点图编辑（点卡编辑、拖拽重排、增删、信号横条）/配对/条件阻断/人工确认/不可逆裁定/末检查、小屏布局、无目标单位、模板手动整周期/分时预印/显式同步/静态重修窗口、规则显隐、定时严格模式保存与 360/700/1280px 防外溢验证、时间提醒、计时、计划 v4/备份 v3 往返与截图、概念讲解的悬停胶囊/长按 G/列表入口 |
| native.mjs      | 验证   | 慢助手用量查询期间窗口绘制与快照响应、私有 D-Bus、托盘宿主、嵌套 niri + WebKitWebDriver 验证真实手势音频激活与开始音效防重、计划合并、严格到期、睡眠锁机与托盘定时唤回与任务提醒                                                                                                                                                                                                                                                          |
| install.mjs     | 验证   | 临时用户目录验证安装入口、DMS 配置保留及幂等性                                                                                                                                                                                                                                                                                                                                                      |
| agent.mjs       | 验证   | Rust 工作进程与随包 Node 的真实 HTTP 代理请求、真实 Pi SDK 流式工具调用与会话恢复/思考强度配置覆盖历史，界面思考强度保存与重载、Codex CLI 配置映射、Exa 结果解析与代理网段放行、Rust 服务 + 认证 MCP stdio + 文件审阅/应用 + 学习助手界面                                                                                                                                                                                                                                                       |
| agent-runtime.mjs | 验证 | 用随包 Node 加载真实 Pi SDK，校验版本；无效与 Android/musl 目标不会删除现有运行包 |
| x11.mjs | 验证 | 自动分配独立 Xvfb/Openbox，清除 niri/Wayland 环境，运行真实核心 X11 测试；--app 启动独立 D-Bus/数据目录的 Tauri 应用测试 |
| x11-app.mjs | 验证 | 独立 X11 下的真实 Tauri/WebKit：PID 检测、白名单放行、非白名单回焦、快速锁机、紧急恢复与窗口管理器失效释放 |
| windows.mjs | 验证 | Windows CI 独立 runner 上执行 Win32 集成测试；Linux 自动交叉编译并创建独立 Wine 前缀、Xvfb/Openbox，结束后释放进程与临时目录 |
| android-app.mjs | 验证 | 独立 Android 模拟器安装真实 debug APK，通过 Playwright Android WebView 验证 Rust 持久化、项目/任务、计时重启恢复、手机导航和原生返回键；失败采集截图、logcat 与 ANR，API 33 本机通过 |
| android.mjs | 验证 | 本机使用忽略的 artifacts 目录新建独立 API 33 AVD，分配未占用端口，等待启动后执行 Android 应用用例并清理自有进程/数据；同时隔离旧/新 SDK 用户目录，保留已有 AVD |
