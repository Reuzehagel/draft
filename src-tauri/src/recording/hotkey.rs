//! Hotkey validation and registration
//! Handles parsing, validating, and registering global shortcuts

use std::sync::{Arc, Mutex};
use tauri::AppHandle;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use super::state::RecordingManager;

/// Keys that are allowed without modifiers (function keys)
const BARE_KEYS: &[&str] = &[
    "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
    "F13", "F14", "F15", "F16", "F17", "F18", "F19", "F20", "F21", "F22", "F23", "F24",
];

/// Keys that are modifiers only (not allowed as standalone)
const MODIFIER_KEYS: &[&str] = &["Ctrl", "Alt", "Shift", "Meta", "Control", "Super", "CommandOrControl"];

/// Manager for hotkey registration
pub struct HotkeyManager {
    current_shortcut: Arc<Mutex<Option<Shortcut>>>,
}

impl Default for HotkeyManager {
    fn default() -> Self {
        Self::new()
    }
}

impl HotkeyManager {
    pub fn new() -> Self {
        Self {
            current_shortcut: Arc::new(Mutex::new(None)),
        }
    }

    /// Register a hotkey and set up the press/release handlers
    pub fn register(
        &self,
        app: &AppHandle,
        hotkey: &str,
        recording_manager: Arc<RecordingManager>,
    ) -> Result<(), String> {
        // Validate the hotkey format first
        validate_hotkey(hotkey)?;

        // Unregister existing shortcut if any
        self.unregister(app)?;

        // Normalize and parse the hotkey
        let normalized = normalize_hotkey(hotkey);
        let shortcut: Shortcut = normalized
            .parse()
            .map_err(|e| format!("Failed to parse hotkey '{}': {:?}", normalized, e))?;

        // Register with press and release handling
        let manager_pressed = recording_manager.clone();
        let manager_released = recording_manager;
        let app_handle = app.clone();

        app.global_shortcut()
            .on_shortcut(shortcut.clone(), move |_app, _shortcut, event| {
                match event.state {
                    ShortcutState::Pressed => {
                        if let Err(e) = manager_pressed.on_hotkey_pressed(&app_handle) {
                            log::warn!("Failed to handle hotkey press: {}", e);
                        }
                    }
                    ShortcutState::Released => {
                        if let Err(e) = manager_released.on_hotkey_released(&app_handle) {
                            log::warn!("Failed to handle hotkey release: {}", e);
                        }
                    }
                }
            })
            .map_err(|e| format!("Failed to register hotkey: {}", e))?;

        // Store the shortcut for later unregistration
        let mut current = self.current_shortcut.lock().map_err(|_| "Lock poisoned")?;
        *current = Some(shortcut);

        log::info!("Hotkey registered: {}", hotkey);
        Ok(())
    }

    /// Unregister the current hotkey
    pub fn unregister(&self, app: &AppHandle) -> Result<(), String> {
        let mut current = self.current_shortcut.lock().map_err(|_| "Lock poisoned")?;

        if let Some(shortcut) = current.take() {
            app.global_shortcut()
                .unregister(shortcut)
                .map_err(|e| format!("Failed to unregister hotkey: {}", e))?;
            log::info!("Hotkey unregistered");
        }

        Ok(())
    }
}

/// Validate a hotkey string
/// Returns Ok(()) if valid, or an error message describing the problem
pub fn validate_hotkey(hotkey: &str) -> Result<(), String> {
    if hotkey.is_empty() {
        return Err("Hotkey cannot be empty".to_string());
    }

    let parts: Vec<&str> = hotkey.split('+').collect();

    // Check for empty parts (e.g., "Ctrl++D" or "Ctrl+")
    if parts.iter().any(|p| p.is_empty()) {
        return Err("Invalid hotkey format".to_string());
    }

    // Check if all parts are modifiers (not allowed)
    let all_modifiers = parts
        .iter()
        .all(|p| MODIFIER_KEYS.iter().any(|m| m.eq_ignore_ascii_case(p)));

    if all_modifiers {
        return Err("Hotkey must include a non-modifier key".to_string());
    }

    // Find the non-modifier keys
    let non_modifiers: Vec<&str> = parts
        .iter()
        .filter(|p| !MODIFIER_KEYS.iter().any(|m| m.eq_ignore_ascii_case(p)))
        .copied()
        .collect();

    // non_modifiers cannot be empty here since all_modifiers check above would have caught it

    if non_modifiers.len() > 1 {
        return Err("Hotkey can only have one non-modifier key".to_string());
    }

    let key = non_modifiers[0];

    // If there are no modifiers, only allow bare keys (function keys)
    let has_modifiers = parts.len() > 1;
    if !has_modifiers && !BARE_KEYS.iter().any(|b| b.eq_ignore_ascii_case(key)) {
        return Err(format!(
            "'{}' requires a modifier key (Ctrl, Alt, Shift, or Meta)",
            key
        ));
    }

    Ok(())
}

/// Normalize hotkey format for the global-shortcut plugin
/// Converts frontend format (e.g., "Ctrl+Shift+D") to plugin format ("CommandOrControl+Shift+D")
/// Uses token-based parsing to avoid replacing substrings (e.g., "CtrlKey" stays as "CtrlKey")
fn normalize_hotkey(hotkey: &str) -> String {
    hotkey
        .split('+')
        .map(|token| match token {
            "Ctrl" => "CommandOrControl",
            "Meta" => "Super",
            _ => token,
        })
        .collect::<Vec<_>>()
        .join("+")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_bare_function_keys() {
        assert!(validate_hotkey("F1").is_ok());
        assert!(validate_hotkey("F12").is_ok());
        assert!(validate_hotkey("F24").is_ok());
    }

    #[test]
    fn test_validate_modifier_combinations() {
        assert!(validate_hotkey("Ctrl+D").is_ok());
        assert!(validate_hotkey("Alt+Space").is_ok());
        assert!(validate_hotkey("Ctrl+Shift+D").is_ok());
        assert!(validate_hotkey("Ctrl+Alt+Shift+X").is_ok());
    }

    #[test]
    fn test_reject_modifier_only() {
        assert!(validate_hotkey("Ctrl").is_err());
        assert!(validate_hotkey("Shift").is_err());
        assert!(validate_hotkey("Ctrl+Shift").is_err());
        assert!(validate_hotkey("Ctrl+Alt+Shift").is_err());
    }

    #[test]
    fn test_reject_bare_regular_keys() {
        assert!(validate_hotkey("D").is_err());
        assert!(validate_hotkey("Space").is_err());
        assert!(validate_hotkey("A").is_err());
    }

    #[test]
    fn test_normalize_hotkey() {
        assert_eq!(normalize_hotkey("Ctrl+D"), "CommandOrControl+D");
        assert_eq!(normalize_hotkey("Meta+X"), "Super+X");
        assert_eq!(
            normalize_hotkey("Ctrl+Shift+D"),
            "CommandOrControl+Shift+D"
        );
    }

    #[test]
    fn test_normalize_does_not_replace_partial() {
        // Ensure we don't replace substrings within key names
        assert_eq!(normalize_hotkey("Ctrl+CtrlKey"), "CommandOrControl+CtrlKey");
        assert_eq!(normalize_hotkey("Ctrl+MetaKey"), "CommandOrControl+MetaKey");
    }

    #[test]
    fn test_validate_empty_parts() {
        assert!(validate_hotkey("Ctrl++D").is_err());
        assert!(validate_hotkey("Ctrl+").is_err());
        assert!(validate_hotkey("+D").is_err());
    }
}
