import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import Spinner from "./components/Spinner";
import Waveform from "./components/Waveform";
import * as Events from "@/shared/constants/events";

type PillState = "idle" | "loading" | "recording" | "transcribing" | "error";

interface PillContentProps {
  state: PillState;
  errorMessage?: string;
  amplitudes?: number[];
}

function PillContent({ state, errorMessage, amplitudes }: PillContentProps) {
  switch (state) {
    case "loading":
      return (
        <>
          <Spinner className="text-white/80" />
          <span className="text-white/80">Loading model...</span>
        </>
      );

    case "recording":
      return <Waveform amplitudes={amplitudes} />;

    case "transcribing":
      return (
        <>
          <Spinner className="text-white/80" />
          <span className="text-white/80">Transcribing...</span>
        </>
      );

    case "error":
      return <span className="text-white">{errorMessage || "Error"}</span>;

    case "idle":
    default:
      return null;
  }
}

export default function PillApp() {
  const [state, setState] = useState<PillState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [amplitudes, setAmplitudes] = useState<number[]>();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Listen for amplitude updates during recording
    const unlistenAmplitude = listen<number[]>(Events.AMPLITUDE, (event) => {
      setAmplitudes(event.payload);
    });

    // Listen for recording state changes
    const unlistenRecordingStarted = listen(Events.RECORDING_STARTED, () => {
      setState("recording");
      setVisible(true);
    });

    const unlistenRecordingStopped = listen(Events.RECORDING_STOPPED, () => {
      setState("transcribing");
    });

    // Listen for model loading
    const unlistenModelLoading = listen(Events.MODEL_LOADING, () => {
      setState("loading");
      setVisible(true);
    });

    const unlistenModelLoaded = listen(Events.MODEL_LOADED, () => {
      setState("idle");
      setVisible(false);
    });

    // Listen for transcription complete
    const unlistenTranscriptionComplete = listen(
      Events.TRANSCRIPTION_COMPLETE,
      () => {
        setState("idle");
        setVisible(false);
        setAmplitudes(undefined);
      }
    );

    // Listen for errors
    const unlistenError = listen<string>(Events.TRANSCRIPTION_ERROR, (event) => {
      setState("error");
      setErrorMessage(event.payload);
      setVisible(true);

      // Auto-hide after 2 seconds
      setTimeout(() => {
        setState("idle");
        setVisible(false);
        setErrorMessage(undefined);
      }, 2000);
    });

    return () => {
      unlistenAmplitude.then((fn) => fn());
      unlistenRecordingStarted.then((fn) => fn());
      unlistenRecordingStopped.then((fn) => fn());
      unlistenModelLoading.then((fn) => fn());
      unlistenModelLoaded.then((fn) => fn());
      unlistenTranscriptionComplete.then((fn) => fn());
      unlistenError.then((fn) => fn());
    };
  }, []);

  // For development: cycle through states with keyboard
  useEffect(() => {
    if (import.meta.env.DEV) {
      const handleKeyDown = (e: KeyboardEvent) => {
        switch (e.key) {
          case "1":
            setState("loading");
            setVisible(true);
            break;
          case "2":
            setState("recording");
            setVisible(true);
            break;
          case "3":
            setState("transcribing");
            setVisible(true);
            break;
          case "4":
            setState("error");
            setErrorMessage("Test error");
            setVisible(true);
            break;
          case "0":
            setState("idle");
            setVisible(false);
            break;
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, []);

  if (!visible && state === "idle") {
    return null;
  }

  return (
    <div
      className={`pill-container ${state === "error" ? "error" : ""} ${
        visible ? "pill-enter-active" : "pill-exit-active"
      }`}
    >
      <PillContent
        state={state}
        errorMessage={errorMessage}
        amplitudes={amplitudes}
      />
    </div>
  );
}
