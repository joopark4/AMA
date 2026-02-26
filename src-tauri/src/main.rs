// Prevents additional console window on Windows in release
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
use tauri::{Emitter, Manager};
use tauri::menu::{MenuBuilder, MenuItem, SubmenuBuilder};

fn main() {
    let app = tauri::Builder::default()
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            commands::window::set_ignore_cursor_events,
            commands::window::set_window_position,
            commands::window::get_window_size,
            commands::window::get_cursor_position,
            commands::window::log_to_terminal,
            commands::screenshot::capture_screen,
            commands::voice::transcribe_audio,
            commands::voice::check_whisper_available,
            commands::voice::get_whisper_availability,
            commands::voice::detect_remote_environment,
            commands::settings::open_microphone_settings,
            commands::settings::open_accessibility_settings,
            commands::settings::open_screen_recording_settings,
            commands::settings::pick_vrm_file,
            commands::auth::open_oauth_url,
            commands::auth::parse_auth_callback,
            commands::models::check_model_status,
            commands::models::download_model,
            commands::models::get_models_dir,
            commands::window::get_available_monitors,
            commands::window::move_to_monitor,
            commands::window::get_current_monitor,
        ])
        .on_menu_event(|app, event| {
            if let Some(window) = app.get_webview_window("main") {
                match event.id().as_ref() {
                    "check_update" => {
                        let _ = window.emit("menu-check-update", ());
                    }
                    "open_settings" => {
                        let _ = window.emit("menu-open-settings", ());
                    }
                    "move_monitor_next" => {
                        let _ = window.emit("menu-move-monitor-next", ());
                    }
                    _ => {}
                }
            }
        })
        .setup(|app| {
            // macOS native menu bar
            let check_update = MenuItem::with_id(
                app,
                "check_update",
                "Check for Updates...",
                true,
                None::<&str>,
            )?;
            let open_settings = MenuItem::with_id(
                app,
                "open_settings",
                "Settings...",
                true,
                Some("CmdOrCtrl+,"),
            )?;

            let app_submenu = SubmenuBuilder::new(app, "AMA")
                .about(None)
                .separator()
                .item(&check_update)
                .separator()
                .item(&open_settings)
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let move_monitor = MenuItem::with_id(
                app,
                "move_monitor_next",
                "Move to Next Monitor",
                true,
                Some("CmdOrCtrl+Shift+M"),
            )?;

            let window_submenu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .separator()
                .item(&move_monitor)
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_submenu)
                .item(&edit_submenu)
                .item(&window_submenu)
                .build()?;

            app.set_menu(menu)?;

            // Window setup: full-screen overlay
            if let Some(window) = app.get_webview_window("main") {
                let monitor = window
                    .current_monitor()
                    .ok()
                    .flatten()
                    .or_else(|| app.primary_monitor().ok().flatten());

                if let Some(monitor) = monitor {
                    let monitor_size = monitor.size();
                    let monitor_pos = monitor.position();
                    let scale = monitor.scale_factor();

                    let logical_x = monitor_pos.x as f64 / scale;
                    let logical_y = monitor_pos.y as f64 / scale;
                    let logical_w = monitor_size.width as f64 / scale;
                    let logical_h = monitor_size.height as f64 / scale;

                    let _ = window.set_resizable(true);

                    // 1. Shrink first to avoid macOS constraining position
                    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
                        width: 100.0,
                        height: 100.0,
                    }));

                    // 2. Move to target position
                    let _ = window.set_position(tauri::Position::Logical(
                        tauri::LogicalPosition {
                            x: logical_x,
                            y: logical_y,
                        },
                    ));

                    // 3. Expand to fill monitor
                    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
                        width: logical_w,
                        height: logical_h,
                    }));

                    // 4. Re-set position after resize (macOS Y correction)
                    let _ = window.set_position(tauri::Position::Logical(
                        tauri::LogicalPosition {
                            x: logical_x,
                            y: logical_y,
                        },
                    ));

                    let _ = window.set_resizable(false);
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_, _| {});
}
