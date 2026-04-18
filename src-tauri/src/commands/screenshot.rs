use base64::{engine::general_purpose::STANDARD, Engine};
#[cfg(target_os = "macos")]
use image::{imageops::FilterType, ImageEncoder, RgbImage};
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use tauri::{AppHandle, State};

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    /// Returns true if the app has been granted Screen Recording permission.
    /// Does not prompt — use `request_screen_capture_access` to trigger the prompt.
    fn CGPreflightScreenCaptureAccess() -> bool;
    /// Triggers the system Screen Recording permission prompt (once per app lifetime).
    fn CGRequestScreenCaptureAccess() -> bool;
}

#[derive(serde::Serialize)]
pub struct ScreenshotResult {
    pub data: String,
    pub width: u32,
    pub height: u32,
}

/// Capture the screen and return as base64 encoded PNG
#[tauri::command]
pub async fn capture_screen() -> Result<ScreenshotResult, String> {
    #[cfg(target_os = "macos")]
    {
        capture_screen_macos().await
    }

    #[cfg(target_os = "windows")]
    {
        capture_screen_windows().await
    }

    #[cfg(target_os = "linux")]
    {
        capture_screen_linux().await
    }
}

#[cfg(target_os = "macos")]
async fn capture_screen_macos() -> Result<ScreenshotResult, String> {
    use std::fs;

    let temp_dir = std::env::temp_dir();
    let screenshot_path = temp_dir.join("mypartnerai_screenshot.png");
    let screenshot_path_str = screenshot_path.to_string_lossy().to_string();

    // Use screencapture command on macOS
    let output = Command::new("screencapture")
        .args(["-x", "-t", "png", &screenshot_path_str])
        .output()
        .map_err(|e| format!("Failed to execute screencapture: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "screencapture failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    // Read the screenshot file
    let data = fs::read(&screenshot_path)
        .map_err(|e| format!("Failed to read screenshot: {}", e))?;

    // Get image dimensions (basic PNG header parsing)
    let (width, height) = if data.len() > 24 {
        let width = u32::from_be_bytes([data[16], data[17], data[18], data[19]]);
        let height = u32::from_be_bytes([data[20], data[21], data[22], data[23]]);
        (width, height)
    } else {
        (0, 0)
    };

    // Encode as base64
    let base64_data = STANDARD.encode(&data);

    // Clean up temp file
    let _ = fs::remove_file(&screenshot_path);

    Ok(ScreenshotResult {
        data: base64_data,
        width,
        height,
    })
}

#[cfg(target_os = "windows")]
async fn capture_screen_windows() -> Result<ScreenshotResult, String> {
    // TODO: Implement Windows screenshot using win32 API
    Err("Windows screenshot not yet implemented".to_string())
}

#[cfg(target_os = "linux")]
async fn capture_screen_linux() -> Result<ScreenshotResult, String> {
    // TODO: Implement Linux screenshot using scrot or gnome-screenshot
    Err("Linux screenshot not yet implemented".to_string())
}

// ─────────────────────────────────────────────────────────────
// Screen Watch — 주기적 관찰 전용 명령 (기존 capture_screen 미변경)
// ─────────────────────────────────────────────────────────────

/// 변화 감지용 이전 이미지 버퍼 (640x360 RGB, 약 0.7MB)
#[derive(Default)]
pub struct ScreenWatchState {
    previous_buffer: Mutex<Option<Vec<u8>>>,
}

impl ScreenWatchState {
    pub fn new() -> Self {
        Self {
            previous_buffer: Mutex::new(None),
        }
    }
}

#[derive(serde::Deserialize, Debug, Clone)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum CaptureTarget {
    Fullscreen,
    ActiveWindow,
    MainMonitor,
    Window {
        #[serde(rename = "appName")]
        app_name: String,
        #[serde(rename = "windowTitle")]
        window_title: Option<String>,
    },
}

#[derive(serde::Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum ScreenWatchResult {
    /// 화면이 이전과 거의 동일 — LLM 호출 스킵
    Unchanged,
    /// 캡처 성공
    Changed {
        /// Base64 JPEG (LLM 전송용, 50% 리사이즈)
        data: String,
        /// 저장된 이미지 파일 경로 (CLI provider용, save_dir 지정 시)
        path: Option<String>,
        width: u32,
        height: u32,
    },
    /// Screen Recording 권한 없거나 빈 이미지
    PermissionDenied,
    /// 기타 에러
    Error {
        message: String,
    },
}

const COMPARE_WIDTH: u32 = 640;
const COMPARE_HEIGHT: u32 = 360;
/// 픽셀당 평균 절대 차이 임계값 (0..255). 5% ~ 12 정도.
const CHANGE_THRESHOLD: f32 = 12.0;
const JPEG_QUALITY: u8 = 80;

