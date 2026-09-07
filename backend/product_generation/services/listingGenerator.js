/**
 * services/listingGenerator.js
 * ------------------------------
 * Calls Groq's vision-capable chat completions endpoint to turn a product
 * photo + cost context into a title, description, and tags.
 *
 * ADAPTED FROM SOURCE: the source archive (geminiAPITesting) is named for
 * the Gemini API and lists @google/genai and @huggingface/inference as
 * dependencies, but its actual server.js only ever calls Groq's API (via
 * groq-sdk) with a Qwen model — those other two packages are unused. This
 * module keeps only what's actually exercised: the Groq call. It also
 * drops the hardcoded "$" from the cost-context prompt so the output isn't
 * implicitly assumed to be USD (KalaLink's UI uses ₹).
 */

import Groq from 'groq-sdk';

// Lazily constructed: the Groq SDK throws immediately if the API key is
// missing at construction time. Building it eagerly at module load would
// crash the whole server on startup whenever .env isn't configured yet —
// instead we defer construction to the first actual request, so the server
// can still start (and /api/health can still report the misconfiguration).
let groqClient = null;
function getGroqClient() {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

const SYSTEM_PROMPT =
  'You are an ecommerce copywriter. Look at the product image to identify what the item ' +
  "is, what it's made of, its style, and its condition. Combine that with the provided " +
  'cost context to write a compelling title and description and generate 4-6 relevant tags.\n\n' +
  'Respond with ONLY a single valid JSON object, no markdown formatting, no code fences, ' +
  'and no explanatory text before or after it. It must have exactly these keys:\n' +
  '- "title": a string, a concise item title\n' +
  '- "description": a string, a detailed item summary\n' +
  '- "tags": an array of 4 to 6 short strings';

/**
 * @param {Object} params
 * @param {string} params.image - base64 data URL (image/png or image/jpeg)
 * @param {number} params.materialCost
 * @param {string|number} params.timeTaken
 * @param {number} params.quantity
 * @param {number|null} [params.referencePrice]
 * @returns {Promise<{ title: string, description: string, tags: string[] }>}
 * @throws {Error} on network/API failure, or if the model's response isn't valid JSON
 */
export async function generateListingCopy({ image, materialCost, timeTaken, quantity, referencePrice }) {
  const pricingContext = [
    `Raw material cost: ${materialCost}`,
    `Time taken to make: ${timeTaken}`,
    `Quantity available: ${quantity}`,
    referencePrice !== undefined && referencePrice !== null
      ? `Reference price of similar items: ${referencePrice}`
      : `Reference price of similar items: not provided`,
  ].join('\n');

  const completion = await getGroqClient().chat.completions.create({
    model: 'qwen/qwen3.8-27b',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: pricingContext },
          { type: 'image_url', image_url: { url: image } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 400,
  });

  const raw = completion.choices[0].message.content;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (parseErr) {
    const err = new Error('The model returned an unexpected format. Please try again.');
    err.rawModelOutput = raw;
    err.isMalformedModelResponse = true;
    throw err;
  }

  if (
    typeof parsed.title !== 'string' ||
    typeof parsed.description !== 'string' ||
    !Array.isArray(parsed.tags)
  ) {
    const err = new Error('The model response was missing required fields. Please try again.');
    err.isMalformedModelResponse = true;
    throw err;
  }

  return parsed;
}
