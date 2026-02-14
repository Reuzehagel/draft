//! Event name constants for frontend-backend communication
//! Mirrors src/shared/constants/events.ts

pub const AMPLITUDE: &str = "amplitude";
pub const RECORDING_STARTED: &str = "recording-started";
pub const RECORDING_STOPPED: &str = "recording-stopped";
pub const TRANSCRIPTION_COMPLETE: &str = "transcription-complete";
pub const TRANSCRIPTION_ERROR: &str = "transcription-error";
pub const DOWNLOAD_PROGRESS: &str = "download-progress";
pub const MODEL_LOADING: &str = "model-loading";
pub const MODEL_LOADED: &str = "model-loaded";
pub const TEST_MICROPHONE_COMPLETE: &str = "test-microphone-complete";
pub const LLM_PROCESSING: &str = "llm-processing";
pub const LLM_CONFIRM_REQUEST: &str = "llm-confirm-request";
pub const LLM_CONFIRM_TIMEOUT: &str = "llm-confirm-timeout";
pub const OUTPUT_COMPLETE: &str = "output-complete";
