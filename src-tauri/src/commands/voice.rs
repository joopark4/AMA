use serde::Serialize;

#[derive(Serialize)]
pub struct TranscriptionResult {
    pub text: String,
    pub confidence: f32,
    pub language: String,
}

#[derive(Serialize)]
pub struct SynthesisResult {
    pub audio_base64: String,
    pub duration: f32,
}

/// Transcribe audio using local Whisper model
/// Note: This is a placeholder. Actual implementation would use whisper-rs crate
#[tauri::command]
pub async fn transcribe_audio(
    _audio_base64: String,
    _model: String,
    _language: String,
) -> Result<TranscriptionResult, String> {
    // TODO: Implement actual Whisper transcription using whisper-rs
    // For now, return a placeholder that indicates the feature needs setup

    // In a full implementation:
    // 1. Decode base64 audio
    // 2. Load Whisper model
    // 3. Run transcription
    // 4. Return result

    Err("Local Whisper transcription not yet implemented. Using Web Speech API fallback.".to_string())
}

/// Synthesize speech using local TTS model
/// Note: This is a placeholder. Actual implementation would use a TTS library
#[tauri::command]
pub async fn synthesize_speech(
    _text: String,
    _voice: String,
    _speed: f32,
) -> Result<SynthesisResult, String> {
    // TODO: Implement actual TTS synthesis
    // Options:
    // 1. Kokoro-82M via Python subprocess
    // 2. ONNX-based TTS
    // 3. espeak-ng as fallback

    Err("Local TTS synthesis not yet implemented. Using Web Speech API fallback.".to_string())
}

/// Check if Whisper model is available locally
#[tauri::command]
pub async fn check_whisper_available() -> bool {
    // TODO: Check if Whisper model files exist
    // For now, return false to use fallback
    false
}

/// Check if TTS model is available locally
#[tauri::command]
pub async fn check_tts_available() -> bool {
    // TODO: Check if TTS model files exist
    // For now, return false to use fallback
    false
}
