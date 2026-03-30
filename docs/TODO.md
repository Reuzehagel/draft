# TODO

## Auto-Updater (required for V1 release)

- Use `tauri-plugin-updater` with GitHub Releases as the update source
- Tauri requires update bundles to be signed (need to set up signing keys)
- Check for updates on app start
- Show update indicator in settings window (bottom-left card or similar) when update available
- Button to install the update
- Single release channel (no beta/stable split)

## Vulkan SDK

- Install Vulkan SDK on dev machine
- Switch `whisper-cpp` to `whisper-vulkan` in `src-tauri/Cargo.toml` for GPU-accelerated Whisper
