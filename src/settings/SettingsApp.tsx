import React, { useState, useEffect } from "react";
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
import { useUpdateStatus } from "./hooks/useUpdateStatus";
import { TabBar, type TopPage } from "./components/TabBar";
import { UpdateCard } from "./components/UpdateCard";
import { GeneralPage } from "./pages/GeneralPage";
import { ModelsPage } from "./pages/ModelsPage";
import { HomePage } from "./pages/HomePage";
import { MorePage } from "./pages/MorePage";

export default function SettingsApp(): React.ReactNode {
  const [activePage, setActivePage] = useState<TopPage>("home");
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
  const whisperHook = useWhisper(config?.selected_model, config?.stt_provider);
  const fileTranscription = useFileTranscription();
  const [version, setVersion] = useState<string | null>(null);
  const updateStatus = useUpdateStatus();

  useEffect(() => {
    getVersion().then(setVersion);
  }, []);

  useEffect(() => {
    if (!loading && config && !config.selected_model && modelsHook.downloadedModels.length > 0) {
      updateConfig({ selected_model: modelsHook.downloadedModels[0].id });
    }
  }, [loading, config, modelsHook.downloadedModels, updateConfig]);

  useEffect(() => {
    if (!loading) {
      invoke("settings_ready");
    }
  }, [loading]);

  if (loading) {
    return null;
  }

  const llmConfigured = !!(config?.llm_provider && config?.llm_api_key);

  return (
    <div className="h-screen flex flex-col bg-background">
      <TabBar
        activePage={activePage}
        onNavigate={setActivePage}
        version={version}
      >
        <UpdateCard status={updateStatus} />
      </TabBar>

      {activePage === "more" ? (
        <div className="flex-1 overflow-hidden px-5">
          <MorePage
            config={config}
            updateConfig={updateConfig}
            isDark={isDark}
            toggleDarkMode={toggleDarkMode}
            version={version}
            fileTranscription={fileTranscription}
            whisperBusy={whisperHook.isBusy}
            loadedModel={whisperHook.loadedModel}
            llmConfigured={llmConfigured}
            sttProvider={config?.stt_provider ?? null}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
          <div className="px-5 py-5 max-w-lg mx-auto">
            {activePage === "home" && (
              <HomePage
                config={config}
                onNavigate={setActivePage}
                loadedModel={whisperHook.loadedModel}
                isModelLoading={whisperHook.isModelLoading}
                selectedModel={config?.selected_model ?? null}
              />
            )}
            {activePage === "general" && (
              <GeneralPage
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
              />
            )}
            {activePage === "models" && (
              <ModelsPage
                config={config}
                updateConfig={updateConfig}
                modelsHook={modelsHook}
                whisperHook={whisperHook}
                isTesting={isTesting}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
