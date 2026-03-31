# Auto-Updater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add silent auto-update to Draft so the app checks GitHub Releases on startup, downloads in the background, and shows a "Relaunch" card in the sidebar when ready.

**Architecture:** Rust backend drives the update lifecycle (check → download → ready) using `tauri-plugin-updater`. State is held in `Arc<Mutex<UpdateStatus>>` and broadcast to the frontend via a single `update-status` event. Frontend renders an `UpdateCard` in the sidebar that reacts to state changes.

**Tech Stack:** tauri-plugin-updater v2, Tauri managed state, React, TypeScript

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src-tauri/src/updater/mod.rs` | Module root, re-exports |
| Create | `src-tauri/src/updater/state.rs` | `UpdateStatus` enum, `UpdateState` managed state wrapper, `get_update_status` command |
| Create | `src-tauri/src/updater/commands.rs` | `check_for_update` (check + auto-download), `install_update` commands |
| Modify | `src-tauri/src/events.rs` | Add `UPDATE_STATUS` constant |
| Modify | `src-tauri/src/config.rs` | Add `auto_update_enabled: bool` field |
| Modify | `src-tauri/src/lib.rs` | Register updater plugin, manage state, register commands, spawn startup check |
| Modify | `src-tauri/Cargo.toml` | Add `tauri-plugin-updater` dependency |
| Modify | `src-tauri/tauri.conf.json` | Add updater plugin config (pubkey + endpoint) |
| Modify | `src-tauri/capabilities/default.json` | Add `updater:default` permission |
| Create | `src/shared/types/updater.ts` | `UpdateStatus` TypeScript type |
| Modify | `src/shared/types/config.ts` | Add `auto_update_enabled` field |
| Modify | `src/shared/constants/events.ts` | Add `UPDATE_STATUS` constant |
| Create | `src/settings/hooks/useUpdateStatus.ts` | Hook: hydrate + listen for update status |
| Create | `src/settings/components/UpdateCard.tsx` | Sidebar update card component |
| Modify | `src/settings/components/Sidebar.tsx` | Render `UpdateCard` |
| Modify | `src/settings/SettingsApp.tsx` | Wire `useUpdateStatus` hook, pass to Sidebar |
| Modify | `src/settings/pages/AdvancedPage.tsx` | Add auto-update toggle |

---

### Task 1: Add `tauri-plugin-updater` dependency and config

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Generate signing keypair**

Run:
```bash
bun tauri signer generate -w ~/.tauri/draft.key
```

This outputs a public key and saves the private key to `~/.tauri/draft.key`. Copy the public key for the next step.

- [ ] **Step 2: Add dependency to Cargo.toml**

In `src-tauri/Cargo.toml`, add after the `tauri-plugin-dialog` line:

```toml
# Auto-updater
tauri-plugin-updater = "2"
```

- [ ] **Step 3: Add updater config to tauri.conf.json**

Replace the empty `"plugins": {}` with:

```json
"plugins": {
  "updater": {
    "pubkey": "<paste-public-key-from-step-1>",
    "endpoints": [
      "https://github.com/Reuzehagel/draft/releases/latest/download/latest.json"
    ]
  }
}
```

- [ ] **Step 4: Add updater permission to capabilities**

In `src-tauri/capabilities/default.json`, add `"updater:default"` to the permissions array:

```json
"permissions": [
  "core:default",
  "global-shortcut:allow-register",
  "global-shortcut:allow-unregister",
  "global-shortcut:allow-is-registered",
  "notification:default",
  "autostart:allow-enable",
  "autostart:allow-disable",
  "autostart:allow-is-enabled",
  "dialog:allow-open",
  "updater:default"
]
```

- [ ] **Step 5: Verify it compiles**

Run:
```bash
cargo build --manifest-path src-tauri/Cargo.toml
```
Expected: compiles successfully.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json src-tauri/capabilities/default.json
git commit -m "deps: add tauri-plugin-updater with signing config"
```

---

### Task 2: Add `auto_update_enabled` config field

**Files:**
- Modify: `src-tauri/src/config.rs`
- Modify: `src/shared/types/config.ts`

- [ ] **Step 1: Add field to Rust Config struct**

