/** Pretty display names for known model IDs and STT providers */
const DISPLAY_NAMES: Record<string, string> = {
  // Local Whisper models
  tiny: "Whisper Tiny",
  base: "Whisper Base",
  small: "Whisper Small",
  medium: "Whisper Medium",
  "parakeet-0.6b": "Parakeet 0.6B",
  // Online STT providers
  openai: "OpenAI",
  deepgram: "Deepgram",
  assemblyai: "AssemblyAI",
  mistral: "Mistral",
  elevenlabs: "ElevenLabs",
};

/** Format a raw model ID or provider name into a pretty display name */
export function formatModelName(raw: string): string {
  return DISPLAY_NAMES[raw] ?? capitalizeWords(raw);
}

function capitalizeWords(s: string): string {
  return s
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
