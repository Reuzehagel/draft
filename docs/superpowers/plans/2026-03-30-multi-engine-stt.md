# Multi-Engine STT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `whisper-rs` with `transcribe-rs` to support both Whisper and Parakeet 0.6B models via a unified `SpeechModel` trait, with GPU acceleration (Vulkan + DirectML) on Windows.

**Architecture:** The dedicated transcription thread keeps its existing mpsc command channel and `BusyGuard` pattern. The inner `WhisperContext` is replaced with `Box<dyn SpeechModel + Send>` from `transcribe-rs`. Model definitions expand to include Parakeet alongside Whisper. The frontend tier picker simplifies from 3 tiers to 2 (Fast/Accurate), and the English-only toggle is removed.

**Tech Stack:** `transcribe-rs` 0.3 (features: `whisper-vulkan`, `ort-directml`), Tauri v2, React 19

**Spec:** `docs/superpowers/specs/2026-03-30-multi-engine-stt-design.md`

---

### Task 1: Update Cargo Dependencies

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Replace whisper-rs with transcribe-rs**

In `src-tauri/Cargo.toml`, remove the `whisper-rs` line and add `transcribe-rs` with platform-specific features:

```toml
# Remove this line (line 47):
# whisper-rs = "0.15"

# Add after the symphonia dependency block (after line 62):
[target.'cfg(windows)'.dependencies]
transcribe-rs = { version = "0.3", features = ["whisper-vulkan", "ort-directml"] }
```

