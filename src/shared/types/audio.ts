// Audio-related types for the Draft application

/**
 * Information about an available microphone device
 */
export interface MicrophoneInfo {
  /** Device identifier (empty string for system default) */
  id: string;
  /** Human-readable device name */
  name: string;
}
