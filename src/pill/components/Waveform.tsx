import { useState, useEffect } from "react";

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
    <div className="flex items-center justify-center gap-[2px] h-5">
      {values.slice(0, BAR_COUNT).map((amplitude, i) => (
        <div
          key={i}
          className="w-[3px] bg-white/90 rounded-full transition-all duration-75"
          style={{
            height: `${Math.max(4, amplitude * 20)}px`,
          }}
        />
      ))}
    </div>
  );
}
