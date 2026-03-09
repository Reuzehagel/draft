// Event name constants - mirrors Rust events module
// src-tauri/src/events.rs

export const AMPLITUDE = "amplitude";
export const RECORDING_STARTED = "recording-started";
export const RECORDING_STOPPED = "recording-stopped";
export const TRANSCRIPTION_COMPLETE = "transcription-complete";
export const TRANSCRIPTION_ERROR = "transcription-error";
export const DOWNLOAD_PROGRESS = "download-progress";
export const MODEL_LOADING = "model-loading";
export const MODEL_LOADED = "model-loaded";
export const TEST_MICROPHONE_COMPLETE = "test-microphone-complete";
export const LLM_PROCESSING = "llm-processing";
export const LLM_CONFIRM_REQUEST = "llm-confirm-request";
export const LLM_CONFIRM_TIMEOUT = "llm-confirm-timeout";
export const OUTPUT_COMPLETE = "output-complete";
export const FILE_TRANSCRIPTION_STARTED = "file-transcription-started";
export const FILE_DECODE_PROGRESS = "file-decode-progress";
export const FILE_TRANSCRIPTION_ERROR = "file-transcription-error";
export const FILE_TRANSCRIPTION_PROGRESS = "file-transcription-progress";
export const HISTORY_ENTRY_ADDED = "history-entry-added";
