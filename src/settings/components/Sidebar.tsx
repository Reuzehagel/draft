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
} from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { UpdateCard } from "./UpdateCard";
import type { UpdateStatus } from "@/shared/types/updater";

export type Page =
  | "transcribe"
  | "general"
  | "models"
  | "post-process"
  | "advanced"
  | "history"
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
  { page: "info", label: "Info", icon: InformationCircleIcon },
];

interface AppSidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  isDark: boolean;
  toggleDarkMode: () => void;
  version: string | null;
  saved: boolean;
  updateStatus: UpdateStatus;
}

function NavGroup({
  items,
  activePage,
  onNavigate,
}: {
  items: NavItem[];
  activePage: Page;
  onNavigate: (page: Page) => void;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.page}>
              <SidebarMenuButton
                size="sm"
                isActive={activePage === item.page}
                onClick={() => onNavigate(item.page)}
              >
                <HugeiconsIcon icon={item.icon} size={16} />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar({
  activePage,
  onNavigate,
  isDark,
  toggleDarkMode,
  version,
  saved,
  updateStatus,
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="none">
      <SidebarHeader className="px-4 py-3">
        <span className="text-sm font-bold tracking-tight text-sidebar-foreground">
          Draft
        </span>
      </SidebarHeader>

      <SidebarContent>
        <NavGroup items={FEATURE_NAV} activePage={activePage} onNavigate={onNavigate} />
        <SidebarSeparator />
        <NavGroup items={SETTINGS_NAV} activePage={activePage} onNavigate={onNavigate} />
        <SidebarSeparator />
        <NavGroup items={OTHER_NAV} activePage={activePage} onNavigate={onNavigate} />
      </SidebarContent>

      <UpdateCard status={updateStatus} />

      <SidebarFooter className="border-t border-sidebar-border px-3 py-2">
        <div className="flex items-center justify-between">
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
      </SidebarFooter>
    </Sidebar>
  );
}
