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
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Spinner className="size-3" />
        <span>{status.progress}%</span>
      </div>
    );
  }

  if (status.status === "ready") {
    return (
      <Button
        variant="outline"
        size="xs"
        className="text-xs gap-1"
        onClick={() => invoke("install_update")}
      >
        <HugeiconsIcon icon={Leaf01Icon} size={12} />
        Update to {status.version}
      </Button>
    );
  }

  if (status.status === "error") {
    return (
      <button
        onClick={() => invoke("check_for_update")}
        title={status.message}
        className="text-destructive hover:text-destructive/80 transition-colors"
      >
        <HugeiconsIcon icon={Alert01Icon} size={14} />
      </button>
    );
  }

  return null;
}
