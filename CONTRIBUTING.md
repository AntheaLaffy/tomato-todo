# 贡献指南

感谢你愿意一起做番茄 Todo。这份文档写给要改代码、跑测试、提 PR 的人；使用与安装见 [README](README.md)，产品设计取舍见 [docs/DESIGN.md](docs/DESIGN.md)。

## 开发环境

需要 Rust stable、Node.js 22.12+、pnpm、系统 GTK 3 / WebKitGTK 4.1 开发库、C 编译工具链和 pkg-config。

```sh
pnpm install
```

## 常用命令

```sh
pnpm run desktop        # Tauri 桌面开发
pnpm run dev            # Rust 服务 + Vite 浏览器预览
pnpm run check          # TypeScript 类型检查 + Rust Clippy（-D warnings）
pnpm run format:check   # rustfmt + Prettier 格式检查
pnpm run format         # 自动格式化（Rust + 前端）
pnpm test               # Rust 单元测试 + 构建 + 浏览器端到端测试
pnpm run test:native    # niri 独立嵌套桌面上的原生保护测试
pnpm run test:install   # 安装脚本验证
pnpm run desktop:deb    # 构建生产 .deb 安装包
```

浏览器预览访问 `http://127.0.0.1:1420`，Rust 服务仅监听 `127.0.0.1:4319`。端到端测试使用独立临时数据库、4321 端口和 Chromium；可用 `CHROMIUM_PATH` 指定浏览器可执行文件。生产程序加载内置界面，无需 Vite 服务。

## 架构

- **`crates/core/`**：领域模型与业务规则——状态机、任务规则、数据校验、SQLite、统计、专注保护。由桌面端和预览服务共享，避免两套逻辑。
- **`crates/preview/`**：Axum 本地预览服务，把同一份核心暴露给浏览器开发。
- **`src-tauri/`**：原生 IPC、窗口、通知、托盘、自启动与打包。
- **`src/`**：TypeScript 与 CSS 界面，只负责视图、交互与本地声音。
- **`crates/agent/` 与 `agent/`**：学习助手运行时。`agent/*.mjs` 是应用侧的薄封装，运行时就是随包的 Pi SDK；改行为时照抄上游语义，不自造调度层、保险丝或重试策略。详见 [docs/AGENT.md](docs/AGENT.md)。
- **`scripts/`**：开发服务与 Linux 用户安装脚本。

改公开接口时，同时核对 Rust 核心、桌面/预览适配层和 TypeScript 消费方。文件级导航从 [CODEMAP.md](CODEMAP.md) 开始，改完结构后同步局部地图。

## 测试与验证

`pnpm test` 覆盖 Rust 状态机、计划往返导入、模板预印与印刷防重、严格执行、跨午夜锁机，以及真实浏览器端到端。

原生保护测试（`pnpm run test:native`）需要 niri、Xvfb、tauri-driver、WebKitWebDriver 和 Python GObject/GTK。它会构建内置界面的独立测试程序，用私有 D-Bus、临时 XDG 配置和 StatusNotifier 测试宿主，验证白名单放行、非白名单回焦、拒绝关闭与暂停、全屏锁定、紧急恢复、真实托盘菜单、隐藏后计时、自启动开关、单实例恢复、无托盘回退。

> **必须在独立的嵌套桌面里跑，不得在用户当前桌面自动启用保护。** 安装脚本验证（`pnpm run test:install`）同样使用临时用户目录。

真实账号、联网与桌面行为由你自测：改动助手运行时，先用 `node --test tests/agent.mjs` 的本地 mock 模型覆盖流式工具调用与会话恢复，不花额度；写清怎么复现。

## 提交与 PR

- **一个提交 = 一个可独立理解、独立评审的连贯改动**（用 `git add -p` 拆）。重构不与新功能混提，无关修复不塞进同一个提交。这样 `git bisect` 才有意义。
- **提交信息写「为什么」，不复述「做了什么」**。读过 diff 就知道改了什么；值得留下的是：什么问题或约束迫使这次改动、考虑过哪些备选、取舍与影响是什么、有哪些读者会意外的点。复杂改动用「问题 → 解决方案 → 影响」结构；说不清的动机不要编，标注未定。
- **改数据模型、文件格式或语义时**，同步更新文档、schema、示例、测试与 [CHANGELOG.md](CHANGELOG.md)。本项目以更好的设计迭代为先，**允许破坏性变更**——不为兼容旧数据、旧接口或旧文件格式牺牲设计；旧版本按需要提供一次性转换或明确拒绝。
- **不给长任务设人为上限**。一轮请求跑到完成，只由用户停止、供应商报错或 SDK 自身策略结束；不加 wall-clock 截止或轮次上限。沙箱终端保持 Pi 的语义：默认不超时，只有模型显式传 `timeout` 才限时；输出过多只截断呈现，不杀命令。
- 改动 `agent/*.mjs` 时保持既有紧凑风格，不在 `pnpm format` 范围内，改哪行只动哪行。

## 文档与素材

- 学习计划格式：[docs/PLAN_FORMAT.md](docs/PLAN_FORMAT.md)；完整备份：[docs/BACKUP_FORMAT.md](docs/BACKUP_FORMAT.md)。
- 主线节点语义：[docs/NODE_DESIGN.md](docs/NODE_DESIGN.md)。
- 用户提供的课表与私人备考分析放在忽略版本管理的 `artifacts/planning/`，**不要**写进默认种子、安装包或示例文件。
- 维护者技能在 [.agents/skills/](.agents/skills/README.md)：编码智能体从仓库根自动发现，覆盖导航、维护收尾、提交与文档、测试与性能、Git/Shell、智能体上下文与 CI/CD。
- 字体 DM Sans 随应用打包，许可见 [public/fonts/OFL.txt](public/fonts/OFL.txt)。部分内置技能改编自 MIT《The Missing Semester》，采用 CC BY-NC-SA 4.0，与应用自身的 MIT 不同。

## 许可

贡献即同意以 [MIT](LICENSE) 许可发布。
