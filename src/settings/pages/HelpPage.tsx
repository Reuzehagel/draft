import { Fragment, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Tick02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { SettingsCard } from "../components/SettingsCard";
import { TabBar } from "../components/TabBar";

type HelpTab = "overview" | "local" | "online";

const HELP_TABS: { id: HelpTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "local", label: "Local Models" },
  { id: "online", label: "Online Providers" },
];

const COMPARISON_ROWS = [
  { aspect: "Privacy", local: "Audio never leaves your PC", online: "Audio sent to cloud API" },
  { aspect: "Cost", local: "Free (one-time download)", online: "Pay per minute of audio" },
  { aspect: "Internet", local: "Works offline", online: "Requires connection" },
  { aspect: "Speed", local: "Depends on your hardware", online: "Fast (cloud GPUs)" },
  { aspect: "Accuracy", local: "Good, improves with larger models", online: "Generally higher" },
  { aspect: "Features", local: "Basic transcription", online: "Diarization, formatting" },
] as const;

const LOCAL_MODELS = [
  {
    name: "Tiny",
    size: "77.7 MB",
    ram: "~1 GB RAM",
    description: "Fastest, lowest accuracy. Good for quick notes where speed matters more than perfection.",
  },
  {
    name: "Base",
    size: "148 MB",
    ram: "~2 GB RAM",
    description: "Good balance of speed and accuracy. Recommended starting point for most users.",
  },
  {
    name: "Small",
    size: "488 MB",
    ram: "~3 GB RAM",
    description: "Noticeably better accuracy. Great for longer dictation sessions.",
  },
  {
    name: "Medium",
    size: "1.5 GB",
    ram: "~4 GB RAM",
    description: "Best local accuracy but slowest. Use when accuracy matters most.",
  },
] as const;

const ONLINE_PROVIDERS = [
  {
    name: "OpenAI",
    model: "whisper-1",
    pricing: "$0.006/min (~$0.36/hr)",
    freeTier: "None",
    wer: "~6.5%",
    highlights: [
      "Well-known, reliable, simple API",
      "gpt-4o-transcribe available at same price",
      "gpt-4o-mini-transcribe at half price ($0.003/min)",
    ],
    notes: "whisper-1 has no diarization; gpt-4o-transcribe does",
  },
  {
    name: "Deepgram",
    model: "nova-3",
    pricing: "$0.0077/min (~$0.46/hr)",
    freeTier: "$200 free credits (~430 hrs)",
    wer: "~8.1%",
    highlights: [
      "Very fast response times",
      "Speaker diarization",
      "Smart formatting",
    ],
    notes: "Generous free credits to try before committing",
  },
  {
    name: "AssemblyAI",
    model: "best",
    pricing: "$0.0025/min (~$0.15/hr)",
    freeTier: "$50 free credits (~185 hrs)",
    wer: "~5.9%",
    highlights: [
      "Highest accuracy (Universal-3 Pro)",
      "Speaker diarization",
      "Low hallucination rate",
    ],
    notes: "Uses polling (slightly slower response). Add-on features cost extra",
  },
  {
    name: "Mistral",
    model: "voxtral-mini-latest",
    pricing: "$0.003/min batch (~$0.18/hr)",
    freeTier: "Free Experiment plan (rate-limited)",
    wer: "~4% (FLEURS benchmark)",
    highlights: [
      "Cheapest batch pricing",
      "Speaker diarization",
      "13 languages, open-source model",
    ],
    notes: "Newest entrant (Feb 2026), rapidly improving",
  },
  {
    name: "ElevenLabs",
    model: "scribe_v1",
    pricing: "~$0.0067/min (~$0.40/hr)",
    freeTier: "Limited free plan (10k credits/mo)",
    wer: "~6.5%",
    highlights: [
      "Speaker diarization",
      "High accuracy",
      "Also offers text-to-speech",
    ],
    notes: "Pricing varies by subscription tier",
  },
] as const;

const RECOMMENDATIONS = [
  {
    label: "Just want it to work",
    pick: "Local Base (English)",
    reason: "Free, no setup, good accuracy for everyday dictation",
  },
  {
    label: "Best accuracy, no budget",
    pick: "AssemblyAI or Mistral",
    reason: "Lowest word error rates across benchmarks",
  },
  {
    label: "Best value online",
    pick: "Mistral ($0.003/min) or AssemblyAI ($0.0025/min)",
    reason: "Cheapest per-minute with great accuracy",
  },
  {
    label: "Privacy first",
    pick: "Local Small",
    reason: "Strong accuracy without sending audio to the cloud",
  },
  {
    label: "Try online for free",
    pick: "Deepgram ($200 free) or AssemblyAI ($50 free)",
    reason: "Generous trial budgets to evaluate quality",
  },
  {
    label: "Multiple languages",
    pick: "Local Small (multilingual) or Mistral",
    reason: "Good multilingual support without sacrificing quality",
  },
] as const;

