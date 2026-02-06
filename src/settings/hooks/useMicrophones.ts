import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { MicrophoneInfo } from "@/shared/types/audio";

export function useMicrophones() {
  const [microphones, setMicrophones] = useState<MicrophoneInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<MicrophoneInfo[]>("list_microphones")
      .then((mics) => {
        setMicrophones(mics);
        setError(null);
      })
      .catch((e) => {
        setError(String(e));
        setMicrophones([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return { microphones, loading, error };
}
