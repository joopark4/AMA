//! Codex app-server 프로세스 관리 + JSON-RPC 2.0 통신
//!
//! `codex app-server`를 spawn하여 stdio로 JSON-RPC 2.0 메시지를 주고받는다.
//! 스트리밍 응답은 Tauri 이벤트(`codex-token`, `codex-complete`)로 프론트엔드에 전달.
//!
//! 인증: ~/.codex/auth.json (codex login으로 생성)

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

/// JSON-RPC 요청 타임아웃 (12시간)
const REQUEST_TIMEOUT_SECS: u64 = 43200;

// ─── State ───────────────────────────────────────────────

pub struct CodexState {
    process: Arc<Mutex<Option<Arc<CodexProcess>>>>,
    /// codex_start 중복 실행 방지
    starting: std::sync::atomic::AtomicBool,
}

impl CodexState {
    pub fn new() -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
            starting: std::sync::atomic::AtomicBool::new(false),
        }
    }
}

struct CodexProcess {
    stdin: Mutex<tokio::process::ChildStdin>,
    _child: std::sync::Mutex<Option<Child>>,
    next_id: AtomicU64,
    pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>>,
    thread_id: Mutex<Option<String>>,
    /// 현재 스레드에 적용된 시스템 프롬프트 (변경 감지용)
    applied_prompt: Mutex<Option<String>>,
    /// 턴 직렬화 — turn/completed 시 notify
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
pub struct CodexTokenEvent {
    pub text: String,
    pub item_id: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CodexCompleteEvent {
    pub text: String,
    pub thread_id: Option<String>,
    pub turn_id: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CodexStatusEvent {
    pub status: String,
    pub message: Option<String>,
}

// ─── Tauri command return types ──────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexInstallStatus {
    pub installed: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexAuthStatus {
    pub authenticated: bool,
    pub auth_path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexConnectionStatus {
    pub connected: bool,
    pub installed: bool,
    pub authenticated: bool,
    pub thread_id: Option<String>,
}

// ─── Helper: Codex 바이너리 탐색 ────────────────────────

fn find_codex_binary() -> Option<PathBuf> {
    // 1) PATH에서 찾기 (macOS/Linux)
    if let Ok(output) = std::process::Command::new("which")
        .arg("codex")
        .output()
    {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Some(PathBuf::from(path));
            }
        }
    }

    // 2) 잘 알려진 경로들
    let known_paths = [
        "/opt/homebrew/bin/codex",
        "/usr/local/bin/codex",
    ];

    for path in &known_paths {
        let p = PathBuf::from(path);
        if p.exists() {
            return Some(p);
        }
    }

    // 3) volta, npm-global
    if let Ok(home) = env::var("HOME") {
        let direct_paths = [
            format!("{home}/.volta/bin/codex"),
            format!("{home}/.npm-global/bin/codex"),
        ];

        for p in &direct_paths {
            let candidate = PathBuf::from(p);
            if candidate.exists() {
                return Some(candidate);
            }
        }

        // 4) nvm: 최신 노드 버전에서 찾기
        let nvm_base = PathBuf::from(&home).join(".nvm/versions/node");
        if let Some(found) = scan_node_versions_for_codex(&nvm_base) {
            return Some(found);
        }

        // 5) fnm: 최신 노드 버전에서 찾기
        let fnm_base = PathBuf::from(&home).join(".local/share/fnm/node-versions");
        if let Some(found) = scan_node_versions_for_codex(&fnm_base) {
            return Some(found);
        }
    }

    None
}

/// nvm/fnm 버전 디렉토리를 역순 정렬하여 codex 바이너리 탐색
fn scan_node_versions_for_codex(base: &PathBuf) -> Option<PathBuf> {
    if !base.exists() {
        return None;
    }
    let mut versions: Vec<_> = std::fs::read_dir(base)
        .ok()?
        .filter_map(|e| e.ok())
        .collect();
    versions.sort_by(|a, b| b.file_name().cmp(&a.file_name()));
    for entry in versions {
        let candidate = entry.path().join("bin/codex");
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

fn get_codex_home() -> Option<PathBuf> {
    if let Ok(home) = env::var("CODEX_HOME") {
        return Some(PathBuf::from(home));
    }
    dirs::home_dir().map(|h| h.join(".codex"))
}

// ─── Core: 프로세스 spawn + stdout reader ────────────────

async fn spawn_codex_process(
    app_handle: AppHandle,
    pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>>,
    process_state: Arc<Mutex<Option<Arc<CodexProcess>>>>,
    turn_ready: Arc<tokio::sync::Notify>,
    turn_active: Arc<std::sync::atomic::AtomicBool>,
) -> Result<(tokio::process::ChildStdin, Child), String> {
    let codex_bin = find_codex_binary()
        .ok_or_else(|| "Codex CLI not found. Install with: npm install -g @openai/codex".to_string())?;

    let mut child = Command::new(&codex_bin)
        .arg("app-server")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to spawn codex app-server: {e}"))?;

    let stdout = child.stdout.take()
        .ok_or_else(|| "Failed to capture codex stdout".to_string())?;
    let stderr = child.stderr.take()
        .ok_or_else(|| "Failed to capture codex stderr".to_string())?;
    let stdin = child.stdin.take()
        .ok_or_else(|| "Failed to capture codex stdin".to_string())?;

    // stdout reader 태스크
    let app_clone = app_handle.clone();
    let pending_clone = pending.clone();
    let process_state = process_state.clone();
    let turn_ready = turn_ready.clone();
    let turn_active = turn_active.clone();
    tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();

        let mut accumulated_text = String::new();
        let mut current_thread_id: Option<String> = None;
        let mut current_turn_id: Option<String> = None;

        while let Ok(Some(line)) = lines.next_line().await {
            if line.trim().is_empty() {
                continue;
            }

            let msg: JsonRpcMessage = match serde_json::from_str(&line) {
                Ok(m) => m,
                Err(_) => continue,
            };

            // 응답 (id가 있고 method가 없는 경우) → pending 요청에 매칭
            if let Some(id_val) = &msg.id {
                if msg.method.is_none() {
                    let id = match id_val {
                        Value::Number(n) => n.as_u64(),
                        _ => None,
                    };
                    if let Some(id) = id {
                        let mut map = pending_clone.lock().await;
                        if let Some(sender) = map.remove(&id) {
                            if let Some(err) = msg.error {
                                let err_msg = err.get("message")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("JSON-RPC error");
                                let _ = sender.send(Err(err_msg.to_string()));
                            } else {
                                let result = msg.result.unwrap_or(Value::Null);
                                let _ = sender.send(Ok(result));
                            }
                        }
                    }
                    continue;
                }
            }

            // 알림 (method가 있는 경우)
            if let Some(method) = &msg.method {
                // 핵심 이벤트 로깅
                if method.starts_with("turn/") || method.starts_with("item/") {
                    eprintln!("[codex] RX notification: {method}");
                }
                let params = msg.params.as_ref();

                match method.as_str() {
                    "item/agentMessage/delta" | "item/delta" => {
                        if let Some(p) = params {
                            let delta = p.get("delta")
                                .and_then(|d| d.as_str())
                                .unwrap_or("");
                            if !delta.is_empty() {
                                accumulated_text.push_str(delta);
                                let _ = app_clone.emit("codex-token", CodexTokenEvent {
                                    text: delta.to_string(),
                                    item_id: p.get("itemId")
                                        .and_then(|v| v.as_str())
                                        .map(|s| s.to_string()),
                                });
                            }
                        }
                    }

                    "turn/started" => {
                        accumulated_text.clear();
                        if let Some(p) = params {
                            current_thread_id = p.get("threadId")
                                .and_then(|v| v.as_str())
                                .or_else(|| p.get("thread").and_then(|t| t.get("id")).and_then(|v| v.as_str()))
                                .map(|s| s.to_string());
                            current_turn_id = p.get("turnId")
                                .and_then(|v| v.as_str())
                                .or_else(|| p.get("turn").and_then(|t| t.get("id")).and_then(|v| v.as_str()))
                                .map(|s| s.to_string());
                        }
                        let _ = app_clone.emit("codex-status", CodexStatusEvent {
                            status: "generating".to_string(),
                            message: None,
                        });
                    }

                    "turn/completed" => {
                        let final_text = if let Some(p) = params {
                            if let Some(tid) = p.get("threadId").and_then(|v| v.as_str()) {
                                current_thread_id = Some(tid.to_string());
                            }
                            // turn/completed에서도 turnId 추출
                            let tid = p.get("turnId").and_then(|v| v.as_str())
                                .or_else(|| p.get("turn").and_then(|t| t.get("id")).and_then(|v| v.as_str()));
                            if let Some(tid) = tid {
                                current_turn_id = Some(tid.to_string());
                            }
                            p.get("outputText")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string())
                                .unwrap_or_else(|| accumulated_text.clone())
                        } else {
                            accumulated_text.clone()
                        };

                        let _ = app_clone.emit("codex-complete", CodexCompleteEvent {
                            text: final_text,
                            thread_id: current_thread_id.clone(),
                            turn_id: current_turn_id.clone(),
                        });
                        let _ = app_clone.emit("codex-status", CodexStatusEvent {
                            status: "idle".to_string(),
                            message: None,
                        });
                        accumulated_text.clear();
                        // 턴 완료 → 다음 턴 대기 해제
                        turn_active.store(false, Ordering::SeqCst);
                        turn_ready.notify_one();
                    }

                    "item/completed" => {
                        if let Some(p) = params {
                            if let Some(item_type) = p.get("type").and_then(|v| v.as_str()) {
                                if item_type == "agentMessage" {
                                    if let Some(text) = p.get("text").and_then(|v| v.as_str()) {
                                        if accumulated_text.is_empty() {
                                            accumulated_text = text.to_string();
                                        }
                                    }
                                }
                            }
                        }
                    }

                    "error" => {
                        let error_msg = params
                            .and_then(|p| p.get("message"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("Unknown codex error");
                        let _ = app_clone.emit("codex-status", CodexStatusEvent {
                            status: "error".to_string(),
                            message: Some(error_msg.to_string()),
                        });
                    }

                    _ => {}
                }
            }
        }

        // stdout 종료 시 모든 pending 요청에 에러 전달
        {
            let mut map = pending_clone.lock().await;
            for (_, sender) in map.drain() {
                let _ = sender.send(Err("Codex process exited".to_string()));
            }
        }

        // state에서 process 제거 (codex_get_status가 disconnected 반환하도록)
        {
            let mut guard = process_state.lock().await;
            *guard = None;
        }

        let _ = app_clone.emit("codex-status", CodexStatusEvent {
            status: "disconnected".to_string(),
            message: Some("Codex app-server process exited".to_string()),
        });
    });

    // stderr reader (디버그용)
    let app_clone2 = app_handle.clone();
    tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            eprintln!("[codex-stderr] {line}");
            let _ = app_clone2.emit("codex-stderr", line);
        }
    });

