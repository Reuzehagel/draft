import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { UPDATE_STATUS } from "@/shared/constants/events";
import type { UpdateStatus } from "@/shared/types/updater";

export function useUpdateStatus(): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>({ status: "idle" });

  useEffect(() => {
    // Hydrate current state on mount (handles window reopen)
    invoke<UpdateStatus>("get_update_status").then(setStatus).catch(() => {});

    // Listen for live state transitions
    const unlisten = listen<UpdateStatus>(UPDATE_STATUS, (event) => {
      setStatus(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return status;
}
