import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon, Download01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/Spinner";
import type { ModelInfo, DownloadProgress } from "@/shared/types/models";

export function ModelStatusArea({
  effectiveModel,
  isLoaded,
  isModelLoading,
  isDownloading,
  downloadProgress,
  onDownload,
  onCancel,
}: {
  effectiveModel: ModelInfo | undefined;
  isLoaded: boolean;
  isModelLoading: boolean;
  isDownloading: boolean;
  downloadProgress: DownloadProgress | null;
  onDownload: () => void;
  onCancel: () => void;
}) {
  if (!effectiveModel) return null;

  const isThisDownloading = downloadProgress?.model === effectiveModel.id;

  // Downloading state
  if (isThisDownloading) {
    return (
      <div className="flex items-center gap-2 py-1">
        <Progress value={downloadProgress?.progress ?? 0} className="flex-1 h-1.5" aria-label="Download progress" />
        <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
          {downloadProgress?.progress ?? 0}%
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Cancel download"
          onClick={onCancel}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={14} />
        </Button>
      </div>
    );
  }

  // Not downloaded — show download button
  if (!effectiveModel.downloaded) {
    return (
      <div className="py-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          disabled={isDownloading}
          onClick={onDownload}
        >
          <HugeiconsIcon icon={Download01Icon} size={14} className="mr-1.5" />
          Download {effectiveModel.name}
        </Button>
      </div>
    );
  }

  // Loading model into whisper
  if (isModelLoading) {
    return (
      <div className="flex items-center gap-2 py-1 text-muted-foreground" role="status" aria-live="polite">
        <Spinner size={14} />
        <span className="text-xs">Loading model...</span>
      </div>
    );
  }

  // Loaded and ready
  if (isLoaded) {
    return (
      <div className="flex items-center gap-1.5 py-1 text-primary/70" role="status" aria-live="polite">
        <HugeiconsIcon icon={Tick02Icon} size={14} />
        <span className="text-xs">Ready</span>
      </div>
    );
  }

  return null;
}
