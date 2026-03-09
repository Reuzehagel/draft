interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps): React.ReactNode {
  return (
    <div>
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      {description && (
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      )}
    </div>
  );
}
