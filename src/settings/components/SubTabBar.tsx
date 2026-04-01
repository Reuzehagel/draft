import React from "react";
import { cn } from "@/lib/utils";

export type MoreSubPage = "post-process" | "advanced" | "history" | "transcribe" | "about";

interface SubTabItem {
  page: MoreSubPage;
  label: string;
}

const SUB_TABS: SubTabItem[] = [
  { page: "post-process", label: "Post Process" },
  { page: "advanced", label: "Advanced" },
  { page: "history", label: "History" },
  { page: "transcribe", label: "Transcribe" },
  { page: "about", label: "About" },
];

interface SubTabBarProps {
  activeSub: MoreSubPage;
  onNavigate: (sub: MoreSubPage) => void;
}

export function SubTabBar({ activeSub, onNavigate }: SubTabBarProps): React.ReactNode {
  return (
    <nav className="flex gap-0 border-b border-border/50">
      {SUB_TABS.map((tab) => (
        <button
          key={tab.page}
          onClick={() => onNavigate(tab.page)}
          className={cn(
            "text-[11px] px-3 py-2 border-b transition-colors",
            activeSub === tab.page
              ? "text-foreground border-muted-foreground"
              : "text-muted-foreground border-transparent hover:text-foreground/70"
          )}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
