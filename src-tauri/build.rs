fn main() {
  // Re-run build when sound effect assets change (they're embedded via include_bytes!)
  for name in ["start", "done", "error", "confirm"] {
    println!("cargo:rerun-if-changed=src/sound/assets/{name}.wav");
  }
  tauri_build::build()
}
