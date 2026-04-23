//! Gemini CLI(ACP) 프로세스 관리 + JSON-RPC 2.0 통신 (파일·승인·Vision 포함).
//!
//! `gemini --experimental-acp`를 spawn하여 stdio로 JSON-RPC 2.0 메시지를 주고받는다.
//! Codex와 동일한 패턴이지만 아래 차이가 있다:
//!
//! - 메서드 이름: `session/new`, `session/prompt`, `session/cancel`, `session/set_mode`
//! - 스트리밍: `session/update` notification의 `sessionUpdate="agent_message_chunk"` + `content`
//! - 턴 완료: `session/prompt` **응답**(`stopReason`)으로 판정
//! - 클라이언트 메서드 역콜백:
//!   - `fs/read_text_file`, `fs/write_text_file`: workingDir 샌드박스 내에서만 허용
//!   - `session/request_permission`: `approvalMode`에 따라 자동 수락/거부
//!   - `terminal/*`: 아직 미지원(-32601 Method not supported)
//!
//! 인증: `~/.gemini/` 디렉터리의 캐시된 크리덴셜 + 필요 시 `authenticate` RPC.

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::env;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{oneshot, Mutex};

/// JSON-RPC 요청 타임아웃 (12시간) — Codex와 동일 기준
const REQUEST_TIMEOUT_SECS: u64 = 43200;

/// ACP 프로토콜 버전 — `initialize` 시 number로 전달해야 한다.
const ACP_PROTOCOL_VERSION: u64 = 1;

// ─── State ───────────────────────────────────────────────

pub struct GeminiCliState {
    process: Arc<Mutex<Option<Arc<GeminiCliProcess>>>>,
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
    stdin: Arc<Mutex<tokio::process::ChildStdin>>,
    _child: std::sync::Mutex<Option<Child>>,
    next_id: AtomicU64,
    pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>>,
    session_id: Mutex<Option<String>>,
    applied_prompt: Mutex<Option<String>>,
    /// fs 샌드박스 기준(절대 경로). `gemini_cli_start` 시점에 주입된 값을 유지.
    working_dir: std::sync::Mutex<Option<PathBuf>>,
    /// 사용자 선택 승인 모드 (`"default" | "auto_edit" | "yolo" | "plan"`).
    /// `session/request_permission` 자동 응답 기준이며 `gemini_cli_set_approval_mode` 로 갱신.
    approval_mode: std::sync::Mutex<String>,
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
    let mut versions: Vec<_> = std::fs::read_dir(base).ok()?.filter_map(|e| e.ok()).collect();
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

/// ACP `agent_message_chunk.content`에서 사용자 가시 텍스트를 추출.
/// 가능한 형태:
///   1) `{ "type": "text", "text": "..." }` — ContentBlock 직접
///   2) `{ "role": "assistant", "content": [{ "type": "text", ... }, ...] }` — 래핑
fn extract_content_block_text(block: &Value) -> String {
    if let Some(text) = block.get("text").and_then(|v| v.as_str()) {
        return text.to_string();
    }
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

/// 사용자가 선택한 approvalMode(스네이크/문자열)를 Gemini CLI가 노출하는 ACP mode ID로 변환.
///
/// 실측(gemini --experimental-acp): `default`, `autoEdit`, `yolo`, `plan` (camelCase)
fn approval_mode_to_acp_mode_id(mode: &str) -> &'static str {
    match mode {
        "auto_edit" => "autoEdit",
        "yolo" => "yolo",
        "plan" => "plan",
        _ => "default",
    }
}

/// workingDir 내부 경로인지 확인하고 canonical 경로로 반환.
/// 새 파일 쓰기 대비 — 파일 자체가 아직 없으면 부모 디렉터리 기준으로 canonicalize.
fn validate_path_in_workdir(
    working_dir: &Option<PathBuf>,
    path_str: &str,
) -> Result<PathBuf, String> {
    let target = Path::new(path_str);
    if !target.is_absolute() {
        return Err(format!("Path must be absolute: {path_str}"));
    }
    let wd = working_dir
        .as_ref()
        .ok_or_else(|| "workingDir not configured".to_string())?;
    let wd_canon = wd
        .canonicalize()
        .map_err(|e| format!("workingDir canonicalize failed: {e}"))?;

    let canonical = match target.canonicalize() {
        Ok(p) => p,
        Err(_) => {
            // 새 파일일 가능성 — 부모 canonicalize + 파일명 결합.
            let parent = target
                .parent()
                .ok_or_else(|| format!("No parent dir for {path_str}"))?;
            let parent_canon = parent
                .canonicalize()
                .map_err(|e| format!("parent canonicalize failed: {e}"))?;
            let name = target
                .file_name()
                .ok_or_else(|| format!("No file name in {path_str}"))?;
            parent_canon.join(name)
        }
    };

    if !canonical.starts_with(&wd_canon) {
        return Err(format!(
            "Access denied: {} is outside workingDir {}",
            canonical.display(),
            wd_canon.display()
        ));
    }
    Ok(canonical)
}

fn guess_image_mime(path: &Path) -> String {
    match path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => "image/png".to_string(),
        Some("jpg") | Some("jpeg") => "image/jpeg".to_string(),
        Some("webp") => "image/webp".to_string(),
        Some("gif") => "image/gif".to_string(),
        _ => "application/octet-stream".to_string(),
    }
}

