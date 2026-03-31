# TODO

## Signing keys for auto-updater

- Generate signing keypair: `bun tauri signer generate -w ~/.tauri/draft.key`
- Replace placeholder pubkey in `src-tauri/tauri.conf.json`
- Store private key + password as GitHub repo secrets

## Vulkan SDK

- Install Vulkan SDK on dev machine
- Switch `whisper-cpp` to `whisper-vulkan` in `src-tauri/Cargo.toml` for GPU-accelerated Whisper
