import { invoke } from "@tauri-apps/api/core";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import type { Config } from "@/shared/types/config";
import { SettingsCard } from "../components/SettingsCard";
import { SettingRow } from "../components/SettingRow";
import { PageHeader } from "../components/PageHeader";

const SOUND_TOGGLES: Array<{ label: string; key: keyof Config & `sound_${string}_enabled` }> = [
  { label: "Start sound", key: "sound_start_enabled" },
  { label: "Done sound", key: "sound_done_enabled" },
  { label: "Error sound", key: "sound_error_enabled" },
  { label: "Confirm sound", key: "sound_confirm_enabled" },
];

interface AdvancedPageProps {
  config: Config | null;
  updateConfig: (updates: Partial<Config>) => void;
  isDark: boolean;
  toggleDarkMode: () => void;
}

export function AdvancedPage({ config, updateConfig, isDark, toggleDarkMode }: AdvancedPageProps): React.ReactNode {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Advanced" description="Appearance, sounds, and other options" />

      <SettingsCard title="Appearance">
        <SettingRow label="Dark mode" inline>
          <Switch checked={isDark} onCheckedChange={toggleDarkMode} />
        </SettingRow>
      </SettingsCard>

      <SettingsCard title="Sound Effects" description="Audio feedback for recording events">
        <SettingRow label="Enable sounds" inline>
          <Switch
            checked={config?.sound_effects_enabled ?? true}
            onCheckedChange={(sound_effects_enabled) => updateConfig({ sound_effects_enabled })}
          />
        </SettingRow>

        <SettingRow label="Volume">
          <div className="flex items-center gap-3">
            <Slider
              value={[Math.round((config?.sound_volume ?? 0.5) * 100)]}
              min={0}
              max={100}
              onValueChange={(value) => {
                const v = Array.isArray(value) ? value[0] : value;
                updateConfig({ sound_volume: v / 100 });
              }}
              disabled={!config?.sound_effects_enabled}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">
              {Math.round((config?.sound_volume ?? 0.5) * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground"
              disabled={!config?.sound_effects_enabled}
              onClick={() => invoke("test_sound")}
            >
              Test
            </Button>
          </div>
        </SettingRow>

        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out"
          style={{ gridTemplateRows: config?.sound_effects_enabled ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-1 pt-1">
              {SOUND_TOGGLES.map(({ label, key }) => (
                <SettingRow key={key} label={label} inline>
                  <Switch
                    checked={config?.[key] ?? true}
                    onCheckedChange={(value) => updateConfig({ [key]: value })}
                  />
                </SettingRow>
              ))}
            </div>
          </div>
        </div>
      </SettingsCard>

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
