import { HugeiconsIcon } from "@hugeicons/react";
import {
  FileAudioIcon,
  Copy01Icon,
  FloppyDiskIcon,
  SparklesIcon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { STT_PROVIDER_LABELS } from "@/shared/constants/providers";
import { SettingsCard } from "../components/SettingsCard";
import { ErrorMessage } from "../components/ErrorMessage";
import { SectionHeader } from "../components/SectionHeader";
import { SectionDivider } from "../components/SectionDivider";
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
    <div className="flex flex-col">
      <SectionHeader>Audio File</SectionHeader>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={ft.selectFile}
          disabled={isBusy}
        >
          <HugeiconsIcon icon={FileAudioIcon} size={14} data-icon="inline-start" />
          Select Audio File
        </Button>
        {ft.selectedFileName ? (
          <span className="text-sm text-foreground truncate">{ft.selectedFileName}</span>
        ) : (
          <span className="text-sm text-muted-foreground">No file selected</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Supported: WAV, MP3, FLAC, OGG, AAC, M4A, AIFF
      </p>

      <div className="flex items-center gap-3 mt-3">
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
            <HugeiconsIcon icon={Cancel01Icon} size={14} data-icon="inline-start" />
            {ft.isCancelling ? "Cancelling..." : "Cancel"}
          </Button>
        )}
        {!isOnline && !loadedModel && (
          <span className="text-xs text-warning">No model loaded</span>
        )}
      </div>

      {ft.isDecoding && <Progress value={ft.decodeProgress} className="h-1.5 mt-3" />}
      {ft.isTranscribing && (
        ft.transcriptionProgress > 0 ? (
          <Progress value={ft.transcriptionProgress} className="h-1.5 mt-3" />
        ) : (
          <div className="w-full overflow-hidden rounded-full h-1.5 bg-muted mt-3">
            <div className="bg-primary h-1.5 rounded-full animate-pulse w-full" />
          </div>
        )
      )}

      {ft.error && <ErrorMessage message={ft.error} />}

      {ft.result !== null && (
        <>
          <SectionDivider />
          <SettingsCard title="Result">
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
                <HugeiconsIcon icon={Copy01Icon} size={14} data-icon="inline-start" />
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={ft.saveToFile}
              >
                <HugeiconsIcon icon={FloppyDiskIcon} size={14} data-icon="inline-start" />
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
                  <HugeiconsIcon icon={SparklesIcon} size={14} data-icon="inline-start" />
                  {ft.isEnhancing ? "Enhancing..." : "Enhance"}
                </Button>
              )}
            </div>
          </SettingsCard>
        </>
      )}
    </div>
  );
}
