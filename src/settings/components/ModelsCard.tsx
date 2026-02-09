import { useState, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Package01Icon } from "@hugeicons/core-free-icons";
import { Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import type { ModelInfo, DownloadProgress } from "@/shared/types/models";
import type { Config } from "@/shared/types/config";
import { WaveformBars } from "@/components/WaveformBars";
import { Toggle } from "./Toggle";
import { ErrorMessage } from "./ErrorMessage";
import { TierPicker } from "./models/TierPicker";
import { ModelStatusArea } from "./models/ModelStatusArea";
import { AllModelsCollapsible } from "./models/AllModelsCollapsible";
import { ModelItem } from "./models/ModelItem";
import { DownloadableModel } from "./models/DownloadableModel";
import {
  TIERS,
  getTierFromModelId,
  isEnglishOnly,
  getModelId,
  type Tier,
} from "./models/tierConfig";

interface ModelsCardProps {
  config: Config | null;
  updateConfig: (patch: Partial<Config>) => void;
  models: ModelInfo[];
  downloadedModels: ModelInfo[];
  availableModels: ModelInfo[];
  modelsLoading: boolean;
  isDownloading: boolean;
  downloadProgress: DownloadProgress | null;
  downloadModel: (modelId: string) => Promise<void>;
  cancelDownload: () => Promise<void>;
  deleteModel: (modelId: string) => Promise<void>;
  isModelLoading: boolean;
  loadedModel: string | null;
  isTranscribing: boolean;
  transcriptionResult: string | null;
  transcriptionError: string | null;
  whisperAmplitudes: number[];
  testTranscription: (deviceId: string | null) => void;
  whisperBusy: boolean;
  isTesting: boolean;
}

export function ModelsCard({
  config,
  updateConfig,
  models,
  downloadedModels,
  availableModels,
  modelsLoading,
  isDownloading,
  downloadProgress,
  downloadModel,
  cancelDownload,
  deleteModel,
  isModelLoading,
  loadedModel,
  isTranscribing,
  transcriptionResult,
  transcriptionError,
  whisperAmplitudes,
  testTranscription,
  whisperBusy,
  isTesting,
}: ModelsCardProps) {
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Pending tier: selected a tier whose model isn't downloaded yet
  const [pendingTierId, setPendingTierId] = useState<string | null>(null);
  // Local english toggle state
  const [localEnglish, setLocalEnglish] = useState(() => {
    if (config?.selected_model) return isEnglishOnly(config.selected_model);
    return true;
  });

  // Track previous config.selected_model to detect external changes (e.g. from All Models section)
  const prevSelectedModelRef = useRef(config?.selected_model);

  // Detect external config changes and sync local state
  const selectedModel = config?.selected_model;
  if (selectedModel !== prevSelectedModelRef.current) {
    prevSelectedModelRef.current = selectedModel;
    if (selectedModel) {
      const tier = getTierFromModelId(selectedModel);
      if (tier) {
        // Config changed to a tiered model — sync local state
        if (pendingTierId) setPendingTierId(null);
        const english = isEnglishOnly(selectedModel);
        if (english !== localEnglish) setLocalEnglish(english);
      }
    }
  }

  // Derive active tier from pending or config (plain computation, no useMemo)
  let activeTier: Tier | null = null;
  if (pendingTierId) {
    activeTier = TIERS.find((t) => t.id === pendingTierId) ?? null;
  } else if (config?.selected_model) {
    activeTier = getTierFromModelId(config.selected_model);
  }

  // The effective model ID based on tier + language
  const effectiveModelId = activeTier ? getModelId(activeTier, localEnglish) : null;
  const effectiveModel = effectiveModelId
    ? models.find((m) => m.id === effectiveModelId)
    : undefined;

  // Auto-select in config when pending tier's model finishes downloading
  // Done during render to avoid setState-in-effect lint error
  if (pendingTierId && effectiveModelId && effectiveModel?.downloaded) {
    updateConfig({ selected_model: effectiveModelId });
    setPendingTierId(null);
  }

  const handleTierSelect = (tier: Tier) => {
    const modelId = getModelId(tier, localEnglish);
    const model = models.find((m) => m.id === modelId);
    if (model?.downloaded) {
      setPendingTierId(null);
      updateConfig({ selected_model: modelId });
    } else {
      setPendingTierId(tier.id);
    }
  };

  const handleEnglishToggle = (english: boolean) => {
    setLocalEnglish(english);
    if (activeTier) {
      const modelId = getModelId(activeTier, english);
      const model = models.find((m) => m.id === modelId);
      if (model?.downloaded) {
        setPendingTierId(null);
        updateConfig({ selected_model: modelId });
      } else if (!pendingTierId) {
        setPendingTierId(activeTier.id);
      }
    }
  };

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

  let description: string;
  if (isModelLoading) {
    description = "Loading model...";
  } else if (loadedModel) {
    const loadedName = downloadedModels.find((m) => m.id === loadedModel)?.name ?? loadedModel;
    description = `Active: ${loadedName}`;
  } else {
    description = "Select a transcription model";
  }

  let testButtonLabel: string;
  if (isTranscribing) {
    testButtonLabel = "Recording (3s)...";
  } else if (isModelLoading) {
    testButtonLabel = "Loading...";
  } else {
    testButtonLabel = "Test Transcription (3s)";
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card/50 overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3 border-b border-border/40 bg-muted/30">
        <div className="mt-0.5 text-muted-foreground/70">
          <HugeiconsIcon icon={Package01Icon} size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[13px] font-medium text-foreground">Models</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="px-4 py-3 space-y-3">
        {modelsLoading ? (
          <div className="py-4 flex items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground" role="status" aria-live="polite">
              <Spinner size={16} />
              <span className="text-sm">Loading models...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Tier Picker */}
            <TierPicker activeTierId={activeTier?.id ?? null} onSelect={handleTierSelect} />

            {/* English-only toggle */}
            <div className="flex items-center justify-between py-1">
              <span className="text-[13px] text-foreground">English only</span>
              <Toggle checked={localEnglish} onChange={handleEnglishToggle} />
            </div>

            {/* Model Status */}
            <ModelStatusArea
              effectiveModel={effectiveModel}
              isLoaded={loadedModel === effectiveModelId}
              isModelLoading={isModelLoading}
              isDownloading={isDownloading}
              downloadProgress={downloadProgress}
              onDownload={() => effectiveModelId && handleDownload(effectiveModelId)}
              onCancel={cancelDownload}
            />

            {/* All Models + Test Transcription (collapsible) */}
            <AllModelsCollapsible>
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
                <div className="pt-1 border-t border-border/40">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={whisperBusy || !loadedModel || isTesting}
                      onClick={() => testTranscription(config?.microphone_id ?? null)}
                    >
                      {testButtonLabel}
                    </Button>
                    {isTranscribing && <WaveformBars amplitudes={whisperAmplitudes} />}
                  </div>
                  {transcriptionResult !== null && (
                    <div className="mt-3 p-2.5 rounded-md bg-muted/50 border border-border/40" role="status" aria-live="polite">
                      <p className="text-[13px]">
                        {transcriptionResult || <span className="text-muted-foreground italic">(no speech detected)</span>}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </AllModelsCollapsible>

            {/* Errors */}
            {(downloadError || deleteError || transcriptionError) && (
              <div className="space-y-1">
                {[downloadError, deleteError, transcriptionError].filter(Boolean).map((error, i) => (
                  <ErrorMessage key={i} message={error!} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
