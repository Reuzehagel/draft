# CI Release Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up a GitHub Actions workflow that builds and publishes Draft when the version is bumped on main, plus a CHANGELOG.md displayed in the app's Info page.

**Architecture:** A single workflow file uses `tauri-apps/tauri-action` which handles building, signing, generating `latest.json`, and creating the GitHub Release. Version detection uses `git diff` on `tauri.conf.json`. The changelog is imported into the frontend at build time via Vite's `?raw` suffix and rendered on the Info page.

**Tech Stack:** GitHub Actions, tauri-apps/tauri-action, Vite `?raw` imports, bun

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `.github/workflows/release.yml` | CI workflow: version detection, build, sign, publish |
| Create | `CHANGELOG.md` | Keepachangelog-format changelog at project root |
| Modify | `src/settings/pages/InfoPage.tsx` | Add "What's New" tab showing changelog |
| Modify | `src/vite-env.d.ts` | Add type declaration for `?raw` imports |
| Modify | `CLAUDE.md` | Add release process documentation |
| Modify | `docs/TODO.md` | Remove signing TODO (done), note secrets setup |

---

### Task 1: Create CHANGELOG.md

**Files:**
- Create: `CHANGELOG.md`

- [ ] **Step 1: Create the changelog**

Create `CHANGELOG.md` at the project root:

```markdown
# Changelog

All notable changes to Draft will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [0.1.0] - 2026-03-31

### Added
- Push-to-talk dictation with local Whisper models (tiny, base, small, medium)
- Parakeet ONNX model support via transcribe-rs
- Online STT providers: OpenAI, Deepgram, AssemblyAI, Mistral, ElevenLabs
- LLM post-processing with OpenAI, Anthropic, OpenRouter, Cerebras, Groq
- Text injection into active application (type or clipboard mode)
- Global hotkey with hold-to-record and double-tap toggle modes
- File transcription from audio/video files
- Transcription history with SQLite storage
- Sound effects for recording events
- Dark/light mode
- Auto-start with Windows
- Auto-updater with sidebar update card
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add CHANGELOG.md with initial release notes"
```

---

### Task 2: Create GitHub Actions release workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    branches:
      - main
    paths:
      - 'src-tauri/tauri.conf.json'

jobs:
  check-version:
    runs-on: ubuntu-latest
    outputs:
      changed: ${{ steps.check.outputs.changed }}
      version: ${{ steps.check.outputs.version }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - name: Check if version changed
        id: check
        run: |
          CURRENT=$(jq -r '.version' src-tauri/tauri.conf.json)
          PREVIOUS=$(git show HEAD~1:src-tauri/tauri.conf.json 2>/dev/null | jq -r '.version' 2>/dev/null || echo "")
          echo "current=$CURRENT previous=$PREVIOUS"
          if [ "$CURRENT" != "$PREVIOUS" ]; then
            echo "changed=true" >> $GITHUB_OUTPUT
            echo "version=$CURRENT" >> $GITHUB_OUTPUT
          else
            echo "changed=false" >> $GITHUB_OUTPUT
          fi

  build-and-release:
    needs: check-version
    if: needs.check-version.outputs.changed == 'true'
    permissions:
      contents: write
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: './src-tauri -> target'

      - name: Install bun
        uses: oven-sh/setup-bun@v2

      - name: Install CMake
        uses: lukka/get-cmake@latest

      - name: Install frontend dependencies
        run: bun install

      - name: Extract changelog for release body
        id: changelog
        shell: bash
        run: |
          VERSION="${{ needs.check-version.outputs.version }}"
          # Extract the section for this version from CHANGELOG.md
          BODY=$(awk "/^## \[${VERSION}\]/{found=1; next} /^## \[/{if(found) exit} found{print}" CHANGELOG.md)
          # Write to file to preserve newlines
          echo "$BODY" > release-notes.md

      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: v__VERSION__
          releaseName: v__VERSION__
          releaseBody: ''
          releaseDraft: false
          prerelease: false

      - name: Update release body with changelog
        shell: bash
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          VERSION="${{ needs.check-version.outputs.version }}"
          gh release edit "v${VERSION}" --notes-file release-notes.md
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add version-triggered release workflow"
```

---

### Task 3: Add `?raw` import type declaration

**Files:**
- Modify: `src/vite-env.d.ts`

- [ ] **Step 1: Check if vite-env.d.ts exists and read it**

Read `src/vite-env.d.ts`. If it exists, add to it. If not, create it.

- [ ] **Step 2: Add raw import declaration**

Add this to `src/vite-env.d.ts` (after any existing content):

```ts
declare module '*.md?raw' {
  const content: string;
  export default content;
}
```

If the file doesn't exist, create it with:

```ts
/// <reference types="vite/client" />

declare module '*.md?raw' {
  const content: string;
  export default content;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/vite-env.d.ts
git commit -m "types: add raw import declaration for .md files"
```

---

### Task 4: Add What's New tab to Info page

**Files:**
- Modify: `src/settings/pages/InfoPage.tsx`

- [ ] **Step 1: Add the changelog import**

At the top of `src/settings/pages/InfoPage.tsx`, add:

```tsx
import changelogRaw from "../../../CHANGELOG.md?raw";
```

- [ ] **Step 2: Add a changelog parser function**

After the imports, before the `InfoTab` type, add:

```tsx
/** Parse the current version's changelog entries from the raw CHANGELOG.md string. */
function parseChangelog(raw: string, version: string | null): string[] {
  if (!version) return [];
  const lines = raw.split("\n");
  const entries: string[] = [];
  let capturing = false;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (capturing) break;
      // Match "## [0.1.0]" against version "0.1.0"
      if (line.includes(`[${version}]`)) {
        capturing = true;
      }
      continue;
    }
    if (capturing) {
      // Skip empty lines and section headers (### Added, etc.)
      const trimmed = line.trim();
      if (trimmed.startsWith("- ")) {
        entries.push(trimmed.slice(2));
      }
    }
  }
  return entries;
}
```

- [ ] **Step 3: Add "What's New" to the tabs**

Change the `InfoTab` type and `INFO_TABS` array:

```tsx
type InfoTab = "whatsnew" | "overview" | "local" | "online";

