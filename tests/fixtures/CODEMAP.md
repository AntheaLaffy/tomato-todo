---
mode: maintenance
generated_at: 2026-10-09
---

只用于隔离测试桌面的应用窗口与托盘宿主。

## 文件

| File            | Domain | Function                                           |
| --------------- | ------ | -------------------------------------------------- |
| proxy_agent_worker.mjs | 验证 | 固定无效域名的用量请求，配合本地 HTTP 代理验证 Rust 启动随包 Node 的实际代理路径；无账号或外网 |
| slow_agent_worker.mjs | 验证 | 2 秒延迟的用量回复，验证真实桌面 IPC 与窗口线程保持响应；无账号或联网 |
| guard_window.py | 验证   | 创建带不同 app_id 的 GTK 测试程序                  |
| tray_bus.py     | 验证   | 私有 StatusNotifier 宿主及真实 DBusMenu 读写客户端 |
| desktop_shell.py | 验证 | 仅独立 D-Bus：模拟 GNOME/KWin 服务，执行应用生成的实际 KWin JS 并返回回调结果，验证加载/运行/卸载与原生桥接协议 |
