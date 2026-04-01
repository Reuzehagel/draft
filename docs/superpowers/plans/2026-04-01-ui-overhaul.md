# UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Draft's sidebar-based card layout with a horizontal-nav, status-first dashboard using flat settings sections. Linear-inspired design.

**Architecture:** Remove the vertical sidebar and SidebarProvider. Add a horizontal TabBar with underline tabs (Home, General, Models, More). Convert settings pages from card-wrapped sections to flat sections with dividers. Add a new Home page showing live status and recent transcriptions. Consolidate 7 pages into 4 top-level tabs, with "More" containing sub-tabs for secondary features.

**Tech Stack:** React 19, Tailwind CSS v4, shadcn/ui (base-lyra preset, base primitives), Hugeicons, Tauri v2

**IMPORTANT:** Before making ANY frontend changes, load the `shadcn` skill first to ensure correct usage of shadcn/ui components, patterns, and conventions specific to this project.

---

## File Structure

### New files
- `src/settings/components/TabBar.tsx` — Horizontal top-level navigation with icon + label underline tabs
- `src/settings/components/SubTabBar.tsx` — Lighter sub-tab navigation for the More page
- `src/settings/components/SectionHeader.tsx` — Uppercase section label for flat settings groups
- `src/settings/components/SectionDivider.tsx` — 1px divider between flat sections
- `src/settings/components/StatusCard.tsx` — Clickable status card for Home page
- `src/settings/pages/HomePage.tsx` — Status dashboard with recent transcriptions
- `src/settings/pages/MorePage.tsx` — Container with sub-tabs routing to Post Process, Advanced, History, Transcribe, About

### Modified files
- `src/settings/SettingsApp.tsx` — Replace SidebarProvider with TabBar, update routing, add Home page
- `src/settings/pages/GeneralPage.tsx` — Remove cards, use flat sections
- `src/settings/pages/ModelsPage.tsx` — Remove cards (keep ModelsCard), use flat sections
- `src/settings/pages/PostProcessPage.tsx` — Remove cards, use flat sections
- `src/settings/pages/AdvancedPage.tsx` — Remove cards, use flat sections
- `src/settings/pages/HistoryPage.tsx` — Remove cards, use flat sections for settings, unwrap list
- `src/settings/pages/TranscribePage.tsx` — Remove card for file section, keep card for result
- `src/settings/pages/InfoPage.tsx` — Rename to AboutPage, simplify to stacked sections
- `src/settings/components/UpdateCard.tsx` — Relocate to work within TabBar header area

### Deleted files (after migration)
- `src/settings/components/Sidebar.tsx` — Replaced by TabBar
- `src/settings/components/PageHeader.tsx` — Page identity now in tab bar

---

### Task 1: Create SectionHeader and SectionDivider components

**Files:**
- Create: `src/settings/components/SectionHeader.tsx`
- Create: `src/settings/components/SectionDivider.tsx`

- [ ] **Step 1: Create SectionHeader component**

```tsx
// src/settings/components/SectionHeader.tsx
interface SectionHeaderProps {
  children: React.ReactNode;
}

export function SectionHeader({ children }: SectionHeaderProps): React.ReactNode {
  return (
    <h3 className="text-[11px] uppercase tracking-[0.8px] text-muted-foreground font-medium mb-3">
      {children}
    </h3>
  );
}
```

- [ ] **Step 2: Create SectionDivider component**

```tsx
// src/settings/components/SectionDivider.tsx
export function SectionDivider(): React.ReactNode {
  return <div className="h-px bg-border my-3" />;
}
```

- [ ] **Step 3: Verify both files exist and have no TypeScript errors**

Run: `cd /c/Users/Nick/Desktop/draft && bunx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to SectionHeader or SectionDivider

- [ ] **Step 4: Commit**

```bash
git add src/settings/components/SectionHeader.tsx src/settings/components/SectionDivider.tsx
git commit -m "feat: add SectionHeader and SectionDivider components for flat layout"
```

---

### Task 2: Create TabBar component

**Files:**
- Create: `src/settings/components/TabBar.tsx`

The TabBar replaces the sidebar. It renders horizontally at the top of the window with "Draft" brand left, version right, and underline tabs below. Each tab has an inline Hugeicon + label. The active tab gets a 2px bottom border in primary color.

- [ ] **Step 1: Create the TabBar component**

```tsx
// src/settings/components/TabBar.tsx
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Home01Icon,
  Settings01Icon,
  Package01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";

export type TopPage = "home" | "general" | "models" | "more";

interface TabItem {
  page: TopPage;
  label: string;
  icon: typeof Home01Icon;
}

const TABS: TabItem[] = [
  { page: "home", label: "Home", icon: Home01Icon },
  { page: "general", label: "General", icon: Settings01Icon },
  { page: "models", label: "Models", icon: Package01Icon },
  { page: "more", label: "More", icon: MoreHorizontalIcon },
];

interface TabBarProps {
  activePage: TopPage;
  onNavigate: (page: TopPage) => void;
  version: string | null;
  children?: React.ReactNode; // Slot for UpdateCard
}

