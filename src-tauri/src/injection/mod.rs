//! Text injection module
//! Handles capturing window focus and injecting transcribed text

mod clipboard;
mod focus;
mod text;

pub use clipboard::copy_to_clipboard;
pub use focus::{capture_foreground_window, restore_focus};
pub use text::inject_text;
