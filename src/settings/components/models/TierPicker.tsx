import { TIERS, type Tier } from "./tierConfig";

export function TierPicker({
  activeTierId,
  onSelect,
}: {
  activeTierId: string | null;
  onSelect: (tier: Tier) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {TIERS.map((tier) => {
        const isSelected = activeTierId === tier.id;
        return (
          <button
            key={tier.id}
            onClick={() => onSelect(tier)}
            className={`
              rounded-lg border px-3 py-2.5 text-left transition-all duration-150
              ${isSelected
                ? "border-primary bg-primary/8 ring-1 ring-primary/20"
                : "border-border/60 bg-card/50 hover:border-border"
              }
            `}
          >
            <div className="text-[13px] font-medium text-foreground">{tier.label}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{tier.description}</div>
            <div className="text-[10px] text-muted-foreground/60 mt-0.5">{tier.detail}</div>
          </button>
        );
      })}
    </div>
  );
}
