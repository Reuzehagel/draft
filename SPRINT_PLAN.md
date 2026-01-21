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

## Sprint 1: Foundation & Shell

**Goal:** Basic Tauri app with two windows (settings + pill), system tray, config persistence, and UI scaffolding for all pill states.

**Demo:** App launches with settings window, pill overlay can be toggled, tray icon works, settings persist.

### Tasks

#### 1.1 Initialize Tauri v2 project with React

- Create new Tauri v2 project: `npm create tauri-app@latest`
- Select React + TypeScript template
- Configure ESLint, Prettier
- Add `@tauri-apps/api` to package.json
- **Validation:** `npm run dev` opens window, `cargo build` succeeds

#### 1.2 Configure Cargo.toml with all dependencies

- Add all required dependencies per spec:
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
- **Validation:** `cargo check` succeeds with all dependencies

#### 1.3 Set up multi-window entry points

- Create `settings.html` and `pill.html` in src/
- Configure Vite for multi-page build
- Create `SettingsApp.tsx` and `PillApp.tsx` entry components
- **Validation:** Both HTML files build correctly

#### 1.4 Configure dual-window architecture in Tauri

- Configure `tauri.conf.json` for two windows:
  - `settings`: normal window, resizable, min dimensions 400x500
  - `pill`: transparent, no decorations, always_on_top, skip_taskbar, focusable: false
- Assign unique window labels for IPC targeting
- **Validation:** Both windows can be created programmatically with correct properties

#### 1.5 Implement settings window layout

- Create section scaffolding: Audio, Hotkey, Models, General
- Add version number in footer
- Single scrollable page layout
- **Validation:** All sections render with placeholder content

#### 1.6 Implement system theme detection

- Detect Windows dark/light theme
- Apply appropriate CSS variables
- Listen for theme changes
- **Validation:** UI switches theme when Windows theme changes

#### 1.7 Implement pill overlay base component

