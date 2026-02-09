//! Model metadata and path resolution
//! Defines available Whisper models and their storage locations

use serde::Serialize;
use std::path::PathBuf;

/// Model metadata returned to frontend
#[derive(Debug, Clone, Serialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub size: u64,
    pub downloaded: bool,
}

/// Internal model definition with download info
#[derive(Debug, Clone)]
pub struct ModelDef {
    pub id: &'static str,
    pub name: &'static str,
    pub size: u64,
    pub filename: &'static str,
    pub sha256: &'static str,
}

/// Hugging Face base URL for whisper.cpp GGML models
const HF_BASE_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

/// Available Whisper GGML models
/// SHA256 checksums from Hugging Face repository
pub const WHISPER_MODELS: &[ModelDef] = &[
    ModelDef {
        id: "tiny",
        name: "Tiny",
        size: 77_704_715,
        filename: "ggml-tiny.bin",
        sha256: "be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21",
    },
    ModelDef {
        id: "tiny.en",
        name: "Tiny (English)",
        size: 77_704_715,
        filename: "ggml-tiny.en.bin",
        sha256: "921e4cf8686fdd993dcd081a5da5b6c365bfde1162e72b08d75ac75289920b1f",
    },
    ModelDef {
        id: "base",
        name: "Base",
        size: 147_964_211,
        filename: "ggml-base.bin",
        sha256: "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe",
    },
    ModelDef {
        id: "base.en",
        name: "Base (English)",
        size: 147_964_211,
        filename: "ggml-base.en.bin",
        sha256: "a03779c86df3323075f5e796b3f285183caff6c3d1016b3b70d7820fe5db71d8",
    },
    ModelDef {
        id: "small",
        name: "Small",
        size: 487_601_967,
        filename: "ggml-small.bin",
        sha256: "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b",
    },
    ModelDef {
        id: "small.en",
        name: "Small (English)",
        size: 487_601_967,
        filename: "ggml-small.en.bin",
        sha256: "20d7e4228e060834da3fc80f865448f1cfe013c00cc63c7e66c9c1f9a6c44568",
    },
    ModelDef {
        id: "medium",
        name: "Medium",
        size: 1_533_774_781,
        filename: "ggml-medium.bin",
        sha256: "6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208",
    },
    ModelDef {
        id: "medium.en",
        name: "Medium (English)",
        size: 1_533_774_781,
        filename: "ggml-medium.en.bin",
        sha256: "cbfb2c89f28ace2ad21a4cfce847f10e102cc5b8fff3caa8a1b64e21477bfa95",
    },
];

/// Get the models directory path: %APPDATA%/Draft/models
pub fn models_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Draft")
        .join("models")
}

/// Get the full path for a model file
pub fn model_path(filename: &str) -> PathBuf {
    models_dir().join(filename)
}

/// Get the temporary download path for a model
pub fn model_temp_path(filename: &str) -> PathBuf {
    models_dir().join(format!("{}.tmp", filename))
}

/// Get the download URL for a model
pub fn model_url(filename: &str) -> String {
    format!("{}/{}", HF_BASE_URL, filename)
}

/// Ensure the models directory exists
pub fn ensure_models_dir() -> Result<(), String> {
    let dir = models_dir();
    if !dir.exists() {
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create models directory: {}", e))?;
    }
    Ok(())
}

/// Remove orphaned .tmp files left by interrupted downloads
pub fn cleanup_temp_files() {
    let dir = models_dir();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("tmp") {
                log::info!("Removing orphaned temp file: {:?}", path);
                let _ = std::fs::remove_file(&path);
            }
        }
    }
}

/// Check if a model file exists
pub fn is_model_downloaded(filename: &str) -> bool {
    model_path(filename).exists()
}

/// Find a model definition by ID
pub fn find_model(id: &str) -> Option<&'static ModelDef> {
    WHISPER_MODELS.iter().find(|m| m.id == id)
}

/// Get model info for all models with download status
pub fn get_all_models() -> Vec<ModelInfo> {
    WHISPER_MODELS
        .iter()
        .map(|m| ModelInfo {
            id: m.id.to_string(),
            name: m.name.to_string(),
            size: m.size,
            downloaded: is_model_downloaded(m.filename),
        })
        .collect()
}
