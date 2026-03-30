// Tier-based model picker configuration
// Maps 2 user-facing tiers to model IDs

export interface Tier {
  id: string;
  label: string;
  description: string;
  detail: string;
  modelId: string;
}

export const TIERS: Tier[] = [
  {
    id: "fast",
    label: "Fast",
    description: "Lowest latency",
    detail: "~1 GB RAM, best for quick notes",
    modelId: "base",
  },
  {
    id: "accurate",
    label: "Accurate",
    description: "Best quality",
    detail: "~2 GB RAM, near Whisper Large accuracy",
    modelId: "parakeet-0.6b",
  },
];

/** Derive tier from a model ID. Returns null for models not in a tier. */
export function getTierFromModelId(modelId: string): Tier | null {
  return TIERS.find((t) => t.modelId === modelId) ?? null;
}
