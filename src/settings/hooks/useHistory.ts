import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { createListenerGroup } from "@/shared/utils/tauriListeners";
import { HISTORY_ENTRY_ADDED } from "@/shared/constants/events";
import type { HistoryEntry } from "@/shared/types/history";

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<HistoryEntry[]>("get_history")
      .then(setEntries)
      .catch((e) => console.error("Failed to load history:", e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const listeners = createListenerGroup();
    listeners.add<HistoryEntry>(HISTORY_ENTRY_ADDED, (event) => {
      setEntries((prev) => [event.payload, ...prev]);
    });
    return () => listeners.cleanup();
  }, []);

  const deleteEntry = useCallback(async (id: number) => {
    await invoke("delete_history_entry", { id });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearAll = useCallback(async () => {
    await invoke("clear_history");
    setEntries([]);
  }, []);

  return { entries, loading, deleteEntry, clearAll };
}
