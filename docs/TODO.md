# TODO

## Auto-updater signing

- Store private key (`~/.tauri/draft.key`) + password as GitHub repo secrets (`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`)

## Vulkan SDK

- Install Vulkan SDK on dev machine
- Switch `whisper-cpp` to `whisper-vulkan` in `src-tauri/Cargo.toml` for GPU-accelerated Whisper
