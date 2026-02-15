//! Whisper integration module
//! Manages Whisper model loading and transcription on a dedicated thread

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};

use tauri::{AppHandle, Emitter};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use super::models;
use crate::events;

/// Commands sent to the whisper thread
pub enum WhisperCommand {
    LoadModel { model_id: String },
    Transcribe {
        audio: Vec<f32>,
        cancel_token: Option<Arc<AtomicBool>>,
        progress_handle: Option<AppHandle>,
    },
    Shutdown,
}

/// Shared state for querying whisper thread status
#[derive(Clone)]
struct SharedState {
    sender: Sender<WhisperCommand>,
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

    fn send(&self, command: WhisperCommand) -> Result<(), String> {
        self.sender
            .send(command)
            .map_err(|_| "Whisper thread not running".to_string())
    }

    /// Atomically check if not busy and set busy flag, then send command.
    /// Uses compare-and-swap to prevent race conditions.
    fn send_if_not_busy(&self, command: WhisperCommand) -> Result<(), String> {
        // Try to set busy flag from false to true atomically
        if self
            .is_busy
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return Err("Whisper is busy".to_string());
        }

        // If send fails, clear the flag we just set
        if let Err(_e) = self.sender.send(command) {
            self.is_busy.store(false, Ordering::SeqCst);
            return Err("Whisper thread not running".to_string());
        }

        Ok(())
    }
}

/// Clonable client for sending transcription commands from other threads
#[derive(Clone)]
pub struct WhisperClient(SharedState);

impl WhisperClient {
    pub fn transcribe(&self, audio: Vec<f32>) -> Result<(), String> {
        if self.0.current_model().is_none() {
            return Err("No model loaded".to_string());
        }
        self.0.send_if_not_busy(WhisperCommand::Transcribe {
            audio,
            cancel_token: None,
            progress_handle: None,
        })
    }

    /// Transcribe with cancel token and progress reporting (for file transcription)
    pub fn transcribe_file(
        &self,
        audio: Vec<f32>,
        cancel_token: Arc<AtomicBool>,
        progress_handle: AppHandle,
    ) -> Result<(), String> {
        if self.0.current_model().is_none() {
            return Err("No model loaded".to_string());
        }
        self.0.send_if_not_busy(WhisperCommand::Transcribe {
            audio,
            cancel_token: Some(cancel_token),
            progress_handle: Some(progress_handle),
        })
    }
}

/// Handle to communicate with the whisper thread
pub struct WhisperHandle {
    state: SharedState,
    thread_handle: Mutex<Option<JoinHandle<()>>>,
}

