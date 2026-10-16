---
mode: maintenance
generated_at: 2026-10-16
---

用户自行启用的 GNOME Shell 窗口保护桥接；不修改任务或主动切换窗口。

## 文件

| File | Domain | Function |
| --- | --- | --- |
| extension.js | 桌面桥接 | 在 org.gnome.Shell 导出 studio.tomato.Guard1；通过 WindowTracker/Meta 枚举 PID/应用/焦点，激活含最小化和其他工作区的窗口，禁用时取消导出 |
| metadata.json | 扩展包 | 固定 UUID、用途、ES module Shell 版本范围与扩展版本 |
