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
    target_window: isize,
}

/// Combined recording state protected by a single mutex for atomic updates
struct RecordingStateData {
    state: RecordingState,
    active_recording: Option<ActiveRecording>,
    last_target_window: Option<isize>,
    transcription_id: Option<u64>,
}

/// Pair of event listener IDs for transcription completion/error
struct TranscriptionListeners {
    complete: Option<EventId>,
    error: Option<EventId>,
}

/// Manages recording state and transitions
pub struct RecordingManager {
    state_data: Arc<Mutex<RecordingStateData>>,
    key_pressed: Arc<AtomicBool>,
    transcription_listeners: Arc<Mutex<TranscriptionListeners>>,
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
            transcription_listeners: Arc::new(Mutex::new(TranscriptionListeners {
                complete: None,
                error: None,
            })),
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

    fn can_start_recording(&self, app: &AppHandle) -> Result<(), String> {
        let state = self.get_state();
        if state != RecordingState::Idle {
            return Err(format!("Cannot start recording: currently {:?}", state));
        }

        let whisper = app.state::<WhisperHandle>();
        if whisper.is_busy() {
            return Err("Cannot start recording: whisper is busy".to_string());
        }
        if whisper.current_model().is_none() {
            return Err("Cannot start recording: no model loaded".to_string());
        }

        Ok(())
    }

    /// Handle hotkey press - start recording
    pub fn on_hotkey_pressed(&self, app: &AppHandle) -> Result<(), String> {
        // Capture target window before anything else (before pill shows)
        let target_window = crate::injection::capture_foreground_window();

        // Ignore key repeats via compare-exchange
        if self
            .key_pressed
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return Ok(());
        }

        // All error paths below must reset key_pressed, so use a helper that
        // resets on Err and passes through Ok.
        let result = self.start_recording(app, target_window);
        if result.is_err() {
            self.key_pressed.store(false, Ordering::SeqCst);
        }
        result
    }

    /// Core recording startup logic, separated from key-press guard.
    fn start_recording(&self, app: &AppHandle, target_window: isize) -> Result<(), String> {
        if let Err(e) = self.can_start_recording(app) {
            log::warn!("{}", e);
            show_config_notification(app, &e);
            return Err(e);
        }

        let config = load_config();
        let device_id = config.microphone_id.as_deref();

        let mut capture = AudioCapture::new(device_id)
            .map_err(|e| format!("Failed to create audio capture: {}", e))?;

        let sample_rate = capture.sample_rate();
        let channels = capture.channels();

        let consumer = capture
            .take_consumer()
            .map_err(|e| format!("Failed to get audio consumer: {}", e))?;

        let worker = AudioWorker::new(consumer, sample_rate, channels, Some(app.clone()));

        capture
            .start()
            .map_err(|e| format!("Failed to start capture: {}", e))?;

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

        let _ = app.emit(events::RECORDING_STARTED, ());
        show_pill_centered(app);

        log::info!("Recording started");
        Ok(())
    }

    /// Handle hotkey release - stop recording and transcribe
    pub fn on_hotkey_released(&self, app: &AppHandle) -> Result<(), String> {
        self.key_pressed.store(false, Ordering::SeqCst);

        if self.get_state() != RecordingState::Recording {
            return Ok(());
        }

        let recording = {
            let mut state_data = self.state_data.lock().map_err(|_| "Lock poisoned")?;
            let recording = state_data.active_recording.take();
            state_data.last_target_window = recording.as_ref().map(|r| r.target_window);
            recording
        };

        let Some(mut recording) = recording else {
            log::warn!("No active recording found");
            return Ok(());
        };

        recording.capture.stop();
        let audio = recording.worker.stop();
        let duration = recording.start_time.elapsed();
        log::info!(
            "Recording stopped after {:.2}s, {} samples",
            duration.as_secs_f32(),
            audio.len()
        );

        let _ = app.emit(events::RECORDING_STOPPED, ());

        let transcription_id = {
            let mut state_data = self.state_data.lock().map_err(|_| "Lock poisoned")?;
            state_data.state = RecordingState::Transcribing;
            let id = self.transcription_counter.fetch_add(1, Ordering::SeqCst);
            state_data.transcription_id = Some(id);
            id
        };

        self.cleanup_transcription_listeners(app);
        self.register_transcription_listeners(app, transcription_id);

        let whisper = app.state::<WhisperHandle>();
        if let Err(e) = whisper.transcribe(audio) {
            log::error!("Failed to start transcription: {}", e);
            if let Ok(mut state_data) = self.state_data.lock() {
                state_data.state = RecordingState::Idle;
                state_data.transcription_id = None;
            }
            self.cleanup_transcription_listeners(app);
            let _ = app.emit(events::TRANSCRIPTION_ERROR, &e);
        }

        Ok(())
    }

    /// Register event listeners for transcription completion and error
    fn register_transcription_listeners(&self, app: &AppHandle, transcription_id: u64) {
        // Completion listener
        let state_data_clone = self.state_data.clone();
        let app_clone = app.clone();
        let complete_id = app.listen(events::TRANSCRIPTION_COMPLETE, move |event| {
            handle_transcription_complete(event, &state_data_clone, &app_clone, transcription_id);
        });

        // Error listener
        let state_data_clone = self.state_data.clone();
        let app_clone = app.clone();
        let error_id = app.listen(events::TRANSCRIPTION_ERROR, move |_| {
            handle_transcription_error(&state_data_clone, &app_clone, transcription_id);
        });

        if let Ok(mut guard) = self.transcription_listeners.lock() {
            guard.complete = Some(complete_id);
            guard.error = Some(error_id);
        }
    }

    /// Clean up transcription event listeners to prevent memory leaks
    fn cleanup_transcription_listeners(&self, app: &AppHandle) {
        if let Ok(mut guard) = self.transcription_listeners.lock() {
            if let Some(id) = guard.complete.take() {
                app.unlisten(id);
            }
            if let Some(id) = guard.error.take() {
                app.unlisten(id);
            }
        }
    }
}

