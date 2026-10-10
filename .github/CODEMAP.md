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
| workflows/ | 构建 | GitHub Actions、Ubuntu 22.04 | 推送/PR 验证与 v* 标签发布 |
| releases/ | 构建 | 版本标签 | 每个 tag 一份发布说明，由发布工作流按标签读取；文件索引见 releases/CODEMAP.md |

## 文件

| File | Domain | Function |
| --- | --- | --- |
| workflows/ci.yml | 构建 | Ubuntu 22.04 上运行 check、format:check 与单元/集成/安装测试 |
| workflows/release.yml | 构建 | v* 标签构建 deb 与独立压缩包并发布 Release |
