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
    check_origin(&headers)?;
    apply_preview(&engine, action, None)
        .map(Json)
        .map_err(error)
}
fn check_origin(headers: &HeaderMap) -> Result<(), (StatusCode, String)> {
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
    Ok(())
}
fn apply_preview(
    engine: &Shared,
    action: Action,
    expected: Option<String>,
) -> tomato_core::AppResult<Snapshot> {
    let mut engine = engine.lock().map_err(|e| e.to_string())?;
    let mut current = engine.snapshot(now())?.data;
    if let Some(expected) = expected {
        if !current.reminder_idle() || tomato_agent::files::fingerprint(&current)? != expected {
            return Err("数据已变化或计时已启动，请重新审阅".into());
        }
    }
    current.apply(
        serde_json::from_value(serde_json::to_value(&action).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?,
        now(),
    )?;
    if current.protected()
        || current.lock.schedules.iter().any(|s| s.enabled)
        || (current.settings.protection.mode != GuardMode::Off && current.settings.auto_focus)
    {
        return Err("浏览器预览不能控制桌面应用，请在桌面版使用专注保护".into());
    }
    engine.dispatch(action, now())
}
async fn agent_call(
    State(service): State<Arc<tomato_agent::Agent>>,
    headers: HeaderMap,
    Json(args): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    check_origin(&headers)?;
    service.request(args).map(Json).map_err(error)
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
    tomato_agent::mcp_entry();
    let path =
        std::env::var("TOMATO_DATA_PATH").unwrap_or_else(|_| "artifacts/preview.sqlite3".into());
    let dir = std::path::Path::new(&path)
        .parent()
        .unwrap_or(std::path::Path::new("."))
        .join("agent");
    let engine = Arc::new(Mutex::new(Engine::open(path).expect("无法打开本地数据库")));
    let action_engine = engine.clone();
    let resources = tomato_agent::resources(&std::env::current_exe().unwrap(), None);
    let service = tomato_agent::Agent::open(
        engine.clone(),
        dir,
        resources,
        Arc::new(move |action, expected| apply_preview(&action_engine, action, expected)),
        Arc::new(|| {}),
    )
    .expect("无法打开智能体状态");
    let observed = service.clone();
    let observed_engine = engine.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(5));
        if let Some(s) = observed_engine
            .lock()
            .ok()
            .and_then(|mut e| e.snapshot(now()).ok())
        {
            let _ = observed.observe(&s);
        }
    });
    let app = Router::new()
        .route("/api/snapshot", get(snapshot))
        .route("/api/plan", get(export_plan))
        .route("/api/action", post(dispatch))
        .route("/api/guard", get(guard_info))
        .layer(DefaultBodyLimit::max(20 * 1024 * 1024))
        .fallback_service(
            ServeDir::new("dist").not_found_service(ServeFile::new("dist/index.html")),
        )
        .with_state(engine)
        .merge(
            Router::new()
                .route("/api/agent", post(agent_call))
                .layer(DefaultBodyLimit::max(20 * 1024 * 1024))
                .with_state(service.clone()),
        );
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
    service.shutdown();
}
