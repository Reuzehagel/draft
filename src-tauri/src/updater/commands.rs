use tauri::{Emitter, Manager};
use tauri_plugin_updater::UpdaterExt;

use super::state::{UpdateState, UpdateStatus};
use crate::config;
use crate::events;

/// Emit the current update status to the frontend.
fn emit_status(app: &tauri::AppHandle, status: UpdateStatus) {
    let state = app.state::<UpdateState>();
    *state.inner.lock().unwrap_or_else(|e| e.into_inner()) = status.clone();
    let _ = app.emit(events::UPDATE_STATUS, &status);
}

/// Core update check logic, callable from both the Tauri command and app startup.
pub async fn do_check_for_update(app: tauri::AppHandle) -> Result<(), String> {
    let cfg = config::load_config();
    if !cfg.auto_update_enabled {
        return Ok(());
    }

    emit_status(&app, UpdateStatus::Checking);

    let updater = app.updater().map_err(|e| e.to_string())?;
    let response = match updater.check().await {
        Ok(Some(update)) => update,
        Ok(None) => {
            emit_status(&app, UpdateStatus::Idle);
            return Ok(());
        }
        Err(e) => {
            log::error!("Update check failed: {}", e);
            emit_status(&app, UpdateStatus::Error {
                message: e.to_string(),
            });
            return Err(e.to_string());
        }
    };

    let version = response.version.clone();
    log::info!("Update available: {}", version);

    let app_handle = app.clone();
    let version_for_ready = version.clone();
    let downloaded = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));

    let result = response
        .download_and_install(
            {
                let downloaded = downloaded.clone();
                move |chunk_length, content_length| {
                    let total_downloaded = downloaded.fetch_add(chunk_length as u64, std::sync::atomic::Ordering::Relaxed) + chunk_length as u64;
                    if let Some(total) = content_length {
                        let progress = ((total_downloaded * 100) / total).min(99) as u8;
                        emit_status(&app_handle, UpdateStatus::Downloading { progress });
                    }
                }
            },
            || {
                log::info!("Update download finished");
            },
        )
        .await;

    match result {
        Ok(()) => {
            emit_status(&app, UpdateStatus::Ready {
                version: version_for_ready,
            });
            Ok(())
        }
        Err(e) => {
            log::error!("Update download/install failed: {}", e);
            emit_status(&app, UpdateStatus::Error {
                message: e.to_string(),
            });
            Err(e.to_string())
        }
    }
}

/// Check for updates and auto-download if available.
#[tauri::command]
pub async fn check_for_update(app: tauri::AppHandle) -> Result<(), String> {
    do_check_for_update(app).await
}

/// Install the downloaded update and restart the app.
#[tauri::command]
pub fn install_update(app: tauri::AppHandle) {
    app.restart();
}
