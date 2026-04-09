use futures_util::StreamExt;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

// --- Constants ---

const MODELS_DIR_NAME: &str = ".mypartnerai/models";

const SUPERTONIC_ONNX_FILES: &[&str] = &[
    "onnx/tts.json",
    "onnx/unicode_indexer.json",
    "onnx/duration_predictor.onnx",
    "onnx/text_encoder.onnx",
    "onnx/vector_estimator.onnx",
    "onnx/vocoder.onnx",
];

const SUPERTONIC_VOICE_STYLES: &[&str] = &[
    "voice_styles/F1.json",
    "voice_styles/F2.json",
    "voice_styles/F3.json",
    "voice_styles/F4.json",
    "voice_styles/F5.json",
    "voice_styles/M1.json",
    "voice_styles/M2.json",
    "voice_styles/M3.json",
    "voice_styles/M4.json",
    "voice_styles/M5.json",
];

const SUPERTONIC_BASE_URL: &str =
    "https://huggingface.co/Supertone/supertonic-2/resolve/main";

const WHISPER_BASE_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

// --- Types ---

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelStatus {
    pub supertonic_ready: bool,
    pub whisper_base_ready: bool,
    pub whisper_small_ready: bool,
    pub whisper_medium_ready: bool,
    pub supertonic_version_ok: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub model_type: String,
    pub file_name: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub file_index: u32,
    pub total_files: u32,
}

// --- Helpers ---

fn models_root() -> Result<PathBuf, String> {
    dirs::home_dir()
        .map(|home| home.join(MODELS_DIR_NAME))
        .ok_or_else(|| "Cannot determine home directory".to_string())
}

fn supertonic_dir() -> Result<PathBuf, String> {
    Ok(models_root()?.join("supertonic"))
}

fn whisper_dir() -> Result<PathBuf, String> {
    Ok(models_root()?.join("whisper"))
}

fn check_supertonic_version(supertonic_path: &PathBuf) -> bool {
    let tts_json_path = supertonic_path.join("onnx/tts.json");
    if !tts_json_path.exists() {
        return false;
    }

    match fs::read_to_string(&tts_json_path) {
        Ok(content) => {
            // v1 models don't have tts_version field, so if parsing fails or
            // version is missing, we consider it potentially v1 (needs re-download).
            // v2 (supertonic-2) should have the proper structure.
            // For now, if the file exists and has valid JSON, we accept it.
            // The key check is: does it have the ae.sample_rate field?
            match serde_json::from_str::<serde_json::Value>(&content) {
                Ok(val) => {
                    // Check for v2 model signature: ae.sample_rate should be 44100
                    val.get("ae")
                        .and_then(|ae| ae.get("sample_rate"))
                        .and_then(|sr| sr.as_i64())
                        .map(|sr| sr == 44100)
                        .unwrap_or(false)
                }
                Err(_) => false,
            }
        }
        Err(_) => false,
    }
}

fn all_supertonic_files_exist(supertonic_path: &PathBuf) -> bool {
    for file in SUPERTONIC_ONNX_FILES.iter().chain(SUPERTONIC_VOICE_STYLES.iter()) {
        if !supertonic_path.join(file).exists() {
            return false;
        }
    }
    true
}

fn whisper_model_exists(whisper_path: &PathBuf, size: &str) -> bool {
    whisper_path.join(format!("ggml-{}.bin", size)).exists()
}

fn supertonic_file_urls() -> Vec<(String, String)> {
    let mut files = Vec::new();
    for file in SUPERTONIC_ONNX_FILES.iter().chain(SUPERTONIC_VOICE_STYLES.iter()) {
        files.push((
            file.to_string(),
            format!("{}/{}", SUPERTONIC_BASE_URL, file),
        ));
    }
    files
}

fn whisper_file_url(size: &str) -> (String, String) {
    let filename = format!("ggml-{}.bin", size);
    let url = format!("{}/{}", WHISPER_BASE_URL, filename);
    (filename, url)
}

async fn download_file_with_progress(
    app: &AppHandle,
    model_type: &str,
    file_name: &str,
    url: &str,
    target_path: &PathBuf,
    file_index: u32,
    total_files: u32,
) -> Result<(), String> {
    // Ensure parent directory exists
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let temp_path = target_path.with_extension("download");

    let client = reqwest::Client::builder()
        .user_agent("AMA/1.5.0")
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let max_retries = 3u32;
    let mut response = None;
    for attempt in 0..max_retries {
        match client.get(url).send().await {
            Ok(resp) if resp.status().is_success() => {
                response = Some(resp);
                break;
            }
            Ok(resp) => {
                let status = resp.status();
                if attempt + 1 < max_retries && (status.as_u16() == 503 || status.as_u16() == 429) {
                    let delay = std::time::Duration::from_secs(2u64.pow(attempt + 1));
                    tokio::time::sleep(delay).await;
                    continue;
                }
                return Err(format!(
                    "Download failed with HTTP {}: {}",
                    status, url
                ));
            }
            Err(e) => {
                if attempt + 1 < max_retries {
                    let delay = std::time::Duration::from_secs(2u64.pow(attempt + 1));
                    tokio::time::sleep(delay).await;
                    continue;
                }
                return Err(format!("Download request failed: {}", e));
            }
        }
    }
    let response = response.unwrap();

    let total_bytes = response.content_length().unwrap_or(0);

    let mut file = tokio::fs::File::create(&temp_path)
        .await
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    let mut stream = response.bytes_stream();
    let mut downloaded_bytes: u64 = 0;
    let mut last_emitted: u64 = 0;

    use tokio::io::AsyncWriteExt;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download stream error: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write chunk: {}", e))?;

        downloaded_bytes += chunk.len() as u64;

        // Emit progress every 100KB to avoid flooding
        if downloaded_bytes - last_emitted > 102_400 || downloaded_bytes == total_bytes {
            last_emitted = downloaded_bytes;
            let _ = app.emit(
                "model-download-progress",
                DownloadProgress {
                    model_type: model_type.to_string(),
                    file_name: file_name.to_string(),
                    downloaded_bytes,
                    total_bytes,
                    file_index,
                    total_files,
                },
            );
        }
    }

    file.flush()
        .await
        .map_err(|e| format!("Failed to flush file: {}", e))?;
    drop(file);

    // Atomic rename
    tokio::fs::rename(&temp_path, target_path)
        .await
        .map_err(|e| format!("Failed to rename temp file: {}", e))?;

    Ok(())
}

