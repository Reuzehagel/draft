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
use crate::stt::EngineHandle;

/// Delay after restoring focus before injecting text.
/// Gives the target window time to process WM_ACTIVATE and be ready for input.
const FOCUS_RESTORE_DELAY: Duration = Duration::from_millis(100);

/// How long to wait for user confirmation before auto-declining
const CONFIRM_TIMEOUT: Duration = Duration::from_secs(8);

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

/// Metadata about a completed transcription, threaded through the pipeline for history
#[derive(Debug, Clone)]
pub(crate) struct TranscriptionMeta {
    pub duration_ms: u64,
    pub stt_model: Option<String>,
}

/// Combined recording state protected by a single mutex for atomic updates
pub(crate) struct RecordingStateData {
    state: RecordingState,
    active_recording: Option<ActiveRecording>,
    last_target_window: Option<isize>,
    transcription_id: Option<u64>,
    transcription_meta: Option<TranscriptionMeta>,
}

/// Data stored while waiting for user to confirm LLM processing
pub(crate) struct PendingConfirmation {
    pub raw_text: String,
    pub config: crate::config::Config,
    pub target_window: Option<isize>,
    pub meta: Option<TranscriptionMeta>,
}

/// Pair of event listener IDs for transcription completion/error
struct TranscriptionListeners {
    complete: Option<EventId>,
    error: Option<EventId>,
}

/// Press-release shorter than this is a "tap", not a hold
const TAP_THRESHOLD: Duration = Duration::from_millis(300);

/// Max time between first tap release and second press to count as double-tap
const DOUBLE_TAP_WINDOW: Duration = Duration::from_millis(500);

