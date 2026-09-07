/**
 * services/pricingEstimator.js
 * ------------------------------
 * Deterministic, cost-based price estimator for handmade items.
 * Prices off material cost only (no time/labor input) — overhead, margin,
 * batch discount, scarcity premium, and market-reference blending are all
 * still applied on top of material cost.
 *
 * NOTE ON CURRENCY: KalaLink's form uses ₹ (INR) placeholders, but these
 * defaults (overheadRate, etc.) were tuned for USD-scale numbers in the
 * source archive. Tune them for INR before relying on this in production.
 */

const DEFAULTS = {
  overheadRate: 0.15,    // 15% of material cost for tools/electricity/packaging
  marginMultiplier: 1.8, // profit margin on top of base cost
  batchDiscountCap: 0.15,// max 15% per-unit discount for large batches
  scarcityPremium: 0.10, // +10% if it's a one-of-a-kind piece
  referenceWeight: 0.4,  // how much weight the market reference price gets (0-1)
};

/**
 * Computes a suggested price from cost inputs.
 *
 * @param {Object} input
 * @param {number} input.materialCost - raw material cost
 * @param {number} input.quantity - units available
 * @param {number|null} [input.referencePrice] - market reference price, if known
 * @param {Object} [options] - override any DEFAULTS
 */
export function estimatePrice(input, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const { materialCost, quantity, referencePrice } = input;

  const overhead = materialCost * cfg.overheadRate;
  const baseCost = materialCost + overhead;

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
      overhead: round2(overhead),
      baseCost: round2(baseCost),
      suggestedPrice: round2(suggestedPrice),
    },
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
