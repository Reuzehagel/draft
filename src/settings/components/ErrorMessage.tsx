import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";

export function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="text-xs text-destructive flex items-center gap-1.5" role="alert">
      <HugeiconsIcon icon={InformationCircleIcon} size={14} className="shrink-0" />
      {message}
    </p>
  );
}
