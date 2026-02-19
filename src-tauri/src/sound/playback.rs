//! Audio playback for sound effects using rodio
//!
//! `OutputStream` (cpal) is not `Send`/`Sync`, so we create it on a dedicated
//! thread and communicate via a channel. The `SoundPlayer` wrapper holds only
//! the sender, which *is* `Send + Sync` and safe for Tauri managed state.

use std::io::Cursor;
use std::sync::mpsc;

use rodio::{Decoder, OutputStream, Sink};

/// Message sent to the playback thread.
struct PlayCmd {
    wav_data: &'static [u8],
    volume: f32,
}

/// Thread-safe handle for playing sound effects.
/// Sends commands to a background thread that owns the rodio `OutputStream`.
pub struct SoundPlayer {
    tx: mpsc::Sender<PlayCmd>,
}

impl SoundPlayer {
    /// Try to create a SoundPlayer. Returns `None` if no output device is available.
    pub fn try_new() -> Option<Self> {
        let (tx, rx) = mpsc::channel::<PlayCmd>();
        // Use a oneshot to learn whether the thread successfully opened the output device.
        let (ready_tx, ready_rx) = mpsc::channel::<bool>();

        std::thread::Builder::new()
            .name("sound-effects".into())
            .spawn(move || {
                // Create the output stream on this thread (it's !Send)
                let (_stream, handle) = match OutputStream::try_default() {
                    Ok(pair) => {
                        let _ = ready_tx.send(true);
                        pair
                    }
                    Err(e) => {
                        log::warn!("No audio output device for sound effects: {}", e);
                        let _ = ready_tx.send(false);
                        return;
                    }
                };

                while let Ok(cmd) = rx.recv() {
                    let cursor = Cursor::new(cmd.wav_data);
                    let source = match Decoder::new(cursor) {
                        Ok(s) => s,
                        Err(e) => {
                            log::warn!("Failed to decode sound effect: {}", e);
                            continue;
                        }
                    };

                    let sink = match Sink::try_new(&handle) {
                        Ok(s) => s,
                        Err(e) => {
                            log::warn!("Failed to create audio sink: {}", e);
                            continue;
                        }
                    };

                    sink.set_volume(cmd.volume);
                    sink.append(source);
                    sink.detach(); // fire-and-forget
                }
            })
            .ok()?;

        // Wait for the thread to report whether it opened the device
        if ready_rx.recv().unwrap_or(false) {
            Some(Self { tx })
        } else {
            None
        }
    }

    /// Play embedded WAV data at the given volume (0.0–1.0). Non-blocking.
    pub fn play(&self, wav_data: &'static [u8], volume: f32) {
        let _ = self.tx.send(PlayCmd { wav_data, volume });
    }
}
