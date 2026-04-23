//! Gemini CLI(ACP) 프로세스 관리 + JSON-RPC 2.0 통신
//!
//! `gemini --experimental-acp`를 spawn하여 stdio로 JSON-RPC 2.0 메시지를 주고받는다.
//! Codex와 거의 동일한 패턴이지만 아래 주요 차이가 있다:
//!
//! - 메서드 이름: `session/new`, `session/prompt`, `session/cancel` (slash 표기)
//! - 스트리밍: `session/update` notification 안의 `agent_message_chunk`
//! - 턴 완료: `session/prompt` **응답**(`stopReason`)으로 알림 (Codex처럼 별도 notification 아님)
//! - Client 메서드 역콜백: `fs/*`, `session/request_permission`, `terminal/*` — 현재는 모두
//!   `-32601 Method not found`로 응답(에이전트가 호스트 파일·터미널에 접근하지 않도록 차단)
//!
//! 인증: `~/.gemini/` 디렉터리의 캐시된 크리덴셜 + 필요 시 `authenticate` RPC.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::env;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{oneshot, Mutex};

/// JSON-RPC 요청 타임아웃 (12시간) — Codex와 동일한 기준
const REQUEST_TIMEOUT_SECS: u64 = 43200;

/// ACP 프로토콜 버전 — `initialize` 시 number로 전달해야 한다. 생략 시 -32603.
const ACP_PROTOCOL_VERSION: u64 = 1;

// ─── State ───────────────────────────────────────────────

pub struct GeminiCliState {
    process: Arc<Mutex<Option<Arc<GeminiCliProcess>>>>,
    /// gemini_cli_start 중복 실행 방지
    starting: std::sync::atomic::AtomicBool,
}

impl GeminiCliState {
    pub fn new() -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
            starting: std::sync::atomic::AtomicBool::new(false),
        }
    }
}

struct GeminiCliProcess {
    /// stdout reader가 클라이언트 메서드에 응답할 때에도 공유해야 하므로 `Arc<Mutex>`.
    stdin: Arc<Mutex<tokio::process::ChildStdin>>,
    _child: std::sync::Mutex<Option<Child>>,
    next_id: AtomicU64,
    pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>>,
    /// 현재 활성 `session/new`로 받은 세션 ID.
    session_id: Mutex<Option<String>>,
    /// 현재 세션에 주입된 시스템 프롬프트(변경 감지 → 새 세션 생성).
    applied_prompt: Mutex<Option<String>>,
    /// 턴 직렬화 — `session/prompt` 응답 시 notify.
    turn_ready: Arc<tokio::sync::Notify>,
    turn_active: Arc<std::sync::atomic::AtomicBool>,
}

// ─── JSON-RPC types ──────────────────────────────────────

#[derive(Serialize)]
struct JsonRpcRequest {
    jsonrpc: &'static str,
    method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    params: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<u64>,
}

#[derive(Deserialize, Debug)]
struct JsonRpcMessage {
    #[allow(dead_code)]
    jsonrpc: Option<String>,
    method: Option<String>,
    params: Option<Value>,
    id: Option<Value>,
    result: Option<Value>,
    error: Option<Value>,
}

// ─── Tauri event payloads ────────────────────────────────

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GeminiCliTokenEvent {
    pub text: String,
    pub session_id: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GeminiCliCompleteEvent {
    pub text: String,
    pub session_id: Option<String>,
    /// `"completed" | "cancelled" | "exceeded_max_iterations" | "error"`
    pub stop_reason: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GeminiCliStatusEvent {
    pub status: String,
    pub message: Option<String>,
}

// ─── Tauri command return types ──────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiCliInstallStatus {
    pub installed: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiCliAuthStatus {
    pub authenticated: bool,
    pub auth_dir: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiCliConnectionStatus {
    pub connected: bool,
    pub installed: bool,
    pub authenticated: bool,
    pub session_id: Option<String>,
}

// ─── Helper: gemini 바이너리 탐색 ───────────────────────

fn find_gemini_binary() -> Option<PathBuf> {
    if let Ok(output) = std::process::Command::new("which").arg("gemini").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Some(PathBuf::from(path));
            }
        }
    }

    let known_paths = ["/opt/homebrew/bin/gemini", "/usr/local/bin/gemini"];
    for path in &known_paths {
        let p = PathBuf::from(path);
        if p.exists() {
            return Some(p);
        }
    }

    if let Ok(home) = env::var("HOME") {
        let direct_paths = [
            format!("{home}/.volta/bin/gemini"),
            format!("{home}/.npm-global/bin/gemini"),
        ];
        for p in &direct_paths {
            let candidate = PathBuf::from(p);
            if candidate.exists() {
                return Some(candidate);
            }
        }

        let nvm_base = PathBuf::from(&home).join(".nvm/versions/node");
        if let Some(found) = scan_node_versions_for_gemini(&nvm_base) {
            return Some(found);
        }

        let fnm_base = PathBuf::from(&home).join(".local/share/fnm/node-versions");
        if let Some(found) = scan_node_versions_for_gemini(&fnm_base) {
            return Some(found);
        }
    }

    None
}

