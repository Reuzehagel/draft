//! Audio processing worker thread
//! Reads from the lock-free buffer, resamples, calculates amplitude,
//! and emits events to the frontend

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

use super::amplitude::AmplitudeCalculator;
use super::buffer::AudioConsumer;
use super::resampler::AudioResampler;
use crate::events;

/// Interval between worker drain cycles
const DRAIN_INTERVAL: Duration = Duration::from_millis(10);

/// Minimum interval between amplitude events (~30fps)
const AMPLITUDE_EMIT_INTERVAL: Duration = Duration::from_millis(33);

/// Audio processing worker
pub struct AudioWorker {
    stop_flag: Arc<AtomicBool>,
    handle: Option<JoinHandle<Vec<f32>>>,
}

impl AudioWorker {
    /// Create and start a new audio worker
    /// If app_handle is Some, amplitude events will be emitted
    pub fn new(
        consumer: AudioConsumer,
        sample_rate: u32,
        channels: u16,
        app_handle: Option<AppHandle>,
    ) -> Self {
        let stop_flag = Arc::new(AtomicBool::new(false));
        let stop_flag_clone = stop_flag.clone();

        let handle = thread::spawn(move || {
            Self::worker_loop(consumer, sample_rate, channels, app_handle, stop_flag_clone)
        });

        Self {
            stop_flag,
            handle: Some(handle),
        }
    }

    /// Stop the worker and get the accumulated 16kHz mono audio
    pub fn stop(mut self) -> Vec<f32> {
        self.stop_flag.store(true, Ordering::SeqCst);

        if let Some(handle) = self.handle.take() {
            handle.join().unwrap_or_default()
        } else {
            Vec::new()
        }
    }

    /// Worker thread main loop
    fn worker_loop(
        consumer: AudioConsumer,
        sample_rate: u32,
        channels: u16,
        app_handle: Option<AppHandle>,
        stop_flag: Arc<AtomicBool>,
    ) -> Vec<f32> {
        log::info!(
            "Audio worker started: {} Hz, {} channels",
            sample_rate,
            channels
        );

        // Create resampler and amplitude calculator
        let mut resampler = match AudioResampler::new(sample_rate, channels) {
            Ok(r) => r,
            Err(e) => {
                log::error!("Failed to create resampler: {}", e);
                return Vec::new();
            }
        };

        let mut amplitude_calc = AmplitudeCalculator::new();
        let mut last_amplitude_emit = Instant::now();

        // Buffers for processing
        let mut raw_buffer = Vec::with_capacity(4096);
        let mut resampled_buffer = Vec::with_capacity(4096);
        let mut output_audio = Vec::new();

        while !stop_flag.load(Ordering::Relaxed) && !consumer.should_stop() {
            // Drain available samples from the buffer
            raw_buffer.clear();
            consumer.drain_into(&mut raw_buffer);

            if !raw_buffer.is_empty() {
                // Resample to 16kHz mono
                resampled_buffer.clear();
                resampler.process(&raw_buffer, &mut resampled_buffer);

                // Calculate amplitude
                amplitude_calc.process(&resampled_buffer);

                // Accumulate output audio
                output_audio.extend_from_slice(&resampled_buffer);

                // Emit amplitude events at throttled rate
                if let Some(ref app) = app_handle {
                    let now = Instant::now();
                    if now.duration_since(last_amplitude_emit) >= AMPLITUDE_EMIT_INTERVAL {
                        let values = amplitude_calc.get_values();
                        if let Err(e) = app.emit(events::AMPLITUDE, &values) {
                            log::warn!("Failed to emit amplitude event: {}", e);
                        }
                        last_amplitude_emit = now;
                    }
                }
            }

            // Sleep briefly before next drain
            thread::sleep(DRAIN_INTERVAL);
        }

        // Final drain
        raw_buffer.clear();
        consumer.drain_into(&mut raw_buffer);
        if !raw_buffer.is_empty() {
            resampled_buffer.clear();
            resampler.process(&raw_buffer, &mut resampled_buffer);
            output_audio.extend_from_slice(&resampled_buffer);
        }

        // Flush any remaining samples in the resampler
        resampled_buffer.clear();
        resampler.flush(&mut resampled_buffer);
        output_audio.extend_from_slice(&resampled_buffer);

        log::info!(
            "Audio worker stopped, collected {} samples (16kHz mono)",
            output_audio.len()
        );

        output_audio
    }
}

impl Drop for AudioWorker {
    fn drop(&mut self) {
        self.stop_flag.store(true, Ordering::SeqCst);
    }
}
