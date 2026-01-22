// Model types - mirrors Rust stt::models module

export interface ModelInfo {
  id: string;
  name: string;
  size: number;
  downloaded: boolean;
}

export interface DownloadProgress {
  model: string;
  progress: number;
  downloaded_bytes: number;
  total_bytes: number;
}

/** Format bytes to human-readable size */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
