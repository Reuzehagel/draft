//! ElevenLabs STT client
//! Multipart form with xi-api-key header

use std::time::Duration;

use serde_json::Value;

const TIMEOUT: Duration = Duration::from_secs(120);

pub async fn transcribe(
    base_url: &str,
    api_key: &str,
    model: &str,
    audio_bytes: Vec<u8>,
    filename: &str,
    content_type: &str,
    diarize: bool,
) -> Result<String, String> {
    let url = format!("{base_url}/speech-to-text");

    let file_part = reqwest::multipart::Part::bytes(audio_bytes)
        .file_name(filename.to_string())
        .mime_str(content_type)
        .map_err(|e| format!("Invalid content type: {e}"))?;

    let mut form = reqwest::multipart::Form::new()
        .text("model_id", model.to_string())
        .part("file", file_part);

    if diarize {
        form = form.text("diarize", "true");
    }

    let response = reqwest::Client::new()
        .post(&url)
        .header("xi-api-key", api_key)
        .timeout(TIMEOUT)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("ElevenLabs request failed: {e}"))?;

    let status = response.status();
    let body = response.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!("ElevenLabs API error {status}: {body}"));
    }

    let json: Value = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse ElevenLabs response: {e}"))?;

    if diarize {
        format_diarized(&json)
    } else {
        json["text"]
            .as_str()
            .map(|s| s.trim().to_string())
            .ok_or_else(|| format!("ElevenLabs response missing text: {body}"))
    }
}

/// Format diarized output from ElevenLabs word-level speaker IDs
fn format_diarized(json: &Value) -> Result<String, String> {
    let words = json["words"]
        .as_array()
        .ok_or("ElevenLabs diarization response missing words array")?;

    if words.is_empty() {
        return json["text"]
            .as_str()
            .map(|s| s.trim().to_string())
            .ok_or_else(|| "ElevenLabs response missing text".to_string());
    }

    let mut result = String::new();
    let mut current_speaker: Option<&str> = None;

    for word in words {
        let speaker = word["speaker_id"].as_str();
        let text = word["text"].as_str().unwrap_or("");

        if speaker != current_speaker {
            if !result.is_empty() {
                result.push(' ');
            }
            let label = speaker.unwrap_or("?");
            result.push_str(&format!("[Speaker {label}] "));
            current_speaker = speaker;
        } else if !result.is_empty() {
            result.push(' ');
        }

        result.push_str(text);
    }

    Ok(result)
}