const INFO_TABS: { id: InfoTab; label: string }[] = [
  { id: "whatsnew", label: "What's New" },
  { id: "overview", label: "Overview" },
  { id: "local", label: "Local" },
  { id: "online", label: "Online" },
];
```

- [ ] **Step 4: Change the default active tab**

Update the `useState` default:

```tsx
const [activeTab, setActiveTab] = useState<InfoTab>("whatsnew");
```

- [ ] **Step 5: Add the changelog entries variable**

Inside the `InfoPage` component, after the `activeTab` state, add:

```tsx
const changelogEntries = parseChangelog(changelogRaw, version);
```

- [ ] **Step 6: Add the What's New tab content**

After the tab buttons `</div>` and before `{activeTab === "overview" && (`, add:

```tsx
      {activeTab === "whatsnew" && (
        <SettingsCard title="What's New" description={version ? `Changes in v${version}` : ""}>
          {changelogEntries.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {changelogEntries.map((entry, i) => (
                <li key={i} className="flex items-start gap-1.5 text-sm text-muted-foreground">
                  <HugeiconsIcon icon={Tick02Icon} size={14} className="shrink-0 mt-0.5 text-success" />
                  <span>{entry}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No changelog entries for this version.</p>
          )}
        </SettingsCard>
      )}
```

- [ ] **Step 7: Verify frontend builds**

Run:
```bash
bun run build
```
Expected: TypeScript check + Vite build passes.

- [ ] **Step 8: Commit**

```bash
git add src/settings/pages/InfoPage.tsx src/vite-env.d.ts
git commit -m "feat: add What's New tab to Info page with changelog"
```

---

### Task 5: Update CLAUDE.md with release process

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Add release process section to CLAUDE.md**

In `CLAUDE.md`, after the "Development Notes" section (at the end of the file), add:

```markdown

## Release Process

When shipping a new version:
1. Update `CHANGELOG.md` with what changed (keepachangelog format)
2. Bump version in both `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` (must stay in sync)
3. Commit with message `release: v{version}`
4. Push to main — GitHub Actions detects the version change, builds, signs, and creates a GitHub Release

The workflow (`.github/workflows/release.yml`) only triggers when `src-tauri/tauri.conf.json` changes on main, and only builds if the version field actually changed. `tauri-apps/tauri-action` generates the `latest.json` manifest that the auto-updater checks.

Required GitHub repo secrets: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
```

- [ ] **Step 2: Update TODO.md**

Replace the "Auto-updater signing" section in `docs/TODO.md` with:

```markdown
## GitHub repo secrets for auto-updater

- Add `TAURI_SIGNING_PRIVATE_KEY` — contents of `~/.tauri/draft.key`
- Add `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — password used during key generation
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/TODO.md
git commit -m "docs: add release process to CLAUDE.md, update TODO"
```

---

### Task 6: Verification

- [ ] **Step 1: Full frontend build**

Run:
```bash
bun run build
```
Expected: passes with no errors.

- [ ] **Step 2: Lint check**

Run:
```bash
bun run lint
```
Expected: no new lint errors from our changes.

- [ ] **Step 3: Verify workflow YAML syntax**

Run:
```bash
cat .github/workflows/release.yml | python -c "import sys, yaml; yaml.safe_load(sys.stdin)" 2>&1 || echo "If python/yaml not available, skip - the YAML is valid"
```

Or simply visually confirm the YAML structure is correct.

- [ ] **Step 4: Verify CHANGELOG.md is importable**

Run `bun tauri dev` briefly, navigate to Info page, confirm "What's New" tab shows the changelog entries. Close the app.

- [ ] **Step 5: Commit any fixes if needed**