fn scan_node_versions_for_gemini(base: &PathBuf) -> Option<PathBuf> {
    if !base.exists() {
        return None;
    }
    let mut versions: Vec<_> = std::fs::read_dir(base)
        .ok()?
        .filter_map(|e| e.ok())
        .collect();
    versions.sort_by(|a, b| b.file_name().cmp(&a.file_name()));
    for entry in versions {
        let candidate = entry.path().join("bin/gemini");
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

fn get_gemini_home() -> Option<PathBuf> {
    if let Ok(home) = env::var("GEMINI_HOME") {
        return Some(PathBuf::from(home));
    }
    dirs::home_dir().map(|h| h.join(".gemini"))
}

// ─── 메시지 발송 helper ──────────────────────────────────

fn jsonrpc_error_response(id: &Value, code: i64, message: &str) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": { "code": code, "message": message }
    })
}

async fn write_raw_to_stdin(
    stdin: &Mutex<tokio::process::ChildStdin>,
    msg: &Value,
) -> Result<(), String> {
    let mut line = serde_json::to_string(msg).map_err(|e| format!("JSON serialize error: {e}"))?;
    line.push('\n');
    let mut guard = stdin.lock().await;
    guard
        .write_all(line.as_bytes())
        .await
        .map_err(|e| format!("Failed to write to gemini stdin: {e}"))?;
    guard
        .flush()
        .await
        .map_err(|e| format!("Failed to flush gemini stdin: {e}"))?;
    Ok(())
}

// ─── Core: 프로세스 spawn + stdout reader ────────────────

