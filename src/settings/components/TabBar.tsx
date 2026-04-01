import { HugeiconsIcon } from "@hugeicons/react";
import {
  Home01Icon,
  Settings01Icon,
  Package01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";

export type TopPage = "home" | "general" | "models" | "more";

interface TabItem {
  page: TopPage;
  label: string;
  icon: typeof Home01Icon;
}

const TABS: TabItem[] = [
  { page: "home", label: "Home", icon: Home01Icon },
  { page: "general", label: "General", icon: Settings01Icon },
  { page: "models", label: "Models", icon: Package01Icon },
  { page: "more", label: "More", icon: MoreHorizontalIcon },
];

interface TabBarProps {
  activePage: TopPage;
  onNavigate: (page: TopPage) => void;
  version: string | null;
  children?: React.ReactNode; // Slot for UpdateCard
}

export function TabBar({ activePage, onNavigate, version, children }: TabBarProps): React.ReactNode {
  return (
    <div className="border-b border-border flex-shrink-0" data-tauri-drag-region>
      <div className="flex items-center justify-between px-5 pt-3.5 pb-0" data-tauri-drag-region>
        <span className="text-sm font-bold tracking-tight text-foreground">Draft</span>
        <div className="flex items-center gap-2">
          {children}
          {version && (
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 h-4 text-muted-foreground">
              v{version}
            </Badge>
          )}
        </div>
      </div>
      <nav className="flex gap-0 px-5 mt-3">
        {TABS.map((tab) => (
          <button
            key={tab.page}
            onClick={() => onNavigate(tab.page)}
            className={`flex items-center gap-1.5 text-xs px-3 pb-2.5 border-b-2 transition-colors ${
              activePage === tab.page
                ? "text-foreground border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground/70"
            }`}
          >
            <HugeiconsIcon icon={tab.icon} size={13} />
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
