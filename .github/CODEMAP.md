---
mode: maintenance
generated_at: 2026-10-09
---

GitHub 持续集成与标签发布。

## 任务指南

| 任务             | Domain | Target                | Also Check                                                                                        |
| ---------------- | ------ | --------------------- | ------------------------------------------------------------------------------------------------- |
| 调整 CI 验证范围 | 构建   | workflows/ci.yml      | package.json 的 core:test/runtime:test/format、scripts/check-handbook.py、crates/guard/Cargo.toml |
| 调整发布产物     | 构建   | workflows/release.yml | scripts/install.mjs、packaging/aur/PKGBUILD.in、README.md（release.yml 仍是 Tauri 旧流程，待重写） |

## 子目录

| Dir        | Domain | Depends On                                 | Purpose                                                                       |
| ---------- | ------ | ------------------------------------------ | ----------------------------------------------------------------------------- |
| workflows/ | 构建   | GitHub Actions、Linux/Windows/macOS runner | 推送/PR 验证与 v* 标签发布                                                    |
| releases/  | 构建   | 版本标签                                   | 每个 tag 一份发布说明，由发布工作流按标签读取；文件索引见 releases/CODEMAP.md |

## 文件

| File                  | Domain | Function                                                                                                                      |
| --------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| workflows/ci.yml      | 构建   | Linux 上跑 core/runtime 测试、prettier 只检查、迁移自测、客户端构建冒烟与手册结构，并完整构建 guard；Windows/macOS 矩阵对 guard 做类型检查 |
| workflows/release.yml | 构建   | **仍是 Tauri 旧流程（待重写）**：调用 `agent:build`、`tests/agent-runtime.mjs`、`tauri build` 与 `src-tauri/icons`，当前仓库已无这些目录/脚本，标签发布不会产出 runtime/guard 安装包 |
