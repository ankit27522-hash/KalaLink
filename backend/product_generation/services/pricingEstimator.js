/**
 * services/pricingEstimator.js
 * ------------------------------
 * Deterministic, cost-based price estimator for handmade items.
 * Ported as-is from the source archive (geminiAPITesting/backend/pricing.js) —
 * the logic was already currency-agnostic (works on plain numbers), so no
 * adaptation was needed beyond moving it into this module.
 *
 * NOTE ON CURRENCY: KalaLink's form uses ₹ (INR) placeholders, but these
 * defaults (hourlyRate, etc.) were tuned for USD-scale numbers in the
 * source archive. They are left as-is here — see the integration README
 * for why, and tune them for INR before relying on this in production.
 */

const DEFAULTS = {
  hourlyRate: 6,         // currency-units/hour — fair wage baseline, tune to your market
  overheadRate: 0.15,    // 15% of (material + labor) for tools/electricity/packaging
  marginMultiplier: 1.8, // profit margin on top of base cost
  batchDiscountCap: 0.15,// max 15% per-unit discount for large batches
  scarcityPremium: 0.10, // +10% if it's a one-of-a-kind piece
  referenceWeight: 0.4,  // how much weight the market reference price gets (0-1)
};

/**
 * Parses free-text time input into hours.
 * Handles "3 hours", "2 days", "45 minutes", "1.5 hrs", etc.
 */
export function parseTimeToHours(timeTaken) {
  if (typeof timeTaken === 'number') return timeTaken; // assume already hours
  const str = String(timeTaken).trim().toLowerCase();
  const match = str.match(/([\d.]+)\s*(hour|hr|day|minute|min)/);
  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit = match[2];

  if (unit.startsWith('hour') || unit.startsWith('hr')) return value;
  if (unit.startsWith('day')) return value * 8; // assume an 8-hour workday
  if (unit.startsWith('min')) return value / 60;

  return null;
}

/**
 * Computes a suggested price from cost inputs.
 *
 * @param {Object} input
 * @param {number} input.materialCost - raw material cost
 * @param {string|number} input.timeTaken - e.g. "3 hours", "2 days", or hours as a number
 * @param {number} input.quantity - units available
 * @param {number|null} [input.referencePrice] - market reference price, if known
 * @param {Object} [options] - override any DEFAULTS
 */
export function estimatePrice(input, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const { materialCost, timeTaken, quantity, referencePrice } = input;

  const hoursWorked = parseTimeToHours(timeTaken);
  if (hoursWorked === null) {
    throw new Error(`Could not parse time taken: "${timeTaken}"`);
  }

  const laborCost = hoursWorked * cfg.hourlyRate;
  const overhead = (materialCost + laborCost) * cfg.overheadRate;
  const baseCost = materialCost + laborCost + overhead;

  let suggestedPrice = baseCost * cfg.marginMultiplier;

  // Quantity adjustment
  if (quantity === 1) {
    suggestedPrice *= 1 + cfg.scarcityPremium;
  } else if (quantity > 10) {
    const discount = Math.min(cfg.batchDiscountCap, (quantity - 10) * 0.01);
    suggestedPrice *= 1 - discount;
  }

  // Blend with market reference price, if provided
  let finalPrice = suggestedPrice;
  if (referencePrice !== null && referencePrice !== undefined && !isNaN(referencePrice)) {
    finalPrice =
      suggestedPrice * (1 - cfg.referenceWeight) + referencePrice * cfg.referenceWeight;

    // Clamp: never below cost + 10%, never more than 1.5x the reference
    const floor = baseCost * 1.1;
    const ceiling = referencePrice * 1.5;
    finalPrice = Math.max(floor, Math.min(finalPrice, ceiling));
  }

  return {
    price: Math.round(finalPrice * 100) / 100,
    breakdown: {
      hoursWorked,
      laborCost: round2(laborCost),
      overhead: round2(overhead),
      baseCost: round2(baseCost),
      suggestedPrice: round2(suggestedPrice),
    },
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
