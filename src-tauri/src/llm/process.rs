//! LLM post-processing orchestration
//! Routes transcribed text through the configured LLM provider for cleanup or command execution

use crate::config::Config;

use super::LlmProvider;
use super::client;

const DEFAULT_SYSTEM_PROMPT: &str = "\
You are a minimal dictation cleanup tool. Keep the speaker's exact words — only fix genuine errors.

Rules:
- If the text begins with an instruction (e.g., \"reply saying...\", \"summarize:\", \"translate to...\"), follow that instruction on the rest of the text. Do NOT include the instruction itself in your output.
- Otherwise, apply ONLY these fixes:
  - Fix punctuation and capitalization
  - Fix words obviously misheard by speech recognition (e.g., wrong homophone)
  - Remove hesitation sounds: um, uh, hmm
  - Remove stuttered or repeated phrases where the speaker clearly said the same thing multiple times by mistake
- Do NOT rephrase, restructure, or reword anything
- Do NOT remove words the speaker intentionally said, even if informal or redundant (keep words like 'like', 'you know', 'I mean', 'so', 'basically')
- Do NOT add words that were not spoken
- Do NOT change vocabulary, sentence structure, or tone
- Return ONLY the cleaned text. No explanations, no quotes, no prefixes.";

/// Check whether LLM post-processing is enabled and fully configured.
pub fn should_process(config: &Config) -> bool {
    config.llm_auto_process
        && config.llm_provider.as_deref().and_then(|p| p.parse::<LlmProvider>().ok()).is_some()
        && config.llm_api_key.as_deref().is_some_and(|k| !k.is_empty())
}

/// Validate that LLM config has all required fields and parse the provider.
/// Returns (provider, api_key) or None if LLM processing should be skipped.
fn validate_llm_config(config: &Config) -> Option<(LlmProvider, &str)> {
    if !config.llm_auto_process {
        return None;
    }

    let provider_str = config.llm_provider.as_deref()?;

    let provider = match provider_str.parse::<LlmProvider>() {
        Ok(p) => p,
        Err(e) => {
            log::warn!("{e}");
            return None;
        }
    };

    let api_key = config
        .llm_api_key
        .as_deref()
        .filter(|k| !k.is_empty())
        .or_else(|| {
            log::warn!("LLM API key not configured");
            None
        })?;

    Some((provider, api_key))
}

/// Post-process transcribed text through an LLM.
/// Returns the original text if LLM is not configured, disabled, or fails.
/// Note: The caller emits LLM_PROCESSING before calling this function.
pub async fn post_process(raw_text: &str, config: &Config) -> String {
    let (provider, api_key) = match validate_llm_config(config) {
        Some(pair) => pair,
        None => return raw_text.to_string(),
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

    let provider_name = config.llm_provider.as_deref().unwrap_or("unknown");
    log::info!("LLM post-processing with {provider_name} ({model})");

    let result = if provider.uses_openai_format() {
        client::call_openai_compatible(provider.base_url(), api_key, model, system_prompt, raw_text)
            .await
    } else {
        client::call_anthropic(provider.base_url(), api_key, model, system_prompt, raw_text).await
    };

    match result {
        Ok(text) if !text.is_empty() => {
            log::info!("LLM result: \"{text}\"");
            text
        }
        Ok(_) => {
            log::warn!("LLM returned empty response, falling back to raw text");
            raw_text.to_string()
        }
        Err(e) => {
            log::warn!("LLM post-processing failed, falling back to raw text: {e}");
            raw_text.to_string()
        }
    }
}
