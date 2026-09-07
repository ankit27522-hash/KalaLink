// src/services/imageEnhancementService.js
//
// Single place that talks to the image-enhancement backend
// (backend/image-enhancement). Keeping this out of the component means
// KalaLinkForm doesn't need to know anything about endpoints, FormData,
// or HTTP status codes.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

/**
 * Sends an image to the backend enhancement agent.
 *
 * @param {File} imageFile - the uploaded product photo
 * @param {number} attempt - 1 for the first pass, 2+ for "retry, not satisfied"
 *                           (mirrors the agent's retry-escalation strategy)
 * @returns {Promise<{
 *   attempt: number,
 *   quality: object,
 *   plan: { attempt: number, scale: number, sharpen: boolean, denoise: boolean, backend: string, reason: string },
 *   image: string,          // base64 data URL, ready to use as <img src>
 *   elapsed_seconds: number
 * }>}
 */
export async function enhanceImage(imageFile, attempt = 1) {
  const formData = new FormData()
  formData.append('image', imageFile)
  formData.append('attempt', String(attempt))

  let response
  try {
    response = await fetch(`${API_BASE_URL}/api/enhance`, {
      method: 'POST',
      body: formData,
    })
  } catch (networkErr) {
    throw new Error(
      `Could not reach the enhancement service at ${API_BASE_URL}. Is the backend running?`
    )
  }

  if (!response.ok) {
    let detail = `Enhancement failed (HTTP ${response.status}).`
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
 * Lightweight liveness/capability check against the backend.
 * Useful for showing a "backend offline" banner instead of failing silently.
 */
export async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`)
    if (!response.ok) return { ok: false }
    const data = await response.json()
    return { ok: true, ...data }
  } catch {
    return { ok: false }
  }
}
