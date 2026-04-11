//! File-based audio transcription
//! Decodes audio files via symphonia and transcribes with whisper
//! Supports cancellation and online STT dispatch

use std::os::windows::process::CommandExt;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use windows::core::HSTRING;
use windows::Win32::System::Registry;

use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use tauri::{AppHandle, Emitter};

use crate::audio::resampler::AudioResampler;
use crate::events;

/// Find ffmpeg executable, checking both inherited PATH and fresh registry PATH.
///
/// GUI apps on Windows inherit PATH from explorer.exe, which only reads it at
/// login. If ffmpeg was added to PATH after that, it won't be found via normal
/// Command::new("ffmpeg"). This function falls back to reading the current PATH
/// directly from the Windows registry.
fn find_ffmpeg() -> Option<std::path::PathBuf> {
    // First, check if ffmpeg is on the inherited PATH
    if let Ok(output) = std::process::Command::new("ffmpeg")
        .arg("-version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .creation_flags(0x08000000)
        .status()
    {
        if output.success() {
            return Some(std::path::PathBuf::from("ffmpeg"));
        }
    }

    // Read fresh PATH from Windows registry (system + user)
    let fresh_path = read_registry_path();
    if fresh_path.is_empty() {
        return None;
    }

    // Search each directory for ffmpeg.exe
    for dir in std::env::split_paths(&fresh_path) {
        let candidate = dir.join("ffmpeg.exe");
        if candidate.is_file() {
            log::info!("Found ffmpeg via registry PATH: {}", candidate.display());
            return Some(candidate);
        }
    }

    None
}

/// Read the current PATH from the Windows registry (system + user).
fn read_registry_path() -> String {
    let mut parts = Vec::new();

    // System PATH: HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment
    let mut key = Registry::HKEY::default();
    let status = unsafe {
        Registry::RegOpenKeyExW(
            Registry::HKEY_LOCAL_MACHINE,
            &HSTRING::from("SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment"),
            None,
            Registry::KEY_READ,
            &mut key,
        )
    };
    if status.is_ok() {
        if let Some(val) = read_reg_string(key, "Path") {
            parts.push(val);
        }
        let _ = unsafe { Registry::RegCloseKey(key) };
    }

    // User PATH: HKCU\Environment
    let mut key = Registry::HKEY::default();
    let status = unsafe {
        Registry::RegOpenKeyExW(
            Registry::HKEY_CURRENT_USER,
            &HSTRING::from("Environment"),
            None,
            Registry::KEY_READ,
            &mut key,
        )
    };
    if status.is_ok() {
        if let Some(val) = read_reg_string(key, "Path") {
            parts.push(val);
        }
        let _ = unsafe { Registry::RegCloseKey(key) };
    }

    parts.join(";")
}

/// Read a string value from a registry key.
fn read_reg_string(key: Registry::HKEY, name: &str) -> Option<String> {
    let name = HSTRING::from(name);
    let mut size: u32 = 0;
    let mut kind = Registry::REG_VALUE_TYPE(0);

    // Query size first
    let status = unsafe {
        Registry::RegQueryValueExW(key, &name, None, Some(&mut kind), None, Some(&mut size))
    };
    if status.is_err() || size == 0 {
        return None;
    }

    // REG_SZ or REG_EXPAND_SZ
    if kind != Registry::REG_SZ && kind != Registry::REG_EXPAND_SZ {
        return None;
    }

    let mut buf = vec![0u8; size as usize];
    let status = unsafe {
        Registry::RegQueryValueExW(
            key,
            &name,
            None,
            Some(&mut kind),
            Some(buf.as_mut_ptr()),
            Some(&mut size),
        )
    };
    if status.is_err() {
        return None;
    }

    // Convert from UTF-16LE
    let wide: Vec<u16> = buf
        .chunks_exact(2)
        .map(|c| u16::from_le_bytes([c[0], c[1]]))
        .collect();
    let s = String::from_utf16_lossy(&wide);
    Some(s.trim_end_matches('\0').to_string())
}

/// Convert an audio file to WAV using ffmpeg. Returns the temp file path.
fn ffmpeg_convert_to_wav(path: &str) -> Result<std::path::PathBuf, String> {
    let ffmpeg = find_ffmpeg().ok_or_else(|| {
        "This file uses the Opus codec which requires ffmpeg to decode. \
         Install ffmpeg and add it to your PATH, then try again."
            .to_string()
    })?;

    let temp_dir = std::env::temp_dir();
    let temp_path = temp_dir.join(format!("draft_convert_{}.wav", std::process::id()));

    let output = std::process::Command::new(&ffmpeg)
        .args(["-y", "-i", path, "-ar", "16000", "-ac", "1", "-f", "wav"])
        .arg(&temp_path)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output()
        .map_err(|e| format!("Failed to run ffmpeg: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffmpeg conversion failed: {stderr}"));
    }

    Ok(temp_path)
}

