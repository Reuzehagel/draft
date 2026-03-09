//! Tauri commands for transcription history

use super::{HistoryEntry, HistoryManager};
use tauri::State;

#[tauri::command]
pub fn get_history(history: State<'_, HistoryManager>) -> Result<Vec<HistoryEntry>, String> {
    history.get_all()
}

#[tauri::command]
pub fn delete_history_entry(history: State<'_, HistoryManager>, id: i64) -> Result<(), String> {
    history.delete(id)
}

#[tauri::command]
pub fn clear_history(history: State<'_, HistoryManager>) -> Result<(), String> {
    history.clear()
}
