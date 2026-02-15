//! LLM post-processing module
//! Sends transcribed text through an LLM for cleanup or voice command execution

mod client;
pub mod commands;
mod process;

pub use process::{post_process, should_process};

/// Supported LLM providers
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LlmProvider {
    OpenAi,
    Anthropic,
    OpenRouter,
    Cerebras,
    Groq,
}

impl std::str::FromStr for LlmProvider {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "openai" => Ok(Self::OpenAi),
            "anthropic" => Ok(Self::Anthropic),
            "openrouter" => Ok(Self::OpenRouter),
            "cerebras" => Ok(Self::Cerebras),
            "groq" => Ok(Self::Groq),
            _ => Err(format!("Unknown LLM provider: {s}")),
        }
    }
}

impl LlmProvider {
    pub fn base_url(&self) -> &'static str {
        match self {
            Self::OpenAi => "https://api.openai.com/v1",
            Self::Anthropic => "https://api.anthropic.com/v1",
            Self::OpenRouter => "https://openrouter.ai/api/v1",
            Self::Cerebras => "https://api.cerebras.ai/v1",
            Self::Groq => "https://api.groq.com/openai/v1",
        }
    }

    pub fn default_model(&self) -> &'static str {
        match self {
            Self::OpenAi => "gpt-4o-mini",
            Self::Anthropic => "claude-haiku-4-5-20251001",
            Self::OpenRouter => "openai/gpt-4o-mini",
            Self::Cerebras => "llama-4-scout-17b-16e-instruct",
            Self::Groq => "llama-3.3-70b-versatile",
        }
    }

    pub fn uses_openai_format(&self) -> bool {
        !matches!(self, Self::Anthropic)
    }
}
