const DEFAULT_BAR_COUNT = 14;
const AMPLITUDE_SCALE = 20;
const MIN_BAR_HEIGHT_PX = 4;
const MAX_BAR_HEIGHT_PX = 20; // h-5 = 20px container

interface WaveformBarsProps {
  amplitudes: number[];
  barCount?: number;
  colorClass?: string;
  centered?: boolean;
}

export function WaveformBars({
  amplitudes,
  barCount = DEFAULT_BAR_COUNT,
  colorClass = "bg-primary",
  centered = false,
}: WaveformBarsProps): React.ReactNode {
  if (amplitudes.length === 0) return null;

  return (
    <div className={`flex items-center ${centered ? "justify-center" : ""} gap-[2px] h-5`}>
      {amplitudes.slice(0, barCount).map((amplitude, i) => {
        const targetHeight = Math.max(MIN_BAR_HEIGHT_PX, amplitude * AMPLITUDE_SCALE);
        const scale = targetHeight / MAX_BAR_HEIGHT_PX;
        return (
          <div
            key={i}
            className={`w-[3px] h-5 ${colorClass} rounded-full transition-transform duration-75 will-change-transform`}
            style={{ transform: `scaleY(${scale})` }}
          />
        );
      })}
    </div>
  );
}
