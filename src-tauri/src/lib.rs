//! Draft - Voice-to-text transcription application
//! Sprint 5: Hotkey & Recording Flow

mod audio;
mod config;
mod events;
mod recording;
mod stt;

use std::sync::Arc;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager,
};

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
        ])
        .setup(|app| {
            // Initialize logging in debug mode
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Create WhisperHandle and manage it
            let whisper_handle = stt::WhisperHandle::new(app.handle().clone());

            // Auto-load selected model on startup if it exists
            let loaded_config = config::load_config();
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

            // Set up close behavior for settings window - hide instead of close
            if let Some(settings_window) = app.get_webview_window("settings") {
                let window_clone = settings_window.clone();
                settings_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
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
