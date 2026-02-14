import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { createListenerGroup } from "@/shared/utils/tauriListeners";
import Spinner from "./components/Spinner";
import Waveform from "./components/Waveform";
import * as Events from "@/shared/constants/events";

type PillState = "idle" | "loading" | "recording" | "transcribing" | "enhancing" | "confirming" | "error";

const ERROR_DISPLAY_MS = 2000;

interface PillContentProps {
  state: PillState;
  errorMessage?: string;
  amplitudes?: number[];
  onConfirm?: () => void;
  onDecline?: () => void;
}

function PillContent({ state, errorMessage, amplitudes, onConfirm, onDecline }: PillContentProps) {
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

    case "enhancing":
      return (
        <>
          <Spinner className="text-white/80" />
          <span className="text-white/80">Enhancing...</span>
        </>
      );

    case "confirming":
      return (
        <>
          <span className="text-white/80">Enhance?</span>
          <button
            className="pill-confirm-btn pill-confirm-yes"
            onClick={onConfirm}
            autoFocus
          >
            Yes
          </button>
          <button
            className="pill-confirm-btn pill-confirm-no"
            onClick={onDecline}
          >
            No
          </button>
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

  // Refs for use inside event handlers (avoids stale closures with [] deps)
  const stateRef = useRef<PillState>("idle");
  useEffect(() => { stateRef.current = state; }, [state]);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleConfirm = useCallback(() => {
    if (stateRef.current !== "confirming") return;
    setState("enhancing");
    setContentKey((k) => k + 1);
    invoke("llm_confirm_response", { confirmed: true }).catch((e) =>
      console.error("Confirm failed:", e)
    );
  }, []);

  const handleDecline = useCallback(() => {
    if (stateRef.current !== "confirming") return;
    setState("idle");
    invoke("llm_confirm_response", { confirmed: false }).catch((e) =>
      console.error("Decline failed:", e)
    );
  }, []);

  useEffect(() => {
    const listeners = createListenerGroup();

    listeners.add<number[]>(Events.AMPLITUDE, (event) => {
      // Only process amplitude events during recording
      if (stateRef.current === "recording") {
        setAmplitudes(event.payload);
      }
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
    listeners.add(Events.LLM_PROCESSING, () => {
      setState("enhancing");
      setVisible(true);
      setContentKey((k) => k + 1);
    });
    listeners.add(Events.LLM_CONFIRM_REQUEST, () => {
      setState("confirming");
      setVisible(true);
      setContentKey((k) => k + 1);
    });
    listeners.add(Events.LLM_CONFIRM_TIMEOUT, () => {
      setState("idle");
    });
    listeners.add(Events.TRANSCRIPTION_COMPLETE, () => {
      // Don't hide the pill here — let Rust's hide_pill_after_delay control
      // the window visibility. This prevents a flicker when LLM processing
      // follows immediately (Rust emits LLM_PROCESSING right after this).
      setState("idle");
      setAmplitudes(undefined);
    });
    listeners.add<string>(Events.TRANSCRIPTION_ERROR, (event) => {
      setState("error");
      setErrorMessage(event.payload);
      setVisible(true);
      setContentKey((k) => k + 1);
      // Clear any previous error timeout to prevent stale dismissals
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = setTimeout(() => {
        // Only dismiss if still showing an error (a new event may have changed state)
        if (stateRef.current === "error") {
          setState("idle");
          setVisible(false);
          setErrorMessage(undefined);
        }
      }, ERROR_DISPLAY_MS);
    });

    return () => {
      listeners.cleanup();
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, []);

  // Keyboard handler for confirming state (Y/Enter = confirm, N/Escape = decline)
  useEffect(() => {
    if (state !== "confirming") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "y" || e.key === "Y" || e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === "n" || e.key === "N" || e.key === "Escape") {
        e.preventDefault();
        handleDecline();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state, handleConfirm, handleDecline]);

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
          case "5":
            setState("enhancing");
            setVisible(true);
            setContentKey((k) => k + 1);
            break;
          case "6":
            setState("confirming");
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
          onConfirm={handleConfirm}
          onDecline={handleDecline}
        />
      </div>
    </div>
  );
}
