//! Text injection module
//! Handles capturing window focus and injecting transcribed text

mod focus;
mod text;

pub use focus::{capture_foreground_window, restore_focus};
pub use text::inject_text;
