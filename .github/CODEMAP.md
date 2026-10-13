---
mode: maintenance
generated_at: 2026-10-09
---

GitHub 持续集成与标签发布。

## 任务指南

| 任务 | Domain | Target | Also Check |
| --- | --- | --- | --- |
| 调整 CI 验证范围 | 构建 | workflows/ci.yml | package.json 的 check/format:check/test |
| 调整发布产物 | 构建 | workflows/release.yml | src-tauri/tauri.conf.json、scripts/install.py、README.md |

## 子目录

| Dir | Domain | Depends On | Purpose |
| --- | --- | --- | --- |
| workflows/ | 构建 | GitHub Actions、Linux/Windows/macOS runner、Android NDK | 推送/PR 验证与 v* 标签发布 |
| releases/ | 构建 | 版本标签 | 每个 tag 一份发布说明，由发布工作流按标签读取；文件索引见 releases/CODEMAP.md |

## 文件

| File | Domain | Function |
| --- | --- | --- |
| workflows/ci.yml | 构建 | 默认运行 Linux 全量检查与隔离 X11 回归、六平台/架构桌面构建与 Windows 原生保护；仅手动勾选 android 时运行四 ABI、APK 架构/资源检查及 API 33/35 原生模拟器测试 |
| workflows/release.yml | 构建 | v* 标签矩阵构建 Linux 两架构 deb/压缩包与 Windows 两架构 NSIS，校验随包 Node/Pi，全部完成后统一发布 Release |