In `src-tauri/src/config.rs`, add to the `Config` struct after `history_max_entries`:

```rust
pub auto_update_enabled: bool,
```

And in the `Default` impl, add after `history_max_entries: 500,`:

```rust
auto_update_enabled: true,
```

- [ ] **Step 2: Add field to TypeScript Config interface**

In `src/shared/types/config.ts`, add to the `Config` interface after `history_max_entries`:

```ts
auto_update_enabled: boolean;
```

- [ ] **Step 3: Verify it compiles**

Run:
```bash
cargo build --manifest-path src-tauri/Cargo.toml
```
Expected: compiles successfully (serde `#[serde(default)]` handles existing configs without the field).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/config.rs src/shared/types/config.ts
git commit -m "config: add auto_update_enabled field"
```

---

### Task 3: Add `UPDATE_STATUS` event constant

**Files:**
- Modify: `src-tauri/src/events.rs`
- Modify: `src/shared/constants/events.ts`

- [ ] **Step 1: Add Rust constant**

In `src-tauri/src/events.rs`, add at the end:

```rust
pub const UPDATE_STATUS: &str = "update-status";
```

- [ ] **Step 2: Add TypeScript constant**

In `src/shared/constants/events.ts`, add at the end:

```ts
export const UPDATE_STATUS = "update-status";
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/events.rs src/shared/constants/events.ts
git commit -m "events: add UPDATE_STATUS constant"
```

---

### Task 4: Create updater backend module

**Files:**
- Create: `src-tauri/src/updater/mod.rs`
- Create: `src-tauri/src/updater/state.rs`
- Create: `src-tauri/src/updater/commands.rs`

- [ ] **Step 1: Create `src-tauri/src/updater/mod.rs`**

```rust
mod commands;
mod state;

pub use commands::{check_for_update, install_update};
pub use state::{get_update_status, UpdateState};
```

- [ ] **Step 2: Create `src-tauri/src/updater/state.rs`**

```rust
use serde::Serialize;
use std::sync::Mutex;

/// Update lifecycle state, broadcast to frontend via `update-status` event.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum UpdateStatus {
    Idle,
    Checking,
    Downloading { progress: u8 },
    Ready { version: String },
    Error { message: String },
}

/// Tauri managed state wrapper.
#[derive(Default)]
pub struct UpdateState {
    pub inner: Mutex<UpdateStatus>,
}

impl Default for UpdateStatus {
    fn default() -> Self {
        Self::Idle
    }
}

#[tauri::command]
pub fn get_update_status(state: tauri::State<'_, UpdateState>) -> UpdateStatus {
    state.inner.lock().unwrap_or_else(|e| e.into_inner()).clone()
}
```

- [ ] **Step 3: Create `src-tauri/src/updater/commands.rs`**

```rust
use tauri::Manager;
use tauri_plugin_updater::UpdaterExt;

use super::state::{UpdateState, UpdateStatus};
use crate::config;
use crate::events;

/// Emit the current update status to the frontend.
fn emit_status(app: &tauri::AppHandle, status: UpdateStatus) {
    let state = app.state::<UpdateState>();
    *state.inner.lock().unwrap_or_else(|e| e.into_inner()) = status.clone();
    let _ = app.emit(events::UPDATE_STATUS, &status);
}

