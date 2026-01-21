# Draft - Build Requirements

This document outlines the required tools and setup steps for building Draft on Windows.

## Required Tools

### Rust Toolchain
- **Rust**: 1.85 or later (for Rust 2024 edition support)
- **Cargo**: Included with Rust
- Install via [rustup](https://rustup.rs/)

```bash
rustup update
```

### C/C++ Build Tools
- **Visual Studio Build Tools** or **Visual Studio** with C++ workload
- **CMake**: 3.20 or later (required for whisper-rs)
  - Download from [cmake.org](https://cmake.org/download/)
  - Or install via `winget install Kitware.CMake`

### Node.js / Bun
- **Node.js**: 18 or later (for npm)
- **Bun**: 1.0 or later (used for faster builds)
  - Install via `npm install -g bun` or from [bun.sh](https://bun.sh)

### Tauri CLI
- Included in devDependencies, but can be installed globally:
```bash
cargo install tauri-cli
```

## Verified Versions (Sprint 0)

The following versions have been verified to work:

| Tool | Version |
|------|---------|
| Rust | 1.90.0 |
| CMake | 4.2.1 |
| Node.js | 25.2.1 |
| Bun | 1.3.5 |

## Environment Setup

### Windows SDK
- Windows 10 SDK or later
- Installed automatically with Visual Studio Build Tools

### Environment Variables
No special environment variables required if tools are installed with default paths.

## Build Commands

### Development
```bash
# Install dependencies
bun install

# Run in development mode
bun tauri dev
```

### Production Build
```bash
bun tauri build
```

### Running Tests

Sprint 0 verification tests are in `tests/sprint0/`:

```bash
# Test whisper-rs builds
cd tests/sprint0/test-whisper && cargo run

# Test cpal audio capture (records 3 seconds)
cd tests/sprint0/test-cpal && cargo run

# Test enigo text injection (injects text after 3 seconds)
cd tests/sprint0/test-enigo && cargo run

# Test windows-rs focus management
cd tests/sprint0/test-windows-focus && cargo run
```

## Dependency Summary

### Rust Dependencies (src-tauri/Cargo.toml)
- `whisper-rs` - Whisper speech-to-text (requires CMake)
- `cpal` - Cross-platform audio capture
- `enigo` - Cross-platform text injection
- `windows` - Windows API bindings
- `tauri` - Application framework
- `tauri-plugin-global-shortcut` - Global hotkey support
- `tauri-plugin-notification` - System notifications
- `tauri-plugin-autostart` - Windows startup integration

### Frontend Dependencies (package.json)
- React 19
- Tailwind CSS 4
- Base UI components

## Troubleshooting

### whisper-rs fails to build
- Ensure CMake is installed and in PATH
- Ensure Visual Studio Build Tools with C++ workload is installed
- Try `cmake --version` to verify CMake is accessible

### cpal fails to find audio devices
- Ensure Windows audio service is running
- Check that microphone permissions are enabled in Windows Settings

### enigo text injection doesn't work
- Some applications block programmatic input
- Test with Notepad first
- Run as administrator if needed for certain applications

### Tauri plugins fail to initialize
- Ensure capabilities are configured in `src-tauri/capabilities/default.json`
- Check that plugin permissions match the operations being performed
