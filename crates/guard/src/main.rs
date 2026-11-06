//! tomato-guard：番茄 Todo 专注保护守护进程。
//! 无域无状态：锁定只活在进程内，进程重启后不恢复锁定（runtime 会重发命令）。
//! 入口：
//!   --serve [--data DIR] [--port N] [--lock [--whitelist a,b]]  常驻 HTTP 服务
//!   --lock [--whitelist a,b] [--data DIR] [--port N]            上锁并前台 enforce（调试）
//!   --unlock [--data DIR] [--port N]                            向运行中的 guard 解锁（调试）
//!   --notify TITLE BODY [--data DIR]                            直接发系统通知（调试）
mod guard;
mod http;
mod notify;
mod protocol;
mod state;
mod token;

use crate::http::CommandBackend;
use crate::protocol::Status;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::Arc;

const USAGE: &str = "\
tomato-guard —— 番茄 Todo 专注保护守护进程（无域无状态，由 tomato-runtime 经 HTTP 指挥）

用法：
  tomato-guard --serve [--data DIR] [--port N] [--lock [--whitelist a,b]]
      常驻：监听 127.0.0.1:43988（默认），请求需 Bearer token
      （token 文件在 --data，默认 ~/.local/share/studio.tomato.todo/guard/token）
  tomato-guard --lock [--whitelist a,b] [--data DIR] [--port N]
      立即上锁（全屏锁窗 + 白名单）并保持 enforce 循环，直到进程退出
  tomato-guard --unlock [--data DIR] [--port N]
      向本机运行中的 guard 发送 unlock（一次性 HTTP 客户端）
  tomato-guard --notify TITLE BODY
      直接发送一条系统通知

