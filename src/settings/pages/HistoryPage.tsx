import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Clock01Icon, Delete02Icon, Copy01Icon, SparklesIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import type { Config } from "@/shared/types/config";
import type { HistoryEntry } from "@/shared/types/history";
import { SettingsCard } from "../components/SettingsCard";
import { SettingRow } from "../components/SettingRow";
import { PageHeader } from "../components/PageHeader";
import { useHistory } from "../hooks/useHistory";

interface HistoryPageProps {
  config: Config | null;
  updateConfig: (updates: Partial<Config>) => void;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Today ${time}`;
  if (isYesterday) return `Yesterday ${time}`;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function HistoryEntryRow({
  entry,
  onDelete,
}: {
  entry: HistoryEntry;
  onDelete: (id: number) => void;
}): React.ReactNode {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(entry.final_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const displayText = entry.final_text;
  const isLong = displayText.length > 120;
  const truncated = isLong && !expanded ? displayText.slice(0, 120) + "..." : displayText;

  return (
    <div className="group flex flex-col gap-1.5 py-2.5 px-3 hover:bg-muted/50 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[11px] text-muted-foreground shrink-0">
            {formatTimestamp(entry.created_at)}
          </span>
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {formatDuration(entry.duration_ms)}
          </Badge>
          {entry.stt_model && (
            <Badge variant="outline" className="text-[10px] shrink-0 max-w-24 truncate">
              {entry.stt_model}
            </Badge>
          )}
          {entry.llm_applied && (
            <Badge variant="outline" className="text-[10px] shrink-0 gap-0.5">
              <HugeiconsIcon icon={SparklesIcon} size={10} className="shrink-0" />
              <span className="truncate max-w-16">{entry.llm_model ?? entry.llm_provider ?? "LLM"}</span>
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {copied && (
            <span className="text-[10px] text-muted-foreground mr-0.5">Copied!</span>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleCopy}
            title="Copy to clipboard"
            className={copied ? "" : "opacity-0 group-hover:opacity-100 transition-opacity"}
          >
            <HugeiconsIcon icon={Copy01Icon} data-icon />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="ghost" size="icon-xs" title="Delete" className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <HugeiconsIcon icon={Delete02Icon} data-icon />
                </Button>
              }
            />
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete entry?</AlertDialogTitle>
                <AlertDialogDescription>
                  This transcription will be permanently removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel size="sm">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(entry.id)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <button
        className="text-left text-xs text-foreground/80 leading-relaxed cursor-text select-text p-0 bg-transparent border-none"
        onClick={() => isLong && setExpanded(!expanded)}
        tabIndex={-1}
      >
        {truncated}
      </button>
      {entry.llm_applied && entry.raw_text !== entry.final_text && expanded && (
        <div className="text-[11px] text-muted-foreground leading-relaxed border-l-2 border-muted pl-2 mt-0.5">
          <span className="font-medium">Original:</span> {entry.raw_text}
        </div>
      )}
    </div>
  );
}

export function HistoryPage({ config, updateConfig }: HistoryPageProps): React.ReactNode {
  const { entries, loading, deleteEntry, clearAll } = useHistory();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="History" description="Your transcription history" />

      <SettingsCard title="Settings">
        <SettingRow label="Save history" description="Record transcriptions for later review" inline>
          <Switch
            checked={config?.history_enabled ?? true}
            onCheckedChange={(history_enabled) => updateConfig({ history_enabled })}
          />
        </SettingRow>
        <SettingRow label="Maximum entries" description="Oldest entries auto-deleted when limit reached" inline>
          <Input
            type="number"
            min={10}
            max={10000}
            className="w-20 text-xs h-7"
            value={config?.history_max_entries ?? 500}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 10 && val <= 10000) {
                updateConfig({ history_max_entries: val });
              }
            }}
          />
        </SettingRow>
      </SettingsCard>

      {loading ? null : entries.length === 0 ? (
        <Empty className="py-12">
          <EmptyHeader>
            <EmptyMedia>
              <HugeiconsIcon icon={Clock01Icon} size={48} className="text-muted-foreground/30" />
            </EmptyMedia>
            <EmptyTitle>No transcriptions yet</EmptyTitle>
            <EmptyDescription>
              Your transcription history will appear here once you start recording.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <SettingsCard
          title={`Transcriptions (${entries.length})`}
          description="Click text to expand, hover for actions"
          headerAction={
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button variant="ghost" size="xs" className="text-muted-foreground">
                    Clear all
                  </Button>
                }
              />
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all history?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {entries.length} transcription{entries.length !== 1 ? "s" : ""}. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel size="sm">Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" size="sm" onClick={clearAll}>
                    Clear all
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          }
        >
          <div className="flex flex-col -mx-3">
            {entries.map((entry, i) => (
              <div key={entry.id}>
                {i > 0 && <Separator />}
                <HistoryEntryRow
                  entry={entry}
                  onDelete={deleteEntry}
                />
              </div>
            ))}
          </div>
        </SettingsCard>
      )}
    </div>
  );
}
