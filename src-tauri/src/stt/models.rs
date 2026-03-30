//! Model metadata and path resolution
//! Defines available Whisper and Parakeet models and their storage locations

use serde::Serialize;
use std::path::PathBuf;

/// Engine type for a model
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Engine {
    Whisper,
    Parakeet,
}

/// Model metadata returned to frontend
#[derive(Debug, Clone, Serialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub size: u64,
    pub downloaded: bool,
    pub engine: Engine,
}

/// Internal model definition with download info
#[derive(Debug, Clone)]
pub struct ModelDef {
    pub id: &'static str,
    pub name: &'static str,
    pub size: u64,
    pub filename: &'static str,
    pub sha256: &'static str,
    pub engine: Engine,
    /// URL override (None = use HF_BASE_URL/filename)
    pub url: Option<&'static str>,
    /// Whether the download is a tar.gz archive that needs extraction
    pub is_archive: bool,
}

/// Hugging Face base URL for whisper.cpp GGML models
const HF_BASE_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

/// All available models (Whisper + Parakeet)
pub const MODELS: &[ModelDef] = &[
    ModelDef {
        id: "tiny",
        name: "Whisper Tiny",
        size: 77_704_715,
        filename: "ggml-tiny.bin",
        sha256: "be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21",
        engine: Engine::Whisper,
        url: None,
        is_archive: false,
    },
    ModelDef {
        id: "base",
        name: "Whisper Base",
        size: 147_964_211,
        filename: "ggml-base.bin",
        sha256: "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe",
        engine: Engine::Whisper,
        url: None,
        is_archive: false,
    },
    ModelDef {
        id: "small",
        name: "Whisper Small",
        size: 487_601_967,
        filename: "ggml-small.bin",
        sha256: "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b",
        engine: Engine::Whisper,
        url: None,
        is_archive: false,
    },
    ModelDef {
        id: "medium",
        name: "Whisper Medium",
        size: 1_533_774_781,
        filename: "ggml-medium.bin",
        sha256: "6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208",
        engine: Engine::Whisper,
        url: None,
        is_archive: false,
    },
    ModelDef {
        id: "parakeet-0.6b",
        name: "Parakeet 0.6B",
        size: 501_219_328,
        filename: "parakeet-tdt-0.6b-v3-int8",
        sha256: "43d37191602727524a7d8c6da0eef11c4ba24320f5b4730f1a2497befc2efa77",
        engine: Engine::Parakeet,
        url: Some("https://blob.handy.computer/parakeet-v3-int8.tar.gz"),
        is_archive: true,
    },
];

/// Get the models directory path: %APPDATA%/Draft/models
pub fn models_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Draft")
        .join("models")
}

/// Get the full path for a model file or directory
pub fn model_path(filename: &str) -> PathBuf {
    models_dir().join(filename)
}

/// Get the temporary download path for a model
pub fn model_temp_path(filename: &str) -> PathBuf {
    models_dir().join(format!("{}.tmp", filename))
}

/// Get the download URL for a model
pub fn model_url(model: &ModelDef) -> String {
    if let Some(url) = model.url {
        url.to_string()
    } else {
        format!("{}/{}", HF_BASE_URL, model.filename)
    }
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

/// Check if a model is downloaded
pub fn is_model_downloaded(model: &ModelDef) -> bool {
    let path = model_path(model.filename);
    if model.is_archive {
        path.exists() && path.is_dir()
    } else {
        path.exists() && path.is_file()
    }
}

/// Find a model definition by ID
pub fn find_model(id: &str) -> Option<&'static ModelDef> {
    MODELS.iter().find(|m| m.id == id)
}

/// Get model info for all models with download status
pub fn get_all_models() -> Vec<ModelInfo> {
    MODELS
        .iter()
        .map(|m| ModelInfo {
            id: m.id.to_string(),
            name: m.name.to_string(),
            size: m.size,
            downloaded: is_model_downloaded(m),
            engine: m.engine,
        })
        .collect()
}
