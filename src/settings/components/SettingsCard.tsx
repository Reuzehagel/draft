import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface SettingsCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

export function SettingsCard({ title, description, icon, headerAction, children }: SettingsCardProps): React.ReactNode {
  return (
    <Card size="sm">
      <CardHeader className={icon || headerAction ? "flex flex-row items-start gap-3" : undefined}>
        {icon && <div className="mt-0.5 text-muted-foreground/70">{icon}</div>}
        <div className="flex-1">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {headerAction}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}
