# Version History Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a version picker combobox to the "What's New" section so users can browse changelog entries for any version, not just the current one.

**Architecture:** Extend the existing `parseChangelog` function to also extract all version strings, add a `selectedVersion` state, and wire a shadcn combobox into InfoPage. No backend changes — all data is already bundled via the `CHANGELOG.md?raw` import.

**Tech Stack:** React 19, base-ui combobox (via shadcn), Vite raw imports

---

### Task 1: Extract version list parsing and update InfoPage state

**Files:**
- Modify: `src/settings/pages/InfoPage.tsx`

- [ ] **Step 1: Add `parseVersions` function and rename existing parser**

Add a new function above the existing `parseChangelog` and rename `parseChangelog` to `parseEntries` for clarity:

```tsx
/** Extract all version strings from CHANGELOG.md, sorted descending (newest first). */
function parseVersions(raw: string): string[] {
  const versions: string[] = [];
  for (const line of raw.split("\n")) {
    const match = line.match(/^## \[(.+?)]/);
    if (match) versions.push(match[1]);
  }
  return versions;
}

/** Parse changelog entries for a specific version. */
function parseEntries(raw: string, version: string | null): string[] {
  // (same body as existing parseChangelog)
}
```

Also update the call site from `parseChangelog(changelogRaw, version)` to `parseEntries(changelogRaw, selectedVersion)`.

- [ ] **Step 2: Add version state and combobox to InfoPage**

Add imports at the top of InfoPage.tsx:

```tsx
import { useState, useMemo } from "react";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
```

Inside the `InfoPage` component, add state and derived data:

```tsx
const versions = useMemo(() => parseVersions(changelogRaw), []);
const [selectedVersion, setSelectedVersion] = useState<string | null>(
  versions[0] ?? null,
);
const changelogEntries = parseEntries(changelogRaw, selectedVersion);
```

Replace the static subtitle line:

```tsx
<p className="text-xs text-muted-foreground mb-3">Changes in v{version}</p>
```

With the combobox:

```tsx
<Combobox
  value={selectedVersion}
  onValueChange={setSelectedVersion}
>
  <ComboboxInput
    placeholder="Select version..."
    className="mb-3 w-48"
  />
  <ComboboxContent>
    <ComboboxList>
      {versions.map((v) => (
        <ComboboxItem key={v} value={v}>
          v{v}
        </ComboboxItem>
      ))}
      <ComboboxEmpty>No versions found</ComboboxEmpty>
    </ComboboxList>
  </ComboboxContent>
</Combobox>
```

- [ ] **Step 3: Remove unused `version` prop usage for changelog**

The `version` prop is still needed for the update button but no longer drives changelog display. No prop changes needed — just ensure `selectedVersion` (not `version`) is used for `parseEntries`.

- [ ] **Step 4: Verify the build compiles**

Run: `bun run build`
Expected: TypeScript check passes, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/settings/pages/InfoPage.tsx
git commit -m "feat: add version picker combobox to What's New section"
```

### Task 2: Visual verification

**Files:** None (verification only)

- [ ] **Step 1: Start dev server and verify**

Run: `bun run dev`

Navigate to `localhost:5173/settings.html`, go to More → About.

Verify:
- Combobox renders below "What's New" header
- Default selection is "v1.0.2" (latest in changelog)
- Selecting "v1.0.1" shows the prettified model names entry
- Selecting "v1.0.0" shows the full list of 1.0.0 changes
- Selecting "v0.1.0" shows the initial release entries
- Typing in the combobox filters the version list
- "Check for updates" button still works

- [ ] **Step 2: Fix any issues found during verification**

If the base-ui Combobox API doesn't match the assumed props (e.g. `value`/`onValueChange`), adjust to match the actual API. The combobox component uses `@base-ui/react` primitives — check the component source at `src/components/ui/combobox.tsx` for the correct prop threading.