/// Handle transcription-complete event: reset state, run LLM, inject text
fn handle_transcription_complete(
    event: tauri::Event,
    state_data: &Arc<Mutex<RecordingStateData>>,
    app: &AppHandle,
    expected_id: u64,
) {
    let text: String = serde_json::from_str(event.payload()).unwrap_or_default();

    let target_window = {
        let mut guard = match state_data.lock() {
            Ok(guard) => guard,
            Err(_) => return,
        };

        if guard.transcription_id != Some(expected_id) {
            log::warn!(
                "Ignoring stale transcription completion (expected {}, got {:?})",
                expected_id,
                guard.transcription_id
            );
            return;
        }

        guard.state = RecordingState::Idle;
        guard.transcription_id = None;
        guard.last_target_window.take()
    };

    if text.trim().is_empty() {
        hide_pill_after_delay(app, state_data, Duration::from_secs(2));
        return;
    }

    let config = crate::config::load_config();
    let llm_will_process = crate::llm::should_process(&config);

    if llm_will_process {
        let _ = app.emit(events::LLM_PROCESSING, ());
    }

    let app_for_task = app.clone();
    let state_for_task = state_data.clone();

    tauri::async_runtime::spawn(async move {
        let final_text = crate::llm::post_process(&text, &config, &app_for_task).await;

        if let Some(hwnd) = target_window {
            if crate::injection::restore_focus(hwnd) {
                tokio::time::sleep(Duration::from_millis(50)).await;
            } else {
                log::warn!(
                    "Failed to restore focus to window (HWND: {}). Text will inject to current focus.",
                    hwnd
                );
            }
        }

        if let Err(e) = crate::injection::inject_text(&final_text, config.trailing_space) {
            log::error!("Text injection failed: {}", e);
        }

        if llm_will_process {
            hide_pill_after_delay(&app_for_task, &state_for_task, Duration::from_secs(2));
        }
    });

    if !llm_will_process {
        hide_pill_after_delay(app, state_data, Duration::from_secs(2));
    }
}

/// Handle transcription-error event: reset state and hide pill
fn handle_transcription_error(
    state_data: &Arc<Mutex<RecordingStateData>>,
    app: &AppHandle,
    expected_id: u64,
) {
    if let Ok(mut guard) = state_data.lock() {
        if guard.transcription_id != Some(expected_id) {
            return;
        }
        guard.state = RecordingState::Idle;
        guard.transcription_id = None;
    }
    hide_pill_after_delay(app, state_data, Duration::from_secs(3));
}

/// Position and show the pill window at bottom center of the primary monitor
fn show_pill_centered(app: &AppHandle) {
    let Some(pill) = app.get_webview_window("pill") else {
        return;
    };

    if let Ok(Some(monitor)) = pill.primary_monitor() {
        let monitor_size = monitor.size();
        let monitor_pos = monitor.position();
        let pill_size = pill
            .outer_size()
            .unwrap_or(tauri::PhysicalSize::new(200, 40));

        let x = monitor_pos.x + (monitor_size.width as i32 - pill_size.width as i32) / 2;
        let y = monitor_pos.y + monitor_size.height as i32 - pill_size.height as i32 - 100;

        let _ = pill.set_position(tauri::PhysicalPosition::new(x, y));
    }

    let _ = pill.show();
}

/// Hide the pill window after a delay, but only if still idle
fn hide_pill_after_delay(
    app: &AppHandle,
    state_data: &Arc<Mutex<RecordingStateData>>,
    delay: Duration,
) {
    if let Some(pill) = app.get_webview_window("pill") {
        let state_for_hide = state_data.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(delay).await;
            let is_idle = state_for_hide
                .lock()
                .map(|s| s.state == RecordingState::Idle)
                .unwrap_or(true);
            if is_idle {
                let _ = pill.hide();
            }
        });
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