// ─── stdin write helpers ─────────────────────────────────

fn jsonrpc_error_response(id: &Value, code: i64, message: &str) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } })
}

fn jsonrpc_result_response(id: &Value, result: Value) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "result": result })
}

async fn write_raw_to_stdin(
    stdin: &Arc<Mutex<tokio::process::ChildStdin>>,
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

// ─── Client method handlers (agent → client) ────────────

/// `fs/read_text_file` 처리 — workingDir 내부면 읽어서 content 반환.
async fn handle_fs_read(working_dir: &Option<PathBuf>, params: &Value) -> Result<Value, String> {
    let path_str = params
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "path required".to_string())?;
    let canonical = validate_path_in_workdir(working_dir, path_str)?;
    let content = tokio::fs::read_to_string(&canonical)
        .await
        .map_err(|e| format!("read failed: {e}"))?;
    let sliced = apply_read_range(&content, params);
    Ok(json!({ "content": sliced }))
}

/// ACP 스펙의 선택 인자 `line`(1-based start) + `limit`(max lines) 적용.
fn apply_read_range(content: &str, params: &Value) -> String {
    let line = params.get("line").and_then(|v| v.as_u64()).unwrap_or(1) as usize;
    let limit = params.get("limit").and_then(|v| v.as_u64());
    if line == 1 && limit.is_none() {
        return content.to_string();
    }
    let start = line.saturating_sub(1);
    let lines: Vec<&str> = content.lines().collect();
    let end = match limit {
        Some(l) => (start + l as usize).min(lines.len()),
        None => lines.len(),
    };
    if start >= lines.len() {
        return String::new();
    }
    lines[start..end].join("\n")
}

async fn handle_fs_write(working_dir: &Option<PathBuf>, params: &Value) -> Result<Value, String> {
    let path_str = params
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "path required".to_string())?;
    let content = params
        .get("content")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "content required".to_string())?;
    let canonical = validate_path_in_workdir(working_dir, path_str)?;
    // 상위 디렉터리가 없으면 생성(편의).
    if let Some(parent) = canonical.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("create parent failed: {e}"))?;
    }
    tokio::fs::write(&canonical, content)
        .await
        .map_err(|e| format!("write failed: {e}"))?;
    Ok(json!({}))
}

