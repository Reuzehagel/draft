//! Tauri commands for LLM operations

use crate::config;

use super::LlmProvider;
use super::client;
use super::process::DEFAULT_SYSTEM_PROMPT;

/// Enhance text through the configured LLM provider.
/// Unlike auto-processing, this is explicitly user-triggered so it ignores the `llm_auto_process` flag.
#[tauri::command]
pub async fn enhance_text(text: String) -> Result<String, String> {
    let cfg = config::load_config();

    let provider_str = cfg
        .llm_provider
        .as_deref()
        .ok_or("No LLM provider configured")?;

    let provider: LlmProvider = provider_str
        .parse()
        .map_err(|e: String| e)?;

    let api_key = cfg
        .llm_api_key
        .as_deref()
        .filter(|k| !k.is_empty())
        .ok_or("No API key configured")?;

    let model = cfg
        .llm_model
        .as_deref()
        .filter(|m| !m.is_empty())
        .unwrap_or(provider.default_model());

    let system_prompt = cfg
        .llm_system_prompt
        .as_deref()
        .filter(|p| !p.is_empty())
        .unwrap_or(DEFAULT_SYSTEM_PROMPT);

    log::info!("Enhance text with {provider_str} ({model})");

    let result = if provider.uses_openai_format() {
        client::call_openai_compatible(provider.base_url(), api_key, model, system_prompt, &text)
            .await
    } else {
        client::call_anthropic(provider.base_url(), api_key, model, system_prompt, &text).await
    };

    match result {
        Ok(enhanced) if !enhanced.is_empty() => Ok(enhanced),
        Ok(_) => Err("LLM returned empty response".to_string()),
        Err(e) => Err(e),
    }
}
