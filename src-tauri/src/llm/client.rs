//! HTTP clients for LLM API calls
//! Two code paths: OpenAI-compatible (shared by OpenAI, OpenRouter, Cerebras, Groq) and Anthropic

use std::time::Duration;

use serde_json::{json, Value};

const TIMEOUT: Duration = Duration::from_secs(15);
const BODY_PREVIEW_MAX: usize = 200;

/// Read and parse a JSON response body, with truncated preview on parse failure.
async fn read_json_body(response: reqwest::Response, provider: &str) -> Result<(Value, String), String> {
    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("{provider} API error {status}: {body}"));
    }

    let body_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read {provider} response body: {e}"))?;

    let json: Value = serde_json::from_str(&body_text).map_err(|e| {
        let preview = if body_text.len() > BODY_PREVIEW_MAX {
            // Find last valid char boundary at or before BODY_PREVIEW_MAX
            let mut end = BODY_PREVIEW_MAX;
            while !body_text.is_char_boundary(end) {
                end -= 1;
            }
            format!("{}...", &body_text[..end])
        } else {
            body_text.clone()
        };
        format!("Failed to parse {provider} response: {e} (body: {preview})")
    })?;

    Ok((json, body_text))
}

/// Extract a trimmed string from a JSON path, or return an error with the full body.
fn extract_content(json: &Value, path: &[&str], body_text: &str, provider: &str) -> Result<String, String> {
    let mut node = json;
    for key in path {
        node = match key.parse::<usize>() {
            Ok(idx) => &node[idx],
            Err(_) => &node[key],
        };
    }
    node.as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| format!("{provider} response missing content: {body_text}"))
}

/// Call an OpenAI-compatible chat completions API
pub async fn call_openai_compatible(
    base_url: &str,
    api_key: &str,
    model: &str,
    system_prompt: &str,
    user_text: &str,
) -> Result<String, String> {
    let url = format!("{base_url}/chat/completions");

    let body = json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": user_text }
        ],
        "temperature": 0.3,
        "max_tokens": 2048
    });

    let response = reqwest::Client::new()
        .post(&url)
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Content-Type", "application/json")
        .timeout(TIMEOUT)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("LLM request failed: {e}"))?;

    let (json, body_text) = read_json_body(response, "LLM").await?;
    extract_content(&json, &["choices", "0", "message", "content"], &body_text, "LLM")
}

/// Call the Anthropic Messages API
pub async fn call_anthropic(
    base_url: &str,
    api_key: &str,
    model: &str,
    system_prompt: &str,
    user_text: &str,
) -> Result<String, String> {
    let url = format!("{base_url}/messages");

    let body = json!({
        "model": model,
        "max_tokens": 2048,
        "temperature": 0.3,
        "system": system_prompt,
        "messages": [
            { "role": "user", "content": user_text }
        ]
    });

    let response = reqwest::Client::new()
        .post(&url)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .timeout(TIMEOUT)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Anthropic request failed: {e}"))?;

    let (json, body_text) = read_json_body(response, "Anthropic").await?;
    extract_content(&json, &["content", "0", "text"], &body_text, "Anthropic")
}
