//! Microphone enumeration and device management

use cpal::traits::{DeviceTrait, HostTrait};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

use super::capture::AudioCapture;
use super::worker::AudioWorker;
use crate::events;

/// Information about an available microphone
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MicrophoneInfo {
    /// Device identifier (empty string for system default)
    pub id: String,
    /// Human-readable device name
    pub name: String,
}

/// List all available microphones
/// Returns "System Default" as the first option, followed by all detected input devices
#[tauri::command]
pub fn list_microphones() -> Result<Vec<MicrophoneInfo>, String> {
    let host = cpal::default_host();

    let mut microphones = vec![MicrophoneInfo {
        id: String::new(),
        name: "System Default".to_string(),
    }];

    let devices = host
        .input_devices()
        .map_err(|e| format!("Failed to enumerate input devices: {}", e))?;

    for device in devices {
        if let Ok(desc) = device.description() {
            let name = desc.name().to_string();
            microphones.push(MicrophoneInfo {
                id: name.clone(),
                name,
            });
        }
    }

    log::info!("Found {} microphones", microphones.len());
    Ok(microphones)
}

/// Resolve a device ID to a cpal device
/// Empty or "default" ID resolves to the default input device
pub fn resolve_device(device_id: Option<&str>) -> Result<cpal::Device, String> {
    let host = cpal::default_host();

    match device_id {
        None | Some("") | Some("default") => host
            .default_input_device()
            .ok_or_else(|| "No default input device available".to_string()),

        Some(id) => {
            let devices = host
                .input_devices()
                .map_err(|e| format!("Failed to enumerate input devices: {}", e))?;

            for device in devices {
                if let Ok(desc) = device.description() {
                    if desc.name() == id {
                        return Ok(device);
                    }
                }
            }

            Err(format!("Device not found: {}", id))
        }
    }
}

/// Test state managed by Tauri
pub struct TestState {
    pub is_testing: Arc<AtomicBool>,
}

impl Default for TestState {
    fn default() -> Self {
        Self {
            is_testing: Arc::new(AtomicBool::new(false)),
        }
    }
}

/// Test a microphone by capturing audio and emitting amplitude events for 5 seconds
#[tauri::command]
pub async fn test_microphone(
    app: AppHandle,
    device_id: Option<String>,
    state: tauri::State<'_, TestState>,
) -> Result<(), String> {
    // Check if already testing
    if state
        .is_testing
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("Microphone test already in progress".to_string());
    }

    let is_testing = state.is_testing.clone();
    let app_handle = app.clone();

    // Spawn the test in a background task
    std::thread::spawn(move || {
        let result = run_microphone_test(&app_handle, device_id.as_deref());

        // Reset testing flag
        is_testing.store(false, Ordering::SeqCst);

        // Emit completion event
        let _ = app_handle.emit(events::TEST_MICROPHONE_COMPLETE, result.is_ok());

        if let Err(e) = result {
            log::error!("Microphone test failed: {}", e);
        }
    });

    Ok(())
}

/// Internal function to run the microphone test
fn run_microphone_test(app: &AppHandle, device_id: Option<&str>) -> Result<(), String> {
    log::info!("Starting microphone test for device: {:?}", device_id);

    // Create audio capture
    let mut capture = AudioCapture::new(device_id)?;

    // Create worker with amplitude events enabled
    let worker = AudioWorker::new(
        capture.take_consumer()?,
        capture.sample_rate(),
        capture.channels(),
        Some(app.clone()),
    );

    // Start capture
    capture.start()?;

    // Run for 5 seconds
    std::thread::sleep(std::time::Duration::from_secs(5));

    // Stop capture and worker
    capture.stop();
    worker.stop();

    log::info!("Microphone test completed");
    Ok(())
}
