// Mirrors Rust Config struct from src-tauri/src/config.rs

export type TextOutputMode = "inject" | "clipboard";

export interface Config {
  version: number;
  microphone_id: string | null;
  selected_model: string | null;
  hotkey: string | null;
  auto_start: boolean;
  trailing_space: boolean;
  logging_enabled: boolean;
  window_position: [number, number] | null;
  window_size: [number, number] | null;
  llm_provider: string | null;
  llm_api_key: string | null;
  llm_model: string | null;
  llm_auto_process: boolean;
  llm_system_prompt: string | null;
  text_output_mode: TextOutputMode;
  double_tap_toggle: boolean;
  llm_confirm_before_processing: boolean;
  stt_provider: string | null;
  stt_api_key: string | null;
  stt_model: string | null;
  stt_enable_diarization: boolean;
}
