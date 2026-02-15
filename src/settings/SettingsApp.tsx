import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { useDarkMode } from "./hooks/useDarkMode";
import { useConfig } from "./hooks/useConfig";
import { useHotkeyRegistration } from "./hooks/useHotkeyRegistration";
import { useMicrophones } from "./hooks/useMicrophones";
import { useMicrophoneTest } from "./hooks/useMicrophoneTest";
import { useModels } from "./useModels";
import { useWhisper } from "./useWhisper";
import { useFileTranscription } from "./hooks/useFileTranscription";
import { Sidebar, type Page } from "./components/Sidebar";
import { HomePage } from "./pages/HomePage";
import { TranscribePage } from "./pages/TranscribePage";
import { SettingsPage } from "./pages/SettingsPage";
import { HelpPage } from "./pages/HelpPage";
import { HistoryPage } from "./pages/HistoryPage";

export default function SettingsApp(): React.ReactNode {
  const [activePage, setActivePage] = useState<Page>("home");
  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const { config, updateConfig, loading, saved } = useConfig();
  const {
    microphones,
    loading: microphonesLoading,
    error: microphonesError,
  } = useMicrophones();
  const { isTesting, amplitudes: micTestAmplitudes, startTest } = useMicrophoneTest();
  const { registrationError: hotkeyError, isRegistering: hotkeyRegistering, validateAndRegister } = useHotkeyRegistration(config?.hotkey);
  const modelsHook = useModels();
  const whisperHook = useWhisper(config?.selected_model);
  const fileTranscription = useFileTranscription();
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    getVersion().then(setVersion);
  }, []);

  useEffect(() => {
    if (!loading && config && !config.selected_model && modelsHook.downloadedModels.length > 0) {
      updateConfig({ selected_model: modelsHook.downloadedModels[0].id });
    }
  }, [loading, config, modelsHook.downloadedModels, updateConfig]);

  // Signal to the backend that the frontend is ready to be shown
  useEffect(() => {
    if (!loading) {
      invoke("settings_ready");
    }
  }, [loading]);

  if (loading) {
    return null;
  }

  const llmConfigured = !!(
    config?.llm_provider &&
    config?.llm_api_key
  );

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        isDark={isDark}
        toggleDarkMode={toggleDarkMode}
        version={version}
        saved={saved}
      />

      <main className="flex-1 overflow-y-auto">
        {activePage === "home" && (
          <HomePage
            config={config}
            loadedModel={whisperHook.loadedModel}
            microphones={microphones}
          />
        )}
        {activePage === "transcribe" && (
          <TranscribePage
            fileTranscription={fileTranscription}
            whisperBusy={whisperHook.isBusy}
            loadedModel={whisperHook.loadedModel}
            llmConfigured={llmConfigured}
            sttProvider={config?.stt_provider ?? null}
          />
        )}
        {activePage === "help" && <HelpPage />}
        {activePage === "settings" && (
          <SettingsPage
            config={config}
            updateConfig={updateConfig}
            microphones={microphones}
            microphonesLoading={microphonesLoading}
            microphonesError={microphonesError}
            isTesting={isTesting}
            micTestAmplitudes={micTestAmplitudes}
            startTest={startTest}
            hotkeyError={hotkeyError}
            hotkeyRegistering={hotkeyRegistering}
            validateAndRegister={validateAndRegister}
            modelsHook={modelsHook}
            whisperHook={whisperHook}
            onNavigate={setActivePage}
          />
        )}
        {activePage === "history" && <HistoryPage />}
      </main>
    </div>
  );
}
