import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mic01Icon,
  KeyboardIcon,
  Settings01Icon,
  Cancel01Icon,
  InformationCircleIcon,
  Sun01Icon,
  Moon01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDarkMode } from "./hooks/useDarkMode";
import { useConfig } from "./hooks/useConfig";
import { useHotkeyRegistration } from "./hooks/useHotkeyRegistration";
import { useMicrophones } from "./hooks/useMicrophones";
import { useMicrophoneTest } from "./hooks/useMicrophoneTest";
import { useModels } from "./useModels";
import { useWhisper } from "./useWhisper";
import { AmplitudeVisualizer } from "./AmplitudeVisualizer";
import { Toggle } from "./components/Toggle";
import { ModelsCard } from "./components/ModelsCard";

function SettingsCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/50 overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3 border-b border-border/40 bg-muted/30">
        <div className="mt-0.5 text-muted-foreground/70">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[13px] font-medium text-foreground">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className="px-4 py-3 space-y-3">{children}</div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
  inline = false,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  inline?: boolean;
}) {
  if (inline) {
    return (
      <div className="flex items-center justify-between gap-4 py-1">
        <div className="flex-1 min-w-0">
          <span className="text-[13px] text-foreground">{label}</span>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2 py-1">
      <div>
        <span className="text-[13px] text-foreground">{label}</span>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function HotkeyInput({
  value,
  onChange,
  error,
  onValidate,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string | null;
  onValidate?: (hotkey: string) => Promise<void>;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent) => {
      if (!isRecording) return;
      e.preventDefault();

      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      if (e.metaKey) parts.push("Meta");

      let keyName = e.key;
      if (keyName === " ") keyName = "Space";

      const isModifierKey = ["Control", "Alt", "Shift", "Meta"].includes(keyName);

      if (keyName && !isModifierKey) {
        const normalizedKey = keyName.length === 1 ? keyName.toUpperCase() : keyName;
        parts.push(normalizedKey);

        const hotkey = parts.join("+");

        const isFunctionKey = /^F([1-9]|1[0-9]|2[0-4])$/.test(normalizedKey);
        if (parts.length === 1 && !isFunctionKey) {
          setValidationError(`'${normalizedKey}' requires a modifier key (Ctrl, Alt, Shift, or Meta)`);
          return;
        }

        try {
          await invoke("validate_hotkey", { hotkey });
          setValidationError(null);
          onChange(hotkey);
          setIsRecording(false);

          if (onValidate) {
            onValidate(hotkey).catch((err) => {
              setValidationError(String(err));
            });
          }
        } catch (err) {
          setValidationError(String(err));
        }
      }
    },
    [isRecording, onChange, onValidate]
  );

  const displayError = error || validationError;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setIsRecording(!isRecording);
            if (!isRecording) setValidationError(null);
          }}
          onKeyDown={handleKeyDown}
          className={`
            flex-1 h-9 px-3 rounded-md text-[13px] font-mono text-left
            border transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1
            ${isRecording
              ? 'border-primary bg-primary/5 text-primary'
              : displayError
                ? 'border-destructive/50 bg-destructive/5'
                : 'border-input bg-background hover:bg-muted/50'
            }
          `}
        >
          {isRecording
            ? "Press keys..."
            : value || "Click to set hotkey"}
        </button>
        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => {
              onChange(null);
              setValidationError(null);
            }}
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </Button>
        )}
      </div>
      {displayError && (
        <p className="text-xs text-destructive flex items-center gap-1.5">
          <HugeiconsIcon icon={InformationCircleIcon} size={14} />
          {displayError}
        </p>
      )}
    </div>
  );
}

