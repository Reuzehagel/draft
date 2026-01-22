//! Recording state machine
//! Manages the recording flow: Idle -> Recording -> Transcribing -> Idle

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, EventId, Listener, Manager};

use crate::audio::capture::AudioCapture;
use crate::audio::worker::AudioWorker;
use crate::config::load_config;
use crate::events;
use crate::stt::WhisperHandle;

/// Maximum recording duration (2 minutes)
const MAX_RECORDING_DURATION: Duration = Duration::from_secs(120);

/// Recording states
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum RecordingState {
    Idle,
    Recording,
    Transcribing,
}

/// Active recording session data
struct ActiveRecording {
    capture: AudioCapture,
    worker: AudioWorker,
    start_time: Instant,
}

/// Combined recording state (state + optional active recording)
/// Protected by a single mutex to ensure atomic updates
struct RecordingStateData {
    state: RecordingState,
    active_recording: Option<ActiveRecording>,
}

/// Manages recording state and transitions
pub struct RecordingManager {
    /// Combined state data under single lock to prevent race conditions
    state_data: Arc<Mutex<RecordingStateData>>,
    /// Key pressed flag for repeat detection
    key_pressed: Arc<AtomicBool>,
    /// Track event listeners for cleanup to prevent memory leaks
    transcription_complete_listener: Arc<Mutex<Option<EventId>>>,
    transcription_error_listener: Arc<Mutex<Option<EventId>>>,
}

impl Default for RecordingManager {
    fn default() -> Self {
        Self::new()
    }
}

impl RecordingManager {
    pub fn new() -> Self {
        Self {
            state_data: Arc::new(Mutex::new(RecordingStateData {
                state: RecordingState::Idle,
                active_recording: None,
            })),
            key_pressed: Arc::new(AtomicBool::new(false)),
            transcription_complete_listener: Arc::new(Mutex::new(None)),
            transcription_error_listener: Arc::new(Mutex::new(None)),
        }
    }

    /// Get current recording state (read-only, recovers from poison)
    pub fn get_state(&self) -> RecordingState {
        self.state_data
            .lock()
            .map(|guard| guard.state)
            .unwrap_or_else(|e| e.into_inner().state)
    }

    /// Check if we can start a new recording
    fn can_start_recording(&self, app: &AppHandle) -> Result<(), String> {
        // Check if already recording or transcribing
        let state = self.get_state();
        if state != RecordingState::Idle {
            return Err(format!("Cannot start recording: currently {:?}", state));
        }

        // Check if whisper is busy (loading model or transcribing)
        let whisper = app.state::<WhisperHandle>();
        if whisper.is_busy() {
            return Err("Cannot start recording: whisper is busy".to_string());
        }

        // Check if a model is loaded
        if whisper.current_model().is_none() {
            return Err("Cannot start recording: no model loaded".to_string());
        }

        Ok(())
    }

    /// Handle hotkey press - start recording
    pub fn on_hotkey_pressed(&self, app: &AppHandle) -> Result<(), String> {
        // Ignore key repeats using compare-exchange
        if self
            .key_pressed
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            // Key was already pressed - ignore repeat
            return Ok(());
        }

        // Check if we can start recording
        if let Err(e) = self.can_start_recording(app) {
            // Reset key state so next press works
            self.key_pressed.store(false, Ordering::SeqCst);
            log::warn!("{}", e);
            // Show notification for missing configuration
            show_config_notification(app, &e);
            return Err(e);
        }

        // Get microphone ID from config
        let config = load_config();
        let device_id = config.microphone_id.as_deref();

        // Create audio capture
        let mut capture = AudioCapture::new(device_id).map_err(|e| {
            self.key_pressed.store(false, Ordering::SeqCst);
            format!("Failed to create audio capture: {}", e)
        })?;

        // Get audio parameters before taking consumer
        let sample_rate = capture.sample_rate();
        let channels = capture.channels();

        // Create worker with app handle for amplitude events
        let consumer = capture.take_consumer().map_err(|e| {
            self.key_pressed.store(false, Ordering::SeqCst);
            format!("Failed to get audio consumer: {}", e)
        })?;

        let worker = AudioWorker::new(consumer, sample_rate, channels, Some(app.clone()));

        // Start capture
        capture.start().map_err(|e| {
            self.key_pressed.store(false, Ordering::SeqCst);
            format!("Failed to start capture: {}", e)
        })?;

        // Store active recording and update state atomically
        {
            let mut state_data = self.state_data.lock().map_err(|_| "Lock poisoned")?;
            state_data.active_recording = Some(ActiveRecording {
                capture,
                worker,
                start_time: Instant::now(),
            });
            state_data.state = RecordingState::Recording;
        }

        // Emit recording started event (no locks held)
        let _ = app.emit(events::RECORDING_STARTED, ());

        // Show pill window
        if let Some(pill) = app.get_webview_window("pill") {
            let _ = pill.show();
        }

