//! Audio pipeline module for Draft
//! Handles microphone enumeration, audio capture, resampling, and amplitude calculation

mod amplitude;
mod buffer;
mod capture;
pub mod devices;
mod resampler;
mod worker;

// Re-export public types (commands accessed via devices:: for tauri macro)
pub use devices::MicrophoneInfo;
