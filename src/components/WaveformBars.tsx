const DEFAULT_BAR_COUNT = 14;
const AMPLITUDE_SCALE = 20;
const MIN_BAR_HEIGHT_PX = 4;

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
}: WaveformBarsProps) {
  if (amplitudes.length === 0) return null;

  return (
    <div className={`flex items-center ${centered ? "justify-center" : ""} gap-[2px] h-5`}>
      {amplitudes.slice(0, barCount).map((amplitude, i) => (
        <div
          key={i}
          className={`w-[3px] ${colorClass} rounded-full transition-all duration-75`}
          style={{
            height: `${Math.max(MIN_BAR_HEIGHT_PX, amplitude * AMPLITUDE_SCALE)}px`,
          }}
        />
      ))}
    </div>
  );
}