- [ ] **Step 2: Verify it compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: Compilation errors from `stt/whisper.rs` referencing `whisper_rs::*` — this is expected, we'll fix those in the next tasks.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Cargo.toml
git commit -m "deps: replace whisper-rs with transcribe-rs"
```

---

### Task 2: Expand Model Definitions

**Files:**
- Modify: `src-tauri/src/stt/models.rs`

- [ ] **Step 1: Add Engine enum and update ModelDef**

Replace the entire contents of `src-tauri/src/stt/models.rs`:

```rust
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
    // Whisper models
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
    // Parakeet model
    ModelDef {
        id: "parakeet-0.6b",
        name: "Parakeet 0.6B",
        size: 501_219_328, // ~478 MB compressed, extracts to directory
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
        // Directory models: check directory exists
        path.exists() && path.is_dir()
    } else {
        // Single-file models: check file exists
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
```

Key changes:
- Removed `.en` variants (English-only toggle is gone)
- Added `Engine` enum (`Whisper` | `Parakeet`)
- Added `url` and `is_archive` fields to `ModelDef`
- `model_url()` now takes a `&ModelDef` instead of a filename
- `is_model_downloaded()` now takes a `&ModelDef` and checks for directory existence for archive models
- `ModelInfo` includes `engine` field for the frontend
- Renamed `WHISPER_MODELS` to `MODELS`

- [ ] **Step 2: Verify it compiles (models.rs only)**

This will cause errors in files that reference `WHISPER_MODELS` or the old `model_url(filename)` signature. That's expected — we'll fix consumers in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/stt/models.rs
git commit -m "feat: expand model definitions with Engine enum and Parakeet support"
```

---

### Task 3: Update Download Logic for Archives

**Files:**
- Modify: `src-tauri/src/stt/download.rs`

- [ ] **Step 1: Update download.rs to handle tar.gz archives**

Replace the entire contents of `src-tauri/src/stt/download.rs`:

```rust
//! Model download implementation
//! Handles streaming downloads with progress, cancellation, and verification
//! Supports both single-file (Whisper GGML) and archive (Parakeet ONNX) models

use crate::events;
use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::Emitter;
use tokio::io::AsyncWriteExt;

use super::models::{ensure_models_dir, find_model, model_path, model_temp_path, model_url};

/// Progress event payload
#[derive(Clone, serde::Serialize)]
pub struct DownloadProgress {
    pub model: String,
    pub progress: u8,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
}

/// Check available disk space (returns available bytes)
fn get_available_space() -> Result<u64, String> {
    let models_dir = super::models::models_dir();
    let check_path = if models_dir.exists() {
        models_dir
    } else {
        models_dir
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| std::path::PathBuf::from("."))
    };

    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        let wide_path: Vec<u16> = check_path
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut free_bytes: u64 = 0;
        let mut total_bytes: u64 = 0;
        let mut total_free_bytes: u64 = 0;

        #[link(name = "kernel32")]
        unsafe extern "system" {
            fn GetDiskFreeSpaceExW(
                lpDirectoryName: *const u16,
                lpFreeBytesAvailableToCaller: *mut u64,
                lpTotalNumberOfBytes: *mut u64,
                lpTotalNumberOfFreeBytes: *mut u64,
            ) -> i32;
        }

        unsafe {
            if wide_path.is_empty() || wide_path.last() != Some(&0) {
                return Err("Invalid path format for disk space check".to_string());
            }

            let result = GetDiskFreeSpaceExW(
                wide_path.as_ptr(),
                &mut free_bytes,
                &mut total_bytes,
                &mut total_free_bytes,
            );

            if result == 0 {
                let error = std::io::Error::last_os_error();
                return Err(format!("Failed to get disk space: {}", error));
            }
        }

        Ok(free_bytes)
    }

    #[cfg(not(windows))]
    {
        Ok(u64::MAX)
    }
}

/// Extract a tar.gz archive to a directory
fn extract_archive(archive_path: &std::path::Path, target_dir: &std::path::Path) -> Result<(), String> {
    use std::fs;
    use std::io::Read;

    let file = fs::File::open(archive_path)
        .map_err(|e| format!("Failed to open archive: {}", e))?;

    let gz = flate2::read::GzDecoder::new(file);
    let mut archive = tar::Archive::new(gz);

    // Extract to a temporary directory first
    let extracting_dir = target_dir.with_extension("extracting");
    if extracting_dir.exists() {
        let _ = fs::remove_dir_all(&extracting_dir);
    }
    fs::create_dir_all(&extracting_dir)
        .map_err(|e| format!("Failed to create extraction directory: {}", e))?;

    archive.unpack(&extracting_dir)
        .map_err(|e| format!("Failed to extract archive: {}", e))?;

    // Check if archive contained a single subdirectory (common pattern)
    let entries: Vec<_> = fs::read_dir(&extracting_dir)
        .map_err(|e| format!("Failed to read extraction dir: {}", e))?
        .filter_map(|e| e.ok())
        .collect();

    if entries.len() == 1 && entries[0].path().is_dir() {
        // Single subdirectory: move it to the target
        let inner_dir = entries[0].path();
        if target_dir.exists() {
            let _ = fs::remove_dir_all(target_dir);
        }
        fs::rename(&inner_dir, target_dir)
            .map_err(|e| format!("Failed to move extracted directory: {}", e))?;
        let _ = fs::remove_dir_all(&extracting_dir);
    } else {
        // Multiple files: rename the extracting dir to target
        if target_dir.exists() {
            let _ = fs::remove_dir_all(target_dir);
        }
        fs::rename(&extracting_dir, target_dir)
            .map_err(|e| format!("Failed to rename extraction directory: {}", e))?;
    }

    Ok(())
}

/// Download a model with progress updates
pub async fn download_model(
    app: tauri::AppHandle,
    model_id: &str,
    cancel_token: Arc<AtomicBool>,
) -> Result<(), String> {
    let model = find_model(model_id).ok_or_else(|| format!("Unknown model: {}", model_id))?;

    ensure_models_dir()?;

    // Check disk space (model size + 100MB buffer)
    let required_space = model.size + 100 * 1024 * 1024;
    let available_space = get_available_space()?;
    if available_space < required_space {
        return Err(format!(
            "Insufficient disk space. Need {} MB, have {} MB available",
            required_space / (1024 * 1024),
            available_space / (1024 * 1024)
        ));
    }

    let url = model_url(model);
    let temp_path = model_temp_path(model.filename);
    let final_path = model_path(model.filename);

    log::info!("Starting download of {} from {}", model_id, url);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to connect: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed: HTTP {}", response.status()));
    }

    let total_bytes = response.content_length().unwrap_or(model.size);

    let mut file = tokio::fs::File::create(&temp_path)
        .await
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    let mut hasher = Sha256::new();
    let mut downloaded_bytes: u64 = 0;
    let mut last_progress: u8 = 0;

    let mut stream = response.bytes_stream();

    while let Some(chunk_result) = stream.next().await {
        if cancel_token.load(Ordering::Relaxed) {
            log::info!("Download cancelled for {}", model_id);
            drop(file);
            let _ = tokio::fs::remove_file(&temp_path).await;
            return Err("Download cancelled".to_string());
        }

        let chunk = chunk_result.map_err(|e| format!("Download error: {}", e))?;

        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write: {}", e))?;

        hasher.update(&chunk);

        downloaded_bytes += chunk.len() as u64;
        let progress = ((downloaded_bytes as f64 / total_bytes as f64) * 100.0).round().min(100.0) as u8;

        if progress != last_progress {
            last_progress = progress;
            let _ = app.emit(
                events::DOWNLOAD_PROGRESS,
                DownloadProgress {
                    model: model_id.to_string(),
                    progress,
                    downloaded_bytes,
                    total_bytes,
                },
            );
        }
    }

    file.flush()
        .await
        .map_err(|e| format!("Failed to flush: {}", e))?;
    drop(file);

    // Verify checksum
    let hash = hex::encode(hasher.finalize());
    if hash != model.sha256 {
        log::error!(
            "Checksum mismatch for {}: expected {}, got {}",
            model_id,
            model.sha256,
            hash
        );
        let _ = tokio::fs::remove_file(&temp_path).await;
        return Err("Download corrupted, please retry".to_string());
    }

    log::info!("Checksum verified for {}", model_id);

    if model.is_archive {
        // Extract archive to directory
        let temp = temp_path.clone();
        let final_dir = final_path.clone();
        tokio::task::spawn_blocking(move || extract_archive(&temp, &final_dir))
            .await
            .map_err(|e| format!("Extraction task failed: {}", e))?
            .map_err(|e| format!("Failed to extract model: {}", e))?;

        // Clean up the archive file
        let _ = tokio::fs::remove_file(&temp_path).await;
    } else {
        // Atomic rename for single-file models
        tokio::fs::rename(&temp_path, &final_path)
            .await
            .map_err(|e| format!("Failed to save model: {}", e))?;
    }

    log::info!("Successfully downloaded {} to {:?}", model_id, final_path);

    let _ = app.emit(
        events::DOWNLOAD_PROGRESS,
        DownloadProgress {
            model: model_id.to_string(),
            progress: 100,
            downloaded_bytes: total_bytes,
            total_bytes,
        },
    );

    Ok(())
}
```

Key changes:
- `model_url()` call updated to take `model` instead of `model.filename`
- Added `extract_archive()` function for tar.gz handling
- After checksum verification, archives get extracted to directory; single files get atomic rename
- Archive extraction uses a `.extracting` temp directory for safety

- [ ] **Step 2: Add tar and flate2 dependencies**

Add to `src-tauri/Cargo.toml` in the `[dependencies]` section:

```toml
# Archive extraction for ONNX model packages
tar = "0.4"
flate2 = "1.0"
```

- [ ] **Step 3: Verify download.rs compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: Still errors from whisper.rs and commands.rs — that's fine, download.rs should be clean.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/stt/download.rs
git commit -m "feat: support tar.gz archive downloads for ONNX models"
```

---

### Task 4: Replace Whisper Thread with Engine Thread

**Files:**
- Create: `src-tauri/src/stt/engine.rs`
- Delete: `src-tauri/src/stt/whisper.rs`
- Modify: `src-tauri/src/stt/mod.rs`

This is the core backend change. The dedicated thread pattern stays identical — only the inner inference call changes.

- [ ] **Step 1: Create engine.rs**

Create `src-tauri/src/stt/engine.rs`:

```rust
//! STT engine module
//! Manages speech-to-text model loading and transcription on a dedicated thread
//! Supports multiple engines (Whisper, Parakeet) via the transcribe_rs::SpeechModel trait

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};

use tauri::{AppHandle, Emitter};
use transcribe_rs::{SpeechModel, TranscribeOptions};

use super::models::{self, Engine};
use crate::events;

/// Commands sent to the engine thread
pub enum EngineCommand {
    LoadModel { model_id: String },
    Transcribe {
        audio: Vec<f32>,
        initial_prompt: Option<String>,
    },
    Shutdown,
}

/// Shared state for querying engine thread status
#[derive(Clone)]
struct SharedState {
    sender: Sender<EngineCommand>,
    is_busy: Arc<AtomicBool>,
    current_model: Arc<Mutex<Option<String>>>,
}

impl SharedState {
    fn is_busy(&self) -> bool {
        self.is_busy.load(Ordering::SeqCst)
    }

    fn current_model(&self) -> Option<String> {
        self.current_model
            .lock()
            .unwrap_or_else(|e| {
                log::warn!("Current model mutex poisoned, recovering");
                e.into_inner()
            })
            .clone()
    }

