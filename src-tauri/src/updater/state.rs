use serde::Serialize;
use std::sync::Mutex;

/// Update lifecycle state, broadcast to frontend via `update-status` event.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum UpdateStatus {
    Idle,
    Checking,
    Downloading { progress: u8 },
    Ready { version: String },
    Error { message: String },
}

/// Tauri managed state wrapper.
#[derive(Default)]
pub struct UpdateState {
    pub inner: Mutex<UpdateStatus>,
}

impl Default for UpdateStatus {
    fn default() -> Self {
        Self::Idle
    }
}

#[tauri::command]
pub fn get_update_status(state: tauri::State<'_, UpdateState>) -> UpdateStatus {
    state.inner.lock().unwrap_or_else(|e| e.into_inner()).clone()
}
