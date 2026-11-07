//! 极简 HTTP 服务：127.0.0.1 单客户端、每连接一线程、Connection: close，
//! 不依赖任何 HTTP crate。鉴权：`Authorization: Bearer <token>`（token 见 token.rs）。
//! 路由与解析均为纯函数，用 mock backend 做无桌面单测。
use crate::protocol::{valid_whitelist, Command, ErrorReply, FocusReply, OkReply, Status};
use crate::token;
use serde::Serialize;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Arc;

/// 与 API.md 的固定端口一致；测试用 127.0.0.1:0 临时端口。
pub const DEFAULT_PORT: u16 = 43988;

/// 请求头与请求体的总上限（本服务只收小 JSON）。
const MAX_HEADER: usize = 16 * 1024;
const MAX_BODY: usize = 1024 * 1024;

/// 业务后端：真实实现是 crate::state::State；测试用 Mock。
pub trait CommandBackend: Send + Sync {
    fn lock(&self, whitelist: Vec<String>) -> Result<(), String>;
    fn unlock(&self) -> Result<(), String>;
    fn notify(&self, title: String, body: String) -> Result<(), String>;
    /// 找到 DSH 窗口并切到前台；返回窗口标题（没找到时 None）。
    fn focus(&self) -> Result<Option<String>, String>;
    fn status(&self) -> Status;
    fn fullscreen(&self, enabled: bool) -> Result<(), String>;
    fn running_apps(&self) -> Result<Vec<String>, String>;
}

#[derive(Debug, PartialEq, Eq)]
pub struct Request {
    pub method: String,
    pub path: String,
    pub bearer: Option<String>,
    pub body: Vec<u8>,
}

/// 解析完整请求字节（请求行 + 头 + 按 Content-Length 的 body）。
/// 纯函数，便于单测。忽略 body 之外的未知头。
pub fn parse_request(raw: &[u8]) -> Result<Request, String> {
    let header_end = raw
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .ok_or("请求头不完整")?;
    let header = std::str::from_utf8(&raw[..header_end]).map_err(|_| "请求头不是 UTF-8")?;
    let mut lines = header.split("\r\n");
    let request_line = lines.next().ok_or("空请求")?;
    let mut parts = request_line.split_whitespace();
    let method = parts.next().ok_or("缺少请求方法")?.to_string();
    let path = parts.next().ok_or("缺少请求路径")?.to_string();
    let headers: Vec<(&str, &str)> = lines
        .filter_map(|line| line.split_once(':'))
        .map(|(name, value)| (name.trim(), value.trim()))
        .collect();
    let bearer = headers
        .iter()
        .find(|(name, _)| name.eq_ignore_ascii_case("authorization"))
        .and_then(|(_, value)| {
            value
                .strip_prefix("Bearer ")
                .map(|token| token.trim().to_string())
        });
    let content_length = headers
        .iter()
        .find(|(name, _)| name.eq_ignore_ascii_case("content-length"))
        .map(|(_, value)| {
            value
                .parse::<usize>()
                .map_err(|_| "无效 Content-Length".to_string())
        })
        .transpose()?
        .unwrap_or(0);
    if content_length > MAX_BODY {
        return Err("请求体过大".into());
    }
    let body_start = header_end + 4;
    if raw.len() < body_start + content_length {
        return Err("请求体不完整".into());
    }
    Ok(Request {
        method,
        path,
        bearer,
        body: raw[body_start..body_start + content_length].to_vec(),
    })
}

fn json<T: Serialize>(value: &T) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| r#"{"error":"序列化失败"}"#.into())
}