/// Check for updates and auto-download if available.
/// Called on app startup (spawned as async task).
#[tauri::command]
pub async fn check_for_update(app: tauri::AppHandle) -> Result<(), String> {
    let cfg = config::load_config();
    if !cfg.auto_update_enabled {
        return Ok(());
    }

    emit_status(&app, UpdateStatus::Checking);

    let updater = app.updater().map_err(|e| e.to_string())?;
    let response = match updater.check().await {
        Ok(Some(update)) => update,
        Ok(None) => {
            emit_status(&app, UpdateStatus::Idle);
            return Ok(());
        }
        Err(e) => {
            log::error!("Update check failed: {}", e);
            emit_status(&app, UpdateStatus::Error {
                message: e.to_string(),
            });
            return Err(e.to_string());
        }
    };

    let version = response.version.clone();
    log::info!("Update available: {}", version);

    let app_handle = app.clone();
    let version_for_ready = version.clone();
    let downloaded = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));

    let result = response
        .download_and_install(
            {
                let downloaded = downloaded.clone();
                move |chunk_length, content_length| {
                    let total_downloaded = downloaded.fetch_add(chunk_length as u64, std::sync::atomic::Ordering::Relaxed) + chunk_length as u64;
                    if let Some(total) = content_length {
                        let progress = ((total_downloaded * 100) / total).min(99) as u8;
                        emit_status(&app_handle, UpdateStatus::Downloading { progress });
                    }
                }
            },
            || {
                log::info!("Update download finished");
            },
        )
        .await;

    match result {
        Ok(()) => {
            emit_status(&app, UpdateStatus::Ready {
                version: version_for_ready,
            });
            Ok(())
        }
        Err(e) => {
            log::error!("Update download/install failed: {}", e);
            emit_status(&app, UpdateStatus::Error {
                message: e.to_string(),
            });
            Err(e.to_string())
        }
    }
}

/// Install the downloaded update and restart the app.
#[tauri::command]
pub fn install_update(app: tauri::AppHandle) {
    app.restart();
}
```

- [ ] **Step 4: Verify it compiles**

Run:
```bash
cargo build --manifest-path src-tauri/Cargo.toml
```
Expected: Fails — `mod updater` not declared in `lib.rs` yet. That's expected at this stage. Verify there are no syntax errors by checking the error is only about the missing module declaration.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/updater/
git commit -m "feat: add updater backend module (state + commands)"
```

---

### Task 5: Wire updater into app startup (`lib.rs`)

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add module declaration**

In `src-tauri/src/lib.rs`, add after `mod stt;`:

```rust
mod updater;
```

- [ ] **Step 2: Register plugin**

In the plugin chain (after `.plugin(tauri_plugin_dialog::init())`), add:

```rust
.plugin(tauri_plugin_updater::Builder::new().build())
```

- [ ] **Step 3: Manage updater state**

After `.manage(SettingsReady::default())`, add:

```rust
.manage(updater::UpdateState::default())
```

- [ ] **Step 4: Register commands**

In the `invoke_handler` `generate_handler!` macro, add these three commands:

```rust
updater::get_update_status,
updater::check_for_update,
updater::install_update,
```

- [ ] **Step 5: Spawn update check on startup**

In the `setup` closure, after `log::info!("Draft initialized successfully");` and before `Ok(())`, add:

```rust
// Check for updates in the background
let handle = app.handle().clone();
tauri::async_runtime::spawn(async move {
    if let Err(e) = updater::check_for_update(handle).await {
        log::warn!("Startup update check failed: {}", e);
    }
});
```

Note: `check_for_update` here calls the function directly (not via Tauri command invoke), so we need to add a public helper. Update `src-tauri/src/updater/commands.rs` — add a standalone async function that `check_for_update` command delegates to, and export it for use from `lib.rs`:

In `src-tauri/src/updater/commands.rs`, rename the core logic into a public async function:

```rust
/// Core update check logic, callable from both the Tauri command and app startup.
pub async fn do_check_for_update(app: tauri::AppHandle) -> Result<(), String> {
    // ... (same body as check_for_update)
}

#[tauri::command]
pub async fn check_for_update(app: tauri::AppHandle) -> Result<(), String> {
    do_check_for_update(app).await
}
```

Update `src-tauri/src/updater/mod.rs` to also export `do_check_for_update`:

```rust
pub use commands::{check_for_update, do_check_for_update, install_update};
```

Then the startup spawn becomes:

```rust
let handle = app.handle().clone();
tauri::async_runtime::spawn(async move {
    if let Err(e) = updater::do_check_for_update(handle).await {
        log::warn!("Startup update check failed: {}", e);
    }
});
```

- [ ] **Step 6: Verify it compiles**

Run:
```bash
cargo build --manifest-path src-tauri/Cargo.toml
```
Expected: compiles successfully.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/src/updater/
git commit -m "feat: wire updater plugin into app startup"
```

---

### Task 6: Create frontend `UpdateStatus` type and `useUpdateStatus` hook

**Files:**
- Create: `src/shared/types/updater.ts`
- Create: `src/settings/hooks/useUpdateStatus.ts`

- [ ] **Step 1: Create `src/shared/types/updater.ts`**

```ts
export type UpdateStatus =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "downloading"; progress: number }
  | { status: "ready"; version: string }
  | { status: "error"; message: string };
