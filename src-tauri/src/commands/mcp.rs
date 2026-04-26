//! MCP Speak HTTP 리스너
//!
//! 127.0.0.1:8791에 axum HTTP 서버를 띄워
//! MCP 채널 서버들이 POST /speak 으로 텍스트를 보내면
//! 프론트엔드에 `mcp-speak` 이벤트를 발행한다.
//!
//! 보안:
//! - 127.0.0.1 바인딩 (외부 네트워크 차단)
//! - Bearer 토큰 인증 (~/.mypartnerai/mcp-token)
//! - 텍스트 최대 1000자, 요청 최대 4KB
//! - 분당 30회 Rate Limiting

use axum::{
    body::Bytes,
    extract::State,
    http::{HeaderMap, StatusCode},
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Emitter};

const MAX_TEXT_LENGTH: usize = 1000;
const MAX_BODY_SIZE: usize = 4096;
const RATE_LIMIT_PER_MINUTE: usize = 30;
const DEFAULT_PORT: u16 = 8791;

#[derive(Debug, Deserialize)]
struct SpeakRequest {
    text: String,
    source: String,
    #[serde(default = "default_priority")]
    priority: String,
    emotion: Option<String>,
    voice: Option<String>,
}

fn default_priority() -> String {
    "normal".to_string()
}

#[derive(Debug, Serialize, Clone)]
pub struct SpeakEvent {
    pub text: String,
    pub source: String,
    pub priority: String,
    pub emotion: Option<String>,
    pub voice: Option<String>,
}

#[derive(Serialize)]
struct SpeakResponse {
    accepted: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    queue_position: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    queue_size: u32,
}

struct AppState {
    app_handle: AppHandle,
    token: String,
    rate_limiter: Mutex<RateLimiter>,
}

struct RateLimiter {
    timestamps: Vec<Instant>,
}

impl RateLimiter {
    fn new() -> Self {
        Self {
            timestamps: Vec::new(),
        }
    }

    fn check_and_record(&mut self) -> bool {
        let now = Instant::now();
        let one_minute_ago = now - std::time::Duration::from_secs(60);
        self.timestamps.retain(|t| *t > one_minute_ago);

        if self.timestamps.len() >= RATE_LIMIT_PER_MINUTE {
            return false;
        }
        self.timestamps.push(now);
        true
    }
}

fn get_token_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_default();
    home.join(".mypartnerai").join("mcp-token")
}

/// 앱 시작 시 토큰을 생성하거나 기존 토큰을 읽는다.
fn ensure_token() -> Result<String, String> {
    let token_path = get_token_path();

    // 기존 토큰이 있으면 재사용
    if token_path.exists() {
        if let Ok(token) = std::fs::read_to_string(&token_path) {
            let token = token.trim().to_string();
            if !token.is_empty() {
                return Ok(token);
            }
        }
    }

    // 디렉토리 생성
    if let Some(parent) = token_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create token directory: {}", e))?;
    }

    // 새 UUID 토큰 생성
    let token = uuid::Uuid::new_v4().to_string();
    std::fs::write(&token_path, &token)
        .map_err(|e| format!("Failed to write token file: {}", e))?;

    // 토큰 파일 퍼미션 600 (소유자만 읽기/쓰기)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&token_path, std::fs::Permissions::from_mode(0o600));
        // 디렉토리도 700
        if let Some(parent) = token_path.parent() {
            let _ = std::fs::set_permissions(parent, std::fs::Permissions::from_mode(0o700));
        }
    }

    eprintln!("[MCP] Token generated at {:?}", token_path);
    Ok(token)
}

fn verify_auth(headers: &HeaderMap, expected_token: &str) -> Result<(), StatusCode> {
    let auth = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if let Some(token) = auth.strip_prefix("Bearer ") {
        if token == expected_token {
            return Ok(());
        }
    }

    Err(StatusCode::UNAUTHORIZED)
}

