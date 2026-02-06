import { WaveformBars } from "@/components/WaveformBars";

interface AmplitudeVisualizerProps {
  amplitudes: number[];
  barCount?: number;
}

export function AmplitudeVisualizer({ amplitudes, barCount }: AmplitudeVisualizerProps) {
  return <WaveformBars amplitudes={amplitudes} barCount={barCount} />;
}