/// 纯路由 + 鉴权：返回 (HTTP 状态码, JSON 响应体)。
pub fn route(
    request: Request,
    expected_token: &str,
    backend: &dyn CommandBackend,
) -> (u16, String) {
    if !token::matches(request.bearer.as_deref(), expected_token) {
        return (
            401,
            json(&ErrorReply {
                error: "unauthorized".into(),
            }),
        );
    }
    match (request.method.as_str(), request.path.as_str()) {
        ("POST", "/guard") => match serde_json::from_slice::<Command>(&request.body) {
            Ok(command) => match command {
                Command::Focus => match backend.focus() {
                    Ok(found) => (
                        200,
                        json(&FocusReply {
                            ok: true,
                            focused: found.is_some(),
                            window: found,
                        }),
                    ),
                    Err(error) => (500, json(&ErrorReply { error })),
                },
                command => {
                    let result = match command {
                        Command::Lock { whitelist } => {
                            if valid_whitelist(&whitelist) {
                                backend.lock(whitelist)
                            } else {
                                Err("白名单无效：最多 100 项，每项非空白、无控制字符".into())
                            }
                        }
                        Command::Unlock => backend.unlock(),
                        Command::Notify { title, body } => backend.notify(title, body),
                        Command::Fullscreen { enabled } => backend.fullscreen(enabled),
                        Command::Focus => unreachable!(),
                    };
                    match result {
                        Ok(()) => (200, json(&OkReply { ok: true })),
                        Err(error) => (500, json(&ErrorReply { error })),
                    }
                }
            },
            Err(error) => (
                400,
                json(&ErrorReply {
                    error: format!("无效命令：{error}"),
                }),
            ),
        },
        ("GET", "/guard/status") => (200, json(&backend.status())),
        ("GET", "/guard/apps") => match backend.running_apps() {
            Ok(apps) => (200, json(&serde_json::json!({ "apps": apps }))),
            Err(error) => (500, json(&ErrorReply { error })),
        },
        ("POST", "/guard/status") | ("GET", "/guard") => (
            405,
            json(&ErrorReply {
                error: "方法不允许".into(),
            }),
        ),
        _ => (
            404,
            json(&ErrorReply {
                error: "not found".into(),
            }),
        ),
    }
}

fn reason(status: u16) -> &'static str {
    match status {
        200 => "OK",
        400 => "Bad Request",
        401 => "Unauthorized",
        404 => "Not Found",
        405 => "Method Not Allowed",
        500 => "Internal Server Error",
        _ => "Unknown",
    }
}

/// 阻塞 accept 循环；每个连接一个线程处理并关闭。
pub fn serve(
    listener: TcpListener,
    token: String,
    backend: Arc<dyn CommandBackend>,
) -> std::io::Result<()> {
    for stream in listener.incoming() {
        let Ok(stream) = stream else { continue };
        let token = token.clone();
        let backend = Arc::clone(&backend);
        std::thread::spawn(move || {
            let _ = handle_stream(stream, &token, &*backend);
        });
    }
    Ok(())
}

fn handle_stream(
    mut stream: TcpStream,
    expected_token: &str,
    backend: &dyn CommandBackend,
) -> std::io::Result<()> {
    let mut buffer = Vec::new();
    let mut chunk = [0u8; 4096];
    loop {
        let read = stream.read(&mut chunk)?;
        if read == 0 {
            break;
        }
        buffer.extend_from_slice(&chunk[..read]);
        if buffer.windows(4).any(|window| window == b"\r\n\r\n") {
            break;
        }
        if buffer.len() > MAX_HEADER {
            return respond(
                &mut stream,
                400,
                &json(&ErrorReply {
                    error: "请求头过大".into(),
                }),
            );
        }
    }
    let content_length = buffer
        .split(|byte| *byte == b'\n')
        .filter_map(|line| {
            let mut parts = line.splitn(2, |byte| *byte == b':');
            let name = parts.next()?;
            let value = parts.next()?;
            Some((name, value))
        })
        .find(|(name, _)| name.eq_ignore_ascii_case(b"content-length"))
        .and_then(|(_, value)| std::str::from_utf8(value).ok())
        .and_then(|value| value.trim().parse::<usize>().ok())
        .unwrap_or(0);
    let header_end = buffer
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .unwrap_or(buffer.len());
    let body_start = header_end + 4;
    while buffer.len() < body_start + content_length {
        let read = stream.read(&mut chunk)?;
        if read == 0 {
            break;
        }
        buffer.extend_from_slice(&chunk[..read]);
        if buffer.len() > body_start + MAX_BODY {
            return respond(
                &mut stream,
                400,
                &json(&ErrorReply {
                    error: "请求体过大".into(),
                }),
            );
        }
    }
    let request = match parse_request(&buffer) {
        Ok(request) => request,
        Err(error) => {
            return respond(&mut stream, 400, &json(&ErrorReply { error }));
        }
    };
    let (status, body) = route(request, expected_token, backend);
    respond(&mut stream, status, &body)
}

