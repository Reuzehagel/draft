import { HugeiconsIcon } from "@hugeicons/react";
import {
  Home01Icon,
  FileAudioIcon,
  HelpCircleIcon,
  Settings01Icon,
  Clock01Icon,
  Sun01Icon,
  Moon01Icon,
} from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";

export type Page = "home" | "transcribe" | "help" | "settings" | "history";

const NAV_ITEMS: { page: Page; label: string; icon: typeof Home01Icon }[] = [
  { page: "home", label: "Home", icon: Home01Icon },
  { page: "transcribe", label: "Transcribe", icon: FileAudioIcon },
  { page: "help", label: "Help", icon: HelpCircleIcon },
  { page: "history", label: "History", icon: Clock01Icon },
];

const BOTTOM_NAV: { page: Page; label: string; icon: typeof Home01Icon } =
  { page: "settings", label: "Settings", icon: Settings01Icon };

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  isDark: boolean;
  toggleDarkMode: () => void;
  version: string | null;
  saved: boolean;
}

export function Sidebar({ activePage, onNavigate, isDark, toggleDarkMode, version, saved }: SidebarProps): React.ReactNode {
  return (
    <aside className="w-[180px] shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
      <div className="px-4 py-4">
        <span className="text-base font-bold tracking-tight text-sidebar-foreground">
          Draft
        </span>
      </div>
      <nav className="flex-1 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ page, label, icon }) => {
          const isActive = activePage === page;
          return (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              aria-current={isActive ? "page" : undefined}
              className={`relative w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary" />
              )}
              <HugeiconsIcon icon={icon} size={18} />
              {label}
            </button>
          );
        })}
      </nav>
      <div className="px-2 pb-1">
        {(() => {
          const { page, label, icon } = BOTTOM_NAV;
          const isActive = activePage === page;
          return (
            <button
              onClick={() => onNavigate(page)}
              aria-current={isActive ? "page" : undefined}
              className={`relative w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary" />
              )}
              <HugeiconsIcon icon={icon} size={18} />
              {label}
            </button>
          );
        })()}
      </div>
      <div className="px-3 py-3 border-t border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleDarkMode}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            <HugeiconsIcon icon={isDark ? Sun01Icon : Moon01Icon} size={16} />
          </button>
          <span
            className={`text-[11px] text-success transition-opacity duration-200 ${saved ? "opacity-100" : "opacity-0"}`}
            role="status"
            aria-live="polite"
          >
            Saved
          </span>
        </div>
        {version && (
          <Badge variant="outline" className="text-[10px] font-mono px-1.5 h-4 text-muted-foreground">
            v{version}
          </Badge>
        )}
      </div>
    </aside>
  );
}
