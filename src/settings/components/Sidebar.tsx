import { HugeiconsIcon } from "@hugeicons/react";
import {
  Home01Icon,
  FileAudioIcon,
  HelpCircleIcon,
  Settings01Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons";

export type Page = "home" | "transcribe" | "help" | "settings" | "history";

const NAV_ITEMS: { page: Page; label: string; icon: typeof Home01Icon }[] = [
  { page: "home", label: "Home", icon: Home01Icon },
  { page: "transcribe", label: "Transcribe", icon: FileAudioIcon },
  { page: "help", label: "Help", icon: HelpCircleIcon },
  { page: "settings", label: "Settings", icon: Settings01Icon },
  { page: "history", label: "History", icon: Clock01Icon },
];

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-[180px] shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
      <div className="px-4 py-4">
        <span className="text-sm font-semibold tracking-tight text-sidebar-foreground/70">
          Draft
        </span>
      </div>
      <nav className="flex-1 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ page, label, icon }) => (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors ${
              activePage === page
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            }`}
          >
            <HugeiconsIcon icon={icon} size={16} />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
