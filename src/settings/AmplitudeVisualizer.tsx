interface AmplitudeVisualizerProps {
  amplitudes: number[];
  barCount?: number;
}

export function AmplitudeVisualizer({ amplitudes, barCount = 14 }: AmplitudeVisualizerProps) {
  if (amplitudes.length === 0) return null;

  return (
    <div className="flex items-center gap-[2px] h-5">
      {amplitudes.slice(0, barCount).map((amplitude, i) => (
        <div
          key={i}
          className="w-[3px] bg-primary rounded-full transition-all duration-75"
          style={{
            height: `${Math.max(4, amplitude * 20)}px`,
          }}
        />
      ))}
    </div>
  );
}
