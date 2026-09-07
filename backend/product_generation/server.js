/**
 * server.js — backend/product_generation
 * ----------------------------------------
 * HTTP surface for the product-generation service.
 *
 * POST /api/generate-listing  - enhanced image + cost fields -> title,
 *                                description, tags, price estimate.
 * GET  /api/health            - liveness probe (mirrors the other two
 *                                backend modules' /api/health convention).
 *
 * Receives the ENHANCED image (not the original) and the values already
 * collected/transcribed by the existing form fields — never raw audio.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { estimatePrice } from './services/pricingEstimator.js';
import { generateListingCopy } from './services/listingGenerator.js';

const PORT = process.env.PORT || 5001;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 10);

if (!process.env.GROQ_API_KEY) {
  console.warn(
    '[product-generation] Warning: GROQ_API_KEY is not set. ' +
      'Copy .env.example to .env and add your key before calling /api/generate-listing.'
  );
}

const app = express();
app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json({ limit: `${MAX_UPLOAD_MB + 2}mb` })); // small buffer over the image limit for JSON overhead

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', groq_configured: Boolean(process.env.GROQ_API_KEY) });
});

app.post('/api/generate-listing', async (req, res) => {
  try {
    const { image, materialCost, quantity, referencePrice } = req.body;

    // --- Validation ---------------------------------------------------
    if (!image || typeof image !== 'string' || !image.startsWith('data:image')) {
      return res.status(400).json({ error: 'An enhanced product image is required.' });
    }
    const approxBytes = (image.length * 3) / 4;
    if (approxBytes > MAX_UPLOAD_MB * 1024 * 1024) {
      return res.status(400).json({ error: `Image exceeds the ${MAX_UPLOAD_MB}MB limit.` });
    }
    if (materialCost === undefined || materialCost === null || isNaN(materialCost)) {
      return res.status(400).json({ error: 'Raw material cost is required and must be a number.' });
    }
    if (quantity === undefined || quantity === null || isNaN(quantity)) {
      return res.status(400).json({ error: 'Quantity available is required and must be a number.' });
    }
    if (
      referencePrice !== undefined &&
      referencePrice !== null &&
      referencePrice !== '' &&
      isNaN(referencePrice)
    ) {
      return res.status(400).json({ error: 'Reference/expected price must be a number if provided.' });
    }

    // --- 1. Deterministic price (compute first so a bad time string fails fast) ---
    let priceResult;
    try {
      priceResult = estimatePrice({
        materialCost: Number(materialCost),
        quantity: Number(quantity),
        referencePrice:
          referencePrice !== undefined && referencePrice !== null && referencePrice !== ''
            ? Number(referencePrice)
            : null,
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    // --- 2. AI for title/description/tags -------------------------------
    let listingCopy;
    try {
      listingCopy = await generateListingCopy({
        image,
        materialCost: Number(materialCost),
        quantity: Number(quantity),
        referencePrice:
          referencePrice !== undefined && referencePrice !== null && referencePrice !== ''
            ? Number(referencePrice)
            : null,
      });
    } catch (err) {
      if (err.isMalformedModelResponse) {
        console.error('Model did not return valid JSON:', err.rawModelOutput || err.message);
        return res.status(502).json({ error: err.message });
      }
      throw err; // fall through to the generic handler below
    }

    // --- 3. Merge: algo owns the price, AI owns the copy -----------------
    res.json({
      ...listingCopy,
      price_estimation: priceResult.price,
      price_breakdown: priceResult.breakdown,
    });
  } catch (error) {
    console.error('Product-generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate product listing.' });
  }
});

app.listen(PORT, () => console.log(`product-generation backend running on http://localhost:${PORT}`));
