//! Model download implementation
//! Handles streaming downloads with progress, cancellation, and verification
//! Supports both single-file (Whisper GGML) and archive (Parakeet ONNX) models

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
    let check_path = if models_dir.exists() {
        models_dir
    } else {
        models_dir
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| std::path::PathBuf::from("."))
    };

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
                let error = std::io::Error::last_os_error();
                return Err(format!("Failed to get disk space: {}", error));
            }
        }

        Ok(free_bytes)
    }

    #[cfg(not(windows))]
    {
        Ok(u64::MAX)
    }
}

/// Extract a tar.gz archive to a directory
fn extract_archive(archive_path: &std::path::Path, target_dir: &std::path::Path) -> Result<(), String> {
    use std::fs;

    let file = fs::File::open(archive_path)
        .map_err(|e| format!("Failed to open archive: {}", e))?;

    let gz = flate2::read::GzDecoder::new(file);
    let mut archive = tar::Archive::new(gz);

    // Extract to a temporary directory first
    let extracting_dir = target_dir.with_extension("extracting");
    if extracting_dir.exists() {
        let _ = fs::remove_dir_all(&extracting_dir);
    }
    fs::create_dir_all(&extracting_dir)
        .map_err(|e| format!("Failed to create extraction directory: {}", e))?;

    archive.unpack(&extracting_dir)
        .map_err(|e| format!("Failed to extract archive: {}", e))?;

    // Check if archive contained a single subdirectory (common pattern)
    let entries: Vec<_> = fs::read_dir(&extracting_dir)
        .map_err(|e| format!("Failed to read extraction dir: {}", e))?
        .filter_map(|e| e.ok())
        .collect();

    if entries.len() == 1 && entries[0].path().is_dir() {
        // Single subdirectory: move it to the target
        let inner_dir = entries[0].path();
        if target_dir.exists() {
            let _ = fs::remove_dir_all(target_dir);
        }
        fs::rename(&inner_dir, target_dir)
            .map_err(|e| format!("Failed to move extracted directory: {}", e))?;
        let _ = fs::remove_dir_all(&extracting_dir);
    } else {
        // Multiple files: rename the extracting dir to target
        if target_dir.exists() {
            let _ = fs::remove_dir_all(target_dir);
        }
        fs::rename(&extracting_dir, target_dir)
            .map_err(|e| format!("Failed to rename extraction directory: {}", e))?;
    }

    Ok(())
}

/// Download a model with progress updates
pub async fn download_model(
    app: tauri::AppHandle,
    model_id: &str,
    cancel_token: Arc<AtomicBool>,
) -> Result<(), String> {
    let model = find_model(model_id).ok_or_else(|| format!("Unknown model: {}", model_id))?;

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

    let url = model_url(model);
    let temp_path = model_temp_path(model.filename);
    let final_path = model_path(model.filename);

    log::info!("Starting download of {} from {}", model_id, url);

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

    let mut file = tokio::fs::File::create(&temp_path)
        .await
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    let mut hasher = Sha256::new();
    let mut downloaded_bytes: u64 = 0;
    let mut last_progress: u8 = 0;

    let mut stream = response.bytes_stream();

    while let Some(chunk_result) = stream.next().await {
        if cancel_token.load(Ordering::Relaxed) {
            log::info!("Download cancelled for {}", model_id);
            drop(file);
            let _ = tokio::fs::remove_file(&temp_path).await;
            return Err("Download cancelled".to_string());
        }

        let chunk = chunk_result.map_err(|e| format!("Download error: {}", e))?;

        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write: {}", e))?;

        hasher.update(&chunk);

        downloaded_bytes += chunk.len() as u64;
        let progress = ((downloaded_bytes as f64 / total_bytes as f64) * 100.0).round().min(100.0) as u8;

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

    if model.is_archive {
        // Extract archive to directory
        let temp = temp_path.clone();
        let final_dir = final_path.clone();
        tokio::task::spawn_blocking(move || extract_archive(&temp, &final_dir))
            .await
            .map_err(|e| format!("Extraction task failed: {}", e))?
            .map_err(|e| format!("Failed to extract model: {}", e))?;

        // Clean up the archive file
        let _ = tokio::fs::remove_file(&temp_path).await;
    } else {
        // Atomic rename for single-file models
        tokio::fs::rename(&temp_path, &final_path)
            .await
            .map_err(|e| format!("Failed to save model: {}", e))?;
    }

    log::info!("Successfully downloaded {} to {:?}", model_id, final_path);

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