/// approvalMode 기반 `session/request_permission` 자동 응답.
/// - `plan`: 항상 거부(cancelled)
/// - `yolo`: 첫 옵션 자동 승인
/// - `auto_edit` / `default`: 첫 옵션 자동 승인 (MVP — UI 승인 플로우는 후속 과제)
fn auto_permission_outcome(mode: &str, params: &Value) -> Value {
    if mode == "plan" {
        return json!({ "outcome": { "outcome": "cancelled" } });
    }
    let opts = params
        .get("options")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    if let Some(first) = opts.first() {
        if let Some(opt_id) = first.get("optionId").and_then(|v| v.as_str()) {
            return json!({
                "outcome": { "outcome": "selected", "optionId": opt_id }
            });
        }
    }
    json!({ "outcome": { "outcome": "cancelled" } })
}

// ─── Core: 프로세스 spawn + stdout reader ────────────────

async fn spawn_gemini_process(
    app_handle: AppHandle,
    pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>>,
    process_state: Arc<Mutex<Option<Arc<GeminiCliProcess>>>>,
    process_for_reader: Arc<Mutex<Option<Arc<GeminiCliProcess>>>>,
    turn_ready: Arc<tokio::sync::Notify>,
    turn_active: Arc<std::sync::atomic::AtomicBool>,
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

    // stdout reader 태스크 — process_for_reader 는 나중에 set 됨.
    let app_clone = app_handle.clone();
    let pending_clone = pending.clone();
    let process_state = process_state.clone();
    let turn_ready = turn_ready.clone();
    let turn_active = turn_active.clone();
    tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        let mut current_session_id: Option<String> = None;

        while let Ok(Some(line)) = lines.next_line().await {
            if line.trim().is_empty() {
                continue;
            }

            let msg: JsonRpcMessage = match serde_json::from_str(&line) {
                Ok(m) => m,
                Err(_) => continue,
            };

            // 응답 (id 있음 + method 없음)
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

            // 에이전트가 클라이언트 메서드를 호출 (id 있음 + method 있음)
            if let (Some(id_val), Some(method)) = (&msg.id, &msg.method) {
                let params = msg.params.clone().unwrap_or(Value::Null);
                let process_opt = {
                    let guard = process_for_reader.lock().await;
                    guard.clone()
                };

                if let Some(process) = process_opt {
                    let stdin_ref = process.stdin.clone();
                    let working_dir = process.working_dir.lock().unwrap().clone();
                    let approval_mode = process.approval_mode.lock().unwrap().clone();

                    let response = match method.as_str() {
                        "fs/read_text_file" => match handle_fs_read(&working_dir, &params).await {
                            Ok(result) => jsonrpc_result_response(id_val, result),
                            Err(e) => jsonrpc_error_response(id_val, -32602, &e),
                        },
                        "fs/write_text_file" => match handle_fs_write(&working_dir, &params).await {
                            Ok(result) => jsonrpc_result_response(id_val, result),
                            Err(e) => jsonrpc_error_response(id_val, -32602, &e),
                        },
                        "session/request_permission" => jsonrpc_result_response(
                            id_val,
                            auto_permission_outcome(&approval_mode, &params),
                        ),
                        _ => jsonrpc_error_response(
                            id_val,
                            -32601,
                            &format!("Method not supported: {method}"),
                        ),
                    };
                    let _ = write_raw_to_stdin(&stdin_ref, &response).await;
                }
                continue;
            }

            // 알림 (id 없음 + method 있음)
            if let Some(method) = &msg.method {
                let params = msg.params.as_ref();

                match method.as_str() {
                    "session/update" => {
                        if let Some(p) = params {
                            if let Some(sid) = p.get("sessionId").and_then(|v| v.as_str()) {
                                current_session_id = Some(sid.to_string());
                            }
                            if let Some(update) = p.get("update") {
                                // discriminator: sessionUpdate 문자열
                                let kind = update
                                    .get("sessionUpdate")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("");
                                if kind == "agent_message_chunk" {
                                    if let Some(content) = update.get("content") {
                                        let text = extract_content_block_text(content);
                                        if !text.is_empty() {
                                            let _ = app_clone.emit(
                                                "gemini-cli-token",
                                                GeminiCliTokenEvent {
                                                    text,
                                                    session_id: current_session_id.clone(),
                                                },
                                            );
                                        }
                                    }
                                }
                                // 기타 update 종류(tool_call_update, plan_update, 등)는
                                // 후속 확장 지점. 일단 무시.
                            }
                        }
                    }
                    _ => {}
                }
            }
        }

        // stdout 종료 시 pending 요청 정리.
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
    approval_mode: Option<String>,
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

    // reader가 process를 참조할 수 있도록 양방향 handle 사용.
    let process_for_reader: Arc<Mutex<Option<Arc<GeminiCliProcess>>>> = Arc::new(Mutex::new(None));

    let spawn_dir = working_dir
        .clone()
        .filter(|w| !w.is_empty())
        .or_else(|| {
            dirs::home_dir().and_then(|h| h.join("Documents").to_str().map(|s| s.to_string()))
        });

    let (stdin, child) = spawn_gemini_process(
        app_handle.clone(),
        pending.clone(),
        state.process.clone(),
        process_for_reader.clone(),
        turn_ready.clone(),
        turn_active.clone(),
        spawn_dir.clone(),
    )
    .await
    .map_err(|e| {
        state.starting.store(false, Ordering::SeqCst);
        e
    })?;

    let stdin_arc = Arc::new(Mutex::new(stdin));

    let effective_wd = spawn_dir.clone().map(PathBuf::from);
    let mode_str = approval_mode.unwrap_or_else(|| "default".to_string());

    let process = Arc::new(GeminiCliProcess {
        stdin: stdin_arc,
        _child: std::sync::Mutex::new(Some(child)),
        next_id: AtomicU64::new(0),
        pending,
        session_id: Mutex::new(None),
        applied_prompt: Mutex::new(None),
        working_dir: std::sync::Mutex::new(effective_wd),
        approval_mode: std::sync::Mutex::new(mode_str),
        turn_ready,
        turn_active,
    });

    // reader가 참조할 수 있도록 등록.
    {
        let mut guard = process_for_reader.lock().await;
        *guard = Some(process.clone());
    }

    // initialize — fs 활성화, terminal은 아직 미지원.
    let init_params = json!({
        "protocolVersion": ACP_PROTOCOL_VERSION,
        "clientInfo": { "name": "AMA", "version": env!("CARGO_PKG_VERSION") },
        "clientCapabilities": {
            "fs": { "readTextFile": true, "writeTextFile": true },
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
        *guard = None;
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

/// 현재 연결된 세션의 승인 모드를 `session/set_mode`로 동기화하고 내부 상태도 갱신.
#[tauri::command]
pub async fn gemini_cli_set_approval_mode(
    state: tauri::State<'_, GeminiCliState>,
    approval_mode: String,
) -> Result<(), String> {
    let process = {
        let guard = state.process.lock().await;
        guard.as_ref().map(Arc::clone)
    };
    // 내부 상태는 항상 갱신(다음 request_permission 처리에 반영).
    if let Some(ref p) = process {
        *p.approval_mode.lock().unwrap() = approval_mode.clone();
    }
    // 연결되어 있고 세션이 있을 때에만 ACP 전달.
    if let Some(process) = process {
        let sid = process.session_id.lock().await.clone();
        if let Some(sid) = sid {
            let mode_id = approval_mode_to_acp_mode_id(&approval_mode);
            let _ = send_request(
                &process,
                "session/set_mode",
                Some(json!({ "sessionId": sid, "modeId": mode_id })),
            )
            .await;
        }
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
    approval_mode: Option<String>,
    image_path: Option<String>,
) -> Result<String, String> {
    let process = {
        let guard = state.process.lock().await;
        guard
            .as_ref()
            .map(Arc::clone)
            .ok_or_else(|| "Gemini CLI not connected. Call gemini_cli_start first.".to_string())?
    };

    // 승인 모드가 새 값으로 주어졌으면 내부 상태 갱신.
    if let Some(ref mode) = approval_mode {
        *process.approval_mode.lock().unwrap() = mode.clone();
    }

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
            .clone()
            .filter(|w| !w.is_empty())
            .or_else(|| {
                dirs::home_dir()
                    .and_then(|h| h.join("Documents").to_str().map(|s| s.to_string()))
            })
            .unwrap_or_else(|| "/tmp".to_string());

        // workingDir 상태를 동기화(샌드박스 기준).
        *process.working_dir.lock().unwrap() = Some(PathBuf::from(&cwd));

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
            *stored = Some(sid.clone());
        }
        {
            let mut applied = process.applied_prompt.lock().await;
            *applied = Some(current_prompt.clone());
        }

        // 사용자가 선택한 approval mode와 session 기본(default) 이 다르면 set_mode 시도.
        let current_mode = process.approval_mode.lock().unwrap().clone();
        let target_id = approval_mode_to_acp_mode_id(&current_mode);
        if target_id != "default" {
            // best-effort — 실패해도 진행.
            let _ = send_request(
                &process,
                "session/set_mode",
                Some(json!({ "sessionId": sid, "modeId": target_id })),
            )
            .await;
        }
    }

    let final_text = if is_first_turn && !current_prompt.is_empty() {
        format!("<instructions>\n{current_prompt}\n</instructions>\n\n{text}")
    } else {
        text
    };

    // Prompt content 블록 구성 — text + (선택) image
    let mut prompt_content: Vec<Value> = Vec::with_capacity(2);
    prompt_content.push(json!({ "type": "text", "text": final_text }));
    if let Some(ref path) = image_path {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            let abs = PathBuf::from(trimmed);
            if !abs.is_absolute() {
                process.turn_active.store(false, Ordering::SeqCst);
                process.turn_ready.notify_waiters();
                return Err(format!("image_path must be absolute: {trimmed}"));
            }
            let bytes = tokio::fs::read(&abs).await.map_err(|e| {
                process.turn_active.store(false, Ordering::SeqCst);
                process.turn_ready.notify_waiters();
                format!("Failed to read image: {e}")
            })?;
            let mime = guess_image_mime(&abs);
            let data = STANDARD.encode(&bytes);
            prompt_content.push(json!({ "type": "image", "mimeType": mime, "data": data }));
        }
    }

    let sid_ref = session_id.clone().unwrap_or_default();
    let prompt_res = send_request(
        &process,
        "session/prompt",
        Some(json!({ "sessionId": sid_ref, "prompt": prompt_content })),
    )
    .await;

    let stop_reason = match prompt_res {
        Ok(v) => v
            .get("stopReason")
            .and_then(|s| s.as_str())
            .unwrap_or("completed")
            .to_string(),
        Err(e) => format!("error:{e}"),
    };

    let _ = app_handle.emit(
        "gemini-cli-complete",
        GeminiCliCompleteEvent {
            text: String::new(),
            session_id: session_id.clone(),
            stop_reason: stop_reason.clone(),
        },
    );

    let status_label = match stop_reason.as_str() {
        "completed" | "cancelled" => "idle",
        s if s.starts_with("error") || s == "exceeded_max_iterations" => "error",
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
pub async fn gemini_cli_cancel(state: tauri::State<'_, GeminiCliState>) -> Result<(), String> {
    let process = {
        let guard = state.process.lock().await;
        guard.as_ref().map(Arc::clone)
    };
    if let Some(process) = process {
        let sid = process.session_id.lock().await.clone().unwrap_or_default();
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

/// 앱 종료 시 Gemini CLI 프로세스 정리.
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
