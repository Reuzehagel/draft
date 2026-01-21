# Draft - Specification

## Overview

**Draft** is a Windows push-to-talk dictation app. Hold a hotkey, speak, release, and your transcribed text is injected into the focused application.

**Platform:** Windows only
**Tech Stack:** Tauri v2 (Rust backend) + React frontend
**STT Engine:** Whisper via whisper-rs (CPU-only)

---

## Core Flow

1. User presses and holds configured hotkey
2. Pill overlay appears at bottom-center with real-time waveform
3. Audio is captured from selected microphone
4. User releases hotkey
5. Pill transitions to "Working!" with spinner
6. Whisper transcribes audio
7. Pill fades out, text is injected via enigo
8. If transcription is empty, pill simply fades out (silent)

---

## Pill Overlay

### Appearance
- **Size:** Compact, approximately 200×40px
- **Position:** Fixed bottom-center of primary monitor
- **Theme:** Always dark (semi-transparent dark background)
- **Interaction:** Not click-through (clicking pill does nothing, but won't pass through)
- **Implementation:** Separate Tauri window with `transparent: true`, `decorations: false`, `always_on_top: true`, `skip_taskbar: true`, `focusable: false`

### Animations
- **Entrance:** Fade in (~150ms)
- **Exit:** Fade out (~150ms)
- **State transition:** Waveform fades to spinner smoothly

### States

| State | Display |
|-------|---------|
| Loading model | Spinner with "Loading model..." text (only on first use or model switch) |
| Recording | Real-time bar graph waveform (12-16 vertical bars, monochrome) showing actual audio amplitude |
| Transcribing | Spinner/loader with "Transcribing..." text (waveform fades out, spinner fades in) |
| Error | Error message displayed for 2 seconds, then fades out |
| Empty result | Fades out silently (no indication) |

### Waveform Specification
- 12-16 vertical bars representing amplitude over time (not frequency bands)
- Each bar = recent RMS amplitude of audio chunk (sliding window)
- Monochrome (single color, likely white or light gray)
- Updates at ~30fps (throttled to avoid overwhelming frontend)
- Not a generic animation—reflects actual audio levels

---

## Recording

- **Mode:** Push-to-talk only (no toggle mode)
- **Maximum duration:** 120 seconds (auto-stops if exceeded)
- **Double-press handling:** Ignored (key repeat events do not affect recording)
- **Hotkey during transcription:** Ignored (cannot start new recording while transcribing)
- **Audio feedback:** None (no sounds on start/stop)
- **Cancel hotkey:** Not implemented (deferred)

---

## Transcription

### Whisper Configuration
- **Library:** whisper-rs
- **Execution:** CPU-only (no GPU/CUDA acceleration)
- **Model format:** GGML models from Hugging Face (ggerganov/whisper.cpp)

### Available Models (8 total)
| Model | Size (approx) |
|-------|---------------|
| tiny | ~75 MB |
| tiny.en | ~75 MB |
| base | ~142 MB |
| base.en | ~142 MB |
| small | ~466 MB |
| small.en | ~466 MB |
| medium | ~1.5 GB |
| medium.en | ~1.5 GB |

### Model Storage
- Location: Windows AppData directory (`%APPDATA%/Draft/models/`)
- No limit on number of downloaded models

### Model Loading
- **First load delay:** Large models (medium) may take several seconds to load into memory
- **Loading indicator:** Show "Loading model..." in pill if transcription is triggered before model is ready
- **Caching:** Model stays loaded in memory after first use until app closes or different model selected

### Error Handling
- **Transcription error:** Pill shows "Error" for 2 seconds, then fades
- **Empty transcription:** Pill fades out silently, nothing injected

---

## Text Injection

- **Method:** enigo library for simulated keystrokes
- **Target window:** Captured at recording start (text injects to the window that was focused when hotkey was pressed, not the window focused when transcription completes)
- **Failed injection handling:** None (not handled in initial release)
- **Trailing space:** Configurable setting, **off by default**
  - Setting label: "Add space after text"

---

## Hotkey

- **Default:** None (user must configure on first run)
- **Allowed combinations:** Any key or combination
  - Bare keys allowed (F1, F13, etc.)
  - Modifier combinations allowed (Ctrl+Shift+Space, Alt+D, etc.)
  - Modifier-only combinations are **blocked** (Ctrl alone, Shift+Alt, etc.)
- **Capture UI:** Best practice implementation (inline field that shows "Press a key..." when activated)

---

## Settings Window

### Window Behavior
- **On first launch:** Settings window opens immediately
- **Close button (X):** Minimizes to system tray (does not quit)
- **Tray icon:** Simple monochrome icon
- **Tray right-click menu:**
  - "Open Settings" - opens/focuses settings window
  - "Exit" - quits application
- **Tray left-click:** Opens/focuses settings window
- **Theme:** Follows Windows system theme (dark/light)
- **Resizing:** Resizable with minimum dimensions enforced
- **Focus:** Steals focus when opened

### Settings Layout
Single scrollable page (given limited number of settings). Sections:

#### Audio Section
- **Microphone dropdown**
  - First option: "System Default" (uses Windows default device)
  - Lists all available input devices
  - If no microphones detected: empty dropdown with helper text "No microphones detected"
- **Test button**
  - Runs for 5 seconds, then auto-stops
  - Shows real-time audio level indicator
  - Allows user to verify microphone is working

#### Hotkey Section
- **Current hotkey display** with edit capability
- When not set: shows "Not Set" or "Click to set"
- Click to enter capture mode ("Press a key...")

#### Models Section
- **Downloaded models** listed with:
  - Model name
  - File size (e.g., "medium.en (1.5 GB)")
  - Delete button
  - Radio/select to choose active model
- **Available models** (not downloaded) with:
  - Model name
  - File size
  - Download button
- **Download progress:** Percentage bar only (no ETA)
- **Concurrent downloads:** One at a time only
- **Cancel button** available during download
- **On download complete:** In-app toast notification, auto-selects if it's the first model
- **Subsequent downloads:** Must be manually selected after download
- **Deleting selected model:** Clears selection (user must select another)

#### General Section
- **Auto-start with Windows:** Checkbox, off by default
- **Add space after text:** Checkbox, off by default
- **Enable logging:** Checkbox, off by default (writes to `%APPDATA%/Draft/logs/`)

#### Footer
- Version number (small, unobtrusive)

---

## System Tray

- **Icon:** Simple monochrome (fits Windows 11 tray style)
- **No state indication:** Icon does not change during recording
- **Tooltip:** "Draft"

---

## First Run / Onboarding

1. App launches, settings window opens immediately
2. User must:
   - Select or confirm microphone (System Default available)
   - Download at least one model
   - Set a hotkey
3. If user presses hotkey before configuration is complete:
   - Windows system notification listing all missing requirements
   - Combined message (e.g., "Please configure: hotkey, model")

---

## Configuration Persistence

- **Format:** JSON file
- **Location:** `%APPDATA%/Draft/config.json`
- **Schema version:** Include version field for future migrations
- **Persisted settings:**
  - Config version (for migration handling)
  - Selected microphone device ID
  - Selected model
  - Hotkey binding
  - Auto-start preference
  - Trailing space preference
  - Logging preference
  - Window position/size (if user resizes)

---

## Auto-Start

- **Default:** Off
- **Implementation:** Via `tauri-plugin-autostart` (handles registry automatically)
- **Configurable:** Yes, checkbox in settings

---

## Audio Capture

- **Library:** cpal
- **Target format:** 16kHz mono (Whisper requirement)
- **Resampling:** rubato library for high-quality sample rate conversion
- **Threading:** cpal callback writes to lock-free buffer; worker thread handles resampling
- **Streaming:** None—start/stop/get samples pattern
- **System Default resolution:** Resolved to actual device at recording start (if Windows default changes mid-session, next recording uses new default)
- **Device disconnection:** Graceful handling—stop recording, show error in pill, don't crash

---

## File Structure

```
src-tauri/src/
  main.rs              # Entry point
  lib.rs               # App setup, plugin registration, command wiring
  commands.rs          # All Tauri command handlers
  state.rs             # Application state management

  audio/
    mod.rs             # Audio module public API
    capture.rs         # cpal audio capture
    resampler.rs       # Resampling to 16kHz mono via rubato

  stt/
    mod.rs             # STT module public API
    whisper.rs         # Whisper model loading and inference
    download.rs        # Model download with progress streaming

  config.rs            # Config types, JSON persistence

src/
  settings.html        # Settings window entry point
  pill.html            # Pill overlay entry point

  settings/
    SettingsApp.tsx    # Main settings component
    components/        # Settings-specific components

  pill/
    PillApp.tsx        # Pill overlay component
    components/
      Waveform.tsx     # Real-time amplitude visualization
      Spinner.tsx      # Transcribing state

  shared/
    hooks/             # Shared React hooks for Tauri IPC
    types/             # TypeScript types matching Rust types
```

---

## Tauri Commands

| Command | Parameters | Returns |
|---------|------------|---------|
| `list_microphones` | - | `Vec<{id: String, name: String}>` |
| `list_models` | - | `Vec<{name: String, size: u64, downloaded: bool}>` |
| `download_model` | `name: String` | Stream of progress events (0-100) |
| `delete_model` | `name: String` | `Result<()>` |
| `get_config` | - | `Config` |
| `set_config` | `config: Config` | `Result<()>` |
| `test_microphone` | `device_id: Option<String>` | Stream of amplitude values |

---

## Events (Backend → Frontend)

| Event | Payload | Description |
|-------|---------|-------------|
| `download-progress` | `{model: String, progress: u8}` | Model download progress |
| `recording-started` | - | Hotkey pressed, recording began |
| `recording-stopped` | - | Hotkey released |
| `transcription-complete` | `{text: String}` | Transcription finished |
| `transcription-error` | `{error: String}` | Transcription failed |
| `amplitude` | `{level: f32}` | Real-time audio amplitude for waveform |

---

## Dependencies

### Cargo.toml
```toml
whisper-rs = "0.15"
cpal = "0.15"
enigo = "0.5"
rubato = "0.15"              # Audio resampling to 16kHz
reqwest = { version = "0.12", features = ["stream"] }  # Model downloads
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

### Tauri Plugins
- `tauri-plugin-global-shortcut` - Hotkey registration
- `tauri-plugin-notification` - System notifications
- `tauri-plugin-autostart` - Windows startup registration

---

## Explicitly Deferred

| Feature | Reason |
|---------|--------|
| Toggle mode | Push-to-talk only for initial release |
| Cancel hotkey | Keep it simple |
| Pre-roll buffer | Add if users report clipped speech onset |
| Audio visualization in settings | Test button is sufficient |
| Multiple profiles | Unnecessary complexity |
| Privacy mode | Later |
| Cloud STT | Later |
| GPU acceleration | Simpler build with CPU-only |
| Cross-platform | Windows only initially |
| Injection failure handling | Not handling initially |

---

## Verification Checklist

1. `cargo build` in src-tauri compiles successfully
2. `npm run dev` opens settings window
3. Can select microphone from dropdown
4. Test button shows audio level
5. Can download a Whisper model (progress shown)
6. Can delete a model
7. Can set custom hotkey
8. Hold hotkey → pill appears with waveform
9. Release hotkey → pill shows "Transcribing..." with spinner
10. Text appears in focused application
11. X button minimizes to tray
12. Tray icon opens settings
13. Tray "Exit" quits app
14. Settings persist across restart
15. Auto-start toggle works (when enabled)