        log::info!("Recording started");
        Ok(())
    }

    /// Handle hotkey release - stop recording and transcribe
    pub fn on_hotkey_released(&self, app: &AppHandle) -> Result<(), String> {
        // Mark key as released
        self.key_pressed.store(false, Ordering::SeqCst);

        // Only proceed if we're in recording state
        let current_state = self.get_state();
        if current_state != RecordingState::Recording {
            return Ok(());
        }

        // Take the active recording atomically
        let recording = {
            let mut state_data = self.state_data.lock().map_err(|_| "Lock poisoned")?;
            state_data.active_recording.take()
        };

        let Some(mut recording) = recording else {
            log::warn!("No active recording found");
            return Ok(());
        };

        // Stop capture and get audio samples
        recording.capture.stop();
        let audio = recording.worker.stop();

        let duration = recording.start_time.elapsed();
        log::info!(
            "Recording stopped after {:.2}s, {} samples",
            duration.as_secs_f32(),
            audio.len()
        );

        // Emit recording stopped event (no locks held)
        let _ = app.emit(events::RECORDING_STOPPED, ());

        // Update state to transcribing atomically
        {
            let mut state_data = self.state_data.lock().map_err(|_| "Lock poisoned")?;
            state_data.state = RecordingState::Transcribing;
        }

        // Clean up any existing listeners before registering new ones
        self.cleanup_transcription_listeners(app);

        // Set up new listeners for transcription completion to reset state
        // Note: No state_data lock held during listener setup to prevent deadlock
        let state_data_clone = self.state_data.clone();
        let app_for_complete = app.clone();
        let complete_listener_id = app.listen(events::TRANSCRIPTION_COMPLETE, move |_| {
            if let Ok(mut state_data) = state_data_clone.lock() {
                state_data.state = RecordingState::Idle;
            }
            // Hide pill after a short delay to show result
            if let Some(pill) = app_for_complete.get_webview_window("pill") {
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(Duration::from_secs(2)).await;
                    let _ = pill.hide();
                });
            }
        });

        let state_data_clone = self.state_data.clone();
        let app_for_error = app.clone();
        let error_listener_id = app.listen(events::TRANSCRIPTION_ERROR, move |_| {
            if let Ok(mut state_data) = state_data_clone.lock() {
                state_data.state = RecordingState::Idle;
            }
            // Hide pill after showing error
            if let Some(pill) = app_for_error.get_webview_window("pill") {
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(Duration::from_secs(3)).await;
                    let _ = pill.hide();
                });
            }
        });

        // Store listener IDs for cleanup (prevents memory leak)
        if let Ok(mut guard) = self.transcription_complete_listener.lock() {
            *guard = Some(complete_listener_id);
        }
        if let Ok(mut guard) = self.transcription_error_listener.lock() {
            *guard = Some(error_listener_id);
        }

        // Start transcription (no locks held)
        let whisper = app.state::<WhisperHandle>();
        if let Err(e) = whisper.transcribe(audio) {
            log::error!("Failed to start transcription: {}", e);
            // Reset state on failure
            if let Ok(mut state_data) = self.state_data.lock() {
                state_data.state = RecordingState::Idle;
            }
            let _ = app.emit(events::TRANSCRIPTION_ERROR, &e);
        }

        Ok(())
    }

    /// Check if recording has exceeded max duration and stop if so
    pub fn check_timeout(&self, app: &AppHandle) -> bool {
        // Check timeout atomically
        let should_stop = {
            let state_data = match self.state_data.lock() {
                Ok(guard) => guard,
                Err(_) => return false,
            };
            if let Some(ref recording) = state_data.active_recording {
                recording.start_time.elapsed() >= MAX_RECORDING_DURATION
            } else {
                false
            }
        };

        if should_stop {
            log::info!("Recording timeout reached (120s)");
            let _ = self.on_hotkey_released(app);
            return true;
        }

        false
    }

    /// Clean up transcription event listeners to prevent memory leaks
    fn cleanup_transcription_listeners(&self, app: &AppHandle) {
        // Unregister complete listener
        if let Ok(mut guard) = self.transcription_complete_listener.lock() {
            if let Some(listener_id) = guard.take() {
                app.unlisten(listener_id);
            }
        }

        // Unregister error listener
        if let Ok(mut guard) = self.transcription_error_listener.lock() {
            if let Some(listener_id) = guard.take() {
                app.unlisten(listener_id);
            }
        }
    }
}

/// Show a notification when recording cannot start due to missing config
fn show_config_notification(app: &AppHandle, error: &str) {
    use tauri_plugin_notification::NotificationExt;

    let message = if error.contains("no model loaded") {
        "Please download and select a model in Settings"
    } else if error.contains("whisper is busy") {
        "Please wait for the current operation to complete"
    } else {
        "Please check your settings"
    };

    if let Err(e) = app
        .notification()
        .builder()
        .title("Draft")
        .body(message)
        .show()
    {
        log::warn!("Failed to show notification: {}", e);
    }
}
