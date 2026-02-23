// Prevents additional console window on Windows in release
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::window::set_ignore_cursor_events,
            commands::window::set_window_position,
            commands::window::get_window_size,
            commands::window::get_cursor_position,
            commands::window::log_to_terminal,
            commands::screenshot::capture_screen,
            commands::voice::transcribe_audio,
            commands::voice::synthesize_speech,
            commands::voice::check_whisper_available,
            commands::voice::get_whisper_availability,
            commands::voice::check_tts_available,
            commands::voice::detect_remote_environment,
            commands::settings::open_microphone_settings,
            commands::settings::open_accessibility_settings,
            commands::settings::open_screen_recording_settings,
            commands::settings::pick_vrm_file,
            commands::auth::open_oauth_url,
            commands::auth::parse_auth_callback,
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let monitor = window
                    .current_monitor()
                    .ok()
                    .flatten()
                    .or_else(|| app.primary_monitor().ok().flatten());

                if let Some(monitor) = monitor {
                    let monitor_size = monitor.size();
                    let monitor_pos = monitor.position();

                    let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                        width: monitor_size.width,
                        height: monitor_size.height,
                    }));
                    let _ = window.set_position(tauri::Position::Physical(
                        tauri::PhysicalPosition {
                            x: monitor_pos.x,
                            y: monitor_pos.y,
                        },
                    ));
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
