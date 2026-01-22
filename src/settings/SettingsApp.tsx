import { useState, useEffect, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { Config } from "@/shared/types/config";

// Whisper model definitions
const WHISPER_MODELS = [
  { id: "tiny", name: "Tiny", size: "75 MB" },
  { id: "base", name: "Base", size: "142 MB" },
  { id: "small", name: "Small", size: "466 MB" },
  { id: "medium", name: "Medium", size: "1.5 GB" },
  { id: "large-v3", name: "Large v3", size: "3.1 GB" },
];

function useConfig() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<Config>("get_config")
      .then(setConfig)
      .finally(() => setLoading(false));
  }, []);

  const updateConfig = useMemo(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (updates: Partial<Config>) => {
      if (!config) return;
      const newConfig = { ...config, ...updates };
      setConfig(newConfig);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        invoke("set_config", { config: newConfig });
      }, 300);
    };
  }, [config]);

  return { config, updateConfig, loading };
}

function SettingsSection({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <span>{icon}</span>
        {title}
      </h2>
      <div className="space-y-3 pl-6">{children}</div>
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border bg-background accent-primary"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function HotkeyInput({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isRecording) return;
      e.preventDefault();

      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      if (e.metaKey) parts.push("Meta");

      // Only accept modifier + regular key combinations
      if (e.key && !["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
        parts.push(e.key.toUpperCase());
        onChange(parts.join("+"));
        setIsRecording(false);
      }
    },
    [isRecording, onChange]
  );

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        className="min-w-[180px] justify-start font-mono text-xs"
        onClick={() => setIsRecording(!isRecording)}
        onKeyDown={handleKeyDown}
      >
        {isRecording
          ? "Press keys..."
          : value || "Click to set hotkey"}
      </Button>
      {value && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(null)}
        >
          Clear
        </Button>
      )}
    </div>
  );
}

export default function SettingsApp() {
  const { config, updateConfig, loading } = useConfig();

  // Placeholder microphone list - will be populated by backend in later sprint
  const microphones = [
    { id: "default", name: "Default Microphone" },
  ];

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-base font-semibold">Draft Settings</h1>
        <span className="text-xs text-muted-foreground">v0.1.0</span>
      </div>

      {/* Content */}
      <div className="space-y-6 p-4">
        {/* Audio Section */}
        <SettingsSection icon="🎤" title="Audio">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Microphone</label>
            <Select
              value={config?.microphone_id || "default"}
              onValueChange={(value) => updateConfig({ microphone_id: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select microphone" />
              </SelectTrigger>
              <SelectContent>
                {microphones.map((mic) => (
                  <SelectItem key={mic.id} value={mic.id}>
                    {mic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" disabled>
            Test Microphone
          </Button>
        </SettingsSection>

        <Separator />

        {/* Hotkey Section */}
        <SettingsSection icon="⌨️" title="Hotkey">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Push-to-talk</label>
            <HotkeyInput
              value={config?.hotkey || null}
              onChange={(hotkey) => updateConfig({ hotkey })}
            />
          </div>
        </SettingsSection>

        <Separator />

        {/* Models Section */}
        <SettingsSection icon="📦" title="Models">
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Downloaded:</p>
              <p className="text-sm text-muted-foreground/60 italic pl-2">
                (none)
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Available:</p>
              <div className="space-y-2 pl-2">
                {WHISPER_MODELS.map((model) => (
                  <div
                    key={model.id}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">
                      {model.name}{" "}
                      <span className="text-muted-foreground">
                        ({model.size})
                      </span>
                    </span>
                    <Button variant="outline" size="sm" disabled>
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SettingsSection>

        <Separator />

        {/* General Section */}
        <SettingsSection icon="⚙️" title="General">
          <div className="space-y-3">
            <Checkbox
              checked={config?.auto_start || false}
              onChange={(auto_start) => updateConfig({ auto_start })}
              label="Start with Windows"
            />
            <Checkbox
              checked={config?.trailing_space || false}
              onChange={(trailing_space) => updateConfig({ trailing_space })}
              label="Add space after text"
            />
            <Checkbox
              checked={config?.logging_enabled || false}
              onChange={(logging_enabled) => updateConfig({ logging_enabled })}
              label="Enable logging"
            />
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
