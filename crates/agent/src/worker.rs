use crate::Agent;
use serde_json::{json, Value};
use std::{
    io::{BufRead, BufReader, Write},
    process::{Child, ChildStdin, Command, Stdio},
    sync::Arc,
};
use tomato_core::AppResult;
pub struct Process {
    pub child: Child,
    pub stdin: ChildStdin,
}
pub fn start(agent: &Arc<Agent>) -> AppResult<Process> {
    let node = agent.resources.join("bin/node");
    if !node.exists() || !agent.resources.join("worker.mjs").exists() {
        return Err("Agent 运行包未构建，请运行 pnpm run agent:build 后重新启动".into());
    }
    let mut child = Command::new(node)
        .arg(agent.resources.join("worker.mjs"))
        .arg(&agent.dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .env("NODE_NO_WARNINGS", "1")
        .spawn()
        .map_err(|e| e.to_string())?;
    let stdin = child.stdin.take().ok_or("无法连接 Agent 输入")?;
    let stdout = child.stdout.take().ok_or("无法连接 Agent 输出")?;
    let weak = Arc::downgrade(agent);
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            let Some(agent) = weak.upgrade() else {
                return;
            };
            let Ok(line) = line else {
                break;
            };
            if line.len() > 20 * 1024 * 1024 {
                agent.failure("Agent 输出超过限制");
                break;
            }
            let Ok(event) = serde_json::from_str::<Value>(&line) else {
                continue;
            };
            if event["type"] == "tool_call" {
                let result = agent.call_job(
                    event["name"].as_str().unwrap_or_default(),
                    &event["arguments"],
                    event["jobId"].as_str().unwrap_or_default(),
                );
                let reply = match result {
                    Ok(value) => json!({"op":"tool_result","id":event["id"],"result":value}),
                    Err(error) => json!({"op":"tool_result","id":event["id"],"error":error}),
                };
                if let Ok(mut process) = agent.process.lock() {
                    if let Some(process) = process.as_mut() {
                        let _ = send(process, &reply);
                    }
                }
            } else if event["type"] == "network_result" {
                if let Ok(mut pending) = agent.network_pending.lock() {
                    if let Some(tx) = event["id"].as_str().and_then(|id| pending.remove(id)) {
                        let _ = tx.send(if let Some(error) = event["error"].as_str() {
                            Err(error.into())
                        } else {
                            Ok(event["result"].clone())
                        });
                    }
                }
            } else {
                agent.event(event);
            }
        }
        if let Some(agent) = weak.upgrade() {
            agent.failure("Agent 进程已退出；重试会重新启动，历史与记忆仍保留");
        }
    });
    Ok(Process { child, stdin })
}
pub fn send(process: &mut Process, value: &Value) -> AppResult<()> {
    serde_json::to_writer(&mut process.stdin, value).map_err(|e| e.to_string())?;
    process.stdin.write_all(b"\n").map_err(|e| e.to_string())?;
    process.stdin.flush().map_err(|e| e.to_string())
}