/// 주기적 관찰 전용 화면 캡처.
/// - macOS screencapture로 PNG 캡처 → image 크레이트로 리사이즈
/// - 이전 이미지와 픽셀 차이 비교: 변화 미약 → Unchanged 반환 (LLM 호출 절감)
/// - 변화 시: 50% 리사이즈 JPEG 생성 + 선택적으로 파일 저장
/// - 빈 이미지(권한 거부) 자동 감지
#[tauri::command]
pub async fn capture_screen_for_watch(
    target: CaptureTarget,
    save_dir: Option<String>,
    save_filename: Option<String>,
    state: State<'_, ScreenWatchState>,
) -> Result<ScreenWatchResult, String> {
    #[cfg(target_os = "macos")]
    {
        capture_screen_for_watch_macos(target, save_dir, save_filename, state).await
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(ScreenWatchResult::Error {
            message: "screen watch is only supported on macOS".to_string(),
        })
    }
}

#[cfg(target_os = "macos")]
async fn capture_screen_for_watch_macos(
    target: CaptureTarget,
    save_dir: Option<String>,
    save_filename: Option<String>,
    state: State<'_, ScreenWatchState>,
) -> Result<ScreenWatchResult, String> {
    use std::fs;

    // Preflight OS-level permission check (Blocker #3).
    // 빈 이미지 휴리스틱(=`is_uniform_image`) 대신 OS API로 실제 권한을 확인한다.
    unsafe {
        if !CGPreflightScreenCaptureAccess() {
            return Ok(ScreenWatchResult::PermissionDenied);
        }
    }

    let temp_dir = std::env::temp_dir();
    let raw_path = temp_dir.join("mypartnerai_screen_watch_raw.png");
    let raw_path_str = raw_path.to_string_lossy().to_string();

    // screencapture 인자 구성 — Window 계열은 fail-closed (찾지 못하면 에러).
    let mut args: Vec<String> = vec!["-x".to_string(), "-t".to_string(), "png".to_string()];

    match &target {
        CaptureTarget::Fullscreen => {
            // 기본 — 전체 화면
        }
        CaptureTarget::MainMonitor => {
            args.push("-m".to_string());
        }
        CaptureTarget::ActiveWindow => {
            // fail-closed: 최상위 창 ID를 못 구하면 전체 화면으로 확대하지 않고 에러.
            match find_frontmost_window_id() {
                Some(id) => {
                    args.push("-l".to_string());
                    args.push(id.to_string());
                }
                None => {
                    return Ok(ScreenWatchResult::Error {
                        message: "active window not found (Accessibility permission required?)"
                            .to_string(),
                    });
                }
            }
        }
        CaptureTarget::Window { app_name, window_title } => {
            match find_window_id(app_name, window_title.as_deref()) {
                Some(id) => {
                    args.push("-l".to_string());
                    args.push(id.to_string());
                }
                None => {
                    return Ok(ScreenWatchResult::Error {
                        message: format!("window not found: {}", app_name),
                    });
                }
            }
        }
    }

    args.push(raw_path_str.clone());

    let output = Command::new("screencapture")
        .args(&args)
        .output()
        .map_err(|e| format!("screencapture exec failed: {}", e))?;

    if !output.status.success() {
        return Ok(ScreenWatchResult::Error {
            message: format!(
                "screencapture failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ),
        });
    }

    // 캡처된 파일을 디코딩
    let raw_bytes = match fs::read(&raw_path) {
        Ok(b) => b,
        Err(e) => {
            return Ok(ScreenWatchResult::Error {
                message: format!("read raw capture: {}", e),
            });
        }
    };
    let _ = fs::remove_file(&raw_path);

    let img = match image::load_from_memory(&raw_bytes) {
        Ok(i) => i.to_rgb8(),
        Err(e) => {
            return Ok(ScreenWatchResult::Error {
                message: format!("decode png: {}", e),
            });
        }
    };

    // 단색 이미지는 관찰할 콘텐츠가 없으므로 Unchanged로 스킵.
    // (권한 거부는 이미 상단 CGPreflightScreenCaptureAccess로 처리됨 — 이 분기는
    //  검은 바탕화면/로그인 화면/잠금 화면 같은 정상 콘텐츠를 permission_denied로 오인하지 않는다.)
    if is_uniform_image(&img) {
        return Ok(ScreenWatchResult::Unchanged);
    }

    // 비교용 축소 (640x360)
    let compare_img = image::imageops::resize(
        &img,
        COMPARE_WIDTH,
        COMPARE_HEIGHT,
        FilterType::Triangle,
    );
    let compare_buffer = compare_img.as_raw().clone();

    // 이전 버퍼와 비교
    let changed = {
        let mut prev = state.previous_buffer.lock().unwrap();
        let is_changed = match prev.as_ref() {
            Some(previous) => mean_abs_diff(previous, &compare_buffer) >= CHANGE_THRESHOLD,
            None => true,
        };
        if is_changed {
            *prev = Some(compare_buffer);
        }
        is_changed
    };

    if !changed {
        return Ok(ScreenWatchResult::Unchanged);
    }

    // LLM 전송용 리사이즈 (50%)
    let llm_width = img.width() / 2;
    let llm_height = img.height() / 2;
    let llm_img = image::imageops::resize(&img, llm_width, llm_height, FilterType::Lanczos3);

    // JPEG 인코딩
    let mut jpeg_buf: Vec<u8> = Vec::new();
    {
        let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_buf, JPEG_QUALITY);
        encoder
            .write_image(
                llm_img.as_raw(),
                llm_width,
                llm_height,
                image::ExtendedColorType::Rgb8,
            )
            .map_err(|e| format!("jpeg encode: {}", e))?;
    }

    // 선택적 파일 저장 — save_dir이 비어있거나 상대경로면 거부 (Blocker #2 대응).
    let saved_path = if let Some(dir) = save_dir.filter(|d| !d.trim().is_empty()) {
        let dir_path = PathBuf::from(&dir);
        if !dir_path.is_absolute() {
            return Ok(ScreenWatchResult::Error {
                message: "save_dir must be an absolute path".to_string(),
            });
        }
        if !dir_path.exists() {
            let _ = fs::create_dir_all(&dir_path);
        }
        let filename = save_filename.unwrap_or_else(|| "screen_watch.jpg".to_string());
        let file_path = dir_path.join(&filename);
        match fs::write(&file_path, &jpeg_buf) {
            Ok(_) => Some(file_path.to_string_lossy().to_string()),
            Err(_) => None,
        }
    } else {
        None
    };

    Ok(ScreenWatchResult::Changed {
        data: STANDARD.encode(&jpeg_buf),
        path: saved_path,
        width: llm_width,
        height: llm_height,
    })
}