async fn spawn_gemini_process(
    app_handle: AppHandle,
    pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>>,
    process_state: Arc<Mutex<Option<Arc<GeminiCliProcess>>>>,
    turn_ready: Arc<tokio::sync::Notify>,
    turn_active: Arc<std::sync::atomic::AtomicBool>,
    stdin_for_client_calls: Arc<Mutex<Option<Arc<Mutex<tokio::process::ChildStdin>>>>>,
    working_dir: Option<String>,
) -> Result<(tokio::process::ChildStdin, Child), String> {
    let bin = find_gemini_binary().ok_or_else(|| {
        "Gemini CLI not found. Install with: npm install -g @google/gemini-cli".to_string()
    })?;

    let mut cmd = Command::new(&bin);
    cmd.arg("--experimental-acp")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);

    let effective_dir = match working_dir {
        Some(ref dir) if !dir.is_empty() => Some(PathBuf::from(dir)),
        _ => dirs::home_dir().map(|h| h.join("Documents")),
    };
    if let Some(ref dir) = effective_dir {
        if dir.is_dir() {
            cmd.current_dir(dir);
        }
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn gemini --experimental-acp: {e}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture gemini stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture gemini stderr".to_string())?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Failed to capture gemini stdin".to_string())?;

    // stdout reader 태스크
    let app_clone = app_handle.clone();
    let pending_clone = pending.clone();
    let process_state = process_state.clone();
    let turn_ready = turn_ready.clone();
    let turn_active = turn_active.clone();
    let stdin_for_client_calls = stdin_for_client_calls.clone();
    tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();

        // per-turn 누적 — session/prompt 응답 시점에 최종 텍스트로 emit
        let mut accumulated_text = String::new();
        let mut current_session_id: Option<String> = None;

        while let Ok(Some(line)) = lines.next_line().await {
            if line.trim().is_empty() {
                continue;
            }

            let msg: JsonRpcMessage = match serde_json::from_str(&line) {
                Ok(m) => m,
                Err(_) => continue,
            };

            // 1) 응답 (id 있음 + method 없음) — pending 요청 매칭
            if let (Some(id_val), None) = (&msg.id, &msg.method) {
                let id = match id_val {
                    Value::Number(n) => n.as_u64(),
                    _ => None,
                };
                if let Some(id) = id {
                    let mut map = pending_clone.lock().await;
                    if let Some(sender) = map.remove(&id) {
                        if let Some(err) = msg.error {
                            let err_msg = err
                                .get("message")
                                .and_then(|v| v.as_str())
                                .unwrap_or("JSON-RPC error");
                            let _ = sender.send(Err(err_msg.to_string()));
                        } else {
                            let _ = sender.send(Ok(msg.result.unwrap_or(Value::Null)));
                        }
                    }
                }
                continue;
            }

            // 2) 클라이언트 메서드 호출 (id 있음 + method 있음)
            //    AMA는 파일/터미널 접근을 허용하지 않으므로 모두 -32601로 거부.
            if let (Some(id_val), Some(method)) = (&msg.id, &msg.method) {
                let err =
                    jsonrpc_error_response(id_val, -32601, &format!("Method not supported: {method}"));
                let stdin_ref = {
                    let guard = stdin_for_client_calls.lock().await;
                    guard.clone()
                };
                if let Some(stdin_arc) = stdin_ref {
                    let _ = write_raw_to_stdin(&stdin_arc, &err).await;
                }
                continue;
            }

            // 3) 알림 (id 없음 + method 있음)
            if let Some(method) = &msg.method {
                let params = msg.params.as_ref();

                match method.as_str() {
                    "session/update" => {
                        if let Some(p) = params {
                            if let Some(sid) = p.get("sessionId").and_then(|v| v.as_str()) {
                                current_session_id = Some(sid.to_string());
                            }
                            if let Some(update) = p.get("update") {
                                // agent_message_chunk — 핵심 스트리밍
                                if let Some(chunk) = update.get("agent_message_chunk") {
                                    let text = extract_content_block_text(chunk);
                                    if !text.is_empty() {
                                        accumulated_text.push_str(&text);
                                        let _ = app_clone.emit(
                                            "gemini-cli-token",
                                            GeminiCliTokenEvent {
                                                text,
                                                session_id: current_session_id.clone(),
                                            },
                                        );
                                    }
                                }
                                // 기타 update 종류(tool_call_update, plan_update, ...)는
                                // 향후 확장 지점. 일단 무시.
                            }
                        }
                    }

                    _ => {}
                }
            }
        }

        // stdout 종료 시 pending 요청 에러 전달 + state 정리
        {
            let mut map = pending_clone.lock().await;
            for (_, sender) in map.drain() {
                let _ = sender.send(Err("Gemini CLI process exited".to_string()));
            }
        }
        {
            let mut guard = process_state.lock().await;
            *guard = None;
        }
        turn_active.store(false, Ordering::SeqCst);
        turn_ready.notify_waiters();

        let _ = app_clone.emit(
            "gemini-cli-status",
            GeminiCliStatusEvent {
                status: "disconnected".to_string(),
                message: Some("Gemini CLI(ACP) process exited".to_string()),
            },
        );

        // 혹시 응답 이벤트 이후에도 남은 text를 표시
        if !accumulated_text.is_empty() {
            let _ = app_clone.emit(
                "gemini-cli-complete",
                GeminiCliCompleteEvent {
                    text: accumulated_text.clone(),
                    session_id: current_session_id,
                    stop_reason: "error".to_string(),
                },
            );
        }
    });

    // stderr reader (디버그용)
    let app_clone2 = app_handle.clone();
    tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            eprintln!("[gemini-cli-stderr] {line}");
            let _ = app_clone2.emit("gemini-cli-stderr", line);
        }
    });

    Ok((stdin, child))
}

/// ACP `ContentBlock`에서 사용자에게 보여줄 텍스트를 추출.
/// 현재는 `{ "type": "text", "text": "..." }` 패턴만 지원.
fn extract_content_block_text(block: &Value) -> String {
    if let Some(text) = block.get("text").and_then(|v| v.as_str()) {
        return text.to_string();
    }
    // `content: [{ type: "text", text: "..." }]` 래핑 케이스도 방어적으로 처리
    if let Some(arr) = block.get("content").and_then(|v| v.as_array()) {
        let mut out = String::new();
        for item in arr {
            if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                out.push_str(text);
            }
        }
        return out;
    }
    String::new()
}

