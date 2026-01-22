import { useState, useEffect, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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
import * as Events from "@/shared/constants/events";

function useConfig() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<Config>("get_config")
      .then(setConfig)
      .finally(() => setLoading(false));
  }, []);

  const updateConfig = useMemo(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (updates: Partial<Config>) => {
      if (!config) return;
      const newConfig = { ...config, ...updates };
      setConfig(newConfig);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        invoke("set_config", { config: newConfig });
      }, 300);
    };
  }, [config]);

  return { config, updateConfig, loading };
}

function SettingsSection({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <span>{icon}</span>
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
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isRecording) return;
      e.preventDefault();

      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      if (e.metaKey) parts.push("Meta");

      // Only accept modifier + regular key combinations
      if (e.key && !["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
        parts.push(e.key.toUpperCase());
        onChange(parts.join("+"));
        setIsRecording(false);
      }
    },
    [isRecording, onChange]
  );

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        className="min-w-[180px] justify-start font-mono text-xs"
        onClick={() => setIsRecording(!isRecording)}
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
          onClick={() => onChange(null)}
        >
          Clear
        </Button>
      )}
    </div>
  );
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
    // Listen for amplitude updates during test
    const unlistenAmplitude = listen<number[]>(Events.AMPLITUDE, (event) => {
      setAmplitudes(event.payload);
    });

    // Listen for test completion
    const unlistenComplete = listen<boolean>(
      Events.TEST_MICROPHONE_COMPLETE,
      () => {
        setIsTesting(false);
        setAmplitudes([]);
      }
    );

    return () => {
      unlistenAmplitude.then((fn) => fn());
      unlistenComplete.then((fn) => fn());
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
  const { isTesting, amplitudes, startTest } = useMicrophoneTest();
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
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

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
        <SettingsSection icon="🎤" title="Audio">
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
            {isTesting && amplitudes.length > 0 && (
              <div className="flex items-center gap-[2px] h-5">
                {amplitudes.slice(0, 14).map((amplitude, i) => (
                  <div
                    key={i}
                    className="w-[3px] bg-primary rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(4, amplitude * 20)}px`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </SettingsSection>

        <Separator />

        {/* Hotkey Section */}
        <SettingsSection icon="⌨️" title="Hotkey">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Push-to-talk</label>
            <HotkeyInput
              value={config?.hotkey || null}
              onChange={(hotkey) => updateConfig({ hotkey })}
            />
          </div>
        </SettingsSection>

        <Separator />

        {/* Models Section */}
        <SettingsSection icon="📦" title="Models">
          {modelsLoading ? (
            <p className="text-sm text-muted-foreground">Loading models...</p>
          ) : (
            <div className="space-y-4">
              {/* Downloaded Models */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Downloaded:</p>
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
                        <label className="flex items-center gap-2 cursor-pointer flex-1">
                          <input
                            type="radio"
                            name="selected_model"
                            checked={config?.selected_model === model.id}
                            onChange={() => updateConfig({ selected_model: model.id })}
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
                            render={<Button variant="ghost" size="sm" />}
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

              {/* Error messages */}
              {downloadError && (
                <p className="text-sm text-destructive">{downloadError}</p>
              )}
              {deleteError && (
                <p className="text-sm text-destructive">{deleteError}</p>
              )}
            </div>
          )}
        </SettingsSection>

        <Separator />

        {/* General Section */}
        <SettingsSection icon="⚙️" title="General">
          <div className="space-y-3">
            <Checkbox
              checked={config?.auto_start || false}
              onChange={(auto_start) => updateConfig({ auto_start })}
              label="Start with Windows"
            />
            <Checkbox
              checked={config?.trailing_space || false}
              onChange={(trailing_space) => updateConfig({ trailing_space })}
              label="Add space after text"
            />
            <Checkbox
              checked={config?.logging_enabled || false}
              onChange={(logging_enabled) => updateConfig({ logging_enabled })}
              label="Enable logging"
            />
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
