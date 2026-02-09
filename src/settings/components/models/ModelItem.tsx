import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, Tick02Icon } from "@hugeicons/core-free-icons";
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
import { formatFileSize } from "@/shared/types/models";

export function ModelItem({
  name,
  size,
  isSelected,
  isLoaded,
  onSelect,
  onDelete,
  disabled,
}: {
  name: string;
  size: number;
  isSelected: boolean;
  isLoaded: boolean;
  onSelect: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  return (
    <div className={`
      flex items-center gap-3 px-3 py-2 rounded-md transition-colors
      ${isSelected ? 'bg-primary/8' : 'hover:bg-muted/50'}
    `}>
      <button
        onClick={onSelect}
        disabled={disabled}
        className={`
          w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0
          transition-colors disabled:opacity-50 disabled:cursor-not-allowed
          ${isSelected
            ? 'border-primary bg-primary'
            : 'border-muted-foreground/30 hover:border-muted-foreground/50'
          }
        `}
      >
        {isSelected && (
          <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <span className="text-[13px] text-foreground">{name}</span>
        <span className="text-xs text-muted-foreground ml-2">
          {formatFileSize(size)}
        </span>
        {isLoaded && (
          <span className="text-xs text-primary/70 ml-2 inline-flex items-center gap-1">
            <HugeiconsIcon icon={Tick02Icon} size={12} />
            Loaded
          </span>
        )}
      </div>
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <button
              disabled={disabled}
              aria-label={`Delete ${name}`}
              className="p-1.5 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          }
        >
          <HugeiconsIcon icon={Delete02Icon} size={16} />
        </AlertDialogTrigger>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the model from your computer. You can download it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
