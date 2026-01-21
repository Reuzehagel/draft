//! Sprint 0 Task 0.2: Verify cpal audio capture works
//!
//! This program captures 3 seconds of audio from the default microphone
//! and writes it to a WAV file for playback verification.

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use hound::{WavSpec, WavWriter};
use std::sync::{Arc, Mutex};
use std::time::Duration;

fn main() {
    println!("cpal audio capture verification");
    println!("================================\n");

    // Get the default host
    let host = cpal::default_host();
    println!("Audio host: {:?}", host.id());

    // List available input devices
    println!("\nAvailable input devices:");
    if let Ok(devices) = host.input_devices() {
        for device in devices {
            if let Ok(desc) = device.description() {
                println!("  - {}", desc.name());
            }
        }
    }

    // Get the default input device
    let device = host
        .default_input_device()
        .expect("No input device available");
    let device_desc = device.description().expect("Failed to get device description");
    println!("\nUsing default input device: {}", device_desc.name());

    // Get the default config
    let config = device
        .default_input_config()
        .expect("Failed to get default input config");
    println!("Default config: {:?}", config);

    let sample_rate = config.sample_rate();
    let channels = config.channels();

    // Buffer to store recorded samples
    let samples: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::new()));
    let samples_clone = samples.clone();

    // Create the input stream
    let stream = device
        .build_input_stream(
            &config.into(),
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                let mut samples = samples_clone.lock().unwrap();
                samples.extend_from_slice(data);
            },
            |err| eprintln!("Stream error: {}", err),
            None,
        )
        .expect("Failed to build input stream");

    // Record for 3 seconds
    println!("\nRecording for 3 seconds... Speak into your microphone!");
    stream.play().expect("Failed to start stream");
    std::thread::sleep(Duration::from_secs(3));
    drop(stream);
    println!("Recording complete.");

    // Write to WAV file
    let samples = samples.lock().unwrap();
    let output_path = "test_recording.wav";

    let spec = WavSpec {
        channels,
        sample_rate,
        bits_per_sample: 32,
        sample_format: hound::SampleFormat::Float,
    };

    let mut writer = WavWriter::create(output_path, spec).expect("Failed to create WAV file");
    for &sample in samples.iter() {
        writer.write_sample(sample).expect("Failed to write sample");
    }
    writer.finalize().expect("Failed to finalize WAV file");

    println!("\nWrote {} samples to {}", samples.len(), output_path);
    println!("Duration: {:.2}s", samples.len() as f32 / sample_rate as f32 / channels as f32);
    println!("\nBuild verification successful!");
    println!("Play the WAV file to verify audio quality.");
}
