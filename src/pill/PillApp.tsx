import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { createListenerGroup } from "@/shared/utils/tauriListeners";
import { parseApiError } from "@/shared/utils/parseApiError";
import Spinner from "./components/Spinner";
import Waveform from "./components/Waveform";
import * as Events from "@/shared/constants/events";

type PillState = "idle" | "loading" | "recording" | "transcribing" | "enhancing" | "confirming" | "done" | "error";

const ERROR_DISPLAY_MS = 2000;
const DONE_DISPLAY_MS = 1000;
const EXIT_TRANSITION_MS = 150;

interface PillContentProps {
  state: PillState;
  errorMessage?: string;
  amplitudes?: number[];
  onConfirm?: () => void;
  onDecline?: () => void;
}

function SpinnerLabel({ text }: { text: string }): React.ReactNode {
  return (
    <span role="status" className="flex items-center gap-2">
      <Spinner className="text-white/80" />
      <span className="text-white/80">{text}</span>
    </span>
  );
}

function PillContent({ state, errorMessage, amplitudes, onConfirm, onDecline }: PillContentProps): React.ReactNode {
  switch (state) {
    case "loading":
      return <SpinnerLabel text="Loading model..." />;

    case "recording":
      return <Waveform amplitudes={amplitudes} />;

    case "transcribing":
      return <SpinnerLabel text="Transcribing..." />;

    case "enhancing":
      return <SpinnerLabel text="Enhancing..." />;

    case "confirming":
      return (
        <>
          <span className="text-white/80">Enhance?</span>
          <button
            className="pill-confirm-btn pill-confirm-yes"
            onClick={onConfirm}
            aria-label="Yes, enhance (Y)"
            autoFocus
          >
            Yes
          </button>
          <button
            className="pill-confirm-btn pill-confirm-no"
            onClick={onDecline}
            aria-label="No, skip (N)"
          >
            No
          </button>
        </>
      );

    case "error":
      return <span role="alert" className="text-white">{errorMessage || "Error"}</span>;

    case "done":
      return <span role="status" className="text-white/80">All done!</span>;

    case "idle":
    default:
      return null;
  }
}

export default function PillApp(): React.ReactNode {
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
  const doneTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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
    setVisible(false);
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
      setVisible(false);
    });
    listeners.add(Events.OUTPUT_COMPLETE, () => {
      setState("done");
      setVisible(true);
      setContentKey((k) => k + 1);
      if (doneTimeoutRef.current) clearTimeout(doneTimeoutRef.current);
      // After display time, trigger fade-out, then unmount after transition
      doneTimeoutRef.current = setTimeout(() => {
        if (stateRef.current === "done") {
          setVisible(false);
          doneTimeoutRef.current = setTimeout(() => {
            if (stateRef.current === "done") {
              setState("idle");
            }
          }, EXIT_TRANSITION_MS);
        }
      }, DONE_DISPLAY_MS);
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
      setErrorMessage(parseApiError(event.payload));
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
      if (doneTimeoutRef.current) clearTimeout(doneTimeoutRef.current);
    };
  }, []);

  // Keyboard handler for confirming state (Y/Enter = confirm, N/Escape = decline)
  useEffect(() => {
    if (state !== "confirming") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const focused = document.activeElement;
        if (focused?.classList.contains("pill-confirm-no")) {
          handleDecline();
        } else {
          handleConfirm();
        }
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === "n" || e.key === "N" || e.key === "Escape") {
        e.preventDefault();
        handleDecline();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const buttons = document.querySelectorAll<HTMLButtonElement>(".pill-confirm-btn");
        const targetIndex = e.key === "ArrowRight" ? 1 : 0;
        buttons[targetIndex]?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state, handleConfirm, handleDecline]);

  // For development: cycle through states with keyboard
  useEffect(() => {
    if (import.meta.env.DEV) {
      const devStates: Record<string, PillState> = {
        "1": "loading",
        "2": "recording",
        "3": "transcribing",
        "4": "error",
        "5": "enhancing",
        "6": "confirming",
        "7": "done",
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        const targetState = devStates[e.key];
        if (targetState) {
          setState(targetState);
          setVisible(true);
          setContentKey((k) => k + 1);
          if (targetState === "error") setErrorMessage("Test error");
        } else if (e.key === "0") {
          setState("idle");
          setVisible(false);
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, []);

  if (!visible && state === "idle") {
    return null;
  }

  const stateClass = state === "error" || state === "done" ? state : "";
  const containerClass = [
    "pill-container",
    stateClass,
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
