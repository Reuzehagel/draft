//! Speech-to-text module for model management and transcription
//! Sprint 3: Model download, validation, and storage
//! Sprint 4: Whisper integration for transcription

pub mod commands;
pub mod download;
pub mod models;
pub mod whisper;

pub use commands::DownloadState;
pub use whisper::WhisperHandle;
