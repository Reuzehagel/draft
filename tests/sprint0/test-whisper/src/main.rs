//! Sprint 0 Task 0.1: Verify whisper-rs builds on Windows
//!
//! This minimal program verifies that whisper-rs can be compiled and linked
//! on Windows with the CMake/MSVC toolchain.

use whisper_rs::{WhisperContext, WhisperContextParameters};

fn main() {
    println!("whisper-rs build verification");
    println!("==============================");

    // Just verify the types are accessible - we don't need to actually run inference
    // since we don't have a model file yet
    println!("WhisperContext type: accessible");
    println!("WhisperContextParameters type: accessible");

    // Create default parameters to verify the API works
    let _params = WhisperContextParameters::default();
    println!("WhisperContextParameters::default(): OK");

    println!("\nBuild verification successful!");
    println!("whisper-rs compiles and links correctly on Windows.");
}
