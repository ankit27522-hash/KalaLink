// src/utils/parseNumeric.js
//
// KalaLinkForm's fields are free text — typed, or filled in by the
// voice-to-text backend — so "materialCost" might arrive as "₹400",
// "400 rupees", or just "400". The product-generation backend's pricing
// formula needs a plain number. This pulls the first numeric value out of
// a string; returns null if none is found.

export function parseNumericValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;

  const match = String(value).match(/[\d,]+(\.\d+)?/);
  if (!match) return null;

  const cleaned = match[0].replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