    Ok((stdin, child))
}

// ─── Core: JSON-RPC 메시지 전송 ─────────────────────────

async fn send_request(
    process: &Arc<CodexProcess>,
    method: &str,
    params: Option<Value>,
) -> Result<Value, String> {
    let id = process.next_id.fetch_add(1, Ordering::SeqCst) + 1;
    eprintln!("[codex] send_request id={id} method={method}");

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

    let mut json_str = serde_json::to_string(&msg)
        .map_err(|e| format!("JSON serialize error: {e}"))?;
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
        return Err(format!("Failed to write to codex stdin: {e}"));
    }

    // 응답 대기 (300초 타임아웃)
    match tokio::time::timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS), rx).await {
        Ok(Ok(result)) => {
            eprintln!("[codex] send_request id={id} method={method} → OK");
            result
        }
        Ok(Err(_)) => Err("Response channel closed".to_string()),
        Err(_) => {
            let mut map = process.pending.lock().await;
            map.remove(&id);
            Err("Request timed out (300s)".to_string())
        }
    }
}

async fn send_notification(
    process: &Arc<CodexProcess>,
    method: &str,
    params: Option<Value>,
) -> Result<(), String> {
    let msg = JsonRpcRequest {
        jsonrpc: "2.0",
        method: method.to_string(),
        params,
        id: None,
    };

    let mut json_str = serde_json::to_string(&msg)
        .map_err(|e| format!("JSON serialize error: {e}"))?;
    json_str.push('\n');

    let mut stdin = process.stdin.lock().await;
    stdin.write_all(json_str.as_bytes())
        .await
        .map_err(|e| format!("Failed to write to codex stdin: {e}"))?;
    stdin.flush()
        .await
        .map_err(|e| format!("Failed to flush codex stdin: {e}"))?;

    Ok(())
}

