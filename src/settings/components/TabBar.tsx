export type SettingsTab = "general" | "input" | "transcription" | "enhancement";

const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "input", label: "Input" },
  { id: "transcription", label: "Transcription" },
  { id: "enhancement", label: "Enhancement" },
];

interface TabBarProps<T extends string> {
  tabs: { id: T; label: string }[];
  activeTab: T;
  onChange: (tab: T) => void;
}

export function TabBar<T extends string>({ tabs, activeTab, onChange }: TabBarProps<T>): React.ReactNode {
  return (
    <div
      role="tablist"
      className="flex border-b border-border bg-background px-4 pt-2"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            className={`relative px-3 pb-2 text-sm font-medium transition-colors ${
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SettingsTabBar({ activeTab, onChange }: { activeTab: SettingsTab; onChange: (tab: SettingsTab) => void }): React.ReactNode {
  return <TabBar tabs={SETTINGS_TABS} activeTab={activeTab} onChange={onChange} />;
}
