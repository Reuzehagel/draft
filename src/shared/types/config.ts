// Mirrors Rust Config struct from src-tauri/src/config.rs

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
}

export const defaultConfig: Config = {
  version: 1,
  microphone_id: null,
  selected_model: null,
  hotkey: null,
  auto_start: false,
  trailing_space: false,
  logging_enabled: false,
  window_position: null,
  window_size: null,
};
