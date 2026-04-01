# UI Overhaul Design Spec

## Overview

Redesign Draft's settings window from a sidebar-based card layout to a horizontal-nav, status-first dashboard with flat settings. Inspired by Linear's design language: clean, dense, opinionated, muted with selective accent hits.

## Core Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout direction | Status-first dashboard | App's primary action (push-to-talk) has no config page — give it a home that shows live state |
| Navigation | Horizontal underline tabs with inline icon + label | Reclaims sidebar width, cleaner than vertical nav for 4 items |
| Settings style | Flat sections with dividers (cards only for complex widgets) | Denser, less visual noise, Linear-style |
| Information architecture | 4 top tabs: Home, General, Models, More | Consolidates 7 pages into focused groups |
| More page organization | Sub-tabs within the More page | Mirrors top-level pattern, avoids long scroll |
| Window size | Flexible — adapt to content | No strong constraint on current 700x500 |

## Navigation

### Top-level tabs (underline style)
1. **Home** — status dashboard (default/landing page)
2. **General** — mic, hotkey, output, system settings
3. **Models** — engine selection, model picker, whisper prompt
4. **More** — catchall for secondary features

Each tab: inline icon (hugeicons, ~13px) + label, active state = bottom 2px accent line (blue).

"Draft" brand name top-left, version badge top-right.

### More sub-tabs (lighter underline)
1. **Post Process** — LLM enhancement toggle + config (provider, model, prompt, confirmation)
2. **Advanced** — appearance, sound effects, logging, updates, reset
3. **History** — save toggle, max entries, transcription list
4. **Transcribe** — file transcription tool
5. **About** — changelog, version info (replaces current "Info" page)

Sub-tabs use a thinner/lighter underline to visually distinguish from top-level nav.

## Pages

### Home Page

The landing page. Shows at-a-glance status and recent activity.

**Status cards** (3 across, card style — these are interactive/informational widgets):
- **Model** — active model name + status (Ready/Loading/Not downloaded). Clicking navigates to Models tab.
- **Hotkey** — current hotkey combo + status (Active/Not set). Clicking navigates to General tab.
- **Engine** — Local/Online + indicator. Clicking navigates to Models tab.

Status colors: blue = ready/info, green = active, yellow = warning, red = error.

**Recent transcriptions** — last ~5 transcriptions from history, each showing:
- Transcribed text (truncated to 1-2 lines)
- Metadata line: duration · model · relative timestamp
- Click to copy, hover for actions

If history is empty or disabled, show a subtle empty state: "No transcriptions yet. Press [hotkey] to start."

### General Page

Flat sections with uppercase section headers and 1px dividers between groups.

**Microphone**
- Device: select dropdown (right-aligned)
- Test microphone: button (right-aligned), shows waveform bars inline when active

**Hotkey**
- Push-to-talk: hotkey input with clear button (right-aligned)
  - Description: "Hold to record, release to transcribe"
- Double-tap to toggle: switch (right-aligned)
  - Description: "Double-tap to start, tap to stop"

**Output**
- Text output: select dropdown — "Type into app" / "Copy to clipboard" (right-aligned)
  - Description: "How transcribed text is delivered"
- Add space after text: switch (right-aligned)
  - Description: "Append trailing space"

**System**
- Start with Windows: switch (right-aligned)

### Models Page

Mixed layout — flat sections for simple settings, cards for the tier picker.

**Engine** (flat)
- Transcription engine: select dropdown — Local / Online provider options

**Models** (card — the tier picker is a complex interactive widget)
- Same tier picker as current (Fast/Accurate cards) — this works well
- Active model indicator, download status, "All Models" expandable
- Keep the card container here; it groups related interactive elements

**Whisper Prompt** (flat, only visible when a Whisper model is selected)
- Textarea for prompt text
- Description below

**Provider Settings** (flat, only visible when Online engine is selected)
- Provider: select dropdown
- API Key: password input with show/hide
- Model: text input or select
- Diarization: switch

### More > Post Process

Flat sections.

**AI Enhancement**
- Enable enhancement: switch
  - Description: "Process text through an LLM before injection"

When enabled, reveals:
- Provider: select dropdown
- API Key: password input
- Model: text input
- Auto-process: switch
  - Description: "Automatically enhance without confirmation"
- Confirm before processing: switch
- System prompt: textarea

### More > Advanced

Flat sections.

**Appearance**
- Dark mode: switch