use super::engine::EngineHandle;

/// Managed state for file transcription cancellation
#[derive(Default)]
pub struct FileTranscriptionState {
    cancel_token: Mutex<Option<Arc<AtomicBool>>>,
}

impl FileTranscriptionState {
    /// Create a new cancel token, replacing any previous one
    pub fn new_cancel_token(&self) -> Arc<AtomicBool> {
        let token = Arc::new(AtomicBool::new(false));
        let mut guard = self.cancel_token.lock().unwrap_or_else(|e| e.into_inner());
        *guard = Some(token.clone());
        token
    }

    /// Signal cancellation
    pub fn cancel(&self) {
        let guard = self.cancel_token.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(token) = guard.as_ref() {
            token.store(true, Ordering::SeqCst);
        }
    }

    /// Clear the cancel token
    pub fn clear(&self) {
        let mut guard = self.cancel_token.lock().unwrap_or_else(|e| e.into_inner());
        *guard = None;
    }
}

/// Decode an audio file to 16kHz mono f32 samples.
fn decode_audio_file(
    path: &str,
    app: &AppHandle,
    cancel_token: Option<&Arc<AtomicBool>>,
) -> Result<Vec<f32>, String> {
    match decode_audio_file_symphonia(path, app, cancel_token) {
        Ok(samples) => Ok(samples),
        Err(e) if e.contains("unsupported") || e.contains("Unsupported") => {
            log::info!("Symphonia can't decode this file, trying ffmpeg conversion: {e}");
            let temp_path = ffmpeg_convert_to_wav(path)?;
            let result = decode_audio_file_symphonia(
                temp_path.to_str().unwrap_or_default(),
                app,
                cancel_token,
            );
            let _ = std::fs::remove_file(&temp_path);
            result
        }
        Err(e) => Err(e),
    }
}

