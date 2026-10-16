---
mode: maintenance
generated_at: 2026-10-09
---

Linux、Windows、macOS 桌面配置与 Android 原生应用工程。

## 任务指南

| 任务 | Domain | Target | Also Check |
| --- | --- | --- | --- |
| 修改窗口/打包 | 原生宿主 | tauri.conf.json、各平台覆盖配置 | src/lib.rs、src/desktop_app.rs、gen/android/CODEMAP.md |
| 修改原生命令 | 桌面 | src/CODEMAP.md | capabilities/default.json、src/api.ts |

## 子目录

| Dir | Domain | Depends On | Purpose |
| --- | --- | --- | --- |
| src/ | 桌面 | core、Tauri | IPC、窗口生命周期与保护轮询 |
| gen/android/ | Android | Tauri、Gradle、Android SDK/NDK | 维护的 Kotlin/Gradle 工程；构建生成的本地路径与 JNI 产物仍排除，见局部地图 |
| capabilities/ | 权限 | Tauri ACL | Internals not indexed：原生插件能力清单 |
| icons/ | 资源 | tauri.conf.json | Internals not indexed：安装包图标 |

## 文件

| File | Domain | Function |
| --- | --- | --- |
| Cargo.toml | 构建 | 桌面二进制与 Android 静态/动态库入口；桌面助手、托盘/单实例与 Android URI 文件插件按目标隔离 |
| build.rs | 构建 | Tauri 构建入口 |
| tauri.conf.json | 桌面 | 窗口、CSP、图标、打包和开发服务配置 |
| tomato.desktop.hbs | 桌面 | 独立设置中文启动器名称，软件包保留合法 ASCII 名称 |
| tauri.linux.conf.json | 构建 | Linux 附加 GNOME 扩展和安装器资源，保留共享助手资源 |
| tauri.windows.conf.json | 构建 | 自动合并的 Windows 配置，默认 NSIS 安装器 |
| tauri.macos.conf.json | 构建 | 自动合并的 macOS 配置，默认 DMG 安装镜像 |
| tauri.android.conf.json | 构建 | Android 可见主窗口、最低 API 24，排除 ABI 不兼容的桌面 Node 资源 |
