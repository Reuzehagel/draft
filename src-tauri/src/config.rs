//! Configuration persistence module for Draft
//! Manages loading/saving user preferences to %APPDATA%/Draft/config.json

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

/// Serializes all config write operations to prevent read-modify-write races
/// between `set_config` (frontend debounced save) and `save_window_geometry`
/// (Rust window-close handler).
static CONFIG_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub version: u32,
    pub microphone_id: Option<String>,
    pub selected_model: Option<String>,
    pub hotkey: Option<String>,
    pub auto_start: bool,
    pub trailing_space: bool,
    pub logging_enabled: bool,
    pub window_position: Option<(i32, i32)>,
    pub window_size: Option<(u32, u32)>,
    pub llm_provider: Option<String>,
    pub llm_api_key: Option<String>,
    pub llm_model: Option<String>,
    pub llm_auto_process: bool,
    pub llm_system_prompt: Option<String>,
    pub text_output_mode: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            version: 1,
            microphone_id: None,
            selected_model: None,
            hotkey: None,
            auto_start: false,
            trailing_space: false,
            logging_enabled: false,
            window_position: None,
            window_size: None,
            llm_provider: None,
            llm_api_key: None,
            llm_model: None,
            llm_auto_process: false,
            llm_system_prompt: None,
            text_output_mode: "inject".to_string(),
        }
    }
}

fn config_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Draft")
}

fn config_path() -> PathBuf {
    config_dir().join("config.json")
}

pub fn load_config() -> Config {
    let path = config_path();
    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(contents) => match serde_json::from_str::<Config>(&contents) {
                Ok(config) => {
                    if let Err(e) = validate_config(&config) {
                        log::warn!("Config validation failed, using defaults: {}", e);
                        return Config::default();
                    }
                    return config;
                }
                Err(e) => {
                    log::warn!("Failed to parse config file: {}", e);
                }
            },
            Err(e) => {
                log::warn!("Failed to read config file: {}", e);
            }
        }
    }
    Config::default()
}

pub fn save_config(config: &Config) -> Result<(), String> {
    let dir = config_dir();
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let path = config_path();
    let contents =
        serde_json::to_string_pretty(config).map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&path, contents).map_err(|e| format!("Failed to write config file: {}", e))?;

    log::info!("Config saved to {:?}", path);
    Ok(())
}

/// Save only window geometry fields without overwriting the rest of the config.
/// Acquires CONFIG_LOCK to prevent racing with `set_config`.
pub fn save_window_geometry(position: (i32, i32), size: (u32, u32)) -> Result<(), String> {
    let _lock = CONFIG_LOCK.lock().map_err(|_| "Config lock poisoned")?;
    let mut config = load_config();
    config.window_position = Some(position);
    config.window_size = Some(size);
    save_config(&config)
}

pub fn is_first_run() -> bool {
    !config_path().exists()
}

/// Validate config values are within reasonable bounds
fn validate_config(config: &Config) -> Result<(), String> {
    // Validate window position is within reasonable screen coordinates
    if let Some((x, y)) = config.window_position {
        const MAX_COORD: i32 = 10000;
        const MIN_COORD: i32 = -10000;
        if x < MIN_COORD || x > MAX_COORD || y < MIN_COORD || y > MAX_COORD {
            return Err(format!(
                "window_position ({}, {}) out of reasonable bounds ({} to {})",
                x, y, MIN_COORD, MAX_COORD
            ));
        }
    }

    // Validate window size is within reasonable bounds
    if let Some((w, h)) = config.window_size {
        const MIN_WIDTH: u32 = 200;
        const MIN_HEIGHT: u32 = 100;
        const MAX_DIMENSION: u32 = 10000;
        if w < MIN_WIDTH || w > MAX_DIMENSION {
            return Err(format!(
                "window_size width {} out of bounds ({} to {})",
                w, MIN_WIDTH, MAX_DIMENSION
            ));
        }
        if h < MIN_HEIGHT || h > MAX_DIMENSION {
            return Err(format!(
                "window_size height {} out of bounds ({} to {})",
                h, MIN_HEIGHT, MAX_DIMENSION
            ));
        }
    }

    Ok(())
}

// Tauri commands
#[tauri::command]
pub fn get_config() -> Config {
    load_config()
}

#[tauri::command]
pub fn set_config(mut config: Config) -> Result<(), String> {
    validate_config(&config)?;
    let _lock = CONFIG_LOCK.lock().map_err(|_| "Config lock poisoned")?;
    // Preserve window geometry from disk — the frontend doesn't manage these
    // fields, so its snapshot would clobber values written by save_window_geometry.
    let current = load_config();
    config.window_position = current.window_position;
    config.window_size = current.window_size;
    save_config(&config)
}

#[tauri::command]
pub fn check_first_run() -> bool {
    is_first_run()
}
