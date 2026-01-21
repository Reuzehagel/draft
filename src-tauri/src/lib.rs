//! Sprint 0 Task 0.4: Verify Tauri v2 plugins are compatible

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
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Log successful plugin initialization
            log::info!("All Tauri v2 plugins initialized successfully");
            println!("Sprint 0 Task 0.4: All plugins initialized!");
            println!("  - tauri-plugin-global-shortcut: OK");
            println!("  - tauri-plugin-notification: OK");
            println!("  - tauri-plugin-autostart: OK");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
