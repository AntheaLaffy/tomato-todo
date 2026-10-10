use crate::{state::atomic_json, Agent};
use axum::{
    extract::{DefaultBodyLimit, State},
    http::{HeaderMap, StatusCode},
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
        Ok(json!({"tools":crate::tools::definitions(false)}))
    } else if args["method"] == "tools/call" {
        agent.call(
            args["name"].as_str().unwrap_or_default(),
            &args["arguments"],
            false,
        )
    } else {
        Err("未知 MCP 桥接请求".into())
    };
    result.map(Json).map_err(|e| (StatusCode::BAD_REQUEST, e))
}
pub fn start(agent: &Arc<Agent>) -> AppResult<()> {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let token = uuid::Uuid::new_v4().to_string();
    atomic_json(
        &agent.dir.join("connection.json"),
        &json!({"url":format!("http://127.0.0.1:{}/call",listener.local_addr().map_err(|e|e.to_string())?.port()),"token":token,"pid":std::process::id()}),
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
                        .layer(DefaultBodyLimit::max(1024 * 1024))
                        .with_state(connection);
                    let _ = axum::serve(listener, app).await;
                }
            });
        }
    });
    Ok(())
}