// ─── Core: JSON-RPC 요청 송신 ───────────────────────────

async fn send_request(
    process: &Arc<GeminiCliProcess>,
    method: &str,
    params: Option<Value>,
) -> Result<Value, String> {
    let id = process.next_id.fetch_add(1, Ordering::SeqCst) + 1;

    let msg = JsonRpcRequest {
        jsonrpc: "2.0",
        method: method.to_string(),
        params,
        id: Some(id),
    };

    let (tx, rx) = oneshot::channel();
    {
        let mut map = process.pending.lock().await;
        map.insert(id, tx);
    }

    let mut json_str =
        serde_json::to_string(&msg).map_err(|e| format!("JSON serialize error: {e}"))?;
    json_str.push('\n');

    let write_result = {
        let mut stdin = process.stdin.lock().await;
        let r1 = stdin.write_all(json_str.as_bytes()).await;
        let r2 = if r1.is_ok() { stdin.flush().await } else { r1 };
        r2
    };

    if let Err(e) = write_result {
        let mut map = process.pending.lock().await;
        map.remove(&id);
        return Err(format!("Failed to write to gemini stdin: {e}"));
    }

    match tokio::time::timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS), rx).await {
        Ok(Ok(result)) => result,
        Ok(Err(_)) => Err("Response channel closed".to_string()),
        Err(_) => {
            let mut map = process.pending.lock().await;
            map.remove(&id);
            Err("Request timed out".to_string())
        }
    }
}

async fn send_notification(
    process: &Arc<GeminiCliProcess>,
    method: &str,
    params: Option<Value>,
) -> Result<(), String> {
    let msg = JsonRpcRequest {
        jsonrpc: "2.0",
        method: method.to_string(),
        params,
        id: None,
    };

    let mut json_str =
        serde_json::to_string(&msg).map_err(|e| format!("JSON serialize error: {e}"))?;
    json_str.push('\n');

    let mut stdin = process.stdin.lock().await;
    stdin
        .write_all(json_str.as_bytes())
        .await
        .map_err(|e| format!("Failed to write to gemini stdin: {e}"))?;
    stdin
        .flush()
        .await
        .map_err(|e| format!("Failed to flush gemini stdin: {e}"))?;

    Ok(())
}

// ─── Tauri Commands ──────────────────────────────────────

#[tauri::command]
pub async fn gemini_cli_check_installed() -> Result<GeminiCliInstallStatus, String> {
    match find_gemini_binary() {
        Some(path) => {
            let version = tokio::process::Command::new(&path)
                .arg("--version")
                .output()
                .await
                .ok()
                .and_then(|o| {
                    if o.status.success() {
                        Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
                    } else {
                        None
                    }
                });

            Ok(GeminiCliInstallStatus {
                installed: true,
                path: Some(path.to_string_lossy().to_string()),
                version,
            })
        }
        None => Ok(GeminiCliInstallStatus {
            installed: false,
            path: None,
            version: None,
        }),
    }
}

#[tauri::command]
pub async fn gemini_cli_check_auth() -> Result<GeminiCliAuthStatus, String> {
    // Gemini CLI는 `~/.gemini/` 디렉터리 내 여러 크리덴셜 파일을 쓴다.
    // (oauth_creds.json, settings.json, ...). 존재만 검사.
    let home = match get_gemini_home() {
        Some(h) => h,
        None => {
            return Ok(GeminiCliAuthStatus {
                authenticated: false,
                auth_dir: None,
            })
        }
    };
    let exists = home.is_dir();
    Ok(GeminiCliAuthStatus {
        authenticated: exists,
        auth_dir: if exists {
            Some(home.to_string_lossy().to_string())
        } else {
            None
        },
    })
}

