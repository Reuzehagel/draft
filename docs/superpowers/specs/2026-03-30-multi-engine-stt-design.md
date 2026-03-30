# Multi-Engine STT: transcribe-rs Integration

**Date:** 2026-03-30
**Status:** Draft

## Summary

Replace the direct `whisper-rs` dependency with `transcribe-rs`, a unified STT crate that abstracts over multiple engines via a `SpeechModel` trait. This adds Parakeet 0.6B (ONNX) alongside existing Whisper models, with GPU acceleration (Vulkan for Whisper, DirectML for ONNX) on Windows.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Engine abstraction | `transcribe-rs` replacing `whisper-rs` | Battle-tested in Handy (shipping Tauri app), wraps whisper-rs internally so nothing is lost |
| GPU acceleration | Vulkan (Whisper) + DirectML (ONNX), compile-time | Matches Handy's proven config. DirectML ships with Windows 10+. |
| Tier UX | Transparent tiers (Fast/Accurate), users don't pick engines | Simpler UX, less choice paralysis |
| Model scope | Whisper + Parakeet only | Other engines (Moonshine, SenseVoice, GigaAM, Canary) not worth including yet |
| English-only toggle | Removed | Simplifies UI. Marginal accuracy difference not worth the complexity. |

## Tier Mapping

| Tier | Model | Size | WER (AA-WER v2.0) |
|------|-------|------|--------------------|
| Fast | Whisper Base | 148MB | ~6% |
| Accurate | Parakeet TDT 0.6B | ~640MB | ~4.2% |

All models (Whisper tiny through medium + Parakeet) remain accessible via the "All Models" collapsible for power users.

## Architecture

### Backend Changes

#### Engine Abstraction (`stt/engine.rs`, replaces `stt/whisper.rs`)

The dedicated transcription thread architecture stays unchanged:
- mpsc command channel (`LoadModel`, `Transcribe`, `Shutdown`)
- `BusyGuard` with atomic flag for concurrent operation prevention
- `EngineClient` (renamed from `WhisperClient`) as the clonable handle

The inner implementation changes:
- Thread holds `Box<dyn SpeechModel + Send>` instead of `WhisperContext`
- `LoadModel` determines engine type from model ID, constructs the appropriate `SpeechModel`
- `Transcribe` calls `model.transcribe_raw(samples, &options)` via the trait
- All event emission stays identical (`TRANSCRIPTION_COMPLETE`, `TRANSCRIPTION_ERROR`, `MODEL_LOADING`, `MODEL_LOADED`)

#### Model Definitions (`stt/models.rs`)

Expand `ModelDef`:
```rust
pub enum Engine {
    Whisper,
    Parakeet,
}

pub struct ModelDef {
    id: String,
    name: String,
    size: u64,
    filename: String,     // Single file (Whisper) or archive name (Parakeet)
    sha256: String,
    engine: Engine,
    is_archive: bool,     // true for Parakeet (tar.gz with multiple ONNX files)
}
```

Model storage layout:
```
%APPDATA%/Draft/models/
  ggml-base.bin                    # Whisper (single file)
  ggml-tiny.bin
  parakeet-tdt-0.6b-v3/            # Parakeet (directory)
    encoder.onnx
    decoder_joint.onnx
    preprocessor.onnx
    vocab.txt
```

#### Download Changes (`stt/download.rs`)

The download flow gains an extraction step for archive models:
1. Download to `models/<name>.tmp`
2. SHA256 verify
3. If `is_archive`: extract tar.gz to `models/<name>/`, then delete archive
4. If single file: atomic rename as before

Progress events, cancellation, and disk space checks unchanged.

#### Recording Flow

No changes. The recording pipeline dispatches audio to the engine thread exactly as before. The engine thread handles the rest via the `SpeechModel` trait.

#### Online STT

Untouched. Separate code path that doesn't use the local engine.

#### File Transcription (`stt/file.rs`)

Uses the `SpeechModel` trait instead of whisper-rs directly. `transcribe-rs`'s `TranscribeOptions` does not expose a progress callback — file transcription progress will report only start/complete events, not incremental percentage. This is acceptable since file transcription is a secondary feature (TranscribePage).

### Frontend Changes

#### Tier Picker (`TierPicker.tsx`)

- 2 buttons: Fast, Accurate
- Remove English-only toggle entirely
- Selecting a tier sets `selected_model` in config (`"base"` or `"parakeet-0.6b"`)

#### Model Status Area

No changes. Shows download progress or "Ready" for the selected tier's model.

#### All Models Collapsible

Flat list of all models (Whisper tiny through medium + Parakeet) with download/delete. No engine grouping.

#### Config

No new fields. `selected_model: string | null` already handles any model ID. Remove English-only toggle state.

### Build & Dependencies

#### Cargo.toml

Remove: `whisper-rs`

Add:
```toml
[target.'cfg(windows)'.dependencies]
transcribe-rs = { version = "0.3", features = ["whisper-vulkan", "ort-directml"] }
```

#### Build Requirements

- CMake still required (whisper.cpp compiled via transcribe-rs)
- ONNX Runtime DLLs bundled automatically by `ort` crate
- DirectML ships with Windows 10+

#### Binary Size Impact

- ONNX Runtime adds ~20-30MB to final binary
- Parakeet model: ~640MB downloaded on demand (not bundled)

### Error Handling

`transcribe-rs` returns `TranscribeError` from its trait methods. Map to the same `TRANSCRIPTION_ERROR` event strings the frontend already handles. No frontend error handling changes.

## What's NOT Changing

- Audio pipeline (cpal capture, lock-free buffer, resampling worker)
- Recording state machine (hold-to-record, double-tap toggle)
- Text injection (enigo)
- Online STT providers
- LLM post-processing
- History (SQLite)
- Sound effects
- Tray icon / window management
- Config persistence mechanism

## Future Considerations

- Additional engines (Moonshine, SenseVoice, Canary) can be added by enabling `transcribe-rs` features and adding model definitions — no architectural changes needed
- Cohere Transcribe integration when `cohere_transcribe_rs` matures and gains Windows support
- Streaming transcription via `transcribe-rs`'s `Transcriber` trait (VAD-chunked or energy-adaptive) could enable real-time partial results
