//! Recording module for hotkey-triggered push-to-talk recording
//! Manages hotkey registration, recording state, and transcription flow

pub mod commands;
pub mod hotkey;
pub mod state;

pub use hotkey::HotkeyManager;
pub use state::RecordingManager;
