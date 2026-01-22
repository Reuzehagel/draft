import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mic01Icon,
  KeyboardIcon,
  Package01Icon,
  SettingsIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
import type { Config } from "@/shared/types/config";
import type { MicrophoneInfo } from "@/shared/types/audio";
import { formatFileSize } from "@/shared/types/models";
import { useModels } from "./useModels";
import { useWhisper } from "./useWhisper";
import { AmplitudeVisualizer } from "./AmplitudeVisualizer";
import * as Events from "@/shared/constants/events";

function useConfig() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    invoke<Config>("get_config")
      .then(setConfig)
      .finally(() => setLoading(false));
  }, []);

  // Cleanup timeout on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const updateConfig = useCallback(
    (updates: Partial<Config>) => {
      if (!config) return;
      const newConfig = { ...config, ...updates };
      setConfig(newConfig);

      // Clear any pending save
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
      }

      // Debounce config saves
      timeoutRef.current = setTimeout(() => {
        invoke("set_config", { config: newConfig });
      }, 300);
    },
    [config]
  );

  return { config, updateConfig, loading };
}

function SettingsSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </h2>
      <div className="space-y-3 pl-6">{children}</div>
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border bg-background accent-primary"
      />
      <span className="text-sm">{label}</span>
    </label>
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

      // Get the key name, handling special cases
      let keyName = e.key;
      if (keyName === " ") keyName = "Space";

      // Check if it's a modifier key being pressed alone
      const isModifierKey = ["Control", "Alt", "Shift", "Meta"].includes(keyName);

      if (keyName && !isModifierKey) {
        // Normalize key name to uppercase for regular keys
        const normalizedKey = keyName.length === 1 ? keyName.toUpperCase() : keyName;
        parts.push(normalizedKey);

        const hotkey = parts.join("+");

        // Quick frontend check for bare keys - F1-F24 are allowed without modifiers
        // Full validation happens on backend via validate_hotkey command
        const isFunctionKey = /^F([1-9]|1[0-9]|2[0-4])$/.test(normalizedKey);
        if (parts.length === 1 && !isFunctionKey) {
          setValidationError(`'${normalizedKey}' requires a modifier key (Ctrl, Alt, Shift, or Meta)`);
          return;
        }

        // Validate with backend
        try {
          await invoke("validate_hotkey", { hotkey });
          setValidationError(null);
          onChange(hotkey);
          setIsRecording(false);

          // Trigger registration validation if provided
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
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className={`min-w-[180px] justify-start font-mono text-xs ${displayError ? 'border-destructive' : ''}`}
          onClick={() => {
            setIsRecording(!isRecording);
            if (!isRecording) setValidationError(null);
          }}
          onKeyDown={handleKeyDown}
        >
          {isRecording
            ? "Press keys..."
            : value || "Click to set hotkey"}
        </Button>
        {value && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(null);
              setValidationError(null);
            }}
          >
            Clear
          </Button>
        )}
      </div>
      {displayError && (
        <p className="text-xs text-destructive">{displayError}</p>
      )}
    </div>
  );
}

function useHotkeyRegistration(hotkey: string | null | undefined) {
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const previousHotkeyRef = useRef<string | null | undefined>(undefined);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Always run on initial mount to ensure hotkey is registered,
    // then track changes for subsequent updates
    const shouldRegister = isInitialMount.current || previousHotkeyRef.current !== hotkey;

    if (!shouldRegister) {
      return;
    }

    // Update tracking refs
    isInitialMount.current = false;
    previousHotkeyRef.current = hotkey;

    const registerHotkey = async () => {
      setRegistrationError(null);

      // If hotkey is cleared, unregister
      if (!hotkey) {
        try {
          await invoke("unregister_hotkey");
        } catch (e) {
          // Log but don't show error for unregister failures
          console.warn("Failed to unregister hotkey:", e);
        }
        return;
      }

      setIsRegistering(true);
      try {
        await invoke("register_hotkey", { hotkey });
      } catch (e) {
        setRegistrationError(String(e));
      } finally {
        setIsRegistering(false);
      }
    };

    registerHotkey();
  }, [hotkey]);

  const validateAndRegister = useCallback(async (newHotkey: string) => {
    setRegistrationError(null);
    setIsRegistering(true);
    try {
      await invoke("register_hotkey", { hotkey: newHotkey });
    } catch (e) {
      setRegistrationError(String(e));
      throw e;
    } finally {
      setIsRegistering(false);
    }
  }, []);

  return { registrationError, isRegistering, validateAndRegister };
}