    fn send(&self, command: EngineCommand) -> Result<(), String> {
        self.sender
            .send(command)
            .map_err(|_| "Engine thread not running".to_string())
    }

    fn send_if_not_busy(&self, command: EngineCommand) -> Result<(), String> {
        if self
            .is_busy
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return Err("Engine is busy".to_string());
        }

        if let Err(_e) = self.sender.send(command) {
            self.is_busy.store(false, Ordering::SeqCst);
            return Err("Engine thread not running".to_string());
        }

        Ok(())
    }
}

/// Clonable client for sending transcription commands from other threads
#[derive(Clone)]
pub struct EngineClient(SharedState);

impl EngineClient {
    pub fn transcribe(&self, audio: Vec<f32>, initial_prompt: Option<String>) -> Result<(), String> {
        if self.0.current_model().is_none() {
            return Err("No model loaded".to_string());
        }
        self.0.send_if_not_busy(EngineCommand::Transcribe {
            audio,
            initial_prompt,
        })
    }
}

/// Handle to communicate with the engine thread
pub struct EngineHandle {
    state: SharedState,
    thread_handle: Mutex<Option<JoinHandle<()>>>,
}

impl EngineHandle {
    pub fn new(app_handle: AppHandle) -> Self {
        let (sender, receiver) = mpsc::channel::<EngineCommand>();
        let is_busy = Arc::new(AtomicBool::new(false));
        let current_model = Arc::new(Mutex::new(None));

        let is_busy_clone = is_busy.clone();
        let current_model_clone = current_model.clone();

        let thread_handle = thread::spawn(move || {
            engine_thread_main(receiver, app_handle, is_busy_clone, current_model_clone);
        });

        Self {
            state: SharedState {
                sender,
                is_busy,
                current_model,
            },
            thread_handle: Mutex::new(Some(thread_handle)),
        }
    }

    pub fn is_busy(&self) -> bool {
        self.state.is_busy()
    }

    pub fn current_model(&self) -> Option<String> {
        self.state.current_model()
    }

    pub fn load_model(&self, model_id: String) -> Result<(), String> {
        self.state
            .send_if_not_busy(EngineCommand::LoadModel { model_id })
    }

    pub fn transcribe(&self, audio: Vec<f32>, initial_prompt: Option<String>) -> Result<(), String> {
        self.client().transcribe(audio, initial_prompt)
    }

    pub fn shutdown(&self) {
        let _ = self.state.send(EngineCommand::Shutdown);

        if let Ok(mut guard) = self.thread_handle.lock() {
            if let Some(handle) = guard.take() {
                if let Err(e) = handle.join() {
                    log::error!("Engine thread panicked: {:?}", e);
                } else {
                    log::info!("Engine thread joined successfully");
                }
            }
        }
    }

    pub fn client(&self) -> EngineClient {
        EngineClient(self.state.clone())
    }
}

impl Drop for EngineHandle {
    fn drop(&mut self) {
        self.shutdown();
    }
}

/// RAII guard to clear busy flag on exit
struct BusyGuard<'a>(&'a AtomicBool);

impl<'a> BusyGuard<'a> {
    fn new(flag: &'a AtomicBool) -> Self {
        Self(flag)
    }
}

impl Drop for BusyGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

fn set_current_model(current_model: &Mutex<Option<String>>, model_id: Option<String>) {
    let mut guard = current_model.lock().unwrap_or_else(|e| {
        log::warn!("Current model mutex poisoned during set, recovering");
        e.into_inner()
    });
    *guard = model_id;
}

/// Load a SpeechModel based on model definition
fn load_speech_model(model_id: &str) -> Result<Box<dyn SpeechModel>, String> {
    let model_def =
        models::find_model(model_id).ok_or_else(|| format!("Unknown model: {}", model_id))?;

    let path = models::model_path(model_def.filename);

    if model_def.is_archive {
        if !path.exists() || !path.is_dir() {
            return Err(format!("Model directory not found: {:?}", path));
        }
    } else if !path.exists() {
        return Err(format!("Model file not found: {:?}", path));
    }

    log::info!("Loading model from {:?} (engine: {:?})", path, model_def.engine);

    match model_def.engine {
        Engine::Whisper => {
            use transcribe_rs::WhisperEngine;
            let engine = WhisperEngine::load(&path)
                .map_err(|e| format!("Failed to load Whisper model: {}", e))?;
            Ok(Box::new(engine))
        }
        Engine::Parakeet => {
            use transcribe_rs::onnx::parakeet::ParakeetModel;
            use transcribe_rs::onnx::Quantization;
            let engine = ParakeetModel::load(&path, &Quantization::Int8)
                .map_err(|e| format!("Failed to load Parakeet model: {}", e))?;
            Ok(Box::new(engine))
        }
    }
}

