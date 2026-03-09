import { Switch } from "@/components/ui/switch";
import type { Config } from "@/shared/types/config";
import { SettingsCard } from "../components/SettingsCard";
import { SettingRow } from "../components/SettingRow";
import { PageHeader } from "../components/PageHeader";

interface DebugPageProps {
  config: Config | null;
  updateConfig: (updates: Partial<Config>) => void;
}

export function DebugPage({ config, updateConfig }: DebugPageProps): React.ReactNode {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Debug" description="Logging and diagnostics" />

      <SettingsCard title="Logging">
        <SettingRow
          label="Enable logging"
          description="Logs to %APPDATA%\Draft\logs (restart required)"
          inline
        >
          <Switch
            checked={config?.logging_enabled || false}
            onCheckedChange={(logging_enabled) => updateConfig({ logging_enabled })}
          />
        </SettingRow>
      </SettingsCard>
    </div>
  );
}
