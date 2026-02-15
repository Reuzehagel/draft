//! Tauri commands for model management and transcription

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use super::download;
use super::models::{self, ModelInfo};
use super::whisper::WhisperHandle;
use crate::audio::capture::AudioCapture;
use crate::audio::worker::AudioWorker;

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
pub fn delete_model(
    model_id: String,
    whisper: tauri::State<'_, WhisperHandle>,
) -> Result<(), String> {
    let model =
        models::find_model(&model_id).ok_or_else(|| format!("Unknown model: {}", model_id))?;

    if whisper.current_model().as_deref() == Some(&model_id) {
        return Err("Cannot delete the currently loaded model. Load a different model first.".to_string());
    }

    let path = models::model_path(model.filename);

    if !path.exists() {
        return Err("Model not downloaded".to_string());
    }

    std::fs::remove_file(&path).map_err(|e| format!("Failed to delete model: {}", e))?;

    log::info!("Deleted model {} from {:?}", model_id, path);
    Ok(())
}

/// Whisper state returned to frontend
#[derive(Debug, Clone, Serialize)]
pub struct WhisperState {
    pub is_busy: bool,
    pub current_model: Option<String>,
}

/// Get current whisper state (busy status and loaded model)
#[tauri::command]
pub fn get_whisper_state(whisper: tauri::State<'_, WhisperHandle>) -> WhisperState {
    WhisperState {
        is_busy: whisper.is_busy(),
        current_model: whisper.current_model(),
    }
}

/// Load a whisper model by ID
#[tauri::command]
pub fn load_model(
    whisper: tauri::State<'_, WhisperHandle>,
    model_id: String,
) -> Result<(), String> {
    // Validate model exists
    let model = models::find_model(&model_id)
        .ok_or_else(|| format!("Unknown model: {}", model_id))?;

    // Check if model is downloaded
    if !models::is_model_downloaded(model.filename) {
        return Err(format!("Model {} is not downloaded", model_id));
    }

    // Send load command to whisper thread
    whisper.load_model(model_id)
}

/// Test transcription: record 3s of audio and transcribe it
/// Returns immediately, results come via events
#[tauri::command]
pub async fn test_transcription(
    app: AppHandle,
    whisper: tauri::State<'_, WhisperHandle>,
    device_id: Option<String>,
) -> Result<(), String> {
    // Check if whisper is busy
    if whisper.is_busy() {
        return Err("Whisper is busy".to_string());
    }

    // Check if model is loaded
    if whisper.current_model().is_none() {
        return Err("No model loaded".to_string());
    }

    // Get a clonable client for the spawned thread
    let whisper_client = whisper.client();

    // Spawn the test in a background task
    std::thread::spawn(move || {
        let result = run_test_transcription(&app, device_id.as_deref(), &whisper_client);
        if let Err(e) = result {
            log::error!("Test transcription failed: {}", e);
            let _ = app.emit(crate::events::TRANSCRIPTION_ERROR, &e);
        }
    });

    Ok(())
}

/// Internal function to run test transcription
fn run_test_transcription(
    app: &AppHandle,
    device_id: Option<&str>,
    whisper: &super::whisper::WhisperClient,
) -> Result<(), String> {
    log::info!("Starting test transcription for device: {:?}", device_id);

    // Create audio capture
    let mut capture = AudioCapture::new(device_id)?;

    // Create worker with amplitude events for visualization
    let worker = AudioWorker::new(
        capture.take_consumer()?,
        capture.sample_rate(),
        capture.channels(),
        Some(app.clone()),
        Some(capture.error_flag()),
    );

    // Start capture - if this fails, stop worker to prevent leak
    if let Err(e) = capture.start() {
        let _ = worker.stop(); // Ensure worker thread is joined
        return Err(e);
    }

    // Record for 3 seconds
    std::thread::sleep(std::time::Duration::from_secs(3));

    // Stop capture
    capture.stop();

    // Check for stream errors during recording
    if capture.has_error() {
        let _ = worker.stop(); // Ensure worker thread is joined
        return Err("Audio stream error during recording".to_string());
    }

    // Stop worker and get audio (consumes worker, joins thread)
    let audio = worker.stop();

    // Validate audio was captured
    if audio.is_empty() {
        return Err("No audio recorded".to_string());
    }

    log::info!(
        "Recorded {} samples ({:.2}s at 16kHz)",
        audio.len(),
        audio.len() as f32 / 16000.0
    );

    // Send to whisper for transcription
    let config = crate::config::load_config();
    whisper.transcribe(audio, config.whisper_initial_prompt)?;

    Ok(())
}
