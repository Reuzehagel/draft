import { TIERS, type Tier } from "./tierConfig";

interface TierPickerProps {
  activeTierId: string | null;
  onSelect: (tier: Tier) => void;
}

export function TierPicker({ activeTierId, onSelect }: TierPickerProps): React.ReactNode {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {TIERS.map((tier) => {
        const isSelected = activeTierId === tier.id;
        return (
          <button
            key={tier.id}
            onClick={() => onSelect(tier)}
            className={`
              rounded-lg border px-4 py-3 text-left transition-all duration-150
              ${isSelected
                ? "border-primary bg-primary/8 ring-2 ring-primary/20"
                : "border-border/60 bg-card/80 hover:border-border hover:bg-muted/50"
              }
            `}
          >
            <div className="text-sm font-medium text-foreground">{tier.label}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{tier.description}</div>
            <div className="text-[10px] text-muted-foreground/60 mt-0.5">{tier.detail}</div>
          </button>
        );
      })}
    </div>
  );
}
