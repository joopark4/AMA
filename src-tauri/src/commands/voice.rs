use base64::{engine::general_purpose, Engine as _};
use serde::Serialize;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize)]
pub struct TranscriptionResult {
    pub text: String,
    pub confidence: f32,
    pub language: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteEnvironmentResult {
    pub is_remote: bool,
    pub detector: Option<String>,
    pub reason: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WhisperAvailabilityStatus {
    pub cli_found: bool,
    pub model_found: bool,
    pub cli_path: Option<String>,
    pub model_path: Option<String>,
}

fn non_empty_env(var_name: &str) -> Option<String> {
    env::var(var_name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn is_truthy_flag(value: &str) -> bool {
    matches!(
        value.trim().to_ascii_lowercase().as_str(),
        "1" | "true" | "yes" | "on"
    )
}

fn detect_remote_from_env() -> Option<RemoteEnvironmentResult> {
    if let Some(value) = non_empty_env("MYPARTNERAI_FORCE_REMOTE") {
        if is_truthy_flag(&value) {
            return Some(RemoteEnvironmentResult {
                is_remote: true,
                detector: Some("forced_override".to_string()),
                reason: Some(
                    "Environment variable MYPARTNERAI_FORCE_REMOTE is enabled.".to_string(),
                ),
            });
        }
    }

    let indicators = [
        ("SSH_CONNECTION", "ssh_connection"),
        ("SSH_CLIENT", "ssh_client"),
        ("SSH_TTY", "ssh_tty"),
        ("CHROME_REMOTE_DESKTOP_SESSION", "chrome_remote_desktop"),
        ("TEAMVIEWER_SESSIONID", "teamviewer"),
        ("ANYDESK_SESSION_ID", "anydesk"),
        ("RUSTDESK_SESSION_ID", "rustdesk"),
        ("REMOTEHOST", "remotehost"),
    ];

    for (var_name, detector) in indicators {
        if non_empty_env(var_name).is_some() {
            return Some(RemoteEnvironmentResult {
                is_remote: true,
                detector: Some(detector.to_string()),
                reason: Some(format!("Environment variable {var_name} is set.")),
            });
        }
    }

    None
}

fn remote_detector_for_command(command: &str) -> Option<&'static str> {
    let normalized = command.to_ascii_lowercase();

    if normalized.contains("screensharingd") {
        return Some("screensharingd");
    }
    if normalized.contains("remoting_host") {
        return Some("chrome_remote_desktop");
    }
    if normalized.contains("teamviewer") {
        return Some("teamviewer");
    }
    if normalized.contains("anydesk") {
        return Some("anydesk");
    }
    if normalized.contains("rustdesk") {
        return Some("rustdesk");
    }
    if normalized.contains("parsecd") || normalized.contains("parsec") {
        return Some("parsec");
    }
    if normalized.contains("vncserver") {
        return Some("vncserver");
    }
    if normalized.contains("x11vnc") {
        return Some("x11vnc");
    }
    if normalized.contains("xrdp") {
        return Some("xrdp");
    }

    None
}

fn is_loopback_endpoint(endpoint: &str) -> bool {
    endpoint.contains("127.0.0.1") || endpoint.contains("[::1]") || endpoint.contains("localhost")
}

fn detect_remote_from_active_network_sessions() -> Option<RemoteEnvironmentResult> {
    let output = Command::new("lsof")
        .args(["-nP", "-iTCP", "-sTCP:ESTABLISHED", "-F", "pcn"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let mut current_command = String::new();

    for line in String::from_utf8_lossy(&output.stdout).lines() {
        if let Some(command) = line.strip_prefix('c') {
            current_command = command.to_string();
            continue;
        }

        let Some(endpoint) = line.strip_prefix('n') else {
            continue;
        };

        let Some(detector) = remote_detector_for_command(&current_command) else {
            continue;
        };

        if is_loopback_endpoint(endpoint) {
            continue;
        }

        return Some(RemoteEnvironmentResult {
            is_remote: true,
            detector: Some(detector.to_string()),
            reason: Some(format!(
                "Detected active remote-tool network session: {current_command} ({endpoint})"
            )),
        });
    }

    None
}

#[tauri::command]
pub async fn detect_remote_environment() -> RemoteEnvironmentResult {
    if let Some(result) = detect_remote_from_env() {
        return result;
    }

    if let Some(result) = detect_remote_from_active_network_sessions() {
        return result;
    }

    RemoteEnvironmentResult {
        is_remote: false,
        detector: None,
        reason: None,
    }
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn decode_audio_base64(audio_base64: &str) -> Result<Vec<u8>, String> {
    let payload = audio_base64
        .split_once(',')
        .map(|(_, tail)| tail)
        .unwrap_or(audio_base64)
        .trim();

    if payload.is_empty() {
        return Err("Audio payload is empty.".to_string());
    }

    general_purpose::STANDARD
        .decode(payload)
        .map_err(|e| format!("Failed to decode base64 audio: {e}"))
}

fn is_wav_bytes(bytes: &[u8]) -> bool {
    bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WAVE"
}

fn find_in_path(binary_name: &str) -> Option<PathBuf> {
    let path_var = env::var_os("PATH")?;
    let candidates: Vec<PathBuf> = env::split_paths(&path_var)
        .map(|dir| dir.join(binary_name))
        .collect();

    #[cfg(target_os = "windows")]
    {
        candidates
            .extend(env::split_paths(&path_var).map(|dir| dir.join(format!("{binary_name}.exe"))));
    }

    candidates.into_iter().find(|path| path.exists())
}

fn resolve_executable(candidates: &[&str]) -> Option<PathBuf> {
    candidates.iter().find_map(|candidate| {
        let path = PathBuf::from(candidate);

        if (path.is_absolute() || candidate.contains(std::path::MAIN_SEPARATOR)) && path.exists() {
            return Some(path);
        }

        find_in_path(candidate)
    })
}

fn resolve_whisper_cli() -> Option<PathBuf> {
    if let Ok(explicit) = env::var("WHISPER_CLI_PATH") {
        let explicit_path = PathBuf::from(explicit);
        if explicit_path.exists() {
            return Some(explicit_path);
        }
    }

    if let Ok(exe_path) = env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let bundled_candidates = [
                exe_dir.join("../Resources/bin/whisper-cli"),
                exe_dir.join("../Resources/_up_/bin/whisper-cli"),
                exe_dir.join("whisper-cli"),
            ];

            for candidate in bundled_candidates {
                if candidate.exists() {
                    return Some(candidate);
                }
            }
        }
    }

    resolve_executable(&[
        "whisper-cli",
        "/opt/homebrew/bin/whisper-cli",
        "/usr/local/bin/whisper-cli",
        "whisper",
        "main",
    ])
}

fn model_file_names(model_hint: &str) -> Vec<String> {
    let normalized = if model_hint.trim().is_empty() || model_hint.trim() == "default" {
        "base".to_string()
    } else {
        model_hint.trim().to_string()
    };

    if normalized.is_empty() {
        return vec!["ggml-base.bin".to_string()];
    }

    if normalized.ends_with(".bin") {
        return vec![normalized];
    }

    vec![
        format!("ggml-{normalized}.bin"),
        format!("ggml-{normalized}.en.bin"),
        normalized,
    ]
}

fn model_search_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    let mut push_dir = |path: PathBuf| {
        if !dirs.iter().any(|existing| existing == &path) {
            dirs.push(path);
        }
    };

    if let Ok(path) = env::var("WHISPER_MODEL_DIR") {
        push_dir(PathBuf::from(path));
    }

    if let Ok(path) = env::var("MYPARTNERAI_MODEL_DIR") {
        push_dir(PathBuf::from(&path).join("whisper"));
        push_dir(PathBuf::from(path));
    }

    if let Ok(home) = env::var("HOME") {
        let home_dir = PathBuf::from(home);
        push_dir(home_dir.join("models/whisper"));
        push_dir(home_dir.join("models"));
        push_dir(home_dir.join(".mypartnerai/models/whisper"));
        push_dir(home_dir.join(".mypartnerai/models"));

        #[cfg(target_os = "macos")]
        {
            push_dir(home_dir.join("Library/Application Support/MyPartnerAI/models/whisper"));
            push_dir(home_dir.join("Library/Application Support/MyPartnerAI/models"));
        }
    }

    if let Ok(exe_path) = env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            push_dir(exe_dir.join("models/whisper"));
            push_dir(exe_dir.join("models"));
            push_dir(exe_dir.join("../Resources/models/whisper"));
            push_dir(exe_dir.join("../Resources/models"));
            push_dir(exe_dir.join("../Resources/_up_/models/whisper"));
            push_dir(exe_dir.join("../Resources/_up_/models"));
        }
    }

    if let Ok(cwd) = env::current_dir() {
        push_dir(cwd.join("models/whisper"));
        push_dir(cwd.join("models"));
        push_dir(cwd.join("src-tauri/models/whisper"));
        push_dir(cwd.join("src-tauri/models"));
        push_dir(cwd.join("public/models/whisper"));

        if let Some(parent) = cwd.parent() {
            push_dir(parent.join("models/whisper"));
            push_dir(parent.join("models"));
            push_dir(parent.join("public/models/whisper"));
        }
    }

    dirs
}

fn resolve_whisper_model(model_hint: &str) -> Option<PathBuf> {
    let trimmed = model_hint.trim();

    if let Ok(explicit) = env::var("WHISPER_MODEL_PATH") {
        let explicit_path = PathBuf::from(explicit);
        if explicit_path.exists() {
            return Some(explicit_path);
        }
    }

    if !trimmed.is_empty() {
        let hinted = PathBuf::from(trimmed);
        if hinted.exists() {
            return Some(hinted);
        }
    }

    let search_dirs = model_search_dirs();
    let file_names = model_file_names(trimmed);
    for dir in &search_dirs {
        for file_name in &file_names {
            let path = dir.join(file_name);
            if path.exists() {
                return Some(path);
            }
        }
    }

    None
}

fn run_whisper_cli(
    whisper_cli: &Path,
    model_path: &Path,
    wav_path: &Path,
    language: &str,
    output_prefix: &Path,
) -> Result<(), String> {
    let args = vec![
        "-m".to_string(),
        model_path
            .to_str()
            .ok_or_else(|| "Invalid Whisper model path.".to_string())?
            .to_string(),
        "-f".to_string(),
        wav_path
            .to_str()
            .ok_or_else(|| "Invalid WAV path.".to_string())?
            .to_string(),
        "-otxt".to_string(),
        "-of".to_string(),
        output_prefix
            .to_str()
            .ok_or_else(|| "Invalid transcription output prefix path.".to_string())?
            .to_string(),
        "-np".to_string(),
        "-nt".to_string(),
    ];

    let normalized_language = language.trim();
    let mut base_args = args;
    if !normalized_language.is_empty() {
        base_args.push("-l".to_string());
        base_args.push(normalized_language.to_string());
    }

    let execute_with_args = |args: &[String]| -> Result<std::process::Output, String> {
        let mut command = Command::new(whisper_cli);
        command.args(args);

        // Ensure bundled runtime dylibs are discoverable when whisper-cli is staged in app resources.
        if let Some(cli_dir) = whisper_cli.parent() {
            let bundled_lib_dir = cli_dir.join("../lib");
            if bundled_lib_dir.exists() {
                let bundled_lib = bundled_lib_dir.to_string_lossy().to_string();

                if !bundled_lib.is_empty() {
                    let existing_fallback =
                        env::var("DYLD_FALLBACK_LIBRARY_PATH").unwrap_or_default();
                    let fallback_value = if existing_fallback.is_empty() {
                        bundled_lib.clone()
                    } else if existing_fallback
                        .split(':')
                        .any(|entry| entry == bundled_lib)
                    {
                        existing_fallback
                    } else {
                        format!("{bundled_lib}:{existing_fallback}")
                    };

                    command.env("DYLD_FALLBACK_LIBRARY_PATH", fallback_value);
                    command.env("DYLD_LIBRARY_PATH", bundled_lib);
                }
            }
        }

        command
            .output()
            .map_err(|e| format!("Failed to run whisper-cli: {e}"))
    };

    let output = execute_with_args(&base_args)?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let mut cpu_args = base_args.clone();
    cpu_args.push("-ng".to_string());

    let cpu_output = execute_with_args(&cpu_args)?;
    if cpu_output.status.success() {
        return Ok(());
    }

    let cpu_stderr = String::from_utf8_lossy(&cpu_output.stderr);
    Err(format!(
        "whisper-cli failed after CPU fallback. gpu_error: {stderr} | cpu_error: {cpu_stderr}"
    ))
}

fn cleanup_dir(path: &Path) {
    let _ = fs::remove_dir_all(path);
}

/// Transcribe audio using local whisper.cpp CLI.
#[tauri::command]
pub async fn transcribe_audio(
    audio_base64: String,
    model: String,
    language: String,
) -> Result<TranscriptionResult, String> {
    let whisper_cli = resolve_whisper_cli()
    .ok_or_else(|| {
        "Whisper CLI executable not found. Ensure bundled runtime exists under Resources/bin or install whisper.cpp and add whisper-cli to PATH."
            .to_string()
    })?;

    let model_path = resolve_whisper_model(&model).ok_or_else(|| {
        format!(
            "Whisper model file not found for model '{}'. Set WHISPER_MODEL_PATH or place ggml model under models/whisper.",
            model
        )
    })?;

    let audio_bytes = decode_audio_base64(&audio_base64)?;
    if !is_wav_bytes(&audio_bytes) {
        return Err(
            "Only WAV audio input is supported. Please update the client audio recorder."
                .to_string(),
        );
    }

    let temp_dir = env::temp_dir().join(format!("mypartnerai-whisper-{}", now_millis()));
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temporary directory: {e}"))?;

    let wav_path = temp_dir.join("input.wav");
    let output_prefix = temp_dir.join("transcript");
    let transcript_path = temp_dir.join("transcript.txt");

    let result = (|| -> Result<TranscriptionResult, String> {
        fs::write(&wav_path, &audio_bytes)
            .map_err(|e| format!("Failed to write WAV input file: {e}"))?;

        run_whisper_cli(
            &whisper_cli,
            &model_path,
            &wav_path,
            &language,
            &output_prefix,
        )?;

        let text = fs::read_to_string(&transcript_path)
            .map_err(|e| format!("Failed to read Whisper transcription output: {e}"))?
            .trim()
            .to_string();

        if text.is_empty() {
            return Err("Whisper transcription output is empty.".to_string());
        }

        Ok(TranscriptionResult {
            text,
            confidence: 0.0,
            language: if language.trim().is_empty() {
                "auto".to_string()
            } else {
                language
            },
        })
    })();

    cleanup_dir(&temp_dir);
    result
}

/// Check if Whisper model is available locally
#[tauri::command]
pub async fn check_whisper_available() -> bool {
    let has_whisper_cli = resolve_whisper_cli().is_some();
    let has_model = resolve_whisper_model("base").is_some();
    has_whisper_cli && has_model
}

/// Get detailed Whisper dependency status for install guidance.
#[tauri::command]
pub async fn get_whisper_availability(model: Option<String>) -> WhisperAvailabilityStatus {
    let whisper_cli = resolve_whisper_cli();

    let model_name = model.unwrap_or_else(|| "base".to_string());
    let model_path = resolve_whisper_model(&model_name);

    WhisperAvailabilityStatus {
        cli_found: whisper_cli.is_some(),
        model_found: model_path.is_some(),
        cli_path: whisper_cli.map(|p| p.to_string_lossy().to_string()),
        model_path: model_path.map(|p| p.to_string_lossy().to_string()),
    }
}

