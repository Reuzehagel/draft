import { HugeiconsIcon } from "@hugeicons/react";
import {
  FileAudioIcon,
  Settings01Icon,
  Package01Icon,
  SparklesIcon,
  Clock01Icon,
  InformationCircleIcon,
  Sun01Icon,
  Moon01Icon,
  SlidersHorizontalIcon,
  Bug01Icon,
} from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export type Page =
  | "transcribe"
  | "general"
  | "models"
  | "post-process"
  | "advanced"
  | "history"
  | "debug"
  | "info";

type NavItem = { page: Page; label: string; icon: typeof Settings01Icon };

const FEATURE_NAV: NavItem[] = [
  { page: "transcribe", label: "Transcribe", icon: FileAudioIcon },
];

const SETTINGS_NAV: NavItem[] = [
  { page: "general", label: "General", icon: Settings01Icon },
  { page: "models", label: "Models", icon: Package01Icon },
  { page: "post-process", label: "Post Process", icon: SparklesIcon },
];

const OTHER_NAV: NavItem[] = [
  { page: "advanced", label: "Advanced", icon: SlidersHorizontalIcon },
  { page: "history", label: "History", icon: Clock01Icon },
  { page: "debug", label: "Debug", icon: Bug01Icon },
  { page: "info", label: "Info", icon: InformationCircleIcon },
];

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  isDark: boolean;
  toggleDarkMode: () => void;
  version: string | null;
  saved: boolean;
}

function NavButton({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}): React.ReactNode {
  return (
    <button
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-colors ${
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      }`}
    >
      <HugeiconsIcon icon={item.icon} size={16} />
      {item.label}
    </button>
  );
}

function NavGroup({ items, activePage, onNavigate }: { items: NavItem[]; activePage: Page; onNavigate: (page: Page) => void }): React.ReactNode {
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item) => (
        <NavButton
          key={item.page}
          item={item}
          isActive={activePage === item.page}
          onClick={() => onNavigate(item.page)}
        />
      ))}
    </div>
  );
}

export function Sidebar({ activePage, onNavigate, isDark, toggleDarkMode, version, saved }: SidebarProps): React.ReactNode {
  return (
    <aside className="w-[172px] shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
      <div className="px-4 py-3">
        <span className="text-sm font-bold tracking-tight text-sidebar-foreground">
          Draft
        </span>
      </div>

      <nav className="flex-1 px-2 flex flex-col gap-3 overflow-hidden">
        <NavGroup items={FEATURE_NAV} activePage={activePage} onNavigate={onNavigate} />
        <Separator className="mx-1" />
        <NavGroup items={SETTINGS_NAV} activePage={activePage} onNavigate={onNavigate} />
        <Separator className="mx-1" />
        <NavGroup items={OTHER_NAV} activePage={activePage} onNavigate={onNavigate} />
      </nav>

      <div className="px-3 py-2.5 border-t border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleDarkMode}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            <HugeiconsIcon icon={isDark ? Sun01Icon : Moon01Icon} size={14} />
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
