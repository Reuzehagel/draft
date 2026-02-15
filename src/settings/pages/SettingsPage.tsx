import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Config, TextOutputMode } from "@/shared/types/config";
import type { ModelInfo, DownloadProgress } from "@/shared/types/models";
import { STT_PROVIDER_LABELS } from "@/shared/constants/providers";
import type { Page } from "../components/Sidebar";
import { WaveformBars } from "@/components/WaveformBars";
import { SettingsCard } from "../components/SettingsCard";
import { SettingRow } from "../components/SettingRow";
import { HotkeyInput } from "../components/HotkeyInput";
import { Toggle } from "../components/Toggle";
import { ModelsCard } from "../components/ModelsCard";
import { ErrorMessage } from "../components/ErrorMessage";
import { SettingsTabBar, type SettingsTab } from "../components/TabBar";

const LLM_DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
  openrouter: "openai/gpt-4o-mini",
  cerebras: "llama-4-scout-17b-16e-instruct",
  groq: "llama-3.3-70b-versatile",
};

const LLM_PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "cerebras", label: "Cerebras" },
  { value: "groq", label: "Groq" },
] as const;

const STT_PROVIDERS = Object.entries(STT_PROVIDER_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const STT_DEFAULT_MODELS: Record<string, string> = {
  openai: "whisper-1",
  deepgram: "nova-3",
  assemblyai: "best",
  mistral: "voxtral-mini-latest",
  elevenlabs: "scribe_v1",
};

const STT_SUPPORTS_DIARIZATION = ["deepgram", "assemblyai", "mistral", "elevenlabs"];

function getTranscriptionDescription(
  config: Config | null,
  models: ModelInfo[],
): string {
  if (config?.stt_provider) {
    return `Using ${STT_PROVIDER_LABELS[config.stt_provider] ?? config.stt_provider}`;
  }
  if (config?.selected_model) {
    const model = models.find((m) => m.id === config.selected_model);
    return `Using ${model?.name ?? config.selected_model}`;
  }
  return "No model selected";
}

function ApiKeyRow({
  value,
  onChange,
  show,
  onToggleShow,
}: {
  value: string;
  onChange: (value: string | null) => void;
  show: boolean;
  onToggleShow: () => void;
}): React.ReactNode {
  return (
    <SettingRow label="API Key">
      <div className="flex items-center gap-2">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="Enter API key"
          className="flex-1 text-[13px] font-mono"
        />
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={onToggleShow}
        >
          {show ? "Hide" : "Show"}
        </Button>
      </div>
    </SettingRow>
  );
}

function MicrophoneSelect({
  selectedId,
  microphones,
  onSelect,
}: {
  selectedId: string | null | undefined;
  microphones: Array<{ id: string; name: string }>;
  onSelect: (microphoneId: string | null) => void;
}): React.ReactNode {
  const selectedMic = selectedId
    ? microphones.find((m) => m.id === selectedId)
    : microphones.find((m) => m.id === "") || microphones[0];

  return (
    <Select
      value={selectedMic?.id}
      onValueChange={(value) => {
        const mic = microphones.find((m) => m.id === value);
        onSelect(mic?.id === "" ? null : value);
      }}
    >
      <SelectTrigger className="w-full text-[13px]">
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
}

function MicrophoneContent({
  microphonesLoading,
  microphonesError,
  microphones,
  selectedId,
  onSelect,
}: {
  microphonesLoading: boolean;
  microphonesError: string | null;
  microphones: Array<{ id: string; name: string }>;
  selectedId: string | null | undefined;
  onSelect: (microphoneId: string | null) => void;
}): React.ReactNode {
  if (microphonesLoading) {
    return (
      <div className="h-9 flex items-center">
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (microphonesError) {
    return <p className="text-sm text-destructive">{microphonesError}</p>;
  }

  if (microphones.length === 0) {
    return <p className="text-sm text-destructive">No microphones detected</p>;
  }

  return (
    <MicrophoneSelect
      selectedId={selectedId}
      microphones={microphones}
      onSelect={onSelect}
    />
  );
}

interface SettingsPageProps {
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
  modelsHook: {
    models: ModelInfo[];
    downloadedModels: ModelInfo[];
    availableModels: ModelInfo[];
    loading: boolean;
    isDownloading: boolean;
    downloadProgress: DownloadProgress | null;
    downloadModel: (modelId: string) => Promise<void>;
    cancelDownload: () => Promise<void>;
    deleteModel: (modelId: string) => Promise<void>;
  };
  whisperHook: {
    isModelLoading: boolean;
    loadedModel: string | null;
    isTranscribing: boolean;
    transcriptionResult: string | null;
    transcriptionError: string | null;
    amplitudes: number[];
    testTranscription: (deviceId: string | null) => void;
    isBusy: boolean;
  };
  onNavigate: (page: Page) => void;
}

export function SettingsPage({
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
  modelsHook,
  whisperHook,
  onNavigate,
}: SettingsPageProps): React.ReactNode {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [autoStartError, setAutoStartError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSttApiKey, setShowSttApiKey] = useState(false);

  const handleAutoStartToggle = useCallback(async (newValue: boolean) => {
    if (!config) return;

    setAutoStartError(null);
    const previousValue = config.auto_start;

    try {
      await invoke(newValue ? "enable_autostart" : "disable_autostart");
      updateConfig({ auto_start: newValue });
    } catch (e) {
      updateConfig({ auto_start: previousValue });
      const errorMsg = `Failed to ${newValue ? "enable" : "disable"} auto-start`;
      setAutoStartError(errorMsg);
      console.error(errorMsg, e);
    }
  }, [config, updateConfig]);

  return (
    <div className="flex flex-col h-full">
      <SettingsTabBar activeTab={activeTab} onChange={setActiveTab} />
      <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
        <div className="p-4 space-y-3 max-w-xl mx-auto">
          {activeTab === "input" && (
            <>
              <SettingsCard
                title="Audio"
                description="Configure your microphone input"
              >
                <SettingRow label="Microphone">
                  <MicrophoneContent
                    microphonesLoading={microphonesLoading}
                    microphonesError={microphonesError}
                    microphones={microphones}
                    selectedId={config?.microphone_id}
                    onSelect={(microphoneId) => updateConfig({ microphone_id: microphoneId })}
                  />
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
                  {isTesting && <WaveformBars amplitudes={micTestAmplitudes} />}
                </div>
              </SettingsCard>

              <SettingsCard
                title="Hotkey"
                description="Push-to-talk keyboard shortcut"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">Push-to-talk</span>
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
                <SettingRow label="Double-tap to toggle" description="Double-tap your hotkey to start continuous recording, tap again to stop" inline>
                  <Toggle
                    checked={config?.double_tap_toggle || false}
                    onChange={(double_tap_toggle) => updateConfig({ double_tap_toggle })}
                  />
                </SettingRow>
              </SettingsCard>
            </>
          )}

          {activeTab === "transcription" && (
            <>
              <SettingsCard
                title="Transcription"
                description={getTranscriptionDescription(config, modelsHook.models)}
              >
                <SettingRow label="Engine">
                  <Select
                    value={config?.stt_provider || "local"}
                    onValueChange={(value) =>
                      updateConfig({ stt_provider: value === "local" ? null : value })
                    }
                  >
                    <SelectTrigger className="w-full text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectItem value="local" className="text-[13px]">
                        Local (Whisper)
                      </SelectItem>
                      {STT_PROVIDERS.map((p) => (
                        <SelectItem key={p.value} value={p.value} className="text-[13px]">
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>

                <div
                  className="grid transition-[grid-template-rows] duration-200 ease-out"
                  style={{ gridTemplateRows: config?.stt_provider ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-3 pt-1">
                      <ApiKeyRow
                        value={config?.stt_api_key || ""}
                        onChange={(stt_api_key) => updateConfig({ stt_api_key })}
                        show={showSttApiKey}
                        onToggleShow={() => setShowSttApiKey(!showSttApiKey)}
                      />

                      <SettingRow label="Model" description="Leave empty for provider default">
                        <Input
                          type="text"
                          value={config?.stt_model || ""}
                          onChange={(e) => updateConfig({ stt_model: e.target.value || null })}
                          placeholder={STT_DEFAULT_MODELS[config?.stt_provider ?? ""] ?? "Provider default"}
                          className="text-[13px] font-mono"
                        />
                      </SettingRow>

                      {STT_SUPPORTS_DIARIZATION.includes(config?.stt_provider ?? "") && (
                        <SettingRow
                          label="Speaker diarization"
                          description="Identify and label different speakers"
                          inline
                        >
                          <Toggle
                            checked={config?.stt_enable_diarization || false}
                            onChange={(stt_enable_diarization) => updateConfig({ stt_enable_diarization })}
                          />
                        </SettingRow>
                      )}
                    </div>
                  </div>
                </div>
              </SettingsCard>

              <button
                onClick={() => onNavigate("help")}
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                Not sure which to choose? See comparison guide &rarr;
              </button>

              {/* Models — only shown when using local Whisper */}
              {!config?.stt_provider && (
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
              )}
            </>
          )}

          {activeTab === "enhancement" && (
            <SettingsCard
              title="AI Enhancement"
              description="Clean up and transform transcribed text"
            >
              <SettingRow label="Enable enhancement" description="Process text through an LLM before injection" inline>
                <Toggle
                  checked={config?.llm_auto_process || false}
                  onChange={(llm_auto_process) => updateConfig({ llm_auto_process })}
                />
              </SettingRow>

              <div
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: config?.llm_auto_process ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div className="space-y-3 pt-1">
                    <SettingRow label="Confirm before enhancing" description="Prompt Y/N before sending to LLM" inline>
                      <Toggle
                        checked={config?.llm_confirm_before_processing || false}
                        onChange={(llm_confirm_before_processing) =>
                          updateConfig({ llm_confirm_before_processing })
                        }
                      />
                    </SettingRow>

                    <SettingRow label="Provider">
                      <Select
                        value={config?.llm_provider || ""}
                        onValueChange={(value) => updateConfig({ llm_provider: value || null })}
                      >
                        <SelectTrigger className="w-full text-[13px]">
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          {LLM_PROVIDERS.map((provider) => (
                            <SelectItem key={provider.value} value={provider.value} className="text-[13px]">
                              {provider.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </SettingRow>

                    <ApiKeyRow
                      value={config?.llm_api_key || ""}
                      onChange={(llm_api_key) => updateConfig({ llm_api_key })}
                      show={showApiKey}
                      onToggleShow={() => setShowApiKey(!showApiKey)}
                    />

                    <SettingRow label="Model" description="Leave empty for provider default">
                      <Input
                        type="text"
                        value={config?.llm_model || ""}
                        onChange={(e) => updateConfig({ llm_model: e.target.value || null })}
                        placeholder={LLM_DEFAULT_MODELS[config?.llm_provider ?? ""] ?? "Provider default"}
                        className="text-[13px] font-mono"
                      />
                    </SettingRow>

                    <SettingRow label="Custom prompt" description="Override the default system prompt sent to the LLM">
                      <Textarea
                        value={config?.llm_system_prompt || ""}
                        onChange={(e) => updateConfig({ llm_system_prompt: e.target.value || null })}
                        placeholder="Leave empty for default prompt (light cleanup, preserve original words)"
                        rows={3}
                        className="text-[13px] min-h-[60px] resize-y"
                      />
                    </SettingRow>

                    <p className="text-xs text-muted-foreground flex items-start gap-1.5 pt-1">
                      <HugeiconsIcon icon={InformationCircleIcon} size={14} className="shrink-0 mt-0.5" />
                      <span>Voice commands: start with an instruction like &ldquo;reply saying...&rdquo; or &ldquo;make this professional&rdquo;</span>
                    </p>
                  </div>
                </div>
              </div>
            </SettingsCard>
          )}

          {activeTab === "general" && (
            <SettingsCard
              title="General"
              description="Application preferences"
            >
              <div className="space-y-1">
                <SettingRow label="Start with Windows" inline>
                  <Toggle
                    checked={config?.auto_start || false}
                    onChange={handleAutoStartToggle}
                  />
                </SettingRow>
                {autoStartError && (
                  <div className="pb-1">
                    <ErrorMessage message={autoStartError} />
                  </div>
                )}

                <SettingRow label="Text output" description="How transcribed text is delivered">
                  <Select
                    value={config?.text_output_mode || "inject"}
                    onValueChange={(value) => updateConfig({ text_output_mode: value as TextOutputMode })}
                  >
                    <SelectTrigger className="w-full text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectItem value="inject" className="text-[13px]">Type into app</SelectItem>
                      <SelectItem value="clipboard" className="text-[13px]">Copy to clipboard</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>

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
          )}
        </div>
      </div>
    </div>
  );
}