// --- Commands ---

#[tauri::command]
pub async fn check_model_status() -> Result<ModelStatus, String> {
    let supertonic_path = supertonic_dir()?;
    let whisper_path = whisper_dir()?;

    let supertonic_ready = all_supertonic_files_exist(&supertonic_path);
    let supertonic_version_ok = if supertonic_ready {
        check_supertonic_version(&supertonic_path)
    } else {
        false
    };

    Ok(ModelStatus {
        supertonic_ready: supertonic_ready && supertonic_version_ok,
        whisper_base_ready: whisper_model_exists(&whisper_path, "base"),
        whisper_small_ready: whisper_model_exists(&whisper_path, "small"),
        whisper_medium_ready: whisper_model_exists(&whisper_path, "medium"),
        supertonic_version_ok,
    })
}

#[tauri::command]
pub async fn download_model(
    app: AppHandle,
    model_type: String,
) -> Result<(), String> {
    match model_type.as_str() {
        "supertonic" => {
            let supertonic_path = supertonic_dir()?;
            let files = supertonic_file_urls();
            let total_files = files.len() as u32;

            for (index, (relative_path, url)) in files.iter().enumerate() {
                let target = supertonic_path.join(relative_path);

                // Skip already downloaded files
                if target.exists() {
                    let _ = app.emit(
                        "model-download-progress",
                        DownloadProgress {
                            model_type: model_type.clone(),
                            file_name: relative_path.clone(),
                            downloaded_bytes: 1,
                            total_bytes: 1,
                            file_index: index as u32 + 1,
                            total_files,
                        },
                    );
                    continue;
                }

                download_file_with_progress(
                    &app,
                    &model_type,
                    relative_path,
                    url,
                    &target,
                    index as u32 + 1,
                    total_files,
                )
                .await?;
            }

            Ok(())
        }
        "whisper-base" | "whisper-small" | "whisper-medium" => {
            let size = model_type
                .strip_prefix("whisper-")
                .ok_or_else(|| "Invalid whisper model type".to_string())?;

            let whisper_path = whisper_dir()?;
            let (filename, url) = whisper_file_url(size);
            let target = whisper_path.join(&filename);

            if target.exists() {
                return Ok(());
            }

            download_file_with_progress(&app, &model_type, &filename, &url, &target, 1, 1)
                .await?;

            Ok(())
        }
        _ => Err(format!("Unknown model type: {}", model_type)),
    }
}

#[tauri::command]
pub async fn get_models_dir() -> Result<String, String> {
    let root = models_root()?;
    if !root.exists() {
        fs::create_dir_all(&root)
            .map_err(|e| format!("Failed to create models directory: {}", e))?;
    }
    Ok(root.to_string_lossy().to_string())
}

/// 로컬 폴더를 macOS Finder에서 열기 (~/.mypartnerai/ 하위만 허용)
#[tauri::command]
pub async fn open_folder_in_finder(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    // 경로 화이트리스트: ~/.mypartnerai/ 하위만 허용
    let canonical = p.canonicalize()
        .map_err(|e| format!("Failed to resolve path: {}", e))?;
    let allowed_root = dirs::home_dir()
        .ok_or("Cannot find home directory")?
        .join(".mypartnerai");
    if !canonical.starts_with(&allowed_root) {
        return Err(format!("Access denied: only paths under ~/.mypartnerai/ are allowed"));
    }
    std::process::Command::new("open")
        .arg(canonical.to_string_lossy().as_ref())
        .spawn()
        .map_err(|e| format!("Failed to open folder: {}", e))?;
    Ok(())
}

fn dir_size(path: &PathBuf) -> u64 {
    if path.is_file() {
        return path.metadata().map(|m| m.len()).unwrap_or(0);
    }
    fs::read_dir(path)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .map(|e| dir_size(&e.path()))
                .sum()
        })
        .unwrap_or(0)
}

#[tauri::command]
pub async fn delete_app_data() -> Result<u64, String> {
    let root = models_root()?;
    if !root.exists() {
        return Ok(0);
    }
    let size = dir_size(&root);
    fs::remove_dir_all(&root).map_err(|e| format!("Failed to delete app data: {}", e))?;
    Ok(size)
}
