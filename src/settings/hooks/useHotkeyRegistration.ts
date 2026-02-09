import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useHotkeyRegistration(hotkey: string | null | undefined) {
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const previousHotkeyRef = useRef<string | null | undefined>(undefined);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Skip initial mount — backend already registers the hotkey on startup
    if (isInitialMount.current) {
      isInitialMount.current = false;
      previousHotkeyRef.current = hotkey;
      return;
    }

    if (previousHotkeyRef.current === hotkey) {
      return;
    }

    previousHotkeyRef.current = hotkey;

    const registerHotkey = async () => {
      setRegistrationError(null);

      if (!hotkey) {
        try {
          await invoke("unregister_hotkey");
        } catch (e) {
          console.warn("Failed to unregister hotkey:", e);
        }
        return;
      }

      setIsRegistering(true);
      try {
        await invoke("register_hotkey", { hotkey });
      } catch (e) {
        setRegistrationError(String(e));
      } finally {
        setIsRegistering(false);
      }
    };

    registerHotkey();
  }, [hotkey]);

  const validateAndRegister = useCallback(async (newHotkey: string) => {
    setRegistrationError(null);
    setIsRegistering(true);
    try {
      await invoke("register_hotkey", { hotkey: newHotkey });
    } catch (e) {
      setRegistrationError(String(e));
      throw e;
    } finally {
      setIsRegistering(false);
    }
  }, []);

  return { registrationError, isRegistering, validateAndRegister };
}
