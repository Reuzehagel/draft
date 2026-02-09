# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Draft is a Windows push-to-talk dictation application built with Tauri v2, React 19, and Whisper for speech-to-text. Users hold a hotkey to record audio, which is transcribed and injected as text into the active application.

## Build Commands

```bash
# Install dependencies
bun install

# Development (runs Vite + Tauri)
bun tauri dev

# Production build
bun tauri build

# Frontend only (for UI development)
bun run dev          # Vite dev server at localhost:5173
bun run build        # TypeScript check + Vite build
bun run lint         # ESLint

# Rust only
cargo build --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

## Architecture

### Dual-Window Tauri Application

- **Settings window** (`settings.html`): Main configuration UI, 500x600, hides to tray on close
- **Pill window** (`pill.html`): 200x40 transparent overlay showing recording/transcription state

### Frontend Structure (`src/`)

- `settings/` - Settings window React app with microphone, hotkey, model management
  - `hooks/` - Extracted hooks: useDarkMode, useConfig, useHotkeyRegistration, useMicrophones, useMicrophoneTest
  - `components/` - SettingsCard, SettingRow, HotkeyInput, Toggle, ModelsCard
  - `components/models/` - Tier-based model picker (TierPicker, DownloadableModel, etc.)
  - `useModels.ts`, `useWhisper.ts` - Model and Whisper state management
- `pill/` - Pill overlay with state machine: idle → loading → recording → transcribing → enhancing → error
- `shared/types/` - TypeScript interfaces mirroring Rust types
- `shared/constants/events.ts` - Event names matching `src-tauri/src/events.rs`
- `shared/utils/tauriListeners.ts` - `createListenerGroup()` helper for consistent event listener cleanup
- `components/` - Shared components (`WaveformBars`) and shadcn/ui components

### Backend Structure (`src-tauri/src/`)

- `lib.rs` - Tauri app setup, tray icon, window management, command registration
- `config.rs` - Config persistence to `%APPDATA%/Draft/config.json`
- `events.rs` - Event name constants for frontend-backend communication
- `audio/` - Audio pipeline module:
  - `devices.rs` - Microphone enumeration, `list_microphones` and `test_microphone` commands
  - `buffer.rs` - Lock-free ring buffer using crossbeam channels
  - `capture.rs` - cpal audio stream management
  - `worker.rs` - Background thread for resampling and amplitude calculation
  - `resampler.rs` - rubato wrapper for 16kHz mono conversion
  - `amplitude.rs` - RMS calculation for waveform visualization
- `recording/` - Recording state management:
  - `commands.rs` - Start/stop recording commands
  - `hotkey.rs` - Global hotkey registration and handling
  - `state.rs` - Recording state machine
- `injection/` - Text injection module:
  - `focus.rs` - Capture and restore window focus before/after recording
  - `text.rs` - enigo-based text injection into active application
- `stt/` - Speech-to-text module:
  - `models.rs` - Whisper GGML model definitions, paths, checksums
  - `download.rs` - Streaming download with progress, verification, cancellation
  - `commands.rs` - `list_models`, `download_model`, `cancel_download`, `delete_model` commands
  - `whisper.rs` - Whisper model loading and transcription
- `llm/` - LLM post-processing module:
  - `client.rs` - HTTP clients for OpenAI-compatible and Anthropic APIs
  - `process.rs` - Post-processing orchestration (auto-cleanup, voice commands)
  - Supports 5 providers: OpenAI, Anthropic, OpenRouter, Cerebras, Groq
- `autostart.rs` - Windows startup integration

### Audio Pipeline Flow

```
Microphone → cpal callback → Lock-free buffer → Worker thread → Resampler (16kHz mono) → Amplitude calc → Events
```

The audio callback must be real-time safe: no allocations, no locks, no I/O.

### Event Communication

Frontend listens to Tauri events defined in `events.rs`/`events.ts`:
- `amplitude` - 14-element f32 array for waveform visualization (~30fps)
- `recording-started/stopped` - Recording state changes
- `transcription-complete/error` - Transcription results
- `download-progress` - Model download progress (model, progress%, bytes)
- `model-loading/loaded` - Whisper model load state
- `test-microphone-complete` - Microphone test finished
- `llm-processing` - LLM post-processing started (triggers "enhancing" pill state)

### Model Storage

Whisper GGML models stored at `%APPDATA%/Draft/models/`. 8 models available (tiny, base, small, medium + English variants) downloaded from Hugging Face with SHA256 verification.

### Config Storage

Config stored at `%APPDATA%/Draft/config.json` via the `dirs` crate. TypeScript types in `src/shared/types/config.ts` must match Rust `Config` struct. Includes LLM settings: `llm_provider`, `llm_api_key`, `llm_model`, `llm_auto_process`, `llm_system_prompt`.

## Key Constraints

- **Always use bun, never npm** - This project uses bun as the package manager
- **Rust 2024 edition** requires rustc 1.85+
- **Rust nightly-only APIs**: `floor_char_boundary` is unstable on 1.85; use `is_char_boundary()` loop instead
- **CMake 3.20+ required** for whisper-rs, plus Visual Studio Build Tools with C++ workload and Windows SDK
- **Audio callback timing** must complete in <5ms
- **Config write concurrency**: `CONFIG_LOCK` mutex in `config.rs` serializes all writes. `set_config` preserves `window_position`/`window_size` from disk (frontend doesn't manage geometry). New config writers must acquire `CONFIG_LOCK`.
- **Tauri v2 plugins** use capabilities system in `src-tauri/capabilities/default.json`
- **Windows API + tokio**: Win32 calls needing a message queue (e.g. `AttachThreadInput`, `SetForegroundWindow` privilege tricks) must run via `app.run_on_main_thread()` — tokio worker threads don't have message pumps
- **Path alias**: `@/*` maps to `./src/*` in tsconfig

## Development Notes

- Pill states can be tested in dev mode via keyboard shortcuts (1-4, 0) at `localhost:5173/pill.html`
- Sprint verification tests in `tests/sprint0/` for isolated dependency testing (cpal, enigo, whisper, windows-focus)
- LLM default models are defined in both `src-tauri/src/llm/mod.rs` (`default_model()`) and `src/settings/SettingsApp.tsx` (`LLM_DEFAULT_MODELS`) - keep in sync
- rubato's `input_frames_next()` can return different values after each `process()` call — always re-query per iteration, never cache outside the loop

## Feature Roadmap

| Priority | Feature | Status |
|----------|---------|--------|
| 1 | LLM post-processing (auto-cleanup + voice commands) | Done |
| 2 | Clipboard mode | Planned |
| 3 | Whisper initial prompt | Planned |
| 4 | Sound effects | Planned |
| 5 | Continuous dictation (double-tap toggle) | Planned |
| 6 | Transcription history | Planned |

## Post-Sprint Workflow

After completing a sprint, follow this mandatory review and refinement process:

1. **Run the Code Reviewer agent** (`feature-dev:code-reviewer`) - Review the sprint's code for bugs, logic errors, and security vulnerabilities (not style/cleanup - the simplifier handles that)
2. **Run the Code Simplifier agent** (`code-simplifier:code-simplifier`) - Simplify and refine the code for clarity, consistency, and maintainability
3. **Run the Code Architect agent** (`feature-dev:code-architect`) - Design solutions for any issues identified by the reviewer and simplifier
4. **Implement the fixes** - Apply the architect's recommendations to resolve all identified issues

This workflow ensures code quality remains high across sprints.
