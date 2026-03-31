import { invoke } from "@tauri-apps/api/core";
import { HugeiconsIcon } from "@hugeicons/react";
import { Leaf01Icon, Alert01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/Spinner";
import type { UpdateStatus } from "@/shared/types/updater";

interface UpdateCardProps {
  status: UpdateStatus;
}

export function UpdateCard({ status }: UpdateCardProps): React.ReactNode {
  if (status.status === "idle" || status.status === "checking") {
    return null;
  }

  if (status.status === "downloading") {
    return (
      <div className="mx-2 mb-2 rounded-lg bg-card border border-border p-3 flex items-center gap-2">
        <Spinner className="size-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-medium truncate">Updating...</p>
          <p className="text-[10px] text-muted-foreground">{status.progress}%</p>
        </div>
      </div>
    );
  }

  if (status.status === "ready") {
    return (
      <div className="mx-2 mb-2 rounded-lg bg-card border border-border p-3 flex flex-col items-center gap-2 text-center">
        <HugeiconsIcon icon={Leaf01Icon} size={20} className="text-muted-foreground" />
        <div>
          <p className="text-xs font-medium">Updated to {status.version}</p>
          <p className="text-[10px] text-muted-foreground">Relaunch to apply</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => invoke("install_update")}
        >
          Relaunch
        </Button>
      </div>
    );
  }

  if (status.status === "error") {
    return (
      <button
        className="mx-2 mb-2 rounded-lg bg-card border border-destructive/50 p-3 flex items-center gap-2 w-full text-left hover:bg-accent transition-colors"
        onClick={() => invoke("check_for_update")}
        title="Click to retry"
      >
        <HugeiconsIcon icon={Alert01Icon} size={16} className="text-destructive shrink-0" />
        <p className="text-[10px] text-muted-foreground truncate">{status.message}</p>
      </button>
    );
  }

  return null;
}
