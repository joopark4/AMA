// Prevents additional console window on Windows in release
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
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
            commands::voice::check_tts_available,
            commands::settings::open_microphone_settings,
            commands::settings::open_accessibility_settings,
            commands::settings::open_screen_recording_settings,
        ])
        .setup(|_app| {
            // Minimal setup for debugging
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
