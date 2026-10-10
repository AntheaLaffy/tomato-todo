---
mode: maintenance
generated_at: 2026-10-09
---

只用于隔离测试桌面的应用窗口与托盘宿主。

## 文件

| File            | Domain | Function                                           |
| --------------- | ------ | -------------------------------------------------- |
| guard_window.py | 验证   | 创建带不同 app_id 的 GTK 测试程序                  |
| tray_bus.py     | 验证   | 私有 StatusNotifier 宿主及真实 DBusMenu 读写客户端 |