// ─── Tauri Commands ──────────────────────────────────────

#[tauri::command]
pub async fn codex_check_installed() -> Result<CodexInstallStatus, String> {
    match find_codex_binary() {
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

            Ok(CodexInstallStatus {
                installed: true,
                path: Some(path.to_string_lossy().to_string()),
                version,
            })
        }
        None => Ok(CodexInstallStatus {
            installed: false,
            path: None,
            version: None,
        }),
    }
}

#[tauri::command]
pub async fn codex_check_auth() -> Result<CodexAuthStatus, String> {
    let auth_path = get_codex_home()
        .map(|h| h.join("auth.json"))
        .unwrap_or_else(|| PathBuf::from(""));
    let exists = auth_path.exists();

    Ok(CodexAuthStatus {
        authenticated: exists,
        auth_path: if exists {
            Some(auth_path.to_string_lossy().to_string())
        } else {
            None
        },
    })
}

#[tauri::command]
pub async fn codex_start(
    app_handle: AppHandle,
    state: tauri::State<'_, CodexState>,
) -> Result<(), String> {
    eprintln!("[codex] codex_start called");
    {
        let guard = state.process.lock().await;
        if guard.is_some() {
            eprintln!("[codex] already running, skip");
            return Ok(());
        }
    }

    // 중복 시작 방지
    if state.starting.swap(true, Ordering::SeqCst) {
        eprintln!("[codex] already starting, skip");
        return Ok(());
    }

    eprintln!("[codex] spawning app-server...");
    let _ = app_handle.emit("codex-status", CodexStatusEvent {
        status: "connecting".to_string(),
        message: Some("Starting codex app-server...".to_string()),
    });

    let pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>> =
        Arc::new(Mutex::new(HashMap::new()));

    let turn_ready = Arc::new(tokio::sync::Notify::new());
    let turn_active = Arc::new(std::sync::atomic::AtomicBool::new(false));

    let (stdin, child) = spawn_codex_process(
        app_handle.clone(),
        pending.clone(),
        state.process.clone(),
        turn_ready.clone(),
        turn_active.clone(),
    ).await?;

    let process = Arc::new(CodexProcess {
        stdin: Mutex::new(stdin),
        _child: std::sync::Mutex::new(Some(child)),
        next_id: AtomicU64::new(0),
        pending,
        thread_id: Mutex::new(None),
        applied_prompt: Mutex::new(None),
        turn_ready,
        turn_active,
    });

    eprintln!("[codex] process spawned, sending initialize...");
    let init_result = send_request(&process, "initialize", Some(json!({
        "clientInfo": {
            "name": "AMA",
            "version": "0.8.0"
        }
    }))).await;

    let result = match init_result {
        Ok(_) => {
            eprintln!("[codex] initialize OK, sending initialized notification...");
            send_notification(&process, "initialized", None).await?;

            {
                let mut guard = state.process.lock().await;
                *guard = Some(process);
            }

            let _ = app_handle.emit("codex-status", CodexStatusEvent {
                status: "connected".to_string(),
                message: None,
            });
            eprintln!("[codex] connected!");

            Ok(())
        }
        Err(e) => {
            eprintln!("[codex] initialize FAILED: {e}");
            Err(format!("Codex initialization failed: {e}"))
        }
    };

    state.starting.store(false, Ordering::SeqCst);
    result
}

