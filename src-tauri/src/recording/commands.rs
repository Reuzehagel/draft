//! Tauri commands for recording functionality

use std::sync::Arc;
use serde::Serialize;
use tauri::{AppHandle, State};

use super::hotkey::{validate_hotkey as validate_hotkey_impl, HotkeyManager};
use super::state::RecordingManager;
use crate::stt::WhisperHandle;

/// Configuration check result
#[derive(Debug, Serialize)]
pub struct ConfigCheck {
    pub hotkey_set: bool,
    pub model_downloaded: bool,
    pub model_loaded: bool,
    pub microphone_available: bool,
}

/// Validate a hotkey string format
#[tauri::command]
pub fn validate_hotkey(hotkey: String) -> Result<(), String> {
    validate_hotkey_impl(&hotkey)
}

/// Register a hotkey for push-to-talk
#[tauri::command]
pub fn register_hotkey(
    app: AppHandle,
    hotkey: String,
    hotkey_manager: State<'_, Arc<HotkeyManager>>,
    recording_manager: State<'_, Arc<RecordingManager>>,
) -> Result<(), String> {
    hotkey_manager.register(&app, &hotkey, recording_manager.inner().clone())
}

/// Unregister the current hotkey
#[tauri::command]
pub fn unregister_hotkey(
    app: AppHandle,
    hotkey_manager: State<'_, Arc<HotkeyManager>>,
) -> Result<(), String> {
    hotkey_manager.unregister(&app)
}

/// Check if recording configuration is complete
#[tauri::command]
pub fn check_recording_config(
    whisper: State<'_, WhisperHandle>,
) -> ConfigCheck {
    let config = crate::config::load_config();

    // Check if any microphone is available
    let microphone_available = crate::audio::devices::list_microphones()
        .map(|mics| !mics.is_empty())
        .unwrap_or(false);

    // Check if a model is downloaded
    let model_downloaded = config
        .selected_model
        .as_ref()
        .and_then(|id| crate::stt::models::find_model(id))
        .map(|m| crate::stt::models::is_model_downloaded(m.filename))
        .unwrap_or(false);

    ConfigCheck {
        hotkey_set: config.hotkey.is_some(),
        model_downloaded,
        model_loaded: whisper.current_model().is_some(),
        microphone_available,
    }
}

/// Get current recording state
#[tauri::command]
pub fn get_recording_state(
    recording_manager: State<'_, Arc<RecordingManager>>,
) -> super::state::RecordingState {
    recording_manager.get_state()
}
