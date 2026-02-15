//! Audio pipeline module for Draft
//! Handles microphone enumeration, audio capture, resampling, and amplitude calculation

mod amplitude;
mod buffer;
pub mod capture;
pub mod devices;
pub mod resampler;
pub mod worker;
