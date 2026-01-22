//! Recording state machine
//! Manages the recording flow: Idle -> Recording -> Transcribing -> Idle

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, EventId, Listener, Manager};

use crate::audio::capture::AudioCapture;
use crate::audio::worker::AudioWorker;
use crate::config::load_config;
use crate::events;
use crate::stt::WhisperHandle;

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
    target_window: isize, // HWND for focus restoration after transcription
}

/// Combined recording state (state + optional active recording)
/// Protected by a single mutex to ensure atomic updates
struct RecordingStateData {
    state: RecordingState,
    active_recording: Option<ActiveRecording>,
    last_target_window: Option<isize>, // Persists for injection after transcription
    transcription_id: Option<u64>,     // Tracks current transcription to prevent race conditions
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
    /// Monotonic counter for transcription requests to prevent race conditions
    transcription_counter: Arc<AtomicU64>,
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
                last_target_window: None,
                transcription_id: None,
            })),
            key_pressed: Arc::new(AtomicBool::new(false)),
            transcription_complete_listener: Arc::new(Mutex::new(None)),
            transcription_error_listener: Arc::new(Mutex::new(None)),
            transcription_counter: Arc::new(AtomicU64::new(0)),
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
        // FIRST: Capture target window before anything else (before pill shows)
        let target_window = crate::injection::capture_foreground_window();

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
                target_window,
            });
            state_data.state = RecordingState::Recording;
        }

        // Emit recording started event (no locks held)
        let _ = app.emit(events::RECORDING_STARTED, ());

        // Show pill window at bottom center of screen
        if let Some(pill) = app.get_webview_window("pill") {
            // Position pill at bottom center of the current monitor
            if let Ok(Some(monitor)) = pill.current_monitor() {
                let monitor_size = monitor.size();
                let monitor_pos = monitor.position();
                let pill_size = pill.outer_size().unwrap_or(tauri::PhysicalSize::new(200, 40));

                let x = monitor_pos.x + (monitor_size.width as i32 - pill_size.width as i32) / 2;
                let y = monitor_pos.y + monitor_size.height as i32 - pill_size.height as i32 - 100; // 100px from bottom

                let _ = pill.set_position(tauri::PhysicalPosition::new(x, y));
            }
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

        // Take the active recording atomically and store target window for injection
        let recording = {
            let mut state_data = self.state_data.lock().map_err(|_| "Lock poisoned")?;
            let recording = state_data.active_recording.take();
            // Store target window for use after transcription completes
            state_data.last_target_window = recording.as_ref().map(|r| r.target_window);
            recording
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

        // Update state to transcribing atomically and generate transcription ID
        let transcription_id = {
            let mut state_data = self.state_data.lock().map_err(|_| "Lock poisoned")?;
            state_data.state = RecordingState::Transcribing;
            // Generate unique transcription ID to prevent race conditions
            let id = self.transcription_counter.fetch_add(1, Ordering::SeqCst);
            state_data.transcription_id = Some(id);
            id
        };

        // Clean up any existing listeners before registering new ones
        self.cleanup_transcription_listeners(app);

        // Set up new listeners for transcription completion to reset state and inject text
        // Note: No state_data lock held during listener setup to prevent deadlock
        let state_data_clone = self.state_data.clone();
        let app_for_complete = app.clone();
        let expected_id = transcription_id;
        let complete_listener_id = app.listen(events::TRANSCRIPTION_COMPLETE, move |event| {
            // Parse transcription text from event
            let text: String = serde_json::from_str(event.payload()).unwrap_or_default();

            // Get target window and reset state atomically, validating transcription ID
            let target_window = {
                let mut state_data = match state_data_clone.lock() {
                    Ok(guard) => guard,
                    Err(_) => return,
                };

                // Validate this is the current transcription (prevent race condition)
                if state_data.transcription_id != Some(expected_id) {
                    log::warn!(
                        "Ignoring stale transcription completion (expected {}, got {:?})",
                        expected_id,
                        state_data.transcription_id
                    );
                    return;
                }

                state_data.state = RecordingState::Idle;
                state_data.transcription_id = None;
                state_data.last_target_window.take()
            };

            // Only inject if we have non-empty text
            if !text.trim().is_empty() {
                let config = crate::config::load_config();

                // Spawn background task for focus restoration and injection
                // This prevents blocking the event listener thread
                tauri::async_runtime::spawn(async move {
                    if let Some(hwnd) = target_window {
                        // Restore focus to original window
                        if crate::injection::restore_focus(hwnd) {
                            // Small delay to ensure focus is established
                            tokio::time::sleep(Duration::from_millis(50)).await;
                        } else {
                            log::warn!(
                                "Failed to restore focus to window (HWND: {}). Text will inject to current focus.",
                                hwnd
                            );
                        }
                    }

                    // Inject the text (works regardless of focus restoration)
                    if let Err(e) = crate::injection::inject_text(&text, config.trailing_space) {
                        log::error!("Text injection failed: {}", e);
                    }
                });
            }

            // Hide pill after delay
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
                // Validate this is the current transcription
                if state_data.transcription_id != Some(expected_id) {
                    return;
                }
                state_data.state = RecordingState::Idle;
                state_data.transcription_id = None;
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
