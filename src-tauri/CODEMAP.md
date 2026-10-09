---
mode: maintenance
generated_at: 2026-10-09
---

Linux 原生窗口及安装包配置。

## 任务指南

| 任务 | Domain | Target | Also Check |
| --- | --- | --- | --- |
| 修改窗口/打包 | 桌面 | tauri.conf.json | src/main.rs |
| 修改原生命令 | 桌面 | src/CODEMAP.md | capabilities/default.json、src/api.ts |

## 子目录

| Dir | Domain | Depends On | Purpose |
| --- | --- | --- | --- |
| src/ | 桌面 | core、Tauri | IPC、窗口生命周期与保护轮询 |
| capabilities/ | 权限 | Tauri ACL | Internals not indexed：原生插件能力清单 |
| icons/ | 资源 | tauri.conf.json | Internals not indexed：安装包图标 |

## 文件

| File | Domain | Function |
| --- | --- | --- |
| Cargo.toml | 构建 | Tauri 与原生插件依赖 |
| build.rs | 构建 | Tauri 构建入口 |
| tauri.conf.json | 桌面 | 窗口、CSP、图标、打包和开发服务配置 |
| tomato.desktop.hbs | 桌面 | 独立设置中文启动器名称，软件包保留合法 ASCII 名称 |
