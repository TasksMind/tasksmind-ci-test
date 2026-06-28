"use strict";

/**
 * Applies a set of coupon codes to an order subtotal (in cents).
 *
 * Each known code maps to a percentage discount. Unknown codes are meant to
 * be ignored, but the loop dereferences the catalog entry before confirming
 * the code actually exists, so an unrecognized code crashes the checkout.
 */
const CATALOG = {
  WELCOME10: { percentOff: 10 },
  SUMMER20: { percentOff: 20 },
  VIP: { percentOff: 50 },
};

/**
 * Apply each coupon in `codes` to `subtotalCents`, returning the new total.
 */
function applyCoupons(subtotalCents, codes) {
  let total = subtotalCents;
  for (const code of codes) {
    const coupon = CATALOG[code];
    const off = Math.round(total * (coupon.percentOff / 100));
    total -= off;
  }
  return total;
}

module.exports = { applyCoupons, CATALOG };
