//! LLM post-processing orchestration
//! Routes transcribed text through the configured LLM provider for cleanup or command execution

use tauri::AppHandle;

use crate::config::Config;

use super::LlmProvider;
use super::client;

const DEFAULT_SYSTEM_PROMPT: &str = "\
You are a dictation assistant cleaning up speech-to-text output.

Rules:
- If the text begins with an instruction (e.g., \"reply saying...\", \"clean up:\", \"make this professional:\", \"summarize:\", \"translate to...\"), follow that instruction applied to the rest of the text. Do NOT include the instruction itself in your output.
- Otherwise, clean up the text:
  - Fix punctuation and capitalization
  - Remove filler words and sounds (um, uh, like, you know, I guess, I mean, so yeah)
  - Remove false starts, repeated phrases, and self-corrections
  - Fix obvious speech recognition errors and misheard words
  - Preserve the speaker's intended meaning and tone
  - Do not add new information or change what the speaker meant to say
- Return ONLY the final text. No explanations, no quotes, no prefixes.";

/// Post-process transcribed text through an LLM.
/// Returns the original text if LLM is not configured, disabled, or fails.
/// Note: The caller emits LLM_PROCESSING before calling this function.
pub async fn post_process(raw_text: &str, config: &Config, _app: &AppHandle) -> String {
    // Skip if LLM is disabled or not configured
    if !config.llm_auto_process {
        return raw_text.to_string();
    }

    let provider_str = match &config.llm_provider {
        Some(p) => p.as_str(),
        None => return raw_text.to_string(),
    };

    let provider = match LlmProvider::from_str(provider_str) {
        Some(p) => p,
        None => {
            log::warn!("Unknown LLM provider: {}", provider_str);
            return raw_text.to_string();
        }
    };

    let api_key = match &config.llm_api_key {
        Some(key) if !key.is_empty() => key.as_str(),
        _ => {
            log::warn!("LLM API key not configured");
            return raw_text.to_string();
        }
    };

    let model = config
        .llm_model
        .as_deref()
        .filter(|m| !m.is_empty())
        .unwrap_or(provider.default_model());

    let system_prompt = config
        .llm_system_prompt
        .as_deref()
        .filter(|p| !p.is_empty())
        .unwrap_or(DEFAULT_SYSTEM_PROMPT);

    log::info!("LLM post-processing with {} ({})", provider_str, model);

    let result = if provider.uses_openai_format() {
        client::call_openai_compatible(provider.base_url(), api_key, model, system_prompt, raw_text)
            .await
    } else {
        client::call_anthropic(api_key, model, system_prompt, raw_text).await
    };

    match result {
        Ok(text) if !text.is_empty() => {
            log::info!("LLM result: \"{}\"", text);
            text
        }
        Ok(_) => {
            log::warn!("LLM returned empty response, falling back to raw text");
            raw_text.to_string()
        }
        Err(e) => {
            log::warn!("LLM post-processing failed, falling back to raw text: {}", e);
            raw_text.to_string()
        }
    }
}
