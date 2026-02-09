import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "./ErrorMessage";

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta"]);
const FUNCTION_KEY_PATTERN = /^F([1-9]|1[0-9]|2[0-4])$/;

interface HotkeyInputProps {
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string | null;
  onValidate?: (hotkey: string) => Promise<void>;
}

export function HotkeyInput({ value, onChange, error, onValidate }: HotkeyInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent) => {
      if (!isRecording) return;
      e.preventDefault();

      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      if (e.metaKey) parts.push("Meta");

      let keyName = e.key;
      if (keyName === " ") keyName = "Space";

      if (!keyName || MODIFIER_KEYS.has(keyName)) return;

      const normalizedKey = keyName.length === 1 ? keyName.toUpperCase() : keyName;
      parts.push(normalizedKey);

      const hotkey = parts.join("+");

      if (parts.length === 1 && !FUNCTION_KEY_PATTERN.test(normalizedKey)) {
        setValidationError(`'${normalizedKey}' requires a modifier key (Ctrl, Alt, Shift, or Meta)`);
        return;
      }

      try {
        await invoke("validate_hotkey", { hotkey });
        setValidationError(null);
        onChange(hotkey);
        setIsRecording(false);

        if (onValidate) {
          onValidate(hotkey).catch((err) => {
            setValidationError(String(err));
          });
        }
      } catch (err) {
        setValidationError(String(err));
      }
    },
    [isRecording, onChange, onValidate]
  );

  const displayError = error || validationError;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setIsRecording(!isRecording);
            if (!isRecording) setValidationError(null);
          }}
          onKeyDown={handleKeyDown}
          className={`
            flex-1 h-8 px-3 rounded-md text-[13px] font-mono text-left
            border transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1
            ${isRecording
              ? 'border-primary bg-primary/5 text-primary'
              : displayError
                ? 'border-destructive/50 bg-destructive/5'
                : 'border-input bg-background hover:bg-muted/50'
            }
          `}
        >
          {isRecording
            ? "Press keys..."
            : value || "Click to set hotkey"}
        </button>
        {value && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Clear hotkey"
            onClick={() => {
              onChange(null);
              setValidationError(null);
            }}
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </Button>
        )}
      </div>
      {displayError && <ErrorMessage message={displayError} />}
    </div>
  );
}
