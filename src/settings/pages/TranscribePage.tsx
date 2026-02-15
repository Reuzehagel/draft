import { HugeiconsIcon } from "@hugeicons/react";
import {
  FileAudioIcon,
  Copy01Icon,
  FloppyDiskIcon,
  SparklesIcon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { STT_PROVIDER_LABELS } from "@/shared/constants/providers";
import { ErrorMessage } from "../components/ErrorMessage";
import type { FileTranscriptionState } from "../hooks/useFileTranscription";

interface TranscribePageProps {
  fileTranscription: FileTranscriptionState;
  whisperBusy: boolean;
  loadedModel: string | null;
  llmConfigured: boolean;
  sttProvider: string | null;
}

export function TranscribePage({
  fileTranscription: ft,
  whisperBusy,
  loadedModel,
  llmConfigured,
  sttProvider,
}: TranscribePageProps): React.ReactNode {
  const isOnline = !!sttProvider;
  const isBusy = ft.isDecoding || ft.isTranscribing || ft.isEnhancing;
  const canTranscribe = !!ft.selectedFile && !isBusy && (isOnline || (!whisperBusy && !!loadedModel));

  let buttonText = "Transcribe";
  if (ft.isDecoding) buttonText = isOnline ? "Uploading..." : "Decoding...";
  else if (ft.isTranscribing) buttonText = "Transcribing...";

  return (
    <div className="p-4 space-y-4 max-w-xl mx-auto">
      {/* File picker */}
      <div className="rounded-lg border border-border/60 bg-card/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 bg-muted/40">
          <h2 className="text-sm font-medium text-foreground">Transcribe Audio File</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isOnline
              ? `Transcribe using ${STT_PROVIDER_LABELS[sttProvider] ?? sttProvider}`
              : "Select an audio file to transcribe using Whisper"}
          </p>
        </div>
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={ft.selectFile}
              disabled={isBusy}
            >
              <HugeiconsIcon icon={FileAudioIcon} size={14} className="mr-1.5" />
              Select Audio File
            </Button>
            {ft.selectedFileName ? (
              <span className="text-sm text-foreground truncate">{ft.selectedFileName}</span>
            ) : (
              <span className="text-sm text-muted-foreground">No file selected</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Supported: WAV, MP3, FLAC, OGG, AAC, M4A, AIFF
          </p>

          {/* Transcribe button + progress */}
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={!canTranscribe}
              onClick={ft.transcribe}
            >
              {buttonText}
            </Button>
            {isBusy && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={ft.cancel}
                disabled={ft.isCancelling}
              >
                <HugeiconsIcon icon={Cancel01Icon} size={14} className="mr-1.5" />
                {ft.isCancelling ? "Cancelling..." : "Cancel"}
              </Button>
            )}
            {!isOnline && !loadedModel && (
              <span className="text-xs text-warning">No model loaded</span>
            )}
          </div>

          {/* Decode progress bar */}
          {ft.isDecoding && (
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-150"
                style={{ width: `${ft.decodeProgress}%` }}
              />
            </div>
          )}

          {/* Transcription progress bar */}
          {ft.isTranscribing && (
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              {ft.transcriptionProgress > 0 ? (
                <div
                  className="bg-primary h-1.5 rounded-full transition-all duration-150"
                  style={{ width: `${ft.transcriptionProgress}%` }}
                />
              ) : (
                <div className="bg-primary h-1.5 rounded-full animate-pulse w-full" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error display */}
      {ft.error && (
        <ErrorMessage message={ft.error} />
      )}

      {/* Result area */}
      {ft.result !== null && (
        <div className="rounded-lg border border-border/60 bg-card/80 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 bg-muted/40">
            <h2 className="text-sm font-medium text-foreground">Transcription Result</h2>
          </div>
          <div className="px-4 py-3 space-y-3">
            <Textarea
              value={ft.result}
              readOnly
              rows={6}
              className="text-[13px] resize-y min-h-[100px]"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={ft.copyResult}
              >
                <HugeiconsIcon icon={Copy01Icon} size={14} className="mr-1.5" />
                Copy to Clipboard
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={ft.saveToFile}
              >
                <HugeiconsIcon icon={FloppyDiskIcon} size={14} className="mr-1.5" />
                Save as .txt
              </Button>
              {llmConfigured && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={ft.enhance}
                  disabled={ft.isEnhancing}
                >
                  <HugeiconsIcon icon={SparklesIcon} size={14} className="mr-1.5" />
                  {ft.isEnhancing ? "Enhancing..." : "Enhance with AI"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