#[cfg(target_os = "macos")]
fn is_uniform_image(img: &RgbImage) -> bool {
    if img.width() == 0 || img.height() == 0 {
        return true;
    }
    let raw = img.as_raw();
    if raw.is_empty() {
        return true;
    }
    // 샘플링: 1000 픽셀 체크. 모두 같은 R,G,B면 단색 → 권한 거부 추정
    let sample_step = (raw.len() / 3000).max(1);
    let first = (raw[0], raw[1], raw[2]);
    let mut checked = 0;
    let mut i = 0;
    while i + 2 < raw.len() && checked < 1000 {
        if (raw[i], raw[i + 1], raw[i + 2]) != first {
            return false;
        }
        i += 3 * sample_step;
        checked += 1;
    }
    true
}

#[cfg(target_os = "macos")]
fn mean_abs_diff(a: &[u8], b: &[u8]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return f32::MAX;
    }
    // 성능 위해 step-sampling (10% 픽셀만 비교해도 체감 변화는 잡힘)
    let step = 30; // RGB 10픽셀 간격
    let mut sum: u64 = 0;
    let mut count: u64 = 0;
    let mut i = 0;
    while i < a.len() {
        sum += (a[i] as i32 - b[i] as i32).unsigned_abs() as u64;
        count += 1;
        i += step;
    }
    if count == 0 {
        return 0.0;
    }
    sum as f32 / count as f32
}

#[derive(serde::Serialize)]
pub struct WindowInfo {
    #[serde(rename = "appName")]
    pub app_name: String,
    #[serde(rename = "windowTitle")]
    pub window_title: String,
    #[serde(rename = "windowId")]
    pub window_id: u32,
}

/// 현재 열려있는 사용자 윈도우 목록을 반환 (시스템/자기앱 제외).
#[tauri::command]
pub async fn list_windows() -> Result<Vec<WindowInfo>, String> {
    #[cfg(target_os = "macos")]
    {
        Ok(list_windows_macos())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(vec![])
    }
}

#[cfg(target_os = "macos")]
fn list_windows_macos() -> Vec<WindowInfo> {
    // CGWindowListCopyWindowInfo FFI 대신 AppleScript로 fallback.
    // Accessibility 권한이 있으면 visible app의 window 목록 취득 가능.
    fallback_list_windows_via_applescript()
}

