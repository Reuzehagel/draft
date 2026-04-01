import { useState } from "react";
import { SubTabBar, type MoreSubPage } from "../components/SubTabBar";
import { PostProcessPage } from "./PostProcessPage";
import { AdvancedPage } from "./AdvancedPage";
import { HistoryPage } from "./HistoryPage";
import { TranscribePage } from "./TranscribePage";
import { InfoPage } from "./InfoPage";
import type { Config } from "@/shared/types/config";
import type { FileTranscriptionState } from "../hooks/useFileTranscription";
import type { UpdateStatus } from "@/shared/types/updater";

interface MorePageProps {
  config: Config | null;
  updateConfig: (updates: Partial<Config>) => void;
  isDark: boolean;
  toggleDarkMode: () => void;
  fileTranscription: FileTranscriptionState;
  whisperBusy: boolean;
  loadedModel: string | null;
  llmConfigured: boolean;
  sttProvider: string | null;
  updateStatus: UpdateStatus;
}

export function MorePage({
  config,
  updateConfig,
  isDark,
  toggleDarkMode,
  fileTranscription,
  whisperBusy,
  loadedModel,
  llmConfigured,
  sttProvider,
  updateStatus,
}: MorePageProps): React.ReactNode {
  const [activeSub, setActiveSub] = useState<MoreSubPage>("post-process");

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="px-5">
        <SubTabBar activeSub={activeSub} onNavigate={setActiveSub} />
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5" style={{ scrollbarGutter: "stable" }}>
        {activeSub === "post-process" && (
          <PostProcessPage config={config} updateConfig={updateConfig} />
        )}
        {activeSub === "advanced" && (
          <AdvancedPage config={config} updateConfig={updateConfig} isDark={isDark} toggleDarkMode={toggleDarkMode} />
        )}
        {activeSub === "history" && (
          <HistoryPage config={config} updateConfig={updateConfig} />
        )}
        {activeSub === "transcribe" && (
          <TranscribePage
            fileTranscription={fileTranscription}
            whisperBusy={whisperBusy}
            loadedModel={loadedModel}
            llmConfigured={llmConfigured}
            sttProvider={sttProvider}
          />
        )}
        {activeSub === "about" && <InfoPage updateStatus={updateStatus} />}
      </div>
    </div>
  );
}

