interface SectionHeaderProps {
  children: React.ReactNode;
}

export function SectionHeader({ children }: SectionHeaderProps): React.ReactNode {
  return (
    <h3 className="text-[11px] uppercase tracking-[0.8px] text-muted-foreground font-medium mb-3">
      {children}
    </h3>
  );
}
