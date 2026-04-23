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
    /// 에이전트가 소유하는 실시간 터미널 인스턴스 맵. terminalId → Instance.
    terminals: Mutex<HashMap<String, Arc<TerminalInstance>>>,
    /// terminalId 발급 카운터.
    next_terminal_id: AtomicU64,
    /// `session/new` 응답의 `models` 스냅샷 — 설정 UI가 모델 목록·현재값을 표시할 때 사용.
    available_models: Mutex<Option<Value>>,
    turn_ready: Arc<tokio::sync::Notify>,
    turn_active: Arc<std::sync::atomic::AtomicBool>,
}

/// ACP terminal 인스턴스 — `terminal/create` 결과. 도우미 task가 stdout+stderr를
/// `output`에 누적하고, 자식 프로세스는 `child` lock으로 공유한다.
///
/// try_wait 폴링 기반으로 kill/wait 간 경합을 피한다 (Child::wait 과 Child::kill 이
/// 모두 &mut self 를 요구하기 때문).
struct TerminalInstance {
    child: Arc<Mutex<Option<tokio::process::Child>>>,
    output: Arc<Mutex<Vec<u8>>>,
    truncated: Arc<std::sync::atomic::AtomicBool>,
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

/// terminal 요청 허용 여부 — approvalMode에 따른 사전 정책.
///
/// 임의 명령 실행은 파일 쓰기보다 위험하므로 `yolo`일 때만 허용한다. 나머지 모드는
/// -32603을 반환해 에이전트가 도구를 재시도하거나 다른 경로로 우회하게 한다.
fn terminal_allowed(approval_mode: &str) -> bool {
    approval_mode == "yolo"
}

/// `ExitStatus`를 ACP TerminalExitStatus JSON으로 변환.
fn exit_status_to_value(status: &std::process::ExitStatus) -> Value {
    let exit_code = status.code().map(|c| c as i64);
    let signal: Option<String>;
    #[cfg(unix)]
    {
        use std::os::unix::process::ExitStatusExt;
        signal = status.signal().map(|n| format!("SIG{n}"));
    }
    #[cfg(not(unix))]
    {
        signal = None;
    }
    let mut obj = serde_json::Map::new();
    if let Some(c) = exit_code {
        obj.insert("exitCode".to_string(), json!(c));
    }
    if let Some(s) = signal {
        obj.insert("signal".to_string(), json!(s));
    }
    Value::Object(obj)
}

async fn handle_terminal_create(
    process: &Arc<GeminiCliProcess>,
    params: &Value,
) -> Result<Value, String> {
    let approval = process.approval_mode.lock().unwrap().clone();
    if !terminal_allowed(&approval) {
        return Err(format!(
            "terminal not allowed under approvalMode={approval} (set to `yolo`)"
        ));
    }

    let command_str = params
        .get("command")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "command required".to_string())?;
    let args: Vec<String> = params
        .get("args")
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|x| x.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();
    let cwd_opt = params
        .get("cwd")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let env_vars: Vec<(String, String)> = params
        .get("env")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| {
                    let name = item.get("name").and_then(|v| v.as_str())?;
                    let value = item.get("value").and_then(|v| v.as_str())?;
                    Some((name.to_string(), value.to_string()))
                })
                .collect()
        })
        .unwrap_or_default();
    let output_byte_limit = params
        .get("outputByteLimit")
        .and_then(|v| v.as_u64())
        .map(|n| n as usize);

    // cwd가 지정되면 workingDir 내부인지 검증, 아니면 workingDir 기본.
    let working_dir = process.working_dir.lock().unwrap().clone();
    let effective_cwd = match cwd_opt.as_deref() {
        Some(p) if !p.is_empty() => Some(validate_path_in_workdir(&working_dir, p)?),
        _ => working_dir,
    };

    let mut cmd = Command::new(command_str);
    cmd.args(&args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .stdin(std::process::Stdio::null())
        .kill_on_drop(true);
    for (k, v) in env_vars {
        cmd.env(k, v);
    }
    if let Some(ref dir) = effective_cwd {
        cmd.current_dir(dir);
    }

    let mut child = cmd.spawn().map_err(|e| format!("spawn failed: {e}"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "no stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "no stderr".to_string())?;

    let output = Arc::new(Mutex::new(Vec::<u8>::new()));
    let truncated = Arc::new(std::sync::atomic::AtomicBool::new(false));

    // stdout/stderr 각각에 대해 output buffer에 순차 누적 (limit 도달 시 잘라냄).
    fn spawn_reader<R>(
        mut reader: R,
        output: Arc<Mutex<Vec<u8>>>,
        truncated: Arc<std::sync::atomic::AtomicBool>,
        limit: Option<usize>,
    ) where
        R: tokio::io::AsyncRead + Unpin + Send + 'static,
    {
        tokio::spawn(async move {
            use tokio::io::AsyncReadExt;
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf).await {
                    Ok(0) => break,
                    Ok(n) => {
                        let mut guard = output.lock().await;
                        if let Some(cap) = limit {
                            let remaining = cap.saturating_sub(guard.len());
                            if remaining == 0 {
                                truncated.store(true, Ordering::SeqCst);
                                break;
                            }
                            let take = remaining.min(n);
                            guard.extend_from_slice(&buf[..take]);
                            if take < n {
                                truncated.store(true, Ordering::SeqCst);
                                break;
                            }
                        } else {
                            guard.extend_from_slice(&buf[..n]);
                        }
                    }
                    Err(_) => break,
                }
            }
        });
    }
    spawn_reader(stdout, output.clone(), truncated.clone(), output_byte_limit);
    spawn_reader(stderr, output.clone(), truncated.clone(), output_byte_limit);

    let terminal_id = format!(
        "term-{}",
        process.next_terminal_id.fetch_add(1, Ordering::SeqCst) + 1
    );
    let instance = Arc::new(TerminalInstance {
        child: Arc::new(Mutex::new(Some(child))),
        output,
        truncated,
    });
    {
        let mut map = process.terminals.lock().await;
        map.insert(terminal_id.clone(), instance);
    }

    Ok(json!({ "terminalId": terminal_id }))
}