/// Decode an audio file to 16kHz mono f32 samples using symphonia.
fn decode_audio_file_symphonia(
    path: &str,
    app: &AppHandle,
    cancel_token: Option<&Arc<AtomicBool>>,
) -> Result<Vec<f32>, String> {
    let file =
        std::fs::File::open(path).map_err(|e| format!("Failed to open file: {e}"))?;

    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    // Provide a hint based on file extension
    let mut hint = Hint::new();
    if let Some(ext) = std::path::Path::new(path).extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let probed = symphonia::default::get_probe()
        .format(
            &hint,
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(|e| format!("Unsupported audio format: {e}"))?;

    let mut format = probed.format;

    let track = format
        .default_track()
        .ok_or("No audio track found in file")?;

    let codec_params = track.codec_params.clone();
    let track_id = track.id;

    let sample_rate = codec_params
        .sample_rate
        .ok_or("Audio file has no sample rate")?;
    let channels = codec_params
        .channels
        .ok_or("Audio file has no channel info")?
        .count() as u16;

    // Get total duration for progress reporting
    let total_frames = codec_params.n_frames;

    let mut decoder = symphonia::default::get_codecs()
        .make(&codec_params, &DecoderOptions::default())
        .map_err(|e| format!("Failed to create audio decoder: unsupported feature: {e}"))?;

    let mut resampler = AudioResampler::new(sample_rate, channels)?;
    let mut output = Vec::new();
    let mut last_progress_time = Instant::now();
    let mut frames_decoded: u64 = 0;

    loop {
        // Check for cancellation
        if let Some(token) = cancel_token {
            if token.load(Ordering::SeqCst) {
                return Err("Transcription cancelled".to_string());
            }
        }

        let packet = match format.next_packet() {
            Ok(packet) => packet,
            Err(symphonia::core::errors::Error::IoError(ref e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break;
            }
            Err(e) => return Err(format!("Error reading audio packet: {e}")),
        };

        if packet.track_id() != track_id {
            continue;
        }

        let decoded = match decoder.decode(&packet) {
            Ok(decoded) => decoded,
            Err(symphonia::core::errors::Error::DecodeError(e)) => {
                log::warn!("Decode error (skipping packet): {e}");
                continue;
            }
            Err(e) => return Err(format!("Fatal decode error: {e}")),
        };

        let spec = *decoded.spec();
        let duration = decoded.capacity();
        frames_decoded += duration as u64;

        let mut sample_buf = SampleBuffer::<f32>::new(duration as u64, spec);
        sample_buf.copy_interleaved_ref(decoded);
        let samples = sample_buf.samples();

        resampler.process(samples, &mut output);

        // Emit progress every ~100ms
        if last_progress_time.elapsed().as_millis() >= 100 {
            if let Some(total) = total_frames {
                let progress = (frames_decoded as f32 / total as f32 * 100.0).min(100.0);
                let _ = app.emit(events::FILE_DECODE_PROGRESS, progress);
            }
            last_progress_time = Instant::now();
        }
    }

    resampler.flush(&mut output);

    // Final progress
    let _ = app.emit(events::FILE_DECODE_PROGRESS, 100.0f32);

    log::info!(
        "Decoded {} samples ({:.2}s at 16kHz) from file",
        output.len(),
        output.len() as f32 / 16000.0
    );

    Ok(output)
}

/// Transcribe an audio file. Returns immediately; results arrive via events.
#[tauri::command]
pub async fn transcribe_file(
    app: AppHandle,
    engine: tauri::State<'_, EngineHandle>,
    file_state: tauri::State<'_, FileTranscriptionState>,
    path: String,
) -> Result<(), String> {
    // Validate file exists
    if !std::path::Path::new(&path).exists() {
        return Err("File does not exist".to_string());
    }

    // Check if online STT is configured
    let config = crate::config::load_config();
    let is_online = super::online::is_online_stt(&config);

    if !is_online {
        // Local whisper checks
        if engine.is_busy() {
            return Err("Whisper is busy".to_string());
        }
        if engine.current_model().is_none() {
            return Err("No model loaded".to_string());
        }
    }

    let cancel_token = file_state.new_cancel_token();

    if is_online {
        // Online path: read file bytes, upload to API
        let cancel = cancel_token.clone();
        let app_clone = app.clone();
        let file_state_inner = file_state.inner().clone();
        tauri::async_runtime::spawn(async move {
            let result = run_online_file_transcription(&app_clone, &config, &path, &cancel).await;
            file_state_inner.clear();
            match result {
                Ok(text) => {
                    let _ = app_clone.emit(events::TRANSCRIPTION_COMPLETE, &text);
                }
                Err(e) => {
                    log::error!("Online file transcription failed: {e}");
                    let _ = app_clone.emit(events::FILE_TRANSCRIPTION_ERROR, &e);
                }
            }
        });
    } else {
        // Local whisper path
        let engine_client = engine.client();
        let cancel = cancel_token.clone();
        let file_state_inner = file_state.inner().clone();

        std::thread::spawn(move || {
            let result = run_local_file_transcription(&app, &path, &cancel, &engine_client);
            file_state_inner.clear();

            if let Err(e) = result {
                log::error!("File transcription failed: {e}");
                let _ = app.emit(events::FILE_TRANSCRIPTION_ERROR, &e);
            }
        });
    }

    Ok(())
}

/// Decode audio and submit to local whisper for transcription
fn run_local_file_transcription(
    app: &AppHandle,
    path: &str,
    cancel_token: &Arc<AtomicBool>,
    engine_client: &super::engine::EngineClient,
) -> Result<(), String> {
    let audio = decode_audio_file(path, app, Some(cancel_token))?;

    if audio.is_empty() {
        return Err("No audio decoded from file".to_string());
    }

    let _ = app.emit(events::FILE_TRANSCRIPTION_STARTED, ());

    engine_client.transcribe(audio, None)?;
    Ok(())
}

/// Map a file extension to its MIME content type
fn content_type_for_ext(ext: &str) -> &'static str {
    match ext.to_lowercase().as_str() {
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "flac" => "audio/flac",
        "ogg" => "audio/ogg",
        "m4a" | "aac" => "audio/mp4",
        "aiff" | "aif" => "audio/aiff",
        _ => "audio/wav",
    }
}

/// Run online transcription for a file
async fn run_online_file_transcription(
    app: &AppHandle,
    config: &crate::config::Config,
    path: &str,
    cancel_token: &Arc<AtomicBool>,
) -> Result<String, String> {
    if cancel_token.load(Ordering::SeqCst) {
        return Err("Transcription cancelled".to_string());
    }

    let _ = app.emit(events::FILE_TRANSCRIPTION_STARTED, ());

    let file_bytes = std::fs::read(path)
        .map_err(|e| format!("Failed to read file: {e}"))?;

    if cancel_token.load(Ordering::SeqCst) {
        return Err("Transcription cancelled".to_string());
    }

    let file_path = std::path::Path::new(path);
    let ext = file_path.extension().and_then(|e| e.to_str()).unwrap_or("wav");
    let content_type = content_type_for_ext(ext);
    let filename = file_path.file_name().and_then(|n| n.to_str()).unwrap_or("audio.wav");

    super::online::transcribe_online(config, file_bytes, filename, content_type).await
}

/// Cancel an in-progress file transcription.
#[tauri::command]
pub fn cancel_file_transcription(
    file_state: tauri::State<'_, FileTranscriptionState>,
) {
    log::info!("Cancelling file transcription");
    file_state.cancel();
}

/// Save text to a file alongside the source audio file.
#[tauri::command]
pub fn save_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, &contents).map_err(|e| format!("Failed to write file: {e}"))
}

/// Clone implementation for use in async tasks that need owned state
impl Clone for FileTranscriptionState {
    fn clone(&self) -> Self {
        let guard = self.cancel_token.lock().unwrap_or_else(|e| e.into_inner());
        Self {
            cancel_token: Mutex::new(guard.clone()),
        }
    }
}
