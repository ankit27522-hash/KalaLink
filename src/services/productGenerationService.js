// src/services/productGenerationService.js
//
// Single place that talks to the product-generation backend
// (backend/product_generation). Mirrors the pattern used by
// imageEnhancementService.js and voiceToTextService.js: components never
// build the request body or touch fetch() directly.

const PRODUCT_API_BASE_URL = import.meta.env.VITE_PRODUCT_API_BASE_URL || 'http://localhost:5001'

/**
 * Sends the ENHANCED image and cost fields to the product-generation
 * backend and gets back a listing.
 *
 * @param {Object} params
 * @param {string} params.image - enhanced image as a base64 data URL (from imageEnhancementService)
 * @param {number} params.materialCost
 * @param {number} params.quantity
 * @param {number|null} [params.referencePrice]
 * @returns {Promise<{
 *   title: string,
 *   description: string,
 *   tags: string[],
 *   price_estimation: number,
 *   price_breakdown: object
 * }>}
 */
export async function generateProductListing({ image, materialCost, quantity, referencePrice }) {
  let response
  try {
    response = await fetch(`${PRODUCT_API_BASE_URL}/api/generate-listing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, materialCost, quantity, referencePrice }),
    })
  } catch (networkErr) {
    throw new Error(
      `Could not reach the product-generation service at ${PRODUCT_API_BASE_URL}. Is the backend running?`
    )
  }

  let data
  try {
    data = await response.json()
  } catch {
    throw new Error(`Product generation failed (HTTP ${response.status}).`)
  }

  if (!response.ok) {
    throw new Error(data?.error || `Product generation failed (HTTP ${response.status}).`)
  }

  return data
}

/**
 * Lightweight liveness/capability check against the backend.
 */
export async function checkProductGenerationHealth() {
  try {
    const response = await fetch(`${PRODUCT_API_BASE_URL}/api/health`)
    if (!response.ok) return { ok: false }
    const data = await response.json()
    return { ok: true, ...data }
  } catch {
    return { ok: false }
  }
}
