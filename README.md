# Draft

A Windows push-to-talk dictation application. Hold a hotkey to record your voice, release to transcribe and inject text into the active application.

## Features

- **Push-to-talk recording**: Hold a customizable hotkey to record, release to transcribe
- **Local Whisper transcription**: Privacy-first, all transcription happens on your machine
- **Text injection**: Transcribed text automatically appears in the active application
- **System tray**: Runs quietly in the background, accessible from the system tray
- **Multiple Whisper models**: Choose from tiny to medium models based on speed/accuracy needs

## Requirements

- Windows 10/11
- Microphone (duh)
- ~500MB to ~1.5GB disk space depending on model choice

## Installation

Download the latest release from the [Releases](https://github.com/your-repo/draft/releases) page.

## Usage

1. **First launch**: The settings window opens automatically on first run
2. **Download a model**: Go to the Models section and download a Whisper model (start with `tiny` or `base` for faster transcription)
3. **Set a hotkey**: Click the hotkey field and press your preferred key combination (e.g., `Ctrl+Shift+D` or `F9`)
4. **Test it**: Open any text input, hold your hotkey, speak, and release

### Settings

- **Audio**: Select your microphone and test audio levels
- **Hotkey**: Set your push-to-talk key (function keys F1-F24 work without modifiers)
- **Models**: Download/manage Whisper models (smaller = faster, larger = more accurate)
- **General**:
  - Start with Windows
  - Add space after text
  - Enable logging (for troubleshooting)

### System Tray

- **Left-click**: Open settings
- **Right-click**: Menu with "Open Settings" and "Exit"
- **X button**: Hides window to tray (doesn't exit)

## Development

### Prerequisites

- [Rust](https://rustup.rs/) (1.85+)
- [Node.js](https://nodejs.org/) or [Bun](https://bun.sh/)
- [CMake](https://cmake.org/) (for whisper-rs)
- Visual Studio Build Tools with C++ workload

### Setup

```bash
# Install dependencies
bun install

# Development mode
bun tauri dev

# Production build
bun tauri build
```

See [BUILD.md](BUILD.md) for detailed setup instructions.

## Architecture

- **Frontend**: React 19 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Rust + Tauri v2
- **Speech-to-text**: whisper-rs (local Whisper inference)
- **Audio**: cpal for capture, rubato for resampling
- **Text injection**: enigo for cross-application text input

## Data Storage

All data is stored locally in `%APPDATA%\Draft\`:

- `config.json` - Settings
- `models/` - Downloaded Whisper models
- `logs/` - Log files (when enabled)

## License

[MIT](LICENSE)
