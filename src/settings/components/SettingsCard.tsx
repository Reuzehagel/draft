interface SettingsCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsCard({ title, description, children }: SettingsCardProps): React.ReactNode {
  return (
    <div className="rounded-lg border border-border/60 bg-card/80 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border/40 bg-muted/40">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="px-4 py-3 space-y-3">{children}</div>
    </div>
  );
}
