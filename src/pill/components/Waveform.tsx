import { useState, useEffect } from "react";
import { WaveformBars } from "@/components/WaveformBars";

const BAR_COUNT = 14;

// Static initial values (animation starts immediately so these are never displayed)
const INITIAL_AMPLITUDES = Array.from({ length: BAR_COUNT }, () => 0.5);

export default function Waveform({
  amplitudes,
}: {
  amplitudes?: number[];
}) {
  const [placeholderAmplitudes, setPlaceholderAmplitudes] =
    useState<number[]>(INITIAL_AMPLITUDES);

  useEffect(() => {
    if (amplitudes) return;

    // Animate placeholder bars for demo
    const interval = setInterval(() => {
      setPlaceholderAmplitudes(
        Array.from({ length: BAR_COUNT }, () => Math.random() * 0.8 + 0.2)
      );
    }, 100);

    return () => clearInterval(interval);
  }, [amplitudes]);

  const values = amplitudes || placeholderAmplitudes;

  return (
    <WaveformBars
      amplitudes={values}
      barCount={BAR_COUNT}
      colorClass="bg-white/90"
      centered
    />
  );
}
