//! Deepgram STT client
//! Uses binary body upload with query parameters

use std::time::Duration;

use serde_json::Value;

const TIMEOUT: Duration = Duration::from_secs(120);

pub async fn transcribe(
    base_url: &str,
    api_key: &str,
    model: &str,
    audio_bytes: Vec<u8>,
    content_type: &str,
    diarize: bool,
) -> Result<String, String> {
    let url = format!(
        "{base_url}/listen?model={model}&smart_format=true&diarize={diarize}"
    );

    let response = reqwest::Client::new()
        .post(&url)
        .header("Authorization", format!("Token {api_key}"))
        .header("Content-Type", content_type)
        .timeout(TIMEOUT)
        .body(audio_bytes)
        .send()
        .await
        .map_err(|e| format!("Deepgram request failed: {e}"))?;

    let status = response.status();
    let body = response.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!("Deepgram API error {status}: {body}"));
    }

    let json: Value = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse Deepgram response: {e}"))?;

    if diarize {
        format_diarized(&json)
    } else {
        json["results"]["channels"][0]["alternatives"][0]["transcript"]
            .as_str()
            .map(|s| s.trim().to_string())
            .ok_or_else(|| format!("Deepgram response missing transcript: {body}"))
    }
}

/// Format diarized output from Deepgram's word-level speaker labels
fn format_diarized(json: &Value) -> Result<String, String> {
    let words = json["results"]["channels"][0]["alternatives"][0]["words"]
        .as_array()
        .ok_or("Deepgram diarization response missing words array")?;

    if words.is_empty() {
        return Ok(String::new());
    }

    let mut result = String::new();
    let mut current_speaker: Option<i64> = None;

    for word in words {
        let speaker = word["speaker"].as_i64();
        let text = word["punctuated_word"]
            .as_str()
            .or_else(|| word["word"].as_str())
            .unwrap_or("");

        if speaker != current_speaker {
            if !result.is_empty() {
                result.push(' ');
            }
            let speaker_num = speaker.unwrap_or(0) + 1;
            result.push_str(&format!("[Speaker {speaker_num}] "));
            current_speaker = speaker;
        } else if !result.is_empty() {
            result.push(' ');
        }

        result.push_str(text);
    }

    Ok(result)
}