HTTP 接口（契约见 API.md）：
  POST /guard       {\"command\":\"lock\",\"whitelist\":[...]} / {\"command\":\"unlock\"}
                    / {\"command\":\"notify\",\"title\":...,\"body\":...}
  GET  /guard/status → {\"locked\":bool,\"whitelist\":[...],\"pid\":n}

锁定期间白名单外的应用会被切回锁窗；白名单为空即严格锁定。
guard 不保存任何长期状态：进程重启后不恢复锁定，runtime 会重发命令。
";

#[derive(Debug)]
enum Args {
    Serve {
        data: Option<PathBuf>,
        port: u16,
        lock: bool,
        whitelist: Vec<String>,
    },
    Unlock {
        data: Option<PathBuf>,
        port: u16,
    },
    Notify {
        title: String,
        body: String,
    },
    Help,
}

fn parse_args() -> Result<Args, String> {
    parse_from(std::env::args().skip(1))
}

/// 从任意参数迭代器解析（便于单测）；环境参数由 parse_args 注入。
fn parse_from(mut args: impl Iterator<Item = String>) -> Result<Args, String> {
    let mut data: Option<PathBuf> = None;
    let mut port = http::DEFAULT_PORT;
    let mut serve = false;
    let mut lock = false;
    let mut unlock = false;
    let mut whitelist: Vec<String> = Vec::new();
    let mut notify: Option<(String, String)> = None;
    let mut positionals: Vec<String> = Vec::new();
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--help" | "-h" => return Ok(Args::Help),
            "--serve" => serve = true,
            "--lock" => lock = true,
            "--unlock" => unlock = true,
            "--notify" => {
                let title = args.next().ok_or("--notify 需要 TITLE 与 BODY 两个参数")?;
                let body = args.next().ok_or("--notify 需要 TITLE 与 BODY 两个参数")?;
                notify = Some((title, body));
            }
            "--data" => {
                let dir = args.next().ok_or("--data 需要一个目录参数")?;
                data = Some(PathBuf::from(dir));
            }
            "--port" => {
                let value = args.next().ok_or("--port 需要一个端口参数")?;
                port = value.parse::<u16>().map_err(|_| format!("无效端口：{value}"))?;
            }
            "--whitelist" => {
                let value = args.next().ok_or("--whitelist 需要逗号分隔的 app id")?;
                whitelist = value
                    .split(',')
                    .map(|item| item.trim().to_string())
                    .filter(|item| !item.is_empty())
                    .collect();
            }
            other if other.starts_with('-') => return Err(format!("未知参数：{other}")),
            other => positionals.push(other.to_string()),
        }
    }
    if let Some((title, body)) = notify {
        if serve || lock || !positionals.is_empty() {
            return Err("--notify 不能与 --serve/--lock 混用".into());
        }
        return Ok(Args::Notify { title, body });
    }
    if !positionals.is_empty() {
        return Err("多余的位置参数".into());
    }
    if serve || lock {
        if unlock {
            return Err("--unlock 不能与 --serve/--lock 混用".into());
        }
        return Ok(Args::Serve { data, port, lock, whitelist });
    }
    Ok(Args::Unlock { data, port })
}

impl crate::http::CommandBackend for state::State {
    fn lock(&self, whitelist: Vec<String>) -> Result<(), String> {
        state::State::lock(self, whitelist)
    }
    fn unlock(&self) -> Result<(), String> {
        state::State::unlock(self);
        Ok(())
    }
    fn notify(&self, title: String, body: String) -> Result<(), String> {
        notify::show(&title, &body)
    }
    fn status(&self) -> Status {
        state::State::status(self)
    }
}

fn main() {
    let args = match parse_args() {
        Ok(args) => args,
        Err(error) => {
            eprintln!("参数错误：{error}\n");
            eprint!("{USAGE}");
            std::process::exit(2);
        }
    };
    match args {
        Args::Help => {
            print!("{USAGE}");
        }
        Args::Serve { data, port, lock, whitelist } => {
            let data_dir = data.unwrap_or_else(token::default_data_dir);
            let token_value =
                token::load_or_create(&data_dir).unwrap_or_else(|error| {
                    eprintln!("无法准备 token 文件：{error}");
                    std::process::exit(1);
                });
            let listener = TcpListener::bind(("127.0.0.1", port)).unwrap_or_else(|error| {
                eprintln!("无法监听 127.0.0.1:{port}：{error}");
                std::process::exit(1);
            });
            println!(
                "tomato-guard 已启动：http://127.0.0.1:{port}（token 文件：{}）",
                token::token_file(&data_dir).display()
            );
            let state = Arc::new(state::State::new());
            if lock {
                match state.lock(whitelist) {
                    Ok(()) => println!("tomato-guard：已锁定（白名单 {} 项）", state.status().whitelist.len()),
                    Err(error) => {
                        eprintln!("锁定失败：{error}");
                        std::process::exit(1);
                    }
                }
            }
            let backend: Arc<dyn CommandBackend> = state;
            if let Err(error) = http::serve(listener, token_value, backend) {
                eprintln!("HTTP 服务异常退出：{error}");
                std::process::exit(1);
            }
        }
        Args::Unlock { data, port } => {
            let data_dir = data.unwrap_or_else(token::default_data_dir);
            let token_value = token::load_or_create(&data_dir).unwrap_or_else(|error| {
                eprintln!("无法读取 token 文件：{error}");
                std::process::exit(1);
            });
            match post_unlock(port, &token_value) {
                Ok(message) => {
                    println!("{message}");
                }
                Err(error) => {
                    eprintln!("解锁失败：{error}");
                    std::process::exit(1);
                }
            }
        }
        Args::Notify { title, body } => match notify::show(&title, &body) {
            Ok(()) => println!("通知已发送：{title}"),
            Err(error) => {
                eprintln!("{error}");
                std::process::exit(1);
            }
        },
    }
}

/// 一次性 HTTP 客户端：POST /guard {"command":"unlock"}，供 --unlock 调试用。
fn post_unlock(port: u16, token_value: &str) -> Result<String, String> {
    let body = r#"{"command":"unlock"}"#;
    let request = format!(
        "POST /guard HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer {token_value}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len(),
    );
    let mut stream =
        TcpStream::connect(("127.0.0.1", port)).map_err(|error| format!("guard 服务未运行：{error}"))?;
    stream
        .write_all(request.as_bytes())
        .map_err(|error| error.to_string())?;
    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .map_err(|error| error.to_string())?;
    let status = response
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .ok_or("无效响应")?;
    let body = response.split("\r\n\r\n").nth(1).unwrap_or("");
    let value: serde_json::Value =
        serde_json::from_str(body).map_err(|_| format!("响应不是 JSON：{body}"))?;
    if status == "200" {
        Ok("已解锁".into())
    } else {
        Err(value
            .get("error")
            .and_then(|error| error.as_str())
            .map(str::to_owned)
            .unwrap_or_else(|| format!("HTTP {status}")))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parsed(arguments: &[&str]) -> Result<Args, String> {
        parse_from(arguments.iter().map(|arg| arg.to_string()))
    }

    #[test]
    fn cli_parses_serve_lock_and_whitelist() {
        match parsed(&["--serve", "--data", "/tmp/guard", "--lock", "--whitelist", "code, firefox"]).unwrap() {
            Args::Serve { data, port, lock, whitelist } => {
                assert_eq!(data, Some(PathBuf::from("/tmp/guard")));
                assert_eq!(port, http::DEFAULT_PORT);
                assert!(lock);
                assert_eq!(whitelist, vec!["code".to_string(), "firefox".to_string()]);
            }
            other => panic!("unexpected args: {other:?}"),
        }
        match parsed(&["--serve", "--port", "43999"]).unwrap() {
            Args::Serve { port, lock, .. } => {
                assert_eq!(port, 43999);
                assert!(!lock);
            }
            other => panic!("unexpected args: {other:?}"),
        }
    }

    #[test]
    fn cli_parses_unlock_and_notify() {
        match parsed(&["--unlock", "--data", "/tmp/guard"]).unwrap() {
            Args::Unlock { data, port } => {
                assert_eq!(data, Some(PathBuf::from("/tmp/guard")));
                assert_eq!(port, http::DEFAULT_PORT);
            }
            other => panic!("unexpected args: {other:?}"),
        }
        match parsed(&["--notify", "番茄", "休息一下"]).unwrap() {
            Args::Notify { title, body } => {
                assert_eq!(title, "番茄");
                assert_eq!(body, "休息一下");
            }
            other => panic!("unexpected args: {other:?}"),
        }
        assert!(matches!(parsed(&["--help"]).unwrap(), Args::Help));
        assert!(parsed(&["--notify", "缺参数"]).is_err());
        assert!(parsed(&["--unknown"]).is_err());
        assert!(parsed(&["--port", "not-a-port"]).is_err());
        assert!(parsed(&["多余位置参数"]).is_err());
    }
}
