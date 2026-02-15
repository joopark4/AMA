use tauri::{AppHandle, Manager};

#[derive(serde::Serialize)]
pub struct WindowSize {
    width: u32,
    height: u32,
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
