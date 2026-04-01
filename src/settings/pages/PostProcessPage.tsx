import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Config } from "@/shared/types/config";
import { SettingRow } from "../components/SettingRow";
import { ApiKeyInput } from "../components/ApiKeyInput";
import { SectionHeader } from "../components/SectionHeader";
import { SectionDivider } from "../components/SectionDivider";

const LLM_DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
  openrouter: "openai/gpt-4o-mini",
  cerebras: "llama-4-scout-17b-16e-instruct",
  groq: "llama-3.3-70b-versatile",
};

const LLM_PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "cerebras", label: "Cerebras" },
  { value: "groq", label: "Groq" },
] as const;

const LLM_ITEMS = LLM_PROVIDERS.map((p) => ({ label: p.label, value: p.value }));

interface PostProcessPageProps {
  config: Config | null;
  updateConfig: (updates: Partial<Config>) => void;
}

export function PostProcessPage({ config, updateConfig }: PostProcessPageProps): React.ReactNode {
  return (
    <div className="flex flex-col gap-1.5">
      <SectionHeader>AI Enhancement</SectionHeader>

      <SettingRow label="Enable enhancement" description="Process text through an LLM before injection" inline>
        <Switch
          checked={config?.llm_auto_process || false}
          onCheckedChange={(llm_auto_process) => updateConfig({ llm_auto_process })}
        />
      </SettingRow>

      {config?.llm_auto_process && (
        <>
          <SectionDivider />
          <SectionHeader>LLM Settings</SectionHeader>

          <SettingRow label="Confirm before enhancing" description="Prompt Y/N before sending to LLM" inline>
            <Switch
              checked={config?.llm_confirm_before_processing || false}
              onCheckedChange={(llm_confirm_before_processing) =>
                updateConfig({ llm_confirm_before_processing })
              }
            />
          </SettingRow>

          <SettingRow label="Provider">
            <Select
              value={config?.llm_provider || ""}
              onValueChange={(value) => updateConfig({ llm_provider: value || null })}
              items={LLM_ITEMS}
            >
              <SelectTrigger className="w-full text-[13px]">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {LLM_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value} className="text-[13px]">
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          <ApiKeyInput
            value={config?.llm_api_key || ""}
            onChange={(llm_api_key) => updateConfig({ llm_api_key })}
          />

          <SettingRow label="Model" description="Leave empty for provider default">
            <Input
              type="text"
              value={config?.llm_model || ""}
              onChange={(e) => updateConfig({ llm_model: e.target.value || null })}
              placeholder={LLM_DEFAULT_MODELS[config?.llm_provider ?? ""] ?? "Provider default"}
              className="text-[13px]"
            />
          </SettingRow>

          <SettingRow label="Custom prompt" description="Override the default system prompt sent to the LLM">
            <Textarea
              value={config?.llm_system_prompt || ""}
              onChange={(e) => updateConfig({ llm_system_prompt: e.target.value || null })}
              placeholder="Leave empty for default prompt (light cleanup, preserve original words)"
              rows={3}
              className="text-[13px] min-h-[60px] resize-y"
            />
          </SettingRow>

          <p className="text-xs text-muted-foreground flex items-start gap-1.5 pt-1">
            <HugeiconsIcon icon={InformationCircleIcon} size={14} className="shrink-0 mt-0.5" />
            <span>Voice commands: start with an instruction like &ldquo;reply saying...&rdquo; or &ldquo;make this professional&rdquo;</span>
          </p>
        </>
      )}
    </div>
  );
}
