// src/services/voiceToTextService.js
//
// Single place that talks to the voice-to-text backend
// (backend/voice-to-text). Mirrors the pattern used by
// imageEnhancementService.js: components never build FormData or touch
// fetch() directly, they just call this and get back plain data or a
// thrown Error with a readable message.

const VOICE_API_BASE_URL = import.meta.env.VITE_VOICE_API_BASE_URL || 'http://localhost:5000'

/**
 * Sends a recorded audio clip to the backend for transcription.
 *
 * @param {Blob} audioBlob - the recorded clip (e.g. from MediaRecorder)
 * @returns {Promise<{
 *   text: string,
 *   language_detected: string | null,
 *   language_confidence: number | null,
 *   elapsed_seconds: number
 * }>}
 */
export async function transcribeAudio(audioBlob) {
  const formData = new FormData()
  // Filename extension helps the backend detect the container format.
  const extension = audioBlob.type.includes('wav') ? 'wav' : 'webm'
  formData.append('audio', audioBlob, `recording.${extension}`)

  let response
  try {
    response = await fetch(`${VOICE_API_BASE_URL}/api/voice/transcribe`, {
      method: 'POST',
      body: formData,
    })
  } catch (networkErr) {
    throw new Error(
      `Could not reach the voice-to-text service at ${VOICE_API_BASE_URL}. Is the backend running?`
    )
  }

  if (!response.ok) {
    let detail = `Transcription failed (HTTP ${response.status}).`
    try {
      const body = await response.json()
      if (body?.detail) detail = body.detail
    } catch {
      // response wasn't JSON — keep the generic message
    }
    throw new Error(detail)
  }

  return response.json()
}

/**
 * Lightweight liveness/capability check against the voice backend.
 */
export async function checkVoiceBackendHealth() {
  try {
    const response = await fetch(`${VOICE_API_BASE_URL}/api/voice/health`)
    if (!response.ok) return { ok: false }
    const data = await response.json()
    return { ok: true, ...data }
  } catch {
    return { ok: false }
  }
}
