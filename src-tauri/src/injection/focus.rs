//! Window focus capture and restoration
//! Uses Windows API to track the foreground window before recording starts

use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, IsWindow, SetForegroundWindow};

/// Capture the current foreground window handle
/// Returns 0 if no window is in focus
pub fn capture_foreground_window() -> isize {
    unsafe {
        let hwnd = GetForegroundWindow();
        hwnd.0 as isize
    }
}

/// Restore focus to a previously captured window
/// Returns true if focus was successfully restored, false otherwise
pub fn restore_focus(hwnd: isize) -> bool {
    if hwnd == 0 {
        return false;
    }
    unsafe {
        let hwnd_ptr = HWND(hwnd as *mut _);
        // Validate window still exists before attempting to focus
        if !IsWindow(Some(hwnd_ptr)).as_bool() {
            return false;
        }
        SetForegroundWindow(hwnd_ptr).as_bool()
    }
}
