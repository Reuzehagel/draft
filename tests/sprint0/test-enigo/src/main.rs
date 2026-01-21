//! Sprint 0 Task 0.3: Verify enigo text injection works
//!
//! This program tests text injection into applications like Notepad.
//! It gives you 3 seconds to focus a text field before injecting text.

use enigo::{Enigo, Settings, Keyboard};
use std::thread::sleep;
use std::time::Duration;

fn main() {
    println!("enigo text injection verification");
    println!("==================================\n");

    println!("Open Notepad or another text editor and click in the text area.");
    println!("Text will be injected in 3 seconds...\n");

    for i in (1..=3).rev() {
        println!("{}...", i);
        sleep(Duration::from_secs(1));
    }

    let mut enigo = Enigo::new(&Settings::default()).expect("Failed to create Enigo instance");

    // Test ASCII text
    println!("\nInjecting ASCII text...");
    enigo.text("Hello from Draft! ").expect("Failed to inject ASCII text");

    // Test Unicode characters
    println!("Injecting Unicode text...");
    enigo.text("Café résumé naïve ").expect("Failed to inject Unicode text");

    // Test special characters
    println!("Injecting special characters...");
    enigo.text("Test: @#$%^&*() ").expect("Failed to inject special characters");

    // Test emoji (if supported)
    println!("Injecting emoji...");
    enigo.text("🎉✨🚀").expect("Failed to inject emoji");

    println!("\nText injection complete!");
    println!("\nExpected text in editor:");
    println!("Hello from Draft! Café résumé naïve Test: @#$%^&*() 🎉✨🚀");
    println!("\nBuild verification successful if text appears correctly!");
}
