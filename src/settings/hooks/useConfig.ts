import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Config } from "@/shared/types/config";

const CONFIG_SAVE_DEBOUNCE_MS = 300;

export function useConfig() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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
        invoke("set_config", { config: newConfig });
      }, CONFIG_SAVE_DEBOUNCE_MS);
    },
    []
  );

  return { config, updateConfig, loading };
}
