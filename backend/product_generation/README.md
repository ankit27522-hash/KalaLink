# product_generation

Turns an enhanced product photo + cost details into a listing: title,
description, tags, and a price estimate.

- **Copy** (title/description/tags): Groq's vision-capable chat completions
  API (`qwen/qwen3.8-27b`), given the enhanced image and a short cost-context
  prompt.
- **Price**: a deterministic formula (`services/pricingEstimator.js`) —
  never the AI — so the number is reproducible and explainable via
  `price_breakdown`.

This mirrors `backend/image-enhancement` and `backend/voice-to-text`: a
self-contained module with its own `.env`, its own port, and a `/api/health`
probe, talked to by the frontend only through
`src/services/productGenerationService.js`.

## Setup

```bash
cd backend/product_generation
npm install
cp .env.example .env   # then add your real GROQ_API_KEY
npm start               # or: npm run dev (auto-restart on change)
```

Runs on **http://localhost:5001** by default (configurable via `PORT`).
Deliberately not 5000 — `backend/voice-to-text` already uses that port.

## API

### `POST /api/generate-listing`

```json
{
  "image": "data:image/png;base64,...",   // the ENHANCED image, not the original
  "materialCost": 400,
  "timeTaken": "3 days",
  "quantity": 5,
  "referencePrice": 1200                    // optional
}
```

Response:

```json
{
  "title": "...",
  "description": "...",
  "tags": ["...", "..."],
  "price_estimation": 1180.5,
  "price_breakdown": { "hoursWorked": 24, "laborCost": 144, "overhead": 81.6, "baseCost": 625.6, "suggestedPrice": 1126.08 }
}
```

Errors are `4xx`/`5xx` with `{ "error": "<message>" }`.

### `GET /api/health`

```json
{ "status": "ok", "groq_configured": true }
```

## Notes / adaptation from the source archive

- The source archive is named `geminiAPITesting` and lists `@google/genai`
  and `@huggingface/inference` as dependencies, but its `server.js` only
  ever called **Groq's** API — those two packages (and `multer`, also
  unused) were dropped here.
- The pricing formula's defaults (`hourlyRate`, etc.) were tuned for
  USD-scale numbers in the source. KalaLink's form uses ₹ — the numbers
  still work, but the constants are a reasonable-looking placeholder, not
  a calibrated INR baseline. Tune `services/pricingEstimator.js`'s
  `DEFAULTS` before relying on the price for real listings.
- The AI prompt's cost-context string no longer hardcodes a `$` prefix, so
  the model isn't nudged into assuming USD when describing the item.
