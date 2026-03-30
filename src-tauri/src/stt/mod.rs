//! Speech-to-text module for model management and transcription

pub mod commands;
pub mod download;
pub mod engine;
pub mod file;
pub mod models;
pub mod online;

pub use commands::DownloadState;
pub use engine::EngineHandle;
