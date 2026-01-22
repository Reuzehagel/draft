//! Configuration persistence module for Draft
//! Manages loading/saving user preferences to %APPDATA%/Draft/config.json

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

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
            Ok(contents) => match serde_json::from_str(&contents) {
                Ok(config) => return config,
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
pub fn set_config(config: Config) -> Result<(), String> {
    validate_config(&config)?;
    save_config(&config)
}

#[tauri::command]
pub fn check_first_run() -> bool {
    is_first_run()
}