- Dark semi-transparent background (#1a1a1a at 90% opacity)
- Fixed size: 200×40px
- Positioned bottom-center of primary monitor
- Not click-through (clicks don't pass through)
- **Validation:** Pill renders at correct position with correct styling

#### 1.8 Implement pill fade animations

- Fade in: 150ms ease-out
- Fade out: 150ms ease-in
- CSS transitions or React Spring
- **Validation:** Smooth fade in/out on show/hide

#### 1.9 Implement pill state components - Loading

- "Loading model..." text with spinner
- Used when model loading on first use
- **Validation:** Loading state renders correctly

#### 1.10 Implement pill state components - Recording (placeholder)

- Placeholder for waveform (solid bars for now)
- Will be connected to real amplitude data in Sprint 2
- **Validation:** Recording state shows placeholder visualization

#### 1.11 Implement pill state components - Transcribing

- "Transcribing..." text with spinner
- Spinner component reusable from loading state
- **Validation:** Transcribing state renders correctly

#### 1.12 Implement pill state components - Error

- Error message display
- Auto-hide after 2 seconds
- **Validation:** Error state shows message, auto-hides

#### 1.13 Implement pill state transitions

- Smooth transition from recording → transcribing (waveform fades to spinner)
- State management for pill (idle, loading, recording, transcribing, error)
- **Validation:** State transitions are smooth and correct

#### 1.14 Create system tray with icon

- Add monochrome tray icon (fits Windows 11 style)
- Set tooltip: "Draft"
- **Validation:** Tray icon appears in system tray

#### 1.15 Implement tray right-click menu

- Menu items: "Open Settings", separator, "Exit"
- "Open Settings" focuses/creates settings window
- "Exit" quits application
- **Validation:** Menu appears on right-click, items work

#### 1.16 Implement tray left-click behavior

- Left-click opens/focuses settings window
- Same behavior as "Open Settings" menu item
- **Validation:** Left-click opens settings

#### 1.17 Implement window close behavior

- X button on settings minimizes to tray (does not quit)
- Window can be reopened from tray
- **Validation:** X hides window, tray reopens it

#### 1.18 Create configuration module and types

- Define `Config` struct in Rust:
  ```rust
  struct Config {
      version: u32,
      microphone_id: Option<String>,
      selected_model: Option<String>,
      hotkey: Option<String>,
      auto_start: bool,
      trailing_space: bool,
      logging_enabled: bool,
      window_position: Option<(i32, i32)>,
      window_size: Option<(u32, u32)>,
  }
  ```
- Implement Default trait with spec defaults
- **Validation:** Config struct compiles with correct fields

#### 1.19 Implement config file persistence

- Location: `%APPDATA%/Draft/config.json`
- Create directory if missing
- JSON serialization/deserialization
- Handle missing file (return defaults)
- Handle corrupt file (return defaults, log warning)
- **Validation:** Config saves and loads correctly

#### 1.20 Implement get_config and set_config commands

- `get_config()` → returns current Config
- `set_config(config: Config)` → saves to file
- Register as Tauri commands
- **Validation:** Frontend can read/write config

#### 1.21 Create TypeScript types matching Rust types

- Create `src/shared/types/config.ts`
- Mirror Config struct exactly
- **Validation:** Types match Rust definitions

#### 1.22 Wire up settings persistence

- Load config on app start
- Save on settings change
- Debounce saves (300ms)
- **Validation:** Settings persist across restart

#### 1.23 Implement first-run detection

- Detect if config file exists
- Open settings window immediately on first run
- **Validation:** Fresh install opens settings, subsequent launches do not (unless minimized)

#### 1.24 Create event name constants

- Create `src-tauri/src/events.rs` with event name constants
- Create `src/shared/constants/events.ts` mirroring Rust
- **Validation:** Constants match between Rust and TypeScript

### Sprint 1 Acceptance Criteria

- [ ] App launches with settings window on first run
- [ ] Pill window can be shown/hidden with fade animations
- [ ] All pill states render correctly (loading, recording placeholder, transcribing, error)
- [ ] System tray icon appears with working menu
- [ ] X button hides settings to tray (does not exit)
- [ ] Tray left-click and "Open Settings" open settings window
- [ ] "Exit" quits application completely
- [ ] Configuration saves to `%APPDATA%/Draft/config.json`
- [ ] Configuration loads correctly on restart

---

## Sprint 2: Audio Pipeline

**Goal:** Complete audio capture, resampling, amplitude visualization, and working microphone test.

**Demo:** Settings shows microphone dropdown, test button shows real-time waveform, amplitude events flow to pill.

### Tasks

#### 2.1 Create audio module structure

- Create `src-tauri/src/audio/mod.rs`
- Create `src-tauri/src/audio/capture.rs`
- Create `src-tauri/src/audio/resampler.rs`
- Create `src-tauri/src/audio/amplitude.rs`
- Define public API types
- **Validation:** Module compiles, exports are accessible from lib.rs

#### 2.2 Implement microphone enumeration

- Use cpal `available_hosts()` and `devices()`
- Filter to input devices only
- Return `Vec<{id: String, name: String}>`
- Handle "System Default" as first option (id = None/empty)
- **Validation:** Returns correct list of input devices

#### 2.3 Implement list_microphones command

- Tauri command wrapping enumeration
- Returns device list to frontend
- **Validation:** Frontend receives correct device list

#### 2.4 Build microphone dropdown UI

- Dropdown component in Audio section
- First option: "System Default"
- Lists all available devices by name
- Shows "No microphones detected" when empty
- Saves selection to config
- **Validation:** Dropdown populates correctly, selection persists

#### 2.5 Design lock-free audio buffer

- Use crossbeam bounded channel
- Capacity: 5 seconds at 48kHz stereo (~480,000 samples)
- Sample format: f32
- Document overrun policy (drop oldest)
- **Validation:** Design documented, types defined

#### 2.6 Implement lock-free audio buffer

- Producer API: `push(samples: &[f32])` - non-blocking
- Consumer API: `drain() -> Vec<f32>` - collects all available
- Atomic stop flag for clean shutdown
- **Validation:** Unit tests pass for push/drain/shutdown

#### 2.7 Implement cpal audio stream

- Open device by ID (or default)
- Configure for device's native format
- Store sample rate and channel count for resampling
- Start/stop stream control
- **Validation:** Stream starts and stops without error

#### 2.8 Implement audio callback

- Write samples to lock-free buffer
- No allocations in callback
- No mutex locks in callback
- Must complete in <5ms
- **Validation:** Callback timing verified under load

#### 2.9 Implement device disconnection handling

- Detect device disconnect via cpal error callback
- Set error flag, stop stream gracefully
- Emit error event to frontend
- **Validation:** Disconnect handled without crash

#### 2.10 Create audio worker thread

- Background thread that reads from ring buffer
- Runs continuously while recording
- Clean shutdown on stop signal
- Drains remaining samples before exit
- **Validation:** Worker starts, processes, and stops cleanly

#### 2.11 Implement stereo to mono conversion

- Average left and right channels
- Handle mono input (pass through)
- **Validation:** Output is mono regardless of input

#### 2.12 Implement sample rate conversion with rubato

- Configure rubato for high-quality resampling
- Support common input rates: 44.1kHz, 48kHz, 96kHz
- Output: 16kHz mono
- **Validation:** Output sample rate is exactly 16kHz

#### 2.13 Wire up resampling in worker thread

- Worker thread calls resampler
- Accumulates resampled samples for transcription
- **Validation:** Resampled audio passed through pipeline

#### 2.14 Implement RMS amplitude calculation

- Calculate RMS over ~50-100ms window
- Sliding window approach
- Normalize to 0.0-1.0 range
- **Validation:** Amplitude values correspond to actual audio levels

#### 2.15 Implement amplitude event emission

- Emit `amplitude` event with `{level: f32}`
- Throttle to ~30fps (33ms interval)
- Only emit during recording
- **Validation:** Frontend receives amplitude at correct rate

#### 2.16 Build waveform component

- 12-16 vertical bars
- Bar height represents amplitude (0.0-1.0 → 0-100%)
- Monochrome (white/light gray)
- Smooth bar height transitions
- **Validation:** Bars animate based on amplitude events

#### 2.17 Connect waveform to amplitude events

- Listen to `amplitude` events in pill
- Update waveform state
- Ring buffer of last 12-16 values for bar display
- **Validation:** Waveform shows real-time audio levels

#### 2.18 Implement test_microphone command

- Accepts optional device_id parameter
- Starts capture, emits amplitude events
- Auto-stops after 5 seconds
- Returns stream of amplitude values
- **Validation:** Test runs for exactly 5 seconds

#### 2.19 Build test button UI

- Button in Audio section: "Test Microphone"
- Disables while test running
- Shows "Testing..." label during test
- Displays real-time audio level indicator (reuse waveform or simple bar)
- **Validation:** Visual feedback matches microphone input

#### 2.20 Implement System Default resolution

- Resolve "System Default" to actual device at capture start
- Handle case where default changes between recordings
- **Validation:** Uses current Windows default device

### Sprint 2 Acceptance Criteria

- [ ] Microphone dropdown lists "System Default" + all devices
- [ ] Test button starts 5-second test
- [ ] Real-time audio level shows during test
- [ ] Waveform component animates based on actual audio
- [ ] Amplitude events emit at ~30fps
- [ ] Audio is resampled to 16kHz mono
- [ ] Device disconnection shows error without crash
- [ ] "No microphones detected" shown when appropriate

---

## Sprint 3: Model Management

**Goal:** Download, validate, store, and manage Whisper models with full UI.

**Demo:** Can download any model with progress bar, delete models, see downloaded vs available.

### Tasks

#### 3.1 Create STT module structure

- Create `src-tauri/src/stt/mod.rs`
- Create `src-tauri/src/stt/whisper.rs`
- Create `src-tauri/src/stt/download.rs`
- Create `src-tauri/src/stt/models.rs`
- **Validation:** Module compiles, exports accessible

#### 3.2 Define model metadata constants

- Hardcode 8 models: tiny, tiny.en, base, base.en, small, small.en, medium, medium.en
- Include for each:
  - Name
  - Size in bytes
  - Download URL (Hugging Face)
  - SHA256 checksum
- **Validation:** All model info matches Hugging Face repo

#### 3.3 Implement model path resolution

- Base path: `%APPDATA%/Draft/models/`
- Create directory if missing
- `get_model_path(name: &str) -> PathBuf`
- **Validation:** Paths resolve correctly, directory created

#### 3.4 Implement model file existence check

- Check if model file exists on disk
- Used by list_models to determine downloaded status
- **Validation:** Correctly identifies downloaded models

#### 3.5 Implement list_models command

- Returns all 8 models with:
  - name: String
  - size: u64
  - downloaded: bool
- **Validation:** Returns correct data for all models

#### 3.6 Create TypeScript model types

- Create `src/shared/types/models.ts`
- Mirror Rust model types
- **Validation:** Types match Rust definitions

#### 3.7 Build models section UI - layout

- Section header: "Models"
- Two subsections: "Downloaded" and "Available"
- **Validation:** Section structure renders correctly

#### 3.8 Build downloaded models list UI

- List each downloaded model with:
  - Model name
  - File size (human readable, e.g., "1.5 GB")
  - Radio button to select active model
  - Delete button (trash icon)
- Active model highlighted
- **Validation:** Downloaded models display correctly

#### 3.9 Build available models list UI

- List each not-downloaded model with:
  - Model name
  - File size
  - Download button
- **Validation:** Available models display correctly

#### 3.10 Implement disk space check

- Before download, check available disk space
- Require at least model size + 100MB buffer
- Return error if insufficient space
- **Validation:** Insufficient space shows error before download starts

#### 3.11 Implement download stream setup

- Configure reqwest client with streaming
- Set appropriate timeout (none for large files, or very long)
- User-Agent header
- **Validation:** Download stream initializes correctly

#### 3.12 Implement download progress tracking

- Track bytes downloaded vs total size
- Calculate percentage (0-100)
- **Validation:** Progress calculation is accurate

#### 3.13 Implement download-progress event emission

- Emit `download-progress` event: `{model: String, progress: u8}`
- Emit every ~1% or 500ms, whichever is less frequent
- **Validation:** Frontend receives progress updates

#### 3.14 Implement download file writing

- Write to temp file: `{model}.bin.tmp`
- Atomic rename on completion: `{model}.bin`
- **Validation:** Download completes with correct filename

#### 3.15 Implement download_model command

- Accepts model name
- Validates model exists in metadata
- Checks disk space
- Starts download with progress events
- **Validation:** Download command works end-to-end

#### 3.16 Build download progress UI

- Progress bar showing percentage
- Model name displayed
- Disable other download buttons while downloading
- **Validation:** Progress bar updates during download

#### 3.17 Implement download cancellation

- Store cancellation token with download state
- Cancel button triggers token
- Delete partial file on cancel
- **Validation:** Cancel stops download, removes partial file

#### 3.18 Build cancel button UI

- Cancel button replaces download button during download
- Clicking cancels and restores UI to available state
- **Validation:** Cancel button works correctly

#### 3.19 Implement SHA256 checksum validation

- After download complete, compute SHA256 of file
- Compare against hardcoded checksum
- Delete file if mismatch
- **Validation:** Corrupt downloads detected and removed

#### 3.20 Handle checksum mismatch error

- Show error in UI: "Download corrupted, please retry"
- Remove corrupted file
- Re-enable download button
- **Validation:** Error displayed, file removed

#### 3.21 Handle interrupted downloads

- Detect incomplete downloads (connection error, etc.)
- Delete partial .tmp file
- Show error in UI
- **Validation:** Partial files cleaned up on error

#### 3.22 Implement delete_model command

- Delete model file from disk
- If deleted model was active, clear selection in config
- **Validation:** File removed, config updated

#### 3.23 Build delete confirmation

- Show confirmation dialog before delete
- "Delete {model}? This will remove the {size} file."
- **Validation:** Confirmation prevents accidental deletion

#### 3.24 Wire up delete button

- Click shows confirmation
- On confirm, calls delete_model
- Updates UI to show model as available
- **Validation:** Delete flow works end-to-end

#### 3.25 Implement first-model auto-select

- On download complete, if no model currently selected, auto-select it
- Subsequent downloads require manual selection
- **Validation:** First download becomes active automatically

#### 3.26 Add download complete notification

- In-app toast notification on download complete
- "Model {name} downloaded successfully"
- Auto-dismiss after 3 seconds
- **Validation:** Toast appears on completion

#### 3.27 Implement concurrent download blocking

- Only allow one download at a time
- Queue or reject additional download requests
- **Validation:** Cannot start second download while one in progress

### Sprint 3 Acceptance Criteria

- [ ] All 8 Whisper models listed (downloaded + available)
- [ ] Download shows progress bar with percentage
- [ ] Download can be cancelled
- [ ] SHA256 validation catches corrupt downloads
- [ ] Corrupt downloads deleted with error message
- [ ] Insufficient disk space shows error before download
- [ ] Delete removes model from disk
- [ ] Delete confirmation prevents accidents
- [ ] First downloaded model auto-selected
- [ ] Subsequent downloads not auto-selected
- [ ] Only one download at a time
- [ ] Toast notification on download complete

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
