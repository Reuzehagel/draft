//! WAV encoder for converting f32 audio samples to WAV bytes
//! Used for push-to-talk: recorded audio → WAV bytes for online API upload

/// Encode f32 samples as a WAV file (PCM16, mono).
/// Writes a 44-byte RIFF/WAVE header followed by i16 PCM data.
pub fn encode_wav(samples: &[f32], sample_rate: u32) -> Vec<u8> {
    let num_channels: u16 = 1;
    let bits_per_sample: u16 = 16;
    let bytes_per_sample = bits_per_sample / 8;
    let data_size = (samples.len() as u32) * bytes_per_sample as u32;
    let file_size = 36 + data_size; // Total file size minus 8 bytes for RIFF header

    let mut buf = Vec::with_capacity(44 + data_size as usize);

    // RIFF header
    buf.extend_from_slice(b"RIFF");
    buf.extend_from_slice(&file_size.to_le_bytes());
    buf.extend_from_slice(b"WAVE");

    // fmt sub-chunk
    buf.extend_from_slice(b"fmt ");
    buf.extend_from_slice(&16u32.to_le_bytes()); // Sub-chunk size
    buf.extend_from_slice(&1u16.to_le_bytes()); // Audio format (PCM)
    buf.extend_from_slice(&num_channels.to_le_bytes());
    buf.extend_from_slice(&sample_rate.to_le_bytes());
    let byte_rate = sample_rate * num_channels as u32 * bytes_per_sample as u32;
    buf.extend_from_slice(&byte_rate.to_le_bytes());
    let block_align = num_channels * bytes_per_sample;
    buf.extend_from_slice(&block_align.to_le_bytes());
    buf.extend_from_slice(&bits_per_sample.to_le_bytes());

    // data sub-chunk
    buf.extend_from_slice(b"data");
    buf.extend_from_slice(&data_size.to_le_bytes());

    // Convert f32 → i16 PCM
    for &sample in samples {
        let clamped = sample.clamp(-1.0, 1.0);
        let value = (clamped * 32767.0) as i16;
        buf.extend_from_slice(&value.to_le_bytes());
    }

    buf
}
