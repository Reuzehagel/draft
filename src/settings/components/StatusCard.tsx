import React from "react";

interface StatusCardProps {
  label: string;
  value: string;
  status: string;
  statusColor?: "primary" | "success" | "muted" | "warning" | "destructive";
  onClick?: () => void;
}

const STATUS_COLORS = {
  primary: "text-primary",
  success: "text-success",
  muted: "text-muted-foreground",
  warning: "text-warning",
  destructive: "text-destructive",
} as const;

export function StatusCard({ label, value, status, statusColor = "muted", onClick }: StatusCardProps): React.ReactNode {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      className={`flex-1 bg-card border border-border rounded-lg p-3.5 text-left transition-colors ${onClick ? "hover:bg-accent cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <div className="text-[10px] uppercase tracking-[0.5px] text-muted-foreground mb-1">{label}</div>
      <div className="text-sm font-medium text-foreground">{value}</div>
      <div className={`text-[11px] mt-0.5 ${STATUS_COLORS[statusColor]}`}>{status}</div>
    </Comp>
  );
}
