//! Native Sway/i3 IPC and Hyprland IPC; never enumerate only Xwayland clients.
use super::{AppResult, Window};
use serde_json::Value;
use std::{
    io::{Read, Write},
    os::unix::net::UnixStream,
    path::PathBuf,
    time::Duration,
};

const MAX_REPLY: usize = 8 * 1024 * 1024;

fn socket(path: PathBuf) -> AppResult<UnixStream> {
    let stream = UnixStream::connect(path).map_err(|e| format!("无法连接合成器窗口接口：{e}"))?;
    stream
        .set_read_timeout(Some(Duration::from_millis(400)))
        .map_err(|e| e.to_string())?;
    stream
        .set_write_timeout(Some(Duration::from_millis(400)))
        .map_err(|e| e.to_string())?;
    Ok(stream)
}

fn sway_request(kind: u32, command: &str) -> AppResult<Value> {
    let path = std::env::var_os("SWAYSOCK").ok_or("未提供 SWAYSOCK")?;
    let mut stream = socket(path.into())?;
    let mut header = Vec::from(&b"i3-ipc"[..]);
    header.extend_from_slice(&(command.len() as u32).to_le_bytes());
    header.extend_from_slice(&kind.to_le_bytes());
    stream
        .write_all(&header)
        .and_then(|()| stream.write_all(command.as_bytes()))
        .map_err(|e| e.to_string())?;
    let mut header = [0; 14];
    stream.read_exact(&mut header).map_err(|e| e.to_string())?;
    let len = u32::from_le_bytes(header[6..10].try_into().unwrap()) as usize;
    if &header[..6] != b"i3-ipc"
        || u32::from_le_bytes(header[10..].try_into().unwrap()) != kind
        || len > MAX_REPLY
    {
        return Err("无效 Sway IPC 响应".into());
    }
    let mut data = vec![0; len];
    stream.read_exact(&mut data).map_err(|e| e.to_string())?;
    serde_json::from_slice(&data).map_err(|e| e.to_string())
}

fn sway_windows(node: &Value, output: &mut Vec<Window>) -> AppResult<()> {
    if node.get("app_id").is_some_and(|v| !v.is_null())
        || node.get("window").is_some_and(|v| !v.is_null())
    {
        output.push(Window {
            id: node["id"].as_u64().ok_or("Sway 窗口缺少 ID")?,
            app_id: node["app_id"]
                .as_str()
                .or_else(|| node["window_properties"]["class"].as_str())
                .map(str::to_owned),
            title: node["name"].as_str().map(str::to_owned),
            pid: node["pid"]
                .as_u64()
                .and_then(|pid| u32::try_from(pid).ok())
                .filter(|pid| *pid > 0),
            is_focused: node["focused"].as_bool().unwrap_or(false),
        });
    }
    for children in ["nodes", "floating_nodes"] {
        if let Some(nodes) = node[children].as_array() {
            for node in nodes {
                sway_windows(node, output)?;
            }
        }
    }
    Ok(())
}

pub fn sway_list() -> AppResult<Vec<Window>> {
    let mut windows = Vec::new();
    sway_windows(&sway_request(4, "")?, &mut windows)?;
    Ok(windows)
}

pub fn sway_focus(id: u64) -> AppResult<bool> {
    let reply = sway_request(0, &format!("[con_id={id}] focus"))?;
    let results = reply
        .as_array()
        .filter(|r| !r.is_empty())
        .ok_or("无效 Sway 激活响应")?;
    if let Some(error) = results.iter().find(|r| r["success"] != true) {
        return Err(format!("Sway 拒绝激活窗口：{}", error["error"]));
    }
    Ok(sway_list()?.iter().any(|w| w.id == id && w.is_focused))
}

fn hypr_request(command: &str) -> AppResult<String> {
    let signature = std::env::var("HYPRLAND_INSTANCE_SIGNATURE").map_err(|e| e.to_string())?;
    if signature.is_empty() || signature.contains('/') || signature == "." || signature == ".." {
        return Err("无效 Hyprland 会话标识".into());
    }
    let runtime = std::env::var_os("XDG_RUNTIME_DIR").ok_or("未提供 XDG_RUNTIME_DIR")?;
    let mut stream = socket(
        PathBuf::from(runtime)
            .join("hypr")
            .join(signature)
            .join(".socket.sock"),
    )?;
    stream
        .write_all(command.as_bytes())
        .map_err(|e| e.to_string())?;
    let mut reply = String::new();
    stream
        .take((MAX_REPLY + 1) as u64)
        .read_to_string(&mut reply)
        .map_err(|e| e.to_string())?;
    if reply.len() > MAX_REPLY {
        return Err("Hyprland 响应过大".into());
    }
    Ok(reply)
}

fn address(value: &Value) -> AppResult<u64> {
    let raw = value
        .as_str()
        .and_then(|s| s.strip_prefix("0x"))
        .ok_or("无效 Hyprland 窗口地址")?;
    u64::from_str_radix(raw, 16).map_err(|e| e.to_string())
}

pub fn hypr_list() -> AppResult<Vec<Window>> {
    // Query the focused window last, so closed/new windows cannot turn a stale
    // active address into an implicit whitelist exemption.
    let clients: Value =
        serde_json::from_str(&hypr_request("j/clients")?).map_err(|e| e.to_string())?;
    let active: Value =
        serde_json::from_str(&hypr_request("j/activewindow")?).map_err(|e| e.to_string())?;
    let focused = if active.get("address").is_some() {
        Some(address(&active["address"])?)
    } else {
        None
    };
    let mut windows = clients
        .as_array()
        .ok_or("无效 Hyprland 窗口列表")?
        .iter()
        .filter(|w| w["mapped"].as_bool().unwrap_or(true))
        .map(|w| {
            Ok(Window {
                id: address(&w["address"])?,
                app_id: w["class"]
                    .as_str()
                    .filter(|s| !s.is_empty())
                    .map(str::to_owned),
                title: w["title"].as_str().map(str::to_owned),
                pid: w["pid"]
                    .as_u64()
                    .and_then(|p| u32::try_from(p).ok())
                    .filter(|p| *p > 0),
                is_focused: focused == Some(address(&w["address"])?),
            })
        })
        .collect::<AppResult<Vec<_>>>()?;
    if let Some(id) = focused.filter(|id| !windows.iter().any(|w| w.id == *id)) {
        windows.push(Window {
            id,
            app_id: None,
            title: None,
            pid: None,
            is_focused: true,
        });
    }
    Ok(windows)
}

pub fn hypr_focus(id: u64) -> AppResult<bool> {
    let reply = hypr_request(&format!("dispatch focuswindow address:0x{id:x}"))?;
    if reply.trim() != "ok" {
        return Err(format!("Hyprland 拒绝激活窗口：{reply}"));
    }
    Ok(hypr_list()?.iter().any(|w| w.id == id && w.is_focused))
}
