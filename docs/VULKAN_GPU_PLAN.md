# Vulkan GPU Acceleration Plan

## Prerequisites
- Install Vulkan SDK on dev machine: https://vulkan.lunarg.com

## Implementation

### 1. Add feature
```toml
# Cargo.toml
whisper-rs = { version = "0.15", features = ["vulkan"] }
```

### 2. Enable GPU in whisper init
```rust
// src/stt/whisper.rs - in transcribe()
params.use_gpu(true);
```

### 3. Clean build
```bash
cargo clean -p whisper-rs-sys && bun tauri build
```

### 4. Test
- Should see ~5-10x speedup
- 20s audio: ~4.5s (CPU) → ~0.5-1s (GPU)

## Distribution
- Users need GPU drivers only (already have)
- No CUDA/SDK install for end users
- Vulkan runtime bundled with modern GPU drivers

## Fallback
- No GPU/Vulkan → whisper-rs falls back to CPU automatically

## Risk
- Build may need cmake Vulkan flags if fails
- Check whisper-rs-sys build output for Vulkan detection
