//! OpenAI and Mistral STT client
//! Both use the same multipart form API shape
//! Mistral additionally supports diarization via a `diarize` form field

use std::time::Duration;

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
    let url = format!("{base_url}/audio/transcriptions");

    let file_part = reqwest::multipart::Part::bytes(audio_bytes)
        .file_name(filename.to_string())
        .mime_str(content_type)
        .map_err(|e| format!("Invalid content type: {e}"))?;

    let mut form = reqwest::multipart::Form::new()
        .text("model", model.to_string())
        .text("response_format", "json")
        .part("file", file_part);

    // Mistral supports diarization via form field (OpenAI ignores unknown fields)
    if diarize {
        form = form.text("diarize", "true");
    }

    let response = reqwest::Client::new()
        .post(&url)
        .header("Authorization", format!("Bearer {api_key}"))
        .timeout(TIMEOUT)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("STT request failed: {e}"))?;

    let status = response.status();
    let body = response.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!("STT API error {status}: {body}"));
    }

    let json: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse STT response: {e}"))?;

    json["text"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| format!("STT response missing 'text' field: {body}"))
}