async fn handle_speak(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<SpeakResponse>, StatusCode> {
    // 인증
    verify_auth(&headers, &state.token)?;

    // 요청 크기 제한
    if body.len() > MAX_BODY_SIZE {
        return Ok(Json(SpeakResponse {
            accepted: false,
            queue_position: None,
            error: Some("Request too large (max 4KB)".to_string()),
        }));
    }

    // Rate Limiting
    {
        let mut limiter = state.rate_limiter.lock().expect("rate limiter mutex poisoned");
        if !limiter.check_and_record() {
            return Err(StatusCode::TOO_MANY_REQUESTS);
        }
    }

    // 파싱
    let req: SpeakRequest = serde_json::from_slice(&body)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    // 텍스트 길이 제한
    if req.text.len() > MAX_TEXT_LENGTH {
        return Ok(Json(SpeakResponse {
            accepted: false,
            queue_position: None,
            error: Some(format!("Text too long (max {} chars)", MAX_TEXT_LENGTH)),
        }));
    }

    if req.text.trim().is_empty() {
        return Ok(Json(SpeakResponse {
            accepted: false,
            queue_position: None,
            error: Some("Empty text".to_string()),
        }));
    }

    // 프론트엔드에 이벤트 발행
    let event = SpeakEvent {
        text: req.text,
        source: req.source,
        priority: req.priority,
        emotion: req.emotion,
        voice: req.voice,
    };

    let _ = state.app_handle.emit("mcp-speak", event);

    Ok(Json(SpeakResponse {
        accepted: true,
        queue_position: Some(0),
        error: None,
    }))
}

async fn handle_health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        queue_size: 0,
    })
}

/// MCP HTTP 리스너를 시작한다.
/// 포트 바인딩 실패 시 앱 시작에 영향 없이 경고만 출력한다.
pub fn start_mcp_listener(app_handle: AppHandle) {
    let token = match ensure_token() {
        Ok(t) => t,
        Err(e) => {
            eprintln!("[MCP] Token generation failed: {}", e);
            return;
        }
    };

    let port_str = std::env::var("AMA_SPEAK_PORT").unwrap_or_default();
    let port: u16 = port_str.parse().unwrap_or(DEFAULT_PORT);

    let state = Arc::new(AppState {
        app_handle,
        token,
        rate_limiter: Mutex::new(RateLimiter::new()),
    });

    let app = Router::new()
        .route("/speak", post(handle_speak))
        .route("/health", get(handle_health))
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));

    tauri::async_runtime::spawn(async move {
        let listener = match tokio::net::TcpListener::bind(addr).await {
            Ok(l) => l,
            Err(e) => {
                eprintln!("[MCP] Failed to bind 127.0.0.1:{} — {}", port, e);
                return;
            }
        };
        eprintln!("[MCP] HTTP listener started on 127.0.0.1:{}", port);

        if let Err(e) = axum::serve(listener, app).await {
            eprintln!("[MCP] HTTP server error: {}", e);
        }
    });
}

/// 디렉토리를 재귀적으로 복사
fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

// ─── Node.js 경路 탐색 ───

