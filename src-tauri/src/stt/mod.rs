//! Speech-to-text module for model management and transcription
//! Sprint 3: Model download, validation, and storage

pub mod commands;
pub mod download;
pub mod models;

pub use commands::DownloadState;
// ModelInfo is serialized directly to frontend, no need to re-export
