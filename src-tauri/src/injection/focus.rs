//! Window focus capture and restoration
//! Uses Windows API to track the foreground window before recording starts

use windows::Win32::Foundation::HWND;
use windows::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowThreadProcessId, IsWindow, SetForegroundWindow,
};

/// Capture the current foreground window handle
/// Returns 0 if no window is in focus
pub fn capture_foreground_window() -> isize {
    unsafe {
        let hwnd = GetForegroundWindow();
        hwnd.0 as isize
    }
}

/// Restore focus to a previously captured window
/// Uses AttachThreadInput to reliably set foreground even after long delays
/// (e.g. transcription + LLM processing), since the process may have lost
/// its "last input" privilege by then.
/// Returns true if focus was successfully restored, false otherwise
pub fn restore_focus(hwnd: isize) -> bool {
    if hwnd == 0 {
        return false;
    }
    unsafe {
        let hwnd_ptr = HWND(hwnd as *mut _);
        if !IsWindow(Some(hwnd_ptr)).as_bool() {
            return false;
        }

        let our_thread = GetCurrentThreadId();
        let fg_window = GetForegroundWindow();
        let fg_thread = GetWindowThreadProcessId(fg_window, None);

        // Attach to the foreground thread to borrow its input privilege
        let attached = fg_thread != our_thread
            && AttachThreadInput(our_thread, fg_thread, true).as_bool();

        let result = SetForegroundWindow(hwnd_ptr).as_bool();

        if attached {
            let _ = AttachThreadInput(our_thread, fg_thread, false);
        }

        result
    }
}
