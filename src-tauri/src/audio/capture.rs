//! Audio capture using cpal
//! Manages the audio input stream and feeds samples to the lock-free buffer

use cpal::traits::{DeviceTrait, StreamTrait};
use cpal::{SampleFormat, Stream, StreamConfig};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use super::buffer::{create_buffer, stop_buffer, AudioConsumer, AudioProducer};
use super::devices::resolve_device;

/// Audio capture manager
/// Handles device setup, stream creation, and buffer management
pub struct AudioCapture {
    stream: Option<Stream>,
    producer: Option<AudioProducer>,
    consumer: Option<AudioConsumer>,
    sample_rate: u32,
    channels: u16,
    error_flag: Arc<AtomicBool>,
}

impl AudioCapture {
    /// Create a new audio capture for the specified device
    /// device_id: None or empty string for system default
    pub fn new(device_id: Option<&str>) -> Result<Self, String> {
        let device = resolve_device(device_id)?;
        let device_name = device
            .description()
            .map(|d| d.name().to_string())
            .unwrap_or_else(|_| "Unknown".to_string());
        log::info!("Opening audio device: {}", device_name);

        // Get the default input config (native format)
        let config = device
            .default_input_config()
            .map_err(|e| format!("Failed to get default input config: {}", e))?;

        let sample_rate = config.sample_rate();
        let channels = config.channels();
        let sample_format = config.sample_format();

        log::info!(
            "Audio config: {} Hz, {} channels, {:?}",
            sample_rate,
            channels,
            sample_format
        );

        // Create the buffer pair
        let (producer, consumer) = create_buffer();
        let error_flag = Arc::new(AtomicBool::new(false));

        // Build the stream config from the supported config
        let stream_config: StreamConfig = config.into();

        // Create the stream based on sample format
        let stream = Self::build_stream(
            &device,
            &stream_config,
            sample_format,
            &producer,
            error_flag.clone(),
        )?;

        Ok(Self {
            stream: Some(stream),
            producer: Some(producer),
            consumer: Some(consumer),
            sample_rate,
            channels,
            error_flag,
        })
    }

    /// Build the cpal stream for the given sample format
    fn build_stream(
        device: &cpal::Device,
        config: &StreamConfig,
        sample_format: SampleFormat,
        producer: &AudioProducer,
        error_flag: Arc<AtomicBool>,
    ) -> Result<Stream, String> {
        let error_callback = {
            let error_flag = error_flag.clone();
            move |err| {
                log::error!("Audio stream error: {}", err);
                error_flag.store(true, Ordering::SeqCst);
            }
        };

        let producer = producer.clone();

        // Macro to build input stream with sample conversion
        // Audio callback must be real-time safe - no allocations, locks, or I/O
        macro_rules! build_converting_stream {
            ($sample_type:ty, $convert:expr) => {{
                let data_callback = move |data: &[$sample_type], _: &cpal::InputCallbackInfo| {
                    for &sample in data {
                        let f32_sample: f32 = $convert(sample);
                        producer.push(&[f32_sample]);
                    }
                };
                device.build_input_stream(config, data_callback, error_callback, None)
            }};
        }

        let stream = match sample_format {
            SampleFormat::F32 => {
                let data_callback = move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    producer.push(data);
                };
                device.build_input_stream(config, data_callback, error_callback, None)
            }
            SampleFormat::I16 => {
                // Explicit parentheses for clarity: cast to f32 BEFORE division
                build_converting_stream!(i16, |s: i16| (s as f32) / (i16::MAX as f32))
            }
            SampleFormat::U16 => {
                // Explicit parentheses for clarity: cast to f32 BEFORE division
                build_converting_stream!(u16, |s: u16| ((s as f32) / (u16::MAX as f32)) * 2.0 - 1.0)
            }
            format => {
                return Err(format!("Unsupported sample format: {:?}", format));
            }
        };

        stream.map_err(|e| format!("Failed to build input stream: {}", e))
    }

    /// Start capturing audio
    pub fn start(&self) -> Result<(), String> {
        if let Some(ref stream) = self.stream {
            stream
                .play()
                .map_err(|e| format!("Failed to start audio stream: {}", e))?;
            log::info!("Audio capture started");
        }
        Ok(())
    }

    /// Stop capturing audio
    pub fn stop(&mut self) {
        if let Some(ref stream) = self.stream {
            let _ = stream.pause();
        }
        // Signal the buffer to stop
        if let Some(ref producer) = self.producer {
            stop_buffer(producer);
        }
        log::info!("Audio capture stopped");
    }

    /// Take ownership of the consumer (can only be called once)
    pub fn take_consumer(&mut self) -> Result<AudioConsumer, String> {
        self.consumer
            .take()
            .ok_or_else(|| "Consumer already taken".to_string())
    }

    /// Get the sample rate
    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    /// Get the channel count
    pub fn channels(&self) -> u16 {
        self.channels
    }

    /// Check if an error has occurred
    pub fn has_error(&self) -> bool {
        self.error_flag.load(Ordering::Relaxed)
    }
}

impl Drop for AudioCapture {
    fn drop(&mut self) {
        self.stop();
    }
}
