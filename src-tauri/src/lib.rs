//! Draft - Voice-to-text transcription application
//! Sprint 7: Polish & Launch

mod audio;
mod autostart;
mod config;
mod events;
mod injection;
mod recording;
mod stt;

use std::sync::Arc;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager, WebviewWindow,
};

/// Validate that window position is visible on at least one monitor.
/// Returns true if position is valid, false if off-screen.
fn is_position_on_screen(window: &WebviewWindow, x: i32, y: i32) -> bool {
    if let Ok(monitors) = window.available_monitors() {
        for monitor in monitors {
            let position = monitor.position();
            let size = monitor.size();
            let monitor_right = position.x + size.width as i32;
            let monitor_bottom = position.y + size.height as i32;

            // Check if at least 100x100 pixels of window would be visible
            if x + 100 > position.x
                && x < monitor_right
                && y + 100 > position.y
                && y < monitor_bottom
            {
                return true;
            }
        }
    }
    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Register Tauri v2 plugins
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        // Manage state for microphone testing
        .manage(audio::devices::TestState::default())
        // Manage state for model downloads
        .manage(stt::DownloadState::default())
        // Manage state for recording
        .manage(Arc::new(recording::RecordingManager::new()))
        .manage(Arc::new(recording::HotkeyManager::new()))
        // Register commands
        .invoke_handler(tauri::generate_handler![
            config::get_config,
            config::set_config,
            config::check_first_run,
            audio::devices::list_microphones,
            audio::devices::test_microphone,
            stt::commands::list_models,
            stt::commands::download_model,
            stt::commands::cancel_download,
            stt::commands::delete_model,
            stt::commands::get_whisper_state,
            stt::commands::load_model,
            stt::commands::test_transcription,
            recording::commands::validate_hotkey,
            recording::commands::register_hotkey,
            recording::commands::unregister_hotkey,
            recording::commands::check_recording_config,
            recording::commands::get_recording_state,
            autostart::enable_autostart,
            autostart::disable_autostart,
            autostart::is_autostart_enabled,
        ])
        .setup(|app| {
            // Load config early for logging and other startup configuration
            let loaded_config = config::load_config();

            // Initialize logging based on config or debug mode
            // In debug mode: always log to console
            // In release mode: log to file only if logging_enabled
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            } else if loaded_config.logging_enabled {
                // Get log file path: %APPDATA%/Draft/logs/draft.log
                let log_dir = dirs::config_dir()
                    .unwrap_or_else(|| std::path::PathBuf::from("."))
                    .join("Draft")
                    .join("logs");

                // Create logs directory if it doesn't exist
                // Note: tauri-plugin-log may also create this directory, but we do it defensively
                if !log_dir.exists() {
                    if let Err(e) = std::fs::create_dir_all(&log_dir) {
                        // Log to stderr since logging isn't set up yet
                        eprintln!("Warning: Failed to create log directory: {}. File logging may fail.", e);
                    }
                }

                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .targets([
                            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                                file_name: Some("draft".into()),
                            }),
                        ])
                        .max_file_size(5_000_000) // 5MB max per file
                        .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepOne)
                        .build(),
                )?;
            }

            // Create WhisperHandle and manage it
            let whisper_handle = stt::WhisperHandle::new(app.handle().clone());

            // Auto-load selected model on startup if it exists
            if let Some(ref model_id) = loaded_config.selected_model {
                if let Some(model) = stt::models::find_model(model_id) {
                    if stt::models::is_model_downloaded(model.filename) {
                        log::info!("Auto-loading model on startup: {}", model_id);
                        if let Err(e) = whisper_handle.load_model(model_id.clone()) {
                            log::error!("Failed to auto-load model: {}", e);
                        }
                    }
                }
            }

            app.manage(whisper_handle);

            // Register hotkey from config on startup
            if let Some(ref hotkey) = loaded_config.hotkey {
                let hotkey_manager = app.state::<Arc<recording::HotkeyManager>>();
                let recording_manager = app.state::<Arc<recording::RecordingManager>>();
                if let Err(e) = hotkey_manager.register(
                    app.handle(),
                    hotkey,
                    recording_manager.inner().clone(),
                ) {
                    log::warn!("Failed to register hotkey on startup: {}", e);
                } else {
                    log::info!("Hotkey registered on startup: {}", hotkey);
                }
            }

            // Create tray menu
            let open_settings =
                MenuItem::with_id(app, "open_settings", "Open Settings", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Exit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_settings, &quit])?;

            // Build tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Draft")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open_settings" => {
                        if let Some(window) = app.get_webview_window("settings") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("settings") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Set up settings window: restore position/size, hide on close, save on hide
            if let Some(settings_window) = app.get_webview_window("settings") {
                // Restore window position from config (if on-screen)
                if let Some((x, y)) = loaded_config.window_position {
                    if is_position_on_screen(&settings_window, x, y) {
                        let _ = settings_window.set_position(tauri::Position::Physical(
                            tauri::PhysicalPosition::new(x, y),
                        ));
                    } else {
                        log::warn!(
                            "Saved window position ({}, {}) is off-screen, using default",
                            x, y
                        );
                        let _ = settings_window.center();
                    }
                }
                // Restore window size from config
                if let Some((w, h)) = loaded_config.window_size {
                    let _ = settings_window.set_size(tauri::Size::Physical(
                        tauri::PhysicalSize::new(w, h),
                    ));
                }

                let window_clone = settings_window.clone();
                settings_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();

                        // Save window position and size before hiding
                        if let Ok(position) = window_clone.outer_position() {
                            if let Ok(size) = window_clone.outer_size() {
                                let mut current_config = config::load_config();
                                current_config.window_position = Some((position.x, position.y));
                                current_config.window_size = Some((size.width, size.height));
                                if let Err(e) = config::save_config(&current_config) {
                                    log::error!("Failed to save window position/size: {}", e);
                                }
                            }
                        }

                        let _ = window_clone.hide();
                    }
                });
            }

            // First-run: show settings immediately
            if config::is_first_run() {
                log::info!("First run detected - showing settings window");
                if let Some(window) = app.get_webview_window("settings") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }

            log::info!("Draft initialized successfully");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
