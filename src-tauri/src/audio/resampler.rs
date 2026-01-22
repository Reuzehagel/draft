//! Audio resampling using rubato
//! Converts audio from native sample rate to 16kHz mono for Whisper

use std::borrow::Cow;

use audioadapter_buffers::direct::InterleavedSlice;
use rubato::{Async, FixedAsync, Resampler, SincInterpolationParameters, SincInterpolationType, WindowFunction};

/// Target sample rate for Whisper (16kHz)
pub const TARGET_SAMPLE_RATE: u32 = 16000;

/// Chunk size for resampling
const CHUNK_SIZE: usize = 1024;

/// Audio resampler - converts from native rate/channels to 16kHz mono
pub struct AudioResampler {
    resampler: Option<Async<f32>>,
    channels: u16,
    input_buffer: Vec<f32>,
    output_buffer: Vec<f32>,
}

impl AudioResampler {
    /// Create a new resampler
    /// If source_rate is already 16kHz, resampling is skipped (only mono conversion)
    pub fn new(source_rate: u32, channels: u16) -> Result<Self, String> {
        let resampler = if source_rate != TARGET_SAMPLE_RATE {
            let params = SincInterpolationParameters {
                sinc_len: 256,
                f_cutoff: 0.95,
                interpolation: SincInterpolationType::Linear,
                oversampling_factor: 256,
                window: WindowFunction::BlackmanHarris2,
            };

            let resampler = Async::<f32>::new_sinc(
                TARGET_SAMPLE_RATE as f64 / source_rate as f64,
                2.0, // max relative ratio
                &params,
                CHUNK_SIZE,
                1, // mono output (we convert to mono first)
                FixedAsync::Input,
            )
            .map_err(|e| format!("Failed to create resampler: {}", e))?;

            Some(resampler)
        } else {
            None
        };

        // Pre-allocate output buffer for resampled data
        let output_buffer = vec![0.0f32; CHUNK_SIZE * 3]; // Extra space for upsampling

        Ok(Self {
            resampler,
            channels,
            input_buffer: Vec::with_capacity(CHUNK_SIZE * 2),
            output_buffer,
        })
    }

    /// Process audio samples
    /// Input: interleaved samples at native rate
    /// Output: mono samples at 16kHz
    pub fn process(&mut self, input: &[f32], output: &mut Vec<f32>) {
        let mono_samples = self.to_mono(input);

        let Some(ref mut resampler) = self.resampler else {
            output.extend_from_slice(&mono_samples);
            return;
        };

        self.input_buffer.extend_from_slice(&mono_samples);
        let input_frames_needed = resampler.input_frames_next();

        while self.input_buffer.len() >= input_frames_needed {
            let chunk: Vec<f32> = self.input_buffer.drain(..input_frames_needed).collect();
            Self::resample_chunk(resampler, &chunk, output, &mut self.output_buffer, true);
        }
    }

    /// Flush any remaining samples in the buffer
    pub fn flush(&mut self, output: &mut Vec<f32>) {
        let Some(ref mut resampler) = self.resampler else {
            return;
        };

        if self.input_buffer.is_empty() {
            return;
        }

        // Pad remaining samples to make a complete chunk
        let input_frames_needed = resampler.input_frames_next();
        let padding_needed = input_frames_needed.saturating_sub(self.input_buffer.len());
        self.input_buffer.extend(vec![0.0f32; padding_needed]);

        let chunk: Vec<f32> = self.input_buffer.drain(..).collect();
        Self::resample_chunk(resampler, &chunk, output, &mut self.output_buffer, false);
    }

    /// Resample a single chunk of audio data
    fn resample_chunk(
        resampler: &mut Async<f32>,
        chunk: &[f32],
        output: &mut Vec<f32>,
        temp_buffer: &mut Vec<f32>,
        log_errors: bool,
    ) {
        let input_adapter = match InterleavedSlice::new(chunk, 1, chunk.len()) {
            Ok(adapter) => adapter,
            Err(e) => {
                if log_errors {
                    log::warn!("Failed to create input adapter: {}", e);
                }
                return;
            }
        };

        let output_frames_max = resampler.output_frames_next() + 16;
        if temp_buffer.len() < output_frames_max {
            temp_buffer.resize(output_frames_max, 0.0);
        }

        let mut output_adapter =
            match InterleavedSlice::new_mut(temp_buffer, 1, output_frames_max) {
                Ok(adapter) => adapter,
                Err(e) => {
                    if log_errors {
                        log::warn!("Failed to create output adapter: {}", e);
                    }
                    return;
                }
            };

        match resampler.process_into_buffer(&input_adapter, &mut output_adapter, None) {
            Ok((_frames_read, frames_written)) => {
                output.extend_from_slice(&temp_buffer[..frames_written]);
            }
            Err(e) => {
                if log_errors {
                    log::warn!("Resampling error: {}", e);
                }
            }
        }
    }

    /// Convert interleaved multi-channel audio to mono
    /// Returns borrowed slice when input is already mono, avoiding allocation
    fn to_mono<'a>(&self, input: &'a [f32]) -> Cow<'a, [f32]> {
        if self.channels == 1 {
            return Cow::Borrowed(input);
        }

        let channels = self.channels as usize;
        let frame_count = input.len() / channels;
        let mono: Vec<f32> = (0..frame_count)
            .map(|i| {
                let sum: f32 = (0..channels).map(|ch| input[i * channels + ch]).sum();
                sum / channels as f32
            })
            .collect();

        Cow::Owned(mono)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mono_passthrough() {
        let mut resampler = AudioResampler::new(16000, 1).unwrap();
        let input = vec![0.1, 0.2, 0.3, 0.4];
        let mut output = Vec::new();
        resampler.process(&input, &mut output);
        assert_eq!(output, input);
    }

    #[test]
    fn test_stereo_to_mono() {
        let resampler = AudioResampler::new(16000, 2).unwrap();
        // Stereo: L=1.0, R=0.0, L=0.0, R=1.0
        let input = vec![1.0, 0.0, 0.0, 1.0];
        let mono = resampler.to_mono(&input);
        assert_eq!(mono, vec![0.5, 0.5]);
    }
}
