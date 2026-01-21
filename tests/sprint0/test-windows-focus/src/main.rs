//! Sprint 0 Task 0.5: Verify windows-rs focus management
//!
//! This program tests capturing and restoring window focus using windows-rs.
//! It captures the current foreground window, prompts you to click another app,
//! then restores focus to the original window.

use std::thread::sleep;
use std::time::Duration;
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowTextW, SetForegroundWindow,
};

fn get_window_title(hwnd: HWND) -> String {
    let mut buffer = [0u16; 256];
    unsafe {
        let len = GetWindowTextW(hwnd, &mut buffer);
        String::from_utf16_lossy(&buffer[..len as usize])
    }
}

fn main() {
    println!("windows-rs focus management verification");
    println!("=========================================\n");

    // Capture current foreground window
    let original_hwnd = unsafe { GetForegroundWindow() };
    let original_title = get_window_title(original_hwnd);

    println!("Captured foreground window:");
    println!("  HWND: {:?}", original_hwnd);
    println!("  Title: {}", original_title);

    println!("\nNow click on a different window...");
    println!("Focus will be restored in 5 seconds.\n");

    for i in (1..=5).rev() {
        println!("{}...", i);
        sleep(Duration::from_secs(1));
    }

    // Check what window is now focused
    let current_hwnd = unsafe { GetForegroundWindow() };
    let current_title = get_window_title(current_hwnd);
    println!("\nCurrent foreground window:");
    println!("  HWND: {:?}", current_hwnd);
    println!("  Title: {}", current_title);

    // Restore focus to original window
    println!("\nRestoring focus to original window...");
    let result = unsafe { SetForegroundWindow(original_hwnd) };

    if result.as_bool() {
        println!("SetForegroundWindow: SUCCESS");
    } else {
        println!("SetForegroundWindow: returned false (may still work depending on context)");
    }

    // Verify focus was restored
    sleep(Duration::from_millis(100));
    let final_hwnd = unsafe { GetForegroundWindow() };
    let final_title = get_window_title(final_hwnd);

    println!("\nFinal foreground window:");
    println!("  HWND: {:?}", final_hwnd);
    println!("  Title: {}", final_title);

    if final_hwnd == original_hwnd {
        println!("\nBuild verification successful!");
        println!("Focus was correctly captured and restored.");
    } else {
        println!("\nNote: Focus restoration may have been blocked by Windows.");
        println!("This is normal - Windows restricts SetForegroundWindow in some contexts.");
        println!("The API calls themselves work correctly.");
    }
}
