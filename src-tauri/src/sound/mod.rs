//! Sound effects module
//! Plays short audio cues at key recording state transitions.

mod playback;

pub use playback::SoundPlayer;

use crate::config::{load_config, Config};

// Embedded WAV data
const START_WAV: &[u8] = include_bytes!("assets/start.wav");
const DONE_WAV: &[u8] = include_bytes!("assets/done.wav");
const ERROR_WAV: &[u8] = include_bytes!("assets/error.wav");
const CONFIRM_WAV: &[u8] = include_bytes!("assets/confirm.wav");

/// Sound effects triggered at state transitions
pub enum SoundEffect {
    Start,
    Done,
    Error,
    Confirm,
}

impl SoundEffect {
    fn wav_data(&self) -> &'static [u8] {
        match self {
            Self::Start => START_WAV,
            Self::Done => DONE_WAV,
            Self::Error => ERROR_WAV,
            Self::Confirm => CONFIRM_WAV,
        }
    }

    fn is_enabled(&self, config: &Config) -> bool {
        match self {
            Self::Start => config.sound_start_enabled,
            Self::Done => config.sound_done_enabled,
            Self::Error => config.sound_error_enabled,
            Self::Confirm => config.sound_confirm_enabled,
        }
    }
}

/// Play a sound effect if the player is available and sounds are enabled in config.
pub fn play_if_enabled(player: &Option<SoundPlayer>, effect: SoundEffect) {
    let Some(player) = player.as_ref() else {
        return;
    };
    let config = load_config();
    if !config.sound_effects_enabled || !effect.is_enabled(&config) {
        return;
    }
    player.play(effect.wav_data(), config.sound_volume);
}

/// Tauri command: play the "done" sound for testing from the settings UI.
#[tauri::command]
pub fn test_sound(player: tauri::State<'_, Option<SoundPlayer>>) {
    let Some(player) = player.inner().as_ref() else {
        log::warn!("No audio output device for sound test");
        return;
    };
    let config = load_config();
    player.play(DONE_WAV, config.sound_volume);
}