export default function SettingsApp() {
  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const { config, updateConfig, loading } = useConfig();
  const {
    microphones,
    loading: microphonesLoading,
    error: microphonesError,
  } = useMicrophones();
  const { isTesting, amplitudes: micTestAmplitudes, startTest } = useMicrophoneTest();
  const { registrationError: hotkeyError, isRegistering: hotkeyRegistering, validateAndRegister } = useHotkeyRegistration(config?.hotkey);
  const modelsHook = useModels();
  const whisperHook = useWhisper(config?.selected_model);
  const [autoStartError, setAutoStartError] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    getVersion().then(setVersion);
  }, []);

  useEffect(() => {
    if (!loading && config && !config.selected_model && modelsHook.downloadedModels.length > 0) {
      updateConfig({ selected_model: modelsHook.downloadedModels[0].id });
    }
  }, [loading, config, modelsHook.downloadedModels, updateConfig]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-sm bg-background/80 border-b border-border/60">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-sm font-semibold tracking-tight">Draft Settings</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              <HugeiconsIcon icon={isDark ? Sun01Icon : Moon01Icon} size={16} />
            </button>
            {version && <span className="text-xs text-muted-foreground/60 font-mono">v{version}</span>}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-4 space-y-3 max-w-lg mx-auto">
        {/* Audio */}
        <SettingsCard
          icon={<HugeiconsIcon icon={Mic01Icon} size={16} />}
          title="Audio"
          description="Configure your microphone input"
        >
          <SettingRow label="Microphone">
            {microphonesLoading ? (
              <div className="h-9 flex items-center">
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : microphonesError ? (
              <p className="text-sm text-destructive">{microphonesError}</p>
            ) : microphones.length === 0 ? (
              <p className="text-sm text-destructive">No microphones detected</p>
            ) : (() => {
              // Find selected mic - null/empty config means system default (first mic with empty id, or just first mic)
              const selectedId = config?.microphone_id;
              const selectedMic = selectedId
                ? microphones.find((m) => m.id === selectedId)
                : microphones.find((m) => m.id === "") || microphones[0];

              return (
                <Select
                  value={selectedMic?.id}
                  onValueChange={(value) => {
                    // Store null for system default (empty id), otherwise store the id
                    const mic = microphones.find((m) => m.id === value);
                    updateConfig({ microphone_id: mic?.id === "" ? null : value });
                  }}
                >
                  <SelectTrigger className="w-full h-9 text-[13px]">
                    <SelectValue placeholder="Select microphone" />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {microphones.map((mic) => (
                      <SelectItem key={mic.id || "system-default"} value={mic.id} className="text-[13px]">
                        {mic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            })()}
          </SettingRow>
          <div className="flex items-center gap-3 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={microphonesLoading || microphones.length === 0 || isTesting}
              onClick={() => startTest(config?.microphone_id ?? null)}
            >
              {isTesting ? "Testing..." : "Test Microphone"}
            </Button>
            {isTesting && <AmplitudeVisualizer amplitudes={micTestAmplitudes} />}
          </div>
        </SettingsCard>

        {/* Hotkey */}
        <SettingsCard
          icon={<HugeiconsIcon icon={KeyboardIcon} size={16} />}
          title="Hotkey"
          description="Push-to-talk keyboard shortcut"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-foreground">Push-to-talk</span>
              {hotkeyRegistering && (
                <span className="text-xs text-primary">(Registering...)</span>
              )}
            </div>
            <HotkeyInput
              value={config?.hotkey || null}
              onChange={(hotkey) => updateConfig({ hotkey })}
              error={hotkeyError}
              onValidate={validateAndRegister}
            />
            <p className="text-xs text-muted-foreground">
              Hold to record, release to transcribe. Function keys (F1-F24) work without modifiers.
            </p>
          </div>
        </SettingsCard>

        {/* Models */}
        <ModelsCard
          config={config}
          updateConfig={updateConfig}
          models={modelsHook.models}
          downloadedModels={modelsHook.downloadedModels}
          availableModels={modelsHook.availableModels}
          modelsLoading={modelsHook.loading}
          isDownloading={modelsHook.isDownloading}
          downloadProgress={modelsHook.downloadProgress}
          downloadModel={modelsHook.downloadModel}
          cancelDownload={modelsHook.cancelDownload}
          deleteModel={modelsHook.deleteModel}
          isModelLoading={whisperHook.isModelLoading}
          loadedModel={whisperHook.loadedModel}
          isTranscribing={whisperHook.isTranscribing}
          transcriptionResult={whisperHook.transcriptionResult}
          transcriptionError={whisperHook.transcriptionError}
          whisperAmplitudes={whisperHook.amplitudes}
          testTranscription={whisperHook.testTranscription}
          whisperBusy={whisperHook.isBusy}
          isTesting={isTesting}
        />

        {/* General */}
        <SettingsCard
          icon={<HugeiconsIcon icon={Settings01Icon} size={16} />}
          title="General"
          description="Application preferences"
        >
          <div className="space-y-1">
            <SettingRow label="Start with Windows" inline>
              <Toggle
                checked={config?.auto_start || false}
                onChange={async (newValue) => {
                  if (!config) return;

                  setAutoStartError(null);
                  const previousValue = config.auto_start;

                  updateConfig({ auto_start: newValue });

                  try {
                    if (newValue) {
                      await invoke("enable_autostart");
                    } else {
                      await invoke("disable_autostart");
                    }

                    await invoke("set_config", {
                      config: { ...config, auto_start: newValue }
                    });
                  } catch (e) {
                    updateConfig({ auto_start: previousValue });
                    const errorMsg = `Failed to ${newValue ? 'enable' : 'disable'} auto-start`;
                    setAutoStartError(errorMsg);
                    console.error(errorMsg, e);
                  }
                }}
              />
            </SettingRow>
            {autoStartError && (
              <p className="text-xs text-destructive pl-0 pb-1">{autoStartError}</p>
            )}

            <SettingRow label="Add space after text" description="Append a trailing space after transcribed text" inline>
              <Toggle
                checked={config?.trailing_space || false}
                onChange={(trailing_space) => updateConfig({ trailing_space })}
              />
            </SettingRow>

            <SettingRow
              label="Enable logging"
              description="Logs to %APPDATA%\Draft\logs (restart required)"
              inline
            >
              <Toggle
                checked={config?.logging_enabled || false}
                onChange={(logging_enabled) => updateConfig({ logging_enabled })}
              />
            </SettingRow>
          </div>
        </SettingsCard>
      </div>
    </div>
  );
}
