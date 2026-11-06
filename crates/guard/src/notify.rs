//! 系统通知（notify-rust）：Linux 走 zbus/DBus 会话总线，Windows 走 WinRT
//! toast，macOS 走通知中心。阻塞式调用，由 HTTP 处理线程调用。
pub fn show(title: &str, body: &str) -> Result<(), String> {
    notify_rust::Notification::new()
        .summary(title)
        .body(body)
        .show()
        .map(|_| ())
        .map_err(|error| format!("系统通知失败：{error}"))
}