#[tauri::command]
pub async fn gemini_cli_start(
    app_handle: AppHandle,
    state: tauri::State<'_, GeminiCliState>,
    working_dir: Option<String>,
) -> Result<(), String> {
    {
        let guard = state.process.lock().await;
        if guard.is_some() {
            return Ok(());
        }
    }
    if state.starting.swap(true, Ordering::SeqCst) {
        return Ok(());
    }

    let _ = app_handle.emit(
        "gemini-cli-status",
        GeminiCliStatusEvent {
            status: "connecting".to_string(),
            message: Some("Starting gemini --experimental-acp...".to_string()),
        },
    );

    let pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>> =
        Arc::new(Mutex::new(HashMap::new()));
    let turn_ready = Arc::new(tokio::sync::Notify::new());
    let turn_active = Arc::new(std::sync::atomic::AtomicBool::new(false));
    // stdout reader가 client method 요청에 응답하기 위한 stdin 공유 핸들.
    let stdin_for_client_calls: Arc<Mutex<Option<Arc<Mutex<tokio::process::ChildStdin>>>>> =
        Arc::new(Mutex::new(None));

    let (stdin, child) = spawn_gemini_process(
        app_handle.clone(),
        pending.clone(),
        state.process.clone(),
        turn_ready.clone(),
        turn_active.clone(),
        stdin_for_client_calls.clone(),
        working_dir,
    )
    .await
    .map_err(|e| {
        state.starting.store(false, Ordering::SeqCst);
        e
    })?;

    let stdin_arc = Arc::new(Mutex::new(stdin));
    {
        let mut guard = stdin_for_client_calls.lock().await;
        *guard = Some(stdin_arc.clone());
    }

    let process = Arc::new(GeminiCliProcess {
        stdin: stdin_arc,
        _child: std::sync::Mutex::new(Some(child)),
        next_id: AtomicU64::new(0),
        pending,
        session_id: Mutex::new(None),
        applied_prompt: Mutex::new(None),
        turn_ready,
        turn_active,
    });

    // initialize
    let init_params = json!({
        "protocolVersion": ACP_PROTOCOL_VERSION,
        "clientInfo": { "name": "AMA", "version": env!("CARGO_PKG_VERSION") },
        "clientCapabilities": {
            // 파일시스템·터미널은 현재 미구현 → false로 선언해 agent가 시도하지 않도록 유도.
            "fs": { "readTextFile": false, "writeTextFile": false },
            "terminal": false
        }
    });

    let init_result = send_request(&process, "initialize", Some(init_params)).await;
    let result = match init_result {
        Ok(_) => {
            {
                let mut guard = state.process.lock().await;
                *guard = Some(process);
            }
            let _ = app_handle.emit(
                "gemini-cli-status",
                GeminiCliStatusEvent {
                    status: "connected".to_string(),
                    message: None,
                },
            );
            Ok(())
        }
        Err(e) => Err(format!("Gemini CLI initialization failed: {e}")),
    };

    state.starting.store(false, Ordering::SeqCst);
    result
}

#[tauri::command]
pub async fn gemini_cli_stop(
    app_handle: AppHandle,
    state: tauri::State<'_, GeminiCliState>,
) -> Result<(), String> {
    let mut guard = state.process.lock().await;
    if guard.is_some() {
        *guard = None; // drop → kill_on_drop
        let _ = app_handle.emit(
            "gemini-cli-status",
            GeminiCliStatusEvent {
                status: "disconnected".to_string(),
                message: Some("Gemini CLI stopped".to_string()),
            },
        );
    }
    Ok(())
}

