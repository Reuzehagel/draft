# Auto-Updater Design Spec

## Overview

Silent auto-updater for Draft using `tauri-plugin-updater` with GitHub Releases. Checks on app start, downloads in the background, and prompts the user to relaunch via a card in the sidebar.

## Approach

Rust-driven: backend manages the full check → download → ready lifecycle. Frontend receives state via a single Tauri event and renders accordingly. This ensures downloads complete even when the settings window is hidden.

## Backend

### New module: `src-tauri/src/updater/`

**`state.rs`**

```rust
enum UpdateStatus {
    Idle,
    Checking,
    Downloading { progress: u8 },
    Ready { version: String },
    Error { message: String },
}
```

Wrapped in `Arc<Mutex<UpdateStatus>>` and registered as Tauri managed state. Provides a `get_update_status` command so the frontend can query state on window open.

**`commands.rs`**

Two Tauri commands:

- `check_for_update` — Uses `tauri-plugin-updater` API to check GitHub Releases. If an update is found, immediately starts downloading. Emits `update-status` events at each state transition (Checking → Downloading → Ready, or → Error). Does nothing if `auto_update_enabled` is `false` in config.
- `install_update` — Triggers the updater's install-and-restart. Called when user clicks "Relaunch".

### App startup integration (`lib.rs`)

- Register `tauri-plugin-updater` in the plugin chain.
- After setup completes, spawn an async task that reads config, and if `auto_update_enabled` is true, calls the update check logic.

### Event (`events.rs`)

Add one constant:

```
pub const UPDATE_STATUS: &str = "update-status";
```

Payload is the serialized `UpdateStatus` enum.

### Config addition

Add `auto_update_enabled: bool` to the Rust `Config` struct with `Default` = `true`.

### Signing

Tauri v2 updater requires update bundles to be signed with an Ed25519 keypair. The public key goes in `tauri.conf.json` under `plugins.updater.pubkey`. The private key + password are set as environment variables (`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) during CI builds. Keys generated once via `bun tauri signer generate`.

### Updater config (`tauri.conf.json`)

```json
{
  "plugins": {
    "updater": {
      "pubkey": "<generated-public-key>",
      "endpoints": [
        "https://github.com/Reuzehagel/draft/releases/latest/download/latest.json"
      ]
    }
  }
}
```

### Capabilities

Add updater permissions to `src-tauri/capabilities/default.json`:

```json
"updater:default"
```

## Frontend

### New event constant (`events.ts`)

```ts
export const UPDATE_STATUS = "update-status";
```

### New shared type (`src/shared/types/updater.ts`)

```ts
type UpdateStatus =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "downloading"; progress: number }
  | { status: "ready"; version: string }
  | { status: "error"; message: string };
```

### New component: `UpdateCard` (`src/settings/components/UpdateCard.tsx`)

Rendered in the Sidebar above the footer (version badge area). Only visible when status is `downloading`, `ready`, or `error`.

States:
- **Downloading**: Spinner + "Updating..." + progress percentage
- **Ready**: Leaf/check icon + "Updated to {version}" + "Relaunch to apply" subtext + "Relaunch" button
- **Error**: Error text, click to retry

Data flow:
1. On mount, invoke `get_update_status` to hydrate current state
2. Listen to `update-status` event for live transitions
3. "Relaunch" button invokes `install_update`

### Sidebar changes (`Sidebar.tsx`)

- Accept `updateStatus` prop (or use a hook internally)
- Render `<UpdateCard />` between the nav and the footer, in the bottom area

### Advanced page toggle

Add an "Auto-update" toggle to the AdvancedPage, placed in a new `SettingsCard` titled "Updates" above the Reset card:

```tsx
<SettingsCard title="Updates">
  <SettingRow label="Auto-update" description="Check for updates on startup" inline>
    <Switch
      checked={config?.auto_update_enabled ?? true}
      onCheckedChange={(auto_update_enabled) => updateConfig({ auto_update_enabled })}
    />
  </SettingRow>
</SettingsCard>
```

### Config type addition (`config.ts`)

Add `auto_update_enabled: boolean` to the `Config` interface.

## Release Workflow

1. Generate signing keypair: `bun tauri signer generate -w ~/.tauri/draft.key`
2. Store private key + password as GitHub repo secrets
3. Bump version in `tauri.conf.json` and `Cargo.toml`
4. Create a GitHub Release with the `.msi.zip` bundle and `latest.json` manifest
5. The app checks the `latest.json` endpoint on start and self-updates

The CI/CD pipeline for automated releases is out of scope for this spec — releases will be created manually for now.

## What's NOT included

- No beta/stable release channels — single channel only
- No CI/CD automation for building releases
- No update check interval or periodic re-checks — startup only
- No mandatory/forced updates
