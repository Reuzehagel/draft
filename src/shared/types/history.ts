// Mirrors Rust HistoryEntry from src-tauri/src/history/db.rs

export interface HistoryEntry {
  id: number;
  created_at: string;
  raw_text: string;
  final_text: string;
  duration_ms: number;
  stt_model: string | null;
  llm_applied: boolean;
  llm_provider: string | null;
  llm_model: string | null;
  output_mode: string;
}
