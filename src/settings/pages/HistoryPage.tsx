import { HugeiconsIcon } from "@hugeicons/react";
import { Clock01Icon } from "@hugeicons/core-free-icons";

export function HistoryPage(): React.ReactNode {
  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-4 rounded-lg border border-border/40 bg-card/50 px-10 py-8">
        <HugeiconsIcon icon={Clock01Icon} size={48} className="text-muted-foreground/30" />
        <div className="text-center space-y-1">
          <h3 className="text-sm font-medium text-foreground">No transcriptions yet</h3>
          <p className="text-xs text-muted-foreground max-w-[220px]">
            Your transcription history will appear here once you start recording.
          </p>
        </div>
      </div>
    </div>
  );
}
