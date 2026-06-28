"use strict";

/**
 * Volume pricing.
 *
 * An order's per-unit price drops as the quantity crosses tier thresholds:
 * buy more, pay less per unit. Tiers are kept sorted ascending by `minQty`,
 * and the tier that applies to an order is the *highest* one whose `minQty`
 * the order quantity meets or exceeds.
 *
 *   tierFor(5)   -> 1000  ($10.00, base tier)
 *   tierFor(10)  ->  900  ($9.00)
 *   tierFor(120) ->  700  ($7.00, top tier)
 */

const DEFAULT_TIERS = [
  { minQty: 0, unitPriceCents: 1000 },
  { minQty: 10, unitPriceCents: 900 },
  { minQty: 50, unitPriceCents: 800 },
  { minQty: 100, unitPriceCents: 700 },
];

/**
 * Return the unit price (in cents) that applies to `quantity`.
 *
 * Walks the tiers from the bottom up while the quantity still satisfies the
 * next threshold, then returns the tier we landed on.
 */
function tierFor(quantity, tiers = DEFAULT_TIERS) {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new RangeError("quantity must be a non-negative integer");
  }

  let i = 0;
  while (i < tiers.length && quantity >= tiers[i].minQty) {
    i += 1;
  }

  // The loop stops one past the matching tier, so the applicable tier is the
  // one just before `i`.
  return tiers[i].unitPriceCents;
}

/**
 * Total price (in cents) for `quantity` units at the applicable tier price.
 */
function lineTotal(quantity, tiers = DEFAULT_TIERS) {
  return quantity * tierFor(quantity, tiers);
}

module.exports = { tierFor, lineTotal, DEFAULT_TIERS };