/// macOS 앱 번들에서는 셸 PATH가 제한되므로 npm/npx를 직접 탐색한다.
/// Homebrew(ARM/Intel), nvm, fnm, volta, 시스템 경로를 모두 확인.
fn find_node_bin(name: &str) -> Result<String, String> {
    // 1. PATH에서 직접 찾기 — which로 절대경로 확보
    if let Ok(output) = std::process::Command::new("which").arg(name).output() {
        if output.status.success() {
            let abs_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !abs_path.is_empty() && std::path::Path::new(&abs_path).exists() {
                return Ok(abs_path);
            }
        }
    }

    // 2. 잘 알려진 경로 후보
    let home = dirs::home_dir().unwrap_or_default();
    let mut candidates: Vec<std::path::PathBuf> = vec![
        // Homebrew (Apple Silicon)
        std::path::PathBuf::from(format!("/opt/homebrew/bin/{}", name)),
        // Homebrew (Intel)
        std::path::PathBuf::from(format!("/usr/local/bin/{}", name)),
        // 시스템
        std::path::PathBuf::from(format!("/usr/bin/{}", name)),
        // volta
        home.join(format!(".volta/bin/{}", name)),
    ];

    // 3. nvm — 현재 default alias 또는 최신 설치 버전
    let nvm_dir = home.join(".nvm/versions/node");
    if nvm_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
            let mut versions: Vec<std::path::PathBuf> = entries
                .filter_map(|e| e.ok())
                .map(|e| e.path())
                .filter(|p| p.is_dir())
                .collect();
            // 최신 버전 우선 (역순 정렬)
            versions.sort();
            versions.reverse();
            for v in versions {
                candidates.push(v.join(format!("bin/{}", name)));
            }
        }
    }

    // 4. fnm
    let fnm_dir = home.join(".fnm/aliases/default");
    if fnm_dir.exists() {
        candidates.push(fnm_dir.join(format!("bin/{}", name)));
    }

    for candidate in &candidates {
        if candidate.exists() {
            if let Ok(output) = std::process::Command::new(candidate).arg("--version").output() {
                if output.status.success() {
                    return Ok(candidate.to_string_lossy().to_string());
                }
            }
        }
    }

    Err(format!(
        "{} not found. Please install Node.js (https://nodejs.org). Checked: PATH, {}",
        name,
        candidates.iter().map(|p| p.to_string_lossy().to_string()).collect::<Vec<_>>().join(", ")
    ))
}

// ─── Claude Code 글로벌 채널 등록/해제 ───

