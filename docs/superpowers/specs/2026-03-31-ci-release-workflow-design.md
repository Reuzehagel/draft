# CI Release Workflow Design Spec

## Overview

A GitHub Actions workflow that automatically builds and publishes the Draft Tauri app when the version in `tauri.conf.json` is bumped on main. Includes a CHANGELOG.md that gets displayed in the app's Info page.

## Workflow: `.github/workflows/release.yml`

### Trigger

Push to `main` branch.

### Version detection

Compare the version in `tauri.conf.json` between the current and previous commit. If unchanged, exit early with no build. This ensures frequent commits to main don't trigger unnecessary builds.

### Build environment

- Runner: `windows-latest`
- Installs: Rust (stable), bun, CMake (via chocolatey or setup-cmake action)
- Visual Studio Build Tools come pre-installed on `windows-latest`

### Build steps

1. Checkout repo
2. Install Rust toolchain
3. Install bun
4. Install CMake
5. Run `bun install`
6. Run `bun tauri build`
7. Sign the update bundle (using repo secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`)

### Publish

Create a GitHub Release:
- Tag: `v{version}` (e.g., `v0.2.0`)
- Title: `v{version}`
- Body: Extract the current version's section from CHANGELOG.md
- Assets: `.msi.zip` installer bundle + `latest.json` updater manifest
- Auto-published (not draft)

### Secrets required

- `TAURI_SIGNING_PRIVATE_KEY` — Contents of `~/.tauri/draft.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — Password used when generating the keypair

## CHANGELOG.md

Standard keepachangelog format at project root:

```markdown
# Changelog

## [0.2.0] - 2026-04-01

### Added
- Auto-updater with sidebar update card

### Fixed
- Some bug fix

## [0.1.0] - 2026-03-30

### Added
- Initial release
```

Maintained by Claude Code as part of each version bump.

## Info page changelog display

The Info page shows a "What's New" section displaying changelog content. The changelog is imported as a string at build time via Vite's `?raw` import suffix. Parsed and rendered as formatted text in the Info page, showing the current version's entries.

## Release process (added to CLAUDE.md)

When shipping a version:
1. Update `CHANGELOG.md` with what changed
2. Bump version in both `tauri.conf.json` and `Cargo.toml` (must stay in sync)
3. Commit with message `release: v{version}`
4. Push to main — workflow detects version change and handles the rest

## What's NOT included

- No manual/draft release review — auto-publishes
- No multi-platform builds — Windows only
- No nightly/beta channels — single release channel
- No automatic version bumping — Claude Code bumps manually as part of the release process
