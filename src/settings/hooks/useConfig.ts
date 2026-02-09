import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Config } from "@/shared/types/config";

const CONFIG_SAVE_DEBOUNCE_MS = 300;
const SAVED_INDICATOR_MS = 1500;

export function useConfig() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const configRef = useRef<Config | null>(null);

  useEffect(() => {
    invoke<Config>("get_config")
      .then((c) => {
        setConfig(c);
        configRef.current = c;
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
      }
      if (savedTimeoutRef.current !== undefined) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  const updateConfig = useCallback(
    (updates: Partial<Config>) => {
      const current = configRef.current;
      if (!current) return;
      const newConfig = { ...current, ...updates };
      setConfig(newConfig);
      configRef.current = newConfig;

      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        invoke("set_config", { config: newConfig })
          .then(() => {
            setSaved(true);
            if (savedTimeoutRef.current !== undefined) {
              clearTimeout(savedTimeoutRef.current);
            }
            savedTimeoutRef.current = setTimeout(() => setSaved(false), SAVED_INDICATOR_MS);
          })
          .catch((e) => {
            console.error("Failed to save config:", e);
          });
      }, CONFIG_SAVE_DEBOUNCE_MS);
    },
    []
  );

  return { config, updateConfig, loading, saved };
}
