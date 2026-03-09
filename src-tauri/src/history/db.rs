//! SQLite database operations for transcription history

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

/// A persisted history entry returned to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: i64,
    pub created_at: String,
    pub raw_text: String,
    pub final_text: String,
    pub duration_ms: u64,
    pub stt_model: Option<String>,
    pub llm_applied: bool,
    pub llm_provider: Option<String>,
    pub llm_model: Option<String>,
    pub output_mode: String,
}

/// Data for inserting a new history entry (id and timestamp auto-generated)
pub struct NewHistoryEntry {
    pub raw_text: String,
    pub final_text: String,
    pub duration_ms: u64,
    pub stt_model: Option<String>,
    pub llm_applied: bool,
    pub llm_provider: Option<String>,
    pub llm_model: Option<String>,
    pub output_mode: String,
}

/// Create the history table and index if they don't exist
pub fn initialize(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS history (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at  TEXT    NOT NULL,
            raw_text    TEXT    NOT NULL,
            final_text  TEXT    NOT NULL,
            duration_ms INTEGER NOT NULL,
            stt_model   TEXT,
            llm_applied INTEGER NOT NULL DEFAULT 0,
            llm_provider TEXT,
            llm_model   TEXT,
            output_mode TEXT    NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at DESC);",
    )
    .map_err(|e| format!("Failed to initialize history database: {e}"))?;
    Ok(())
}

/// Insert a new history entry and return it with its generated id and timestamp
pub fn insert(conn: &Connection, entry: NewHistoryEntry) -> Result<HistoryEntry, String> {
    conn.execute(
        "INSERT INTO history (created_at, raw_text, final_text, duration_ms, stt_model,
         llm_applied, llm_provider, llm_model, output_mode)
         VALUES (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            entry.raw_text,
            entry.final_text,
            entry.duration_ms as i64,
            entry.stt_model,
            entry.llm_applied as i32,
            entry.llm_provider,
            entry.llm_model,
            entry.output_mode,
        ],
    )
    .map_err(|e| format!("Failed to insert history entry: {e}"))?;

    let id = conn.last_insert_rowid();

    // Read back the generated timestamp
    let created_at: String = conn
        .query_row("SELECT created_at FROM history WHERE id = ?1", [id], |row| {
            row.get(0)
        })
        .map_err(|e| format!("Failed to read back inserted entry: {e}"))?;

    Ok(HistoryEntry {
        id,
        created_at,
        raw_text: entry.raw_text,
        final_text: entry.final_text,
        duration_ms: entry.duration_ms,
        stt_model: entry.stt_model,
        llm_applied: entry.llm_applied,
        llm_provider: entry.llm_provider,
        llm_model: entry.llm_model,
        output_mode: entry.output_mode,
    })
}

/// Get all history entries, newest first
pub fn get_all(conn: &Connection) -> Result<Vec<HistoryEntry>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, created_at, raw_text, final_text, duration_ms, stt_model,
                    llm_applied, llm_provider, llm_model, output_mode
             FROM history ORDER BY created_at DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {e}"))?;

    let entries = stmt
        .query_map([], |row| {
            Ok(HistoryEntry {
                id: row.get(0)?,
                created_at: row.get(1)?,
                raw_text: row.get(2)?,
                final_text: row.get(3)?,
                duration_ms: row.get::<_, i64>(4)? as u64,
                stt_model: row.get(5)?,
                llm_applied: row.get::<_, i32>(6)? != 0,
                llm_provider: row.get(7)?,
                llm_model: row.get(8)?,
                output_mode: row.get(9)?,
            })
        })
        .map_err(|e| format!("Failed to query history: {e}"))?;

    entries
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read history entries: {e}"))
}

/// Delete a single history entry by id
pub fn delete(conn: &Connection, id: i64) -> Result<(), String> {
    let affected = conn
        .execute("DELETE FROM history WHERE id = ?1", [id])
        .map_err(|e| format!("Failed to delete entry: {e}"))?;
    if affected == 0 {
        return Err(format!("Entry {id} not found"));
    }
    Ok(())
}

/// Delete all history entries
pub fn clear(conn: &Connection) -> Result<(), String> {
    conn.execute("DELETE FROM history", [])
        .map_err(|e| format!("Failed to clear history: {e}"))?;
    Ok(())
}

/// Remove oldest entries to keep total count within max_entries
pub fn prune(conn: &Connection, max_entries: u32) -> Result<(), String> {
    conn.execute(
        "DELETE FROM history WHERE id NOT IN (
            SELECT id FROM history ORDER BY created_at DESC LIMIT ?1
        )",
        [max_entries],
    )
    .map_err(|e| format!("Failed to prune history: {e}"))?;
    Ok(())
}
