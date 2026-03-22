/// Returns the default VRM as a base64-encoded string.
/// Opensource build: no default VRM is embedded.
#[tauri::command]
pub fn load_default_vrm() -> Result<String, String> {
    Err("No default VRM available".into())
}

/// Returns whether a default VRM is embedded in this build.
#[tauri::command]
pub fn is_default_vrm_available() -> bool {
    false
}
