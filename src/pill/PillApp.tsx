import { useState, useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import Spinner from "./components/Spinner";
import Waveform from "./components/Waveform";
import * as Events from "@/shared/constants/events";

type PillState = "idle" | "loading" | "recording" | "transcribing" | "error";

/** Cleanup function for multiple event listeners */
function cleanupListeners(listeners: Promise<UnlistenFn>[]): void {
  listeners.forEach((unlisten) => unlisten.then((fn) => fn()));
}

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
    const listeners = [
      listen<number[]>(Events.AMPLITUDE, (event) => {
        setAmplitudes(event.payload);
      }),
      listen(Events.RECORDING_STARTED, () => {
        setState("recording");
        setVisible(true);
      }),
      listen(Events.RECORDING_STOPPED, () => {
        setState("transcribing");
      }),
      listen(Events.MODEL_LOADING, () => {
        setState("loading");
        setVisible(true);
      }),
      listen(Events.MODEL_LOADED, () => {
        setState("idle");
        setVisible(false);
      }),
      listen(Events.TRANSCRIPTION_COMPLETE, () => {
        setState("idle");
        setVisible(false);
        setAmplitudes(undefined);
      }),
      listen<string>(Events.TRANSCRIPTION_ERROR, (event) => {
        setState("error");
        setErrorMessage(event.payload);
        setVisible(true);
        setTimeout(() => {
          setState("idle");
          setVisible(false);
          setErrorMessage(undefined);
        }, 2000);
      }),
    ];

    return () => cleanupListeners(listeners);
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
