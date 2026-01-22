//! Model download implementation
//! Handles streaming downloads with progress, cancellation, and verification

use crate::events;
use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::Emitter;
use tokio::io::AsyncWriteExt;

use super::models::{ensure_models_dir, find_model, model_path, model_temp_path, model_url};

/// Progress event payload
#[derive(Clone, serde::Serialize)]
pub struct DownloadProgress {
    pub model: String,
    pub progress: u8,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
}

/// Check available disk space (returns available bytes)
fn get_available_space() -> Result<u64, String> {
    let models_dir = super::models::models_dir();
    // Use parent directory if models dir doesn't exist yet
    let check_path = if models_dir.exists() {
        models_dir
    } else {
        models_dir
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| std::path::PathBuf::from("."))
    };

    // On Windows, we can use the fs2 approach or just skip the check
    // For simplicity, we'll use a platform-specific check
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        let wide_path: Vec<u16> = check_path
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut free_bytes: u64 = 0;
        let mut total_bytes: u64 = 0;
        let mut total_free_bytes: u64 = 0;

        // GetDiskFreeSpaceExW
        #[link(name = "kernel32")]
        unsafe extern "system" {
            fn GetDiskFreeSpaceExW(
                lpDirectoryName: *const u16,
                lpFreeBytesAvailableToCaller: *mut u64,
                lpTotalNumberOfBytes: *mut u64,
                lpTotalNumberOfFreeBytes: *mut u64,
            ) -> i32;
        }

        unsafe {
            // Validate path is properly null-terminated before FFI call
            if wide_path.is_empty() || wide_path.last() != Some(&0) {
                return Err("Invalid path format for disk space check".to_string());
            }

            let result = GetDiskFreeSpaceExW(
                wide_path.as_ptr(),
                &mut free_bytes,
                &mut total_bytes,
                &mut total_free_bytes,
            );

            if result == 0 {
                // Include OS error for better diagnostics
                let error = std::io::Error::last_os_error();
                return Err(format!("Failed to get disk space: {}", error));
            }
        }

        Ok(free_bytes)
    }

    #[cfg(not(windows))]
    {
        // On Unix, use statvfs
        Ok(u64::MAX) // Skip check on non-Windows for now
    }
}

/// Download a model with progress updates
pub async fn download_model(
    app: tauri::AppHandle,
    model_id: &str,
    cancel_token: Arc<AtomicBool>,
) -> Result<(), String> {
    let model = find_model(model_id).ok_or_else(|| format!("Unknown model: {}", model_id))?;

    // Ensure models directory exists
    ensure_models_dir()?;

    // Check disk space (model size + 100MB buffer)
    let required_space = model.size + 100 * 1024 * 1024;
    let available_space = get_available_space()?;
    if available_space < required_space {
        return Err(format!(
            "Insufficient disk space. Need {} MB, have {} MB available",
            required_space / (1024 * 1024),
            available_space / (1024 * 1024)
        ));
    }

    let url = model_url(model.filename);
    let temp_path = model_temp_path(model.filename);
    let final_path = model_path(model.filename);

    log::info!("Starting download of {} from {}", model_id, url);

    // Create HTTP client and start download
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to connect: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed: HTTP {}", response.status()));
    }

    let total_bytes = response.content_length().unwrap_or(model.size);

    // Open temp file for writing
    let mut file = tokio::fs::File::create(&temp_path)
        .await
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    let mut hasher = Sha256::new();
    let mut downloaded_bytes: u64 = 0;
    let mut last_progress: u8 = 0;

    // Stream the download
    let mut stream = response.bytes_stream();

    while let Some(chunk_result) = stream.next().await {
        // Check for cancellation
        if cancel_token.load(Ordering::Relaxed) {
            log::info!("Download cancelled for {}", model_id);
            drop(file);
            let _ = tokio::fs::remove_file(&temp_path).await;
            return Err("Download cancelled".to_string());
        }

        let chunk = chunk_result.map_err(|e| format!("Download error: {}", e))?;

        // Write to file
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write: {}", e))?;

        // Update hash
        hasher.update(&chunk);

        // Update progress
        downloaded_bytes += chunk.len() as u64;
        let progress = ((downloaded_bytes as f64 / total_bytes as f64) * 100.0) as u8;

        // Emit progress event if changed
        if progress != last_progress {
            last_progress = progress;
            let _ = app.emit(
                events::DOWNLOAD_PROGRESS,
                DownloadProgress {
                    model: model_id.to_string(),
                    progress,
                    downloaded_bytes,
                    total_bytes,
                },
            );
        }
    }

    // Flush and close file
    file.flush()
        .await
        .map_err(|e| format!("Failed to flush: {}", e))?;
    drop(file);

    // Verify checksum
    let hash = hex::encode(hasher.finalize());
    if hash != model.sha256 {
        log::error!(
            "Checksum mismatch for {}: expected {}, got {}",
            model_id,
            model.sha256,
            hash
        );
        let _ = tokio::fs::remove_file(&temp_path).await;
        return Err("Download corrupted, please retry".to_string());
    }

    log::info!("Checksum verified for {}", model_id);

    // Atomic rename to final path
    tokio::fs::rename(&temp_path, &final_path)
        .await
        .map_err(|e| format!("Failed to save model: {}", e))?;

    log::info!("Successfully downloaded {} to {:?}", model_id, final_path);

    // Emit 100% progress
    let _ = app.emit(
        events::DOWNLOAD_PROGRESS,
        DownloadProgress {
            model: model_id.to_string(),
            progress: 100,
            downloaded_bytes: total_bytes,
            total_bytes,
        },
    );

    Ok(())
}