```

- [ ] **Step 2: Create `src/settings/hooks/useUpdateStatus.ts`**

```ts
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { UPDATE_STATUS } from "@/shared/constants/events";
import type { UpdateStatus } from "@/shared/types/updater";

export function useUpdateStatus(): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>({ status: "idle" });

  useEffect(() => {
    // Hydrate current state on mount (handles window reopen)
    invoke<UpdateStatus>("get_update_status").then(setStatus).catch(() => {});

    // Listen for live state transitions
    const unlisten = listen<UpdateStatus>(UPDATE_STATUS, (event) => {
      setStatus(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return status;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/types/updater.ts src/settings/hooks/useUpdateStatus.ts
git commit -m "feat: add UpdateStatus type and useUpdateStatus hook"
```

---

### Task 7: Create `UpdateCard` component

**Files:**
- Create: `src/settings/components/UpdateCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { invoke } from "@tauri-apps/api/core";
import { HugeiconsIcon } from "@hugeicons/react";
import { Leaf01Icon, Alert01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/Spinner";
import type { UpdateStatus } from "@/shared/types/updater";

interface UpdateCardProps {
  status: UpdateStatus;
}

export function UpdateCard({ status }: UpdateCardProps): React.ReactNode {
  if (status.status === "idle" || status.status === "checking") {
    return null;
  }

  if (status.status === "downloading") {
    return (
      <div className="mx-2 mb-2 rounded-lg bg-card border border-border p-3 flex items-center gap-2">
        <Spinner className="size-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-medium truncate">Updating...</p>
          <p className="text-[10px] text-muted-foreground">{status.progress}%</p>
        </div>
      </div>
    );
  }

  if (status.status === "ready") {
    return (
      <div className="mx-2 mb-2 rounded-lg bg-card border border-border p-3 flex flex-col items-center gap-2 text-center">
        <HugeiconsIcon icon={Leaf01Icon} size={20} className="text-muted-foreground" />
        <div>
          <p className="text-xs font-medium">Updated to {status.version}</p>
          <p className="text-[10px] text-muted-foreground">Relaunch to apply</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => invoke("install_update")}
        >
          Relaunch
        </Button>
      </div>
    );
  }

  // Error state
  if (status.status === "error") {
    return (
      <button
        className="mx-2 mb-2 rounded-lg bg-card border border-destructive/50 p-3 flex items-center gap-2 w-full text-left hover:bg-accent transition-colors"
        onClick={() => invoke("check_for_update")}
        title="Click to retry"
      >
        <HugeiconsIcon icon={Alert01Icon} size={16} className="text-destructive shrink-0" />
        <p className="text-[10px] text-muted-foreground truncate">{status.message}</p>
      </button>
    );
  }

  return null;
}
```

- [ ] **Step 2: Verify icons exist**

Check that `Leaf01Icon` and `Alert01Icon` are available in `@hugeicons/core-free-icons`. If not, substitute with other available icons from the same package (e.g., `ArrowReloadHorizontalIcon` for leaf, `AlertCircleIcon` for error). The existing codebase already imports from this package — check `Sidebar.tsx` for the import pattern.

- [ ] **Step 3: Commit**

```bash
git add src/settings/components/UpdateCard.tsx
git commit -m "feat: add UpdateCard sidebar component"
```

---

### Task 8: Wire UpdateCard into Sidebar and SettingsApp

**Files:**
- Modify: `src/settings/components/Sidebar.tsx`
- Modify: `src/settings/SettingsApp.tsx`

- [ ] **Step 1: Add UpdateStatus prop to Sidebar**

In `src/settings/components/Sidebar.tsx`:

Add import at the top:

```tsx
import { UpdateCard } from "./UpdateCard";
import type { UpdateStatus } from "@/shared/types/updater";
```

Add `updateStatus` to `SidebarProps`:

```tsx
interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  isDark: boolean;
  toggleDarkMode: () => void;
  version: string | null;
  saved: boolean;
  updateStatus: UpdateStatus;
}
```

Update the destructuring in the `Sidebar` function:

```tsx
export function Sidebar({ activePage, onNavigate, isDark, toggleDarkMode, version, saved, updateStatus }: SidebarProps): React.ReactNode {
```

Add `<UpdateCard />` between the closing `</nav>` and the footer `<div className="px-3 py-2.5 ...">`:

```tsx
      </nav>

      <UpdateCard status={updateStatus} />

      <div className="px-3 py-2.5 border-t border-sidebar-border flex items-center justify-between">
```

- [ ] **Step 2: Wire hook in SettingsApp**

In `src/settings/SettingsApp.tsx`:

Add import:

```tsx
import { useUpdateStatus } from "./hooks/useUpdateStatus";
```

Inside the `SettingsApp` component, after the `version` state:

```tsx
const updateStatus = useUpdateStatus();
```

Pass to Sidebar:

```tsx
<Sidebar
  activePage={activePage}
  onNavigate={setActivePage}
  isDark={isDark}
  toggleDarkMode={toggleDarkMode}
  version={version}
  saved={saved}
  updateStatus={updateStatus}
/>
```

- [ ] **Step 3: Verify frontend builds**

Run:
```bash
bun run build
```
Expected: TypeScript check + Vite build passes.

- [ ] **Step 4: Commit**

```bash
git add src/settings/components/Sidebar.tsx src/settings/SettingsApp.tsx
git commit -m "feat: wire UpdateCard into sidebar"
```

---

### Task 9: Add auto-update toggle to AdvancedPage

**Files:**
- Modify: `src/settings/pages/AdvancedPage.tsx`

- [ ] **Step 1: Add Updates settings card**

In `src/settings/pages/AdvancedPage.tsx`, add a new `SettingsCard` before the Reset card (before `<SettingsCard title="Reset" ...>`):

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

- [ ] **Step 2: Add `auto_update_enabled` to DEFAULT_CONFIG**

In the `DEFAULT_CONFIG` object, add after `history_max_entries: 500,`:

```tsx
auto_update_enabled: true,
```

- [ ] **Step 3: Verify frontend builds**

Run:
```bash
bun run build
```
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/settings/pages/AdvancedPage.tsx
git commit -m "feat: add auto-update toggle to Advanced settings"
```

---

### Task 10: Full build verification and manual test

- [ ] **Step 1: Full Rust build**

Run:
```bash
cargo build --manifest-path src-tauri/Cargo.toml
```
Expected: compiles with no errors.

- [ ] **Step 2: Full frontend build**

Run:
```bash
bun run build
```
Expected: TypeScript check + Vite build passes with no errors.

- [ ] **Step 3: Lint check**

Run:
```bash
bun run lint
```
Expected: no new lint errors from our changes.

- [ ] **Step 4: Dev mode smoke test**

Run:
```bash
bun tauri dev
```

Verify:
1. App starts without crashes
2. Settings window opens — sidebar shows version badge at bottom
3. No update card visible (expected — no GitHub Release exists yet, so check returns no update)
4. Advanced page shows "Updates" card with "Auto-update" toggle (default: on)
5. Toggling auto-update off/on persists after closing and reopening settings
6. Check the Rust logs — should see the update check attempt and a graceful error (no release endpoint exists yet)

- [ ] **Step 5: Commit any fixes if needed**

---

### Task 11: Update CLAUDE.md and TODO.md

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Add updater module to CLAUDE.md backend structure**

In `CLAUDE.md`, in the Backend Structure section, add after the `sound/` entry:

```markdown
- `updater/` - Auto-update module:
  - `state.rs` - UpdateStatus enum and managed state wrapper
  - `commands.rs` - `check_for_update`, `install_update` commands
```

- [ ] **Step 2: Add updater event to CLAUDE.md events section**

In the Event Communication section, add:

```markdown
- `update-status` - Update lifecycle state (idle, checking, downloading, ready, error)
```

- [ ] **Step 3: Remove auto-updater from TODO.md**

Remove or mark as done the "Auto-Updater" section in `docs/TODO.md` since it's now implemented.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/TODO.md
git commit -m "docs: update CLAUDE.md and TODO.md for auto-updater"
```
