import { HugeiconsIcon } from "@hugeicons/react";
import { Download01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatFileSize } from "@/shared/types/models";

export function DownloadableModel({
  name,
  size,
  isDownloading,
  progress,
  onDownload,
  onCancel,
  disabled,
}: {
  name: string;
  size: number;
  isDownloading: boolean;
  progress: number | null;
  onDownload: () => void;
  onCancel: () => void;
  disabled: boolean;
}) {
  return (
    <div className="px-3 py-2 rounded-md hover:bg-muted/30 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <span className="text-[13px] text-foreground">{name}</span>
          <span className="text-xs text-muted-foreground ml-2">
            {formatFileSize(size)}
          </span>
        </div>
        {isDownloading ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
            onClick={onCancel}
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} />
            <span className="ml-1.5 text-xs">Cancel</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
            disabled={disabled}
            onClick={onDownload}
          >
            <HugeiconsIcon icon={Download01Icon} size={14} />
            <span className="ml-1.5 text-xs">Download</span>
          </Button>
        )}
      </div>
      {isDownloading && progress !== null && (
        <div className="flex items-center gap-2 mt-2">
          <Progress value={progress} className="flex-1 h-1.5" />
          <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
            {progress}%
          </span>
        </div>
      )}
    </div>
  );
}
