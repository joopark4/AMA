use std::process::Command;
use tauri_plugin_dialog::DialogExt;

/// Open system settings for microphone permission
#[tauri::command]
pub fn open_microphone_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone")
            .spawn()
            .map_err(|e| format!("Failed to open settings: {}", e))?;
        Ok(())
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "ms-settings:privacy-microphone"])
            .spawn()
            .map_err(|e| format!("Failed to open settings: {}", e))?;
        Ok(())
    }

    #[cfg(target_os = "linux")]
    {
        // Try common Linux desktop environments
        // GNOME
        if Command::new("gnome-control-center")
            .arg("privacy")
            .spawn()
            .is_ok()
        {
            return Ok(());
        }

        // KDE
        if Command::new("systemsettings5")
            .spawn()
            .is_ok()
        {
            return Ok(());
        }

        Err("Could not open system settings. Please manually enable microphone access.".to_string())
    }
}

/// Open system settings for accessibility (screen recording permission)
#[tauri::command]
pub fn open_accessibility_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
            .spawn()
            .map_err(|e| format!("Failed to open settings: {}", e))?;
        Ok(())
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "ms-settings:easeofaccess"])
            .spawn()
            .map_err(|e| format!("Failed to open settings: {}", e))?;
        Ok(())
    }

    #[cfg(target_os = "linux")]
    {
        Err("Not implemented for Linux".to_string())
    }
}

/// Open system settings for screen recording permission
#[tauri::command]
pub fn open_screen_recording_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
            .spawn()
            .map_err(|e| format!("Failed to open settings: {}", e))?;
        Ok(())
    }

    #[cfg(target_os = "windows")]
    {
        // Windows doesn't have a specific screen recording permission page
        Command::new("cmd")
            .args(["/C", "start", "ms-settings:privacy"])
            .spawn()
            .map_err(|e| format!("Failed to open settings: {}", e))?;
        Ok(())
    }

    #[cfg(target_os = "linux")]
    {
        Err("Not implemented for Linux".to_string())
    }
}

/// Open native file picker to select a VRM model file.
#[tauri::command]
pub async fn pick_vrm_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let selected = app
        .dialog()
        .file()
        .add_filter("VRM Model", &["vrm"])
        .set_title("Select VRM Model")
        .blocking_pick_file();

    let Some(file_path) = selected else {
        return Ok(None);
    };

    let path = file_path
        .into_path()
        .map_err(|e| format!("Invalid selected file path: {e}"))?;

    Ok(Some(path.to_string_lossy().to_string()))
}