/// 앱 번들 리소스에서 ama-bridge 플러그인 파일을 ~/.mypartnerai/ama-bridge/에 추출하고
/// npm install을 실행한다. 배포 앱에서 bridge 파일을 사용할 수 있게 한다.
#[tauri::command]
pub async fn setup_bridge_plugin(app: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;

    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let target_dir = home.join(".mypartnerai").join("ama-bridge");
    let shared_dir = target_dir.join("shared");
    let plugin_dir = target_dir.join(".claude-plugin");

    // 1. 대상 디렉토리 생성
    std::fs::create_dir_all(&shared_dir)
        .map_err(|e| format!("Failed to create shared dir: {}", e))?;
    std::fs::create_dir_all(&plugin_dir)
        .map_err(|e| format!("Failed to create .claude-plugin dir: {}", e))?;

    // 2. 앱 번들 리소스에서 파일 복사
    let resource_dir = app.path().resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;
    let bridge_resource = resource_dir.join("ama-bridge");

    let files: &[&str] = &[
        "server.ts",
        "package.json",
        "tsconfig.json",
        "shared/config.mts",
        ".claude-plugin/plugin.json",
        ".mcp.json",
    ];

    let mut copied_count = 0;
    for file in files {
        let src = bridge_resource.join(file);
        let dst = target_dir.join(file);
        if src.exists() {
            // 부모 디렉토리 보장
            if let Some(parent) = dst.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            std::fs::copy(&src, &dst).map_err(|e| {
                format!("Failed to copy {}: {}", file, e)
            })?;
            copied_count += 1;
        } else {
            eprintln!("[MCP] Resource file not found: {}", src.display());
        }
    }

    if copied_count == 0 {
        return Err(format!(
            "No bridge resource files found in {}. Is the app bundle intact?",
            bridge_resource.display()
        ));
    }

    // 3. node_modules가 없으면 로그인 셸로 npm install 실행
    //    /bin/sh -l -c 로 실행하면 ~/.zshrc/.bashrc에서 PATH가 로드됨
    //    (Homebrew, nvm, fnm, volta 등 모든 Node.js 설치 방식 대응)
    let nm_dst = target_dir.join("node_modules");
    if !nm_dst.exists() {
        let target_dir_clone = target_dir.clone();
        let output = tokio::task::spawn_blocking(move || {
            std::process::Command::new("/bin/sh")
                .args(["-l", "-c", "npm install"])
                .current_dir(&target_dir_clone)
                .output()
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
        .map_err(|e| format!("npm install failed to start: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("npm install failed: {}", stderr));
        }
    }

    Ok(format!(
        "Bridge plugin set up at {} ({} files)",
        target_dir.display(),
        copied_count
    ))
}

/// ~/.mypartnerai/ama-bridge/ 에 bridge 파일을 준비하고
/// ~/.claude.json (user scope)에 ama-bridge 서버를 등록한다.
///
/// 소스 우선순위:
/// 1. 개발 환경: project_dir의 claude-plugin/ama-bridge/
/// 2. 배포 환경: ~/.mypartnerai/ama-bridge/ (setup_bridge_plugin으로 추출된 파일)
#[tauri::command]
pub fn register_channel_global(project_dir: Option<String>) -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let install_dir = home.join(".mypartnerai").join("ama-bridge");
    let shared_dir = install_dir.join("shared");
    let mcp_json_path = home.join(".claude.json");

    // 1. 소스 디렉토리 결정
    let base_dir = project_dir
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());

    let plugin_dir = base_dir.join("claude-plugin").join("ama-bridge");

    // 개발 환경: claude-plugin/ama-bridge/ 소스가 있으면 파일 복사
    if plugin_dir.join("package.json").exists() {
        let canonical = plugin_dir.canonicalize().unwrap_or_else(|_| plugin_dir.clone());
        if !canonical.ends_with("ama-bridge") {
            return Err("Invalid source directory".to_string());
        }

        std::fs::create_dir_all(&shared_dir)
            .map_err(|e| format!("Failed to create {}: {}", shared_dir.display(), e))?;

        let files: &[&str] = &[
            "package.json",
            "tsconfig.json",
            "server.ts",
            "shared/config.mts",
        ];

        for file in files {
            let src = plugin_dir.join(file);
            let dst = install_dir.join(file);
            if src.exists() {
                std::fs::copy(&src, &dst).map_err(|e| {
                    format!("Failed to copy {}: {}", file, e)
                })?;
            }
        }

        // node_modules 복사 (없으면)
        let src_nm = plugin_dir.join("node_modules");
        let dst_nm = install_dir.join("node_modules");
        if src_nm.exists() && !dst_nm.exists() {
            copy_dir_recursive(&src_nm, &dst_nm)
                .map_err(|e| format!("Failed to copy node_modules: {}", e))?;
        }
    } else {
        // 배포 환경: ~/.mypartnerai/ama-bridge/에 이미 파일이 있는지 확인
        if !install_dir.join("package.json").exists() {
            return Err(
                "Bridge plugin not found. Please enable Channels toggle to auto-setup first."
                    .to_string(),
            );
        }
        eprintln!(
            "[MCP] Using existing bridge at {}",
            install_dir.display()
        );
    }

    // 3. ~/.claude.json 에 등록
    let mut settings: serde_json::Value = if mcp_json_path.exists() {
        let content = std::fs::read_to_string(&mcp_json_path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    let bridge_path = install_dir.join("server.ts").to_string_lossy().to_string();
    let install_dir_str = install_dir.to_string_lossy().to_string();

    if settings.get("mcpServers").is_none() {
        settings["mcpServers"] = serde_json::json!({});
    }

    // npx 전체 경로를 사용 (macOS 앱 번들에서 PATH가 제한될 수 있음)
    let npx_cmd = find_node_bin("npx").unwrap_or_else(|_| "npx".to_string());

    settings["mcpServers"]["ama-bridge"] = serde_json::json!({
        "type": "stdio",
        "command": npx_cmd,
        "args": ["--prefix", install_dir_str, "tsx", bridge_path],
        "env": {
            "BRIDGE_PORT": "8790"
        }
    });

    let output = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("JSON serialize error: {}", e))?;
    std::fs::write(&mcp_json_path, format!("{}\n", output))
        .map_err(|e| format!("Failed to write settings: {}", e))?;

    Ok(format!("Registered ama-bridge at {}", mcp_json_path.display()))
}

/// ~/.claude.json에서 ama-bridge를 제거한다.
#[tauri::command]
pub fn unregister_channel_global() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let mcp_json_path = home.join(".claude.json");

    if !mcp_json_path.exists() {
        return Ok("No Claude Code settings file found".to_string());
    }

    let content = std::fs::read_to_string(&mcp_json_path)
        .map_err(|e| format!("Failed to read settings: {}", e))?;
    let mut settings: serde_json::Value =
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}));

    if let Some(servers) = settings.get_mut("mcpServers").and_then(|s| s.as_object_mut()) {
        servers.remove("ama-bridge");
    }

    let output = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("JSON serialize error: {}", e))?;
    std::fs::write(&mcp_json_path, format!("{}\n", output))
        .map_err(|e| format!("Failed to write settings: {}", e))?;

    Ok("Unregistered ama-bridge".to_string())
}

