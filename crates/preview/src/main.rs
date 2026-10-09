use axum::{
    extract::{DefaultBodyLimit, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use std::sync::{Arc, Mutex};
use tomato_core::{now, Action, Engine, GuardMode, Snapshot};
use tower_http::services::{ServeDir, ServeFile};

type Shared = Arc<Mutex<Engine>>;
type ApiResult = Result<Json<Snapshot>, (StatusCode, String)>;
fn error(e: impl ToString) -> (StatusCode, String) {
    (StatusCode::BAD_REQUEST, e.to_string())
}
async fn snapshot(State(engine): State<Shared>) -> ApiResult {
    engine
        .lock()
        .map_err(error)?
        .snapshot(now())
        .map(Json)
        .map_err(error)
}
async fn export_plan(
    State(engine): State<Shared>,
) -> Result<Json<tomato_core::plan::PlanFile>, (StatusCode, String)> {
    Ok(Json(
        engine
            .lock()
            .map_err(error)?
            .snapshot(now())
            .map_err(error)?
            .data
            .export_plan(),
    ))
}
async fn dispatch(
    State(engine): State<Shared>,
    headers: HeaderMap,
    Json(action): Json<Action>,
) -> ApiResult {
    // Reject cross-origin browser writes to this local development server.
    if let Some(origin) = headers.get("origin") {
        let origin = origin.to_str().unwrap_or_default();
        let own_origin = format!(
            "http://127.0.0.1:{}",
            std::env::var("TOMATO_PORT").unwrap_or_else(|_| "4319".into())
        );
        if ![
            own_origin.as_str(),
            "http://127.0.0.1:1420",
            "http://localhost:1420",
            "http://127.0.0.1:4319",
        ]
        .contains(&origin)
        {
            return Err((StatusCode::FORBIDDEN, "不允许此来源".into()));
        }
    }
    let mut engine = engine.lock().map_err(error)?;
    let mut current = engine.snapshot(now()).map_err(error)?.data;
    current
        .apply(
            serde_json::from_value(serde_json::to_value(&action).map_err(error)?).map_err(error)?,
            now(),
        )
        .map_err(error)?;
    if current.protected()
        || current.lock.schedules.iter().any(|s| s.enabled)
        || (current.settings.protection.mode != GuardMode::Off && current.settings.auto_focus)
    {
        return Err(error("浏览器预览不能控制桌面应用，请在桌面版使用专注保护"));
    }
    engine.dispatch(action, now()).map(Json).map_err(error)
}
async fn guard_info() -> Json<tomato_core::guard::GuardInfo> {
    Json(tomato_core::guard::GuardInfo {
        available: false,
        backend: "浏览器预览".into(),
        message: "请在 Linux 桌面版中开启应用白名单与锁定保护。".into(),
        windows: vec![],
    })
}
#[tokio::main]
async fn main() {
    let path =
        std::env::var("TOMATO_DATA_PATH").unwrap_or_else(|_| "artifacts/preview.sqlite3".into());
    let engine = Engine::open(path).expect("无法打开本地数据库");
    let app = Router::new()
        .route("/api/snapshot", get(snapshot))
        .route("/api/plan", get(export_plan))
        .route("/api/action", post(dispatch))
        .route("/api/guard", get(guard_info))
        .layer(DefaultBodyLimit::max(20 * 1024 * 1024))
        .fallback_service(
            ServeDir::new("dist").not_found_service(ServeFile::new("dist/index.html")),
        )
        .with_state(Arc::new(Mutex::new(engine)));
    let port = std::env::var("TOMATO_PORT").unwrap_or_else(|_| "4319".into());
    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{port}"))
        .await
        .expect("端口已被占用");
    println!("Tomato Rust preview: http://127.0.0.1:{port}");
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await
        .unwrap();
}