/// Main loop for the engine thread
fn engine_thread_main(
    receiver: mpsc::Receiver<EngineCommand>,
    app_handle: AppHandle,
    is_busy: Arc<AtomicBool>,
    current_model: Arc<Mutex<Option<String>>>,
) {
    log::info!("Engine thread started");

    let mut model: Option<Box<dyn SpeechModel>> = None;

    while let Ok(command) = receiver.recv() {
        match command {
            EngineCommand::LoadModel { model_id } => {
                let _busy = BusyGuard::new(&is_busy);
                log::info!("Loading model: {}", model_id);
                let _ = app_handle.emit(events::MODEL_LOADING, &model_id);

                match load_speech_model(&model_id) {
                    Ok(m) => {
                        model = Some(m);
                        set_current_model(&current_model, Some(model_id.clone()));
                        log::info!("Model loaded successfully: {}", model_id);
                        let _ = app_handle.emit(events::MODEL_LOADED, &model_id);
                    }
                    Err(e) => {
                        log::error!("Failed to load model {}: {}", model_id, e);
                        let _ = app_handle.emit(events::TRANSCRIPTION_ERROR, &e);
                    }
                }
            }

            EngineCommand::Transcribe {
                audio,
                initial_prompt,
            } => {
                let _busy = BusyGuard::new(&is_busy);

                if audio.is_empty() {
                    log::warn!("Received empty audio for transcription");
                    let _ = app_handle.emit(events::TRANSCRIPTION_COMPLETE, "");
                    continue;
                }

                if audio.len() < 1600 {
                    log::warn!(
                        "Very short audio: {} samples ({:.2}s)",
                        audio.len(),
                        audio.len() as f32 / 16000.0
                    );
                }

                log::info!(
                    "Starting transcription with {} samples ({:.2}s)",
                    audio.len(),
                    audio.len() as f32 / 16000.0
                );

                let start_time = std::time::Instant::now();

                let result = model
                    .as_mut()
                    .ok_or_else(|| "No model loaded".to_string())
                    .and_then(|m| {
                        let mut options = TranscribeOptions::default();
                        // initial_prompt is Whisper-specific — TranscribeOptions
                        // does not have it, so we log and move on.
                        // Future: transcribe_rs may add engine-specific options.
                        if initial_prompt.is_some() {
                            log::debug!("Initial prompt set but not supported by transcribe-rs trait; ignored for non-Whisper engines");
                        }
                        m.transcribe_raw(&audio, &options)
                            .map(|r| r.text)
                            .map_err(|e| format!("Transcription failed: {}", e))
                    });

                log::info!("Transcription took {:?}", start_time.elapsed());

                match result {
                    Ok(text) => {
                        let text = text.trim().to_string();
                        log::info!("Transcription complete: {:?}", text);
                        let _ = app_handle.emit(events::TRANSCRIPTION_COMPLETE, &text);
                    }
                    Err(e) => {
                        log::error!("Transcription failed: {}", e);
                        let _ = app_handle.emit(events::TRANSCRIPTION_ERROR, &e);
                    }
                }
            }

            EngineCommand::Shutdown => {
                log::info!("Engine thread shutting down");
                break;
            }
        }
    }

    log::info!("Engine thread exiting");
}
```

Key differences from whisper.rs:
- `WhisperContext` replaced with `Box<dyn SpeechModel>`
- `load_speech_model()` dispatches to `WhisperEngine::load()` or `ParakeetModel::load()` based on engine type
- `run_transcription()` replaced with `model.transcribe_raw(&audio, &options)` one-liner
- Removed cancel_token and progress_handle from Transcribe command (transcribe-rs trait doesn't support them)
- `initial_prompt` is logged but not passed through (Whisper-specific, not in the trait)
- All naming changed from Whisper* to Engine*

**Note on initial_prompt:** The `transcribe_rs::TranscribeOptions` does not include `initial_prompt`. For Whisper models, this means we lose the initial prompt feature. If this is important, we can later downcast to `WhisperEngine` and use `transcribe_with()` directly. For now, we accept this tradeoff.

**Note on cancel_token/progress:** The `SpeechModel::transcribe_raw` trait method does not accept cancel tokens or progress callbacks. File transcription progress reporting (`FILE_TRANSCRIPTION_PROGRESS`) will no longer emit during whisper inference — only the decode progress will report. This was called out in the spec as acceptable.

- [ ] **Step 2: Update mod.rs**

Replace the contents of `src-tauri/src/stt/mod.rs`:

```rust
//! Speech-to-text module for model management and transcription

pub mod commands;
pub mod download;
pub mod engine;
pub mod file;
pub mod models;
pub mod online;

pub use commands::DownloadState;
pub use engine::EngineHandle;
```

- [ ] **Step 3: Delete whisper.rs**

```bash
rm src-tauri/src/stt/whisper.rs
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/stt/engine.rs src-tauri/src/stt/mod.rs
git rm src-tauri/src/stt/whisper.rs
git commit -m "feat: replace WhisperHandle with EngineHandle using transcribe-rs SpeechModel trait"
```

---

### Task 5: Update STT Commands

**Files:**
- Modify: `src-tauri/src/stt/commands.rs`

- [ ] **Step 1: Update commands.rs to use EngineHandle**

Replace the entire contents of `src-tauri/src/stt/commands.rs`:

```rust
//! Tauri commands for model management and transcription

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use super::download;
use super::engine::EngineHandle;
use super::models::{self, ModelInfo};
use crate::audio::capture::AudioCapture;
use crate::audio::worker::AudioWorker;

/// State for tracking active downloads
#[derive(Default)]
pub struct DownloadState {
    current_download: Mutex<Option<String>>,
    cancel_token: Arc<AtomicBool>,
}

/// List all available models with download status
#[tauri::command]
pub fn list_models() -> Vec<ModelInfo> {
    models::get_all_models()
}

/// RAII guard to ensure download state is cleared on all exit paths
struct DownloadGuard<'a> {
    current_download: &'a Mutex<Option<String>>,
}

impl<'a> Drop for DownloadGuard<'a> {
    fn drop(&mut self) {
        let mut current = self.current_download.lock().unwrap();
        *current = None;
    }
}

/// Start downloading a model
#[tauri::command]
pub async fn download_model(
    app: tauri::AppHandle,
    state: tauri::State<'_, DownloadState>,
    model_id: String,
) -> Result<(), String> {
    {
        let mut current = state.current_download.lock().unwrap();
        if current.is_some() {
            return Err("Another download is already in progress".to_string());
        }
        *current = Some(model_id.clone());
    }

    let _guard = DownloadGuard {
        current_download: &state.current_download,
    };

    state.cancel_token.store(false, Ordering::Relaxed);

    download::download_model(app, &model_id, state.cancel_token.clone()).await
}

/// Cancel the current download
#[tauri::command]
pub fn cancel_download(state: tauri::State<'_, DownloadState>) -> Result<(), String> {
    let current = state.current_download.lock().unwrap();
    if current.is_none() {
        return Err("No download in progress".to_string());
    }

    state.cancel_token.store(true, Ordering::Relaxed);
    log::info!("Cancellation requested for download");
    Ok(())
}

/// Delete a downloaded model
#[tauri::command]
pub fn delete_model(
    model_id: String,
    engine: tauri::State<'_, EngineHandle>,
) -> Result<(), String> {
    let model =
        models::find_model(&model_id).ok_or_else(|| format!("Unknown model: {}", model_id))?;

    if engine.current_model().as_deref() == Some(&model_id) {
        return Err("Cannot delete the currently loaded model. Load a different model first.".to_string());
    }

    let path = models::model_path(model.filename);

    if model.is_archive {
        if !path.exists() || !path.is_dir() {
            return Err("Model not downloaded".to_string());
        }
        std::fs::remove_dir_all(&path).map_err(|e| format!("Failed to delete model: {}", e))?;
    } else {
        if !path.exists() {
            return Err("Model not downloaded".to_string());
        }
        std::fs::remove_file(&path).map_err(|e| format!("Failed to delete model: {}", e))?;
    }

    log::info!("Deleted model {} from {:?}", model_id, path);
    Ok(())
}

/// Engine state returned to frontend
#[derive(Debug, Clone, Serialize)]
pub struct EngineState {
    pub is_busy: bool,
    pub current_model: Option<String>,
}

