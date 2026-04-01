import { invoke } from "@tauri-apps/api/core";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Config } from "@/shared/types/config";
import { SettingRow } from "../components/SettingRow";
import { SectionHeader } from "../components/SectionHeader";
import { SectionDivider } from "../components/SectionDivider";

/** Default config values (mirrors Rust Config::default). Excludes window geometry (managed by Rust). */
const DEFAULT_CONFIG: Omit<Config, "window_position" | "window_size"> = {
  version: 1,
  microphone_id: null,
  selected_model: null,
  hotkey: null,
  auto_start: false,
  trailing_space: false,
  logging_enabled: false,
  llm_provider: null,
  llm_api_key: null,
  llm_model: null,
  llm_auto_process: false,
  llm_system_prompt: null,
  text_output_mode: "inject",
  double_tap_toggle: false,
  llm_confirm_before_processing: false,
  stt_provider: null,
  stt_api_key: null,
  stt_model: null,
  stt_enable_diarization: false,
  whisper_initial_prompt: null,
  sound_effects_enabled: true,
  sound_volume: 0.5,
  sound_start_enabled: true,
  sound_done_enabled: true,
  sound_error_enabled: true,
  sound_confirm_enabled: true,
  history_enabled: true,
  history_max_entries: 500,
  auto_update_enabled: true,
};

/** Keys that hold sensitive/credential data, preserved during soft reset */
const SENSITIVE_KEYS: (keyof Config)[] = ["llm_api_key", "stt_api_key"];

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
      <SectionHeader>Appearance</SectionHeader>
      <SettingRow label="Dark mode" inline>
        <Switch checked={isDark} onCheckedChange={toggleDarkMode} />
      </SettingRow>

      <SectionDivider />

      <SectionHeader>Sound Effects</SectionHeader>
      <SettingRow label="Enable sounds" inline>
        <Switch
          checked={config?.sound_effects_enabled ?? true}
          onCheckedChange={(sound_effects_enabled) => updateConfig({ sound_effects_enabled })}
        />
      </SettingRow>

      <SettingRow label="Volume">
        <div className="flex items-center gap-4">
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
          <div className="flex flex-col gap-2 pt-1">
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

      <SectionDivider />

      <SectionHeader>Logging</SectionHeader>
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

      <SectionDivider />

      <SectionHeader>Updates</SectionHeader>
      <SettingRow label="Auto-update" description="Check for updates on startup" inline>
        <Switch
          checked={config?.auto_update_enabled ?? true}
          onCheckedChange={(auto_update_enabled) => updateConfig({ auto_update_enabled })}
        />
      </SettingRow>

      <SectionDivider />

      <SectionHeader>Reset</SectionHeader>
      <div className="flex gap-2">
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="outline" />}>
            Reset to defaults
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset to defaults?</AlertDialogTitle>
              <AlertDialogDescription>
                This will reset all settings to their default values but keep your API keys.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!config) return;
                  const preserved: Partial<Config> = {};
                  for (const key of SENSITIVE_KEYS) {
                    if (config[key] != null) {
                      (preserved as Record<string, unknown>)[key] = config[key];
                    }
                  }
                  updateConfig({ ...DEFAULT_CONFIG, ...preserved });
                }}
              >
                Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="outline" />}>
            Reset everything
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset everything?</AlertDialogTitle>
              <AlertDialogDescription>
                This will erase all settings including API keys and return everything to a blank state. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => updateConfig({ ...DEFAULT_CONFIG })}
              >
                Erase everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