/// Manages recording state and transitions
pub struct RecordingManager {
    state_data: Arc<Mutex<RecordingStateData>>,
    key_pressed: Arc<AtomicBool>,
    transcription_listeners: Arc<Mutex<TranscriptionListeners>>,
    transcription_counter: Arc<AtomicU64>,
    /// Timestamp of last tap release (for double-tap detection)
    last_tap_release: Arc<Mutex<Option<Instant>>>,
    /// Whether toggle recording mode is active (in-memory only, resets on restart)
    toggle_active: Arc<AtomicBool>,
    /// Pending LLM confirmation awaiting user Y/N
    pending_confirmation: Arc<Mutex<Option<PendingConfirmation>>>,
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
                transcription_meta: None,
            })),
            key_pressed: Arc::new(AtomicBool::new(false)),
            transcription_listeners: Arc::new(Mutex::new(TranscriptionListeners {
                complete: None,
                error: None,
            })),
            transcription_counter: Arc::new(AtomicU64::new(0)),
            last_tap_release: Arc::new(Mutex::new(None)),
            toggle_active: Arc::new(AtomicBool::new(false)),
            pending_confirmation: Arc::new(Mutex::new(None)),
        }
    }

    /// Get current recording state (read-only, recovers from poison)
    pub fn get_state(&self) -> RecordingState {
        self.state_data
            .lock()
            .map(|guard| guard.state)
            .unwrap_or_else(|e| e.into_inner().state)
    }

    /// Take the pending confirmation, if any. Returns None if already taken.
    pub fn take_pending_confirmation(&self) -> Option<PendingConfirmation> {
        self.pending_confirmation
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .take()
    }

    /// Get Arc to state_data for use in async tasks
    pub(crate) fn state_data_arc(&self) -> Arc<Mutex<RecordingStateData>> {
        self.state_data.clone()
    }

    /// Get Arc to pending_confirmation for use in async tasks
    pub(crate) fn pending_confirmation_arc(&self) -> Arc<Mutex<Option<PendingConfirmation>>> {
        self.pending_confirmation.clone()
    }

    fn can_start_recording(&self, app: &AppHandle) -> Result<(), String> {
        let state = self.get_state();
        if state != RecordingState::Idle {
            return Err(format!("Cannot start recording: currently {:?}", state));
        }

        // Skip whisper checks when online STT is configured
        let config = load_config();
        if crate::stt::online::is_online_stt(&config) {
            return Ok(());
        }

        let engine = app.state::<EngineHandle>();
        if engine.is_busy() {
            return Err("Cannot start recording: engine is busy".to_string());
        }
        if engine.current_model().is_none() {
            return Err("Cannot start recording: no model loaded".to_string());
        }

        Ok(())
    }

    /// Handle hotkey press - start recording or toggle-stop if active
    pub fn on_hotkey_pressed(&self, app: &AppHandle) -> Result<(), String> {
        // Capture target window before anything else (before pill shows)
        let target_window = crate::injection::capture_foreground_window();

        // Ignore key repeats via compare-exchange (all paths)
        if self
            .key_pressed
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return Ok(());
        }

        // Toggle stop: if toggle mode is active and we're recording, stop + transcribe
        if self.toggle_active.load(Ordering::SeqCst) && self.get_state() == RecordingState::Recording {
            self.toggle_active.store(false, Ordering::SeqCst);
            return self.stop_and_transcribe(app);
        }

        let config = load_config();

        // Double-tap detection: check if this press is within the window of a recent tap
        let is_double_tap = if config.double_tap_toggle {
            let mut last_tap = self.last_tap_release.lock().unwrap_or_else(|e| e.into_inner());
            if let Some(tap_time) = last_tap.take() {
                tap_time.elapsed() < DOUBLE_TAP_WINDOW
            } else {
                false
            }
        } else {
            false
        };

        if is_double_tap {
            self.toggle_active.store(true, Ordering::SeqCst);
            log::info!("Double-tap detected: starting toggle recording");
        }

        // Cancel any pending confirmation — output raw text in background
        if let Some(pending) = self.take_pending_confirmation() {
            let app_bg = app.clone();
            let state_bg = self.state_data.clone();
            let pc_bg = self.pending_confirmation.clone();
            tauri::async_runtime::spawn(async move {
                execute_raw_output(&app_bg, &state_bg, &pc_bg, pending).await;
            });
        }

        // All error paths below must reset key_pressed
        let result = self.start_recording(app, target_window, &config);
        if result.is_err() {
            self.key_pressed.store(false, Ordering::SeqCst);
            self.toggle_active.store(false, Ordering::SeqCst);
        }
        result
    }

    /// Core recording startup logic, separated from key-press guard.
    /// Safety: The can_start_recording check and state transition are not atomic,
    /// but concurrent calls are prevented by the key_pressed compare_exchange in
    /// on_hotkey_pressed — only one hotkey press can pass that gate at a time.
    fn start_recording(&self, app: &AppHandle, target_window: isize, config: &crate::config::Config) -> Result<(), String> {
        if let Err(e) = self.can_start_recording(app) {
            log::warn!("{}", e);
            show_config_notification(app, &e);
            return Err(e);
        }

        let device_id = config.microphone_id.as_deref();

        let mut capture = AudioCapture::new(device_id)
            .map_err(|e| format!("Failed to create audio capture: {}", e))?;

        let sample_rate = capture.sample_rate();
        let channels = capture.channels();

        let consumer = capture
            .take_consumer()
            .map_err(|e| format!("Failed to get audio consumer: {}", e))?;

        let worker = AudioWorker::new(consumer, sample_rate, channels, Some(app.clone()), Some(capture.error_flag()));

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
        let player = app.state::<Option<crate::sound::SoundPlayer>>();
        crate::sound::play_if_enabled(player.inner(), crate::sound::SoundEffect::Start);
        show_pill_centered(app);

        log::info!("Recording started");
        Ok(())
    }

    /// Handle hotkey release - stop recording and transcribe (or discard/continue for toggle mode)
    pub fn on_hotkey_released(&self, app: &AppHandle) -> Result<(), String> {
        self.key_pressed.store(false, Ordering::SeqCst);

        if self.get_state() != RecordingState::Recording {
            return Ok(());
        }

        // Toggle active: recording continues after release
        if self.toggle_active.load(Ordering::SeqCst) {
            return Ok(());
        }

        // Check if this was a quick tap (for double-tap detection)
        let config = load_config();
        if config.double_tap_toggle {
            let hold_duration = self.state_data.lock()
                .ok()
                .and_then(|s| s.active_recording.as_ref().map(|r| r.start_time.elapsed()));

            if let Some(duration) = hold_duration {
                if duration < TAP_THRESHOLD {
                    // Short tap: discard recording, record timestamp for double-tap detection
                    self.discard_recording(app)?;
                    let mut last_tap = self.last_tap_release.lock().unwrap_or_else(|e| e.into_inner());
                    *last_tap = Some(Instant::now());
                    return Ok(());
                }
            }
        }

        // Normal hold release: stop and transcribe
        self.stop_and_transcribe(app)
    }

    /// Stop the current recording and start transcription
    fn stop_and_transcribe(&self, app: &AppHandle) -> Result<(), String> {
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

        // Restore focus immediately so the user can keep working during transcription.
        // output_text() will restore focus again later for text injection.
        let target_hwnd = recording.target_window;
        let _ = app.run_on_main_thread(move || {
            let _ = crate::injection::restore_focus(target_hwnd);
        });

        let config = load_config();

        let transcription_id = {
            let stt_model = if crate::stt::online::is_online_stt(&config) {
                config.stt_provider.clone()
            } else {
                config.selected_model.clone()
            };

            let mut state_data = self.state_data.lock().map_err(|_| "Lock poisoned")?;
            state_data.state = RecordingState::Transcribing;
            let id = self.transcription_counter.fetch_add(1, Ordering::SeqCst);
            state_data.transcription_id = Some(id);
            state_data.transcription_meta = Some(TranscriptionMeta {
                duration_ms: duration.as_millis() as u64,
                stt_model,
            });
            id
        };

        self.cleanup_transcription_listeners(app);
        self.register_transcription_listeners(app, transcription_id);
        if crate::stt::online::is_online_stt(&config) {
            // Online path: encode to WAV, upload to API
            let wav_bytes = crate::stt::online::wav::encode_wav(&audio, 16000);
            let app_clone = app.clone();
            tauri::async_runtime::spawn(async move {
                match crate::stt::online::transcribe_online(
                    &config,
                    wav_bytes,
                    "recording.wav",
                    "audio/wav",
                )
                .await
                {
                    Ok(text) => {
                        let _ = app_clone.emit(events::TRANSCRIPTION_COMPLETE, &text);
                    }
                    Err(e) => {
                        let _ = app_clone.emit(events::TRANSCRIPTION_ERROR, &e);
                    }
                }
            });
        } else {
            // Local whisper path
            let engine = app.state::<EngineHandle>();
            if let Err(e) = engine.transcribe(audio, config.whisper_initial_prompt.clone()) {
                log::error!("Failed to start transcription: {}", e);
                if let Ok(mut state_data) = self.state_data.lock() {
                    state_data.state = RecordingState::Idle;
                    state_data.transcription_id = None;
                    state_data.transcription_meta = None;
                }
                // Cleanup listeners before emitting the error event. Since Tauri
                // dispatches events asynchronously, the listener is already
                // unregistered by the time the event fires, preventing the error
                // handler from redundantly resetting state.
                self.cleanup_transcription_listeners(app);
                let _ = app.emit(events::TRANSCRIPTION_ERROR, &e);
            }
        }

        Ok(())
    }

    /// Discard the current recording without transcribing (used for first tap in double-tap)
    fn discard_recording(&self, app: &AppHandle) -> Result<(), String> {
        let recording = {
            let mut state_data = self.state_data.lock().map_err(|_| "Lock poisoned")?;
            let recording = state_data.active_recording.take();
            state_data.state = RecordingState::Idle;
            recording
        };

        let Some(mut recording) = recording else {
            log::warn!("No active recording to discard");
            return Ok(());
        };

        recording.capture.stop();
        let _ = recording.worker.stop(); // discard audio
        log::info!("Recording discarded (tap detected, {:.0}ms)", recording.start_time.elapsed().as_millis());

        let _ = app.emit(events::RECORDING_STOPPED, ());

        // Hide pill immediately
        if let Some(pill) = app.get_webview_window("pill") {
            let _ = pill.hide();
        }

        Ok(())
    }

    /// Register event listeners for transcription completion and error
    fn register_transcription_listeners(&self, app: &AppHandle, transcription_id: u64) {
        // Completion listener
        let state_data_clone = self.state_data.clone();
        let pending_clone = self.pending_confirmation.clone();
        let app_clone = app.clone();
        let complete_id = app.listen(events::TRANSCRIPTION_COMPLETE, move |event| {
            handle_transcription_complete(event, &state_data_clone, &pending_clone, &app_clone, transcription_id);
        });

        // Error listener
        let state_data_clone = self.state_data.clone();
        let pending_clone = self.pending_confirmation.clone();
        let app_clone = app.clone();
        let error_id = app.listen(events::TRANSCRIPTION_ERROR, move |_| {
            handle_transcription_error(&state_data_clone, &pending_clone, &app_clone, transcription_id);
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

// ---------------------------------------------------------------------------
// Shared output helpers
// ---------------------------------------------------------------------------

/// Restore focus and inject/clipboard the final text
async fn output_text(
    app: &AppHandle,
    text: &str,
    config: &crate::config::Config,
    target_window: Option<isize>,
) {
    let output_result = if config.text_output_mode == "clipboard" {
        crate::injection::copy_to_clipboard(text)
    } else {
        // Restore focus to the original window before injecting keystrokes.
        // Must run on the main thread so AttachThreadInput has a proper
        // Windows message queue (tokio worker threads don't have one).
        if let Some(hwnd) = target_window {
            let (tx, rx) = tokio::sync::oneshot::channel();
            let _ = app.run_on_main_thread(move || {
                let _ = tx.send(crate::injection::restore_focus(hwnd));
            });
            let focused = rx.await.unwrap_or(false);

            if focused {
                tokio::time::sleep(FOCUS_RESTORE_DELAY).await;
            } else {
                log::warn!(
                    "Failed to restore focus to window (HWND: {}). Text will inject to current focus.",
                    hwnd
                );
            }
        }
        crate::injection::inject_text(text, config.trailing_space)
    };
    if let Err(e) = output_result {
        log::error!("Text output failed: {}", e);
        let player = app.state::<Option<crate::sound::SoundPlayer>>();
        crate::sound::play_if_enabled(player.inner(), crate::sound::SoundEffect::Error);
        let _ = app.emit(events::TRANSCRIPTION_ERROR, &format!("Output failed: {}", e));
    } else {
        let player = app.state::<Option<crate::sound::SoundPlayer>>();
        crate::sound::play_if_enabled(player.inner(), crate::sound::SoundEffect::Done);
        let _ = app.emit(events::OUTPUT_COMPLETE, ());
    }
}

/// Run LLM post-processing, output the result, and hide the pill
pub(crate) async fn execute_llm_output(
    app: &AppHandle,
    state_data: &Arc<Mutex<RecordingStateData>>,
    pending_confirmation: &Arc<Mutex<Option<PendingConfirmation>>>,
    pending: PendingConfirmation,
) {
    let final_text = crate::llm::post_process(&pending.raw_text, &pending.config).await;
    output_text(app, &final_text, &pending.config, pending.target_window).await;
    save_history_entry(app, &pending.raw_text, &final_text, pending.meta.as_ref(), &pending.config, true);
    hide_pill_after_delay(app, state_data, pending_confirmation, Duration::from_secs(2));
}

/// Output the raw text (skip LLM) and hide the pill
pub(crate) async fn execute_raw_output(
    app: &AppHandle,
    state_data: &Arc<Mutex<RecordingStateData>>,
    pending_confirmation: &Arc<Mutex<Option<PendingConfirmation>>>,
    pending: PendingConfirmation,
) {
    output_text(app, &pending.raw_text, &pending.config, pending.target_window).await;
    save_history_entry(app, &pending.raw_text, &pending.raw_text, pending.meta.as_ref(), &pending.config, false);
    hide_pill_after_delay(app, state_data, pending_confirmation, Duration::from_secs(2));
}

// ---------------------------------------------------------------------------
// Transcription event handlers
// ---------------------------------------------------------------------------

/// Handle transcription-complete event: reset state, run LLM, inject text
fn handle_transcription_complete(
    event: tauri::Event,
    state_data: &Arc<Mutex<RecordingStateData>>,
    pending_confirmation: &Arc<Mutex<Option<PendingConfirmation>>>,
    app: &AppHandle,
    expected_id: u64,
) {
    let text: String = match serde_json::from_str(event.payload()) {
        Ok(t) => t,
        Err(e) => {
            log::warn!("Failed to parse transcription event payload: {}", e);
            String::new()
        }
    };

    let (target_window, meta) = {
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
        let target = guard.last_target_window.take();
        let meta = guard.transcription_meta.take();
        (target, meta)
    };

    if text.trim().is_empty() {
        hide_pill_after_delay(app, state_data, pending_confirmation, Duration::from_secs(2));
        return;
    }

    let config = crate::config::load_config();
    let llm_will_process = crate::llm::should_process(&config);
    let needs_confirmation = llm_will_process && config.llm_confirm_before_processing;

    if needs_confirmation {
        // Store pending confirmation for user to approve/decline
        {
            let mut guard = pending_confirmation.lock().unwrap_or_else(|e| e.into_inner());
            *guard = Some(PendingConfirmation {
                raw_text: text,
                config,
                target_window,
                meta,
            });
        }

        let _ = app.emit(events::LLM_CONFIRM_REQUEST, ());
        let player = app.state::<Option<crate::sound::SoundPlayer>>();
        crate::sound::play_if_enabled(player.inner(), crate::sound::SoundEffect::Confirm);

        // Give the pill focus so keyboard events reach it
        if let Some(pill) = app.get_webview_window("pill") {
            let _ = pill.set_focus();
        }

        // Spawn timeout task
        let pc_timeout = pending_confirmation.clone();
        let sd_timeout = state_data.clone();
        let app_timeout = app.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(CONFIRM_TIMEOUT).await;
            // Only act if pending is still there (user hasn't responded yet)
            let pending = pc_timeout.lock().unwrap_or_else(|e| e.into_inner()).take();
            if let Some(pending) = pending {
                log::info!("LLM confirmation timed out, outputting raw text");
                let _ = app_timeout.emit(events::LLM_CONFIRM_TIMEOUT, ());
                execute_raw_output(&app_timeout, &sd_timeout, &pc_timeout, pending).await;
            }
        });

        return;
    }

    if llm_will_process {
        let _ = app.emit(events::LLM_PROCESSING, ());
    }

    let app_for_task = app.clone();
    let state_for_task = state_data.clone();
    let pc_for_task = pending_confirmation.clone();

    tauri::async_runtime::spawn(async move {
        let final_text = crate::llm::post_process(&text, &config).await;
        output_text(&app_for_task, &final_text, &config, target_window).await;
        save_history_entry(&app_for_task, &text, &final_text, meta.as_ref(), &config, llm_will_process);

        if llm_will_process {
            hide_pill_after_delay(&app_for_task, &state_for_task, &pc_for_task, Duration::from_secs(2));
        }
    });

    if !llm_will_process {
        hide_pill_after_delay(app, state_data, pending_confirmation, Duration::from_secs(2));
    }
}

/// Handle transcription-error event: reset state and hide pill
fn handle_transcription_error(
    state_data: &Arc<Mutex<RecordingStateData>>,
    pending_confirmation: &Arc<Mutex<Option<PendingConfirmation>>>,
    app: &AppHandle,
    expected_id: u64,
) {
    if let Ok(mut guard) = state_data.lock() {
        if guard.transcription_id != Some(expected_id) {
            return;
        }
        guard.state = RecordingState::Idle;
        guard.transcription_id = None;
        guard.transcription_meta = None;
        guard.last_target_window = None;
    }
    let player = app.state::<Option<crate::sound::SoundPlayer>>();
    crate::sound::play_if_enabled(player.inner(), crate::sound::SoundEffect::Error);
    hide_pill_after_delay(app, state_data, pending_confirmation, Duration::from_secs(3));
}

/// Save a completed transcription to the history database
fn save_history_entry(
    app: &AppHandle,
    raw_text: &str,
    final_text: &str,
    meta: Option<&TranscriptionMeta>,
    config: &crate::config::Config,
    llm_applied: bool,
) {
    if !config.history_enabled {
        return;
    }

    let Some(meta) = meta else {
        log::warn!("No transcription metadata available for history");
        return;
    };

    let entry = crate::history::NewHistoryEntry {
        raw_text: raw_text.to_string(),
        final_text: final_text.to_string(),
        duration_ms: meta.duration_ms,
        stt_model: meta.stt_model.clone(),
        llm_applied,
        llm_provider: if llm_applied { config.llm_provider.clone() } else { None },
        llm_model: if llm_applied { config.llm_model.clone() } else { None },
        output_mode: config.text_output_mode.clone(),
    };

    let history = app.state::<crate::history::HistoryManager>();
    match history.insert(entry, config.history_max_entries) {
        Ok(saved) => {
            let _ = app.emit(events::HISTORY_ENTRY_ADDED, &saved);
        }
        Err(e) => {
            log::error!("Failed to save history entry: {e}");
        }
    }
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

/// Hide the pill window after a delay, but only if still idle and no pending confirmation
fn hide_pill_after_delay(
    app: &AppHandle,
    state_data: &Arc<Mutex<RecordingStateData>>,
    pending_confirmation: &Arc<Mutex<Option<PendingConfirmation>>>,
    delay: Duration,
) {
    if let Some(pill) = app.get_webview_window("pill") {
        let state_for_hide = state_data.clone();
        let pc_for_hide = pending_confirmation.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(delay).await;
            let is_idle = state_for_hide
                .lock()
                .map(|s| s.state == RecordingState::Idle)
                .unwrap_or(true);
            let has_pending = pc_for_hide
                .lock()
                .map(|p| p.is_some())
                .unwrap_or(false);
            if is_idle && !has_pending {
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
    } else if error.contains("engine is busy") {
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
