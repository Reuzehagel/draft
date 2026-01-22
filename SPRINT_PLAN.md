# Draft - Sprint Plan

## Overview

This document outlines the development plan for Draft, a Windows push-to-talk dictation app. The plan is organized into 7 sprints, each resulting in demoable, testable software that builds on previous work.

**Key Principles:**

- Each task is atomic and committable
- Each sprint ends with demoable functionality
- Dependencies are explicitly ordered
- Validation criteria are defined for each task

---

## Sprint 0: Build Verification & Risk Mitigation ✅

**Goal:** Verify all critical dependencies compile and work on Windows before committing to architecture.

**Demo:** Standalone test programs proving each technology works.

**Status:** Complete

### Tasks

#### 0.1 Verify whisper-rs builds on Windows ✅

- [x] Create minimal Rust project with whisper-rs dependency
- [x] Ensure CMake/MSVC toolchain is properly configured
- [x] Compile and link successfully
- **Validation:** `cargo build` succeeds with whisper-rs
- **Result:** `tests/sprint0/test-whisper/` - builds and runs successfully

#### 0.2 Verify cpal audio capture works ✅

- [x] Create minimal program that captures microphone audio
- [x] Write captured audio to WAV file
- [x] Play back to verify quality
- **Validation:** WAV file contains recognizable audio
- **Result:** `tests/sprint0/test-cpal/` - records 3s audio to WAV, WASAPI host detected

#### 0.3 Verify enigo text injection works ✅

- [x] Create minimal program that injects text into Notepad
- [x] Test with ASCII, Unicode, and special characters
- **Validation:** Text appears correctly in Notepad
- **Result:** `tests/sprint0/test-enigo/` - ASCII, Unicode, special chars, emoji all work

#### 0.4 Verify Tauri v2 plugins are compatible ✅

- [x] Test `tauri-plugin-global-shortcut` v2
- [x] Test `tauri-plugin-notification` v2
- [x] Test `tauri-plugin-autostart` v2
- **Validation:** All plugins initialize without error in Tauri v2 app
- **Result:** All three plugins added to `src-tauri/Cargo.toml` and initialize in `lib.rs`

#### 0.5 Verify windows-rs focus management ✅

- [x] Create minimal program using `GetForegroundWindow()` and `SetForegroundWindow()`
- [x] Capture window handle, switch to another app, restore focus
- **Validation:** Focus correctly captured and restored
- **Result:** `tests/sprint0/test-windows-focus/` - captures HWND, restores focus successfully

#### 0.6 Document build requirements ✅

- [x] Document required Windows SDK version
- [x] Document CMake/MSVC setup steps
- [x] Document any environment variables needed
- **Validation:** Fresh Windows machine can build project following docs
- **Result:** Created `BUILD.md` with full setup instructions

### Verified Toolchain

| Tool    | Version |
| ------- | ------- |
| Rust    | 1.90.0  |
| CMake   | 4.2.1   |
| Node.js | 25.2.1  |
| Bun     | 1.3.5   |

---

## Sprint 1: Foundation & Shell ✅

**Goal:** Basic Tauri app with two windows (settings + pill), system tray, config persistence, and UI scaffolding for all pill states.

**Demo:** App launches with settings window, pill overlay can be toggled, tray icon works, settings persist.

**Status:** Complete

### Tasks

#### 1.1 Initialize Tauri v2 project with React ✅

- [x] Create new Tauri v2 project: `npm create tauri-app@latest`
- [x] Select React + TypeScript template
- [x] Configure ESLint, Prettier
- [x] Add `@tauri-apps/api` to package.json
- **Validation:** `npm run dev` opens window, `cargo build` succeeds
- **Result:** Project initialized in Sprint 0, `@tauri-apps/api` added

#### 1.2 Configure Cargo.toml with all dependencies ✅

- [x] Add Sprint 1 dependencies (dirs for config path resolution)
- [x] Sprint 2+ dependencies commented out until needed (whisper-rs has Windows build issues)
- [x] Tauri tray-icon feature enabled
- **Validation:** `cargo check` succeeds
- **Result:** `src-tauri/Cargo.toml` configured with required dependencies

#### 1.3 Set up multi-window entry points ✅

- [x] Create `settings.html` and `pill.html` in project root
- [x] Configure Vite for multi-page build in `vite.config.ts`
- [x] Create `src/settings/main.tsx` and `src/pill/main.tsx` entry points
- [x] Create `SettingsApp.tsx` and `PillApp.tsx` entry components
- **Validation:** Both HTML files build correctly
- **Result:** Multi-page Vite config with separate entry points

#### 1.4 Configure dual-window architecture in Tauri ✅

- [x] Configure `tauri.conf.json` for two windows:
  - `settings`: 500x600, resizable, min 400x500, hidden by default
  - `pill`: 200x40, transparent, no decorations, always_on_top, skip_taskbar
- [x] Assign unique window labels (`settings`, `pill`)
- [x] Update capabilities to reference correct window names
- **Validation:** Both windows created with correct properties
- **Result:** `src-tauri/tauri.conf.json` and `src-tauri/capabilities/default.json` configured

#### 1.5 Implement settings window layout ✅

- [x] Create section scaffolding: Audio, Hotkey, Models, General
- [x] Add version number in header (v0.1.0)
- [x] Single scrollable page layout with separators
- **Validation:** All sections render with placeholder content
- **Result:** `src/settings/SettingsApp.tsx` with full section layout

#### 1.6 Implement system theme detection ✅

- [x] CSS `prefers-color-scheme` media query for dark/light theme
- [x] Tailwind dark mode configuration via CSS custom properties
- **Validation:** UI follows system theme
- **Result:** Theme support via existing `src/index.css` variables

