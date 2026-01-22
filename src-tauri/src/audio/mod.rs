//! Audio pipeline module for Draft
//! Handles microphone enumeration, audio capture, resampling, and amplitude calculation

mod amplitude;
mod buffer;
mod capture;
pub mod devices;
mod resampler;
mod worker;

// Commands accessed via devices:: for tauri macro
// MicrophoneInfo is serialized directly to frontend, no need to re-export