export function TabBar({ activePage, onNavigate, version, children }: TabBarProps): React.ReactNode {
  return (
    <div className="border-b border-border flex-shrink-0" data-tauri-drag-region>
      <div className="flex items-center justify-between px-5 pt-3.5 pb-0" data-tauri-drag-region>
        <span className="text-sm font-bold tracking-tight text-foreground">Draft</span>
        <div className="flex items-center gap-2">
          {children}
          {version && (
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 h-4 text-muted-foreground">
              v{version}
            </Badge>
          )}
        </div>
      </div>
      <nav className="flex gap-0 px-5 mt-3">
        {TABS.map((tab) => (
          <button
            key={tab.page}
            onClick={() => onNavigate(tab.page)}
            className={`flex items-center gap-1.5 text-xs px-3 pb-2.5 border-b-2 transition-colors ${
              activePage === tab.page
                ? "text-foreground border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground/70"
            }`}
          >
            <HugeiconsIcon icon={tab.icon} size={13} />
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
```

Note: `data-tauri-drag-region` on the header area allows the user to drag the window from the top bar. The sidebar previously allowed this via the Tauri sidebar component. Verify that `Home01Icon` and `MoreHorizontalIcon` exist in `@hugeicons/core-free-icons` — if not, find the correct icon names by checking the existing codebase imports and Hugeicons docs. Fallback candidates: `Home09Icon`, `Menu01Icon`.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /c/Users/Nick/Desktop/draft && bunx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors from TabBar.tsx. If icon imports fail, fix to correct Hugeicons icon names.

- [ ] **Step 3: Commit**

```bash
git add src/settings/components/TabBar.tsx
git commit -m "feat: add horizontal TabBar component with underline tabs"
```

---

### Task 3: Create SubTabBar component

**Files:**
- Create: `src/settings/components/SubTabBar.tsx`

The SubTabBar is a lighter variant used inside the "More" page. Text-only (no icons), thinner underline, slightly smaller text.

- [ ] **Step 1: Create the SubTabBar component**

```tsx
// src/settings/components/SubTabBar.tsx
export type MoreSubPage = "post-process" | "advanced" | "history" | "transcribe" | "about";

interface SubTabItem {
  page: MoreSubPage;
  label: string;
}

const SUB_TABS: SubTabItem[] = [
  { page: "post-process", label: "Post Process" },
  { page: "advanced", label: "Advanced" },
  { page: "history", label: "History" },
  { page: "transcribe", label: "Transcribe" },
  { page: "about", label: "About" },
];

interface SubTabBarProps {
  activeSub: MoreSubPage;
  onNavigate: (sub: MoreSubPage) => void;
}

export function SubTabBar({ activeSub, onNavigate }: SubTabBarProps): React.ReactNode {
  return (
    <nav className="flex gap-0 border-b border-border/50">
      {SUB_TABS.map((tab) => (
        <button
          key={tab.page}
          onClick={() => onNavigate(tab.page)}
          className={`text-[11px] px-3 py-2 border-b transition-colors ${
            activeSub === tab.page
              ? "text-foreground border-muted-foreground"
              : "text-muted-foreground border-transparent hover:text-foreground/70"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /c/Users/Nick/Desktop/draft && bunx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors from SubTabBar.tsx

- [ ] **Step 3: Commit**

```bash
git add src/settings/components/SubTabBar.tsx
git commit -m "feat: add SubTabBar component for More page sub-navigation"
```

---

### Task 4: Create StatusCard component

**Files:**
- Create: `src/settings/components/StatusCard.tsx`

Clickable card used on the Home page showing a label, value, and status indicator.

- [ ] **Step 1: Create StatusCard component**

```tsx
// src/settings/components/StatusCard.tsx
interface StatusCardProps {
  label: string;
  value: string;
  status: string;
  statusColor?: "primary" | "success" | "muted" | "warning" | "destructive";
  onClick?: () => void;
}

const STATUS_COLORS = {
  primary: "text-primary",
  success: "text-success",
  muted: "text-muted-foreground",
  warning: "text-warning",
  destructive: "text-destructive",
} as const;

export function StatusCard({ label, value, status, statusColor = "muted", onClick }: StatusCardProps): React.ReactNode {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      className={`flex-1 bg-card border border-border rounded-lg p-3.5 text-left transition-colors ${onClick ? "hover:bg-accent cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <div className="text-[10px] uppercase tracking-[0.5px] text-muted-foreground mb-1">{label}</div>
      <div className="text-sm font-medium text-foreground">{value}</div>
      <div className={`text-[11px] mt-0.5 ${STATUS_COLORS[statusColor]}`}>{status}</div>
    </Comp>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /c/Users/Nick/Desktop/draft && bunx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors from StatusCard.tsx

- [ ] **Step 3: Commit**

```bash
git add src/settings/components/StatusCard.tsx
git commit -m "feat: add StatusCard component for Home page dashboard"
```

---

### Task 5: Create HomePage

**Files:**
- Create: `src/settings/pages/HomePage.tsx`
- Reference: `src/settings/hooks/useHistory.ts` (for recent transcriptions)
- Reference: `src/shared/types/history.ts` (HistoryEntry type)

The Home page shows 3 status cards (Model, Hotkey, Engine) and recent transcriptions. Status cards are clickable and navigate to the relevant settings page.

- [ ] **Step 1: Create HomePage component**

```tsx
// src/settings/pages/HomePage.tsx
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, Clock01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Config } from "@/shared/types/config";
import type { HistoryEntry } from "@/shared/types/history";
import type { TopPage } from "../components/TabBar";
import { StatusCard } from "../components/StatusCard";
import { SectionHeader } from "../components/SectionHeader";
import { useHistory } from "../hooks/useHistory";

interface HomePageProps {
  config: Config | null;
  onNavigate: (page: TopPage) => void;
  loadedModel: string | null;
  isModelLoading: boolean;
  selectedModel: string | null;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function RecentEntry({ entry }: { entry: HistoryEntry }): React.ReactNode {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(entry.final_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group flex flex-col gap-1 py-2.5 px-3 hover:bg-muted/50 transition-colors">
      <div className="text-xs text-foreground/80 leading-relaxed line-clamp-2">
        {entry.final_text}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">{formatDuration(entry.duration_ms)}</span>
          <span className="text-[10px] text-muted-foreground">·</span>
          {entry.stt_model && (
            <>
              <span className="text-[10px] text-muted-foreground">{entry.stt_model}</span>
              <span className="text-[10px] text-muted-foreground">·</span>
            </>
          )}
          <span className="text-[10px] text-muted-foreground">{formatRelativeTime(entry.created_at)}</span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleCopy}
          title="Copy to clipboard"
          className={copied ? "" : "opacity-0 group-hover:opacity-100 transition-opacity"}
        >
          <HugeiconsIcon icon={Copy01Icon} data-icon />
        </Button>
      </div>
    </div>
  );
}

export function HomePage({
  config,
  onNavigate,
  loadedModel,
  isModelLoading,
  selectedModel,
}: HomePageProps): React.ReactNode {
  const { entries } = useHistory();
  const recentEntries = entries.slice(0, 5);

  const isLocal = !config?.stt_provider;
  const modelName = isLocal
    ? (selectedModel ?? "None selected")
    : (config?.stt_provider ?? "Unknown");
  const modelStatus = isLocal
    ? (isModelLoading ? "Loading..." : loadedModel ? "Ready" : "Not loaded")
    : "Online";
  const modelStatusColor = isLocal
    ? (isModelLoading ? "muted" as const : loadedModel ? "primary" as const : "warning" as const)
    : "primary" as const;

  const hotkey = config?.hotkey || "Not set";
  const hotkeyStatus = config?.hotkey ? "Active" : "Not set";
  const hotkeyStatusColor = config?.hotkey ? "success" as const : "warning" as const;

  const engineLabel = isLocal ? "Local" : "Online";
  const engineStatus = isLocal ? "On-device" : (config?.stt_provider ?? "");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-3">
        <StatusCard
          label="Model"
          value={modelName}
          status={modelStatus}
          statusColor={modelStatusColor}
          onClick={() => onNavigate("models")}
        />
        <StatusCard
          label="Hotkey"
          value={hotkey}
          status={hotkeyStatus}
          statusColor={hotkeyStatusColor}
          onClick={() => onNavigate("general")}
        />
        <StatusCard
          label="Engine"
          value={engineLabel}
          status={engineStatus}
          statusColor="muted"
          onClick={() => onNavigate("models")}
        />
      </div>

      <div>
        <SectionHeader>Recent transcriptions</SectionHeader>
        {recentEntries.length === 0 ? (
          <Empty className="py-8">
            <EmptyHeader>
              <EmptyMedia>
                <HugeiconsIcon icon={Clock01Icon} size={36} className="text-muted-foreground/30" />
              </EmptyMedia>
              <EmptyTitle className="text-sm">No transcriptions yet</EmptyTitle>
              <EmptyDescription className="text-xs">
                Press {config?.hotkey || "your hotkey"} to start recording.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col -mx-3 rounded-lg border border-border overflow-hidden">
            {recentEntries.map((entry, i) => (
              <div key={entry.id}>
                {i > 0 && <Separator />}
                <RecentEntry entry={entry} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /c/Users/Nick/Desktop/draft && bunx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors from HomePage.tsx

- [ ] **Step 3: Commit**

```bash
git add src/settings/pages/HomePage.tsx
git commit -m "feat: add HomePage with status cards and recent transcriptions"
```

---

### Task 6: Create MorePage container

**Files:**
- Create: `src/settings/pages/MorePage.tsx`

The MorePage wraps existing pages (PostProcess, Advanced, History, Transcribe, About) with a SubTabBar for sub-navigation.

- [ ] **Step 1: Create MorePage component**

```tsx
// src/settings/pages/MorePage.tsx
import { useState } from "react";
import { SubTabBar, type MoreSubPage } from "../components/SubTabBar";
import { PostProcessPage } from "./PostProcessPage";
import { AdvancedPage } from "./AdvancedPage";
import { HistoryPage } from "./HistoryPage";
import { TranscribePage } from "./TranscribePage";
import { InfoPage } from "./InfoPage";
import type { Config } from "@/shared/types/config";
import type { FileTranscriptionState } from "../hooks/useFileTranscription";

interface MorePageProps {
  config: Config | null;
  updateConfig: (updates: Partial<Config>) => void;
  isDark: boolean;
  toggleDarkMode: () => void;
  version: string | null;
  fileTranscription: FileTranscriptionState;
  whisperBusy: boolean;
  loadedModel: string | null;
  llmConfigured: boolean;
  sttProvider: string | null;
}

export function MorePage({
  config,
  updateConfig,
  isDark,
  toggleDarkMode,
  version,
  fileTranscription,
  whisperBusy,
  loadedModel,
  llmConfigured,
  sttProvider,
}: MorePageProps): React.ReactNode {
  const [activeSub, setActiveSub] = useState<MoreSubPage>("post-process");

  return (
    <div className="flex flex-col h-full">
      <SubTabBar activeSub={activeSub} onNavigate={setActiveSub} />
      <div className="flex-1 overflow-y-auto py-5" style={{ scrollbarGutter: "stable" }}>
        {activeSub === "post-process" && (
          <PostProcessPage config={config} updateConfig={updateConfig} />
        )}
        {activeSub === "advanced" && (
          <AdvancedPage config={config} updateConfig={updateConfig} isDark={isDark} toggleDarkMode={toggleDarkMode} />
        )}
        {activeSub === "history" && (
          <HistoryPage config={config} updateConfig={updateConfig} />
        )}
        {activeSub === "transcribe" && (
          <TranscribePage
            fileTranscription={fileTranscription}
            whisperBusy={whisperBusy}
            loadedModel={loadedModel}
            llmConfigured={llmConfigured}
            sttProvider={sttProvider}
          />
        )}
        {activeSub === "about" && <InfoPage version={version} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /c/Users/Nick/Desktop/draft && bunx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors from MorePage.tsx. Note: this uses existing page components that still have cards. That's intentional — we'll convert them in later tasks.

- [ ] **Step 3: Commit**

```bash
git add src/settings/pages/MorePage.tsx
git commit -m "feat: add MorePage container with sub-tab navigation"
```

---

### Task 7: Rewire SettingsApp to use TabBar layout

**Files:**
- Modify: `src/settings/SettingsApp.tsx`

This is the core layout change. Remove SidebarProvider and AppSidebar. Add TabBar. Route to Home, General, Models, or MorePage based on active tab. Default page changes from "general" to "home".

- [ ] **Step 1: Rewrite SettingsApp.tsx**

Replace the entire content of `src/settings/SettingsApp.tsx` with:

```tsx
import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { useDarkMode } from "./hooks/useDarkMode";
import { useConfig } from "./hooks/useConfig";
import { useHotkeyRegistration } from "./hooks/useHotkeyRegistration";
import { useMicrophones } from "./hooks/useMicrophones";
import { useMicrophoneTest } from "./hooks/useMicrophoneTest";
import { useModels } from "./useModels";
import { useWhisper } from "./useWhisper";
import { useFileTranscription } from "./hooks/useFileTranscription";
import { useUpdateStatus } from "./hooks/useUpdateStatus";
import { TabBar, type TopPage } from "./components/TabBar";
import { UpdateCard } from "./components/UpdateCard";
import { GeneralPage } from "./pages/GeneralPage";
import { ModelsPage } from "./pages/ModelsPage";
import { HomePage } from "./pages/HomePage";
import { MorePage } from "./pages/MorePage";

export default function SettingsApp(): React.ReactNode {
  const [activePage, setActivePage] = useState<TopPage>("home");
  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const { config, updateConfig, loading, saved } = useConfig();
  const {
    microphones,
    loading: microphonesLoading,
    error: microphonesError,
  } = useMicrophones();
  const { isTesting, amplitudes: micTestAmplitudes, startTest } = useMicrophoneTest();
  const { registrationError: hotkeyError, isRegistering: hotkeyRegistering, validateAndRegister } = useHotkeyRegistration(config?.hotkey);
  const modelsHook = useModels();
  const whisperHook = useWhisper(config?.selected_model, config?.stt_provider);
  const fileTranscription = useFileTranscription();
  const [version, setVersion] = useState<string | null>(null);
  const updateStatus = useUpdateStatus();

  useEffect(() => {
    getVersion().then(setVersion);
  }, []);

  useEffect(() => {
    if (!loading && config && !config.selected_model && modelsHook.downloadedModels.length > 0) {
      updateConfig({ selected_model: modelsHook.downloadedModels[0].id });
    }
  }, [loading, config, modelsHook.downloadedModels, updateConfig]);

  useEffect(() => {
    if (!loading) {
      invoke("settings_ready");
    }
  }, [loading]);

  if (loading) {
    return null;
  }

  const llmConfigured = !!(config?.llm_provider && config?.llm_api_key);

  return (
    <div className="h-screen flex flex-col bg-background">
      <TabBar
        activePage={activePage}
        onNavigate={setActivePage}
        version={version}
      >
        <UpdateCard status={updateStatus} />
      </TabBar>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
        <div className="px-5 py-5 max-w-lg mx-auto">
          {activePage === "home" && (
            <HomePage
              config={config}
              onNavigate={setActivePage}
              loadedModel={whisperHook.loadedModel}
              isModelLoading={whisperHook.isModelLoading}
              selectedModel={config?.selected_model ?? null}
            />
          )}
          {activePage === "general" && (
            <GeneralPage
              config={config}
              updateConfig={updateConfig}
              microphones={microphones}
              microphonesLoading={microphonesLoading}
              microphonesError={microphonesError}
              isTesting={isTesting}
              micTestAmplitudes={micTestAmplitudes}
              startTest={startTest}
              hotkeyError={hotkeyError}
              hotkeyRegistering={hotkeyRegistering}
              validateAndRegister={validateAndRegister}
            />
          )}
          {activePage === "models" && (
            <ModelsPage
              config={config}
              updateConfig={updateConfig}
              modelsHook={modelsHook}
              whisperHook={whisperHook}
              isTesting={isTesting}
            />
          )}
          {activePage === "more" && (
            <MorePage
              config={config}
              updateConfig={updateConfig}
              isDark={isDark}
              toggleDarkMode={toggleDarkMode}
              version={version}
              fileTranscription={fileTranscription}
              whisperBusy={whisperHook.isBusy}
              loadedModel={whisperHook.loadedModel}
              llmConfigured={llmConfigured}
              sttProvider={config?.stt_provider ?? null}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

Important notes:
- The `max-w-lg mx-auto` wrapper should NOT apply to the More page since the SubTabBar needs full width. Adjust: either remove the wrapper for "more" page, or move the wrapper inside each page. The simplest fix: change the More page rendering to bypass the `max-w-lg` wrapper. Move the wrapper into each page component, or conditionally apply it:

```tsx
{activePage === "more" ? (
  <div className="flex-1 overflow-hidden">
    <MorePage ... />
  </div>
) : (
  <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
    <div className="px-5 py-5 max-w-lg mx-auto">
      {/* home, general, models pages */}
    </div>
  </div>
)}
```

The MorePage handles its own scrolling internally (its sub-pages scroll within the sub-tab container).

- [ ] **Step 2: Update UpdateCard for inline use in TabBar**

The current UpdateCard renders as a sidebar card. For the TabBar, it needs to render more compactly. Check if the current rendering works inline — the "downloading" and "error" states are small enough. The "ready" state may need to be more compact. Adjust if needed: the key change is that UpdateCard is now passed as a child of TabBar and renders in the header row next to the version badge. If the "ready" state is too large, simplify it to a small badge-style button:

For now, leave UpdateCard as-is and see how it looks. If it's too big, adjust in a follow-up.

- [ ] **Step 3: Verify TypeScript compiles and the app renders**

Run: `cd /c/Users/Nick/Desktop/draft && bunx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors. The Sidebar import is removed, so no dead code issues.

Run: `cd /c/Users/Nick/Desktop/draft && bun tauri dev`
Expected: App launches with horizontal tab bar at top, Home page as default, navigation works between all 4 tabs. Pages still use old card-based layout (that's fine — we convert them next).

- [ ] **Step 4: Commit**

```bash
git add src/settings/SettingsApp.tsx
git commit -m "feat: replace sidebar with horizontal TabBar navigation"
```

---

### Task 8: Convert GeneralPage to flat sections

**Files:**
- Modify: `src/settings/pages/GeneralPage.tsx`

Remove all `SettingsCard` wrappers. Replace with `SectionHeader` + flat `SettingRow` groups separated by `SectionDivider`. Remove `PageHeader` import (page title is now in the tab bar).

- [ ] **Step 1: Rewrite GeneralPage to flat layout**

Replace the return JSX in `GeneralPage` (keep imports, props, state, handlers). Remove the `SettingsCard` and `PageHeader` imports. Add `SectionHeader` and `SectionDivider` imports:

```tsx
// Updated imports (remove SettingsCard, PageHeader; add SectionHeader, SectionDivider)
import { SectionHeader } from "../components/SectionHeader";
import { SectionDivider } from "../components/SectionDivider";
// Keep: SettingRow, HotkeyInput, ErrorMessage, WaveformBars, Select, Switch, Button, etc.
```

Replace the return statement:

```tsx
return (
  <div className="flex flex-col">
    <SectionHeader>Microphone</SectionHeader>
    {microphonesLoading ? (
      <span className="text-sm text-muted-foreground">Loading...</span>
    ) : microphonesError ? (
      <ErrorMessage message={microphonesError} />
    ) : microphones.length === 0 ? (
      <ErrorMessage message="No microphones detected" />
    ) : (
      <SettingRow label="Device" inline>
        <Select
          value={selectedMicValue}
          onValueChange={(value) =>
            updateConfig({ microphone_id: value === SYSTEM_DEFAULT_MIC ? null : value })
          }
          items={micItems}
        >
          <SelectTrigger className="w-48 text-[13px]">
            <SelectValue placeholder="Select microphone" />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {micItems.map((item) => (
              <SelectItem key={item.value} value={item.value} className="text-[13px]">
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
    )}
    <SettingRow label="Test microphone" inline>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          disabled={microphonesLoading || microphones.length === 0 || isTesting}
          onClick={() => startTest(config?.microphone_id ?? null)}
        >
          {isTesting ? "Testing..." : "Test"}
        </Button>
        {isTesting && <WaveformBars amplitudes={micTestAmplitudes} />}
      </div>
    </SettingRow>

    <SectionDivider />

    <SectionHeader>Hotkey</SectionHeader>
    <SettingRow
      label={hotkeyRegistering ? "Push-to-talk (Registering...)" : "Push-to-talk"}
      description="Hold to record, release to transcribe"
    >
      <HotkeyInput
        value={config?.hotkey || null}
        onChange={(hotkey) => updateConfig({ hotkey })}
        error={hotkeyError}
        onValidate={validateAndRegister}
      />
    </SettingRow>
    <SettingRow label="Double-tap to toggle" description="Double-tap to start, tap to stop" inline>
      <Switch
        checked={config?.double_tap_toggle || false}
        onCheckedChange={(double_tap_toggle) => updateConfig({ double_tap_toggle })}
      />
    </SettingRow>

    <SectionDivider />

    <SectionHeader>Output</SectionHeader>
    <SettingRow label="Text output" description="How transcribed text is delivered" inline>
      <Select
        value={config?.text_output_mode || "inject"}
        onValueChange={(value) => updateConfig({ text_output_mode: value as TextOutputMode })}
        items={OUTPUT_MODE_ITEMS}
      >
        <SelectTrigger className="w-40 text-[13px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {OUTPUT_MODE_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value} className="text-[13px]">
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingRow>
    <SettingRow label="Add space after text" description="Append trailing space" inline>
      <Switch
        checked={config?.trailing_space || false}
        onCheckedChange={(trailing_space) => updateConfig({ trailing_space })}
      />
    </SettingRow>

    <SectionDivider />

    <SectionHeader>System</SectionHeader>
    <SettingRow label="Start with Windows" inline>
      <Switch
        checked={config?.auto_start || false}
        onCheckedChange={handleAutoStartToggle}
      />
    </SettingRow>
    {autoStartError && <ErrorMessage message={autoStartError} />}
  </div>
);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /c/Users/Nick/Desktop/draft && bunx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Visually verify in dev mode**

Run: `cd /c/Users/Nick/Desktop/draft && bun tauri dev`
Navigate to General tab. Verify: flat sections with uppercase headers, dividers between groups, no card borders, all controls functional.

- [ ] **Step 4: Commit**

```bash
git add src/settings/pages/GeneralPage.tsx
git commit -m "refactor: convert GeneralPage to flat sections layout"
```

---

### Task 9: Convert ModelsPage to mixed layout

**Files:**
- Modify: `src/settings/pages/ModelsPage.tsx`

Remove `SettingsCard` for Engine and Provider Settings sections (flat). Keep `ModelsCard` as-is (it's already a card component). Remove `PageHeader`. Convert Whisper Prompt to flat section.

- [ ] **Step 1: Update ModelsPage imports and layout**

Remove imports: `SettingsCard`, `PageHeader`
Add imports: `SectionHeader`, `SectionDivider`

Replace the return statement — keep all the existing logic (engineItems, isLocal, state, effects):

```tsx
return (
  <div className="flex flex-col">
    <SectionHeader>Engine</SectionHeader>
    <SettingRow label="Transcription engine">
      <Select
        value={config?.stt_provider || "local"}
        onValueChange={(value) =>
          updateConfig({ stt_provider: value === "local" ? null : value })
        }
        items={engineItems}
      >
        <SelectTrigger className="w-full text-[13px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {engineItems.map((item) => (
            <SelectItem key={item.value} value={item.value} className="text-[13px]">
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingRow>

    <SectionDivider />

    {/* Online STT provider settings */}
    {!isLocal && (
      <>
        <SectionHeader>Provider Settings</SectionHeader>
        <ApiKeyInput
          value={config?.stt_api_key || ""}
          onChange={(stt_api_key) => updateConfig({ stt_api_key })}
        />
        <SettingRow label="Model" description="Leave empty for provider default">
          <Input
            type="text"
            value={config?.stt_model || ""}
            onChange={(e) => updateConfig({ stt_model: e.target.value || null })}
            placeholder={STT_DEFAULT_MODELS[config?.stt_provider ?? ""] ?? "Provider default"}
            className="text-[13px] font-mono"
          />
        </SettingRow>
        {STT_SUPPORTS_DIARIZATION.includes(config?.stt_provider ?? "") && (
          <SettingRow label="Speaker diarization" description="Identify and label different speakers" inline>
            <Switch
              checked={config?.stt_enable_diarization || false}
              onCheckedChange={(stt_enable_diarization) => updateConfig({ stt_enable_diarization })}
            />
          </SettingRow>
        )}
        {onlineSttError && <ErrorMessage message={onlineSttError} />}
      </>
    )}

    {/* Local Whisper settings — ModelsCard keeps its own card styling */}
    {isLocal && (
      <>
        <ModelsCard
          config={config}
          updateConfig={updateConfig}
          models={modelsHook.models}
          downloadedModels={modelsHook.downloadedModels}
          availableModels={modelsHook.availableModels}
          modelsLoading={modelsHook.loading}
          isDownloading={modelsHook.isDownloading}
          downloadProgress={modelsHook.downloadProgress}
          downloadModel={modelsHook.downloadModel}
          cancelDownload={modelsHook.cancelDownload}
          deleteModel={modelsHook.deleteModel}
          isModelLoading={whisperHook.isModelLoading}
          loadedModel={whisperHook.loadedModel}
          isTranscribing={whisperHook.isTranscribing}
          transcriptionResult={whisperHook.transcriptionResult}
          transcriptionError={whisperHook.transcriptionError}
          whisperAmplitudes={whisperHook.amplitudes}
          testTranscription={whisperHook.testTranscription}
          whisperBusy={whisperHook.isBusy}
          isTesting={isTesting}
        />

        <SectionDivider />

        <SectionHeader>Whisper Prompt</SectionHeader>
        <Textarea
          value={config?.whisper_initial_prompt || ""}
          onChange={(e) => updateConfig({ whisper_initial_prompt: e.target.value || null })}
          placeholder="e.g. Draft, Tauri, React. Use proper punctuation and capitalization."
          rows={2}
          className="text-[13px] min-h-[48px] resize-y"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Helps Whisper with domain terms, spelling, and formatting preferences. Has no effect on Parakeet.
        </p>
      </>
    )}
  </div>
);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /c/Users/Nick/Desktop/draft && bunx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/settings/pages/ModelsPage.tsx
git commit -m "refactor: convert ModelsPage to mixed flat/card layout"
```

---

### Task 10: Convert PostProcessPage to flat sections

**Files:**
- Modify: `src/settings/pages/PostProcessPage.tsx`

Remove `SettingsCard` and `PageHeader`. Use `SectionHeader` and `SectionDivider`.

- [ ] **Step 1: Read current PostProcessPage**

Read `src/settings/pages/PostProcessPage.tsx` to see all current content and conditional rendering.

- [ ] **Step 2: Update PostProcessPage**

Remove imports: `SettingsCard`, `PageHeader`
Add imports: `SectionHeader`, `SectionDivider`

Replace the return statement while keeping all existing logic (LLM_DEFAULT_MODELS, conditional rendering when enabled):

```tsx
return (
  <div className="flex flex-col">
    <SectionHeader>AI Enhancement</SectionHeader>
    <SettingRow label="Enable enhancement" description="Process text through an LLM before injection" inline>
      <Switch
        checked={config?.llm_auto_process || false}
        onCheckedChange={(llm_auto_process) => updateConfig({ llm_auto_process })}
      />
    </SettingRow>

    {config?.llm_auto_process && (
      <>
        <SectionDivider />

        <SectionHeader>LLM Settings</SectionHeader>
        <SettingRow label="Confirm before enhancing" description="Ask before processing each transcription" inline>
          <Switch
            checked={config?.llm_confirm_before_processing ?? true}
            onCheckedChange={(llm_confirm_before_processing) => updateConfig({ llm_confirm_before_processing })}
          />
        </SettingRow>
        {/* ... rest of the LLM settings (provider select, API key, model, prompt) 
            following the same flat pattern as current but without card wrappers */}
      </>
    )}
  </div>
);
```

Note: Read the actual PostProcessPage first — the above is a sketch. Preserve all existing fields and logic, just remove the card wrappers.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /c/Users/Nick/Desktop/draft && bunx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/settings/pages/PostProcessPage.tsx
git commit -m "refactor: convert PostProcessPage to flat sections layout"
```

---

### Task 11: Convert AdvancedPage to flat sections

**Files:**
- Modify: `src/settings/pages/AdvancedPage.tsx`

Remove `SettingsCard` and `PageHeader`. Use `SectionHeader` and `SectionDivider`. Keep all existing logic (sound effects expansion, volume slider, alert dialogs for reset).

- [ ] **Step 1: Read current AdvancedPage**

Read `src/settings/pages/AdvancedPage.tsx` in full to capture all controls and conditional rendering.

- [ ] **Step 2: Update AdvancedPage**

Remove imports: `SettingsCard`, `PageHeader`
Add imports: `SectionHeader`, `SectionDivider`

Convert each card section to a flat SectionHeader + SettingRows block, separated by SectionDividers. The animated sound toggle grid and alert dialogs remain as-is — they work without card containers.

- [ ] **Step 3: Verify TypeScript compiles and visually check**

- [ ] **Step 4: Commit**

```bash
git add src/settings/pages/AdvancedPage.tsx
git commit -m "refactor: convert AdvancedPage to flat sections layout"
```

---

### Task 12: Convert HistoryPage to flat sections

**Files:**
- Modify: `src/settings/pages/HistoryPage.tsx`

Remove `SettingsCard` and `PageHeader`. The settings section (Save history, Max entries) goes flat. The transcription list renders without a card wrapper — just the section header and bare list.

- [ ] **Step 1: Update HistoryPage**

Remove imports: `SettingsCard`, `PageHeader`
Add imports: `SectionHeader`, `SectionDivider`

The settings section becomes flat. The transcription list loses its card wrapper but keeps the `-mx-3` pattern for edge-to-edge entries. The "Clear all" button moves to a flex row next to the section header:

```tsx
<div className="flex items-center justify-between">
  <SectionHeader>Transcriptions ({entries.length})</SectionHeader>
  <AlertDialog>...</AlertDialog>
</div>
```

Keep `HistoryEntryRow` component exactly as-is — it renders fine without a card parent.

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Commit**

```bash
git add src/settings/pages/HistoryPage.tsx
git commit -m "refactor: convert HistoryPage to flat sections layout"
```

---

### Task 13: Convert TranscribePage to mixed layout

**Files:**
- Modify: `src/settings/pages/TranscribePage.tsx`

Remove `PageHeader`. The file selection area goes flat. The result area keeps its card (interactive textarea + action buttons).

- [ ] **Step 1: Read current TranscribePage**

Read `src/settings/pages/TranscribePage.tsx` in full.

- [ ] **Step 2: Update TranscribePage**

Remove imports: `PageHeader`
Add imports: `SectionHeader`, `SectionDivider`
Keep `SettingsCard` import (used for result section only).

Convert the file selection area to flat, keep the result card.

- [ ] **Step 3: Verify TypeScript compiles**

- [ ] **Step 4: Commit**

```bash
git add src/settings/pages/TranscribePage.tsx
git commit -m "refactor: convert TranscribePage file section to flat layout"
```

---

### Task 14: Simplify InfoPage to About sections

**Files:**
- Modify: `src/settings/pages/InfoPage.tsx`

Remove the 4-tab structure. Render as stacked sections: What's New (changelog), then a brief feature overview. Drop the Local/Online comparison tabs — that info is accessible from the Models page.

- [ ] **Step 1: Read current InfoPage**

Read `src/settings/pages/InfoPage.tsx` in full.

- [ ] **Step 2: Simplify to stacked sections**

Remove the tab state and tab buttons. Keep the What's New changelog parsing logic. Add a brief "Features" section below it. Remove the Local models table and Online providers accordion — these are reachable from the Models page.

Remove imports: `SettingsCard`, `PageHeader`, tab-related components
Add imports: `SectionHeader`, `SectionDivider`

- [ ] **Step 3: Verify TypeScript compiles**

- [ ] **Step 4: Commit**

```bash
git add src/settings/pages/InfoPage.tsx
git commit -m "refactor: simplify InfoPage to stacked About sections"
```

---

### Task 15: Adapt UpdateCard for TabBar placement

**Files:**
- Modify: `src/settings/components/UpdateCard.tsx`

The UpdateCard currently renders as a sidebar card. In the TabBar, it's placed inline in the header row. The "downloading" and "error" states are compact enough, but the "ready" state (with its icon + text + relaunch button) needs to be more compact for inline display.

- [ ] **Step 1: Read current UpdateCard**

Already read. The "ready" state renders a vertical card with icon, text, and full-width button. This won't fit inline in the header.

- [ ] **Step 2: Make UpdateCard compact for inline use**

Adjust the "ready" state to render as a small button/badge instead of a card:

```tsx
if (status.status === "ready") {
  return (
    <Button
      variant="outline"
      size="xs"
      className="text-xs gap-1"
      onClick={() => invoke("install_update")}
    >
      <HugeiconsIcon icon={Leaf01Icon} size={12} />
      Update to {status.version}
    </Button>
  );
}
```

Similarly compact the "downloading" state:

```tsx
if (status.status === "downloading") {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Spinner className="size-3" />
      <span>{status.progress}%</span>
    </div>
  );
}
```

And the "error" state:

```tsx
if (status.status === "error") {
  return (
    <button
      onClick={() => invoke("check_for_update")}
      title={status.message}
      className="text-destructive hover:text-destructive/80 transition-colors"
    >
      <HugeiconsIcon icon={Alert01Icon} size={14} />
    </button>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles and visually check**

- [ ] **Step 4: Commit**

```bash
git add src/settings/components/UpdateCard.tsx
git commit -m "refactor: make UpdateCard compact for inline TabBar placement"
```

---

### Task 16: Clean up deleted components and dead imports

**Files:**
- Delete: `src/settings/components/Sidebar.tsx`
- Delete: `src/settings/components/PageHeader.tsx`
- Verify: No remaining imports of deleted files

- [ ] **Step 1: Delete Sidebar.tsx and PageHeader.tsx**

```bash
rm src/settings/components/Sidebar.tsx src/settings/components/PageHeader.tsx
```

- [ ] **Step 2: Grep for remaining imports**

Run: search for `Sidebar` and `PageHeader` in `src/settings/` to ensure no dead imports remain.

```bash
cd /c/Users/Nick/Desktop/draft && grep -r "Sidebar\|PageHeader" src/settings/ --include="*.tsx" --include="*.ts"
```

Expected: No matches (or only the shadcn sidebar UI component which is fine to keep as a library file).

- [ ] **Step 3: Verify TypeScript compiles cleanly**

Run: `cd /c/Users/Nick/Desktop/draft && bunx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove old Sidebar and PageHeader components"
```

---

### Task 17: Update Tauri window configuration

**Files:**
- Modify: `src-tauri/tauri.conf.json`

Consider adjusting the default window size since the sidebar is gone. The horizontal nav is more space-efficient horizontally but adds height for the tab bar. Optional: reduce width from 700 to 620, or keep as-is.

- [ ] **Step 1: Read current window config**

Read the `windows` section of `src-tauri/tauri.conf.json`.

- [ ] **Step 2: Evaluate and adjust if needed**

If the content looks too wide with the reclaimed sidebar space, reduce the default width. If it looks fine, skip this step. The tab bar adds ~80px of height, so consider increasing the default height slightly or keeping min height the same.

- [ ] **Step 3: Commit if changed**

```bash
git add src-tauri/tauri.conf.json
git commit -m "chore: adjust settings window dimensions for horizontal nav"
```

---

### Task 18: Visual QA and polish pass

**Files:** Various (based on issues found)

- [ ] **Step 1: Launch dev mode and check every page**

Run: `cd /c/Users/Nick/Desktop/draft && bun tauri dev`

Check each page for:
- Tab bar renders correctly with icons + labels and underline active state
- Home page status cards show correct data
- Home page recent transcriptions populate
- General page flat sections look clean with proper spacing
- Models page shows ModelsCard with card styling, rest is flat
- More page sub-tabs work, all sub-pages render
- Dark mode toggle still works (moved from sidebar footer — verify it's accessible somewhere, probably in More > Advanced)
- UpdateCard renders compactly in header
- Window drag region works from the tab bar area
- Saved indicator — verify it's still visible somewhere (was in sidebar footer). If missing, add it to the TabBar header area.

- [ ] **Step 2: Fix any spacing, alignment, or visual issues found**

Common issues to watch for:
- SectionDivider spacing too tight or too loose
- SettingRow inline layout not aligning controls properly without card container
- SelectTrigger widths may need adjustment without card constraints
- History list without card border may need a subtle container

- [ ] **Step 3: Verify light mode still works**

Toggle dark mode off and check all pages render correctly in light mode.

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "style: visual QA fixes for UI overhaul"
```

---

### Task 19: Move dark mode toggle and saved indicator

**Files:**
- Modify: `src/settings/components/TabBar.tsx` (or `src/settings/pages/AdvancedPage.tsx`)

The dark mode toggle and "Saved" indicator were in the sidebar footer. Dark mode toggle is now in More > Advanced (already there as a setting). The "Saved" indicator needs a new home — add it to the TabBar header area.

- [ ] **Step 1: Add saved indicator to TabBar**

Update `TabBarProps` to accept `saved: boolean`. Render a small "Saved" text near the version badge:

```tsx
{saved && (
  <span className="text-[10px] text-success transition-opacity duration-200">
    Saved
  </span>
)}
```

- [ ] **Step 2: Pass saved prop from SettingsApp to TabBar**

In `SettingsApp.tsx`, add `saved={saved}` to the `<TabBar>` props.

- [ ] **Step 3: Verify it shows/hides correctly**

Change a setting and verify "Saved" appears briefly.

- [ ] **Step 4: Commit**

```bash
git add src/settings/components/TabBar.tsx src/settings/SettingsApp.tsx
git commit -m "feat: add saved indicator to TabBar header"
```
