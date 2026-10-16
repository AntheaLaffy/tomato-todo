---
mode: maintenance
generated_at: 2026-10-09
---

开发进程启动、停止、Linux 用户安装与 AUR 发布。

## 文件

| File            | Domain | Function                                                                       |
| --------------- | ------ | ------------------------------------------------------------------------------ |
| dev.mjs         | 构建   | 启动 Rust 预览服务及 Vite 并处理退出                                           |
| install-desktop-integration.py | 桌面集成 | 安装 GNOME 扩展到用户 XDG 目录，提供启用命令而不自动启用，支持临时 home 和 dry-run |
| install.py      | 安装   | 安装二进制、随包扩展/安装器、图标、菜单/自启动入口；备份并更新 DMS 快捷栏                       |
| build-agent.mjs | 构建   | 打包固定版本 Pi SDK、按本机或显式 Rust 目标校验并内置 Node 运行时，生成 agent/bundle（不含私人数据与 npm 绝对路径 .bin 软链） |
| agent-runtime.mjs | 构建 | Linux/Windows/macOS x64/ARM64 的固定 Node 版本、官方校验和与 Rust 目标选择，拒绝不兼容 ABI |
| check-android-apk.py | 构建 | 校验 universal APK 的四个原生 ABI、ELF 架构和桌面 Node 资源排除；供本机原生测试和 CI 共用 |
| publish-aur.mjs | 发布   | 下载发行 tarball、动态计算 sha256、由 packaging/aur 模板渲染 PKGBUILD/.SRCINFO；`--push` 时提交并推送到 AUR |
| handbook-tests.py | 维护 | 人工章节→测试映射，采集 Rust/Node 用例与脚本断言，生成 95 测试索引并同步章节页眉 |
| handbook-paths.py | 维护 | 汇总关键文件与事实出处，生成 04 导航附录的阅读入口和调用链 |
| handbook-stats.py | 维护 | 采集源码/文档规模、版本、Git 状态与测试入口，生成 01 规模盘点 |
| handbook-backlog.py | 维护 | 从各章节 F 段采集待补项，生成 90 待补清单 |
| check-handbook.py | 维护 | 检查手册结构、版本、出处、措辞、隐私与章节体量 |
| handbook_chapters.py | 维护 | 手册章节名匹配规则，供采集与校验脚本共享 |
