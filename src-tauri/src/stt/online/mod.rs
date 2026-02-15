//! Online speech-to-text providers
//! Supports OpenAI, Deepgram, AssemblyAI, Mistral, and ElevenLabs

mod assemblyai;
mod deepgram;
mod elevenlabs;
mod openai;
pub mod wav;

use crate::config::Config;

/// Supported online STT providers
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SttProvider {
    OpenAi,
    Deepgram,
    AssemblyAi,
    Mistral,
    ElevenLabs,
}

impl std::str::FromStr for SttProvider {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "openai" => Ok(Self::OpenAi),
            "deepgram" => Ok(Self::Deepgram),
            "assemblyai" => Ok(Self::AssemblyAi),
            "mistral" => Ok(Self::Mistral),
            "elevenlabs" => Ok(Self::ElevenLabs),
            _ => Err(format!("Unknown STT provider: {s}")),
        }
    }
}

impl SttProvider {
    pub fn base_url(&self) -> &'static str {
        match self {
            Self::OpenAi => "https://api.openai.com/v1",
            Self::Deepgram => "https://api.deepgram.com/v1",
            Self::AssemblyAi => "https://api.assemblyai.com/v2",
            Self::Mistral => "https://api.mistral.ai/v1",
            Self::ElevenLabs => "https://api.elevenlabs.io/v1",
        }
    }

    pub fn default_model(&self) -> &'static str {
        match self {
            Self::OpenAi => "whisper-1",
            Self::Deepgram => "nova-3",
            Self::AssemblyAi => "best",
            Self::Mistral => "voxtral-mini-latest",
            Self::ElevenLabs => "scribe_v1",
        }
    }

    pub fn supports_diarization(&self) -> bool {
        matches!(
            self,
            Self::Deepgram | Self::AssemblyAi | Self::Mistral | Self::ElevenLabs
        )
    }
}

/// Check whether an online STT provider is configured
pub fn is_online_stt(config: &Config) -> bool {
    config.stt_provider.as_deref().is_some_and(|p| p.parse::<SttProvider>().is_ok())
}

/// Validate that STT config has required fields. Returns (provider, api_key) or error.
pub fn validate_stt_config(config: &Config) -> Result<(SttProvider, String), String> {
    let provider_str = config
        .stt_provider
        .as_deref()
        .ok_or("No STT provider configured")?;

    let provider: SttProvider = provider_str.parse()?;

    let api_key = config
        .stt_api_key
        .as_deref()
        .filter(|k| !k.is_empty())
        .ok_or("No STT API key configured")?
        .to_string();

    Ok((provider, api_key))
}

/// Transcribe audio bytes using the configured online provider.
/// `filename` and `content_type` describe the audio format for the upload.
pub async fn transcribe_online(
    config: &Config,
    audio_bytes: Vec<u8>,
    filename: &str,
    content_type: &str,
) -> Result<String, String> {
    let (provider, api_key) = validate_stt_config(config)?;

    let model = config
        .stt_model
        .as_deref()
        .filter(|m| !m.is_empty())
        .unwrap_or(provider.default_model());

    let diarize = config.stt_enable_diarization && provider.supports_diarization();

    log::info!(
        "Online STT with {:?} (model={}, diarize={})",
        provider,
        model,
        diarize,
    );

    match provider {
        SttProvider::OpenAi | SttProvider::Mistral => {
            openai::transcribe(
                provider.base_url(),
                &api_key,
                model,
                audio_bytes,
                filename,
                content_type,
                diarize,
            )
            .await
        }
        SttProvider::Deepgram => {
            deepgram::transcribe(
                provider.base_url(),
                &api_key,
                model,
                audio_bytes,
                content_type,
                diarize,
            )
            .await
        }
        SttProvider::AssemblyAi => {
            assemblyai::transcribe(provider.base_url(), &api_key, audio_bytes, diarize).await
        }
        SttProvider::ElevenLabs => {
            elevenlabs::transcribe(
                provider.base_url(),
                &api_key,
                model,
                audio_bytes,
                filename,
                content_type,
                diarize,
            )
            .await
        }
    }
}
