use base64::{engine::general_purpose::STANDARD, Engine};
use std::process::Command;

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
