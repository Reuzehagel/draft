export type SettingsTab = "general" | "input" | "transcription" | "enhancement";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "input", label: "Input" },
  { id: "transcription", label: "Transcription" },
  { id: "enhancement", label: "Enhancement" },
];

interface TabBarProps {
  activeTab: SettingsTab;
  onChange: (tab: SettingsTab) => void;
}

export function TabBar({ activeTab, onChange }: TabBarProps) {
  return (
    <div
      role="tablist"
      className="flex border-b border-border bg-background px-4 pt-2"
    >
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            className={`relative px-3 pb-2 text-[13px] font-medium transition-colors ${
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
