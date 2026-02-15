import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { createListenerGroup } from "@/shared/utils/tauriListeners";
import * as Events from "@/shared/constants/events";

export interface FileTranscriptionState {
  selectedFile: string | null;
  selectedFileName: string | null;
  isDecoding: boolean;
  isTranscribing: boolean;
  decodeProgress: number;
  transcriptionProgress: number;
  result: string | null;
  error: string | null;
  isEnhancing: boolean;
  isCancelling: boolean;
  selectFile: () => void;
  transcribe: () => void;
  cancel: () => void;
  enhance: () => void;
  copyResult: () => void;
  saveToFile: () => void;
  clear: () => void;
}

export function useFileTranscription(): FileTranscriptionState {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [decodeProgress, setDecodeProgress] = useState(0);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Ref to guard shared TRANSCRIPTION_COMPLETE/ERROR events
  const isFileTranscribingRef = useRef(false);
  useEffect(() => {
    isFileTranscribingRef.current = isDecoding || isTranscribing;
  }, [isDecoding, isTranscribing]);

  // Event listeners — [] deps with refs (pattern from useWhisper.ts)
  useEffect(() => {
    const listeners = createListenerGroup();

    listeners.add(Events.FILE_TRANSCRIPTION_STARTED, () => {
      setIsDecoding(false);
      setIsTranscribing(true);
    });

    listeners.add<number>(Events.FILE_DECODE_PROGRESS, (event) => {
      setDecodeProgress(event.payload);
    });

    listeners.add<number>(Events.FILE_TRANSCRIPTION_PROGRESS, (event) => {
      setTranscriptionProgress(event.payload);
    });

    listeners.add<string>(Events.TRANSCRIPTION_COMPLETE, (event) => {
      if (!isFileTranscribingRef.current) return;
      setIsTranscribing(false);
      setIsCancelling(false);
      setTranscriptionProgress(0);
      setResult(event.payload);
    });

    listeners.add<string>(Events.TRANSCRIPTION_ERROR, (event) => {
      if (!isFileTranscribingRef.current) return;
      setIsDecoding(false);
      setIsTranscribing(false);
      setIsCancelling(false);
      setTranscriptionProgress(0);
      setError(event.payload);
    });

    listeners.add<string>(Events.FILE_TRANSCRIPTION_ERROR, (event) => {
      setIsDecoding(false);
      setIsTranscribing(false);
      setIsCancelling(false);
      setTranscriptionProgress(0);
      setError(event.payload);
    });

    return () => listeners.cleanup();
  }, []);

  const selectFile = useCallback(async () => {
    const path = await open({
      multiple: false,
      filters: [
        {
          name: "Audio Files",
          extensions: ["wav", "mp3", "flac", "ogg", "aac", "m4a", "aiff"],
        },
      ],
    });
    if (path) {
      setSelectedFile(path);
      // Extract filename from path
      const name = path.split(/[\\/]/).pop() || path;
      setSelectedFileName(name);
      setResult(null);
      setError(null);
    }
  }, []);

  const transcribe = useCallback(async () => {
    if (!selectedFile) return;
    setError(null);
    setResult(null);
    setIsDecoding(true);
    setDecodeProgress(0);
    setTranscriptionProgress(0);
    setIsCancelling(false);
    try {
      await invoke("transcribe_file", { path: selectedFile });
    } catch (e) {
      setIsDecoding(false);
      setError(String(e));
    }
  }, [selectedFile]);

  const cancel = useCallback(async () => {
    setIsCancelling(true);
    try {
      await invoke("cancel_file_transcription");
    } catch (e) {
      console.error("Failed to cancel:", e);
      setIsCancelling(false);
    }
  }, []);

  const enhance = useCallback(async () => {
    if (!result) return;
    setIsEnhancing(true);
    setError(null);
    try {
      const enhanced = await invoke<string>("enhance_text", { text: result });
      setResult(enhanced);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsEnhancing(false);
    }
  }, [result]);

  const copyResult = useCallback(async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
  }, [result]);

  const saveToFile = useCallback(async () => {
    if (!result || !selectedFile) return;
    const txtPath = selectedFile.replace(/\.[^.]+$/, ".txt");
    try {
      await invoke("save_text_file", { path: txtPath, contents: result });
    } catch (e) {
      setError(`Failed to save file: ${e}`);
    }
  }, [result, selectedFile]);

  const clear = useCallback(() => {
    setSelectedFile(null);
    setSelectedFileName(null);
    setIsDecoding(false);
    setIsTranscribing(false);
    setDecodeProgress(0);
    setTranscriptionProgress(0);
    setResult(null);
    setError(null);
    setIsEnhancing(false);
    setIsCancelling(false);
  }, []);

  return {
    selectedFile,
    selectedFileName,
    isDecoding,
    isTranscribing,
    decodeProgress,
    transcriptionProgress,
    result,
    error,
    isEnhancing,
    isCancelling,
    selectFile,
    transcribe,
    cancel,
    enhance,
    copyResult,
    saveToFile,
    clear,
  };
}
