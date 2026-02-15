interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  inline?: boolean;
}

function LabelBlock({ label, description }: { label: string; description?: string }): React.ReactNode {
  return (
    <div className="flex-1 min-w-0">
      <span className="text-sm text-foreground">{label}</span>
      {description && (
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      )}
    </div>
  );
}

export function SettingRow({ label, description, children, inline = false }: SettingRowProps): React.ReactNode {
  if (inline) {
    return (
      <div className="flex items-center justify-between gap-4 py-1">
        <LabelBlock label={label} description={description} />
        <div className="shrink-0">{children}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2 py-1">
      <LabelBlock label={label} description={description} />
      {children}
    </div>
  );
}
