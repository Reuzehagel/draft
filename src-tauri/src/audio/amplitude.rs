//! Amplitude calculation for waveform visualization
//! Calculates RMS values over sliding windows for display

/// Number of amplitude values for the waveform display
pub const AMPLITUDE_COUNT: usize = 14;

/// Window size in samples for RMS calculation at 16kHz
/// 80ms window = 16000 * 0.080 = 1280 samples
const RMS_WINDOW_SAMPLES: usize = 1280;

/// Amplitude calculator with sliding window
pub struct AmplitudeCalculator {
    /// Ring buffer of recent RMS values
    values: [f32; AMPLITUDE_COUNT],
    /// Current write position in the ring buffer
    write_pos: usize,
    /// Accumulator for current window
    window_buffer: Vec<f32>,
}

impl AmplitudeCalculator {
    pub fn new() -> Self {
        Self {
            values: [0.0; AMPLITUDE_COUNT],
            write_pos: 0,
            window_buffer: Vec::with_capacity(RMS_WINDOW_SAMPLES),
        }
    }

    /// Process new audio samples (expected to be 16kHz mono)
    /// Returns true if new amplitude values are available
    pub fn process(&mut self, samples: &[f32]) -> bool {
        let mut updated = false;

        for &sample in samples {
            self.window_buffer.push(sample);

            // When we have a full window, calculate RMS
            if self.window_buffer.len() >= RMS_WINDOW_SAMPLES {
                let rms = self.calculate_rms(&self.window_buffer);
                let normalized = self.normalize(rms);

                // Store in ring buffer
                self.values[self.write_pos] = normalized;
                self.write_pos = (self.write_pos + 1) % AMPLITUDE_COUNT;

                // Clear window for next calculation (with 50% overlap)
                let half = RMS_WINDOW_SAMPLES / 2;
                self.window_buffer.drain(..half);

                updated = true;
            }
        }

        updated
    }

    /// Get the current amplitude values for display
    /// Returns values in order from oldest to newest
    pub fn get_values(&self) -> Vec<f32> {
        let mut result = Vec::with_capacity(AMPLITUDE_COUNT);

        // Read from ring buffer starting after write position (oldest)
        for i in 0..AMPLITUDE_COUNT {
            let idx = (self.write_pos + i) % AMPLITUDE_COUNT;
            result.push(self.values[idx]);
        }

        result
    }

    /// Calculate RMS (Root Mean Square) of samples
    fn calculate_rms(&self, samples: &[f32]) -> f32 {
        if samples.is_empty() {
            return 0.0;
        }

        let sum_squares: f32 = samples.iter().map(|&s| s * s).sum();
        (sum_squares / samples.len() as f32).sqrt()
    }

    /// Normalize RMS to 0.0-1.0 range for display
    /// Uses a soft curve to make quiet sounds more visible
    fn normalize(&self, rms: f32) -> f32 {
        // RMS of full-scale sine wave is ~0.707
        // Speech typically ranges 0.01-0.3 RMS
        // Use a power curve for better visualization of speech levels

        // Clamp and scale
        let scaled = (rms * 3.0).min(1.0);

        // Apply slight power curve to make quiet sounds more visible
        scaled.powf(0.7)
    }

    /// Reset the calculator state
    pub fn reset(&mut self) {
        self.values = [0.0; AMPLITUDE_COUNT];
        self.write_pos = 0;
        self.window_buffer.clear();
    }
}

impl Default for AmplitudeCalculator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rms_calculation() {
        let calc = AmplitudeCalculator::new();

        // RMS of constant value
        let samples = vec![0.5; 100];
        let rms = calc.calculate_rms(&samples);
        assert!((rms - 0.5).abs() < 0.001);

        // RMS of silence
        let silence = vec![0.0; 100];
        let rms_silence = calc.calculate_rms(&silence);
        assert!(rms_silence < 0.001);
    }

    #[test]
    fn test_amplitude_values_count() {
        let mut calc = AmplitudeCalculator::new();

        // Process enough samples to fill multiple windows
        let samples = vec![0.3; RMS_WINDOW_SAMPLES * AMPLITUDE_COUNT];
        calc.process(&samples);

        let values = calc.get_values();
        assert_eq!(values.len(), AMPLITUDE_COUNT);
    }
}
