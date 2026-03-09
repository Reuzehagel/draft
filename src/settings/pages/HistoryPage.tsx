import { HugeiconsIcon } from "@hugeicons/react";
import { Clock01Icon } from "@hugeicons/core-free-icons";
import { PageHeader } from "../components/PageHeader";

export function HistoryPage(): React.ReactNode {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="History" description="Your transcription history" />

      <div className="flex-1 flex flex-col items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <HugeiconsIcon icon={Clock01Icon} size={48} className="text-muted-foreground/30" />
          <div className="text-center flex flex-col gap-1">
            <h3 className="text-sm font-medium text-foreground">No transcriptions yet</h3>
            <p className="text-xs text-muted-foreground max-w-[220px]">
              Your transcription history will appear here once you start recording.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