**Sound Effects**
- Enable sounds: switch, description: "Audio feedback for recording events"
- Volume: slider with percentage + test button
- Individual sound toggles: Start, Done, Error, Confirm (only visible when sounds enabled)

**Logging**
- Enable logging: switch, description: "Logs to %APPDATA%\Draft\logs (restart required)"

**Updates**
- Auto-update: switch, description: "Check for updates on startup"

**Reset**
- Reset to defaults: button
- Reset everything: destructive button

### More > History

**Settings** (flat)
- Save history: switch
- Maximum entries: number input

**Transcriptions** (list — uses remaining page height)
- Same list component as current but without the card wrapper
- Entry format: timestamp · duration badge · model badge, text below
- Hover reveals copy/delete actions
- "Clear all" action in section header
- Empty state when no history

### More > Transcribe

**Audio File** (flat top section)
- Select file button + file name display
- Supported formats note
- Transcribe/Cancel buttons
- Progress indicators

**Result** (card — appears after transcription, contains interactive textarea + action buttons)
- Read-only textarea with transcription result
- Copy, Save, Enhance action buttons

### More > About

Replaces current "Info" page. Content renders as stacked sections (no additional tabs): What's New (changelog for current version), then a brief overview section with feature list. The Local/Online detail tabs from the current Info page are dropped — that info is discoverable from the Models page.

## Visual Language

### Colors
- Keep existing OKLCH color system and dark/light mode tokens
- Status accents: blue (#3b82f6) for primary/ready, green (#22c55e) for active, existing warning/destructive tokens
- Section headers: muted foreground, uppercase, letter-spaced
- Dividers: 1px, very subtle (#1a1a1a in dark, equivalent in light)

### Typography
- Keep Geist Variable + JetBrains Mono
- Section headers: 11px uppercase, 0.8px letter-spacing, muted color, 500 weight
- Setting labels: 13px, standard foreground
- Setting descriptions: 11px, muted color
- Status card labels: 10px uppercase
- Status card values: 14px, 500 weight

### Spacing
- Top nav padding: 16px horizontal, 14px top
- Content area padding: 20-24px
- Section header margin-bottom: 12px
- Setting row padding: 8px vertical
- Divider margin: 12px vertical
- Status card gap: 12px
- Status card padding: 14px

### Components
- **Setting row**: flex row, label (+ optional description) left, control right. Replaces current SettingRow + SettingsCard combo.
- **Section header**: uppercase label text with bottom margin. Replaces current card titles.
- **Divider**: 1px horizontal line between sections. Replaces card boundaries.
- **Status card**: bordered card with label/value/status. Used only on Home page and for complex widgets.
- **Tab bar**: horizontal flex with underline active indicator. Top-level gets icons; sub-level is text-only with lighter styling.

### Transitions
- Tab switching: consider subtle crossfade or instant swap (no slide animations — Linear doesn't animate page transitions)
- Status card values: subtle transition when values change (model loading, etc.)

## Migration Notes

### Components to modify
- **SettingsApp.tsx** — Replace SidebarProvider with horizontal tab layout, add Home page routing
- **Sidebar.tsx** — Replace entirely with horizontal TabBar component
- **PageHeader.tsx** — Remove (page identity is now in the tab bar)
- **SettingsCard.tsx** — Keep but reduce usage to only Home status cards, Models tier picker, and Transcribe result
- **SettingRow.tsx** — Adapt to flat layout (no card parent needed)

### New components
- **TabBar** — Horizontal nav with icon + label tabs, underline active state
- **SubTabBar** — Lighter variant for More page sub-navigation
- **HomePage** — New page with status cards + recent transcriptions
- **SectionHeader** — Uppercase label for flat section grouping
- **SectionDivider** — 1px line between sections
- **StatusCard** — Home page status display card

### Pages to consolidate
- **AdvancedPage** — Moves into More > Advanced sub-tab
- **HistoryPage** — Moves into More > History sub-tab
- **TranscribePage** — Moves into More > Transcribe sub-tab
- **InfoPage** — Becomes More > About sub-tab
- **PostProcessPage** — Moves into More > Post Process sub-tab

### Window size
- Current: 700x500 (min 500x400)
- Consider: slightly smaller default since sidebar is gone (e.g., 600x500), or keep and let content breathe
- The horizontal nav reclaims ~160px of sidebar width for content

## What's NOT changing
- Pill overlay window (200x40 transparent overlay) — untouched
- Backend/Rust code — no changes needed
- Event system — same events, same listeners
- Config structure — same fields, same storage
- Tray icon behavior — same hide-to-tray on close
