# Version History Browser

## Overview

Add a version picker combobox to the "What's New" section in InfoPage (More > About), allowing users to browse changelog entries for any past version instead of only the currently installed version.

## Current Behavior

- `CHANGELOG.md` is imported at build time via Vite `?raw` import
- `parseChangelog(raw, version)` extracts bullet entries for a single hardcoded version (the app's current version)
- The subtitle reads "Changes in v{version}" with no way to switch versions

## Proposed Changes

### Data Layer

Extend changelog parsing in `InfoPage.tsx`:

- `parseVersions(raw: string): string[]` — extract all version strings from `## [x.y.z]` headers, returned in descending order (newest first)
- `parseEntries(raw: string, version: string): string[]` — extract bullet entries for a given version (existing logic, renamed for clarity)

### UI Changes

Replace the static subtitle with a shadcn combobox:

```
SectionHeader ("What's New")
Combobox (version picker)
  - Items: all versions from parseVersions(), formatted as "v{version}"
  - Default: first item (latest version in changelog)
  - Sorted: descending (most recent first)
ul (changelog entries for selected version)
  - Same rendering as current: checkmark icon + entry text
fallback message (if selected version has no entries)
```

### State

- `selectedVersion: string | null` — initialized to first element of `parseVersions()` result
- `versions: string[]` — memoized list from `parseVersions()`
- `entries: string[]` — derived from `parseEntries(raw, selectedVersion)`

### What Stays the Same

- "Check for updates" button and update flow
- Checkmark icon rendering for entries
- SectionHeader component usage
- Raw changelog import mechanism

## Files Changed

1. `src/settings/pages/InfoPage.tsx` — parsing functions, combobox, version state

## Edge Cases

- Changelog has no versions: combobox is empty, show fallback message
- Selected version has no bullet entries: show "No changelog entries for this version."
- Single version in changelog: combobox still rendered (consistent UI), just one option

## Testing

- Visual verification: combobox renders with all versions, switching shows correct entries
- Verify default selection is the latest changelog version, not the app version