#[cfg(target_os = "macos")]
fn fallback_list_windows_via_applescript() -> Vec<WindowInfo> {
    // AppleScript로 visible app의 window 목록 조회 (windowId는 osascript에서 취득 어려움 → -1 placeholder)
    // 실제 캡처 시 find_window_id가 다시 조회하여 실제 ID 반환
    let script = r#"
    set windowList to {}
    tell application "System Events"
        set visibleApps to (every process whose visible is true and background only is false)
        repeat with proc in visibleApps
            set appName to name of proc
            try
                set procWindows to windows of proc
                repeat with w in procWindows
                    try
                        set wTitle to name of w
                        if wTitle is not missing value and wTitle is not "" then
                            copy (appName & "|" & wTitle) to end of windowList
                        end if
                    end try
                end repeat
            end try
        end repeat
    end tell
    set AppleScript's text item delimiters to linefeed
    return windowList as text
    "#;

    let output = Command::new("osascript")
        .args(["-e", script])
        .output();

    let output = match output {
        Ok(o) if o.status.success() => o,
        _ => return Vec::new(),
    };

    let text = String::from_utf8_lossy(&output.stdout);
    let mut result = Vec::new();
    for line in text.lines() {
        let parts: Vec<&str> = line.splitn(2, '|').collect();
        if parts.len() != 2 {
            continue;
        }
        let app = parts[0].trim();
        let title = parts[1].trim();
        if app.is_empty() || title.is_empty() {
            continue;
        }
        // 자기 앱 제외
        if app == "AMA" || app == "MyPartnerAI" {
            continue;
        }
        // 시스템 윈도우 제외
        if matches!(app, "Window Server" | "Dock" | "SystemUIServer" | "Control Center") {
            continue;
        }
        result.push(WindowInfo {
            app_name: app.to_string(),
            window_title: title.to_string(),
            window_id: 0, // placeholder — 캡처 시점에 실제 ID 조회
        });
    }
    result
}

#[cfg(target_os = "macos")]
fn find_frontmost_window_id() -> Option<u32> {
    // AppleScript로 최상위 앱의 첫 윈도우 ID 취득
    let script = r#"
    tell application "System Events"
        set frontApp to first process whose frontmost is true
        try
            set frontWindow to first window of frontApp
            return id of frontWindow
        on error
            return ""
        end try
    end tell
    "#;
    let output = Command::new("osascript").args(["-e", script]).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&output.stdout);
    s.trim().parse::<u32>().ok()
}

#[cfg(target_os = "macos")]
fn find_window_id(app_name: &str, window_title: Option<&str>) -> Option<u32> {
    let title_filter = window_title.unwrap_or("");
    let script = format!(
        r#"
        tell application "System Events"
            try
                set proc to first process whose name is "{app}"
                set wins to windows of proc
                repeat with w in wins
                    try
                        set wTitle to name of w
                        if "{title}" is "" or wTitle contains "{title}" then
                            return id of w
                        end if
                    end try
                end repeat
            end try
            return ""
        end tell
        "#,
        app = app_name.replace('"', "\\\""),
        title = title_filter.replace('"', "\\\"")
    );
    let output = Command::new("osascript").args(["-e", &script]).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&output.stdout);
    s.trim().parse::<u32>().ok()
}

/// 관찰 중단 시 이전 이미지 버퍼 해제 (메모리 절감)
#[tauri::command]
pub async fn clear_screen_watch_state(state: State<'_, ScreenWatchState>) -> Result<(), String> {
    let mut prev = state.previous_buffer.lock().unwrap();
    *prev = None;
    Ok(())
}

/// 현재 Screen Recording 권한 상태 조회. prompt 없이 bool만 반환.
#[tauri::command]
pub async fn check_screen_capture_permission() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    unsafe {
        Ok(CGPreflightScreenCaptureAccess())
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(true)
    }
}

/// 시스템 Screen Recording 권한 프롬프트 발생 (앱 생애주기당 1회만 실제 프롬프트 표시).
/// 이미 결정된 상태에서는 현재 권한 상태만 반환.
#[tauri::command]
pub async fn request_screen_capture_permission() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    unsafe {
        Ok(CGRequestScreenCaptureAccess())
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(true)
    }
}

/// 저장된 스크린샷 파일 삭제
#[tauri::command]
pub async fn delete_screen_watch_image(path: String) -> Result<(), String> {
    use std::fs;
    let p = PathBuf::from(&path);
    if p.exists() {
        fs::remove_file(&p).map_err(|e| format!("delete failed: {}", e))?;
    }
    Ok(())
}

/// 앱 시작 시 잔여 스크린샷 파일 정리
#[tauri::command]
pub async fn cleanup_screen_watch_residuals(_app: AppHandle) -> Result<(), String> {
    use std::fs;
    // 기본 저장 경로 (~/.mypartnerai/screenshots/screen_watch.jpg)
    if let Some(home) = dirs::home_dir() {
        let default_path = home.join(".mypartnerai").join("screenshots").join("screen_watch.jpg");
        if default_path.exists() {
            let _ = fs::remove_file(&default_path);
        }
    }
    Ok(())
}
