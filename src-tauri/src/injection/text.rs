//! Text injection using enigo
//! Simulates keyboard input to inject transcribed text

use std::borrow::Cow;

use enigo::{Enigo, Keyboard, Settings};

/// Inject text into the currently focused application
/// If trailing_space is true, adds a space after the text
pub fn inject_text(text: &str, trailing_space: bool) -> Result<(), String> {
    if text.is_empty() {
        return Ok(());
    }

    let mut enigo =
        Enigo::new(&Settings::default()).map_err(|e| format!("Failed to create Enigo: {}", e))?;

    // Use Cow to avoid allocation when trailing_space is false
    let text_to_inject: Cow<str> = if trailing_space {
        Cow::Owned(format!("{} ", text))
    } else {
        Cow::Borrowed(text)
    };

    enigo
        .text(&text_to_inject)
        .map_err(|e| format!("Failed to inject text: {}", e))
}
