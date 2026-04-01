import { useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { SectionHeader } from "../components/SectionHeader";
import type { UpdateStatus } from "@/shared/types/updater";
import changelogRaw from "../../../CHANGELOG.md?raw";

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
  if (!version) return [];
  const lines = raw.split("\n");
  const entries: string[] = [];
  let capturing = false;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (capturing) break;
      if (line.includes(`[${version}]`)) {
        capturing = true;
      }
      continue;
    }
    if (capturing) {
      const trimmed = line.trim();
      if (trimmed.startsWith("- ")) {
        entries.push(trimmed.slice(2));
      }
    }
  }
  return entries;
}

interface InfoPageProps {
  updateStatus: UpdateStatus;
}

export function InfoPage({ updateStatus }: InfoPageProps): React.ReactNode {
  const versions = useMemo(() => parseVersions(changelogRaw), []);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(
    versions[0] ?? null,
  );
  const changelogEntries = useMemo(
    () => parseEntries(changelogRaw, selectedVersion),
    [selectedVersion],
  );
  const isChecking = updateStatus.status === "checking";

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between">
        <SectionHeader>What's New</SectionHeader>
        <Button
          variant="outline"
          size="xs"
          className="text-xs"
          disabled={isChecking}
          onClick={() => invoke("check_for_update")}
        >
          {isChecking ? "Checking..." : "Check for updates"}
        </Button>
      </div>
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
    </div>
  );
}
