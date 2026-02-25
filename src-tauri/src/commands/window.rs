use tauri::{AppHandle, Manager};

#[derive(serde::Serialize)]
pub struct WindowSize {
    width: u32,
    height: u32,
}

#[derive(serde::Serialize, Clone)]
pub struct MonitorInfo {
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub scale_factor: f64,
}

#[derive(serde::Serialize)]
pub struct MousePosition {
    x: f64,
    y: f64,
}

/// Set whether the window should ignore cursor events (click-through)
#[tauri::command]
pub async fn set_ignore_cursor_events(
    app: AppHandle,
    ignore: bool,
) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Window not found".to_string())?;

    window
        .set_ignore_cursor_events(ignore)
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Set the window position
#[tauri::command]
pub async fn set_window_position(
    app: AppHandle,
    x: i32,
    y: i32,
) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Window not found".to_string())?;

    window
        .set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }))
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Get the window size
#[tauri::command]
pub async fn get_window_size(app: AppHandle) -> Result<WindowSize, String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Window not found".to_string())?;

    let size = window.inner_size().map_err(|e| e.to_string())?;

    Ok(WindowSize {
        width: size.width,
        height: size.height,
    })
}

/// Log a message to the terminal (for debugging)
#[tauri::command]
pub fn log_to_terminal(message: String) {
    println!("[Frontend] {}", message);
}

/// Get global mouse cursor position
#[tauri::command]
pub fn get_cursor_position() -> Result<MousePosition, String> {
    #[cfg(target_os = "macos")]
    {
        use core_graphics::event::CGEvent;
        use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};

        let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState)
            .map_err(|_| "Failed to create event source".to_string())?;
        let event = CGEvent::new(source)
            .map_err(|_| "Failed to create event".to_string())?;
        let location = event.location();

        Ok(MousePosition {
            x: location.x,
            y: location.y,
        })
    }

    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
        use windows::Win32::Foundation::POINT;

        let mut point = POINT::default();
        unsafe {
            GetCursorPos(&mut point).map_err(|e| e.to_string())?;
        }

        Ok(MousePosition {
            x: point.x as f64,
            y: point.y as f64,
        })
    }

    #[cfg(target_os = "linux")]
    {
        // Linux implementation would need X11 or Wayland specific code
        Err("Not implemented for Linux".to_string())
    }
}

/// Get list of all available monitors
#[tauri::command]
pub async fn get_available_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let monitors = app
        .available_monitors()
        .map_err(|e| e.to_string())?;

    Ok(monitors
        .iter()
        .map(|m| {
            let size = m.size();
            let pos = m.position();
            MonitorInfo {
                name: m.name().cloned().unwrap_or_else(|| "Unknown".to_string()),
                width: size.width,
                height: size.height,
                x: pos.x,
                y: pos.y,
                scale_factor: m.scale_factor(),
            }
        })
        .collect())
}

/// Move the main window to a specific monitor
#[tauri::command]
pub async fn move_to_monitor(app: AppHandle, monitor_index: usize) -> Result<MonitorInfo, String> {
    let monitors = app
        .available_monitors()
        .map_err(|e| e.to_string())?;

    let monitor = monitors
        .get(monitor_index)
        .ok_or_else(|| format!("Monitor index {} out of range", monitor_index))?;

    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Window not found".to_string())?;

    let monitor_size = monitor.size();
    let monitor_pos = monitor.position();
    let scale = monitor.scale_factor();

    // Convert to logical coordinates (macOS global coordinate space uses points)
    let logical_x = monitor_pos.x as f64 / scale;
    let logical_y = monitor_pos.y as f64 / scale;
    let logical_w = monitor_size.width as f64 / scale;
    let logical_h = monitor_size.height as f64 / scale;

    let _ = window.set_resizable(true);

    // 1. Shrink window so macOS doesn't constrain position within current monitor
    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
        width: 100.0,
        height: 100.0,
    }));

    // 2. Move shrunken window to target monitor
    let _ = window.set_position(tauri::Position::Logical(tauri::LogicalPosition {
        x: logical_x,
        y: logical_y,
    }));

    // 3. Expand to fill target monitor
    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
        width: logical_w,
        height: logical_h,
    }));

    // 4. Re-set position — macOS calculates Y from bottom-left using window height,
    //    so the position must be corrected after the final size is applied.
    window
        .set_position(tauri::Position::Logical(tauri::LogicalPosition {
            x: logical_x,
            y: logical_y,
        }))
        .map_err(|e| e.to_string())?;

    let _ = window.set_resizable(false);

    Ok(MonitorInfo {
        name: monitor.name().cloned().unwrap_or_else(|| "Unknown".to_string()),
        width: monitor_size.width,
        height: monitor_size.height,
        x: monitor_pos.x,
        y: monitor_pos.y,
        scale_factor: monitor.scale_factor(),
    })
}

/// Get current monitor info
#[tauri::command]
pub async fn get_current_monitor(app: AppHandle) -> Result<MonitorInfo, String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Window not found".to_string())?;

    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .or_else(|| app.primary_monitor().ok().flatten())
        .ok_or_else(|| "No monitor found".to_string())?;

    let size = monitor.size();
    let pos = monitor.position();

    Ok(MonitorInfo {
        name: monitor.name().cloned().unwrap_or_else(|| "Unknown".to_string()),
        width: size.width,
        height: size.height,
        x: pos.x,
        y: pos.y,
        scale_factor: monitor.scale_factor(),
    })
}
