import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { createListenerGroup } from "@/shared/utils/tauriListeners";
import * as Events from "@/shared/constants/events";

interface WhisperState {
  is_busy: boolean;
  current_model: string | null;
}

export function useWhisper(selectedModel: string | null | undefined) {
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [loadedModel, setLoadedModel] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<string | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [amplitudes, setAmplitudes] = useState<number[]>([]);
  const lastLoadedModelRef = useRef<string | null>(null);
  const [stateQueried, setStateQueried] = useState(false);

  // Get initial whisper state on mount
  useEffect(() => {
    invoke<WhisperState>("get_whisper_state").then((state) => {
      setLoadedModel(state.current_model);
      lastLoadedModelRef.current = state.current_model;
      setStateQueried(true);
    });
  }, []);

  const isTranscribingRef = useRef(false);
  useEffect(() => {
    isTranscribingRef.current = isTranscribing;
  }, [isTranscribing]);

  // Listen for whisper events
  useEffect(() => {
    const listeners = createListenerGroup();

    listeners.add<string>(Events.MODEL_LOADING, (event) => {
      setIsModelLoading(true);
      setTranscriptionError(null);
      console.log("Model loading:", event.payload);
    });

    listeners.add<string>(Events.MODEL_LOADED, (event) => {
      setIsModelLoading(false);
      setLoadedModel(event.payload);
      lastLoadedModelRef.current = event.payload;
      console.log("Model loaded:", event.payload);
    });

    listeners.add<string>(Events.TRANSCRIPTION_COMPLETE, (event) => {
      setIsTranscribing(false);
      setTranscriptionResult(event.payload);
      setAmplitudes([]);
      console.log("Transcription complete:", event.payload);
    });

    listeners.add<string>(Events.TRANSCRIPTION_ERROR, (event) => {
      setIsModelLoading(false);
      setIsTranscribing(false);
      setTranscriptionError(event.payload);
      setAmplitudes([]);
      console.error("Transcription error:", event.payload);
    });

    listeners.add<number[]>(Events.AMPLITUDE, (event) => {
      if (isTranscribingRef.current) {
        setAmplitudes(event.payload);
      }
    });

    return () => listeners.cleanup();
  }, []);

  // Load model when selected model changes (wait for initial state query to avoid double-loading)
  useEffect(() => {
    if (!stateQueried) return;
    if (selectedModel && selectedModel !== lastLoadedModelRef.current && !isModelLoading) {
      console.log("Loading model:", selectedModel);
      invoke("load_model", { modelId: selectedModel }).catch((e) => {
        console.error("Failed to load model:", e);
        setTranscriptionError(String(e));
      });
    }
  }, [selectedModel, isModelLoading, stateQueried]);

  const testTranscription = useCallback((deviceId: string | null) => {
    if (isTranscribing || isModelLoading || !loadedModel) return;
    setIsTranscribing(true);
    setTranscriptionResult(null);
    setTranscriptionError(null);
    setAmplitudes([]);
    invoke("test_transcription", { deviceId: deviceId || null }).catch((e) => {
      console.error("Test transcription failed:", e);
      setIsTranscribing(false);
      setTranscriptionError(String(e));
    });
  }, [isTranscribing, isModelLoading, loadedModel]);

  const isBusy = isModelLoading || isTranscribing;

  return {
    isModelLoading,
    loadedModel,
    isTranscribing,
    transcriptionResult,
    transcriptionError,
    amplitudes,
    testTranscription,
    isBusy,
  };
}
