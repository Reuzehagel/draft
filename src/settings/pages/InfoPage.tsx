import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Tick02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { SettingsCard } from "../components/SettingsCard";
import { PageHeader } from "../components/PageHeader";

type InfoTab = "overview" | "local" | "online";

const INFO_TABS: { id: InfoTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "local", label: "Local" },
  { id: "online", label: "Online" },
];

const COMPARISON_ROWS = [
  { aspect: "Privacy", local: "Audio stays on device", online: "Audio sent to cloud" },
  { aspect: "Cost", local: "Free", online: "Pay per minute" },
  { aspect: "Internet", local: "Works offline", online: "Required" },
  { aspect: "Speed", local: "Hardware-dependent", online: "Fast (cloud GPUs)" },
  { aspect: "Accuracy", local: "Good with larger models", online: "Generally higher" },
  { aspect: "Features", local: "Basic transcription", online: "Diarization, formatting" },
] as const;

const LOCAL_MODELS = [
  { name: "Tiny", size: "77.7 MB", ram: "~1 GB", description: "Fastest, lowest accuracy. Good for quick notes." },
  { name: "Base", size: "148 MB", ram: "~2 GB", description: "Good balance. Recommended starting point." },
  { name: "Small", size: "488 MB", ram: "~3 GB", description: "Better accuracy for longer dictation." },
  { name: "Medium", size: "1.5 GB", ram: "~4 GB", description: "Best local accuracy but slowest." },
] as const;

const ONLINE_PROVIDERS = [
  {
    name: "ElevenLabs", model: "scribe_v1",
    pricing: "~$0.0067/min", freeTier: "Limited free plan", wer: "~3.2%",
    highlights: ["Excellent accuracy", "Speaker diarization", "Scribe v2 at ~2.3% WER"],
    notes: "Pricing varies by subscription tier",
  },
  {
    name: "AssemblyAI", model: "best",
    pricing: "$0.0025/min", freeTier: "$50 free credits", wer: "~3.3%",
    highlights: ["Top-tier accuracy (Universal-3 Pro)", "Speaker diarization", "Low hallucination rate"],
    notes: "Uses polling (slightly slower). Add-on features cost extra",
  },
  {
    name: "Mistral", model: "voxtral-mini-latest",
    pricing: "$0.003/min", freeTier: "Free plan (rate-limited)", wer: "~3.6%",
    highlights: ["Cheapest batch pricing", "Speaker diarization", "13 languages"],
    notes: "Voxtral Small available at ~3.0% WER",
  },
  {
    name: "OpenAI", model: "whisper-1",
    pricing: "$0.006/min", freeTier: "None", wer: "~4.3%",
    highlights: ["Reliable, simple API", "gpt-4o-transcribe at ~4.1% WER", "gpt-4o-mini-transcribe at half price"],
    notes: "whisper-1 has no diarization; gpt-4o models do",
  },
  {
    name: "Deepgram", model: "nova-3",
    pricing: "$0.0077/min", freeTier: "$200 free credits", wer: "~6.5%",
    highlights: ["Very fast response times", "Speaker diarization", "Smart formatting"],
    notes: "Generous free credits to try before committing",
  },
] as const;

interface InfoPageProps {
  version: string | null;
}

export function InfoPage({ version }: InfoPageProps): React.ReactNode {
  const [activeTab, setActiveTab] = useState<InfoTab>("overview");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Info"
        description={version ? `Draft v${version}` : "Draft"}
      />

      <div className="flex gap-1">
        {INFO_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <SettingsCard title="Local vs Online" description="Key differences">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px]">Aspect</TableHead>
                <TableHead>Local (Whisper)</TableHead>
                <TableHead>Online</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {COMPARISON_ROWS.map((row) => (
                <TableRow key={row.aspect}>
                  <TableCell className="font-medium">{row.aspect}</TableCell>
                  <TableCell className="text-muted-foreground">{row.local}</TableCell>
                  <TableCell className="text-muted-foreground">{row.online}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SettingsCard>
      )}

      {activeTab === "local" && (
        <SettingsCard title="Local Whisper Models" description="Download size, RAM usage, and accuracy tradeoffs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>RAM</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {LOCAL_MODELS.map((model) => (
                <TableRow key={model.name}>
                  <TableCell className="font-medium">{model.name}</TableCell>
                  <TableCell>{model.size}</TableCell>
                  <TableCell>{model.ram}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-normal">{model.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <HugeiconsIcon icon={InformationCircleIcon} size={14} className="shrink-0 mt-0.5" />
            <span>Each size has multilingual and English-only variants.</span>
          </p>
        </SettingsCard>
      )}

      {activeTab === "online" && (
        <SettingsCard title="Online Providers" description="Cost, accuracy, and features at a glance">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Cost/min</TableHead>
                <TableHead>WER</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ONLINE_PROVIDERS.map((provider) => (
                <TableRow key={provider.name}>
                  <TableCell className="font-medium">{provider.name}</TableCell>
                  <TableCell>{provider.pricing}</TableCell>
                  <TableCell>{provider.wer}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Accordion>
            {ONLINE_PROVIDERS.map((provider) => (
              <AccordionItem key={provider.name} value={provider.name}>
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <span>{provider.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {provider.model}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-2 text-muted-foreground">
                    <div className="flex gap-3 text-xs">
                      <span>Pricing: {provider.pricing}</span>
                      <span>Free: {provider.freeTier}</span>
                    </div>
                    <ul className="flex flex-col gap-0.5">
                      {provider.highlights.map((h) => (
                        <li key={h} className="flex items-start gap-1.5 text-xs">
                          <HugeiconsIcon icon={Tick02Icon} size={12} className="shrink-0 mt-0.5 text-success" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs flex items-start gap-1.5">
                      <HugeiconsIcon icon={InformationCircleIcon} size={12} className="shrink-0 mt-0.5" />
                      <span>{provider.notes}</span>
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <p className="text-[11px] text-muted-foreground/70 leading-relaxed pt-2 border-t border-border/40">
            WER from{" "}
            <a
              href="https://artificialanalysis.ai/speech-to-text"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground transition-colors"
            >
              Artificial Analysis
            </a>
            {" "}(AA-WER v2.0). Real-world audio may have higher error rates.
          </p>
        </SettingsCard>
      )}
    </div>
  );
}
