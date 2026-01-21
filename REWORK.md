# Draft - Full Project Rework Guide

This document provides a complete analysis of the current implementation and guidance for rebuilding from scratch.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Current Architecture](#current-architecture)
3. [Frontend (React)](#frontend-react)
4. [Backend (Rust/Tauri)](#backend-rusttauri)
5. [IPC & State Management](#ipc--state-management)
6. [Audio Pipeline](#audio-pipeline)
7. [Speech-to-Text](#speech-to-text)
8. [Text Formatting](#text-formatting)
9. [Configuration System](#configuration-system)
10. [HUD System](#hud-system)
11. [Hotkey System](#hotkey-system)
12. [Recommended New Architecture](#recommended-new-architecture)
13. [Migration Checklist](#migration-checklist)

---

## Project Overview

**What Draft Does:**
1. User presses hotkey (push-to-talk or toggle)
2. Audio captured from microphone
3. Audio transcribed locally via Whisper
4. Transcript formatted (commands, punctuation, wordlist)
5. Text injected into focused application

**Tech Stack:**
- Frontend: React + TypeScript + Vite
- Backend: Tauri v2 + Rust
- STT: whisper-rs (whisper.cpp bindings)
- Audio: cpal
- Text injection: enigo

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │   Settings UI    │  │       HUD        │                    │
│  │   (App.tsx)      │  │  (ScribingHud)   │                    │
│  └────────┬─────────┘  └────────┬─────────┘                    │
│           │                     │                               │
│           │  invoke()           │  listen("hud:state")         │
│           │  listen()           │                               │
└───────────┼─────────────────────┼───────────────────────────────┘
            │                     │
            ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      lib.rs                               │  │
│  │  - AppState (config, dictation, hotkeys, audio, stt)     │  │
│  │  - Tauri commands (get_config, set_config, etc.)         │  │
│  │  - Hotkey handler                                         │  │
│  │  - HUD sync logic                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│         ┌────────────────────┼────────────────────┐            │
│         ▼                    ▼                    ▼            │
│  ┌────────────┐      ┌────────────┐      ┌────────────┐       │
│  │   audio    │      │    stt     │      │ formatting │       │
│  │  (cpal)    │      │ (whisper)  │      │  (local)   │       │
│  └────────────┘      └────────────┘      └────────────┘       │
│         │                    │                    │            │
│         │                    ▼                    │            │
│         │            ┌────────────┐               │            │
│         └───────────►│ injection  │◄──────────────┘            │
│                      │  (enigo)   │                            │
│                      └────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Frontend (React)

### Old Structure

```
src/
  App.tsx           # 1630 lines - EVERYTHING
  App.css           # 1310 lines - all styles
  main.tsx          # entry point
  ui/
    Accordion.tsx   # 40 lines
    ScribingHud.tsx # 100 lines
    lucide.tsx      # icon components
```

### What Was in App.tsx

| Section | Lines | Description |
|---------|-------|-------------|
| Types | ~80 | Config, SettingsPage, MicrophoneDevice, etc. |
| Utilities | ~40 | classNames, formatHotkey, prettyError |
| useMicrophoneLevel | ~120 | Audio visualization hook |
| HudApp | ~90 | HUD window component |
| HotkeyInput | ~50 | Custom hotkey capture |
| SelectPopover | ~200 | Custom dropdown with positioning |
| SettingsApp | ~1000 | All settings pages inline |
| toggle/fieldRow | ~50 | Helper render functions |

### Problems

1. **Monolithic file** - impossible to navigate
2. **SelectPopover** - 200 lines reimplementing what Radix Select does
3. **Inline components** - toggle, fieldRow defined as functions inside SettingsApp
4. **No component library** - everything custom-built
5. **Flat CSS** - 1300 lines with no organization
6. **Tight coupling** - config shape, Tauri commands, UI all intertwined

### New Approach

Use shadcn/ui patterns:
- Radix primitives (Select, Switch, Collapsible)
- Tailwind for styling
- One file per component
- Hooks for data fetching (useConfig, useMicrophones, useModels)

---

## Backend (Rust/Tauri)

### Old Structure

```
src-tauri/src/
  main.rs           # just calls lib::run()
  lib.rs            # 644 lines - app setup + all commands
  core/
    mod.rs          # module exports
    audio.rs        # 481 lines - cpal capture + resampling
    config.rs       # config types + persistence
    formatting.rs   # 552 lines - transcript processing
    injection.rs    # enigo text typing
    microphones.rs  # device enumeration
    stt/
      mod.rs        # Transcriber trait
      whisper.rs    # WhisperTranscriber implementation
```

### lib.rs Breakdown

| Section | Lines | Description |
|---------|-------|-------------|
| AppState | ~40 | Mutex-wrapped state struct |
| DictationState | ~10 | push_to_talk_held, toggle_recording_on |
| HUD helpers | ~50 | sync_hud, hud_label, hud_mode |
| Hotkey helpers | ~140 | parse_shortcut, register_hotkeys, sync_cancel_hotkey |
| Audio helpers | ~70 | start/stop/cancel_audio_recording |
| Tauri commands | ~130 | get_config, set_config, list_microphones, list_models, download_model, delete_model |
| App setup | ~190 | Builder, plugins, tray, window events |

### Problems

1. **lib.rs does too much** - state, commands, hotkey logic, HUD sync all in one file
2. **Mutex everywhere** - `Mutex<Config>`, `Mutex<DictationState>`, `Mutex<Vec<Shortcut>>`
3. **Hotkey handler is complex** - 80-line closure with nested logic
4. **No error types** - everything returns `Result<T, String>`
5. **Tightly coupled** - hotkey handler directly calls audio, transcription, injection

### audio.rs Analysis

**Good parts:**
- Channel-based architecture (AudioHandle is Send+Sync)
- Pre-roll buffer for capturing speech onset
- Resampling to 16kHz

**Overcomplicated:**
- Manual ring buffer implementation
- Could use a proper resampler crate (rubato)

```rust
// Old: Manual ring buffer
struct RecordingBuffer {
    pre_roll: Vec<f32>,
    main: Vec<f32>,
    pre_roll_idx: usize,
    pre_roll_filled: bool,
    recording: bool,
}
```

### formatting.rs Analysis

**What it does:**
- Tokenizes transcript
- Handles commands ("comma", "new paragraph", "undo that")
- Removes filler words ("um", "uh")
- Applies wordlist replacements
- Capitalizes sentences
- Adds terminal punctuation

**Overcomplicated:**
- Custom tokenizer with Punct enum
- Manual multi-word phrase matching for wordlist
- Could be simplified with regex or a small parser

```rust
// Old: Manual token types
enum Token {
    Word(String),
    Punct(Punct),
    Newline(u8),
}

enum Punct {
    Comma, Period, Question, Exclamation,
    Colon, Semicolon, OpenParen, CloseParen,
    Quote, Apostrophe,
}
```

### stt/whisper.rs Analysis

**What it does:**
- Manages Whisper model loading
- Caches loaded models
- Runs transcription

**Likely fine as-is** - whisper-rs API is straightforward.

### injection.rs Analysis

**What it does:**
- Types text into focused window using enigo
- Handles "undo" action (Ctrl+Z)

**Simple, probably fine as-is.**

---

## IPC & State Management

### Tauri Commands

| Command | Direction | Description |
|---------|-----------|-------------|
| `get_config` | FE → BE | Load config from disk |
| `set_config` | FE → BE | Save config, re-register hotkeys |
| `list_microphones` | FE → BE | Enumerate audio devices |
| `list_models` | FE → BE | Get available Whisper models |
| `download_model` | FE → BE | Download model from HuggingFace |
| `delete_model` | FE → BE | Remove downloaded model |

### Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `hud:state` | BE → FE (HUD) | Update HUD display |
| `model:download-progress` | BE → FE | Download progress |
| `hotkeys:error` | BE → FE | Hotkey registration failed |

### Problems

1. **Config round-trips** - Frontend holds full config copy, syncs on every change
2. **No typed events** - Event payloads are ad-hoc
3. **HUD state pushed separately** - Could be derived from dictation state

---

## Audio Pipeline

### Flow

```
Microphone
    │
    ▼
cpal input stream (native sample rate, possibly stereo)
    │
    ├── Downmix to mono (if stereo)
    │
    ├── Resample to 16kHz (linear interpolation)
    │
    ▼
RecordingBuffer
    │
    ├── Pre-roll ring buffer (200ms)
    │
    ├── Main buffer (when recording=true)
    │
    ▼
Vec<f32> samples
    │
    ▼
Whisper transcription
```

### Thread Architecture

```
Main thread (Tauri)
    │
    ├── AudioHandle (Send+Sync wrapper)
    │       │
    │       ├── cmd_tx ──────► Audio thread
    │       │                      │
    │       ◄── resp_rx ───────────┘
    │
    ▼
Hotkey handler calls AudioHandle methods
```

### Potential Improvements

1. **Better resampler** - Linear interpolation is low quality; use `rubato` crate
2. **Simpler buffer** - Use `ringbuf` crate instead of manual implementation
3. **VAD (Voice Activity Detection)** - Auto-stop on silence instead of manual toggle

---

## Speech-to-Text

### Old Implementation

```rust
pub struct WhisperTranscriber {
    context: Mutex<Option<WhisperContext<'static>>>,
    current_model: Mutex<Option<String>>,
}

impl Transcriber for WhisperTranscriber {
    fn transcribe(&self, samples: &[f32], opts: &TranscribeOpts) -> Result<Transcription, String> {
        // Load model if needed (lazy)
        // Create WhisperState
        // Run full transcription
        // Return text
    }
}
```

### Model Management

- Models stored in app data directory
- Downloaded from HuggingFace on demand
- Cached after first load

### Potential Improvements

1. **Streaming transcription** - Show partial results while speaking
2. **GPU acceleration** - whisper.cpp supports CUDA/Metal
3. **Model quantization** - Smaller models for faster inference

---

## Text Formatting

### Pipeline

```
Raw transcript
    │
    ▼
Check for undo phrase ("undo that", "scratch that")
    │
    ├── If undo: return DictationAction::Undo
    │
    ▼
Apply wordlist replacements
    │
    ▼
Tokenize with command recognition
    │
    ├── "comma" → Punct::Comma
    ├── "new paragraph" → Newline(2)
    ├── "bullet" → Newline(1) + "-"
    ├── etc.
    │
    ▼
Remove filler words (if enabled)
    │
    ▼
Render tokens to string
    │
    ▼
Capitalize sentences (if enabled)
    │
    ▼
Add terminal punctuation (if enabled)
    │
    ▼
DictationAction::Insert(text)
```

### Supported Commands

| Spoken | Output |
|--------|--------|
| "comma" | , |
| "period" / "full stop" | . |
| "question mark" | ? |
| "exclamation mark/point" | ! |
| "colon" | : |
| "semicolon" | ; |
| "new line" | \n |
| "new paragraph" | \n\n |
| "bullet" | \n- |
| "open/close paren" | ( / ) |
| "open/close quote" | " |
| "quote" | " |
| "apostrophe" | ' |
| "undo" / "undo that" / "scratch that" | Undo last |

### Potential Simplifications

1. **Regex-based commands** - Instead of manual token matching
2. **Configurable command map** - Let users define their own
3. **Separate concerns** - Commands vs formatting rules

---

## Configuration System

### Old Config Shape

```rust
pub struct Config {
    pub schema_version: u32,
    pub general: GeneralConfig,
    pub audio: AudioConfig,
    pub hotkeys: HotkeyConfig,
    pub stt: SttConfig,
    pub formatting: FormattingConfig,
    pub cloud: CloudConfig,
    pub privacy: PrivacyConfig,
    pub profiles: HashMap<String, ProfileConfig>,  // Unused
}
```

### Nested Configs

```rust
GeneralConfig { start_on_login, show_hud, ui_theme, play_sounds }
AudioConfig { microphone_id, input_gain, sample_rate, max_recording_seconds }
HotkeyConfig { push_to_talk, toggle_recording, cancel_recording }
SttConfig { engine, default_model, default_language, performance_preset, model_storage_path }
FormattingConfig { mode, rules, commands_enabled, wordlist }
CloudConfig { enabled, provider, model, api_key_ref, disable_in_privacy_mode, timeout_ms }
PrivacyConfig { privacy_mode, save_recordings, debug_logging }
```

### Problems

1. **Unused fields** - `profiles`, `cloud` (not implemented), `performance_preset`
2. **Frontend duplicates types** - Same shape defined in TypeScript
3. **No validation** - Invalid hotkeys can be saved
4. **Flat file** - Could use separate files for different concerns

### Recommendation

1. Remove unused fields
2. Generate TypeScript types from Rust (ts-rs or similar)
3. Add validation in Rust before saving
4. Consider splitting: `hotkeys.json`, `formatting.json`, etc.

---

## HUD System

### Old Implementation

**Two windows:**
- `main` - Settings UI
- `hud` - Floating overlay (transparent, always-on-top, not focusable)

**HUD states:**
```typescript
type HudState = { open: boolean; label: string; mode: HudMode };
type HudMode = "listening" | "processing" | "idle";
```

**Communication:**
- Backend emits `hud:state` event
- HUD listens and updates display

### HUD Positioning

```typescript
// Old: Fixed position calculation
const width = 450;
const height = 120;
const x = Math.round((window.screen.availWidth - width) / 2);
const y = Math.round(window.screen.availHeight - height - bottomOffset);
```

### Audio Visualization

- Uses Web Audio API (separate from Rust audio)
- 9 frequency bands displayed as bars
- `requestAnimationFrame` loop for updates

### Problems

1. **Duplicate audio capture** - Rust captures for transcription, JS captures for visualization
2. **Jittery animation** - Insufficient smoothing
3. **Complex transitions** - Multiple CSS animations that don't coordinate well

### Recommendation

1. **Single audio source** - Stream audio levels from Rust to frontend via events
2. **Simpler animation** - Just height transitions, no keyframe animations
3. **State machine** - Clear transitions between states

---

## Hotkey System

### Old Implementation

Uses `tauri-plugin-global-shortcut`:

```rust
tauri_plugin_global_shortcut::Builder::new()
    .with_handler(move |app, shortcut, event| {
        // 80 lines of nested logic
        // - Match shortcut against config
        // - Handle press/release for push-to-talk
        // - Handle toggle
        // - Handle cancel
        // - Start/stop audio
        // - Sync HUD
    })
    .build()
```

### Shortcut Parsing

```rust
fn parse_shortcut(label: &str, value: &str) -> Result<Shortcut, String> {
    // Try multiple formats: "Esc" → "Escape", "Win" → "Super", etc.
}
```

### Special Escape Handling

- Plain "Esc" only registered while dictation is active
- Prevents breaking Escape system-wide

### Problems

1. **Handler is massive** - 80-line closure with nested conditionals
2. **State mutations mixed with side effects** - Updates dictation state, starts audio, syncs HUD all inline
3. **Async hotkey registration** - Uses `tauri::async_runtime::spawn` for Esc toggling

### Recommendation

1. **State machine** - Explicit states and transitions
2. **Separate concerns** - Hotkey → State change → Side effects
3. **Command pattern** - Hotkey triggers command, command handler does the work

---

## Recommended New Architecture

### File Structure

```
src/                          # Frontend
  main.tsx
  app.tsx                     # Router: HUD vs Settings

  lib/
    utils.ts                  # cn(), formatHotkey()
    tauri.ts                  # Typed invoke/listen wrappers

  hooks/
    use-config.ts
    use-microphones.ts
    use-models.ts
    use-audio-levels.ts       # Receives levels from Rust

  components/
    ui/                       # shadcn/ui primitives
      button.tsx
      switch.tsx
      select.tsx
      input.tsx
      slider.tsx
      card.tsx

    hotkey-input.tsx
    audio-bars.tsx

  features/
    hud/
      hud.tsx

    settings/
      layout.tsx
      nav.tsx
      pages/
        general.tsx
        audio.tsx
        hotkeys.tsx
        speech.tsx
        formatting.tsx
        privacy.tsx

src-tauri/src/                # Backend
  main.rs
  lib.rs                      # Just app setup
  error.rs                    # Custom error type

  state/
    mod.rs
    app_state.rs              # AppState struct
    dictation.rs              # DictationStateMachine

  commands/
    mod.rs
    config.rs                 # get_config, set_config
    audio.rs                  # list_microphones
    models.rs                 # list_models, download, delete

  services/
    audio/
      mod.rs
      capture.rs              # AudioCapture (simplified)
      resampler.rs            # Use rubato

    stt/
      mod.rs
      whisper.rs

    formatting/
      mod.rs
      commands.rs             # Dictation commands
      rules.rs                # Formatting rules
      wordlist.rs

    injection.rs

  hotkeys/
    mod.rs
    handler.rs                # Hotkey → Command mapping
    shortcuts.rs              # Shortcut parsing
```

### State Machine for Dictation

```rust
// state/dictation.rs
pub enum DictationState {
    Idle,
    Listening { mode: ListenMode },
    Processing,
}

pub enum ListenMode {
    PushToTalk,
    Toggle,
}

pub enum DictationEvent {
    PushToTalkPressed,
    PushToTalkReleased,
    TogglePressed,
    CancelPressed,
    TranscriptionComplete(String),
    TranscriptionFailed(String),
}

impl DictationState {
    pub fn transition(self, event: DictationEvent) -> (Self, Vec<SideEffect>) {
        match (self, event) {
            (Idle, PushToTalkPressed) => (
                Listening { mode: PushToTalk },
                vec![StartRecording, ShowHud("Listening")]
            ),
            (Listening { mode: PushToTalk }, PushToTalkReleased) => (
                Processing,
                vec![StopRecording, ShowHud("Transcribing..."), Transcribe]
            ),
            // ... etc
        }
    }
}
```

### Typed IPC

```rust
// Use ts-rs to generate TypeScript types
#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Config { ... }

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
pub struct HudState { ... }
```

```typescript
// Frontend: typed wrappers
import type { Config, HudState } from "./bindings";

export async function getConfig(): Promise<Config> {
  return invoke("get_config");
}

export function onHudState(callback: (state: HudState) => void): UnlistenFn {
  return listen("hud:state", (event) => callback(event.payload));
}
```

### Audio Levels from Rust

Instead of duplicate Web Audio capture:

```rust
// In audio capture callback
if recording {
    // Calculate RMS level
    let rms = calculate_rms(&samples);
    // Emit to frontend (throttled)
    app.emit("audio:level", rms);
}
```

```typescript
// Frontend
function useAudioLevel() {
  const [level, setLevel] = useState(0);
  const smoothed = useRef(0);

  useEffect(() => {
    const unlisten = listen<number>("audio:level", (event) => {
      // Exponential smoothing
      smoothed.current = smoothed.current * 0.7 + event.payload * 0.3;
      setLevel(smoothed.current);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  return level;
}
```

---

## Migration Checklist

### Phase 1: Setup
- [ ] Add Tailwind CSS
- [ ] Add Radix UI dependencies
- [ ] Add ts-rs for type generation
- [ ] Create new file structure (empty files)

### Phase 2: Backend Refactor
- [ ] Create custom error type
- [ ] Extract commands to separate files
- [ ] Implement DictationStateMachine
- [ ] Simplify audio capture (use rubato)
- [ ] Add audio level events
- [ ] Generate TypeScript bindings

### Phase 3: Frontend - Foundation
- [ ] Create utility functions (cn, etc.)
- [ ] Create typed Tauri wrappers
- [ ] Build UI primitives (Switch, Select, Button, etc.)
- [ ] Create hooks (useConfig, useMicrophones, etc.)

### Phase 4: Frontend - Settings
- [ ] Build settings layout (sidebar + content)
- [ ] Build settings navigation
- [ ] Create each settings page
- [ ] Wire up to backend

### Phase 5: Frontend - HUD
- [ ] Simplify HUD component
- [ ] Use audio levels from Rust
- [ ] Implement smooth transitions

### Phase 6: Cleanup
- [ ] Remove old App.tsx
- [ ] Remove old App.css
- [ ] Update CLAUDE.md
- [ ] Test everything

---

## Dependencies

### package.json

```json
{
  "dependencies": {
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-switch": "^1.0.0",
    "@radix-ui/react-collapsible": "^1.0.0",
    "@radix-ui/react-separator": "^1.0.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

### Cargo.toml

```toml
[dependencies]
thiserror = "1.0"      # Better error handling
rubato = "0.14"        # Better resampling
ts-rs = "7.0"          # TypeScript bindings
```

---

## Summary

| Area | Old State | New Approach |
|------|-----------|--------------|
| Frontend structure | 1 massive file | Split by feature |
| UI components | All custom | Use Radix + Tailwind |
| CSS | 1300 lines flat | Tailwind utilities |
| Config types | Duplicated | Generate from Rust |
| Backend structure | Commands in lib.rs | Split by domain |
| State management | Scattered Mutexes | State machine |
| Hotkey handling | 80-line closure | Command pattern |
| Audio capture | Manual buffers | Use crates |
| Audio visualization | Duplicate capture | Stream from Rust |
| Error handling | String errors | Custom error type |
