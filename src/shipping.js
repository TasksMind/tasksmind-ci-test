"use strict";

/**
 * Computes a shipping quote (in cents) for an order going to a region.
 *
 * Each known region maps to a per-kilogram rate. Unknown regions are meant
 * to fall back to the domestic rate, but the lookup reads the rate before
 * confirming the region exists, so an unrecognized region crashes the quote.
 */
const RATES = {
  domestic: { perKgCents: 50 },
  eu: { perKgCents: 120 },
  intl: { perKgCents: 300 },
};

/**
 * Quote shipping for `weightKg` going to `region`, in cents.
 */
function shippingCents(region, weightKg) {
  const rate = RATES[region];
  return Math.round(weightKg * rate.perKgCents);
}

module.exports = { shippingCents, RATES };
