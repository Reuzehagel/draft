import { HugeiconsIcon } from "@hugeicons/react";
import {
  Tick02Icon,
  Alert02Icon,
  Mic01Icon,
  KeyboardIcon,
  Package01Icon,
  SparklesIcon,
  AudioBook01Icon,
} from "@hugeicons/core-free-icons";
import type { Config } from "@/shared/types/config";
import { STT_PROVIDER_LABELS } from "@/shared/constants/providers";

interface HomePageProps {
  config: Config | null;
  loadedModel: string | null;
  microphones: Array<{ id: string; name: string }>;
}

function StatusRow({
  icon,
  label,
  value,
  ok,
}: {
  icon: typeof Mic01Icon;
  label: string;
  value: string;
  ok: boolean;
}): React.ReactNode {
  return (
    <div className={`flex items-center gap-3 py-2.5 px-3 ${ok ? "bg-success/[0.03]" : "bg-warning/[0.05]"}`}>
      <div className="text-muted-foreground/60">
        <HugeiconsIcon icon={icon} size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{value}</p>
      </div>
      <HugeiconsIcon
        icon={ok ? Tick02Icon : Alert02Icon}
        size={14}
        className={ok ? "text-success" : "text-warning"}
      />
    </div>
  );
}

export function HomePage({ config, loadedModel, microphones }: HomePageProps): React.ReactNode {
  const sttProvider = config?.stt_provider;
  const isOnlineStt = !!sttProvider;

  const modelValue = isOnlineStt
    ? (STT_PROVIDER_LABELS[sttProvider] ?? sttProvider)
    : (loadedModel || "No model loaded");
  const modelOk = isOnlineStt || !!loadedModel;

  const hotkeyValue = config?.hotkey || "Not configured";
  const hotkeyOk = !!config?.hotkey;

  const selectedMic = config?.microphone_id
    ? microphones.find((m) => m.id === config.microphone_id)
    : null;
  const micValue = selectedMic?.name || "System default";

  const llmProvider = config?.llm_provider;
  const llmValue = llmProvider
    ? llmProvider.charAt(0).toUpperCase() + llmProvider.slice(1)
    : "Not configured";

  return (
    <div className="p-4 space-y-3 max-w-xl mx-auto">
      <div className="rounded-lg border border-border/60 bg-card/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 bg-muted/40">
          <h2 className="text-sm font-medium text-foreground">Status</h2>
          <p className="text-xs text-muted-foreground mt-0.5">At-a-glance readiness</p>
        </div>
        <div className="divide-y divide-border/40">
          <StatusRow
            icon={isOnlineStt ? AudioBook01Icon : Package01Icon}
            label={isOnlineStt ? "Transcription" : "Model"}
            value={modelValue}
            ok={modelOk}
          />
          <StatusRow icon={KeyboardIcon} label="Hotkey" value={hotkeyValue} ok={hotkeyOk} />
          <StatusRow icon={Mic01Icon} label="Microphone" value={micValue} ok={true} />
          <StatusRow icon={SparklesIcon} label="AI Enhancement" value={llmValue} ok={true} />
        </div>
      </div>
    </div>
  );
}