/// Get current engine state (busy status and loaded model)
#[tauri::command]
pub fn get_whisper_state(engine: tauri::State<'_, EngineHandle>) -> EngineState {
    EngineState {
        is_busy: engine.is_busy(),
        current_model: engine.current_model(),
    }
}

/// Load a model by ID
#[tauri::command]
pub fn load_model(
    engine: tauri::State<'_, EngineHandle>,
    model_id: String,
) -> Result<(), String> {
    let model = models::find_model(&model_id)
        .ok_or_else(|| format!("Unknown model: {}", model_id))?;

    if !models::is_model_downloaded(model) {
        return Err(format!("Model {} is not downloaded", model_id));
    }

    engine.load_model(model_id)
}

/// Test transcription: record 3s of audio and transcribe it
#[tauri::command]
pub async fn test_transcription(
    app: AppHandle,
    engine: tauri::State<'_, EngineHandle>,
    device_id: Option<String>,
) -> Result<(), String> {
    if engine.is_busy() {
        return Err("Engine is busy".to_string());
    }

    if engine.current_model().is_none() {
        return Err("No model loaded".to_string());
    }

    let engine_client = engine.client();

    std::thread::spawn(move || {
        let result = run_test_transcription(&app, device_id.as_deref(), &engine_client);
        if let Err(e) = result {
            log::error!("Test transcription failed: {}", e);
            let _ = app.emit(crate::events::TRANSCRIPTION_ERROR, &e);
        }
    });

    Ok(())
}

/// Internal function to run test transcription
fn run_test_transcription(
    app: &AppHandle,
    device_id: Option<&str>,
    engine: &super::engine::EngineClient,
) -> Result<(), String> {
    log::info!("Starting test transcription for device: {:?}", device_id);

    let mut capture = AudioCapture::new(device_id)?;

    let worker = AudioWorker::new(
        capture.take_consumer()?,
        capture.sample_rate(),
        capture.channels(),
        Some(app.clone()),
        Some(capture.error_flag()),
    );

    if let Err(e) = capture.start() {
        let _ = worker.stop();
        return Err(e);
    }

    std::thread::sleep(std::time::Duration::from_secs(3));

    capture.stop();

    if capture.has_error() {
        let _ = worker.stop();
        return Err("Audio stream error during recording".to_string());
    }

    let audio = worker.stop();

    if audio.is_empty() {
        return Err("No audio recorded".to_string());
    }

    log::info!(
        "Recorded {} samples ({:.2}s at 16kHz)",
        audio.len(),
        audio.len() as f32 / 16000.0
    );

    let config = crate::config::load_config();
    engine.transcribe(audio, config.whisper_initial_prompt)?;

    Ok(())
}
```

Key changes from original:
- `WhisperHandle` → `EngineHandle` in all State types
- `WhisperClient` → `EngineClient`
- `WhisperState` → `EngineState` (but `get_whisper_state` command name stays the same to avoid frontend changes in this task)
- `delete_model` handles both file and directory deletion
- `is_model_downloaded` now passes `model` reference instead of `model.filename`

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/stt/commands.rs
git commit -m "refactor: update STT commands to use EngineHandle"
```

---

### Task 6: Update File Transcription

**Files:**
- Modify: `src-tauri/src/stt/file.rs`

- [ ] **Step 1: Replace WhisperHandle references with EngineHandle**

In `src-tauri/src/stt/file.rs`, make these replacements:

Replace line 20:
```rust
// Old:
use super::whisper::WhisperHandle;
// New:
use super::engine::EngineHandle;
```

Replace line 177 (the `transcribe_file` command signature):
```rust
// Old:
    whisper: tauri::State<'_, WhisperHandle>,
// New:
    engine: tauri::State<'_, EngineHandle>,
```

Replace lines 190-194 (local whisper checks):
```rust
// Old:
        if whisper.is_busy() {
            return Err("Whisper is busy".to_string());
        }
        if whisper.current_model().is_none() {
            return Err("No model loaded".to_string());
        }
// New:
        if engine.is_busy() {
            return Err("Engine is busy".to_string());
        }
        if engine.current_model().is_none() {
            return Err("No model loaded".to_string());
        }
```

Replace lines 221-226 (local whisper path):
```rust
// Old:
        let whisper_client = whisper.client();
        let cancel = cancel_token.clone();
        let file_state_inner = file_state.inner().clone();

        std::thread::spawn(move || {
            let result = run_local_file_transcription(&app, &path, &cancel, &whisper_client);
// New:
        let engine_client = engine.client();
        let cancel = cancel_token.clone();
        let file_state_inner = file_state.inner().clone();

        std::thread::spawn(move || {
            let result = run_local_file_transcription(&app, &path, &cancel, &engine_client);
```

Replace lines 240-256 (`run_local_file_transcription`):
```rust
// Old:
fn run_local_file_transcription(
    app: &AppHandle,
    path: &str,
    cancel_token: &Arc<AtomicBool>,
    whisper_client: &super::whisper::WhisperClient,
) -> Result<(), String> {
    let audio = decode_audio_file(path, app, Some(cancel_token))?;

    if audio.is_empty() {
        return Err("No audio decoded from file".to_string());
    }

    let _ = app.emit(events::FILE_TRANSCRIPTION_STARTED, ());

    whisper_client.transcribe_file(audio, cancel_token.clone(), app.clone())?;
    Ok(())
}
// New:
fn run_local_file_transcription(
    app: &AppHandle,
    path: &str,
    cancel_token: &Arc<AtomicBool>,
    engine_client: &super::engine::EngineClient,
) -> Result<(), String> {
    let audio = decode_audio_file(path, app, Some(cancel_token))?;

    if audio.is_empty() {
        return Err("No audio decoded from file".to_string());
    }

    let _ = app.emit(events::FILE_TRANSCRIPTION_STARTED, ());

    engine_client.transcribe(audio, None)?;
    Ok(())
}
```

Note: `transcribe_file` on the old `WhisperClient` passed cancel_token and progress_handle. The new `EngineClient::transcribe` doesn't support these — per the spec, file transcription progress during inference won't report incrementally.

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/stt/file.rs
git commit -m "refactor: update file transcription to use EngineHandle"
```

---

### Task 7: Update Recording State and App Setup

**Files:**
- Modify: `src-tauri/src/recording/state.rs`
- Modify: `src-tauri/src/recording/commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Update recording/state.rs**

Replace the import at line 15:
```rust
// Old:
use crate::stt::WhisperHandle;
// New:
use crate::stt::EngineHandle;
```

