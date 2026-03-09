set shell := ["pwsh", "-NoProfile", "-Command"]

# Development
dev:
    bun tauri dev

# Frontend only dev server
frontend:
    bun run dev

# Production build
build:
    bun tauri build

# Frontend build (typecheck + vite)
build-frontend:
    bun run build

# Rust build
build-rust:
    cargo build --manifest-path src-tauri/Cargo.toml

# Rust tests
test:
    cargo test --manifest-path src-tauri/Cargo.toml

# Lint frontend
lint:
    bun run lint

# Install dependencies
install:
    bun install
