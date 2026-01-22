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
npm run dev          # Vite dev server at localhost:5173
npm run build        # TypeScript check + Vite build
npm run lint         # ESLint

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
- `pill/` - Pill overlay with state machine: idle → loading → recording → transcribing → error
- `shared/types/` - TypeScript interfaces mirroring Rust types
- `shared/constants/events.ts` - Event names matching `src-tauri/src/events.rs`
- `components/ui/` - shadcn/ui components

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
- `stt/` - Speech-to-text module:
  - `models.rs` - Whisper GGML model definitions, paths, checksums
  - `download.rs` - Streaming download with progress, verification, cancellation
  - `commands.rs` - `list_models`, `download_model`, `cancel_download`, `delete_model` commands

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
- `test-microphone-complete` - Microphone test finished

### Model Storage

Whisper GGML models stored at `%APPDATA%/Draft/models/`. 8 models available (tiny, base, small, medium + English variants) downloaded from Hugging Face with SHA256 verification.

### Config Storage

Config stored at `%APPDATA%/Draft/config.json` via the `dirs` crate. TypeScript types in `src/shared/types/config.ts` must match Rust `Config` struct.

## Key Constraints

- **Rust 2024 edition** requires rustc 1.85+
- **CMake required** for whisper-rs (Sprint 4)
- **Audio callback timing** must complete in <5ms
- **Tauri v2 plugins** use capabilities system in `src-tauri/capabilities/default.json`
- Dependencies for future sprints are commented out in Cargo.toml until needed

## Development Notes

- Pill states can be tested in dev mode via keyboard shortcuts (1-4, 0) at `localhost:5173/pill.html`
- Sprint verification tests in `tests/sprint0/` for isolated dependency testing
- See `SPRINT_PLAN.md` for detailed implementation status and task breakdown