export function HelpPage(): React.ReactNode {
  const [activeTab, setActiveTab] = useState<HelpTab>("overview");

  return (
    <div className="flex flex-col h-full">
      <TabBar tabs={HELP_TABS} activeTab={activeTab} onChange={setActiveTab} />
      <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
        <div className="p-4 space-y-3 max-w-xl mx-auto">
          {activeTab === "overview" && (
            <>
              <SettingsCard
                title="Local vs Online"
                description="Key differences between running Whisper locally and using a cloud provider"
              >
                <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-2 text-sm">
                  <div className="font-medium text-muted-foreground">Aspect</div>
                  <div className="font-medium text-muted-foreground">Local (Whisper)</div>
                  <div className="font-medium text-muted-foreground">Online</div>
                  {COMPARISON_ROWS.map((row, i) => (
                    <Fragment key={row.aspect}>
                      <div className={`text-foreground font-medium -mx-1 px-1 rounded-sm ${i % 2 === 1 ? "bg-muted/40" : ""}`}>{row.aspect}</div>
                      <div className={`text-muted-foreground -mx-1 px-1 rounded-sm ${i % 2 === 1 ? "bg-muted/40" : ""}`}>{row.local}</div>
                      <div className={`text-muted-foreground -mx-1 px-1 rounded-sm ${i % 2 === 1 ? "bg-muted/40" : ""}`}>{row.online}</div>
                    </Fragment>
                  ))}
                </div>
              </SettingsCard>

              <SettingsCard
                title="Quick Recommendations"
                description="Best picks for common use cases"
              >
                <div className="space-y-3">
                  {RECOMMENDATIONS.map((rec) => (
                    <div key={rec.label} className="space-y-0.5 border-l-2 border-primary/20 pl-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-foreground">&ldquo;{rec.label}&rdquo;</span>
                        <span className="text-xs text-primary font-medium">{rec.pick}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{rec.reason}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed pt-2 border-t border-border/40">
                  Pricing and accuracy benchmarks are approximate and may change. Check each provider&rsquo;s website for current rates. WER numbers vary significantly depending on the test dataset — real-world audio with accents and background noise will have higher error rates than clean studio recordings. See{" "}
                  <a
                    href="https://artificialanalysis.ai/speech-to-text"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground transition-colors"
                  >
                    artificialanalysis.ai/speech-to-text
                  </a>{" "}
                  for deeper comparisons.
                </p>
              </SettingsCard>
            </>
          )}

          {activeTab === "local" && (
            <SettingsCard
              title="Local Whisper Models"
              description="Download size, RAM usage, and accuracy tradeoffs"
            >
              <div className="space-y-3">
                {LOCAL_MODELS.map((model) => (
                  <div key={model.name} className="flex items-start gap-3">
                    <Badge variant="outline" className="shrink-0 mt-0.5 font-mono text-[10px]">
                      {model.size}
                    </Badge>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{model.name}</span>
                        <span className="text-xs text-muted-foreground">{model.ram}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{model.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground flex items-start gap-1.5 pt-1">
                <HugeiconsIcon icon={InformationCircleIcon} size={14} className="shrink-0 mt-0.5" />
                <span>Each size has multilingual and English-only variants. English-only models are slightly more accurate for English speech.</span>
              </p>
            </SettingsCard>
          )}

          {activeTab === "online" && (
            <SettingsCard
              title="Online Providers"
              description="Pricing, accuracy, and features for each cloud STT provider"
            >
              <div className="divide-y divide-border/30 [&>*]:py-4 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
                {ONLINE_PROVIDERS.map((provider) => (
                  <div key={provider.name} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{provider.name}</span>
                      <Badge variant="secondary" className="text-[10px] font-mono">
                        {provider.model}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground pl-0.5">
                      <span>Pricing: {provider.pricing}</span>
                      <span>English WER: {provider.wer}</span>
                      <span>Free tier: {provider.freeTier}</span>
                    </div>

                    <ul className="space-y-0.5 pl-0.5">
                      {provider.highlights.map((highlight) => (
                        <li key={highlight} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <HugeiconsIcon icon={Tick02Icon} size={12} className="shrink-0 mt-0.5 text-success" />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>

                    <p className="text-xs text-muted-foreground flex items-start gap-1.5 pl-0.5">
                      <HugeiconsIcon icon={InformationCircleIcon} size={12} className="shrink-0 mt-0.5" />
                      <span>{provider.notes}</span>
                    </p>
                  </div>
                ))}
              </div>
            </SettingsCard>
          )}
        </div>
      </div>
    </div>
  );
}
