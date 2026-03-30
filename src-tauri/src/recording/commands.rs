//! Tauri commands for recording functionality

use std::sync::Arc;
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use super::hotkey::{validate_hotkey as validate_hotkey_impl, HotkeyManager};
use super::state::RecordingManager;
use crate::stt::EngineHandle;

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
    engine: State<'_, EngineHandle>,
) -> ConfigCheck {
    let config = crate::config::load_config();

    // Check if any microphone is available
    let microphone_available = crate::audio::devices::list_microphones()
        .map(|mics| !mics.is_empty())
        .unwrap_or(false);

    let is_online = crate::stt::online::is_online_stt(&config);

    // When online STT is active, model checks are not needed
    let model_downloaded = is_online || config
        .selected_model
        .as_ref()
        .and_then(|id| crate::stt::models::find_model(id))
        .map(|m| crate::stt::models::is_model_downloaded(m))
        .unwrap_or(false);

    ConfigCheck {
        hotkey_set: config.hotkey.is_some(),
        model_downloaded,
        model_loaded: is_online || engine.current_model().is_some(),
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

/// Respond to an LLM confirmation prompt (Y/N from the pill window)
#[tauri::command]
pub async fn llm_confirm_response(
    app: AppHandle,
    confirmed: bool,
    recording_manager: State<'_, Arc<RecordingManager>>,
) -> Result<(), String> {
    let pending = recording_manager
        .take_pending_confirmation()
        .ok_or_else(|| "No pending confirmation".to_string())?;

    // Restore focus immediately so the user can work during LLM processing.
    // The pill had focus for keyboard input; give it back now.
    if let Some(hwnd) = pending.target_window {
        let _ = app.run_on_main_thread(move || {
            let _ = crate::injection::restore_focus(hwnd);
        });
    }

    let state_data = recording_manager.state_data_arc();
    let pending_arc = recording_manager.pending_confirmation_arc();

    if confirmed {
        let _ = app.emit(crate::events::LLM_PROCESSING, ());
        super::state::execute_llm_output(&app, &state_data, &pending_arc, pending).await;
    } else {
        super::state::execute_raw_output(&app, &state_data, &pending_arc, pending).await;
    }

    Ok(())
}