fn respond(stream: &mut TcpStream, status: u16, body: &str) -> std::io::Result<()> {
    let response = format!(
        "HTTP/1.1 {status} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        reason(status),
        body.len(),
    );
    stream.write_all(response.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    #[derive(Default)]
    struct Mock {
        locked: Mutex<bool>,
        whitelist: Mutex<Vec<String>>,
        notifications: Mutex<Vec<(String, String)>>,
    }

    impl CommandBackend for Mock {
        fn running_apps(&self) -> Result<Vec<String>, String> {
            Ok(vec!["code".into(), "kitty".into()])
        }
        fn fullscreen(&self, _: bool) -> Result<(), String> {
            Ok(())
        }
        fn lock(&self, whitelist: Vec<String>) -> Result<(), String> {
            *self.locked.lock().unwrap() = true;
            *self.whitelist.lock().unwrap() = whitelist;
            Ok(())
        }
        fn unlock(&self) -> Result<(), String> {
            *self.locked.lock().unwrap() = false;
            *self.whitelist.lock().unwrap() = Vec::new();
            Ok(())
        }
        fn notify(&self, title: String, body: String) -> Result<(), String> {
            self.notifications.lock().unwrap().push((title, body));
            Ok(())
        }
        fn focus(&self) -> Result<Option<String>, String> {
            Ok(Some("DeepSeek Harness".into()))
        }
        fn status(&self) -> Status {
            Status {
                locked: *self.locked.lock().unwrap(),
                whitelist: self.whitelist.lock().unwrap().clone(),
                pid: std::process::id(),
                backend: "mock".into(),
            }
        }
    }

    #[test]
    fn parses_request_line_headers_and_body() {
        let raw = b"POST /guard HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer abc123\r\nContent-Length: 20\r\n\r\n{\"command\":\"unlock\"}\r\n";
        let request = parse_request(raw).unwrap();
        assert_eq!(request.method, "POST");
        assert_eq!(request.path, "/guard");
        assert_eq!(request.bearer.as_deref(), Some("abc123"));
        assert_eq!(request.body, b"{\"command\":\"unlock\"}");
    }

    #[test]
    fn rejects_malformed_requests() {
        assert!(parse_request(b"POST /guard HTTP/1.1\r\nAuthorization: Bearer t").is_err());
        assert!(parse_request(b"POST /guard HTTP/1.1\r\n\r\n").is_ok());
        assert!(
            parse_request(b"GET /guard/status HTTP/1.1\r\nContent-Length: 5\r\n\r\n123").is_err()
        );
        assert!(parse_request(b"GET /guard/status HTTP/1.1\r\nContent-Length: x\r\n\r\n").is_err());
    }

    fn backend() -> Arc<Mock> {
        Arc::new(Mock::default())
    }

    #[test]
    fn routes_lock_unlock_notify_and_status() {
        let mock = backend();
        let token = "secret";
        // Request.bearer 已是去掉 "Bearer " 前缀后的 token（与 parse_request 一致）。
        let bearer = || Some(token.to_string());
        let (status, _) = route(
            Request {
                method: "POST".into(),
                path: "/guard".into(),
                bearer: bearer(),
                body: br#"{"command":"lock","whitelist":["code"]}"#.to_vec(),
            },
            token,
            &*mock,
        );
        assert_eq!(status, 200);
        assert!(mock.status().locked);
        assert_eq!(mock.status().whitelist, vec!["code".to_string()]);

        let (status, _) = route(
            Request {
                method: "POST".into(),
                path: "/guard".into(),
                bearer: bearer(),
                body: br#"{"command":"notify","title":"t","body":"b"}"#.to_vec(),
            },
            token,
            &*mock,
        );
        assert_eq!(status, 200);
        assert_eq!(
            mock.notifications.lock().unwrap().as_slice(),
            &[("t".into(), "b".into())]
        );

        let (status, body) = route(
            Request {
                method: "POST".into(),
                path: "/guard".into(),
                bearer: bearer(),
                body: br#"{"command":"focus"}"#.to_vec(),
            },
            token,
            &*mock,
        );
        assert_eq!(status, 200);
        let value: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(value["focused"], true);
        assert_eq!(value["window"], "DeepSeek Harness");

        let (status, body) = route(
            Request {
                method: "GET".into(),
                path: "/guard/status".into(),
                bearer: bearer(),
                body: vec![],
            },
            token,
            &*mock,
        );
        assert_eq!(status, 200);
        let value: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(value["locked"], true);
        assert_eq!(value["whitelist"], serde_json::json!(["code"]));
        assert_eq!(value["pid"], std::process::id());
        assert_eq!(value["backend"], "mock");

        let (status, body) = route(
            Request {
                method: "GET".into(),
                path: "/guard/apps".into(),
                bearer: bearer(),
                body: vec![],
            },
            token,
            &*mock,
        );
        assert_eq!(status, 200);
        let value: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(value["apps"], serde_json::json!(["code", "kitty"]));

        let (status, _) = route(
            Request {
                method: "POST".into(),
                path: "/guard".into(),
                bearer: bearer(),
                body: br#"{"command":"unlock"}"#.to_vec(),
            },
            token,
            &*mock,
        );
        assert_eq!(status, 200);
        assert!(!mock.status().locked);
    }

    #[test]
    fn auth_and_error_paths() {
        let mock = backend();
        let token = "secret";
        let base = |method: &str, path: &str, bearer: Option<String>, body: Vec<u8>| Request {
            method: method.into(),
            path: path.into(),
            bearer,
            body,
        };
        // 缺 token / token 错误 → 401。
        let (status, body) = route(base("GET", "/guard/status", None, vec![]), token, &*mock);
        assert_eq!(status, 401);
        assert!(body.contains("unauthorized"));
        let (status, _) = route(base("GET", "/guard/apps", None, vec![]), token, &*mock);
        assert_eq!(status, 401);
        let (status, _) = route(
            base("GET", "/guard/status", Some("wrong".into()), vec![]),
            token,
            &*mock,
        );
        assert_eq!(status, 401);
        // 无效 JSON → 400；白名单超限 → 500 错误体。
        let (status, _) = route(
            base("POST", "/guard", Some(token.to_string()), b"{".to_vec()),
            token,
            &*mock,
        );
        assert_eq!(status, 400);
        let (status, _) = route(
            base(
                "POST",
                "/guard",
                Some(token.to_string()),
                br#"{"command":"lock","whitelist":["  "]}"#.to_vec(),
            ),
            token,
            &*mock,
        );
        assert_eq!(status, 500);
        // 未知路径 → 404；已知路径错误方法 → 405。
        let (status, _) = route(
            base("GET", "/nope", Some(token.to_string()), vec![]),
            token,
            &*mock,
        );
        assert_eq!(status, 404);
        let (status, _) = route(
            base("POST", "/guard/status", Some(token.to_string()), vec![]),
            token,
            &*mock,
        );
        assert_eq!(status, 405);
    }

    #[test]
    fn serve_end_to_end_over_real_socket() {
        let mock: Arc<Mock> = backend();
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let _server = std::thread::spawn({
            let mock = Arc::clone(&mock);
            move || serve(listener, "secret".into(), mock as Arc<dyn CommandBackend>).unwrap()
        });
        let call = |request: &str| -> (u16, String) {
            let mut stream = TcpStream::connect(address).unwrap();
            stream.write_all(request.as_bytes()).unwrap();
            let mut response = String::new();
            stream.read_to_string(&mut response).unwrap();
            let mut lines = response.split("\r\n");
            let status: u16 = lines
                .next()
                .and_then(|line| line.split_whitespace().nth(1))
                .unwrap()
                .parse()
                .unwrap();
            let body = response.split("\r\n\r\n").nth(1).unwrap().to_string();
            (status, body)
        };
        let lock = "POST /guard HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer secret\r\nContent-Length: 33\r\n\r\n{\"command\":\"lock\",\"whitelist\":[]}";
        let (status, body) = call(lock);
        assert_eq!(status, 200);
        assert_eq!(body, r#"{"ok":true}"#);
        assert!(mock.status().locked);
        let (status, body) = call(
            "GET /guard/status HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer secret\r\n\r\n",
        );
        assert_eq!(status, 200);
        let value: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(value["locked"], true);
        let (status, _) = call(
            "GET /guard/status HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer nope\r\n\r\n",
        );
        assert_eq!(status, 401);
        // accept 循环永不返回：不 join，随测试进程退出即可。
    }
}
