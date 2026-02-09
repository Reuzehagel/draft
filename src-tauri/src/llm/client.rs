//! HTTP clients for LLM API calls
//! Two code paths: OpenAI-compatible (shared by OpenAI, OpenRouter, Cerebras, Groq) and Anthropic

use std::time::Duration;

use serde_json::{json, Value};

const TIMEOUT: Duration = Duration::from_secs(15);

/// Call an OpenAI-compatible chat completions API
pub async fn call_openai_compatible(
    base_url: &str,
    api_key: &str,
    model: &str,
    system_prompt: &str,
    user_text: &str,
) -> Result<String, String> {
    let url = format!("{}/chat/completions", base_url);

    let body = json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": user_text }
        ],
        "temperature": 0.3,
        "max_tokens": 2048
    });

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .timeout(TIMEOUT)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("LLM request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("LLM API error {}: {}", status, body));
    }

    let body_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read LLM response body: {}", e))?;

    let json: Value = serde_json::from_str(&body_text).map_err(|e| {
        let preview = if body_text.len() > 200 {
            format!("{}...", &body_text[..200])
        } else {
            body_text.clone()
        };
        format!("Failed to parse LLM response: {} (body: {})", e, preview)
    })?;

    json["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| format!("LLM response missing content: {}", body_text))
}

/// Call the Anthropic Messages API
pub async fn call_anthropic(
    api_key: &str,
    model: &str,
    system_prompt: &str,
    user_text: &str,
) -> Result<String, String> {
    let body = json!({
        "model": model,
        "max_tokens": 2048,
        "system": system_prompt,
        "messages": [
            { "role": "user", "content": user_text }
        ]
    });

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .timeout(TIMEOUT)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Anthropic request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Anthropic API error {}: {}", status, body));
    }

    let body_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read Anthropic response body: {}", e))?;

    let json: Value = serde_json::from_str(&body_text).map_err(|e| {
        let preview = if body_text.len() > 200 {
            format!("{}...", &body_text[..200])
        } else {
            body_text.clone()
        };
        format!(
            "Failed to parse Anthropic response: {} (body: {})",
            e, preview
        )
    })?;

    json["content"][0]["text"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| format!("Anthropic response missing content: {}", body_text))
}
