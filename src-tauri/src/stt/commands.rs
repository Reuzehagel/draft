//! Tauri commands for model management

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use super::download;
use super::models::{self, ModelInfo};

/// State for tracking active downloads
#[derive(Default)]
pub struct DownloadState {
    /// Currently downloading model ID (None if no download in progress)
    current_download: Mutex<Option<String>>,
    /// Cancellation token for active download
    cancel_token: Arc<AtomicBool>,
}

/// List all available models with download status
#[tauri::command]
pub fn list_models() -> Vec<ModelInfo> {
    models::get_all_models()
}

/// RAII guard to ensure download state is cleared on all exit paths (success, error, panic)
struct DownloadGuard<'a> {
    current_download: &'a Mutex<Option<String>>,
}

impl<'a> Drop for DownloadGuard<'a> {
    fn drop(&mut self) {
        let mut current = self.current_download.lock().unwrap();
        *current = None;
    }
}

/// Start downloading a model
#[tauri::command]
pub async fn download_model(
    app: tauri::AppHandle,
    state: tauri::State<'_, DownloadState>,
    model_id: String,
) -> Result<(), String> {
    // Check if download already in progress and set current download atomically
    {
        let mut current = state.current_download.lock().unwrap();
        if current.is_some() {
            return Err("Another download is already in progress".to_string());
        }
        *current = Some(model_id.clone());
    }

    // RAII guard ensures cleanup on all exit paths (success, error, panic, async cancellation)
    let _guard = DownloadGuard {
        current_download: &state.current_download,
    };

    // Reset cancel token
    state.cancel_token.store(false, Ordering::Relaxed);

    // Perform download - guard ensures cleanup even if this fails
    download::download_model(app, &model_id, state.cancel_token.clone()).await
}

/// Cancel the current download
#[tauri::command]
pub fn cancel_download(state: tauri::State<'_, DownloadState>) -> Result<(), String> {
    let current = state.current_download.lock().unwrap();
    if current.is_none() {
        return Err("No download in progress".to_string());
    }

    state.cancel_token.store(true, Ordering::Relaxed);
    log::info!("Cancellation requested for download");
    Ok(())
}

/// Delete a downloaded model
#[tauri::command]
pub fn delete_model(model_id: String) -> Result<(), String> {
    let model =
        models::find_model(&model_id).ok_or_else(|| format!("Unknown model: {}", model_id))?;

    let path = models::model_path(model.filename);

    if !path.exists() {
        return Err("Model not downloaded".to_string());
    }

    std::fs::remove_file(&path).map_err(|e| format!("Failed to delete model: {}", e))?;

    log::info!("Deleted model {} from {:?}", model_id, path);
    Ok(())
}
