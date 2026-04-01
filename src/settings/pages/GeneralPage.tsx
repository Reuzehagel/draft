import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { Config, TextOutputMode } from "@/shared/types/config";
import { WaveformBars } from "@/components/WaveformBars";
import { SettingRow } from "../components/SettingRow";
import { HotkeyInput } from "../components/HotkeyInput";
import { ErrorMessage } from "../components/ErrorMessage";
import { SectionHeader } from "../components/SectionHeader";
import { SectionDivider } from "../components/SectionDivider";

const SYSTEM_DEFAULT_MIC = "system-default";

const OUTPUT_MODE_ITEMS = [
  { label: "Type into app", value: "inject" },
  { label: "Copy to clipboard", value: "clipboard" },
];

interface GeneralPageProps {
  config: Config | null;
  updateConfig: (updates: Partial<Config>) => void;
  microphones: Array<{ id: string; name: string }>;
  microphonesLoading: boolean;
  microphonesError: string | null;
  isTesting: boolean;
  micTestAmplitudes: number[];
  startTest: (deviceId: string | null) => void;
  hotkeyError: string | null;
  hotkeyRegistering: boolean;
  validateAndRegister: (hotkey: string) => Promise<void>;
}

export function GeneralPage({
  config,
  updateConfig,
  microphones,
  microphonesLoading,
  microphonesError,
  isTesting,
  micTestAmplitudes,
  startTest,
  hotkeyError,
  hotkeyRegistering,
  validateAndRegister,
}: GeneralPageProps): React.ReactNode {
  const [autoStartError, setAutoStartError] = useState<string | null>(null);

  const handleAutoStartToggle = useCallback(async (newValue: boolean) => {
    if (!config) return;
    setAutoStartError(null);
    const previousValue = config.auto_start;
    try {
      await invoke(newValue ? "enable_autostart" : "disable_autostart");
      updateConfig({ auto_start: newValue });
    } catch (e) {
      updateConfig({ auto_start: previousValue });
      setAutoStartError(`Failed to ${newValue ? "enable" : "disable"} auto-start`);
      console.error(e);
    }
  }, [config, updateConfig]);

  const micItems = microphones.map((mic) => ({
    label: mic.name,
    value: mic.id || SYSTEM_DEFAULT_MIC,
  }));

  const selectedMicValue = config?.microphone_id
    ? config.microphone_id
    : micItems.find((m) => m.value === SYSTEM_DEFAULT_MIC)?.value ?? micItems[0]?.value;

  return (
    <div className="flex flex-col">
      <SectionHeader>Microphone</SectionHeader>
      <SettingRow label="Device" inline>
        {microphonesLoading ? (
          <span className="text-sm text-muted-foreground">Loading...</span>
        ) : microphonesError ? (
          <ErrorMessage message={microphonesError} />
        ) : microphones.length === 0 ? (
          <ErrorMessage message="No microphones detected" />
        ) : (
          <Select
            value={selectedMicValue}
            onValueChange={(value) =>
              updateConfig({ microphone_id: value === SYSTEM_DEFAULT_MIC ? null : value })
            }
            items={micItems}
          >
            <SelectTrigger className="w-full text-[13px]">
              <SelectValue placeholder="Select microphone" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {micItems.map((item) => (
                <SelectItem key={item.value} value={item.value} className="text-[13px]">
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </SettingRow>
      <SettingRow label="Test" inline>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={microphonesLoading || microphones.length === 0 || isTesting}
            onClick={() => startTest(config?.microphone_id ?? null)}
          >
            {isTesting ? "Testing..." : "Test Microphone"}
          </Button>
          {isTesting && <WaveformBars amplitudes={micTestAmplitudes} />}
        </div>
      </SettingRow>

      <SectionDivider />

      <SectionHeader>Hotkey</SectionHeader>
      <SettingRow
        label={hotkeyRegistering ? "Push-to-talk (Registering...)" : "Push-to-talk"}
        description="Hold to record, release to transcribe. Function keys (F1-F24) work without modifiers."
      >
        <HotkeyInput
          value={config?.hotkey || null}
          onChange={(hotkey) => updateConfig({ hotkey })}
          error={hotkeyError}
          onValidate={validateAndRegister}
        />
      </SettingRow>
      <SettingRow label="Double-tap to toggle" description="Double-tap to start continuous recording, tap again to stop" inline>
        <Switch
          checked={config?.double_tap_toggle || false}
          onCheckedChange={(double_tap_toggle) => updateConfig({ double_tap_toggle })}
        />
      </SettingRow>

      <SectionDivider />

      <SectionHeader>Output</SectionHeader>
      <SettingRow label="Text output" description="How transcribed text is delivered">
        <Select
          value={config?.text_output_mode || "inject"}
          onValueChange={(value) => updateConfig({ text_output_mode: value as TextOutputMode })}
          items={OUTPUT_MODE_ITEMS}
        >
          <SelectTrigger className="w-full text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {OUTPUT_MODE_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value} className="text-[13px]">
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow label="Add space after text" description="Append a trailing space after transcribed text" inline>
        <Switch
          checked={config?.trailing_space || false}
          onCheckedChange={(trailing_space) => updateConfig({ trailing_space })}
        />
      </SettingRow>

      <SectionDivider />

      <SectionHeader>System</SectionHeader>
      <SettingRow label="Start with Windows" inline>
        <Switch
          checked={config?.auto_start || false}
          onCheckedChange={handleAutoStartToggle}
        />
      </SettingRow>
      {autoStartError && <ErrorMessage message={autoStartError} />}
    </div>
  );
}
