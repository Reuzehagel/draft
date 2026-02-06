import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { createListenerGroup } from "@/shared/utils/tauriListeners";
import type { ModelInfo, DownloadProgress } from "@/shared/types/models";
import * as Events from "@/shared/constants/events";

export function useModels() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch models list
  const refreshModels = useCallback(async () => {
    try {
      const modelList = await invoke<ModelInfo[]>("list_models");
      setModels(modelList);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    refreshModels().finally(() => setLoading(false));
  }, [refreshModels]);

  // Listen for download progress events
  useEffect(() => {
    const listeners = createListenerGroup();

    listeners.add<DownloadProgress>(Events.DOWNLOAD_PROGRESS, (event) => {
      setDownloadProgress(event.payload);

      // If download completed (100%), refresh models
      if (event.payload.progress >= 100) {
        setIsDownloading(false);
        setDownloadProgress(null);
        refreshModels();
      }
    });

    return () => listeners.cleanup();
  }, [refreshModels]);

  // Download a model
  const downloadModel = useCallback(async (modelId: string) => {
    if (isDownloading) return;

    setIsDownloading(true);
    setDownloadProgress({ model: modelId, progress: 0, downloaded_bytes: 0, total_bytes: 0 });

    try {
      await invoke("download_model", { modelId });
      // Progress events handle completion
    } catch (e) {
      setIsDownloading(false);
      setDownloadProgress(null);
      throw e;
    }
  }, [isDownloading]);

  // Cancel download
  const cancelDownload = useCallback(async () => {
    try {
      await invoke("cancel_download");
    } catch (e) {
      console.error("Failed to cancel download:", e);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  }, []);

  // Delete a model
  const deleteModel = useCallback(async (modelId: string) => {
    await invoke("delete_model", { modelId });
    await refreshModels();
  }, [refreshModels]);

  // Split models into downloaded and available
  const downloadedModels = models.filter((m) => m.downloaded);
  const availableModels = models.filter((m) => !m.downloaded);

  return {
    models,
    downloadedModels,
    availableModels,
    loading,
    error,
    isDownloading,
    downloadProgress,
    downloadModel,
    cancelDownload,
    deleteModel,
    refreshModels,
  };
}
