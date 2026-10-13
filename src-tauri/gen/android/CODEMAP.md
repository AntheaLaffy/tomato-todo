---
mode: maintenance
generated_at: 2026-10-13
---

Android 应用工程由 Tauri 初始化，之后维护 Gradle 配置、Manifest 和 Kotlin 宿主。Tauri 在构建时重建的 JNI 库、generated Kotlin、assets/tauri.conf.json、tauri.properties、tauri.*.gradle 与本地 SDK 路径不入库；不能用这些本机路径配置 CI。

## 文件

| File | Domain | Function |
| --- | --- | --- |
| .gitignore、app/.gitignore | 维护 | 本地 IDE、Gradle、JNI 与 Tauri 构建生成文件排除 |
| .editorconfig | 维护 | Android 工程缩进约定 |
| build.gradle.kts | 构建 | Android Gradle Plugin/Kotlin 插件与仓库 |
| settings.gradle | 构建 | app 与 Tauri 自动生成的插件模块列表 |
| gradle.properties | 构建 | JVM、配置缓存与当前 Tauri Gradle 插件兼容选项 |
| gradlew、gradlew.bat、gradle/wrapper/ | 构建 | 固定 Gradle wrapper 及启动器；wrapper jar 为构建边界资源 |
| buildSrc/build.gradle.kts | 构建 | Rust Gradle 插件编译与依赖 |
| buildSrc/src/main/java/studio/tomato/todo/kotlin/RustPlugin.kt | 构建 | 各 ABI/profile 的 Rust 编译与 JNI 合并任务 |
| buildSrc/src/main/java/studio/tomato/todo/kotlin/BuildTask.kt | 构建 | 调用 Tauri Android CLI，使用工程相对路径 |
| app/build.gradle.kts | 构建 | SDK/API、应用身份、版本、ABI、调试/发布与 WebView 依赖 |
| app/proguard-rules.pro | 构建 | 保留 WebView JavaScript/JNI 桥接所需成员 |
| app/src/main/AndroidManifest.xml | Android | Activity、文件 Provider、网络权限与软键盘 resize |
| app/src/main/java/studio/tomato/todo/MainActivity.kt | Android | 原生 WebView 系统栏/刘海/键盘 Insets 与返回键；优先关闭界面浮层，再返回专注页或后台 |
| app/src/main/res/ | 资源 | Boundary only：应用番茄图标、名称、主题和文件 Provider 路径，引用由 Manifest/Activity 管理 |
