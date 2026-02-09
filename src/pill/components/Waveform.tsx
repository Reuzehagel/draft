import { useState, useEffect, useRef } from "react";
import { WaveformBars } from "@/components/WaveformBars";

const BAR_COUNT = 14;

export default function Waveform({
  amplitudes,
}: {
  amplitudes?: number[];
}) {
  const [placeholderAmplitudes, setPlaceholderAmplitudes] = useState<number[]>(
    () => Array.from({ length: BAR_COUNT }, () => 0.5)
  );
  const rafRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (amplitudes) return;

    startRef.current = null;

    const animate = (time: number) => {
      if (startRef.current === null) startRef.current = time;
      const elapsed = (time - startRef.current) / 1000;

      setPlaceholderAmplitudes(
        Array.from({ length: BAR_COUNT }, (_, i) => {
          const phase = (i / BAR_COUNT) * Math.PI * 2;
          return 0.3 + 0.35 * Math.sin(elapsed * 2.5 + phase) + 0.15 * Math.sin(elapsed * 4.1 + phase * 1.7);
        })
      );

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
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
