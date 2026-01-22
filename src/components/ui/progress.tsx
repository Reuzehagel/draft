import { cn } from "@/lib/utils"

interface ProgressProps {
  value: number
  className?: string
}

function Progress({ value, className }: ProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value))

  return (
    <div
      data-slot="progress"
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
    >
      <div
        className="h-full bg-primary transition-all duration-200 ease-out"
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  )
}

export { Progress }