async fn get_terminal(
    process: &Arc<GeminiCliProcess>,
    params: &Value,
) -> Result<Arc<TerminalInstance>, String> {
    let id = params
        .get("terminalId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "terminalId required".to_string())?;
    let map = process.terminals.lock().await;
    map.get(id)
        .cloned()
        .ok_or_else(|| format!("Terminal not found: {id}"))
}

async fn handle_terminal_output(
    process: &Arc<GeminiCliProcess>,
    params: &Value,
) -> Result<Value, String> {
    let inst = get_terminal(process, params).await?;
    // try_wait 폴링 — child가 아직 살아 있으면 exitStatus 없음.
    let exit_status = {
        let mut child_guard = inst.child.lock().await;
        if let Some(child) = child_guard.as_mut() {
            match child.try_wait() {
                Ok(Some(s)) => Some(exit_status_to_value(&s)),
                _ => None,
            }
        } else {
            None
        }
    };
    let output_bytes = inst.output.lock().await.clone();
    let output_str = String::from_utf8_lossy(&output_bytes).to_string();
    let truncated = inst.truncated.load(Ordering::SeqCst);

    let mut result = serde_json::Map::new();
    result.insert("output".to_string(), json!(output_str));
    result.insert("truncated".to_string(), json!(truncated));
    result.insert(
        "exitStatus".to_string(),
        exit_status.unwrap_or(Value::Null),
    );
    Ok(Value::Object(result))
}

async fn handle_terminal_wait_for_exit(
    process: &Arc<GeminiCliProcess>,
    params: &Value,
) -> Result<Value, String> {
    let inst = get_terminal(process, params).await?;
    loop {
        {
            let mut child_guard = inst.child.lock().await;
            if let Some(child) = child_guard.as_mut() {
                if let Ok(Some(status)) = child.try_wait() {
                    return Ok(exit_status_to_value(&status));
                }
            } else {
                return Ok(json!({}));
            }
        }
        tokio::time::sleep(std::time::Duration::from_millis(80)).await;
    }
}

async fn handle_terminal_kill(
    process: &Arc<GeminiCliProcess>,
    params: &Value,
) -> Result<Value, String> {
    let inst = get_terminal(process, params).await?;
    let mut child_guard = inst.child.lock().await;
    if let Some(child) = child_guard.as_mut() {
        let _ = child.start_kill();
    }
    Ok(json!({}))
}

async fn handle_terminal_release(
    process: &Arc<GeminiCliProcess>,
    params: &Value,
) -> Result<Value, String> {
    let id = params
        .get("terminalId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "terminalId required".to_string())?;
    let mut map = process.terminals.lock().await;
    // 제거 → Arc drop → 내부 child kill_on_drop으로 정리.
    map.remove(id);
    Ok(json!({}))
}

/// approvalMode 기반 `session/request_permission` 자동 응답 — **사전 정책 방식**.
///
/// Codex와 동일한 UX 철학으로 AMA에는 실시간 승인 모달이 없다(Codex의 approvalPolicy와
/// 대응). 사용자는 설정에서 선택한 `approvalMode`로 대리 동의를 미리 표명한다.
///
/// - `yolo`: 모든 요청 자동 승인 (options[0] 선택)
/// - `auto_edit`: 모든 요청 자동 승인 (Gemini가 `session/set_mode`로 edit만 요청하도록
///   스스로 필터링 — 우리는 전달된 요청은 모두 승인)
/// - `default`: 거부(cancelled) — UI 승인 모달이 아직 없으므로 안전하게 차단. 사용자가
///   도구 실행을 원하면 `auto_edit`/`yolo`로 전환해야 한다.
/// - `plan`: 거부(cancelled) — read-only 모드.
fn auto_permission_outcome(mode: &str, params: &Value) -> Value {
    let auto_approve = mode == "yolo" || mode == "auto_edit";
    if !auto_approve {
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
                        "terminal/create" => match handle_terminal_create(&process, &params).await {
                            Ok(result) => jsonrpc_result_response(id_val, result),
                            Err(e) => jsonrpc_error_response(id_val, -32603, &e),
                        },
                        "terminal/output" => match handle_terminal_output(&process, &params).await {
                            Ok(result) => jsonrpc_result_response(id_val, result),
                            Err(e) => jsonrpc_error_response(id_val, -32603, &e),
                        },
                        "terminal/wait_for_exit" => {
                            match handle_terminal_wait_for_exit(&process, &params).await {
                                Ok(result) => jsonrpc_result_response(id_val, result),
                                Err(e) => jsonrpc_error_response(id_val, -32603, &e),
                            }
                        }
                        "terminal/kill" => match handle_terminal_kill(&process, &params).await {
                            Ok(result) => jsonrpc_result_response(id_val, result),
                            Err(e) => jsonrpc_error_response(id_val, -32603, &e),
                        },
                        "terminal/release" => match handle_terminal_release(&process, &params).await {
                            Ok(result) => jsonrpc_result_response(id_val, result),
                            Err(e) => jsonrpc_error_response(id_val, -32603, &e),
                        },
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
        terminals: Mutex::new(HashMap::new()),
        next_terminal_id: AtomicU64::new(0),
        available_models: Mutex::new(None),
        turn_ready,
        turn_active,
    });

    // reader가 참조할 수 있도록 등록.
    {
        let mut guard = process_for_reader.lock().await;
        *guard = Some(process.clone());
    }

    // initialize — fs + terminal 모두 활성화. 실제 허용 여부는 approvalMode로 런타임 gating.
    let init_params = json!({
        "protocolVersion": ACP_PROTOCOL_VERSION,
        "clientInfo": { "name": "AMA", "version": env!("CARGO_PKG_VERSION") },
        "clientCapabilities": {
            "fs": { "readTextFile": true, "writeTextFile": true },
            "terminal": true
        }
    });

    let init_result = send_request(&process, "initialize", Some(init_params)).await;
    let result = match init_result {
        Ok(_) => {
            // 연결 직후 session/new를 미리 호출 — 응답의 `models`·`modes`를 캐시해 설정 UI가
            // 모델/모드 목록을 즉시 노출하도록 한다. 세션 자체도 재사용해 첫 대화를 빠르게 연다.
            let cwd_for_session = spawn_dir
                .clone()
                .unwrap_or_else(|| "/tmp".to_string());
            if let Ok(new_res) = send_request(
                &process,
                "session/new",
                Some(json!({ "cwd": cwd_for_session, "mcpServers": [] })),
            )
            .await
            {
                if let Some(sid) = new_res.get("sessionId").and_then(|v| v.as_str()) {
                    *process.session_id.lock().await = Some(sid.to_string());
                    // 빈 프롬프트 적용 상태로 표시 — 첫 사용자 메시지가 non-empty이면
                    // send_message가 새 세션을 다시 만들고, 빈 프롬프트면 이 세션을 재사용.
                    *process.applied_prompt.lock().await = Some(String::new());
                }
                if let Some(models) = new_res.get("models") {
                    *process.available_models.lock().await = Some(models.clone());
                }
                // 초기 승인 모드 동기화 (default가 아닐 때만).
                let current_mode = process.approval_mode.lock().unwrap().clone();
                let target = approval_mode_to_acp_mode_id(&current_mode);
                if target != "default" {
                    let sid = process.session_id.lock().await.clone().unwrap_or_default();
                    if !sid.is_empty() {
                        let _ = send_request(
                            &process,
                            "session/set_mode",
                            Some(json!({ "sessionId": sid, "modeId": target })),
                        )
                        .await;
                    }
                }
            }
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

/// `session/new` 응답에서 캐시한 모델 목록(+currentModelId)을 반환.
/// 연결되지 않았거나 아직 session/new 응답이 없으면 null.
#[tauri::command]
pub async fn gemini_cli_list_models(
    state: tauri::State<'_, GeminiCliState>,
) -> Result<Value, String> {
    let process = {
        let guard = state.process.lock().await;
        guard.as_ref().map(Arc::clone)
    };
    if let Some(process) = process {
        let models = process.available_models.lock().await.clone();
        Ok(models.unwrap_or(Value::Null))
    } else {
        Ok(Value::Null)
    }
}

/// 활성 세션의 모델을 변경 (`unstable_setSessionModel`).
///
/// ACP 스펙의 unstable 메서드이므로 Gemini CLI 버전이 올라가며 바뀔 수 있다.
/// 실패 시에도 UI의 설정값(`settings.geminiCli.model`)은 사용자 의도를 반영한 채
/// 유지되며, 재연결 시점에 새 세션이 해당 모델로 시작되도록 한다.
#[tauri::command]
pub async fn gemini_cli_set_model(
    state: tauri::State<'_, GeminiCliState>,
    model_id: String,
) -> Result<(), String> {
    let process = {
        let guard = state.process.lock().await;
        guard.as_ref().map(Arc::clone)
    };
    let Some(process) = process else {
        return Ok(());
    };
    let sid = process.session_id.lock().await.clone();
    let Some(sid) = sid else {
        return Ok(());
    };
    // unstable prefix에 주의 — best-effort.
    let _ = send_request(
        &process,
        "unstable_setSessionModel",
        Some(json!({ "sessionId": sid, "modelId": model_id })),
    )
    .await;
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
