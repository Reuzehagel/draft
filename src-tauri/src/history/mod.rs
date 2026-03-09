//! Transcription history persistence module
//! Stores completed transcriptions in a SQLite database at %APPDATA%/Draft/history.db

pub mod commands;
mod db;

pub use db::{HistoryEntry, NewHistoryEntry};

use rusqlite::Connection;
use std::sync::Mutex;

/// Manages the history database connection behind a mutex
pub struct HistoryManager {
    conn: Mutex<Connection>,
}

impl HistoryManager {
    pub fn new() -> Result<Self, String> {
        let db_path = dirs::config_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("Draft")
            .join("history.db");

        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create history directory: {e}"))?;
        }

        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open history database: {e}"))?;

        db::initialize(&conn)?;

        log::info!("History database opened at {:?}", db_path);

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Insert a new entry and auto-prune if over the limit
    pub fn insert(&self, entry: NewHistoryEntry, max_entries: u32) -> Result<HistoryEntry, String> {
        let conn = self.conn.lock().map_err(|_| "History lock poisoned")?;
        let inserted = db::insert(&conn, entry)?;
        db::prune(&conn, max_entries)?;
        Ok(inserted)
    }

    /// Get all entries, newest first
    pub fn get_all(&self) -> Result<Vec<HistoryEntry>, String> {
        let conn = self.conn.lock().map_err(|_| "History lock poisoned")?;
        db::get_all(&conn)
    }

    /// Delete a single entry by id
    pub fn delete(&self, id: i64) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|_| "History lock poisoned")?;
        db::delete(&conn, id)
    }

    /// Delete all entries
    pub fn clear(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|_| "History lock poisoned")?;
        db::clear(&conn)
    }
}
