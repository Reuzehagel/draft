import { HugeiconsIcon } from "@hugeicons/react";
import { Clock01Icon } from "@hugeicons/core-free-icons";

export function HistoryPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <HugeiconsIcon icon={Clock01Icon} size={32} className="opacity-40" />
      <p className="text-sm">Transcription history coming soon</p>
    </div>
  );
}