impl WhisperHandle {
    /// Create a new WhisperHandle, spawning the whisper thread
    pub fn new(app_handle: AppHandle) -> Self {
        let (sender, receiver) = mpsc::channel::<WhisperCommand>();
        let is_busy = Arc::new(AtomicBool::new(false));
        let current_model = Arc::new(Mutex::new(None));

        let is_busy_clone = is_busy.clone();
        let current_model_clone = current_model.clone();

        let thread_handle = thread::spawn(move || {
            whisper_thread_main(receiver, app_handle, is_busy_clone, current_model_clone);
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
            .send_if_not_busy(WhisperCommand::LoadModel { model_id })
    }

    pub fn transcribe(&self, audio: Vec<f32>) -> Result<(), String> {
        self.client().transcribe(audio)
    }

    pub fn shutdown(&self) {
        let _ = self.state.send(WhisperCommand::Shutdown);

        // Join thread to ensure clean shutdown
        if let Ok(mut guard) = self.thread_handle.lock() {
            if let Some(handle) = guard.take() {
                if let Err(e) = handle.join() {
                    log::error!("Whisper thread panicked: {:?}", e);
                } else {
                    log::info!("Whisper thread joined successfully");
                }
            }
        }
    }

    pub fn client(&self) -> WhisperClient {
        WhisperClient(self.state.clone())
    }
}

impl Drop for WhisperHandle {
    fn drop(&mut self) {
        self.shutdown();
    }
}

/// RAII guard to clear busy flag on exit.
/// The busy flag is set by send_if_not_busy() before sending the command.
struct BusyGuard<'a>(&'a AtomicBool);

impl<'a> BusyGuard<'a> {
    fn new(flag: &'a AtomicBool) -> Self {
        // Flag is already set by send_if_not_busy(), guard only clears on drop
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

/// Main loop for the whisper thread
fn whisper_thread_main(
    receiver: mpsc::Receiver<WhisperCommand>,
    app_handle: AppHandle,
    is_busy: Arc<AtomicBool>,
    current_model: Arc<Mutex<Option<String>>>,
) {
    log::info!("Whisper thread started");

    let mut context: Option<WhisperContext> = None;

    while let Ok(command) = receiver.recv() {
        match command {
            WhisperCommand::LoadModel { model_id } => {
                let _busy = BusyGuard::new(&is_busy);
                log::info!("Loading whisper model: {}", model_id);
                let _ = app_handle.emit(events::MODEL_LOADING, &model_id);

                match load_whisper_model(&model_id) {
                    Ok(ctx) => {
                        context = Some(ctx);
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

            WhisperCommand::Transcribe {
                audio,
                cancel_token,
                progress_handle,
            } => {
                let _busy = BusyGuard::new(&is_busy);

                // Validate audio length (minimum 0.1s at 16kHz = 1600 samples)
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
                let result = context
                    .as_ref()
                    .ok_or_else(|| "No model loaded".to_string())
                    .and_then(|ctx| {
                        run_transcription(
                            ctx,
                            &audio,
                            cancel_token.as_ref(),
                            progress_handle.as_ref(),
                        )
                    });
                log::info!("Transcription took {:?}", start_time.elapsed());

                match result {
                    Ok(text) => {
                        log::info!("Transcription complete: {:?}", text);
                        let _ = app_handle.emit(events::TRANSCRIPTION_COMPLETE, &text);
                    }
                    Err(e) => {
                        log::error!("Transcription failed: {}", e);
                        let _ = app_handle.emit(events::TRANSCRIPTION_ERROR, &e);
                    }
                }
            }

            WhisperCommand::Shutdown => {
                log::info!("Whisper thread shutting down");
                break;
            }
        }
    }

    log::info!("Whisper thread exiting");
}

/// Load a Whisper model from disk
fn load_whisper_model(model_id: &str) -> Result<WhisperContext, String> {
    let model_def =
        models::find_model(model_id).ok_or_else(|| format!("Unknown model: {}", model_id))?;

    let model_path: PathBuf = models::model_path(model_def.filename);

    if !model_path.exists() {
        return Err(format!("Model file not found: {:?}", model_path));
    }

    log::info!("Loading model from {:?}", model_path);

    // Convert path to string, handling non-UTF-8 paths gracefully
    let path_str = model_path
        .to_str()
        .ok_or_else(|| format!("Model path contains invalid UTF-8: {:?}", model_path))?;

    let params = WhisperContextParameters::default();
    let ctx = WhisperContext::new_with_params(path_str, params)
        .map_err(|e| format!("Failed to create whisper context: {}", e))?;

    Ok(ctx)
}

fn run_transcription(
    ctx: &WhisperContext,
    audio: &[f32],
    cancel_token: Option<&Arc<AtomicBool>>,
    progress_handle: Option<&AppHandle>,
) -> Result<String, String> {
    let mut state = ctx
        .create_state()
        .map_err(|e| format!("Failed to create whisper state: {}", e))?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });

    // Cap threads at 8 — whisper.cpp degrades beyond that due to
    // memory bandwidth saturation and thread contention
    let n_threads = std::thread::available_parallelism()
        .map(|n| n.get().min(8))
        .unwrap_or(4) as i32;
    params.set_n_threads(n_threads);
    log::info!("Using {} threads for whisper inference", n_threads);

    params.set_language(None);
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_suppress_blank(true);
    params.set_suppress_nst(true);

    // Set progress callback for file transcription
    if let Some(app) = progress_handle {
        let app_for_progress = app.clone();
        params.set_progress_callback_safe(move |progress: i32| {
            let _ = app_for_progress.emit(events::FILE_TRANSCRIPTION_PROGRESS, progress);
        });
    }

    // Set abort callback for cancellation
    if let Some(token) = cancel_token {
        let token_for_abort = token.clone();
        params.set_abort_callback_safe(move || token_for_abort.load(Ordering::SeqCst));
    }

    let full_result = state.full(params, audio);

    // Check if cancelled
    if let Some(token) = cancel_token {
        if token.load(Ordering::SeqCst) {
            return Err("Transcription cancelled".to_string());
        }
    }

    full_result.map_err(|e| format!("Whisper inference failed: {}", e))?;

    let text: String = (0..state.full_n_segments())
        .filter_map(|i| state.get_segment(i))
        .filter_map(|seg| seg.to_str_lossy().ok().map(|s| s.into_owned()))
        .collect();

    Ok(text.trim().to_string())
}
