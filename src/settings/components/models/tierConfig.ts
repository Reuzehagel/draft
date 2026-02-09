// Tier-based model picker configuration
// Maps 3 user-facing tiers to Whisper model IDs

export interface Tier {
  id: string;
  label: string;
  description: string;
  detail: string;
  baseModelId: string;
}

export const TIERS: Tier[] = [
  {
    id: "fast",
    label: "Fast",
    description: "Lowest latency",
    detail: "~1 GB RAM, best for quick notes",
    baseModelId: "tiny",
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Speed + accuracy",
    detail: "~2 GB RAM, good for most uses",
    baseModelId: "base",
  },
  {
    id: "accurate",
    label: "Accurate",
    description: "Best quality",
    detail: "~3 GB RAM, best for longer text",
    baseModelId: "small",
  },
];

/** Derive tier from a model ID. Returns null for models not in a tier (e.g. medium). */
export function getTierFromModelId(modelId: string): Tier | null {
  const base = modelId.replace(".en", "");
  return TIERS.find((t) => t.baseModelId === base) ?? null;
}

/** Check if a model ID is English-only */
export function isEnglishOnly(modelId: string): boolean {
  return modelId.endsWith(".en");
}

/** Get the model ID for a tier + language preference */
export function getModelId(tier: Tier, englishOnly: boolean): string {
  return englishOnly ? `${tier.baseModelId}.en` : tier.baseModelId;
}