Find all occurrences of `WhisperHandle` in state.rs and replace with `EngineHandle`. There should be references in:
- The `start_key_press` method (checking `app.state::<WhisperHandle>()`)
- The `stop_and_transcribe` method (calling `app.state::<WhisperHandle>().transcribe()`)

Replace each:
```rust
// Old:
let whisper = app.state::<WhisperHandle>();
// New:
let engine = app.state::<EngineHandle>();
```

And update the method calls:
```rust
// Old:
if whisper.is_busy() {
    return Err("Cannot start recording: whisper is busy".to_string());
}
// New:
if engine.is_busy() {
    return Err("Cannot start recording: engine is busy".to_string());
}
```

```rust
// Old:
if let Err(e) = whisper.transcribe(audio, config.whisper_initial_prompt.clone()) {
// New:
if let Err(e) = engine.transcribe(audio, config.whisper_initial_prompt.clone()) {
```

- [ ] **Step 2: Update recording/commands.rs**

Replace the import and all `WhisperHandle` references with `EngineHandle`:

```rust
// Old (in check_recording_config and related):
use crate::stt::WhisperHandle;
// ...
whisper: tauri::State<'_, WhisperHandle>,
// New:
use crate::stt::EngineHandle;
// ...
engine: tauri::State<'_, EngineHandle>,
```

Update all method calls from `whisper.` to `engine.` in the same file.

- [ ] **Step 3: Update lib.rs**

In `src-tauri/src/lib.rs`, update the WhisperHandle creation and management.

Replace the import (around line 15 area, wherever `WhisperHandle` is imported):
```rust
// The re-export from stt/mod.rs changed from WhisperHandle to EngineHandle
```

Replace the handle creation (around line 196):
```rust
// Old:
let whisper_handle = stt::WhisperHandle::new(app.handle().clone());
// New:
let engine_handle = stt::EngineHandle::new(app.handle().clone());
```

Replace the auto-load block (around lines 198-208):
```rust
// Old:
if let Some(ref model_id) = loaded_config.selected_model {
    if let Some(model) = stt::models::find_model(model_id) {
        if stt::models::is_model_downloaded(model.filename) {
            log::info!("Auto-loading model on startup: {}", model_id);
            if let Err(e) = whisper_handle.load_model(model_id.clone()) {
                log::error!("Failed to auto-load model: {}", e);
            }
        }
    }
}

app.manage(whisper_handle);
// New:
if let Some(ref model_id) = loaded_config.selected_model {
    if let Some(model) = stt::models::find_model(model_id) {
        if stt::models::is_model_downloaded(model) {
            log::info!("Auto-loading model on startup: {}", model_id);
            if let Err(e) = engine_handle.load_model(model_id.clone()) {
                log::error!("Failed to auto-load model: {}", e);
            }
        }
    }
}

app.manage(engine_handle);
```

Note: `is_model_downloaded` now takes `model` (the `&ModelDef`), not `model.filename`.

- [ ] **Step 4: Build and verify**

Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: Should compile. If there are import path issues for `transcribe_rs::onnx::parakeet::ParakeetModel` or `transcribe_rs::WhisperEngine`, check the actual crate re-exports and adjust.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/recording/state.rs src-tauri/src/recording/commands.rs src-tauri/src/lib.rs
git commit -m "refactor: update recording flow and app setup to use EngineHandle"
```

---

### Task 8: Update Frontend Tier Config

**Files:**
- Modify: `src/settings/components/models/tierConfig.ts`

- [ ] **Step 1: Simplify to 2 tiers, remove English-only helpers**

Replace the entire contents of `src/settings/components/models/tierConfig.ts`:

```typescript
// Tier-based model picker configuration
// Maps 2 user-facing tiers to model IDs

export interface Tier {
  id: string;
  label: string;
  description: string;
  detail: string;
  modelId: string;
}

export const TIERS: Tier[] = [
  {
    id: "fast",
    label: "Fast",
    description: "Lowest latency",
    detail: "~1 GB RAM, best for quick notes",
    modelId: "base",
  },
  {
    id: "accurate",
    label: "Accurate",
    description: "Best quality",
    detail: "~2 GB RAM, near Whisper Large accuracy",
    modelId: "parakeet-0.6b",
  },
];

/** Derive tier from a model ID. Returns null for models not in a tier. */
export function getTierFromModelId(modelId: string): Tier | null {
  return TIERS.find((t) => t.modelId === modelId) ?? null;
}
```

Key changes:
- 3 tiers → 2 (Fast + Accurate)
- `baseModelId` renamed to `modelId` (no language suffix logic needed)
- Removed `isEnglishOnly()` and `getModelId()` functions
- Accurate tier points to `parakeet-0.6b`

- [ ] **Step 2: Commit**

```bash
git add src/settings/components/models/tierConfig.ts
git commit -m "feat: simplify tier config to Fast (Whisper Base) and Accurate (Parakeet 0.6B)"
```

---

### Task 9: Update Frontend TierPicker Component

**Files:**
- Modify: `src/settings/components/models/TierPicker.tsx`

- [ ] **Step 1: Update TierPicker for 2-column layout**

Replace the entire contents of `src/settings/components/models/TierPicker.tsx`:

```tsx
import { TIERS, type Tier } from "./tierConfig";

interface TierPickerProps {
  activeTierId: string | null;
  onSelect: (tier: Tier) => void;
}

