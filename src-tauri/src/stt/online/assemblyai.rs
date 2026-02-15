//! AssemblyAI STT client
//! Three-step process: upload → submit → poll

use std::time::Duration;

use serde_json::{json, Value};

const TIMEOUT: Duration = Duration::from_secs(30);
const POLL_INTERVAL: Duration = Duration::from_secs(2);
const MAX_POLL_DURATION: Duration = Duration::from_secs(300); // 5 minutes

pub async fn transcribe(
    base_url: &str,
    api_key: &str,
    audio_bytes: Vec<u8>,
    diarize: bool,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    // Step 1: Upload audio
    let upload_url = format!("{base_url}/upload");
    let upload_response = client
        .post(&upload_url)
        .header("Authorization", api_key)
        .header("Content-Type", "application/octet-stream")
        .timeout(Duration::from_secs(120))
        .body(audio_bytes)
        .send()
        .await
        .map_err(|e| format!("AssemblyAI upload failed: {e}"))?;

    let status = upload_response.status();
    let body = upload_response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("AssemblyAI upload error {status}: {body}"));
    }

    let upload_json: Value = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse upload response: {e}"))?;
    let audio_url = upload_json["upload_url"]
        .as_str()
        .ok_or_else(|| format!("AssemblyAI upload response missing upload_url: {body}"))?;

    // Step 2: Submit transcription job
    let transcript_url = format!("{base_url}/transcript");
    let submit_body = json!({
        "audio_url": audio_url,
        "speaker_labels": diarize,
    });

    let submit_response = client
        .post(&transcript_url)
        .header("Authorization", api_key)
        .header("Content-Type", "application/json")
        .timeout(TIMEOUT)
        .json(&submit_body)
        .send()
        .await
        .map_err(|e| format!("AssemblyAI submit failed: {e}"))?;

    let status = submit_response.status();
    let body = submit_response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("AssemblyAI submit error {status}: {body}"));
    }

    let submit_json: Value = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse submit response: {e}"))?;
    let transcript_id = submit_json["id"]
        .as_str()
        .ok_or_else(|| format!("AssemblyAI submit response missing id: {body}"))?;

    // Step 3: Poll until complete
    let poll_url = format!("{base_url}/transcript/{transcript_id}");
    let start = std::time::Instant::now();

    loop {
        if start.elapsed() > MAX_POLL_DURATION {
            return Err("AssemblyAI transcription timed out".to_string());
        }

        tokio::time::sleep(POLL_INTERVAL).await;

        let poll_response = client
            .get(&poll_url)
            .header("Authorization", api_key)
            .timeout(TIMEOUT)
            .send()
            .await
            .map_err(|e| format!("AssemblyAI poll failed: {e}"))?;

        let status = poll_response.status();
        let body = poll_response.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(format!("AssemblyAI poll error {status}: {body}"));
        }

        let poll_json: Value = serde_json::from_str(&body)
            .map_err(|e| format!("Failed to parse poll response: {e}"))?;

        match poll_json["status"].as_str() {
            Some("completed") => {
                if diarize {
                    return format_diarized(&poll_json);
                }
                return poll_json["text"]
                    .as_str()
                    .map(|s| s.trim().to_string())
                    .ok_or_else(|| format!("AssemblyAI response missing text: {body}"));
            }
            Some("error") => {
                let error = poll_json["error"].as_str().unwrap_or("Unknown error");
                return Err(format!("AssemblyAI transcription failed: {error}"));
            }
            _ => continue, // queued or processing
        }
    }
}

/// Format diarized output from AssemblyAI's utterances
fn format_diarized(json: &Value) -> Result<String, String> {
    let utterances = json["utterances"]
        .as_array()
        .ok_or("AssemblyAI diarization response missing utterances")?;

    let mut result = String::new();

    for utterance in utterances {
        let speaker = utterance["speaker"]
            .as_str()
            .unwrap_or("?");
        let text = utterance["text"]
            .as_str()
            .unwrap_or("");

        if !result.is_empty() {
            result.push(' ');
        }
        result.push_str(&format!("[Speaker {speaker}] {text}"));
    }

    Ok(result)
}
