/**
 * Parse a raw API error string into a user-friendly message.
 * Handles patterns like: "STT API error 429 Too Many Requests: {json...}"
 */
export function parseApiError(raw: string): string {
  // Try to extract JSON body from "STT API error <status>: <json>"
  const jsonMatch = raw.match(/:\s*(\{.+\})\s*$/);
  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[1]);
      // OpenAI / Mistral style: { "error": { "message": "..." } }
      if (json.error?.message) return json.error.message;
      // Flat style: { "message": "..." }
      if (json.message) return json.message;
    } catch {
      // Not valid JSON, fall through
    }
  }

  // Try to extract status code and give a short message
  const statusMatch = raw.match(/(\d{3})\s+[\w\s]+:/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1], 10);
    if (status === 429) return "Rate limit exceeded — please wait and try again";
    if (status === 401) return "Invalid API key";
    if (status === 403) return "Access denied — check your API key permissions";
    if (status >= 500) return "Provider server error — try again later";
  }

  return raw;
}
