import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { createListenerGroup } from "@/shared/utils/tauriListeners";
import * as Events from "@/shared/constants/events";

export function useMicrophoneTest() {
  const [isTesting, setIsTesting] = useState(false);
  const [amplitudes, setAmplitudes] = useState<number[]>([]);

  useEffect(() => {
    const listeners = createListenerGroup();

    listeners.add<number[]>(Events.AMPLITUDE, (event) => {
      setAmplitudes(event.payload);
    });

    listeners.add<boolean>(Events.TEST_MICROPHONE_COMPLETE, () => {
      setIsTesting(false);
      setAmplitudes([]);
    });

    return () => listeners.cleanup();
  }, []);

  const startTest = useCallback((deviceId: string | null) => {
    if (isTesting) return;
    setIsTesting(true);
    setAmplitudes([]);
    invoke("test_microphone", { deviceId: deviceId || null }).catch((e) => {
      console.error("Test microphone failed:", e);
      setIsTesting(false);
    });
  }, [isTesting]);

  return { isTesting, amplitudes, startTest };
}
