---
mode: maintenance
generated_at: 2026-10-13
---

仅由隔离测试入口执行的桌面协议验证，不在用户当前桌面开启保护。

## 文件

| File | Domain | Function |
| --- | --- | --- |
| guard_x11.rs | 验证 | 真实 EWMH 窗口枚举、PID/类/标题、精确白名单、回焦与窗口失效；Wayland/Xwayland 不误报完整能力，默认忽略，由 tests/x11.mjs 安全创建隔离会话后运行 |
| guard_windows.rs | 验证 | 真实 Win32 窗口、同名不同路径的长路径程序、鼠标切窗、前台锁定请求、精确白名单、后台线程反复回焦、修饰键延后与按键状态、锁定和窗口失效；fixture_window 是子进程入口，由 tests/windows.mjs 在隔离环境运行 |