#[tauri::command]
pub async fn codex_stop(
    app_handle: AppHandle,
    state: tauri::State<'_, CodexState>,
) -> Result<(), String> {
    let mut guard = state.process.lock().await;

    if guard.is_some() {
        *guard = None; // drop → kill_on_drop
        let _ = app_handle.emit("codex-status", CodexStatusEvent {
            status: "disconnected".to_string(),
            message: Some("Codex stopped".to_string()),
        });
    }

    Ok(())
}

#[tauri::command]
pub async fn codex_send_message(
    app_handle: AppHandle,
    state: tauri::State<'_, CodexState>,
    text: String,
    system_prompt: Option<String>,
    model: Option<String>,
    reasoning_effort: Option<String>,
) -> Result<String, String> {
    eprintln!("[codex] codex_send_message called: {}", text.chars().take(50).collect::<String>());
    let process = {
        let guard = state.process.lock().await;
        guard.as_ref().map(Arc::clone)
            .ok_or_else(|| "Codex not connected. Call codex_start first.".to_string())?
    };

    // 이전 턴 완료 대기 (Codex는 한 스레드에서 동시 턴 불가)
    while process.turn_active.load(Ordering::SeqCst) {
        process.turn_ready.notified().await;
    }
    process.turn_active.store(true, Ordering::SeqCst);

    let _ = app_handle.emit("codex-status", CodexStatusEvent {
        status: "generating".to_string(),
        message: None,
    });

    // 시스템 프롬프트 변경 감지 → 변경 시 새 스레드 생성
    let current_prompt = system_prompt.clone().unwrap_or_default();
    let prompt_changed = {
        let applied = process.applied_prompt.lock().await;
        applied.as_deref() != Some(&current_prompt)
    };

    let mut thread_id = process.thread_id.lock().await.clone();

    // 프롬프트가 변경되었거나 스레드가 없으면 새 스레드 생성
    let is_first_turn = thread_id.is_none() || prompt_changed;
    if is_first_turn {
        // 기존 스레드 폐기 + 새 스레드 생성
        let result = send_request(&process, "thread/start", Some(json!({}))).await?;
        if let Some(tid) = result.get("thread")
            .and_then(|t| t.get("id"))
            .and_then(|v| v.as_str())
        {
            thread_id = Some(tid.to_string());
            let mut stored_tid = process.thread_id.lock().await;
            *stored_tid = Some(tid.to_string());
        } else {
            return Err("Failed to get threadId from thread/start response".to_string());
        }
        // 적용된 프롬프트 기록
        let mut applied = process.applied_prompt.lock().await;
        *applied = Some(current_prompt.clone());
    }

    // 첫 턴에서만 시스템 프롬프트를 메시지에 포함
    let final_text = if is_first_turn && !current_prompt.is_empty() {
        format!("<instructions>\n{current_prompt}\n</instructions>\n\n{text}")
    } else {
        text
    };

    let mut params = json!({
        "threadId": thread_id.unwrap(),
        "input": [{"type": "text", "text": final_text}],
        "approvalPolicy": "never"
    });
    if let Some(ref m) = model {
        if !m.is_empty() {
            params["model"] = json!(m);
        }
    }
    if let Some(ref e) = reasoning_effort {
        if !e.is_empty() {
            params["reasoningEffort"] = json!(e);
        }
    }

    let result = send_request(&process, "turn/start", Some(params)).await?;

    // turn ID를 프론트엔드에 반환 (응답 매칭용)
    let turn_id = result.get("turnId")
        .and_then(|v| v.as_str())
        .or_else(|| result.get("turn").and_then(|t| t.get("id")).and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string();

    Ok(turn_id)
}

#[tauri::command]
pub async fn codex_get_status(
    state: tauri::State<'_, CodexState>,
) -> Result<CodexConnectionStatus, String> {
    let process = {
        let guard = state.process.lock().await;
        guard.as_ref().map(Arc::clone)
    };

    let connected = process.is_some();
    let thread_id = if let Some(ref p) = process {
        p.thread_id.lock().await.clone()
    } else {
        None
    };

    // hot path에서는 프로세스 상태만 반환 (바이너리/인증 탐색 제외)
    Ok(CodexConnectionStatus {
        connected,
        installed: connected, // 연결되었다면 설치됨
        authenticated: connected, // 연결되었다면 인증됨
        thread_id,
    })
}

#[tauri::command]
pub async fn codex_list_models(
    state: tauri::State<'_, CodexState>,
) -> Result<Value, String> {
    let process = {
        let guard = state.process.lock().await;
        guard.as_ref().map(Arc::clone)
            .ok_or_else(|| "Codex not connected".to_string())?
    };

    send_request(&process, "model/list", Some(json!({}))).await
}

/// 앱 종료 시 codex 프로세스 정리
pub fn cleanup_codex_on_exit(app_handle: &AppHandle) {
    if let Some(state) = app_handle.try_state::<CodexState>() {
        // block_on 없이 동기적으로 처리하기 위해 try_lock 사용
        if let Ok(guard) = state.process.try_lock() {
            if let Some(ref process) = *guard {
                if let Ok(mut child_guard) = process._child.lock() {
                    // Child를 take하여 drop → kill_on_drop
                    child_guard.take();
                }
            }
        }
        // try_lock 실패 시에도 앱 종료 시 모든 리소스가 OS에 의해 정리됨
    }
}
