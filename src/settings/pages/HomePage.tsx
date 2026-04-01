import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, Clock01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import type { Config } from "@/shared/types/config";
import type { HistoryEntry } from "@/shared/types/history";
import type { TopPage } from "../components/TabBar";
import { StatusCard } from "../components/StatusCard";
import { SectionHeader } from "../components/SectionHeader";
import { useHistory } from "../hooks/useHistory";
import { formatModelName } from "@/shared/utils/formatModelName";

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
              <span className="text-[10px] text-muted-foreground">{formatModelName(entry.stt_model)}</span>
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
    ? (selectedModel ? formatModelName(selectedModel) : "None selected")
    : (config?.stt_provider ? formatModelName(config.stt_provider) : "Unknown");
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
  const engineStatus = isLocal ? "On-device" : (config?.stt_provider ? formatModelName(config.stt_provider) : "");

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
          <div className="flex flex-col rounded-lg border border-border overflow-hidden">
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