function useMicrophones() {
  const [microphones, setMicrophones] = useState<MicrophoneInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<MicrophoneInfo[]>("list_microphones")
      .then((mics) => {
        setMicrophones(mics);
        setError(null);
      })
      .catch((e) => {
        setError(String(e));
        setMicrophones([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return { microphones, loading, error };
}

function useMicrophoneTest() {
  const [isTesting, setIsTesting] = useState(false);
  const [amplitudes, setAmplitudes] = useState<number[]>([]);

  useEffect(() => {
    let mounted = true;
    let unlistenAmplitudeFn: (() => void) | null = null;
    let unlistenCompleteFn: (() => void) | null = null;

    // Listen for amplitude updates during test
    listen<number[]>(Events.AMPLITUDE, (event) => {
      if (mounted) {
        setAmplitudes(event.payload);
      }
    }).then((fn) => {
      unlistenAmplitudeFn = fn;
    });

    // Listen for test completion
    listen<boolean>(Events.TEST_MICROPHONE_COMPLETE, () => {
      if (mounted) {
        setIsTesting(false);
        setAmplitudes([]);
      }
    }).then((fn) => {
      unlistenCompleteFn = fn;
    });

    return () => {
      mounted = false;
      // Clean up listeners if they were registered
      if (unlistenAmplitudeFn) unlistenAmplitudeFn();
      if (unlistenCompleteFn) unlistenCompleteFn();
    };
  }, []);

  const startTest = useCallback((deviceId: string | null) => {
    if (isTesting) return;
    setIsTesting(true);
    setAmplitudes([]);
    invoke("test_microphone", { deviceId: deviceId || null }).catch((e) => {
      console.error("Test microphone failed:", e);
      setIsTesting(false);
    });
  }, [isTesting]);

  return { isTesting, amplitudes, startTest };
}

export default function SettingsApp() {
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

  // Auto-select first downloaded model if none selected
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
      // Clear selection if deleted model was selected
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
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-base font-semibold">Draft Settings</h1>
        <span className="text-xs text-muted-foreground">v0.1.0</span>
      </div>

      {/* Content */}
      <div className="space-y-6 p-4">
        {/* Audio Section */}
        <SettingsSection icon={<HugeiconsIcon icon={Mic01Icon} size={16} />} title="Audio">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Microphone</label>
            {microphonesLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : microphonesError ? (
              <p className="text-sm text-destructive">{microphonesError}</p>
            ) : microphones.length === 0 ? (
              <p className="text-sm text-destructive">No microphones detected</p>
            ) : (
              <Select
                value={config?.microphone_id || ""}
                onValueChange={(value) => updateConfig({ microphone_id: value || null })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select microphone" />
                </SelectTrigger>
                <SelectContent>
                  {microphones.map((mic) => (
                    <SelectItem key={mic.id || "default"} value={mic.id}>
                      {mic.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={microphonesLoading || microphones.length === 0 || isTesting}
              onClick={() => startTest(config?.microphone_id ?? null)}
            >
              {isTesting ? "Testing..." : "Test Microphone"}
            </Button>
            {isTesting && <AmplitudeVisualizer amplitudes={micTestAmplitudes} />}
          </div>
        </SettingsSection>

        <Separator />

        {/* Hotkey Section */}
        <SettingsSection icon={<HugeiconsIcon icon={KeyboardIcon} size={16} />} title="Hotkey">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">
              Push-to-talk
              {hotkeyRegistering && <span className="ml-2 text-primary">(Registering...)</span>}
            </label>
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
        </SettingsSection>

        <Separator />

        {/* Models Section */}
        <SettingsSection icon={<HugeiconsIcon icon={Package01Icon} size={16} />} title="Models">
          {modelsLoading ? (
            <p className="text-sm text-muted-foreground">Loading models...</p>
          ) : (
            <div className="space-y-4">
              {/* Downloaded Models */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Downloaded:
                  {isModelLoading && (
                    <span className="ml-2 text-primary">(Loading model...)</span>
                  )}
                  {loadedModel && !isModelLoading && (
                    <span className="ml-2 text-muted-foreground/60">
                      (Loaded: {downloadedModels.find((m) => m.id === loadedModel)?.name || loadedModel})
                    </span>
                  )}
                </p>
                {downloadedModels.length === 0 ? (
                  <p className="text-sm text-muted-foreground/60 italic pl-2">
                    (none)
                  </p>
                ) : (
                  <div className="space-y-2 pl-2">
                    {downloadedModels.map((model) => (
                      <div
                        key={model.id}
                        className="flex items-center justify-between"
                      >
                        <label className={`flex items-center gap-2 flex-1 ${whisperBusy || isDownloading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                          <input
                            type="radio"
                            name="selected_model"
                            checked={config?.selected_model === model.id}
                            onChange={() => updateConfig({ selected_model: model.id })}
                            disabled={whisperBusy || isDownloading}
                            className="h-4 w-4 accent-primary"
                          />
                          <span className="text-sm">
                            {model.name}{" "}
                            <span className="text-muted-foreground">
                              ({formatFileSize(model.size)})
                            </span>
                          </span>
                        </label>
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={<Button variant="ghost" size="sm" disabled={whisperBusy || isDownloading} />}
                          >
                            Delete
                          </AlertDialogTrigger>
                          <AlertDialogContent size="sm">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {model.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove the model from your computer. You can download it again later.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                onClick={() => handleDelete(model.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Available Models */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Available:</p>
                {availableModels.length === 0 ? (
                  <p className="text-sm text-muted-foreground/60 italic pl-2">
                    All models downloaded
                  </p>
                ) : (
                  <div className="space-y-2 pl-2">
                    {availableModels.map((model) => {
                      const isThisDownloading = downloadProgress?.model === model.id;
                      return (
                        <div key={model.id} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">
                              {model.name}{" "}
                              <span className="text-muted-foreground">
                                ({formatFileSize(model.size)})
                              </span>
                            </span>
                            {isThisDownloading ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={cancelDownload}
                              >
                                Cancel
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isDownloading}
                                onClick={() => handleDownload(model.id)}
                              >
                                Download
                              </Button>
                            )}
                          </div>
                          {isThisDownloading && downloadProgress && (
                            <div className="flex items-center gap-2">
                              <Progress value={downloadProgress.progress} className="flex-1" />
                              <span className="text-xs text-muted-foreground w-10 text-right">
                                {downloadProgress.progress}%
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Test Transcription */}
              {downloadedModels.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-2">Test Transcription:</p>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={whisperBusy || !loadedModel || isTesting}
                      onClick={() => testTranscription(config?.microphone_id ?? null)}
                    >
                      {isTranscribing ? "Recording (3s)..." : isModelLoading ? "Loading..." : "Test (3s)"}
                    </Button>
                    {isTranscribing && <AmplitudeVisualizer amplitudes={whisperAmplitudes} />}
                  </div>
                  {transcriptionResult !== null && (
                    <div className="mt-2 p-2 rounded bg-muted text-sm">
                      {transcriptionResult || <span className="text-muted-foreground italic">(no speech detected)</span>}
                    </div>
                  )}
                </div>
              )}

              {/* Error messages */}
              {downloadError && (
                <p className="text-sm text-destructive">{downloadError}</p>
              )}
              {deleteError && (
                <p className="text-sm text-destructive">{deleteError}</p>
              )}
              {transcriptionError && (
                <p className="text-sm text-destructive">{transcriptionError}</p>
              )}
            </div>
          )}
        </SettingsSection>

        <Separator />

        {/* General Section */}
        <SettingsSection icon={<HugeiconsIcon icon={SettingsIcon} size={16} />} title="General">
          <div className="space-y-3">
            <div className="space-y-1">
              <Checkbox
                checked={config?.auto_start || false}
                onChange={async (newValue) => {
                  if (!config) return;

                  setAutoStartError(null);
                  const previousValue = config.auto_start;

                  // Optimistic update for immediate UI feedback
                  updateConfig({ auto_start: newValue });

                  try {
                    // Update system registry
                    if (newValue) {
                      await invoke("enable_autostart");
                    } else {
                      await invoke("disable_autostart");
                    }

                    // Immediately save config (bypass debounce for critical setting)
                    await invoke("set_config", {
                      config: { ...config, auto_start: newValue }
                    });
                  } catch (e) {
                    // Rollback on failure
                    updateConfig({ auto_start: previousValue });
                    const errorMsg = `Failed to ${newValue ? 'enable' : 'disable'} auto-start`;
                    setAutoStartError(errorMsg);
                    console.error(errorMsg, e);
                  }
                }}
                label="Start with Windows"
              />
              {autoStartError && (
                <p className="text-xs text-destructive pl-6">{autoStartError}</p>
              )}
            </div>
            <Checkbox
              checked={config?.trailing_space || false}
              onChange={(trailing_space) => updateConfig({ trailing_space })}
              label="Add space after text"
            />
            <div className="space-y-1">
              <Checkbox
                checked={config?.logging_enabled || false}
                onChange={(logging_enabled) => updateConfig({ logging_enabled })}
                label="Enable logging"
              />
              <p className="text-xs text-muted-foreground pl-6">
                Logs to %APPDATA%\Draft\logs\draft.log (restart required)
              </p>
            </div>
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