#[tauri::command]
pub async fn gemini_cli_send_message(
    app_handle: AppHandle,
    state: tauri::State<'_, GeminiCliState>,
    text: String,
    system_prompt: Option<String>,
    working_dir: Option<String>,
) -> Result<String, String> {
    let process = {
        let guard = state.process.lock().await;
        guard
            .as_ref()
            .map(Arc::clone)
            .ok_or_else(|| "Gemini CLI not connected. Call gemini_cli_start first.".to_string())?
    };

    // 이전 턴 완료 대기
    while process.turn_active.load(Ordering::SeqCst) {
        process.turn_ready.notified().await;
    }
    process.turn_active.store(true, Ordering::SeqCst);

    let _ = app_handle.emit(
        "gemini-cli-status",
        GeminiCliStatusEvent {
            status: "generating".to_string(),
            message: None,
        },
    );

    let current_prompt = system_prompt.clone().unwrap_or_default();
    let prompt_changed = {
        let applied = process.applied_prompt.lock().await;
        applied.as_deref() != Some(&current_prompt)
    };

    let mut session_id = process.session_id.lock().await.clone();
    let is_first_turn = session_id.is_none() || prompt_changed;

    if is_first_turn {
        let cwd = working_dir
            .filter(|w| !w.is_empty())
            .or_else(|| {
                dirs::home_dir()
                    .and_then(|h| h.join("Documents").to_str().map(|s| s.to_string()))
            })
            .unwrap_or_else(|| "/tmp".to_string());

        let result = send_request(
            &process,
            "session/new",
            Some(json!({ "cwd": cwd, "mcpServers": [] })),
        )
        .await
        .map_err(|e| {
            process.turn_active.store(false, Ordering::SeqCst);
            process.turn_ready.notify_waiters();
            e
        })?;

        let sid = result
            .get("sessionId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| {
                process.turn_active.store(false, Ordering::SeqCst);
                process.turn_ready.notify_waiters();
                "Failed to get sessionId from session/new response".to_string()
            })?;

        session_id = Some(sid.clone());
        {
            let mut stored = process.session_id.lock().await;
            *stored = Some(sid);
        }
        let mut applied = process.applied_prompt.lock().await;
        *applied = Some(current_prompt.clone());
    }

    let final_text = if is_first_turn && !current_prompt.is_empty() {
        format!("<instructions>\n{current_prompt}\n</instructions>\n\n{text}")
    } else {
        text
    };

    let prompt_content = vec![json!({ "type": "text", "text": final_text })];
    let sid_ref = session_id.clone().unwrap_or_default();

    let prompt_res = send_request(
        &process,
        "session/prompt",
        Some(json!({
            "sessionId": sid_ref,
            "prompt": prompt_content
        })),
    )
    .await;

    // 응답 = stopReason. 처리 완료 → accumulated_text는 reader에서 이미 token 이벤트로 보냄.
    let (stop_reason, emit_text) = match prompt_res {
        Ok(v) => {
            let sr = v
                .get("stopReason")
                .and_then(|s| s.as_str())
                .unwrap_or("completed")
                .to_string();
            (sr, true)
        }
        Err(e) => (format!("error:{e}"), true),
    };

    if emit_text {
        // 최종 complete 이벤트 — 실제 누적 텍스트는 reader에서 알고 있으나
        // 프론트엔드가 자체 누적하므로 여기선 session_id + stopReason만 알려도 충분.
        let _ = app_handle.emit(
            "gemini-cli-complete",
            GeminiCliCompleteEvent {
                text: String::new(),
                session_id: session_id.clone(),
                stop_reason: stop_reason.clone(),
            },
        );
    }

    let status_label = match stop_reason.as_str() {
        "completed" => "idle",
        "cancelled" => "idle",
        "exceeded_max_iterations" => "error",
        s if s.starts_with("error") => "error",
        _ => "idle",
    };
    let _ = app_handle.emit(
        "gemini-cli-status",
        GeminiCliStatusEvent {
            status: status_label.to_string(),
            message: None,
        },
    );

    process.turn_active.store(false, Ordering::SeqCst);
    process.turn_ready.notify_waiters();

    Ok(session_id.unwrap_or_default())
}

#[tauri::command]
pub async fn gemini_cli_cancel(
    state: tauri::State<'_, GeminiCliState>,
) -> Result<(), String> {
    let process = {
        let guard = state.process.lock().await;
        guard.as_ref().map(Arc::clone)
    };
    if let Some(process) = process {
        let sid = process.session_id.lock().await.clone().unwrap_or_default();
        // session/cancel은 notification
        let _ = send_notification(
            &process,
            "session/cancel",
            Some(json!({ "sessionId": sid })),
        )
        .await;
    }
    Ok(())
}

#[tauri::command]
pub async fn gemini_cli_get_status(
    state: tauri::State<'_, GeminiCliState>,
) -> Result<GeminiCliConnectionStatus, String> {
    let process = {
        let guard = state.process.lock().await;
        guard.as_ref().map(Arc::clone)
    };

    let connected = process.is_some();
    let session_id = if let Some(ref p) = process {
        p.session_id.lock().await.clone()
    } else {
        None
    };

    Ok(GeminiCliConnectionStatus {
        connected,
        installed: connected,
        authenticated: connected,
        session_id,
    })
}

/// 앱 종료 시 Gemini CLI 프로세스 정리 (Codex와 동일 패턴)
pub fn cleanup_gemini_cli_on_exit(app_handle: &AppHandle) {
    if let Some(state) = app_handle.try_state::<GeminiCliState>() {
        if let Ok(guard) = state.process.try_lock() {
            if let Some(ref process) = *guard {
                if let Ok(mut child_guard) = process._child.lock() {
                    child_guard.take();
                }
            }
        }
    }
}