/// ~/.claude.json, ~/.mcp.json, CWD/.mcp.json에서 등록 상태를 확인한다.
#[tauri::command]
pub fn check_channel_registered() -> bool {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return false,
    };

    let mut paths = vec![home.join(".claude.json"), home.join(".mcp.json")];

    // 프로젝트 스코프 .mcp.json
    if let Ok(cwd) = std::env::current_dir() {
        paths.push(cwd.join(".mcp.json"));
    }

    for path in paths {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                if v.get("mcpServers").and_then(|s| s.get("ama-bridge")).is_some() {
                    return true;
                }
            }
        }
    }
    false
}

/// dev-bridge에 메시지 전송 (localhost만 허용, 24시간 타임아웃)
#[tauri::command]
pub async fn send_to_bridge(endpoint: String, body: String) -> Result<String, String> {
    // SSRF 방지: localhost만 허용
    let parsed = reqwest::Url::parse(&endpoint)
        .map_err(|e| format!("Invalid endpoint URL: {}", e))?;
    match parsed.host_str() {
        Some("127.0.0.1") | Some("localhost") => {}
        _ => return Err("Only localhost endpoints are allowed".to_string()),
    }
    if parsed.scheme() != "http" {
        return Err("Only http scheme is allowed for bridge".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(86400)) // 24시간
        .build()
        .map_err(|e| format!("Client build failed: {}", e))?;
    let res = client
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("Bridge request failed: {}", e))?;

    if !res.status().is_success() {
        let status = res.status().as_u16();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("Bridge error {}: {}", status, text));
    }

    res.text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))
}

/// dev-bridge health check (Rust 사이드에서 localhost fetch — WebView CORS 우회)
#[tauri::command]
pub async fn check_bridge_health() -> Result<bool, String> {
    let port_str = std::env::var("BRIDGE_PORT").unwrap_or_else(|_| "8790".to_string());
    let url = format!("http://127.0.0.1:{}/health", port_str);

    match reqwest::Client::new()
        .get(&url)
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .await
    {
        Ok(res) => Ok(res.status().is_success()),
        Err(_) => Ok(false),
    }
}

/// dev-bridge 채널 연결 확인 (/health 의 mcpConnected 필드로 즉시 판별)
#[tauri::command]
pub async fn check_bridge_channel() -> Result<bool, String> {
    let port_str = std::env::var("BRIDGE_PORT").unwrap_or_else(|_| "8790".to_string());
    let url = format!("http://127.0.0.1:{}/health", port_str);

    match reqwest::Client::new()
        .get(&url)
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .await
    {
        Ok(res) => {
            if !res.status().is_success() {
                return Ok(false);
            }
            let text = res.text().await.unwrap_or_default();
            // { "status": "ok", "pending": 0, "mcpConnected": true/false }
            Ok(text.contains("\"mcpConnected\":true") || text.contains("\"mcpConnected\": true"))
        }
        Err(_) => Ok(false),
    }
}

