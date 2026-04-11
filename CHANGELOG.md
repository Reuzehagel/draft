# Changelog

All notable changes to Draft will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [1.0.4] - 2026-04-11

### Fixed
- Auto-updater not working — `latest.json` was missing from GitHub releases due to missing `createUpdaterArtifacts` config

## [1.0.3] - 2026-04-11

### Added
- OGG Opus file transcription support via automatic ffmpeg conversion (e.g., WhatsApp voice messages)

### Fixed
- Removed unused `FILE_TRANSCRIPTION_PROGRESS` constant from Rust events

## [1.0.2] - 2026-04-01

### Added
- Version history browser in About page — browse changelog entries for any past version via a searchable combobox

### Fixed
- Removed unused React import in scroll-area component that broke production builds

## [1.0.1] - 2026-04-01

### Changed
- Prettified model and provider names across the UI (e.g., "parakeet-0.6b" → "Parakeet 0.6B", "openai" → "OpenAI")

## [1.0.0] - 2026-04-01

### Changed
- Replaced vertical sidebar navigation with horizontal underline tab bar (Home, General, Models, More)
- Added new Home page with live status cards (model, hotkey, engine) and recent transcriptions
- Converted all settings pages from card-based layout to flat sections with dividers
- Consolidated 7 navigation pages into 4 tabs with "More" containing sub-tabs (Post Process, Advanced, History, Transcribe, About)
- Simplified Info page to a focused About section with changelog only
- Made update card compact for inline display in the tab bar header

## [0.1.0] - 2026-03-31

### Added
- Push-to-talk dictation with local Whisper models (tiny, base, small, medium)
- Parakeet ONNX model support via transcribe-rs
- Online STT providers: OpenAI, Deepgram, AssemblyAI, Mistral, ElevenLabs
- LLM post-processing with OpenAI, Anthropic, OpenRouter, Cerebras, Groq
- Text injection into active application (type or clipboard mode)
- Global hotkey with hold-to-record and double-tap toggle modes
- File transcription from audio/video files
- Transcription history with SQLite storage
- Sound effects for recording events
- Dark/light mode
- Auto-start with Windows
- Auto-updater with sidebar update card
