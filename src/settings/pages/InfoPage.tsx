import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { SectionHeader } from "../components/SectionHeader";
import changelogRaw from "../../../CHANGELOG.md?raw";

/** Parse the current version's changelog entries from the raw CHANGELOG.md string. */
function parseChangelog(raw: string, version: string | null): string[] {
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
  version: string | null;
}

export function InfoPage({ version }: InfoPageProps): React.ReactNode {
  const changelogEntries = parseChangelog(changelogRaw, version);

  return (
    <div className="flex flex-col">
      <SectionHeader>What's New</SectionHeader>
      <p className="text-xs text-muted-foreground mb-3">Changes in v{version}</p>
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
