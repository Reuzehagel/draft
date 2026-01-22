# Whisper-rs Release Build Performance Issue

## Problem Summary

Release builds of the application have significantly slower Whisper transcription performance compared to debug/dev builds. This is counterintuitive - release builds should be faster, not slower.

## Observed Behavior

| Build Mode | Audio Length | Transcription Time | Speed Ratio |
|------------|--------------|-------------------|-------------|
| Release (`bun tauri build`) | 10.91s | **7.34s** | 0.67s per 1s audio |
| Dev (`bun tauri dev`) | 6.80s | **2.17s** | 0.32s per 1s audio |

**Dev mode is approximately 2x faster than release mode for transcription.**

## Root Cause (Confirmed)

This is a **known issue** documented at [whisper-rs Issue #226](https://codeberg.org/tazz4843/whisper-rs/issues/226).

### The Problem Chain

1. **Visual Studio is a multi-config generator** - `CMAKE_BUILD_TYPE` is ignored; it uses config-specific flags like `CMAKE_CXX_FLAGS_RELEASE` instead
2. **cmake-rs crate strips optimization flags** - It filters out `-O*` and `/O*` flags from `CFLAGS`/`CXXFLAGS` environment variables ([aws-lc-rs #710](https://github.com/aws/aws-lc-rs/issues/710))
3. **whisper.cpp compiles without optimizations** - The resulting binary is ~10x slower

### Evidence from CMake Cache

After a release build, inspecting the CMake cache shows:
```
CMAKE_CXX_FLAGS_RELEASE:STRING= /utf-8 -nologo -MD -Brepro -W0 /DNDEBUG
```

**Notice: No `/O2` optimization flag!**

Expected MSVC Release flags:
```
CMAKE_CXX_FLAGS_RELEASE:STRING=/MD /O2 /Ob2 /DNDEBUG
```

## Confirmed Solutions

### Solution 1: Patch whisper-rs-sys (Confirmed Working)

Users in [Issue #226](https://codeberg.org/tazz4843/whisper-rs/issues/226) confirmed that adding these lines to `whisper-rs-sys/build.rs` fixes the issue:

```rust
// In the else branch (release builds)
config.cxxflag("-O2");
config.cxxflag("-DNDEBUG");
```

This bypasses cmake-rs's flag stripping by using `cxxflag()` directly.

**Implementation via Cargo patch:**

1. Fork whisper-rs to your GitHub
2. Modify `sys/build.rs` to add the flags above
3. Add to `Cargo.toml`:
   ```toml
   [patch.crates-io]
   whisper-rs-sys = { git = "https://github.com/YOUR_FORK/whisper-rs" }
   ```

### Solution 2: Use `force-debug` Feature (Workaround)

The `force-debug` feature compiles whisper.cpp with `RelWithDebInfo` which includes optimizations:

```toml
# Cargo.toml
[dependencies]
whisper-rs-sys = { version = "0.14", features = ["force-debug"] }
```

**Note:** This may increase binary size due to debug info, but provides optimized code.

### Solution 3: Environment Variables (Current Attempt - May Not Work)

The current `.cargo/config.toml` attempts to use `CMAKE_*_FLAGS_RELEASE` env vars:
```toml
[env]
CMAKE_C_FLAGS_RELEASE = "/O2 /Ob2 /Oi /Ot /DNDEBUG /arch:AVX2 /fp:fast"
CMAKE_CXX_FLAGS_RELEASE = "/O2 /Ob2 /Oi /Ot /DNDEBUG /arch:AVX2 /fp:fast /EHsc"
```

**Status:** Testing pending. May not work because cmake-rs strips `/O2` before these reach CMake.

## What Doesn't Work

| Approach | Why It Fails |
|----------|-------------|
| `CFLAGS="/O2"` env var | cmake-rs strips `/O2` flag during processing |
| `CMAKE_BUILD_TYPE=Release` | Visual Studio ignores this (multi-config generator) |
| Rust `[profile.release]` | Only affects Rust code, not native C/C++ |
| `RUSTFLAGS` | Only affects rustc, not CMake/MSVC |

## Recommended Fix

**Use Solution 1 (Cargo patch)** for the most reliable fix. Here's the complete implementation:

### Step 1: Fork and Patch

Fork [whisper-rs](https://codeberg.org/tazz4843/whisper-rs) and modify `sys/build.rs`:

```rust
// Around line 200, in the release build section (else branch)
} else {
    config.define("CMAKE_BUILD_TYPE", "Release");
    // Force optimization flags for MSVC (cmake-rs strips them otherwise)
    if cfg!(target_env = "msvc") {
        config.cxxflag("/O2");
        config.cxxflag("/Ob2");
        config.cxxflag("/DNDEBUG");
        config.cflag("/O2");
        config.cflag("/Ob2");
        config.cflag("/DNDEBUG");
    } else {
        config.cxxflag("-O2");
        config.cxxflag("-DNDEBUG");
        config.cflag("-O2");
        config.cflag("-DNDEBUG");
    }
}
```

### Step 2: Use Cargo Patch

```toml
# Cargo.toml
[patch.crates-io]
whisper-rs-sys = { git = "https://github.com/YOUR_USERNAME/whisper-rs", branch = "msvc-optimization-fix" }
```

### Step 3: Clean and Rebuild

```bash
cargo clean
bun tauri build
```

### Step 4: Verify

Check the CMake output or the resulting binary performance. Transcription of 10s audio should take ~3s instead of ~7s.

## Environment

- OS: Windows 11
- Rust: 1.85+
- Visual Studio: 2022 Build Tools
- whisper-rs: 0.15.1
- whisper-rs-sys: 0.14.1

## References

- [whisper-rs Issue #226: x10 Slower in Release Build](https://codeberg.org/tazz4843/whisper-rs/issues/226)
- [cmake-rs CFLAGS stripping issue (aws-lc-rs #710)](https://github.com/aws/aws-lc-rs/issues/710)
- [whisper-rs repository](https://codeberg.org/tazz4843/whisper-rs)
- [GitHub mirror](https://github.com/tazz4843/whisper-rs)
- [whisper-rs-sys build.rs](https://github.com/tazz4843/whisper-rs/blob/master/sys/build.rs)
