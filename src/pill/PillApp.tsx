import { useState, useEffect } from "react";
import { createListenerGroup } from "@/shared/utils/tauriListeners";
import Spinner from "./components/Spinner";
import Waveform from "./components/Waveform";
import * as Events from "@/shared/constants/events";

type PillState = "idle" | "loading" | "recording" | "transcribing" | "error";

const ERROR_DISPLAY_MS = 2000;

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
  // Content key: incremented on state changes to trigger remount + CSS enter animation
  const [contentKey, setContentKey] = useState(0);

  useEffect(() => {
    const listeners = createListenerGroup();

    listeners.add<number[]>(Events.AMPLITUDE, (event) => {
      setAmplitudes(event.payload);
    });
    listeners.add(Events.RECORDING_STARTED, () => {
      setState("recording");
      setVisible(true);
      setContentKey((k) => k + 1);
    });
    listeners.add(Events.RECORDING_STOPPED, () => {
      setState("transcribing");
      setContentKey((k) => k + 1);
    });
    listeners.add(Events.MODEL_LOADING, () => {
      setState("loading");
      setVisible(true);
      setContentKey((k) => k + 1);
    });
    listeners.add(Events.MODEL_LOADED, () => {
      setState("idle");
      setVisible(false);
    });
    listeners.add(Events.TRANSCRIPTION_COMPLETE, () => {
      setState("idle");
      setVisible(false);
      setAmplitudes(undefined);
    });
    listeners.add<string>(Events.TRANSCRIPTION_ERROR, (event) => {
      setState("error");
      setErrorMessage(event.payload);
      setVisible(true);
      setContentKey((k) => k + 1);
      setTimeout(() => {
        setState("idle");
        setVisible(false);
        setErrorMessage(undefined);
      }, ERROR_DISPLAY_MS);
    });

    return () => listeners.cleanup();
  }, []);

  // For development: cycle through states with keyboard
  useEffect(() => {
    if (import.meta.env.DEV) {
      const handleKeyDown = (e: KeyboardEvent) => {
        switch (e.key) {
          case "1":
            setState("loading");
            setVisible(true);
            setContentKey((k) => k + 1);
            break;
          case "2":
            setState("recording");
            setVisible(true);
            setContentKey((k) => k + 1);
            break;
          case "3":
            setState("transcribing");
            setVisible(true);
            setContentKey((k) => k + 1);
            break;
          case "4":
            setState("error");
            setErrorMessage("Test error");
            setVisible(true);
            setContentKey((k) => k + 1);
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

  // Container class: scale+fade entry/exit + smooth error color transition
  const containerClass = [
    "pill-container",
    state === "error" ? "error" : "",
    visible ? "pill-visible" : "pill-exit",
  ].filter(Boolean).join(" ");

  return (
    <div className={containerClass}>
      <div key={contentKey} className="pill-content pill-content-enter">
        <PillContent
          state={state}
          errorMessage={errorMessage}
          amplitudes={amplitudes}
        />
      </div>
    </div>
  );
}
