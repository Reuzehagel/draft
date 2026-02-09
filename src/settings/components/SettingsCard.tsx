interface SettingsCardProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsCard({ icon, title, description, children }: SettingsCardProps) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/50 overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3 border-b border-border/40 bg-muted/30">
        <div className="mt-0.5 text-muted-foreground/70">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[13px] font-medium text-foreground">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className="px-4 py-3 space-y-3">{children}</div>
    </div>
  );
}
