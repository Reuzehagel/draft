import { Field, FieldContent, FieldLabel, FieldDescription } from "@/components/ui/field";

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  inline?: boolean;
}

export function SettingRow({ label, description, children, inline = false }: SettingRowProps): React.ReactNode {
  if (inline) {
    return (
      <Field orientation="horizontal">
        {description ? (
          <FieldContent>
            <FieldLabel>{label}</FieldLabel>
            <FieldDescription>{description}</FieldDescription>
          </FieldContent>
        ) : (
          <FieldLabel>{label}</FieldLabel>
        )}
        {children}
      </Field>
    );
  }

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      {description && <FieldDescription>{description}</FieldDescription>}
      {children}
    </Field>
  );
}
