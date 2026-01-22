//! Auto-start management module for Draft
//! Handles enabling/disabling Windows startup via tauri-plugin-autostart

use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;

/// Enable auto-start on Windows login
#[tauri::command]
pub fn enable_autostart(app: AppHandle) -> Result<(), String> {
    let autostart_manager = app.autolaunch();
    autostart_manager
        .enable()
        .map_err(|e| format!("Failed to enable auto-start: {}", e))?;
    log::info!("Auto-start enabled");
    Ok(())
}

/// Disable auto-start on Windows login
#[tauri::command]
pub fn disable_autostart(app: AppHandle) -> Result<(), String> {
    let autostart_manager = app.autolaunch();
    autostart_manager
        .disable()
        .map_err(|e| format!("Failed to disable auto-start: {}", e))?;
    log::info!("Auto-start disabled");
    Ok(())
}

/// Check if auto-start is currently enabled
#[tauri::command]
pub fn is_autostart_enabled(app: AppHandle) -> Result<bool, String> {
    let autostart_manager = app.autolaunch();
    autostart_manager
        .is_enabled()
        .map_err(|e| format!("Failed to check auto-start status: {}", e))
}