export function TierPicker({ activeTierId, onSelect }: TierPickerProps): React.ReactNode {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {TIERS.map((tier) => {
        const isSelected = activeTierId === tier.id;
        return (
          <button
            key={tier.id}
            onClick={() => onSelect(tier)}
            className={`
              rounded-lg border px-4 py-3 text-left transition-all duration-150
              ${isSelected
                ? "border-primary bg-primary/8 ring-2 ring-primary/20"
                : "border-border/60 bg-card/80 hover:border-border hover:bg-muted/50"
              }
            `}
          >
            <div className="text-sm font-medium text-foreground">{tier.label}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{tier.description}</div>
            <div className="text-[10px] text-muted-foreground/60 mt-0.5">{tier.detail}</div>
          </button>
        );
      })}
    </div>
  );
}
```

Only change: `grid-cols-3` → `grid-cols-2`.

- [ ] **Step 2: Commit**

```bash
git add src/settings/components/models/TierPicker.tsx
git commit -m "ui: update tier picker to 2-column layout"
```

---

### Task 10: Update ModelsCard (Remove English Toggle, Simplify Tier Logic)

**Files:**
- Modify: `src/settings/components/ModelsCard.tsx`

- [ ] **Step 1: Simplify ModelsCard**

Replace the entire contents of `src/settings/components/ModelsCard.tsx`:

```tsx
import { useState, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Package01Icon } from "@hugeicons/core-free-icons";
import { Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import type { ModelInfo, DownloadProgress } from "@/shared/types/models";
import type { Config } from "@/shared/types/config";
import { WaveformBars } from "@/components/WaveformBars";
import { SettingsCard } from "./SettingsCard";
import { ErrorMessage } from "./ErrorMessage";
import { TierPicker } from "./models/TierPicker";
import { ModelStatusArea } from "./models/ModelStatusArea";
import { AllModelsCollapsible } from "./models/AllModelsCollapsible";
import { ModelItem } from "./models/ModelItem";
import { DownloadableModel } from "./models/DownloadableModel";
import { TIERS, getTierFromModelId, type Tier } from "./models/tierConfig";

interface ModelsCardProps {
  config: Config | null;
  updateConfig: (patch: Partial<Config>) => void;
  models: ModelInfo[];
  downloadedModels: ModelInfo[];
  availableModels: ModelInfo[];
  modelsLoading: boolean;
  isDownloading: boolean;
  downloadProgress: DownloadProgress | null;
  downloadModel: (modelId: string) => Promise<void>;
  cancelDownload: () => Promise<void>;
  deleteModel: (modelId: string) => Promise<void>;
  isModelLoading: boolean;
  loadedModel: string | null;
  isTranscribing: boolean;
  transcriptionResult: string | null;
  transcriptionError: string | null;
  whisperAmplitudes: number[];
  testTranscription: (deviceId: string | null) => void;
  whisperBusy: boolean;
  isTesting: boolean;
}

export function ModelsCard({
  config,
  updateConfig,
  models,
  downloadedModels,
  availableModels,
  modelsLoading,
  isDownloading,
  downloadProgress,
  downloadModel,
  cancelDownload,
  deleteModel,
  isModelLoading,
  loadedModel,
  isTranscribing,
  transcriptionResult,
  transcriptionError,
  whisperAmplitudes,
  testTranscription,
  whisperBusy,
  isTesting,
}: ModelsCardProps) {
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Pending tier: selected a tier whose model isn't downloaded yet
  const [pendingTierId, setPendingTierId] = useState<string | null>(null);

  // Track previous config.selected_model to detect external changes
  const prevSelectedModelRef = useRef(config?.selected_model);

  // Detect external config changes and sync local state
  const selectedModel = config?.selected_model;
  if (selectedModel !== prevSelectedModelRef.current) {
    prevSelectedModelRef.current = selectedModel;
    if (selectedModel) {
      const tier = getTierFromModelId(selectedModel);
      if (tier && pendingTierId) {
        setPendingTierId(null);
      }
    }
  }

  // Derive active tier from pending or config
  let activeTier: Tier | null = null;
  if (pendingTierId) {
    activeTier = TIERS.find((t) => t.id === pendingTierId) ?? null;
  } else if (config?.selected_model) {
    activeTier = getTierFromModelId(config.selected_model);
  }

  // The effective model ID based on tier
  const effectiveModelId = activeTier?.modelId ?? null;
  const effectiveModel = effectiveModelId
    ? models.find((m) => m.id === effectiveModelId)
    : undefined;

  // Auto-select in config when pending tier's model finishes downloading
  if (pendingTierId && effectiveModelId && effectiveModel?.downloaded) {
    updateConfig({ selected_model: effectiveModelId });
    setPendingTierId(null);
  }

  const handleTierSelect = (tier: Tier) => {
    const model = models.find((m) => m.id === tier.modelId);
    if (model?.downloaded) {
      setPendingTierId(null);
      updateConfig({ selected_model: tier.modelId });
    } else {
      setPendingTierId(tier.id);
    }
  };

  const handleDownload = async (modelId: string) => {
    setDownloadError(null);
    try {
      await downloadModel(modelId);
    } catch (e) {
      setDownloadError(String(e));
    }
  };

  const handleDelete = async (modelId: string) => {
    setDeleteError(null);
    try {
      await deleteModel(modelId);
      if (config?.selected_model === modelId) {
        updateConfig({ selected_model: null });
      }
    } catch (e) {
      setDeleteError(String(e));
    }
  };

  let description: string;
  if (isModelLoading) {
    description = "Loading model...";
  } else if (loadedModel) {
    const loadedName = downloadedModels.find((m) => m.id === loadedModel)?.name ?? loadedModel;
    description = `Active: ${loadedName}`;
  } else {
    description = "Select a transcription model";
  }

  let testButtonLabel: string;
  if (isTranscribing) {
    testButtonLabel = "Recording (3s)...";
  } else if (isModelLoading) {
    testButtonLabel = "Loading...";
  } else {
    testButtonLabel = "Test Transcription (3s)";
  }

  return (
    <SettingsCard
      title="Models"
      description={description}
      icon={<HugeiconsIcon icon={Package01Icon} size={16} />}
    >
        {modelsLoading ? (
          <div className="py-4 flex items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground" role="status" aria-live="polite">
              <Spinner size={16} />
              <span className="text-sm">Loading models...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Tier Picker */}
            <TierPicker activeTierId={activeTier?.id ?? null} onSelect={handleTierSelect} />

            {/* Model Status */}
            <ModelStatusArea
              effectiveModel={effectiveModel}
              isLoaded={loadedModel === effectiveModelId}
              isModelLoading={isModelLoading}
              isDownloading={isDownloading}
              downloadProgress={downloadProgress}
              onDownload={() => effectiveModelId && handleDownload(effectiveModelId)}
              onCancel={cancelDownload}
            />

            {/* All Models + Test Transcription (collapsible) */}
            <AllModelsCollapsible>
              {downloadedModels.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Downloaded
                  </p>
                  <div className="space-y-1 -mx-1">
                    {downloadedModels.map((model) => (
                      <ModelItem
                        key={model.id}
                        name={model.name}
                        size={model.size}
                        isSelected={config?.selected_model === model.id}
                        isLoaded={loadedModel === model.id}
                        onSelect={() => updateConfig({ selected_model: model.id })}
                        onDelete={() => handleDelete(model.id)}
                        disabled={whisperBusy || isDownloading}
                      />
                    ))}
                  </div>
                </div>
              )}

              {availableModels.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Available to Download
                  </p>
                  <div className="space-y-1 -mx-1">
                    {availableModels.map((model) => {
                      const isThisDownloading = downloadProgress?.model === model.id;
                      return (
                        <DownloadableModel
                          key={model.id}
                          name={model.name}
                          size={model.size}
                          isDownloading={isThisDownloading}
                          progress={isThisDownloading ? downloadProgress?.progress ?? null : null}
                          onDownload={() => handleDownload(model.id)}
                          onCancel={cancelDownload}
                          disabled={isDownloading && !isThisDownloading}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Test Transcription */}
              {downloadedModels.length > 0 && (
                <div className="pt-1 border-t border-border/40">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={whisperBusy || !loadedModel || isTesting}
                      onClick={() => testTranscription(config?.microphone_id ?? null)}
                    >
                      {testButtonLabel}
                    </Button>
                    {isTranscribing && <WaveformBars amplitudes={whisperAmplitudes} />}
                  </div>
                  {transcriptionResult !== null && (
                    <div className="mt-3 p-2.5 rounded-md bg-muted/50 border border-border/40" role="status" aria-live="polite">
                      <p className="text-sm">
                        {transcriptionResult || <span className="text-muted-foreground italic">(no speech detected)</span>}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </AllModelsCollapsible>

            {/* Errors */}
            {(downloadError || deleteError || transcriptionError) && (
              <div className="space-y-1">
                {[downloadError, deleteError, transcriptionError].filter(Boolean).map((error, i) => (
                  <ErrorMessage key={i} message={error!} />
                ))}
              </div>
            )}
          </div>
        )}
    </SettingsCard>
  );
}
```

Key changes:
- Removed `localEnglish` state and `handleEnglishToggle`
- Removed English-only `<Switch>` from the JSX
- Removed `getModelId` and `isEnglishOnly` imports
- `effectiveModelId` is now just `activeTier?.modelId` (no language suffix)
- `handleTierSelect` uses `tier.modelId` directly

- [ ] **Step 2: Commit**

```bash
git add src/settings/components/ModelsCard.tsx
git commit -m "ui: remove English-only toggle, simplify tier selection logic"
```

---

### Task 11: Update Frontend Model Types

**Files:**
- Modify: `src/shared/types/models.ts`

- [ ] **Step 1: Add engine field to ModelInfo**

Replace the `ModelInfo` interface in `src/shared/types/models.ts`:

```typescript
// Model types - mirrors Rust stt::models module

export interface ModelInfo {
  id: string;
  name: string;
  size: number;
  downloaded: boolean;
  engine: "whisper" | "parakeet";
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/types/models.ts
git commit -m "types: add engine field to ModelInfo"
```

---

### Task 12: Update ModelsPage (Engine Label)

**Files:**
- Modify: `src/settings/pages/ModelsPage.tsx`

- [ ] **Step 1: Update engine selector label**

In `src/settings/pages/ModelsPage.tsx`, update line 95 to change the local engine label:

```typescript
// Old:
  const engineItems = [
    { label: "Local (Whisper)", value: "local" },
    ...STT_PROVIDERS.map((p) => ({ label: p.label, value: p.value })),
  ];
// New:
  const engineItems = [
    { label: "Local", value: "local" },
    ...STT_PROVIDERS.map((p) => ({ label: p.label, value: p.value })),
  ];
```

Also update the Whisper Prompt card title and description (lines 189-200) since it now applies to Whisper models only, not Parakeet:

```tsx
// Old:
          <SettingsCard title="Whisper Prompt" description="Guide transcription style and vocabulary">
            <Textarea
              value={config?.whisper_initial_prompt || ""}
              onChange={(e) => updateConfig({ whisper_initial_prompt: e.target.value || null })}
              placeholder="e.g. Draft, Tauri, React. Use proper punctuation and capitalization."
              rows={2}
              className="text-[13px] min-h-[48px] resize-y"
            />
            <p className="text-xs text-muted-foreground">
              Helps Whisper with domain terms, spelling, and formatting preferences
            </p>
          </SettingsCard>
// New:
          <SettingsCard title="Whisper Prompt" description="Only applies to Whisper models">
            <Textarea
              value={config?.whisper_initial_prompt || ""}
              onChange={(e) => updateConfig({ whisper_initial_prompt: e.target.value || null })}
              placeholder="e.g. Draft, Tauri, React. Use proper punctuation and capitalization."
              rows={2}
              className="text-[13px] min-h-[48px] resize-y"
            />
            <p className="text-xs text-muted-foreground">
              Helps Whisper with domain terms, spelling, and formatting preferences. Has no effect on Parakeet.
            </p>
          </SettingsCard>
```

- [ ] **Step 2: Commit**

```bash
git add src/settings/pages/ModelsPage.tsx
git commit -m "ui: update engine label and whisper prompt description"
```

---

### Task 13: Build, Test, and Verify

**Files:** None (verification only)

- [ ] **Step 1: Run frontend lint**

Run: `cd C:/Users/Nick/Desktop/draft && bun run lint`
Expected: No new errors (pre-existing shadcn errors are fine)

- [ ] **Step 2: Run frontend build**

Run: `cd C:/Users/Nick/Desktop/draft && bun run build`
Expected: Clean build, TypeScript checks pass

- [ ] **Step 3: Run Rust build**

Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: Clean build. This is the first full compile with `transcribe-rs` — expect it to take a while as it downloads and builds ONNX Runtime and whisper.cpp with Vulkan.

- [ ] **Step 4: Run Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: All tests pass

- [ ] **Step 5: Fix any compilation errors**

If `transcribe_rs` re-exports differ from what we assumed (e.g., `transcribe_rs::WhisperEngine` vs `transcribe_rs::whisper_cpp::WhisperEngine`), fix the import paths in `engine.rs`. Common things to check:
- `transcribe_rs::WhisperEngine` — may need `transcribe_rs::whisper_cpp::WhisperEngine`
- `transcribe_rs::onnx::parakeet::ParakeetModel` — verify this path
- `transcribe_rs::onnx::Quantization` — verify this exists
- `transcribe_rs::SpeechModel` — should be at crate root
- `transcribe_rs::TranscribeOptions` — should be at crate root

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve transcribe-rs import paths and compilation issues"
```

---

### Task 14: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md to reflect new architecture**

Update the following sections:

1. In **Backend Structure**, replace the `stt/` section to mention `engine.rs` instead of `whisper.rs`, and note Parakeet support
2. In **Key Constraints**, update the whisper-rs reference to transcribe-rs
3. In **Model Storage**, mention both GGML files and ONNX directories
4. Update any references to `WhisperHandle` → `EngineHandle`
5. Remove mentions of English-only toggle

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for multi-engine STT architecture"
```
