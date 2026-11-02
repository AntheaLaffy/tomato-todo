use crate::{state::atomic_json, Agent};
use axum::{
    extract::{DefaultBodyLimit, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::post,
    Json, Router,
};
use serde_json::{json, Value};
use std::sync::{Arc, Weak};
use tomato_core::AppResult;
#[derive(Clone)]
struct Connection {
    agent: Weak<Agent>,
    token: String,
}
fn authorize(
    connection: &Connection,
    headers: &HeaderMap,
) -> Result<Arc<Agent>, (StatusCode, String)> {
    if headers.contains_key("origin") {
        return Err((StatusCode::FORBIDDEN, "MCP 不接受浏览器 Origin".into()));
    }
    if headers.get("authorization").and_then(|h| h.to_str().ok())
        != Some(format!("Bearer {}", connection.token).as_str())
    {
        return Err((StatusCode::UNAUTHORIZED, "MCP 连接认证失败".into()));
    }
    connection
        .agent
        .upgrade()
        .ok_or((StatusCode::SERVICE_UNAVAILABLE, "软件已关闭".into()))
}

async fn mcp_get(State(connection): State<Connection>, headers: HeaderMap) -> Response {
    match authorize(&connection, &headers) {
        Err(error) => error.into_response(),
        Ok(_) => StatusCode::METHOD_NOT_ALLOWED.into_response(),
    }
}

async fn mcp_post(
    State(connection): State<Connection>,
    headers: HeaderMap,
    Json(message): Json<Value>,
) -> Response {
    let agent = match authorize(&connection, &headers) {
        Ok(agent) => agent,
        Err(error) => return error.into_response(),
    };
    if headers
        .get("mcp-protocol-version")
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| !["2025-11-25", "2025-06-18", "2025-03-26"].contains(&v))
    {
        return (StatusCode::BAD_REQUEST, "不支持的 MCP 协议版本").into_response();
    }
    if message["jsonrpc"] != "2.0" || !message.is_object() {
        return Json(json!({"jsonrpc":"2.0","id":Value::Null,"error":{"code":-32600,"message":"Invalid Request"}})).into_response();
    }
    let Some(id) = message.get("id").cloned() else {
        return StatusCode::ACCEPTED.into_response();
    };
    let method = message["method"].as_str().unwrap_or_default().to_owned();
    let params = message["params"].clone();
    let result = tokio::task::spawn_blocking(move || agent.mcp_method(&method, &params)).await;
    let reply = match result {
        Ok(Ok(result)) => json!({"jsonrpc":"2.0","id":id,"result":result}),
        Ok(Err(error)) => {
            json!({"jsonrpc":"2.0","id":id,"error":{"code":if error == "未知MCP方法" { -32601 } else { -32602 },"message":error}})
        }
        Err(error) => {
            json!({"jsonrpc":"2.0","id":id,"error":{"code":-32603,"message":error.to_string()}})
        }
    };
    Json(reply).into_response()
}
async fn call(
    State(connection): State<Connection>,
    headers: HeaderMap,
    Json(args): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
    if headers.contains_key("origin")
        || headers.get("authorization").and_then(|h| h.to_str().ok())
            != Some(format!("Bearer {}", connection.token).as_str())
    {
        return Err((StatusCode::UNAUTHORIZED, "MCP 连接认证失败".into()));
    }
    let agent = connection
        .agent
        .upgrade()
        .ok_or((StatusCode::SERVICE_UNAVAILABLE, "软件已关闭".into()))?;
    let result = if args["method"] == "tools/list" {
        Ok(json!({"tools":crate::tools::external_definitions()}))
    } else if args["method"] == "tools/call" {
        agent.call_external(
            args["name"].as_str().unwrap_or_default(),
            &args["arguments"],
        )
    } else {
        agent.mcp_method(args["method"].as_str().unwrap_or_default(), &args)
    };
    result.map(Json).map_err(|e| (StatusCode::BAD_REQUEST, e))
}
pub fn start(agent: &Arc<Agent>) -> AppResult<()> {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let token = uuid::Uuid::new_v4().to_string();
    atomic_json(
        &agent.dir.join("connection.json"),
        &json!({"url":format!("http://127.0.0.1:{}/call",listener.local_addr().map_err(|e|e.to_string())?.port()),"mcpUrl":format!("http://127.0.0.1:{}/mcp",listener.local_addr().map_err(|e|e.to_string())?.port()),"token":token,"pid":std::process::id()}),
    )?;
    let connection = Connection {
        agent: Arc::downgrade(agent),
        token,
    };
    std::thread::spawn(move || {
        if let Ok(runtime) = tokio::runtime::Runtime::new() {
            runtime.block_on(async move {
                if let Ok(listener) = tokio::net::TcpListener::from_std(listener) {
                    let app = Router::new()
                        .route("/call", post(call))
                        .route("/mcp", post(mcp_post).get(mcp_get))
                        .layer(DefaultBodyLimit::max(1024 * 1024))
                        .with_state(connection);
                    let _ = axum::serve(listener, app).await;
                }
            });
        }
    });
    Ok(())
}
