//! STT engine module
//! Manages speech-to-text model loading and transcription on a dedicated thread
//! Supports multiple engines (Whisper, Parakeet) via the transcribe_rs::SpeechModel trait

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

        if self.sender.send(command).is_err() {
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
            use transcribe_rs::whisper_cpp::WhisperEngine;
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
                        let options = TranscribeOptions::default();
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
