import { useState, useEffect, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Config } from "@/shared/types/config";
import type { ModelInfo, DownloadProgress } from "@/shared/types/models";
import { STT_PROVIDER_LABELS } from "@/shared/constants/providers";
import { createListenerGroup } from "@/shared/utils/tauriListeners";
import { parseApiError } from "@/shared/utils/parseApiError";
import * as Events from "@/shared/constants/events";
import { SettingRow } from "../components/SettingRow";
import { ApiKeyInput } from "../components/ApiKeyInput";
import { ErrorMessage } from "../components/ErrorMessage";
import { ModelsCard } from "../components/ModelsCard";
import { SectionHeader } from "../components/SectionHeader";
import { SectionDivider } from "../components/SectionDivider";

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

interface ModelsPageProps {
  config: Config | null;
  updateConfig: (updates: Partial<Config>) => void;
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
  isTesting: boolean;
}

export function ModelsPage({
  config,
  updateConfig,
  modelsHook,
  whisperHook,
  isTesting,
}: ModelsPageProps): React.ReactNode {
  const [onlineSttError, setOnlineSttError] = useState<string | null>(null);
  const sttProviderRef = useRef(config?.stt_provider);
  useEffect(() => { sttProviderRef.current = config?.stt_provider; }, [config?.stt_provider]);

  // Listen for transcription errors when using an online STT provider
  useEffect(() => {
    const listeners = createListenerGroup();
    listeners.add<string>(Events.TRANSCRIPTION_ERROR, (event) => {
      if (sttProviderRef.current) {
        setOnlineSttError(parseApiError(event.payload));
      }
    });
    return () => listeners.cleanup();
  }, []);

  // Clear online error when switching providers
  useEffect(() => {
    setOnlineSttError(null);
  }, [config?.stt_provider]);

  const engineItems = [
    { label: "Local", value: "local" },
    ...STT_PROVIDERS.map((p) => ({ label: p.label, value: p.value })),
  ];

  const isLocal = !config?.stt_provider;

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader>Engine</SectionHeader>
      <SettingRow label="Transcription engine">
        <Select
          value={config?.stt_provider || "local"}
          onValueChange={(value) =>
            updateConfig({ stt_provider: value === "local" ? null : value })
          }
          items={engineItems}
        >
          <SelectTrigger className="w-full text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {engineItems.map((item) => (
              <SelectItem key={item.value} value={item.value} className="text-[13px]">
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      {/* Online STT provider settings */}
      {!isLocal && (
        <>
          <SectionDivider />
          <SectionHeader>{STT_PROVIDER_LABELS[config?.stt_provider ?? ""] ?? "Provider Settings"}</SectionHeader>

          <ApiKeyInput
            value={config?.stt_api_key || ""}
            onChange={(stt_api_key) => updateConfig({ stt_api_key })}
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
              <Switch
                checked={config?.stt_enable_diarization || false}
                onCheckedChange={(stt_enable_diarization) => updateConfig({ stt_enable_diarization })}
              />
            </SettingRow>
          )}

          {onlineSttError && <ErrorMessage message={onlineSttError} />}
        </>
      )}

      {/* Local Whisper settings */}
      {isLocal && (
        <>
          <SectionDivider />
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

          <SectionDivider />
          <SectionHeader>Whisper Prompt</SectionHeader>
          <Textarea
            value={config?.whisper_initial_prompt || ""}
            onChange={(e) => updateConfig({ whisper_initial_prompt: e.target.value || null })}
            placeholder="e.g. Draft, Tauri, React. Use proper punctuation and capitalization."
            rows={2}
            className="text-[13px] min-h-[48px] resize-y"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Helps Whisper with domain terms, spelling, and formatting preferences. Has no effect on Parakeet.
          </p>
        </>
      )}
    </div>
  );
}