#### 1.7 Implement pill overlay base component ✅

- [x] Dark semi-transparent background (#1a1a1a at 90% opacity)
- [x] Fixed size: 200×40px with rounded corners
- [x] Styled in `src/pill/pill.css`
- **Validation:** Pill renders with correct styling
- **Result:** `src/pill/PillApp.tsx` and `src/pill/pill.css`

#### 1.8 Implement pill fade animations ✅

- [x] Fade in: 150ms ease-out
- [x] Fade out: 150ms ease-in
- [x] CSS transitions defined in pill.css
- **Validation:** Smooth fade in/out on show/hide
- **Result:** `.pill-enter-active` and `.pill-exit-active` classes

#### 1.9 Implement pill state components - Loading ✅

- [x] "Loading model..." text with spinner
- [x] Reusable Spinner component
- **Validation:** Loading state renders correctly
- **Result:** `src/pill/components/Spinner.tsx`, state in PillApp

#### 1.10 Implement pill state components - Recording (placeholder) ✅

- [x] Placeholder waveform with animated bars
- [x] 14 vertical bars with random/animated heights
- **Validation:** Recording state shows placeholder visualization
- **Result:** `src/pill/components/Waveform.tsx`

#### 1.11 Implement pill state components - Transcribing ✅

- [x] "Transcribing..." text with spinner
- [x] Spinner component reused from loading state
- **Validation:** Transcribing state renders correctly
- **Result:** State handling in `src/pill/PillApp.tsx`

#### 1.12 Implement pill state components - Error ✅

- [x] Error message display with red-tinted background
- [x] Auto-hide after 2 seconds via setTimeout
- **Validation:** Error state shows message, auto-hides
- **Result:** Error state handling in PillApp with `.error` CSS class

#### 1.13 Implement pill state transitions ✅

- [x] State machine: idle, loading, recording, transcribing, error
- [x] Event listeners for state transitions
- [x] Dev mode keyboard shortcuts (1-4, 0) for testing states
- **Validation:** State transitions work correctly
- **Result:** Full state management in PillApp.tsx

#### 1.14 Create system tray with icon ✅

- [x] Tray icon using app default icon
- [x] Tooltip: "Draft"
- [x] Configured in `tauri.conf.json` trayIcon section
- **Validation:** Tray icon appears in system tray
- **Result:** TrayIconBuilder in `src-tauri/src/lib.rs`

#### 1.15 Implement tray right-click menu ✅

- [x] Menu items: "Open Settings", "Exit"
- [x] "Open Settings" shows and focuses settings window
- [x] "Exit" quits application
- **Validation:** Menu appears on right-click, items work
- **Result:** Menu built with tauri::menu API in lib.rs

#### 1.16 Implement tray left-click behavior ✅

- [x] Left-click opens/focuses settings window
- [x] Same behavior as "Open Settings" menu item
- **Validation:** Left-click opens settings
- **Result:** `on_tray_icon_event` handler in lib.rs

#### 1.17 Implement window close behavior ✅

- [x] X button on settings hides window (prevents close)
- [x] Window can be reopened from tray
- **Validation:** X hides window, tray reopens it
- **Result:** `on_window_event` with `CloseRequested` handler

#### 1.18 Create configuration module and types ✅

- [x] Define `Config` struct in Rust with all fields
- [x] Implement Default trait with spec defaults
- **Validation:** Config struct compiles with correct fields
- **Result:** `src-tauri/src/config.rs`

#### 1.19 Implement config file persistence ✅

- [x] Location: `%APPDATA%/Draft/config.json` via `dirs` crate
- [x] Create directory if missing
- [x] JSON serialization/deserialization
- [x] Handle missing file (return defaults)
- [x] Handle corrupt file (return defaults, log warning)
- **Validation:** Config saves and loads correctly
- **Result:** `load_config()` and `save_config()` in config.rs

#### 1.20 Implement get_config and set_config commands ✅

- [x] `get_config()` → returns current Config
- [x] `set_config(config: Config)` → saves to file
- [x] Register as Tauri commands
- **Validation:** Frontend can read/write config
- **Result:** Commands registered in lib.rs invoke_handler

#### 1.21 Create TypeScript types matching Rust types ✅

- [x] Create `src/shared/types/config.ts`
- [x] Mirror Config struct exactly
- **Validation:** Types match Rust definitions
- **Result:** TypeScript interface with all Config fields

#### 1.22 Wire up settings persistence ✅

- [x] Load config on app start via useEffect
- [x] Save on settings change via invoke
- [x] Debounce saves (300ms) via custom debounce
- **Validation:** Settings persist across restart
- **Result:** `useConfig` hook in SettingsApp.tsx

#### 1.23 Implement first-run detection ✅

- [x] Detect if config file exists via `is_first_run()`
- [x] `check_first_run` command exposed to frontend
- [x] Open settings window immediately on first run
- **Validation:** Fresh install opens settings
- **Result:** First-run check in lib.rs setup

#### 1.24 Create event name constants ✅

- [x] Create `src-tauri/src/events.rs` with event name constants
- [x] Create `src/shared/constants/events.ts` mirroring Rust
- **Validation:** Constants match between Rust and TypeScript
- **Result:** Both files created with matching constants

### Sprint 1 Acceptance Criteria

- [x] App launches with settings window on first run
- [x] Pill window can be shown/hidden with fade animations
- [x] All pill states render correctly (loading, recording placeholder, transcribing, error)
- [x] System tray icon appears with working menu
- [x] X button hides settings to tray (does not exit)
- [x] Tray left-click and "Open Settings" open settings window
- [x] "Exit" quits application completely
- [x] Configuration saves to `%APPDATA%/Draft/config.json`
- [x] Configuration loads correctly on restart

### Notes

- Tauri v2 plugins use capabilities system, not `plugins` section in tauri.conf.json
- whisper-rs commented out due to Windows build issues with bundled bindings (will address in Sprint 4)
- Pill can be tested in dev mode via keyboard shortcuts (1-4, 0) or by navigating to `http://localhost:5173/pill.html`

---

## Sprint 2: Audio Pipeline ✅

**Goal:** Complete audio capture, resampling, amplitude visualization, and working microphone test.

**Demo:** Settings shows microphone dropdown, test button shows real-time waveform, amplitude events flow to pill.

**Status:** Complete

### Tasks

#### 2.1 Create audio module structure ✅

- [x] Create `src-tauri/src/audio/mod.rs`
- [x] Create `src-tauri/src/audio/capture.rs`
- [x] Create `src-tauri/src/audio/resampler.rs`
- [x] Create `src-tauri/src/audio/amplitude.rs`
- [x] Create `src-tauri/src/audio/buffer.rs`
- [x] Create `src-tauri/src/audio/worker.rs`
- [x] Create `src-tauri/src/audio/devices.rs`
- [x] Define public API types
- **Validation:** Module compiles, exports are accessible from lib.rs
- **Result:** Full audio module structure with 7 files

#### 2.2 Implement microphone enumeration ✅

- [x] Use cpal `default_host()` and `input_devices()`
- [x] Filter to input devices only
- [x] Return `Vec<MicrophoneInfo>` with id and name
- [x] Handle "System Default" as first option (id = empty string)
- **Validation:** Returns correct list of input devices
- **Result:** `list_microphones` in `devices.rs`

#### 2.3 Implement list_microphones command ✅

- [x] Tauri command wrapping enumeration
- [x] Returns device list to frontend
- **Validation:** Frontend receives correct device list
- **Result:** Command registered in `lib.rs`

#### 2.4 Build microphone dropdown UI ✅

- [x] Dropdown component in Audio section
- [x] First option: "System Default"
- [x] Lists all available devices by name
- [x] Shows "No microphones detected" when empty
- [x] Saves selection to config
- **Validation:** Dropdown populates correctly, selection persists
- **Result:** Updated `SettingsApp.tsx` with real microphone list

#### 2.5 Design lock-free audio buffer ✅

- [x] Use crossbeam bounded channel
- [x] Capacity: 5 seconds at 48kHz stereo (~480,000 samples)
- [x] Sample format: f32
- [x] Document overrun policy (drop on overflow)
- **Validation:** Design documented, types defined
- **Result:** `buffer.rs` with AudioProducer/AudioConsumer

#### 2.6 Implement lock-free audio buffer ✅

- [x] Producer API: `push(samples: &[f32])` - non-blocking
- [x] Consumer API: `drain_into(&mut Vec<f32>)` - collects all available
- [x] Atomic stop flag for clean shutdown
- **Validation:** Unit tests pass for push/drain/shutdown
- **Result:** Lock-free buffer with tests

#### 2.7 Implement cpal audio stream ✅

- [x] Open device by ID (or default)
- [x] Configure for device's native format
- [x] Store sample rate and channel count for resampling
- [x] Start/stop stream control
- **Validation:** Stream starts and stops without error
- **Result:** `capture.rs` with AudioCapture struct

#### 2.8 Implement audio callback ✅

- [x] Write samples to lock-free buffer
- [x] No allocations in callback
- [x] No mutex locks in callback
- [x] Support F32, I16, U16 sample formats
- **Validation:** Callback is real-time safe
- **Result:** Callbacks in `capture.rs` build_stream method

#### 2.9 Implement device disconnection handling ✅

- [x] Detect device disconnect via cpal error callback
- [x] Set error flag, stop stream gracefully
- **Validation:** Disconnect handled without crash
- **Result:** Error callback sets AtomicBool flag

#### 2.10 Create audio worker thread ✅

- [x] Background thread that reads from ring buffer
- [x] Runs continuously while recording
- [x] Clean shutdown on stop signal
- [x] Drains remaining samples before exit
- **Validation:** Worker starts, processes, and stops cleanly
- **Result:** `worker.rs` with AudioWorker struct

#### 2.11 Implement stereo to mono conversion ✅

- [x] Average left and right channels
- [x] Handle mono input (pass through)
- **Validation:** Output is mono regardless of input
- **Result:** `to_mono()` method in `resampler.rs`

#### 2.12 Implement sample rate conversion with rubato ✅

- [x] Configure rubato 1.0 with SincInterpolationParameters
- [x] Support common input rates via ratio-based resampling
- [x] Output: 16kHz mono
- **Validation:** Output sample rate is exactly 16kHz
- **Result:** `resampler.rs` with rubato Async resampler

#### 2.13 Wire up resampling in worker thread ✅

- [x] Worker thread calls resampler
- [x] Accumulates resampled samples for transcription
- **Validation:** Resampled audio passed through pipeline
- **Result:** Worker loop processes through resampler

#### 2.14 Implement RMS amplitude calculation ✅

- [x] Calculate RMS over 80ms window (1280 samples at 16kHz)
- [x] Sliding window approach with 50% overlap
- [x] Normalize to 0.0-1.0 range
- **Validation:** Amplitude values correspond to actual audio levels
- **Result:** `amplitude.rs` with AmplitudeCalculator

#### 2.15 Implement amplitude event emission ✅

- [x] Emit `amplitude` event with Vec<f32> (14 values)
- [x] Throttle to ~30fps (33ms interval)
- [x] Only emit during recording/testing
- **Validation:** Frontend receives amplitude at correct rate
- **Result:** Event emission in worker loop

#### 2.16 Build waveform component ✅

- [x] 14 vertical bars
- [x] Bar height represents amplitude (0.0-1.0 → 4-20px)
- [x] Monochrome (white/light gray)
- [x] Smooth bar height transitions (75ms)
- **Validation:** Bars animate based on amplitude events
- **Result:** `Waveform.tsx` (already existed from Sprint 1)

#### 2.17 Connect waveform to amplitude events ✅

- [x] Listen to `amplitude` events in pill
- [x] Update waveform state
- [x] Ring buffer of 14 values for bar display
- **Validation:** Waveform shows real-time audio levels
- **Result:** `PillApp.tsx` already wired (Sprint 1)

#### 2.18 Implement test_microphone command ✅

- [x] Accepts optional device_id parameter
- [x] Starts capture, emits amplitude events
- [x] Auto-stops after 5 seconds
- [x] Emits `test-microphone-complete` event
- **Validation:** Test runs for exactly 5 seconds
- **Result:** `test_microphone` command in `devices.rs`

#### 2.19 Build test button UI ✅

- [x] Button in Audio section: "Test Microphone"
- [x] Disables while test running
- [x] Shows "Testing..." label during test
- [x] Displays real-time waveform during test
- **Validation:** Visual feedback matches microphone input
- **Result:** Test button with inline waveform in `SettingsApp.tsx`

#### 2.20 Implement System Default resolution ✅

- [x] Resolve empty/default ID to `host.default_input_device()`
- [x] Resolution happens at capture start time
- **Validation:** Uses current Windows default device
- **Result:** `resolve_device()` in `devices.rs`

### Sprint 2 Acceptance Criteria

- [x] Microphone dropdown lists "System Default" + all devices
- [x] Test button starts 5-second test
- [x] Real-time audio level shows during test
- [x] Waveform component animates based on actual audio
- [x] Amplitude events emit at ~30fps
- [x] Audio is resampled to 16kHz mono
- [x] Device disconnection sets error flag without crash
- [x] "No microphones detected" shown when appropriate

### Notes

- Using rubato 1.0 with audioadapter-buffers 2.0 for resampling
- cpal 0.17 deprecates `device.name()` in favor of `device.description()` - using name() for now
- Worker thread returns accumulated 16kHz mono audio for future transcription use

---

## Sprint 3: Model Management ✅

**Goal:** Download, validate, store, and manage Whisper models with full UI.

**Demo:** Can download any model with progress bar, delete models, see downloaded vs available.

**Status:** Complete

### Tasks

#### 3.1 Create STT module structure ✅

- [x] Create `src-tauri/src/stt/mod.rs`
- [x] Create `src-tauri/src/stt/commands.rs`
- [x] Create `src-tauri/src/stt/download.rs`
- [x] Create `src-tauri/src/stt/models.rs`
- **Validation:** Module compiles, exports accessible
- **Result:** Full stt module structure with 4 files

#### 3.2 Define model metadata constants ✅

- [x] Hardcode 8 models: tiny, tiny.en, base, base.en, small, small.en, medium, medium.en
- [x] Include for each:
  - Name
  - Size in bytes
  - Download URL (Hugging Face)
  - SHA256 checksum
- **Validation:** All model info matches Hugging Face repo
- **Result:** `MODELS` array in `models.rs`

#### 3.3 Implement model path resolution ✅

- [x] Base path: `%APPDATA%/Draft/models/`
- [x] Create directory if missing
- [x] `model_path(filename: &str) -> PathBuf`
- **Validation:** Paths resolve correctly, directory created
- **Result:** `models_dir()` and `model_path()` in `models.rs`

#### 3.4 Implement model file existence check ✅

- [x] Check if model file exists on disk
- [x] Used by list_models to determine downloaded status
- **Validation:** Correctly identifies downloaded models
- **Result:** `get_all_models()` checks file existence

#### 3.5 Implement list_models command ✅

- [x] Returns all 8 models with:
  - id: String
  - name: String
  - size: u64
  - downloaded: bool
- **Validation:** Returns correct data for all models
- **Result:** `list_models` command in `commands.rs`

#### 3.6 Create TypeScript model types ✅

- [x] Create `src/shared/types/models.ts`
- [x] Mirror Rust model types
- [x] Add `formatFileSize` utility function
- **Validation:** Types match Rust definitions
- **Result:** `ModelInfo` and `DownloadProgress` types

#### 3.7 Build models section UI - layout ✅

- [x] Section header: "Models"
- [x] Two subsections: "Downloaded" and "Available"
- **Validation:** Section structure renders correctly
- **Result:** Updated `SettingsApp.tsx`

#### 3.8 Build downloaded models list UI ✅

- [x] List each downloaded model with:
  - Model name
  - File size (human readable, e.g., "1.5 GB")
  - Radio button to select active model
  - Delete button
- [x] Active model highlighted via radio selection
- **Validation:** Downloaded models display correctly
- **Result:** Radio buttons with delete buttons in settings

#### 3.9 Build available models list UI ✅

- [x] List each not-downloaded model with:
  - Model name
  - File size
  - Download button
- **Validation:** Available models display correctly
- **Result:** Download buttons for each available model

#### 3.10 Implement disk space check ✅

- [x] Before download, check available disk space
- [x] Require at least model size + 100MB buffer
- [x] Return error if insufficient space
- **Validation:** Insufficient space shows error before download starts
- **Result:** `check_disk_space()` in `download.rs`

#### 3.11 Implement download stream setup ✅

- [x] Configure reqwest client with streaming
- [x] User-Agent header
- **Validation:** Download stream initializes correctly
- **Result:** Streaming download in `download.rs`

#### 3.12 Implement download progress tracking ✅

- [x] Track bytes downloaded vs total size
- [x] Calculate percentage (0-100)
- **Validation:** Progress calculation is accurate
- **Result:** Progress calculation in download loop

#### 3.13 Implement download-progress event emission ✅

- [x] Emit `download-progress` event with model, progress, bytes
- [x] Throttle to every 1% change
- **Validation:** Frontend receives progress updates
- **Result:** Event emission in `download.rs`

#### 3.14 Implement download file writing ✅

- [x] Write to temp file: `{model}.bin.tmp`
- [x] Atomic rename on completion
- **Validation:** Download completes with correct filename
- **Result:** Temp file with rename in `download.rs`

#### 3.15 Implement download_model command ✅

- [x] Accepts model id
- [x] Validates model exists in metadata
- [x] Checks disk space
- [x] Starts download with progress events
- **Validation:** Download command works end-to-end
- **Result:** `download_model` command in `commands.rs`

#### 3.16 Build download progress UI ✅

- [x] Progress bar showing percentage
- [x] Model name displayed
- [x] Disable other download buttons while downloading
- **Validation:** Progress bar updates during download
- **Result:** `Progress` component in settings

#### 3.17 Implement download cancellation ✅

- [x] Store cancellation token with download state
- [x] Cancel button triggers token
- [x] Delete partial file on cancel
- **Validation:** Cancel stops download, removes partial file
- **Result:** AtomicBool cancel token in `DownloadState`

#### 3.18 Build cancel button UI ✅

- [x] Cancel button replaces download button during download
- [x] Clicking cancels and restores UI to available state
- **Validation:** Cancel button works correctly
- **Result:** Cancel button in settings UI

#### 3.19 Implement SHA256 checksum validation ✅

- [x] After download complete, compute SHA256 of file
- [x] Compare against hardcoded checksum
- [x] Delete file if mismatch
- **Validation:** Corrupt downloads detected and removed
- **Result:** `verify_checksum()` in `download.rs`

#### 3.20 Handle checksum mismatch error ✅

- [x] Show error in UI
- [x] Remove corrupted file
- [x] Re-enable download button
- **Validation:** Error displayed, file removed
- **Result:** Error handling in download flow

#### 3.21 Handle interrupted downloads ✅

- [x] Detect incomplete downloads (connection error, etc.)
- [x] Delete partial .tmp file
- [x] Show error in UI
- **Validation:** Partial files cleaned up on error
- **Result:** Cleanup in download error paths

#### 3.22 Implement delete_model command ✅

- [x] Delete model file from disk
- **Validation:** File removed
- **Result:** `delete_model` command in `commands.rs`

#### 3.23 Build delete confirmation ✅

- [x] Show confirmation dialog before delete
- [x] "Delete {model}?" with description
- **Validation:** Confirmation prevents accidental deletion
- **Result:** AlertDialog in settings UI

#### 3.24 Wire up delete button ✅

- [x] Click shows confirmation
- [x] On confirm, calls delete_model
- [x] Updates UI to show model as available
- [x] Clears selection if deleted model was selected
- **Validation:** Delete flow works end-to-end
- **Result:** Delete handler in SettingsApp

#### 3.25 Implement first-model auto-select ✅

- [x] On app load, if no model selected and models downloaded, auto-select first
- **Validation:** First download becomes active automatically
- **Result:** useEffect in SettingsApp

#### 3.26 Add download complete notification

- [ ] In-app toast notification on download complete (deferred - not critical for MVP)
- **Note:** Progress bar completion serves as visual feedback

#### 3.27 Implement concurrent download blocking ✅

- [x] Only allow one download at a time
- [x] Reject additional download requests with error
- **Validation:** Cannot start second download while one in progress
- **Result:** `current_download` mutex in `DownloadState`

### Sprint 3 Acceptance Criteria

- [x] All 8 Whisper models listed (downloaded + available)
- [x] Download shows progress bar with percentage
- [x] Download can be cancelled
- [x] SHA256 validation catches corrupt downloads
- [x] Corrupt downloads deleted with error message
- [x] Insufficient disk space shows error before download
- [x] Delete removes model from disk
- [x] Delete confirmation prevents accidents
- [x] First downloaded model auto-selected
- [x] Subsequent downloads not auto-selected
- [x] Only one download at a time
- [ ] Toast notification on download complete (deferred)

### Notes

- Using reqwest 0.12 (not 0.13) for streaming downloads
- Download progress emitted via Tauri events, listened in useModels hook
- Rust 2024 edition requires `unsafe extern` blocks for FFI

---

## Sprint 4: Whisper Integration

**Goal:** Load Whisper models and perform transcription with proper threading.

**Demo:** Can trigger test transcription from UI, see loading and transcribing states in pill.

### Tasks

#### 4.1 Create Whisper wrapper types

- Create struct for Whisper context
- Handle whisper-rs types safely
- Send/Sync considerations for threading
- **Validation:** Types compile, thread-safe

#### 4.2 Implement model loading function

- Load GGML model file into whisper-rs context
- Configure: language auto-detect, no timestamps
- Return loaded context or error
- **Validation:** Model loads successfully

#### 4.3 Create model loading thread

- Dedicated thread for model loading
- Uses channel to receive load requests
- Uses channel to send results back
- **Validation:** Model loads without blocking main thread

#### 4.4 Implement model caching

- Keep loaded model in application state
- Only reload when different model selected
- Unload previous model when switching
- **Validation:** Second transcription doesn't reload model

#### 4.5 Implement model unloading

- Explicit unload when switching models
- Clean up whisper-rs resources
- **Validation:** Memory released on model switch

#### 4.6 Create transcription thread

- Dedicated thread for Whisper inference
- Receives audio samples via channel
- Sends results back via channel
- **Validation:** Transcription runs on background thread

#### 4.7 Implement transcription function

- Accept 16kHz mono f32 samples
- Run Whisper inference
- Return transcription text
- **Validation:** Audio transcribes to text correctly

#### 4.8 Configure Whisper parameters

- Language: auto-detect
- Timestamps: disabled
- Use defaults for beam size, temperature
- **Validation:** Parameters applied correctly

#### 4.9 Implement transcription-complete event

- Emit `transcription-complete` with `{text: String}`
- Emit after successful transcription
- **Validation:** Frontend receives completion event

#### 4.10 Implement transcription-error event

- Emit `transcription-error` with `{error: String}`
- Emit on any transcription failure
- **Validation:** Frontend receives error event

#### 4.11 Handle empty transcription result

- Detect empty or whitespace-only text
- Do NOT emit transcription-complete (silent handling)
- Emit internal "empty" event for pill to fade
- **Validation:** Empty audio doesn't trigger text output

#### 4.12 Implement model load error handling

- Detect corrupt/invalid model files
- Return descriptive error
- Suggest redownload
- **Validation:** Bad model shows error, doesn't crash

#### 4.13 Implement model loading state tracking

- Track if model is loading, loaded, or error
- Expose state to frontend
- **Validation:** State accurately reflects model status

#### 4.14 Wire up pill "Loading model..." state

- Show loading state when transcription triggered but model not ready
- Subscribe to model loading events
- **Validation:** Loading state visible during model load

#### 4.15 Wire up pill "Transcribing..." state

- Transition from recording to transcribing
- Show until transcription-complete or transcription-error
- **Validation:** State changes at correct times

#### 4.16 Wire up pill error state

- On transcription-error, show error message
- Display for 2 seconds, then fade
- **Validation:** Errors displayed appropriately

#### 4.17 Block model switching during busy states

- Disable model radio buttons during:
  - Model loading
  - Recording
  - Transcribing
- Re-enable when idle
- **Validation:** Cannot switch models mid-operation

#### 4.18 Add test transcription feature (temporary)

- Button in settings: "Test Transcription"
- Uses bundled test audio file or records 3 seconds
- Shows result in dialog
- **Validation:** Can verify transcription works without hotkey

### Sprint 4 Acceptance Criteria

- [ ] Whisper model loads successfully
- [ ] Model loading happens on background thread (UI responsive)
- [ ] Pill shows "Loading model..." during model load
- [ ] Test transcription produces correct text
- [ ] Pill shows "Transcribing..." during inference
- [ ] transcription-complete event received with text
- [ ] transcription-error event received on failure
- [ ] Empty transcription handled silently
- [ ] Model switching blocked during busy states
- [ ] Model stays cached after first load

---

## Sprint 5: Hotkey & Recording Flow

**Goal:** Global hotkey registration, push-to-talk recording, and complete recording state machine.

**Demo:** Can set hotkey in UI, hold hotkey to record with waveform, release to transcribe.

### Tasks

#### 5.1 Add tauri-plugin-global-shortcut

- Add plugin dependency
- Configure in tauri.conf.json
- Initialize in lib.rs
- **Validation:** Plugin loads without error

#### 5.2 Implement hotkey registration

- Register hotkey from config
- Handle press and release events separately
- Support modifier + key combinations
- **Validation:** Hotkey events fire correctly

#### 5.3 Implement hotkey validation rules

- Allow bare keys: F1-F24, etc.
- Allow modifier + key: Ctrl+Space, Alt+D, etc.
- Block modifier-only: Ctrl alone, Shift+Alt, etc.
- **Validation:** Invalid combinations rejected with error

#### 5.4 Implement hotkey conflict detection

- Detect if hotkey already registered by another app
- Return error with helpful message
- Suggest trying different combination
- **Validation:** Conflicts detected and reported

#### 5.5 Build hotkey capture UI

- Display current hotkey: "Ctrl+Shift+D" or "Not Set"
- Click to enter capture mode
- Show "Press a key combination..."
- Capture next key press
- Show error for invalid combinations
- **Validation:** Can set new hotkey via UI

#### 5.6 Implement hotkey change handling

- Unregister old hotkey
- Register new hotkey
- Save to config
- Handle registration failure gracefully
- **Validation:** Hotkey changes apply immediately

#### 5.7 Implement recording state machine

- Define states: Idle, Recording, Transcribing
- Define transitions:
  - Idle + hotkey_press → Recording
  - Recording + hotkey_release → Transcribing
  - Transcribing + complete → Idle
  - Transcribing + error → Idle
- **Validation:** State transitions correct

#### 5.8 Implement state transition guards

- Cannot start recording while transcribing
- Cannot start recording while model loading
- Log ignored inputs
- **Validation:** Invalid transitions prevented

#### 5.9 Implement double-press handling

- Track key-down state
- Ignore repeat key events (held keys)
- Only respond to initial press and final release
- **Validation:** Holding key doesn't restart recording

#### 5.10 Implement 120-second max duration

- Timer starts on recording start
- Auto-stop at 120 seconds
- Proceed to transcription
- **Validation:** Long recordings auto-stop at limit

#### 5.11 Emit recording-started event

- Fire when transitioning to Recording state
- Triggers pill to show with waveform
- **Validation:** Pill appears on hotkey press

#### 5.12 Emit recording-stopped event

- Fire when transitioning out of Recording state
- Triggers pill to show transcribing state
- **Validation:** Pill transitions on hotkey release

#### 5.13 Connect recording to audio pipeline

- On recording start: start audio capture
- On recording stop: stop audio capture, get samples
- Pass samples to transcription thread
- **Validation:** Audio flows through pipeline

#### 5.14 Wire up pill to recording events

- recording-started → show pill, recording state
- recording-stopped → transcribing state
- transcription-complete → fade out
- transcription-error → error state, then fade out
- **Validation:** Pill state matches recording state

#### 5.15 Implement first-run configuration check

- Before recording, check:
  - Hotkey is set
  - Model is downloaded and selected
  - Microphone is available
- **Validation:** Check identifies all missing requirements

#### 5.16 Add tauri-plugin-notification

- Add plugin dependency
- Configure in tauri.conf.json
- Initialize in lib.rs
- **Validation:** Plugin loads without error

#### 5.17 Implement missing configuration notification

- If recording attempted with incomplete config:
- Show Windows notification with missing items
- "Draft: Please configure: hotkey, model"
- **Validation:** Notification shows correct missing items

### Sprint 5 Acceptance Criteria

- [ ] Hotkey capture UI works ("Press a key...")
- [ ] Modifier-only combinations rejected
- [ ] Hotkey registers globally
- [ ] Hotkey conflict detection works
- [ ] Hotkey press shows pill with waveform
- [ ] Waveform animates with real audio
- [ ] Hotkey release starts transcription
- [ ] Key repeat (holding) doesn't restart recording
- [ ] Cannot record while transcribing
- [ ] 120-second limit enforced
- [ ] Missing configuration shows notification
- [ ] Pill states match recording/transcription states

---

## Sprint 6: Text Injection & Integration

**Goal:** Complete end-to-end flow with window focus management and text injection.

**Demo:** Full flow works: hold hotkey in any app, speak, release, text appears.

### Tasks

#### 6.1 Implement window focus capture

- Use windows-rs `GetForegroundWindow()`
- Call immediately on hotkey press (before showing pill)
- Store HWND in recording state
- **Validation:** Captured HWND is correct window

#### 6.2 Store target window with recording

- Include HWND in recording state
- Persist through transcription
- **Validation:** HWND available after transcription completes

#### 6.3 Implement focus restoration

- Use windows-rs `SetForegroundWindow()`
- Call before text injection
- Handle failure gracefully (window may have closed)
- **Validation:** Focus returns to original window

#### 6.4 Implement text injection with enigo

- Create enigo instance
- Inject text character-by-character
- Handle Unicode characters
- **Validation:** Text appears in target application

#### 6.5 Test text injection edge cases

- Test Unicode: emojis, accented characters, CJK
- Test special characters: newlines, tabs
- Test in different apps: Notepad, browser, VS Code
- **Validation:** Text injects correctly in various apps

#### 6.6 Implement trailing space setting

- Read "Add space after text" from config
- Append space if enabled
- **Validation:** Space added/omitted based on setting

#### 6.7 Wire up injection in transcription flow

- On transcription-complete:
  1. Get transcription text
  2. Add trailing space if enabled
  3. Restore focus to captured window
  4. Inject text
  5. Hide pill
- **Validation:** Full flow executes correctly

#### 6.8 Handle empty transcription in flow

- On empty result:
  1. Don't inject anything
  2. Fade pill silently
  3. Don't restore focus (unnecessary)
- **Validation:** Empty transcription causes silent fade only

#### 6.9 Handle injection errors

- Catch enigo errors
- Log error
- Show brief error in pill (optional, can skip in v1)
- Don't crash
- **Validation:** Injection errors handled gracefully

#### 6.10 Add trailing space setting UI

- Checkbox in General section
- Label: "Add space after text"
- Default: off
- **Validation:** Setting toggles and persists

### Sprint 6 Acceptance Criteria

- [ ] Focus captured before pill appears
- [ ] Text injects into original window (not current focus)
- [ ] Focus restored before injection
- [ ] Unicode characters inject correctly
- [ ] Trailing space setting works
- [ ] Empty transcription fades silently, no injection
- [ ] End-to-end flow works in multiple applications

---

## Sprint 7: Polish & Launch

**Goal:** Auto-start, logging, final polish, and verification checklist complete.

**Demo:** Production-ready application passing all verification criteria.

### Tasks

#### 7.1 Add tauri-plugin-autostart

- Add plugin dependency
- Configure in tauri.conf.json
- Initialize in lib.rs
- **Validation:** Plugin loads without error

#### 7.2 Implement auto-start setting

- Checkbox in General section
- Label: "Start with Windows"
- Default: off
- Uses plugin for registry management
- **Validation:** Toggle adds/removes auto-start

#### 7.3 Add auto-start setting UI

- Checkbox in General section
- Persists to config
- **Validation:** Setting toggles and persists

#### 7.4 Create logging module

- Log file location: `%APPDATA%/Draft/logs/draft.log`
- Log rotation (optional, can be simple append for v1)
- Log levels: error, warn, info, debug
- **Validation:** Log file created when enabled

#### 7.5 Implement logging setting

- Checkbox in General section
- Label: "Enable logging"
- Default: off
- **Validation:** Logs written when enabled

#### 7.6 Add logging throughout application

- Log key events: recording start/stop, transcription complete/error
- Log errors with context
- Log config changes
- **Validation:** Relevant events logged

#### 7.7 Polish pill animations

- Verify smooth fade in/out
- Verify smooth recording → transcribing transition
- Adjust timing if needed
- **Validation:** Animations feel polished

#### 7.8 Polish settings UI layout

- Consistent spacing
- Proper alignment
- Good visual hierarchy
- **Validation:** UI looks professional

#### 7.9 Implement minimum window dimensions

- Settings window min size: 400×500
- Prevent resizing below minimum
- **Validation:** Cannot resize smaller than minimum

#### 7.10 Save window position and size

- Save position on move
- Save size on resize
- Restore on next launch
- **Validation:** Window position/size persists

#### 7.11 Polish error messages

- All error messages are user-friendly
- No technical jargon exposed to user
- Actionable guidance where possible
- **Validation:** Errors are understandable

#### 7.12 Handle edge case: no microphones

- Show "No microphones detected" in dropdown
- Show helpful message in Audio section
- Disable test button
- **Validation:** No-microphone state handled gracefully

#### 7.13 Handle edge case: no models downloaded

- Clear indication that model needed
- Cannot start recording
- Configuration check catches this
- **Validation:** Missing model state handled gracefully

#### 7.14 Verification item 1: cargo build succeeds

- Clean build from scratch
- No warnings (or document accepted warnings)
- **Validation:** Build succeeds

#### 7.15 Verification item 2: npm run dev opens settings

- Dev server starts
- Settings window opens
- **Validation:** Dev mode works

#### 7.16 Verification item 3: microphone selection

- Open dropdown
- See all devices
- Select different device
- Selection persists
- **Validation:** Microphone selection works

#### 7.17 Verification item 4: test button shows audio level

- Click test button
- See real-time audio level
- Auto-stops after 5 seconds
- **Validation:** Test button works

#### 7.18 Verification item 5: model download with progress

- Click download on available model
- See progress bar
- Download completes
- **Validation:** Model download works

#### 7.19 Verification item 6: model deletion

- Click delete on downloaded model
- Confirm deletion
- Model removed from list
- **Validation:** Model deletion works

#### 7.20 Verification item 7: hotkey setting

- Click hotkey field
- Press key combination
- Hotkey saved
- **Validation:** Hotkey setting works

#### 7.21 Verification item 8: recording with waveform

- Press and hold hotkey
- Pill appears with waveform
- Waveform animates
- **Validation:** Recording visual feedback works

#### 7.22 Verification item 9: transcribing state

- Release hotkey
- Pill shows "Transcribing..."
- Spinner visible
- **Validation:** Transcribing state works

#### 7.23 Verification item 10: text injection

- After transcription completes
- Text appears in focused application
- **Validation:** Text injection works

#### 7.24 Verification item 11: X minimizes to tray

- Click X button
- Window hides
- App still in tray
- **Validation:** Close behavior correct

#### 7.25 Verification item 12: tray opens settings

- Click tray icon
- Settings window opens
- **Validation:** Tray click works

#### 7.26 Verification item 13: tray Exit quits

- Right-click tray
- Click Exit
- App closes completely
- **Validation:** Exit works

#### 7.27 Verification item 14: settings persist

- Change various settings
- Close and reopen app
- Settings retained
- **Validation:** Persistence works

#### 7.28 Verification item 15: auto-start toggle

- Enable auto-start
- Check registry or startup folder
- Disable auto-start
- Verify removed
- **Validation:** Auto-start works

#### 7.29 Create production build

- Build release version
- Test release build
- Verify all features work in release
- **Validation:** Release build works

#### 7.30 Final documentation

- Update README with usage instructions
- Document any known issues
- Document build requirements
- **Validation:** Documentation complete

### Sprint 7 Acceptance Criteria

- [ ] Auto-start setting works
- [ ] Logging writes to file when enabled
- [ ] All animations are smooth
- [ ] UI is polished and professional
- [ ] All 15 verification items pass
- [ ] Production build works
- [ ] Documentation complete

---

## Dependencies Summary

### External Dependencies (Cargo.toml)

```toml
whisper-rs = "0.15"
cpal = "0.17"
enigo = "0.6"
rubato = "1.0"
crossbeam = "0.8"
reqwest = { version = "0.13", features = ["stream"] }
windows = { version = "0.62", features = ["Win32_UI_WindowsAndMessaging"] }
sha2 = "0.10"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

### Tauri Plugins

- `tauri-plugin-global-shortcut` - Hotkey registration (Sprint 5)
- `tauri-plugin-notification` - System notifications (Sprint 5)
- `tauri-plugin-autostart` - Windows startup (Sprint 7)

### Frontend Dependencies (package.json)

```json
{
  "@tauri-apps/api": "^2.0.0"
}
```

---

## Risk Register

| Risk                               | Mitigation                              | Sprint |
| ---------------------------------- | --------------------------------------- | ------ |
| whisper-rs build issues on Windows | Sprint 0 verification                   | 0      |
| cpal audio callback timing         | Profile in Sprint 2, optimize if needed | 2      |
| enigo Unicode injection issues     | Test edge cases in Sprint 6             | 6      |
| Large model download failures      | Checksums, retry guidance               | 3      |
| Hotkey conflicts with other apps   | Conflict detection, helpful errors      | 5      |
| Memory usage with large models     | Document requirements                   | 4      |

---

## Task Count Summary

| Sprint    | Tasks   | Focus Area            |
| --------- | ------- | --------------------- |
| 0         | 6       | Build verification    |
| 1         | 24      | Foundation & UI shell |
| 2         | 20      | Audio pipeline        |
| 3         | 27      | Model management      |
| 4         | 18      | Whisper integration   |
| 5         | 17      | Hotkey & recording    |
| 6         | 10      | Text injection        |
| 7         | 30      | Polish & launch       |
| **Total** | **152** |                       |
