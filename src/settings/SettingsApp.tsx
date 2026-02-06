import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mic01Icon,
  KeyboardIcon,
  Package01Icon,
  Settings01Icon,
  Delete02Icon,
  Download01Icon,
  Cancel01Icon,
  Tick02Icon,
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
import { Progress } from "@/components/ui/progress";
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
import { formatFileSize } from "@/shared/types/models";
import { useDarkMode } from "./hooks/useDarkMode";
import { useConfig } from "./hooks/useConfig";
import { useHotkeyRegistration } from "./hooks/useHotkeyRegistration";
import { useMicrophones } from "./hooks/useMicrophones";
import { useMicrophoneTest } from "./hooks/useMicrophoneTest";
import { useModels } from "./useModels";
import { useWhisper } from "./useWhisper";
import { AmplitudeVisualizer } from "./AmplitudeVisualizer";

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

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full
        transition-colors duration-200 ease-in-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
        disabled:cursor-not-allowed disabled:opacity-50
        ${checked ? 'bg-primary' : 'bg-input'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-sm ring-0
          transition duration-200 ease-in-out
          ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}
        `}
      />
    </button>
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

function ModelItem({
  name,
  size,
  isSelected,
  isLoaded,
  onSelect,
  onDelete,
  disabled,
}: {
  name: string;
  size: number;
  isSelected: boolean;
  isLoaded: boolean;
  onSelect: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  return (
    <div className={`
      flex items-center gap-3 px-3 py-2 rounded-md transition-colors
      ${isSelected ? 'bg-primary/8' : 'hover:bg-muted/50'}
    `}>
      <button
        onClick={onSelect}
        disabled={disabled}
        className={`
          w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0
          transition-colors disabled:opacity-50 disabled:cursor-not-allowed
          ${isSelected
            ? 'border-primary bg-primary'
            : 'border-muted-foreground/30 hover:border-muted-foreground/50'
          }
        `}
      >
        {isSelected && (
          <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <span className="text-[13px] text-foreground">{name}</span>
        <span className="text-xs text-muted-foreground ml-2">
          {formatFileSize(size)}
        </span>
        {isLoaded && (
          <span className="text-xs text-primary/70 ml-2 inline-flex items-center gap-1">
            <HugeiconsIcon icon={Tick02Icon} size={12} />
            Loaded
          </span>
        )}
      </div>
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <button
              disabled={disabled}
              className="p-1.5 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          }
        >
          <HugeiconsIcon icon={Delete02Icon} size={16} />
        </AlertDialogTrigger>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the model from your computer. You can download it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DownloadableModel({
  name,
  size,
  isDownloading,
  progress,
  onDownload,
  onCancel,
  disabled,
}: {
  name: string;
  size: number;
  isDownloading: boolean;
  progress: number | null;
  onDownload: () => void;
  onCancel: () => void;
  disabled: boolean;
}) {
  return (
    <div className="px-3 py-2 rounded-md hover:bg-muted/30 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <span className="text-[13px] text-foreground">{name}</span>
          <span className="text-xs text-muted-foreground ml-2">
            {formatFileSize(size)}
          </span>
        </div>
        {isDownloading ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
            onClick={onCancel}
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} />
            <span className="ml-1.5 text-xs">Cancel</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
            disabled={disabled}
            onClick={onDownload}
          >
            <HugeiconsIcon icon={Download01Icon} size={14} />
            <span className="ml-1.5 text-xs">Download</span>
          </Button>
        )}
      </div>
      {isDownloading && progress !== null && (
        <div className="flex items-center gap-2 mt-2">
          <Progress value={progress} className="flex-1 h-1.5" />
          <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
            {progress}%
          </span>
        </div>
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
  const {
    downloadedModels,
    availableModels,
    loading: modelsLoading,
    isDownloading,
    downloadProgress,
    downloadModel,
    cancelDownload,
    deleteModel,
  } = useModels();
  const {
    isModelLoading,
    loadedModel,
    isTranscribing,
    transcriptionResult,
    transcriptionError,
    amplitudes: whisperAmplitudes,
    testTranscription,
    isBusy: whisperBusy,
  } = useWhisper(config?.selected_model);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [autoStartError, setAutoStartError] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    getVersion().then(setVersion);
  }, []);

  useEffect(() => {
    if (!loading && config && !config.selected_model && downloadedModels.length > 0) {
      updateConfig({ selected_model: downloadedModels[0].id });
    }
  }, [loading, config, downloadedModels, updateConfig]);

  const handleDownload = async (modelId: string) => {
    setDownloadError(null);
    try {
      await downloadModel(modelId);
    } catch (e) {
      setDownloadError(String(e));
    }
  };

  const handleDelete = async (modelId: string) => {
    setDeleteError(null);
    try {
      await deleteModel(modelId);
      if (config?.selected_model === modelId) {
        updateConfig({ selected_model: null });
      }
    } catch (e) {
      setDeleteError(String(e));
    }
  };

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
        <SettingsCard
          icon={<HugeiconsIcon icon={Package01Icon} size={16} />}
          title="Models"
          description={isModelLoading ? "Loading model..." : loadedModel ? `Active: ${downloadedModels.find((m) => m.id === loadedModel)?.name || loadedModel}` : "Select a transcription model"}
        >
          {modelsLoading ? (
            <div className="py-4 flex items-center justify-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading models...</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Downloaded Models */}
              {downloadedModels.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Downloaded
                  </p>
                  <div className="space-y-1 -mx-1">
                    {downloadedModels.map((model) => (
                      <ModelItem
                        key={model.id}
                        name={model.name}
                        size={model.size}
                        isSelected={config?.selected_model === model.id}
                        isLoaded={loadedModel === model.id}
                        onSelect={() => updateConfig({ selected_model: model.id })}
                        onDelete={() => handleDelete(model.id)}
                        disabled={whisperBusy || isDownloading}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Available Models */}
              {availableModels.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Available to Download
                  </p>
                  <div className="space-y-1 -mx-1">
                    {availableModels.map((model) => {
                      const isThisDownloading = downloadProgress?.model === model.id;
                      return (
                        <DownloadableModel
                          key={model.id}
                          name={model.name}
                          size={model.size}
                          isDownloading={isThisDownloading}
                          progress={isThisDownloading ? downloadProgress?.progress ?? null : null}
                          onDownload={() => handleDownload(model.id)}
                          onCancel={cancelDownload}
                          disabled={isDownloading && !isThisDownloading}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Test Transcription */}
              {downloadedModels.length > 0 && (
                <div className="pt-3 border-t border-border/40">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={whisperBusy || !loadedModel || isTesting}
                      onClick={() => testTranscription(config?.microphone_id ?? null)}
                    >
                      {isTranscribing ? "Recording (3s)..." : isModelLoading ? "Loading..." : "Test Transcription (3s)"}
                    </Button>
                    {isTranscribing && <AmplitudeVisualizer amplitudes={whisperAmplitudes} />}
                  </div>
                  {transcriptionResult !== null && (
                    <div className="mt-3 p-2.5 rounded-md bg-muted/50 border border-border/40">
                      <p className="text-[13px]">
                        {transcriptionResult || <span className="text-muted-foreground italic">(no speech detected)</span>}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Errors */}
              {(downloadError || deleteError || transcriptionError) && (
                <div className="space-y-1">
                  {[downloadError, deleteError, transcriptionError].filter(Boolean).map((error, i) => (
                    <p key={i} className="text-xs text-destructive flex items-center gap-1.5">
                      <HugeiconsIcon icon={InformationCircleIcon} size={14} />
                      {error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </SettingsCard>

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
